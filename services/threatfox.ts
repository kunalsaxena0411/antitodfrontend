
import { ThreatFoxEntry } from '../types';
import { fetchJsonWithCors } from './http';

const API_URL = 'https://threatfox.abuse.ch/export/json/recent/';

export const fetchThreatFox = async (): Promise<ThreatFoxEntry[]> => {
    const urlWithCache = `${API_URL}?t=${Date.now()}`;

    try {
        const json = await fetchJsonWithCors<any>(urlWithCache);
        const entries: ThreatFoxEntry[] = [];
        
        // The API returns an object dictionary { "id": [ ...IOCs ] }
        if (typeof json === 'object' && json !== null) {
            Object.entries(json).forEach(([id, items]) => {
                if (Array.isArray(items)) {
                    items.forEach((item: any) => {
                        entries.push({
                            id: id,
                            ioc_value: item.ioc_value,
                            ioc_type: item.ioc_type,
                            threat_type: item.threat_type,
                            malware: item.malware,
                            malware_printable: item.malware_printable,
                            first_seen_utc: item.first_seen_utc,
                            last_seen_utc: item.last_seen_utc,
                            confidence_level: parseInt(item.confidence_level) || 0,
                            reference: item.reference,
                            tags: item.tags,
                            reporter: item.reporter
                        });
                    });
                }
            });
        }
        
        return entries;
    } catch (e) {
        console.error("Failed to fetch ThreatFox data:", e);
        return [];
    }
};

