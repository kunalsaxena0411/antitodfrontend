
import { fetchJsonWithCors } from './http';

const VT_BASE = 'https://www.virustotal.com/api/v3';

export const getVtKey = () => localStorage.getItem('user_vt_api_key');

export interface VtAnalysisStats {
    malicious: number;
    suspicious: number;
    undetected: number;
    harmless: number;
    timeout: number;
}

export interface VtResult {
    data: {
        attributes: {
            last_analysis_stats: VtAnalysisStats;
            reputation?: number;
            tags?: string[];
            title?: string;
        }
    }
}

export const enrichVtIp = async (ip: string): Promise<VtResult | null> => {
    const key = getVtKey();
    if (!key) return null;
    const url = `${VT_BASE}/ip_addresses/${ip}`;
    try {
        // Must require headers to ensure x-apikey is transmitted
        return await fetchJsonWithCors<VtResult>(url, { 
            headers: { 
                'x-apikey': key,
                'Accept': 'application/json'
            }, 
            requiresHeaders: true 
        });
    } catch (e) {
        console.warn("VT IP Enrichment failed", e);
        return null;
    }
};

export const enrichVtDomain = async (domain: string): Promise<VtResult | null> => {
    const key = getVtKey();
    if (!key) return null;
    const url = `${VT_BASE}/domains/${domain}`;
    try {
        return await fetchJsonWithCors<VtResult>(url, { 
            headers: { 
                'x-apikey': key,
                'Accept': 'application/json'
            }, 
            requiresHeaders: true 
        });
    } catch (e) {
        console.warn("VT Domain Enrichment failed", e);
        return null;
    }
};

export const enrichVtHash = async (hash: string): Promise<VtResult | null> => {
    const key = getVtKey();
    if (!key) return null;
    const url = `${VT_BASE}/files/${hash}`;
    try {
        return await fetchJsonWithCors<VtResult>(url, { 
            headers: { 
                'x-apikey': key,
                'Accept': 'application/json'
            }, 
            requiresHeaders: true 
        });
    } catch (e) {
        console.warn("VT Hash Enrichment failed", e);
        return null;
    }
};
