
import { Buffer } from 'buffer';

export interface TaxiiConfig {
    rootUrl: string;
    collectionId: string;
    username?: string;
    password?: string;
    token?: string;
    useProxy?: boolean;
}

const CORS_PROXY = '/api/proxy?url=';

export const pushToTaxii = async (stixBundle: string, config: TaxiiConfig): Promise<{ success: boolean; message: string }> => {
    // Normalize URL
    const baseUrl = config.rootUrl.replace(/\/$/, '');
    // Standard TAXII 2.1 Add Objects endpoint
    let endpoint = `${baseUrl}/collections/${config.collectionId}/objects/`;
    
    if (config.useProxy) {
        endpoint = `${CORS_PROXY}${encodeURIComponent(endpoint)}`;
    }

    const headers: HeadersInit = {
        'Content-Type': 'application/stix+json;version=2.1',
        'Accept': 'application/taxii+json;version=2.1'
    };

    if (config.token) {
        headers['Authorization'] = `Bearer ${config.token}`;
    } else if (config.username && config.password) {
        const auth = btoa(`${config.username}:${config.password}`);
        headers['Authorization'] = `Basic ${auth}`;
    }

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: stixBundle
        });

        if (response.ok) {
            // 202 Accepted is common for TAXII
            const text = await response.text();
            let statusMsg = 'Bundle successfully pushed to TAXII collection.';
            try {
                const json = JSON.parse(text);
                if (json.status) statusMsg += ` Status: ${json.status.status}`;
            } catch (e) {}
            return { success: true, message: statusMsg };
        } else {
            const text = await response.text();
            return { success: false, message: `Server Error (${response.status}): ${text.substring(0, 150)}` };
        }
    } catch (error: any) {
        return { success: false, message: `Network Error: ${error.message}` };
    }
};

