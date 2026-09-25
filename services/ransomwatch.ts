
import { RansomWatchPost, RansomWatchGroup } from '../types';
import { RANSOMWARE_LIVE_API_KEY } from '../config/config';
import { fetchJsonWithCors } from './http';

const POSTS_URL = 'https://raw.githubusercontent.com/ransomwatch/ransomwatch/main/posts.json';
const GROUPS_URL = 'https://raw.githubusercontent.com/ransomwatch/ransomwatch/main/groups.json';

const API_TARGET = 'https://api-pro.ransomware.live/victims/recent?order=discovered';

// For Ransomware.live, we need to pass headers. 
// Public proxies (CORSProxy, ThingProxy) often strip custom headers like X-API-KEY.
// We only use Direct (if CORS allows) and Vercel Proxy (which forwards headers).
// `/api/proxy` exists on some deployed setups; Vite dev has no such route (would 404).
const SECURE_PROXIES =
  import.meta.env.DEV
    ? [(url: string) => url]
    : [
        (url: string) => url,
        (url: string) => `/api/proxy?url=${encodeURIComponent(url)}`,
      ];

const mapLiveVictims = (json: any): RansomWatchPost[] => {
    const items = json.victims || (Array.isArray(json) ? json : []);
    
    return items.map((v: any) => ({
        post_title: v.victim || v.post_title,
        group_name: v.group || v.group_name,
        discovered: v.discovered,
        description: v.description,
        website: v.website,
        country: v.country,
        activity: v.activity,
        screenshot: v.screenshot,
        source: 'Ransomware.live'
    }));
};

const fetchRansomwareLive = async (): Promise<RansomWatchPost[]> => {
    if (!RANSOMWARE_LIVE_API_KEY) return [];
    // Attempt Proxy Rotation including Direct
    for (const proxyGen of SECURE_PROXIES) {
        try {
            const proxyUrl = proxyGen(API_TARGET);
            
            const res = await fetch(proxyUrl, {
                headers: {
                    'accept': 'application/json',
                    'X-API-KEY': RANSOMWARE_LIVE_API_KEY
                }
            });

            if (res.ok) {
                // Verify content type to avoid parsing HTML error pages from proxies
                const contentType = res.headers.get('content-type');
                const text = await res.text();

                if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
                    try {
                        const json = JSON.parse(text);
                        return mapLiveVictims(json);
                    } catch (e) {
                        // Invalid JSON
                    }
                }
            }
        } catch (e) {
            // Try next proxy
        }
    }

    console.warn("All Ransomware.live fetch attempts failed.");
    return [];
};

export const fetchRansomwarePosts = async (): Promise<RansomWatchPost[]> => {
    try {
        const [rwData, liveData] = await Promise.all([
            fetchJsonWithCors<RansomWatchPost[]>(POSTS_URL).catch((e) => {
                console.warn("RansomWatch posts fetch failed, falling back to live data only");
                return [] as RansomWatchPost[];
            }),
            fetchRansomwareLive().catch(() => [] as RansomWatchPost[])
        ]);

        const normalizedRw = Array.isArray(rwData) ? rwData.map(p => ({ ...p, source: 'RansomWatch' })) : [];
        
        // Combine and dedup based on title + group
        const unique = new Map<string, RansomWatchPost>();
        
        // Process Live Data First (High Fidelity)
        liveData.forEach(post => {
            const key = `${post.group_name}-${post.post_title}`.toLowerCase();
            unique.set(key, post);
        });

        // Merge in RansomWatch (Standard Feed)
        normalizedRw.forEach(post => {
            const key = `${post.group_name}-${post.post_title}`.toLowerCase();
            if (!unique.has(key)) {
                unique.set(key, post);
            } else {
                // Keep the 'Ransomware.live' one if it has extra data (screenshot/country), otherwise simple merge
                const existing = unique.get(key)!;
                if (!existing.screenshot && !existing.country) {
                     unique.set(key, { ...post, ...existing }); 
                }
            }
        });

        // Sort by date descending
        return Array.from(unique.values()).sort((a, b) => new Date(b.discovered).getTime() - new Date(a.discovered).getTime());
    } catch (e) {
        console.error("Failed to fetch Ransomware posts", e);
        return [];
    }
};

export const fetchRansomwareGroups = async (): Promise<RansomWatchGroup[]> => {
    try {
        const data = await fetchJsonWithCors<RansomWatchGroup[]>(GROUPS_URL);
        if (Array.isArray(data)) {
            return data;
        }
        return [];
    } catch (e) {
        console.warn("Failed to fetch RansomWatch groups:", e);
        return [];
    }
};
