
import { SandboxNetworkLog, DomMutationLog, DarkwebScreenshot, IpDataResponse } from '../types';
import { checkRBL, enrichIP, checkDnsBlocking } from './dns';

// Configuration interface
interface SandboxConfig {
    allowJs: boolean;
    blockExternalJs: boolean;
    stripInlineScripts: boolean;
    enforceCsp: boolean;
}

// --- CACHING & PERFORMANCE ---
const CONTENT_CACHE = new Map<string, { blobUrl: string, timestamp: number, mutations: DomMutationLog[] }>();
const CACHE_TTL = 1000 * 60 * 15; // 15 Minutes

// --- PROXY STRATEGY ---
// We use a racing strategy: fire requests to multiple proxies, take the first success.
const FAST_PROXIES = [
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`
];

// --- TOR BRIDGES ---
// Public gateways to route .onion traffic via standard HTTP
// We use ID.onion.GATEWAY pattern which is common for these services
// Prioritize onion.dog and onion.pet as they are more permissive with proxies than onion.ly
const TOR_GATEWAYS = [
    (id: string) => `https://${id}.onion.dog`,
    (id: string) => `https://${id}.onion.pet`,
    (id: string) => `https://${id}.onion.ws`
];

// --- Heuristics Constants ---
const SUSPICIOUS_TLDS = ['.xyz', '.top', '.gq', '.tk', '.ml', '.cf', '.cc', '.pw', '.work', '.click', '.loan', '.download'];
const PHISHING_KEYWORDS = ['login', 'signin', 'verify', 'account', 'update', 'banking', 'secure', 'confirm', 'wallet', 'crypto', 'paypal', 'support'];

// Calculate Shannon Entropy for a string (used for DGA detection)
const calculateEntropy = (str: string): number => {
    const len = str.length;
    if (len === 0) return 0;
    const frequencies = new Map<string, number>();
    for (let i = 0; i < len; i++) {
        const char = str[i];
        frequencies.set(char, (frequencies.get(char) || 0) + 1);
    }
    let entropy = 0;
    frequencies.forEach(count => {
        const p = count / len;
        entropy -= p * Math.log2(p);
    });
    return entropy;
};

// --- Threat Scoring ---
export const evaluateUrlThreat = async (url: string): Promise<{ score: number, category: 'SAFE' | 'SUSPICIOUS' | 'MALICIOUS' | 'UNKNOWN', signatures: string[], details: any }> => {
    try {
        let domain = '';
        let pathname = '';
        let protocol = '';
        let port = '';
        
        try {
            const urlObj = new URL(url);
            domain = urlObj.hostname;
            pathname = urlObj.pathname + urlObj.search;
            protocol = urlObj.protocol;
            port = urlObj.port;
        } catch { 
            // Handle .onion without protocol
            if (url.endsWith('.onion')) {
                domain = url;
                protocol = 'http:'; // Assume HTTP for onion
            } else {
                return { score: 0, category: 'UNKNOWN', signatures: [], details: {} }; 
            }
        }

        const signatures: string[] = [];
        let score = 0;

        // 0. Darkweb Check
        if (domain.endsWith('.onion')) {
            score += 50; // Inherently risky environment
            signatures.push('Darkweb Hidden Service (.onion)');
            return { score: 50, category: 'SUSPICIOUS', signatures, details: { isOnion: true } };
        }

        // 1. Protocol Security
        if (protocol === 'http:') {
            score += 10;
            signatures.push('Unencrypted Protocol (HTTP)');
        }

        // 2. IP vs Domain
        const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(domain);
        if (isIp) {
            score += 20;
            signatures.push('Raw IP Access (No Domain)');
        }

        // 3. Port Anomalies
        if (port && port !== '80' && port !== '443') {
            score += 15;
            signatures.push(`Non-Standard Port (${port})`);
        }

        // 4. TLD Check
        if (SUSPICIOUS_TLDS.some(tld => domain.endsWith(tld))) {
            score += 25;
            signatures.push('High-Risk Top Level Domain');
        }

        // 5. Entropy Check (DGA)
        const domainParts = domain.split('.');
        const coreDomain = domainParts.length > 1 ? domainParts[domainParts.length - 2] : domainParts[0];
        if (coreDomain && calculateEntropy(coreDomain) > 4.2 && !isIp) {
            score += 30;
            signatures.push('High Entropy Domain (Potential DGA)');
        }

        // 6. Phishing Keyword Analysis
        const lowerPath = pathname.toLowerCase();
        if (PHISHING_KEYWORDS.some(k => lowerPath.includes(k) || domain.includes(k))) {
            score += 25;
            signatures.push('Suspicious Keywords (Phishing Indicator)');
        }

        // 7. Check IP/Geo Threat
        let ipThreat = null;
        if (isIp) {
            ipThreat = await enrichIP(domain);
            if (ipThreat) {
                if (ipThreat.threat.is_known_attacker) {
                    score += 80;
                    signatures.push('Known Attacker IP');
                }
                if (ipThreat.threat.is_bot) {
                    score += 50;
                    signatures.push('Known Botnet IP');
                }
                if (ipThreat.threat.is_tor) {
                    score += 20; // Reduced from 40
                    signatures.push('TOR Exit Node');
                }
                if (ipThreat.threat.is_proxy) {
                    score += 15;
                    signatures.push('Anonymizing Proxy');
                }
            }
        }

        // 8. Check DNS Firewall (DoT)
        const firewall = await checkDnsBlocking(domain);
        // Only count MALWARE filter blocks towards threat score
        // FAMILY/ADS blocks are policy blocks, not security threats
        const malwareBlocks = firewall.filter(f => f.status === 'BLOCKED' && f.filterType === 'MALWARE');
        
        if (malwareBlocks.length > 0) {
            score += 90;
            signatures.push('Blocked by Security DNS (Malware)');
        }

        // Determine Category
        let category: 'SAFE' | 'SUSPICIOUS' | 'MALICIOUS' | 'UNKNOWN' = 'SAFE';
        if (score >= 80) category = 'MALICIOUS';
        else if (score >= 40) category = 'SUSPICIOUS';

        return { score: Math.min(100, score), category, signatures, details: { firewall, ipThreat } };
    } catch (e) {
        return { score: 0, category: 'UNKNOWN', signatures: [], details: {} };
    }
};

// --- HTML Sanitizer ---
const sanitizeHtml = (html: string, config: SandboxConfig, url: string): { cleanedHtml: string, mutations: DomMutationLog[], removedScripts: number } => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const mutations: DomMutationLog[] = [];
    let removedScripts = 0;

    if (!doc.querySelector('base')) {
        const base = doc.createElement('base');
        base.href = url;
        doc.head.insertBefore(base, doc.head.firstChild);
    }

    if (config.enforceCsp) {
        const csp = doc.createElement('meta');
        csp.httpEquiv = "Content-Security-Policy";
        // Allow scripts so our interceptor works, but restrict others
        csp.content = `default-src 'self'; img-src * data:; style-src 'unsafe-inline' *; font-src *; script-src 'unsafe-inline' 'unsafe-eval' *; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; block-all-mixed-content;`;
        doc.head.appendChild(csp);
        mutations.push({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), type: 'ADD', target: 'HEAD', detail: 'Injected CSP meta tag' });
    }

    const scripts = Array.from(doc.querySelectorAll('script'));
    scripts.forEach(script => {
        if (!config.allowJs || config.blockExternalJs) {
            if (script.src) {
                script.remove();
                removedScripts++;
                mutations.push({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), type: 'REMOVE', target: 'SCRIPT', detail: `Removed external script: ${script.src.substring(0, 50)}...` });
            } else if (!config.allowJs) {
                script.remove();
                removedScripts++;
                mutations.push({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), type: 'REMOVE', target: 'SCRIPT', detail: 'Removed inline script tag' });
            }
        }
    });

    const allElements = Array.from(doc.querySelectorAll('*'));
    allElements.forEach(el => {
        const attrs = Array.from(el.attributes);
        attrs.forEach(attr => {
            if (attr.name.startsWith('on')) {
                el.removeAttribute(attr.name);
                mutations.push({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), type: 'MODIFY', target: el.tagName, detail: `Removed inline handler: ${attr.name}` });
            }
            if (attr.name === 'href' && attr.value.toLowerCase().trim().startsWith('javascript:')) {
                el.setAttribute('href', '#blocked');
                mutations.push({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), type: 'MODIFY', target: 'A', detail: 'Neutralized javascript: URI' });
            }
        });
        
        if (el.tagName === 'IFRAME') {
            const width = el.getAttribute('width');
            const height = el.getAttribute('height');
            const style = el.getAttribute('style') || '';
            
            if (width === '0' || height === '0' || style.includes('display:none') || style.includes('visibility:hidden')) {
                 mutations.push({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), type: 'ADD', target: 'IFRAME', detail: 'Hidden/Zero-size iframe detected' });
            }
        }

        if (el.tagName === 'OBJECT' || el.tagName === 'EMBED') {
            const placeholder = doc.createElement('div');
            placeholder.style.cssText = 'background:#111;color:#666;padding:10px;border:1px dashed #444;font-family:monospace;font-size:10px;';
            placeholder.textContent = `[Blocked Content: ${el.tagName}]`;
            el.replaceWith(placeholder);
            mutations.push({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), type: 'REMOVE', target: el.tagName, detail: 'Removed potentially dangerous embed' });
        }
    });

    // --- SYSTEM SCRIPTS ---
    // Always inject the navigation interceptor so we can control clicks inside the sandbox
    const navScript = doc.createElement('script');
    navScript.textContent = `
    (function() {
        document.addEventListener('click', function(e) {
            // Find closest anchor tag
            var target = e.target;
            while (target && target.tagName !== 'A') {
                target = target.parentNode;
            }
            
            if (target && target.href) {
                // Check if it's a local anchor link or JS link
                var href = target.getAttribute('href');
                if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

                e.preventDefault();
                // Send to parent for safe handling
                window.parent.postMessage({ type: 'NAVIGATE', url: target.href }, '*');
            }
        }, true);
    })();
    `;
    doc.head.insertBefore(navScript, doc.head.firstChild);

    // Optional Monitoring Script (Mutation Observer, Fetch Hooking)
    if (config.allowJs) {
        const monitorScript = doc.createElement('script');
        monitorScript.textContent = `
        (function() {
            window.eval = function() { console.warn("Eval blocked by sandbox"); };
            
            try {
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.target.nodeName === 'SCRIPT') return;
                        let details = mutation.attributeName || 'childList';
                        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                             details = 'Added ' + mutation.addedNodes[0].nodeName;
                        }
                        window.parent.postMessage({
                            type: 'DOM_MUTATION',
                            kind: mutation.type,
                            target: mutation.target.nodeName,
                            details: details,
                            addedNodes: mutation.addedNodes.length > 0
                        }, '*');
                    });
                });
                observer.observe(document, { attributes: true, childList: true, subtree: true });

                const originalFetch = window.fetch;
                window.fetch = async (...args) => {
                    window.parent.postMessage({ type: 'NET_REQUEST', method: 'GET', url: args[0] }, '*');
                    return originalFetch(...args);
                };
                
                const originalOpen = XMLHttpRequest.prototype.open;
                XMLHttpRequest.prototype.open = function(method, url) {
                    window.parent.postMessage({ type: 'NET_REQUEST', method: method, url: url }, '*');
                    return originalOpen.apply(this, arguments);
                };
            } catch(e) {}
        })();
        `;
        doc.head.insertBefore(monitorScript, doc.head.firstChild);
    }

    return { cleanedHtml: doc.documentElement.outerHTML, mutations, removedScripts };
};

// --- Fast Fetching Utility (Race) ---
const raceToSuccess = async (urls: string[], timeoutMs: number = 8000): Promise<Response> => {
    // Try to find cached entry first (Basic URL check)
    // Actual proxy rotation is handled inside the race.
    
    // We create a promise that rejects only after ALL fetch attempts fail
    const errors: any[] = [];
    return new Promise((resolve, reject) => {
        let failureCount = 0;
        let resolved = false;

        urls.forEach(url => {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeoutMs);

            fetch(url, { signal: controller.signal })
                .then(res => {
                    if (res.ok && !resolved) {
                        resolved = true;
                        clearTimeout(id);
                        resolve(res);
                    } else {
                        throw new Error(`Status ${res.status}`);
                    }
                })
                .catch(err => {
                    errors.push(err);
                    failureCount++;
                    if (failureCount === urls.length && !resolved) {
                        reject(new Error("All connections failed or timed out."));
                    }
                });
        });
    });
};

// --- Proxy Fetcher ---
export const fetchSafeContent = async (
    targetUrl: string, 
    config: SandboxConfig,
    onNetworkLog: (log: SandboxNetworkLog) => void
): Promise<{ blobUrl: string, mutations: DomMutationLog[] }> => {
    
    // 1. Check Cache
    if (CONTENT_CACHE.has(targetUrl)) {
        const cached = CONTENT_CACHE.get(targetUrl)!;
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            onNetworkLog({
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                method: 'GET',
                url: targetUrl,
                status: 200,
                type: 'cache-hit',
                size: 0,
                blocked: false
            });
            return { blobUrl: cached.blobUrl, mutations: cached.mutations };
        } else {
            CONTENT_CACHE.delete(targetUrl); // Expired
        }
    }

    // 2. Race Proxies for Performance
    const proxyUrls = FAST_PROXIES.map(p => p(targetUrl));
    
    let response: Response;
    try {
        response = await raceToSuccess(proxyUrls, 10000); // 10s Timeout
    } catch (e: any) {
        onNetworkLog({
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            method: 'GET',
            url: targetUrl,
            status: 0,
            type: 'document',
            size: 0,
            blocked: true
        });
        throw new Error(`Connection failed. Target is unreachable or blocking proxies.`);
    }

    const text = await response.text();
    const size = text.length;
    
    onNetworkLog({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        method: 'GET',
        url: targetUrl,
        status: response.status,
        type: response.headers.get('content-type') || 'unknown',
        size: size,
        blocked: false
    });

    const { cleanedHtml, mutations } = sanitizeHtml(text, config, targetUrl);
    const blob = new Blob([cleanedHtml], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);

    // Cache the result
    CONTENT_CACHE.set(targetUrl, { blobUrl, timestamp: Date.now(), mutations });

    return { blobUrl, mutations };
};

// --- Darkweb / Onion Fetcher ---

const generateMockScreenshot = (seed: string) => {
  const sum = seed.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const hue = sum % 360;
  // Generate a stylized SVG wireframe
  return `data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'%3E%3Cdefs%3E%3Cpattern id='grid' width='20' height='20' patternUnits='userSpaceOnUse'%3E%3Cpath d='M 20 0 L 0 0 0 20' fill='none' stroke='%23333' stroke-width='1'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='800' height='600' fill='%23111'/%3E%3Crect width='800' height='600' fill='url(%23grid)' opacity='0.2'/%3E%3Crect x='50' y='50' width='700' height='50' rx='5' fill='%23222' stroke='%23444' stroke-width='2'/%3E%3Ccircle cx='80' cy='75' r='8' fill='%23555'/%3E%3Crect x='110' y='65' width='500' height='20' rx='3' fill='%23000'/%3E%3Crect x='50' y='120' width='200' height='400' rx='5' fill='%231a1a1a' stroke='%23333'/%3E%3Crect x='270' y='120' width='480' height='250' rx='5' fill='hsl(${hue}, 40%, 15%)' stroke='hsl(${hue}, 50%, 30%)'/%3E%3Cpath d='M350 245 L450 245 L400 165 Z' fill='none' stroke='hsl(${hue}, 70%, 50%)' stroke-width='2'/%3E%3Ctext x='510' y='250' fill='hsl(${hue}, 70%, 70%)' font-family='monospace' font-size='24' font-weight='bold'%3EHIDDEN SERVICE%3C/text%3E%3Crect x='270' y='390' width='480' height='130' rx='5' fill='%23222'/%3E%3Crect x='290' y='410' width='300' height='10' fill='%23444'/%3E%3Crect x='290' y='435' width='400' height='10' fill='%23333'/%3E%3Crect x='290' y='460' width='350' height='10' fill='%23333'/%3E%3Ctext x='400' y='30' fill='%23666' text-anchor='middle' font-family='monospace' font-size='12'%3E${encodeURIComponent(seed).substring(0, 50)}...%3C/text%3E%3C/svg%3E`;
};

// Attempt to fetch real content via Tor2Web gateways
export const fetchOnionContent = async (
    onionUrl: string,
    config: SandboxConfig,
    onNetworkLog: (log: SandboxNetworkLog) => void
): Promise<{ success: boolean, blobUrl?: string, mutations?: DomMutationLog[], screenshotData?: DarkwebScreenshot }> => {
    
    // Extract Onion ID (hostname without .onion)
    let onionId = '';
    try {
        const hostname = new URL(onionUrl).hostname;
        onionId = hostname.replace('.onion', '');
    } catch {
        onionId = onionUrl.split('/')[0].replace('.onion', '');
    }

    // 1. Generate Direct Gateway URLs
    const directGateways = TOR_GATEWAYS.map(gw => gw(onionId));

    // 2. Wrap via Proxy Chaining (Multiplexing)
    // We try every gateway through every proxy to maximize success chance as public gateways usually lack CORS headers
    const candidateUrls: string[] = [];
    directGateways.forEach(gwUrl => {
        FAST_PROXIES.forEach(proxy => {
            candidateUrls.push(proxy(gwUrl));
        });
    });

    try {
        const response = await raceToSuccess(candidateUrls, 25000); // Increased timeout to 25s for Tor latency
        const text = await response.text();
        
        onNetworkLog({
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            method: 'GET',
            url: onionUrl,
            status: response.status,
            type: 'text/html',
            size: text.length,
            blocked: false
        });

        const { cleanedHtml, mutations } = sanitizeHtml(text, config, onionUrl);
        // Inject a banner about gateway usage
        const banner = `<div style="background:#222;color:#fbbf24;text-align:center;padding:5px;font-family:monospace;font-size:10px;border-bottom:1px solid #fbbf24;">CONNECTED VIA TOR2WEB GATEWAY - ANONYMITY REDUCED</div>`;
        const finalHtml = cleanedHtml.replace('<body', `<body${banner}`);
        
        const blob = new Blob([finalHtml], { type: 'text/html' });
        const blobUrl = URL.createObjectURL(blob);

        return { success: true, blobUrl, mutations };

    } catch (e) {
        // 2. Fallback to Simulation if gateways fail (common for dead onion links)
        const screenshotUrl = generateMockScreenshot(onionUrl);
        const screenshotData: DarkwebScreenshot = {
            imageBase64: screenshotUrl,
            extractedText: `SERVER: TOR-Relay/0.4.7.13\nONION: ${onionUrl}\nSTATUS: 504 GATEWAY TIMEOUT (SIMULATED)\n\n[TITLE] Hidden Service V3\n\n[CONTENT START]\nWarning: This service is hosted on the Tor network and could not be reached via public gateways.\n\nSimulated Preview Generated.\n\n[CONTENT END]`,
            title: `Hidden Service - ${onionUrl.substring(0, 15)}...`,
            timestamp: new Date().toISOString()
        };
        
        return { success: false, screenshotData };
    }
};

export const fetchDarkwebScreenshot = async (url: string): Promise<DarkwebScreenshot> => {
    // Legacy support for direct screenshot only
    await new Promise(r => setTimeout(r, 1000));
    const screenshotUrl = generateMockScreenshot(url);
    return {
        imageBase64: screenshotUrl,
        extractedText: `SERVER: TOR-Relay/0.4.7.13\nONION: ${url}\nSTATUS: 200 OK\n\n[TITLE] Hidden Service V3\n\n[CONTENT START]\nWarning: This service is hosted on the Tor network.\n\n> Login Portal\nUser: [_______]\nPass: [*******]\n\n> Public PGP Key\n-----BEGIN PGP PUBLIC KEY BLOCK-----\nxsBNBF...\n-----END PGP PUBLIC KEY BLOCK-----\n\n> Recent News\n- Market update v2.1\n- New escrow features added\n\n[CONTENT END]`,
        title: `Hidden Service - ${url.substring(0, 15)}...`,
        timestamp: new Date().toISOString()
    };
};
