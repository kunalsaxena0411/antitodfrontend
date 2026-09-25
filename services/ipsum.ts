import { IpsumEntry } from '../types';
import { fetchWithCors } from './http';

const IPSUM_URL = 'https://raw.githubusercontent.com/stamparm/ipsum/refs/heads/master/ipsum.txt';

export const fetchIpsum = async (): Promise<IpsumEntry[]> => {
    try {
        const text = await fetchWithCors(IPSUM_URL);
        const lines = text.split('\n');
        const entries: IpsumEntry[] = [];
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            
            // Split by tab or multiple spaces
            const parts = trimmed.split(/\s+/);
            
            if (parts.length >= 2) {
                // Ensure valid IP
                if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(parts[0])) {
                    entries.push({
                        ip: parts[0],
                        blacklistCount: parseInt(parts[1], 10)
                    });
                }
            }
        }
        return entries;
    } catch (e) {
        console.warn("IPsum fetch failed:", e);
        return [];
    }
};
