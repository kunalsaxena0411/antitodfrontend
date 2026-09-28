
import { C2IntelFeedEntry } from '../types';
import { fetchWithCors } from './http';

const CS_URL = 'https://raw.githubusercontent.com/drb-ra/C2IntelFeeds/refs/heads/master/C2_configs/cobaltstrike-30day.json';
const POSH_URL = 'https://raw.githubusercontent.com/drb-ra/C2IntelFeeds/refs/heads/master/C2_configs/poshc2.json';
const HAVOC_URL = 'https://raw.githubusercontent.com/drb-ra/C2IntelFeeds/refs/heads/master/C2_configs/havoc.json';

export const fetchC2IntelFeed = async (): Promise<C2IntelFeedEntry[]> => {
    try {
        const [csText, poshText, havocText] = await Promise.all([
            fetchWithCors(CS_URL).catch(() => ''),
            fetchWithCors(POSH_URL).catch(() => ''),
            fetchWithCors(HAVOC_URL).catch(() => '')
        ]);

        const entries: C2IntelFeedEntry[] = [];

        // Parse Cobalt Strike Data
        if (csText) {
            const lines = csText.split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                try {
                    const json = JSON.parse(trimmed);
                    if (json.result) {
                        entries.push({
                            ...json.result,
                            Source: 'CobaltStrike'
                        });
                    }
                } catch (e) { continue; }
            }
        }

        // Parse PoshC2 Data
        if (poshText) {
            const lines = poshText.split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                try {
                    const json = JSON.parse(trimmed);
                    if (json.result) {
                        entries.push({
                            ...json.result,
                            Source: 'PoshC2'
                        });
                    }
                } catch (e) { continue; }
            }
        }

        // Parse Havoc Data
        if (havocText) {
            const lines = havocText.split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                try {
                    const json = JSON.parse(trimmed);
                    if (json.result) {
                        entries.push({
                            ...json.result,
                            Source: 'Havoc'
                        });
                    }
                } catch (e) { continue; }
            }
        }

        return entries;
    } catch (e) {
        console.error("Failed to fetch C2IntelFeeds", e);
        return [];
    }
};

