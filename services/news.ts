

import { ThreatNewsItem, NewsCategory } from '../types';

const CACHE_KEY = 'xyberah_news_cache';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

const FEEDS = [
    { name: 'The Hacker News', url: 'https://feeds.feedburner.com/TheHackersNews' },
    { name: 'BleepingComputer', url: 'https://www.bleepingcomputer.com/feed/' },
    { name: 'Dark Reading', url: 'https://www.darkreading.com/rss.xml' },
    { name: 'Krebs on Security', url: 'https://krebsonsecurity.com/feed/' },
    { name: 'SecurityWeek', url: 'https://feeds.feedburner.com/securityweek' },
    { name: 'CISA Alerts', url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml' },
    { name: 'Unit 42 (Palo Alto)', url: 'https://unit42.paloaltonetworks.com/feed/' },
    { name: 'Google Project Zero', url: 'https://googleprojectzero.blogspot.com/feeds/posts/default' },
    { name: 'Trend Micro', url: 'https://blog.trendmicro.com/category/research/feed/' },
    { name: 'WeLiveSecurity (ESET)', url: 'https://www.welivesecurity.com/feed/' },
    { name: 'Microsoft Security', url: 'https://www.microsoft.com/security/blog/feed/' },
    { name: 'Mandiant', url: 'https://www.mandiant.com/resources/blog/rss.xml' },
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

// Sanitizer to remove HTML tags but keep text content safe
const sanitizeText = (html: string): string => {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    // Remove all script tags first
    const scripts = tempDiv.getElementsByTagName('script');
    for (let i = scripts.length - 1; i >= 0; i--) {
        scripts[i].parentNode?.removeChild(scripts[i]);
    }
    const text = tempDiv.textContent || tempDiv.innerText || "";
    return text.substring(0, 250) + (text.length > 250 ? '...' : '');
};

// Strategy 1: RSS2JSON (Reliable JSON, avoids CORS/MIME issues)
const fetchRss2Json = async (url: string): Promise<ThreatNewsItem[] | null> => {
    try {
        // Using rss2json API which converts RSS to JSON server-side
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`; 
        const res = await fetch(apiUrl);
        if (!res.ok) return null;
        const data = await res.json();
        
        if (data.status !== 'ok' || !Array.isArray(data.items)) return null;

        return data.items.map((item: any) => {
             const title = item.title || "Unknown Title";
             const description = item.description || item.content || "";
             const cleanDesc = sanitizeText(description);

             return {
                 title,
                 link: item.link,
                 source: data.feed?.title || "Unknown Source",
                 date: new Date(item.pubDate).toLocaleDateString(),
                 timestamp: new Date(item.pubDate).getTime(),
                 description: cleanDesc,
                 category: determineCategory(title, cleanDesc)
             };
        });
    } catch (e) {
        return null;
    }
};

// Strategy 2: AllOrigins JSON Wrapper (Fallback)
const fetchAllOrigins = async (url: string, sourceName: string): Promise<ThreatNewsItem[] | null> => {
    try {
        const apiUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const res = await fetch(apiUrl);
        if (!res.ok) return null;
        const data = await res.json();
        if (!data.contents) return null;
        return parseXmlFeed(data.contents, sourceName);
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
            const date = new Date(pubDateStr).toLocaleDateString();
            
            items.push({
                title,
                link,
                source: sourceName,
                date,
                timestamp: isNaN(timestamp) ? Date.now() : timestamp,
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

        // Try Strategy 1 first
        let items = await fetchRss2Json(feed.url);
        
        // Fallback to Strategy 2
        if (!items) {
            items = await fetchAllOrigins(feed.url, feed.name);
        }

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
