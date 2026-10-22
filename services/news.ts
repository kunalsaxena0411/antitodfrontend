

import DOMPurify from 'dompurify';
import { ThreatNewsItem, NewsCategory } from '../types';
import { toProxyUrl, getProxyHeaders } from './proxy';

const CACHE_KEY = 'xyberah_news_cache_v3';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

const FEEDS = [
    { name: 'The Hacker News', url: 'https://feeds.feedburner.com/TheHackersNews' },
    { name: 'BleepingComputer', url: 'https://www.bleepingcomputer.com/feed/' },
    { name: 'Dark Reading', url: 'https://www.darkreading.com/rss.xml' },
    { name: 'Krebs on Security', url: 'https://krebsonsecurity.com/feed/' },
    { name: 'CISA Alerts', url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml' },
    { name: 'Unit 42 (Palo Alto)', url: 'https://unit42.paloaltonetworks.com/feed/' },
    { name: 'WeLiveSecurity (ESET)', url: 'https://www.welivesecurity.com/feed/' },
    { name: 'Microsoft Security', url: 'https://www.microsoft.com/security/blog/feed/' },
    { name: 'Securelist (Kaspersky)', url: 'https://securelist.com/feed/' },
    { name: 'Recorded Future', url: 'https://www.recordedfuture.com/feed' }
];

const determineCategory = (title: string, desc: string): NewsCategory => {
    const text = `${title} ${desc}`.toLowerCase();
    
    // High Priority
    if (/ransomware|lockbit|clop|extortion|encrypted|leak site/.test(text)) return 'Ransomware';
    if (/apt\d+|lazarus|fancy bear|cozy bear|sandworm|nation-state|espionage|campaign/.test(text)) return 'APT';
    if (/phish|credential harvest|social engineer|smishing|vishing/.test(text)) return 'Phishing';
    
    // Tech Specific
    if (/cve-\d|vulnerab|zero-day|0-day|patch|exploit|rce|bypass/.test(text)) return 'Vulnerability';
    if (/breach|leak|stolen data|database|exfiltrat|unauthorized access/.test(text)) return 'Breach';
    if (/malware|trojan|botnet|backdoor|spyware|rootkit|wiper|loader|stealer/.test(text)) return 'Malware';
    
    // General
    if (/arrest|sentence|cybercrime|fraud|money launder|scam|indictment/.test(text)) return 'Cybercrime';
    
    return 'General';
};

// Task 102: Safe sanitizer using DOMPurify and text-only parsing (never innerHTML) to strip HTML/scripts and return plain text
export const sanitizeText = (html: string): string => {
    if (!html) return "";
    try {
        let purifyInstance: any = null;
        if (typeof (DOMPurify as any)?.sanitize === 'function') {
            purifyInstance = DOMPurify;
        } else if (typeof DOMPurify === 'function') {
            const win = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? (globalThis as any).window : null);
            if (win && (win.document || win.DOMParser)) {
                try {
                    purifyInstance = (DOMPurify as any)(win);
                } catch {}
            }
        }

        if (purifyInstance && typeof purifyInstance.sanitize === 'function') {
            const cleanHtml = purifyInstance.sanitize(html, {
                ALLOWED_TAGS: [], // strip all tags, return text only
                ALLOWED_ATTR: []
            });
            const text = typeof cleanHtml === 'string' ? cleanHtml : (cleanHtml as any)?.textContent || "";
            const clean = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
            if (clean) {
                return clean.substring(0, 250) + (clean.length > 250 ? '...' : '');
            }
        }
    } catch {}

    // Fallback: DOMParser text-only parse
    try {
        if (typeof DOMParser !== 'undefined') {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const dangerousElements = doc.querySelectorAll('script, style, iframe, object, embed, link, meta');
            dangerousElements.forEach(el => el.remove());
            const text = doc.body?.textContent || "";
            const clean = text.replace(/\s+/g, ' ').trim();
            if (clean) {
                return clean.substring(0, 250) + (clean.length > 250 ? '...' : '');
            }
        }
    } catch {}

    // Universal fallback: text-only regex stripping
    const stripped = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return stripped.substring(0, 250) + (stripped.length > 250 ? '...' : '');
};

// Backend Proxy XML/RSS Fetch (Task 101)
const fetchProxyRss = async (url: string, sourceName: string): Promise<ThreatNewsItem[] | null> => {
    try {
        const proxyEndpoint = toProxyUrl(url);
        const res = await fetch(proxyEndpoint, { headers: getProxyHeaders() });
        if (!res.ok) return null;
        const xmlText = await res.text();
        if (!xmlText || !xmlText.trim().startsWith('<')) return null;
        return parseXmlFeed(xmlText, sourceName);
    } catch (e) {
        return null;
    }
};

const parseXmlFeed = (xmlText: string, sourceName: string): ThreatNewsItem[] => {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const items: ThreatNewsItem[] = [];
        const entries = xmlDoc.querySelectorAll("item, entry");
        
        entries.forEach(item => {
            const title = item.querySelector("title")?.textContent || "Unknown Title";
            let description = item.querySelector("description")?.textContent || item.querySelector("summary")?.textContent || "";
            const cleanDesc = sanitizeText(description);

            let link = item.querySelector("link")?.textContent;
            if (!link || !link.startsWith('http')) {
                link = item.querySelector("link")?.getAttribute("href") || "#";
            }

            let pubDateStr = item.querySelector("pubDate")?.textContent || item.querySelector("published")?.textContent || item.querySelector("updated")?.textContent || new Date().toISOString();
            
            const timestamp = new Date(pubDateStr).getTime();
            
            const pubIso = Number.isNaN(timestamp)
                ? new Date().toISOString()
                : new Date(timestamp).toISOString();
            
            items.push({
                title,
                link,
                source: sourceName,
                date: pubIso,
                published: pubIso,
                timestamp: Number.isNaN(timestamp) ? Date.now() : timestamp,
                description: cleanDesc,
                category: determineCategory(title, cleanDesc)
            });
        });
        return items;
    } catch (e) { return []; }
};

export const fetchThreatNews = async (): Promise<ThreatNewsItem[]> => {
    // 1. Check Cache
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const parsed = JSON.parse(cached);
            const age = Date.now() - parsed.timestamp;
            if (age < CACHE_TTL && Array.isArray(parsed.data) && parsed.data.length > 0) {
                console.log(`[NEWS] Loaded ${parsed.data.length} items from cache (${Math.round(age / 60000)}m old)`);
                return parsed.data;
            }
        }
    } catch (e) {
        console.warn("Failed to read News cache", e);
    }

    const allItems: ThreatNewsItem[] = [];

    const promises = FEEDS.map(async (feed) => {
        // Stagger requests to be polite to the APIs
        await new Promise(r => setTimeout(r, Math.random() * 2000));

        // Backend allowlisted proxy only (no third-party RSS converters from the browser)
        const items = await fetchProxyRss(feed.url, feed.name);

        if (items) {
            // Enforce consistent source name
            items.forEach(i => i.source = feed.name);
            // Limit items per feed to keep performance high
            allItems.push(...items.slice(0, 8)); 
        }
    });

    await Promise.all(promises);
    
    // Deduplicate based on Link
    const uniqueItems = new Map<string, ThreatNewsItem>();
    allItems.forEach(item => {
        if (!uniqueItems.has(item.link)) {
            uniqueItems.set(item.link, item);
        }
    });

    const results = Array.from(uniqueItems.values()).sort((a, b) => b.timestamp - a.timestamp);

    // 2. Save Cache (if data exists)
    if (results.length > 0) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                timestamp: Date.now(),
                data: results
            }));
        } catch (e) {
             console.warn("Failed to save News cache", e);
        }
    }

    return results;
};
