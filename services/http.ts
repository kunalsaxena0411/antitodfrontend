
interface ProxyConfig {
    url: (target: string) => string;
    isWrapped: boolean; // True if response is { contents: "..." } (e.g. AllOrigins /get)
    name: string;
    supportsHeaders: boolean;
}

// Priority: Direct -> CORSProxy -> CodeTabs -> Vercel -> Public Proxies
// We prioritize proxies that support headers (x-apikey) for VT integration.
const PROXIES: ProxyConfig[] = [
    { name: 'Vercel', url: (u) => `/api/proxy?url=${encodeURIComponent(u)}`, isWrapped: false, supportsHeaders: true },
    { name: 'Direct', url: (u) => u, isWrapped: false, supportsHeaders: true },
    { name: 'AllOrigins', url: (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`, isWrapped: true, supportsHeaders: false },
];

/**
 * Fetches text content from a URL using the best available CORS strategy.
 * Includes explicit check for local proxy availability via marker header.
 * @param targetUrl The URL to fetch
 * @param options Optional configuration including validation predicate and headers
 */
export const fetchWithCors = async (targetUrl: string, options?: { validate?: (text: string) => boolean, headers?: Record<string, string>, requiresHeaders?: boolean }): Promise<string> => {
    // Filter proxies based on requirements
    // If headers are required (e.g. API Keys), remove proxies that don't support them
    const applicableProxies = options?.requiresHeaders 
        ? PROXIES.filter(p => p.supportsHeaders)
        : PROXIES;

    // Try Proxies in order
    for (const proxy of applicableProxies) {
        try {
            const proxyUrl = proxy.url(targetUrl);
            
            // Prepare fetch options
            const fetchOptions: RequestInit = {
                method: 'GET'
            };

            // Attach headers if provided and proxy supports them
            if (options?.headers && proxy.supportsHeaders) {
                fetchOptions.headers = options.headers;
            }

            const res = await fetch(proxyUrl, fetchOptions);

            if (res.ok) {
                let text = await res.text();
                
                if (proxy.isWrapped) {
                    try {
                        const json = JSON.parse(text);
                        // AllOrigins /get returns { contents: "string", status: ... }
                        if (json.contents) text = json.contents;
                    } catch (e) {
                        // Fallback if structure is unexpected
                    }
                }

                // If a validator is provided, ensure the content passes
                // This catches cases where a proxy returns a 200 OK HTML error page instead of JSON
                if (options?.validate && !options.validate(text)) {
                    // console.warn(`Proxy ${proxy.name} returned invalid content for ${targetUrl}`);
                    continue;
                }
                
                return text;
            }
        } catch (e) {
            // Continue to next proxy
        }
    }

    throw new Error(`Failed to fetch ${targetUrl} from all available sources.`);
};

/**
 * Helper to fetch and parse JSON directly with validation
 */
export const fetchJsonWithCors = async <T>(targetUrl: string, options?: { headers?: Record<string, string>, requiresHeaders?: boolean }): Promise<T> => {
    const isJson = (text: string) => {
        const t = text.trim();
        // Basic check: must start with { or [ and not be an HTML tag
        return (t.startsWith('{') || t.startsWith('[')) && !t.startsWith('<') && !t.toLowerCase().startsWith('error');
    };

    try {
        const text = await fetchWithCors(targetUrl, { validate: isJson, headers: options?.headers, requiresHeaders: options?.requiresHeaders });
        return JSON.parse(text) as T;
    } catch (e) {
        console.warn(`Fetch failed for ${targetUrl}`);
        throw new Error("Invalid JSON response or all proxies failed");
    }
};


