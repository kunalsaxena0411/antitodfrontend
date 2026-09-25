import { BlocklistDeEntry } from '../types';
import { fetchWithCors } from './http';

const URL = 'https://www.blocklist.de/downloads/dnsbl/all.list';

export const fetchBlocklistDe = async (): Promise<BlocklistDeEntry[]> => {
    try {
        const text = await fetchWithCors(URL);
        const lines = text.split('\n');
        const entries: BlocklistDeEntry[] = [];
        const now = new Date().toISOString();

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(':')) continue;

            // Extract IP (start of line)
            const ipMatch = trimmed.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
            if (!ipMatch) continue;
            const ip = ipMatch[1];

            const serviceMatch = trimmed.match(/Service:\s*([a-zA-Z0-9_-]+)/);
            const lastAttackMatch = trimmed.match(/Last-Attack:\s*(\d+)/);

            // Updated: Default to 'Infected System' instead of 'Unknown'
            const service = serviceMatch ? serviceMatch[1] : 'Infected System';
            let lastAttack = now;

            if (lastAttackMatch) {
                const ts = parseInt(lastAttackMatch[1], 10);
                if (!isNaN(ts)) {
                    lastAttack = new Date(ts * 1000).toISOString();
                }
            }

            entries.push({
                ip,
                service,
                lastAttack,
                updated: now
            });
        }
        return entries;
    } catch (e) {
        console.error("Failed to fetch Blocklist.de", e);
        return [];
    }
};
