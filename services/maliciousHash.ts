
import { MaliciousHashEntry } from '../types';
import { fetchWithCors } from './http';

const API_URL = 'https://raw.githubusercontent.com/romainmarcoux/malicious-hash/main/full-hash-md5-aa.txt';

export const fetchMaliciousHashes = async (): Promise<MaliciousHashEntry[]> => {
    try {
        const text = await fetchWithCors(API_URL);
        const lines = text.split('\n');
        const entries: MaliciousHashEntry[] = [];
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            // Basic validation for MD5 (32 hex chars)
            if (/^[a-fA-F0-9]{32}$/.test(trimmed)) {
                entries.push({ hash: trimmed });
            }
        }
        // Limit to recent/top 2000 to prevent memory bloat in client-side processing
        return entries.slice(0, 2000);
    } catch (e) {
        console.warn("Malicious Hash fetch failed:", e);
        return [];
    }
};
