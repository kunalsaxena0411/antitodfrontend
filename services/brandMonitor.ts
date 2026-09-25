
import { CertStreamEvent, SuspiciousCert, TyposquatResult } from '../types';
import { queryDoH, enrichIP } from './dns';
import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';

// --- TensorFlow MobileNet Loader ---
let model: mobilenet.MobileNet | null = null;

export const loadModel = async () => {
  if (!model) {
    try {
        console.log("Loading MobileNet...");
        model = await mobilenet.load();
        console.log("MobileNet loaded.");
    } catch (e) {
        console.warn("Failed to load MobileNet", e);
    }
  }
  return model;
}

// --- Helper: Convert Image URL/Base64 to Tensor Element ---
const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
        img.src = src;
    });
};

// --- Helper: Cosine Similarity ---
const cosineSimilarity = (a: number[], b: number[]): number => {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

export const analyzeVisualSimilarity = async (officialLogoSrc: string, targetScreenshotUrl: string): Promise<number> => {
    if (!officialLogoSrc || !targetScreenshotUrl) return 0;
    
    try {
        const model = await loadModel();
        if (!model) return 0;

        // Use a proxy for the target screenshot to avoid CORS if needed
        // Assuming image.thum.io supports CORS or we use a proxy
        const proxyUrl = (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`;
        
        const [img1, img2] = await Promise.all([
            loadImage(officialLogoSrc),
            loadImage(targetScreenshotUrl.startsWith('data:') ? targetScreenshotUrl : proxyUrl(targetScreenshotUrl))
        ]);

        const embedding1 = await model.infer(img1, true);
        const embedding2 = await model.infer(img2, true);

        const data1 = await embedding1.data();
        const data2 = await embedding2.data();

        const sim = cosineSimilarity(Array.from(data1), Array.from(data2));
        
        embedding1.dispose();
        embedding2.dispose();

        return Math.max(0, Math.min(100, Math.round(sim * 100)));
    } catch (e) {
        console.warn("Visual Analysis Failed", e);
        return 0;
    }
};

// --- Fuzzy Logic Helper (Levenshtein Distance) ---
const levenshtein = (a: string, b: string): number => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(
                        matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1 // deletion
                    )
                );
            }
        }
    }

    return matrix[b.length][a.length];
};

// --- Soundex Implementation (Phonetic Matching) ---
const getSoundex = (str: string): string => {
    const a = str.toLowerCase().split('');
    const first = a.shift()?.toUpperCase();
    if (!first) return '';

    const codes: Record<string, number> = {
        a: 0, e: 0, i: 0, o: 0, u: 0, y: 0, h: 0, w: 0,
        b: 1, f: 1, p: 1, v: 1,
        c: 2, g: 2, j: 2, k: 2, q: 2, s: 2, x: 2, z: 2,
        d: 3, t: 3,
        l: 4,
        m: 5, n: 5,
        r: 6
    };

    const encoded = a
        .map(char => codes[char])
        .filter((code, index, arr) => 
            code !== undefined && code !== 0 && (index === 0 || code !== arr[index - 1])
        )
        .join('');

    return (first + encoded + '000').slice(0, 4);
};

// --- Homoglyph Normalization ---
const HOMOGLYPHS: Record<string, string> = {
    '0': 'o', '1': 'l', '2': 'z', '3': 'e', '4': 'a', '5': 's', '6': 'b', '7': 't', '8': 'b', '9': 'g',
    '@': 'a', '$': 's', '!': 'i', '|': 'l', '(': 'c', '[': 'c', '{': 'c',
    'α': 'a', 'а': 'a', 'ｂ': 'b', 'ϲ': 'c', 'ԁ': 'd', 'е': 'e', 'ｆ': 'f', 'ɡ': 'g', 'ｈ': 'h',
    'і': 'i', 'ｊ': 'j', 'ｋ': 'k', 'ｌ': 'l', 'ｍ': 'm', 'ｎ': 'n', 'о': 'o', 'ｐ': 'p', 'ｑ': 'q',
    'ｒ': 'r', 'ｓ': 's', 'ｔ': 't', 'ｕ': 'u', 'ｖ': 'v', 'ｗ': 'w', 'ｘ': 'x', 'ｙ': 'y', 'ｚ': 'z'
};

export const normalizeDomain = (domain: string): string => {
    return domain.toLowerCase().split('').map(char => HOMOGLYPHS[char] || char).join('');
};

export const scoreSimilarity = (domain: string, officialDomains: string[]): number => {
    let maxScore = 0;
    const normalizedTarget = normalizeDomain(domain);
    const rawTarget = domain.toLowerCase();
    const targetSoundex = getSoundex(rawTarget.split('.')[0]);

    for (const official of officialDomains) {
        const normalizedOfficial = normalizeDomain(official);
        const rawOfficial = official.toLowerCase();
        const officialSoundex = getSoundex(rawOfficial.split('.')[0]);

        // 1. Normalized Levenshtein
        const distNorm = levenshtein(normalizedTarget, normalizedOfficial);
        const lenNorm = Math.max(normalizedTarget.length, normalizedOfficial.length);
        const simNorm = (1 - distNorm / lenNorm) * 100;

        // 2. Raw Levenshtein
        const distRaw = levenshtein(rawTarget, rawOfficial);
        const lenRaw = Math.max(rawTarget.length, rawOfficial.length);
        const simRaw = (1 - distRaw / lenRaw) * 100;

        let currentScore = Math.max(simNorm, simRaw);
        
        // 3. Phonetic Boost
        if (targetSoundex === officialSoundex && currentScore < 90) {
            currentScore += 15; // Boost for matching soundex
        }

        if (currentScore > maxScore) maxScore = currentScore;
    }
    return Math.round(Math.min(100, maxScore));
};

// --- CertStream Logic ---
export class CertStreamObserver {
    private socket: WebSocket | null = null;
    private keywords: string[] = [];
    private onMatch: (cert: SuspiciousCert) => void;
    private isConnected: boolean = false;
    private fuzzyThreshold: number = 80; // Default

    constructor(keywords: string[], callback: (cert: SuspiciousCert) => void) {
        this.keywords = keywords.map(k => k.toLowerCase());
        this.onMatch = callback;
    }

    public connect() {
        if (this.isConnected) return;
        
        try {
            this.socket = new WebSocket('wss://certstream.calidog.io/');
            
            this.socket.onopen = () => {
                this.isConnected = true;
                console.log('[BrandIntel] Connected to CertStream');
            };

            this.socket.onmessage = (message) => {
                try {
                    const event: CertStreamEvent = JSON.parse(message.data);
                    if (event.message_type === "certificate_update") {
                        this.analyzeCert(event);
                    }
                } catch (e) {
                    // Ignore parse errors
                }
            };

            this.socket.onclose = () => {
                this.isConnected = false;
            };
        } catch (e) {
            console.error("Failed to connect to CertStream", e);
        }
    }

    public disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
            this.isConnected = false;
        }
    }

    public updateKeywords(newKeywords: string[]) {
        this.keywords = newKeywords.map(k => k.toLowerCase());
    }

    public setFuzzyThreshold(threshold: number) {
        this.fuzzyThreshold = threshold;
    }

    private analyzeCert(event: CertStreamEvent) {
        const domains = event.data.leaf_cert.all_domains;
        
        domains.forEach(domain => {
            const lowerDomain = domain.toLowerCase();
            const normalizedDomain = normalizeDomain(lowerDomain);
            const parts = lowerDomain.split('.');
            const normalizedParts = normalizedDomain.split('.');
            
            // Check against keywords
            for (const keyword of this.keywords) {
                const normalizedKeyword = normalizeDomain(keyword);
                const keywordSoundex = getSoundex(keyword);

                // 1. Exact Match (Substring)
                if (lowerDomain.includes(keyword) || normalizedDomain.includes(normalizedKeyword)) {
                    let score = 50;
                    if (lowerDomain.startsWith('xn--')) score += 20; // Punycode
                    if (lowerDomain.includes('login') || lowerDomain.includes('secure') || lowerDomain.includes('account')) score += 30;

                    this.onMatch({
                        id: crypto.randomUUID(),
                        timestamp: Date.now(),
                        domain: domain,
                        issuer: event.data.leaf_cert.issuer?.O || 'Unknown',
                        score: Math.min(100, score),
                        keywordMatched: keyword,
                        isTypo: false
                    });
                    return;
                }

                // 2. Fuzzy Logic (Typosquatting Detection)
                if (keyword.length < 4) continue;

                let allowedDistance = 1;
                if (this.fuzzyThreshold < 50) allowedDistance = 3;
                else if (this.fuzzyThreshold < 80) allowedDistance = 2;

                // Check raw parts
                for (const part of parts) {
                    if (Math.abs(part.length - keyword.length) > allowedDistance) continue;
                    
                    // Levenshtein check
                    const distance = levenshtein(part, keyword);
                    if (distance > 0 && distance <= allowedDistance) {
                        this.onMatch({
                            id: crypto.randomUUID(),
                            timestamp: Date.now(),
                            domain: domain,
                            issuer: event.data.leaf_cert.issuer?.O || 'Unknown',
                            score: 80, 
                            keywordMatched: `${keyword} (Typo: ${part})`,
                            isTypo: true
                        });
                        return;
                    }
                    
                    // Phonetic check (Soundex) - only if not too short to avoid false positives
                    if (part.length > 4 && getSoundex(part) === keywordSoundex) {
                         this.onMatch({
                            id: crypto.randomUUID(),
                            timestamp: Date.now(),
                            domain: domain,
                            issuer: event.data.leaf_cert.issuer?.O || 'Unknown',
                            score: 75, 
                            keywordMatched: `${keyword} (Phonetic: ${part})`,
                            isTypo: true
                        });
                        return;
                    }
                }

                // Check normalized parts (handles homoglyphs)
                for (const part of normalizedParts) {
                    if (Math.abs(part.length - normalizedKeyword.length) > allowedDistance) continue;
                    const distance = levenshtein(part, normalizedKeyword);
                    if (distance > 0 && distance <= allowedDistance) {
                        this.onMatch({
                            id: crypto.randomUUID(),
                            timestamp: Date.now(),
                            domain: domain,
                            issuer: event.data.leaf_cert.issuer?.O || 'Unknown',
                            score: 90, 
                            keywordMatched: `${keyword} (Homoglyph: ${part})`,
                            isTypo: true
                        });
                        return;
                    }
                }
            }
        });
    }
}

// --- Typosquatting / Permutation Engine ---

const KEYBOARD_NEAR = {
    'a': 'qwsz', 'b': 'vghn', 'c': 'xdfv', 'd': 'serfc', 'e': 'wsdr', 'f': 'drtgv', 'g': 'ftyhb',
    'h': 'gyujn', 'i': 'ujko', 'j': 'huikm', 'k': 'jiolm', 'l': 'kop', 'm': 'njk', 'n': 'bhjm',
    'o': 'iklp', 'p': 'ol', 'q': 'wa', 'r': 'edft', 's': 'awedxz', 't': 'rfgy', 'u': 'yhji',
    'v': 'cfgb', 'w': 'qeas', 'x': 'zsdc', 'y': 'tghu', 'z': 'asx',
    '1': '2q', '2': '13qw', '3': '24we', '4': '35er', '5': '46rt', '6': '57ty', '7': '68yu',
    '8': '79ui', '9': '80io', '0': '9op'
};

const VISUAL_SIMILAR = {
    'a': ['à', 'á', 'à', 'â', 'ã', 'ä', 'å', 'ɑ', 'ạ', 'ǎ', 'ă', 'ȧ', 'ą'],
    'b': ['d', 'lb', 'ib', '6', '8'],
    'c': ['e', 'o', 'a', '(', '¢', 'ç'],
    'd': ['b', 'cl', 'dl', 'di'],
    'e': ['c', 'é', 'è', 'ê', 'ë', 'ē', 'ĕ', 'ė', 'ę', 'ě', 'ǝ', 'ə', '3'],
    'f': ['t', 'ph'],
    'g': ['q', '6', '9'],
    'h': ['ln', 'lh', 'in', 'ih'],
    'i': ['l', '1', '!', 'í', 'ì', 'ï', 'ı', 'ɩ'],
    'j': ['i', 'l', '1'],
    'k': ['lc', 'lk', 'ik', '1k'],
    'l': ['1', 'i', '!', '|'],
    'm': ['n', 'rn', 'nn', 'iii'],
    'n': ['m', 'r', 'u'],
    'o': ['0', 'c', 'e', 'ö', 'ò', 'ó', 'ô', 'õ', 'ō', 'ŏ', 'ő', 'ơ', 'ø'],
    'p': ['q', 'o'],
    'q': ['p', 'g'],
    'r': ['n', 'm'],
    's': ['5', '$', 'z'],
    't': ['f', '7', '+'],
    'u': ['v', 'w', 'ü', 'ù', 'ú', 'û', 'ū', 'ŭ', 'ů', 'ű', 'ų', 'ư'],
    'v': ['u', 'w'],
    'w': ['vv', 'uu', 'u'],
    'x': ['y'],
    'y': ['v', 'x'],
    'z': ['s', '2']
};

// Expanded dictionary for Combo-Squatting (DNStwist parity)
const COMMON_PHISHING_PREFIXES = [
    'login', 'signin', 'secure', 'account', 'verify', 'support', 'update', 
    'alert', 'billing', 'service', 'app', 'web', 'portal', 'online', 
    'my', 'auth', 'check', 'confirm', 'wallet', 'mobile', 'payment', 
    'bill', 'store', 'shop', 'help', 'recovery', 'admin', 'mail', 
    'download', 'free', 'group', 'team', 'dev', 'beta', 'vpn', 'cloud', 
    'ssl', 'api', 'chat', 'status', 'news', 'blog', 'promo', 'gift',
    'alpha', 'test', 'client', 'server', 'smtp', 'pop', 'imap', 'dns',
    'host', 'www', 'home', 'corp', 'biz', 'email', 'ftp', 'ns', 'root',
    'secure-login', 'account-update', 'wallet-connect', 'claim', 'airdrop',
    'mint', 'nft', 'token', 'finance', 'bank', 'pay', 'transfer', 'gateway'
];

const VOWELS: Record<string, string> = {'a': 'e', 'e': 'i', 'i': 'o', 'o': 'u', 'u': 'a'};

export const generateTyposquats = (domain: string): TyposquatResult[] => {
    const results: TyposquatResult[] = [];
    // Normalize domain to lowercase to prevent case-sensitivity false positives in bit-flips
    const lowerDomain = domain.toLowerCase();
    const parts = lowerDomain.split('.');
    const name = parts[0];
    const tld = parts.slice(1).join('.');

    if (!name || !tld) return [];

    const add = (variation: string, type: TyposquatResult['type']) => {
        // Strict check: Variation must be different from original name
        if (variation !== name && variation.length > 0) {
            results.push({
                original: lowerDomain,
                variation: `${variation}.${tld}`,
                type,
                isRegistered: false // Unknown initially
            });
        }
    };

    // 1. Omission (removals)
    for (let i = 0; i < name.length; i++) {
        add(name.slice(0, i) + name.slice(i + 1), 'OMISSION');
    }

    // 2. Repetition
    for (let i = 0; i < name.length; i++) {
        add(name.slice(0, i) + name[i] + name.slice(i), 'REPETITION');
    }

    // 3. Transposition (swaps)
    for (let i = 0; i < name.length - 1; i++) {
        add(name.slice(0, i) + name[i + 1] + name[i] + name.slice(i + 2), 'TRANSPOSITION');
    }

    // 4. Replacement (Keyboard distance)
    for (let i = 0; i < name.length; i++) {
        const char = name[i];
        const near = KEYBOARD_NEAR[char as keyof typeof KEYBOARD_NEAR];
        if (near) {
            for (let j = 0; j < near.length; j++) {
                add(name.slice(0, i) + near[j] + name.slice(i + 1), 'REPLACEMENT');
            }
        }
    }

    // 5. Insertion (Keyboard fat-finger)
    for (let i = 0; i <= name.length; i++) {
        const char = name[i] || name[i-1]; // Use char or previous for end
        const near = KEYBOARD_NEAR[char as keyof typeof KEYBOARD_NEAR];
        if (near) {
            for (let j = 0; j < near.length; j++) {
                add(name.slice(0, i) + near[j] + name.slice(i), 'INSERTION');
            }
        }
    }

    // 6. Homoglyph / Visual (Lookalike)
    for (let i = 0; i < name.length; i++) {
        const char = name[i];
        const similar = VISUAL_SIMILAR[char as keyof typeof VISUAL_SIMILAR];
        if (similar) {
            for (let j = 0; j < similar.length; j++) {
                add(name.slice(0, i) + similar[j] + name.slice(i + 1), 'REPLACEMENT'); // Visual Replacement
            }
        }
    }
    
    // 7. Combo-Squatting (Prefix/Suffix)
    COMMON_PHISHING_PREFIXES.forEach(prefix => {
        add(`${prefix}-${name}`, 'COMBO');
        add(`${name}-${prefix}`, 'COMBO');
        add(`${prefix}${name}`, 'COMBO');
        add(`${name}${prefix}`, 'COMBO');
    });

    // 8. Bitsquatting (Bit flips)
    for (let i = 0; i < name.length; i++) {
        const charCode = name.charCodeAt(i);
        for (let bit = 0; bit < 8; bit++) {
            const mask = 1 << bit;
            // XOR to flip bit
            const newCharCode = charCode ^ mask;
            const newChar = String.fromCharCode(newCharCode);
            
            // Strict Filter for Bitsquatting:
            // 1. Must be a valid domain character (alphanumeric + hyphen)
            // 2. Must NOT be the same character as original (ignoring case)
            //    (e.g. flipping 'a' (97) bit 5 gives 'A' (65). 'A'.toLowerCase() == 'a'. This is the same domain.)
            if (/^[a-z0-9-]$/i.test(newChar) && newChar.toLowerCase() !== name[i]) {
                add(name.slice(0, i) + newChar.toLowerCase() + name.slice(i+1), 'BITSQUATTING');
            }
        }
    }

    // 9. Vowel Swap
    for (let i = 0; i < name.length; i++) {
        if (VOWELS[name[i]]) {
            add(name.slice(0, i) + VOWELS[name[i]] + name.slice(i+1), 'VOWEL_SWAP');
        }
    }

    // 10. Hyphenation (Insert hyphens between characters)
    for (let i = 1; i < name.length; i++) {
        add(name.slice(0, i) + '-' + name.slice(i), 'HYPHENATION');
    }

    // 11. Subdomain Insertion (Insert dot)
    for (let i = 1; i < name.length; i++) {
         if (name[i] !== '.' && name[i-1] !== '.') {
             add(name.slice(0, i) + '.' + name.slice(i), 'SUBDOMAIN');
         }
    }

    // 12. TLD Swap (Common ones)
    const commonTlds = ['com', 'net', 'org', 'io', 'co', 'info', 'biz', 'online', 'store'];
    commonTlds.forEach(altTld => {
        if (altTld !== tld) {
            results.push({
                original: lowerDomain,
                variation: `${name}.${altTld}`,
                type: 'TLD',
                isRegistered: false
            });
        }
    });

    // Dedup
    const unique = new Map<string, TyposquatResult>();
    results.forEach(r => unique.set(r.variation, r));
    
    return Array.from(unique.values()).slice(0, 800); // Limit to reasonable count
};

export const checkDomainStatus = async (item: TyposquatResult, officialLogo?: string): Promise<TyposquatResult> => {
    try {
        // Active DNS check to see if it resolves
        const res = await queryDoH(item.variation, 'A');
        
        if (res && res.Answer && res.Answer.length > 0) {
            const ip = res.Answer[0].data;
            let country = 'Unknown';
            
            // Check for Mail Exchange Record
            let hasMx = false;
            try {
                const mxRes = await queryDoH(item.variation, 'MX');
                if (mxRes && mxRes.Answer && mxRes.Answer.length > 0) {
                    hasMx = true;
                }
            } catch(e) {}

            // Enrich with GeoIP if possible
            try {
                const geo = await enrichIP(ip);
                if (geo) country = geo.country_code;
            } catch(e) {}

            // Generate visual URL
            const screenshotUrl = `https://image.thum.io/get/width/400/crop/600/noanimate/https://${item.variation}`;
            
            let logoScore = 0;
            if (officialLogo) {
                // Perform visual analysis if official logo is present
                try {
                    logoScore = await analyzeVisualSimilarity(officialLogo, screenshotUrl);
                } catch(e) {}
            }
            
            // Check for Phonetic similarity
            const phoneticMatch = getSoundex(item.variation.split('.')[0]) === getSoundex(item.original.split('.')[0]);

            return {
                ...item,
                isRegistered: true,
                ip: ip,
                country: country,
                dns: {
                    a: [ip],
                    mx: [], // Simplified for this function, hasMx flag is main indicator
                    ns: []
                },
                screenshotUrl,
                logoMatchScore: logoScore,
                hasMx,
                phoneticMatch
            };
        }
    } catch (e) {
        // Ignore resolution errors (NXDOMAIN means likely safe)
    }
    return item;
};
