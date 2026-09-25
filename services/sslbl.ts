
import { SslBlEntry, Ja3FingerprintEntry } from '../types';
import { fetchWithCors } from './http';

const SSL_SHA1_URL = 'https://sslbl.abuse.ch/blacklist/sslblacklist.csv';
const SSL_JA3_URL = 'https://sslbl.abuse.ch/blacklist/ja3_fingerprints.csv';

const fetchAndParse = async <T>(url: string, parser: (text: string) => T[]): Promise<T[]> => {
    try {
        const text = await fetchWithCors(url);
        if (text && !text.trim().startsWith('<!DOCTYPE')) {
            return parser(text);
        }
    } catch (e) {
        console.warn(`Failed to fetch ${url}`, e);
    }
    return [];
};

export const fetchSslBl = async (): Promise<SslBlEntry[]> => {
    return fetchAndParse(SSL_SHA1_URL, (text) => {
        const lines = text.split('\n');
        const entries: SslBlEntry[] = [];
        for (const line of lines) {
            if (!line || line.startsWith('#')) continue;
            const parts = line.split(',');
            if (parts.length >= 3) {
                entries.push({
                    listingdate: parts[0],
                    sha1: parts[1],
                    listingreason: parts[2]
                });
            }
        }
        return entries;
    });
};

export const fetchJa3Bl = async (): Promise<Ja3FingerprintEntry[]> => {
    return fetchAndParse(SSL_JA3_URL, (text) => {
        const lines = text.split('\n');
        const entries: Ja3FingerprintEntry[] = [];
        for (const line of lines) {
            if (!line || line.startsWith('#')) continue;
            const parts = line.split(',');
            if (parts.length >= 4) {
                entries.push({
                    ja3_md5: parts[0],
                    first_seen: parts[1],
                    last_seen: parts[2],
                    listingreason: parts[3]
                });
            }
        }
        return entries;
    });
};
