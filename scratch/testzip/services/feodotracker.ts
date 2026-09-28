
import { FeodoTrackerEntry } from '../types';
import { fetchJsonWithCors } from './http';

const API_URL = 'https://feodotracker.abuse.ch/downloads/ipblocklist.json';

export const fetchFeodoTracker = async (): Promise<FeodoTrackerEntry[]> => {
    const urlWithCache = `${API_URL}?t=${Date.now()}`;

    try {
        const data = await fetchJsonWithCors<FeodoTrackerEntry[]>(urlWithCache);
        if (Array.isArray(data)) {
            return data;
        }
        console.warn("[Feodo] Received data is not an array");
        return [];
    } catch (e) {
        console.error("Failed to fetch Feodo Tracker data:", e);
        return [];
    }
};

