
import { fetchJsonWithCors } from './http';

const SHADOWSERVER_ASN_API = 'https://api.shadowserver.org/net/asn';
const SHADOWSERVER_MALWARE_API = 'https://api.shadowserver.org/malware/info';

interface ShadowserverEntry {
    asn: number;
    ip: string;
    prefix: string;
    asn_name: string;
    geo?: string;
    peer?: string;
}

export interface ShadowserverMalwareInfo {
    timestamp: string;
    magic: string;
    sha256: string;
    filesize: string;
    sha1: string;
    entropic: string;
    tlsh: string;
    anti_virus: { signature: string; vendor: string }[];
    md5: string;
    last_seen: string;
    sha512: string;
    first_seen: string;
    type: string;
    adobe_malware_classifier?: string;
}

/**
 * Queries Shadowserver for ASN data in bulk (Max 1000 IPs).
 * Uses the origin query parameter: ?origin=ip1,ip2,ip3
 */
export const fetchShadowserverAsn = async (ips: string[]): Promise<Record<string, ShadowserverEntry>> => {
    if (ips.length === 0) return {};

    // API Limit is technically higher, but we stick to 100 for safety and URL length constraints
    const uniqueIps = Array.from(new Set(ips)).slice(0, 100); 
    const ipStr = uniqueIps.join(',');
    const url = `${SHADOWSERVER_ASN_API}?origin=${encodeURIComponent(ipStr)}`;

    try {
        // Shadowserver returns an array of objects
        const response = await fetchJsonWithCors<ShadowserverEntry[]>(url);
        
        const resultMap: Record<string, ShadowserverEntry> = {};
        
        if (Array.isArray(response)) {
            response.forEach(entry => {
                if (entry.ip) {
                    resultMap[entry.ip] = entry;
                }
            });
        }
        
        return resultMap;
    } catch (e) {
        console.warn("Shadowserver bulk lookup failed", e);
        return {};
    }
};

/**
 * Queries Shadowserver for ASN data in bulk using the PEER parameter.
 * Supports up to 1000 items per call.
 */
export const fetchShadowserverAsnPeers = async (ips: string[]): Promise<Record<string, { asn: string, name: string, prefix: string, geo?: string }>> => {
    if (ips.length === 0) return {};
    
    // Deduplicate
    const uniqueIps = Array.from(new Set(ips));
    const results: Record<string, { asn: string, name: string, prefix: string, geo?: string }> = {};

    // Chunk into 1000 (API limit)
    const chunks = [];
    for (let i = 0; i < uniqueIps.length; i += 1000) {
        chunks.push(uniqueIps.slice(i, i + 1000));
    }

    for (const chunk of chunks) {
        const ipStr = chunk.join(',');
        const url = `${SHADOWSERVER_ASN_API}?peer=${encodeURIComponent(ipStr)}`;
        try {
            const response = await fetchJsonWithCors<ShadowserverEntry[]>(url);
            if (Array.isArray(response)) {
                response.forEach(item => {
                    if (item.ip) {
                        results[item.ip] = {
                            asn: `AS${item.asn}`,
                            name: item.asn_name,
                            prefix: item.prefix,
                            geo: item.geo // Shadowserver sometimes provides geo
                        };
                    }
                });
            }
        } catch (e) {
            console.warn("Shadowserver bulk peer lookup failed", e);
        }
    }
    return results;
};

/**
 * Queries Shadowserver for Malware Information by Hash.
 */
export const fetchShadowserverMalwareInfo = async (hash: string): Promise<ShadowserverMalwareInfo | null> => {
    const url = `${SHADOWSERVER_MALWARE_API}?sample=${encodeURIComponent(hash)}`;
    try {
        const response = await fetchJsonWithCors<ShadowserverMalwareInfo[]>(url);
        if (Array.isArray(response) && response.length > 0) {
            return response[0];
        }
        return null;
    } catch (e) {
        console.warn("Shadowserver malware lookup failed", e);
        return null;
    }
};
