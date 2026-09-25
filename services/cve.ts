
import { CveEntry } from '../types';

const NVD_API_URL = 'https://services.nvd.nist.gov/rest/json/cves/2.0';
const CISA_KEV_GITHUB_MAIN = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';

// Proxy rotation to bypass CORS
// Order: Direct -> Vercel -> Public
const PROXIES = [
    (url: string) => url, // Try direct first
    (url: string) => `/api/proxy?url=${encodeURIComponent(url)}`, // Vercel
    (url: string) => `/api/proxy?url=${encodeURIComponent(url)}`,
    (url: string) => `/api/proxy?url=${encodeURIComponent(url)}`,
    (url: string) => `/api/proxy?url=${encodeURIComponent(url)}`,
];

// Helper to fetch with proxy rotation
const fetchJsonWithProxy = async (targetUrl: string): Promise<any> => {
    for (const proxyGen of PROXIES) {
        try {
            const url = proxyGen(targetUrl);
            const res = await fetch(url);
            
            // Check for Vercel marker if using local proxy path
            if (url.startsWith('/api/proxy') && !res.headers.get('X-Source-Proxy') && !res.ok) {
                continue;
            }

            if (res.ok) {
                const text = await res.text();
                // Basic validation
                if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
                    return JSON.parse(text);
                }
            }
        } catch (e) {
            // continue
        }
    }
    throw new Error("Failed to fetch data from all proxies");
};

// Helper to transform NVD JSON format to our internal CveEntry format
const transformNvdCve = (cveItem: any): CveEntry => {
    const cve = cveItem.cve || cveItem; // Sometimes wrapped in 'cve' property in NVD 2.0
    const metrics = cve.metrics?.cvssMetricV31?.[0] || cve.metrics?.cvssMetricV30?.[0] || cve.metrics?.cvssMetricV2?.[0] || {};
    const cvssData = metrics.cvssData || {};
    
    // Determine severity
    let severity = 'UNKNOWN';
    if (cvssData.baseSeverity) severity = cvssData.baseSeverity;
    else if (metrics.baseSeverity) severity = metrics.baseSeverity; // V2

    // Check for exploit reference
    const hasExploit = cve.references?.some((r: any) => 
        r.tags?.some((t: string) => t.toLowerCase() === 'exploit')
    ) || false;

    // Extract CPEs
    const configurations = cve.configurations?.flatMap((c: any) => c.nodes?.flatMap((n: any) => n.cpeMatch?.map((m: any) => m.criteria))) || [];
    
    // Extract Vendor/Product from CPE
    let vendor = 'Unknown';
    let product = 'Unknown';

    if (configurations.length > 0) {
        // Try to find a valid CPE string
        // Format: cpe:2.3:a:vendor:product:version...
        const cpe = configurations[0];
        if (cpe && cpe.startsWith('cpe:2.3:')) {
            const parts = cpe.split(':');
            if (parts.length >= 5) {
                // Formatting: capitalize and replace underscores
                vendor = parts[3].charAt(0).toUpperCase() + parts[3].slice(1).replace(/_/g, ' ');
                product = parts[4].charAt(0).toUpperCase() + parts[4].slice(1).replace(/_/g, ' ');
            }
        }
    }

    return {
        id: cve.id,
        sourceIdentifier: cve.sourceIdentifier || 'NVD',
        published: cve.published,
        lastModified: cve.lastModified,
        status: cve.vulnStatus || 'Unknown',
        description: cve.descriptions?.find((d: any) => d.lang === 'en')?.value || 'No description available',
        cvssScore: cvssData.baseScore || 0,
        severity: severity,
        vectorString: cvssData.vectorString || '',
        weaknesses: cve.weaknesses?.map((w: any) => w.description?.[0]?.value).filter(Boolean) || [],
        references: cve.references?.map((r: any) => ({ url: r.url, tags: r.tags || [] })) || [],
        configurations: configurations,
        vendor: vendor,
        product: product,
        cweCategory: 'Unknown',
        hasExploit: hasExploit,
        isKev: false,
        tags: hasExploit ? ['Exploit Available'] : [],
        vector: {
            AV: cvssData.attackVector || cvssData.accessVector,
            AC: cvssData.attackComplexity || cvssData.accessComplexity,
            PR: cvssData.privilegesRequired || cvssData.authentication,
            UI: cvssData.userInteraction || (typeof cvssData.userInteractionRequired === 'boolean' ? (cvssData.userInteractionRequired ? 'Required' : 'None') : cvssData.userInteractionRequired),
            S: cvssData.scope,
            C: cvssData.confidentialityImpact,
            I: cvssData.integrityImpact,
            A: cvssData.availabilityImpact
        }
    };
};

export const parseNvdCve = async (file: File): Promise<CveEntry[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const json = JSON.parse(text);
                const cves: CveEntry[] = [];

                const vulnerabilities = json.vulnerabilities || [];
                
                for (const item of vulnerabilities) {
                    cves.push(transformNvdCve(item));
                }
                resolve(cves);
            } catch (err) {
                console.error("NVD Parse Error", err);
                reject(new Error("Invalid NVD CVE JSON"));
            }
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsText(file);
    });
};

export const fetchCveUpdates = async (lastUpdate?: Date): Promise<CveEntry[]> => {
    const cves: CveEntry[] = [];
    const seenIds = new Set<string>();
    
    // 1. Fetch CISA KEV
    try {
        const kevData = await fetchJsonWithProxy(CISA_KEV_GITHUB_MAIN);
        if (kevData && kevData.vulnerabilities) {
            kevData.vulnerabilities.forEach((vuln: any) => {
                if (lastUpdate && new Date(vuln.dateAdded) <= lastUpdate) {
                    return;
                }

                const entry = {
                    id: vuln.cveID,
                    sourceIdentifier: 'CISA',
                    published: vuln.dateAdded,
                    lastModified: vuln.dateAdded,
                    status: 'Active',
                    description: vuln.shortDescription,
                    cvssScore: 0, 
                    severity: 'HIGH', // Implicit for KEV
                    vectorString: '',
                    weaknesses: [],
                    references: [{ url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog', tags: ['CISA KEV'] }],
                    configurations: [vuln.product],
                    vendor: vuln.vendorProject,
                    product: vuln.product,
                    cweCategory: 'Unknown',
                    hasExploit: true,
                    isKev: true,
                    tags: ['KEV', 'Exploited'],
                    vector: {}
                };
                
                cves.push(entry);
                seenIds.add(vuln.cveID);
            });
        }
    } catch (e) {
        console.warn("Failed to fetch CISA KEV", e);
    }

    // 2. Fetch NVD (Recent)
    try {
        const params = new URLSearchParams();
        params.append('resultsPerPage', '500'); // Fetch a batch
        
        if (lastUpdate) {
             // NVD API format for dates: YYYY-MM-DDTHH:mm:ss.SSS
             const start = lastUpdate.toISOString().replace(/\.\d{3}Z$/, '');
             const end = new Date().toISOString().replace(/\.\d{3}Z$/, '');
             params.append('lastModStartDate', start);
             params.append('lastModEndDate', end);
        } else {
             // Initial load: Fetch last 120 days to populate database with relevant recent data
             const daysAgo = new Date();
             daysAgo.setDate(daysAgo.getDate() - 120);
             const start = daysAgo.toISOString().replace(/\.\d{3}Z$/, '');
             const end = new Date().toISOString().replace(/\.\d{3}Z$/, '');
             params.append('pubStartDate', start);
             params.append('pubEndDate', end);
        }

        const nvdData = await fetchJsonWithProxy(`${NVD_API_URL}?${params.toString()}`);
        
        if (nvdData && nvdData.vulnerabilities) {
            for (const item of nvdData.vulnerabilities) {
                const entry = transformNvdCve(item);
                if (!seenIds.has(entry.id)) {
                    cves.push(entry);
                    seenIds.add(entry.id);
                }
            }
        }
    } catch (e) {
        console.warn("Failed to fetch NVD data", e);
    }

    return cves;
};


