
import { CveFeedItem } from '../types';

const CACHE_KEY = 'xyberah_cve_feed_cache';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// List of CORS proxies to try in order
// Direct -> Vercel -> Public
const PROXIES = [
    (url: string) => url, // Direct
    (url: string) => `/api/proxy?url=${encodeURIComponent(url)}`, // Vercel
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
];

const FEEDS = [
    {
        url: 'https://cvefeed.io/rssfeed/latest.xml',
        source: 'CVEFeed',
        category: 'Latest'
    },
    {
        url: 'https://cvefeed.io/rssfeed/newsroom.xml',
        source: 'CVEFeed',
        category: 'News'
    },
    {
        url: 'https://cvefeed.io/rssfeed/severity/high.xml',
        source: 'CVEFeed',
        category: 'High Sev'
    },
    {
        url: 'https://www.zerodayinitiative.com/rss/upcoming/',
        source: 'ZDI',
        category: 'Upcoming'
    },
    {
        url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml',
        source: 'CISA',
        category: 'Advisory'
    }
];

const extractCveIds = (text: string): string[] => {
    const regex = /\bCVE-\d{4}-\d{4,7}\b/g;
    const matches = text.match(regex);
    return matches ? Array.from(new Set(matches)) : [];
};

const fetchWithProxy = async (targetUrl: string): Promise<string | null> => {
    // Add cache buster to avoid stale proxy responses
    const urlWithCacheBust = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;

    for (const proxyGen of PROXIES) {
        try {
            const proxyUrl = proxyGen(urlWithCacheBust);
            const response = await fetch(proxyUrl);
            
            // Check for Vercel marker if using local proxy path
            if (proxyUrl.startsWith('/api/proxy') && !response.headers.get('X-Source-Proxy') && !response.ok) {
                continue;
            }

            if (response.ok) {
                const text = await response.text();
                const trimmed = text.trim();
                // Improved XML validation
                if (trimmed && (trimmed.startsWith('<') || trimmed.includes('<rss') || trimmed.includes('<feed') || trimmed.includes('xml version'))) {
                    return text;
                }
            }
        } catch (e) {
            // Ignore
        }
    }
    return null;
};

export const fetchCveFeeds = async (): Promise<CveFeedItem[]> => {
    // 1. Check Cache
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const parsed = JSON.parse(cached);
            const age = Date.now() - parsed.timestamp;
            if (age < CACHE_TTL && Array.isArray(parsed.data) && parsed.data.length > 0) {
                console.log(`[CVE] Loaded ${parsed.data.length} items from cache (${Math.round(age / 60000)}m old)`);
                return parsed.data;
            }
        }
    } catch (e) {
        console.warn("Failed to read CVE cache", e);
    }

    const allItems: CveFeedItem[] = [];

    const promises = FEEDS.map(async (feed) => {
        try {
            const text = await fetchWithProxy(feed.url);
            
            if (!text) {
                console.warn(`All proxies failed for feed: ${feed.url}`);
                return;
            }

            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "text/xml");
            
            let items = xmlDoc.querySelectorAll("item");
            // If no RSS items, check for Atom entries
            if (items.length === 0) {
                items = xmlDoc.querySelectorAll("entry");
            }

            Array.from(items).forEach(item => {
                const title = item.querySelector("title")?.textContent || "Untitled";
                const description = item.querySelector("description")?.textContent || item.querySelector("summary")?.textContent || "";
                
                let link = item.querySelector("link")?.textContent;
                if (!link) link = item.querySelector("link")?.getAttribute("href") || "";

                const pubDate = item.querySelector("pubDate")?.textContent || item.querySelector("updated")?.textContent || item.querySelector("published")?.textContent || new Date().toISOString();

                // Combine title and desc for CVE search
                const combinedText = `${title} ${description}`;
                const cveIds = extractCveIds(combinedText);

                allItems.push({
                    title,
                    link,
                    description: description.replace(/<[^>]*>/g, '').substring(0, 200) + (description.length > 200 ? '...' : ''),
                    pubDate,
                    source: feed.source as any,
                    category: feed.category as any,
                    cveIds
                });
            });

        } catch (err) {
            console.warn(`Failed to parse feed: ${feed.url}`, err);
        }
    });

    await Promise.all(promises);

    // Sort by date descending
    const results = allItems.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    // 2. Save Cache (if data exists)
    if (results.length > 0) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                timestamp: Date.now(),
                data: results
            }));
        } catch (e) {
            console.warn("Failed to save CVE cache (likely quota exceeded)", e);
        }
    }

    return results;
};
