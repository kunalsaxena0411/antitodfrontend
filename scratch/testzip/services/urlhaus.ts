
import { UrlHausEntry } from '../types';
import { fetchJsonWithCors } from './http';

const URLHAUS_API_ONLINE = 'https://urlhaus.abuse.ch/downloads/json_online/';
const URLHAUS_API_RECENT = 'https://urlhaus.abuse.ch/downloads/json_recent/';

export const fetchUrlHaus = async (): Promise<UrlHausEntry[]> => {
    const targets = [URLHAUS_API_ONLINE, URLHAUS_API_RECENT];

    for (const apiTarget of targets) {
        try {
            const json = await fetchJsonWithCors<any>(apiTarget);
            const entries: UrlHausEntry[] = [];

            // Format: { "query_status": "ok", "urls": [ ... ] }
            if (json.urls && Array.isArray(json.urls)) {
                json.urls.forEach((record: any) => {
                    entries.push({
                        id: record.id,
                        dateadded: record.dateadded,
                        url: record.url,
                        url_status: record.url_status,
                        last_online: record.last_online,
                        threat: record.threat,
                        tags: record.tags,
                        urlhaus_link: record.urlhaus_link,
                        reporter: record.reporter
                    });
                });
            } 
            // Fallback Format: Dictionary
            else if (typeof json === 'object') {
                Object.keys(json).forEach(id => {
                    const records = json[id];
                    if (Array.isArray(records)) {
                        records.forEach((record: any) => {
                            entries.push({
                                id: id,
                                dateadded: record.dateadded,
                                url: record.url,
                                url_status: record.url_status,
                                last_online: record.last_online,
                                threat: record.threat,
                                tags: record.tags,
                                urlhaus_link: record.urlhaus_link,
                                reporter: record.reporter
                            });
                        });
                    }
                });
            }

            if (entries.length > 0) {
                console.log(`[URLHaus] Fetched ${entries.length} entries.`);
                return entries;
            }
        } catch (e) {
            // Try next target
        }
    }
    
    console.error("Failed to fetch URLhaus data.");
    return [];
};

