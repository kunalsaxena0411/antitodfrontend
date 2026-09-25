
export interface UnifiedIoc {
    id: string;
    source: string;
    type: string;
    value: string;
    threat: string;
    firstSeen: string;
    timestamp: number; // Added for high-performance sorting
    tags?: string[];
    country?: string; // Added for GeoIP support
    asn?: string;     // Added for ASN support
    org?: string;     // Added for ISP/Org support
    original: any;
}

export const convertToStixBundle = (iocs: UnifiedIoc[]): string => {
    const timestamp = new Date().toISOString();
    const bundleId = `bundle--${crypto.randomUUID()}`;
    
    const objects = iocs.map(ioc => {
        let pattern = '';
        const val = ioc.value.replace(/'/g, "\\'"); // Escape single quotes
        
        // STIX Pattern Mapping
        if (ioc.type === 'IP' || ioc.type === 'IP:PORT') {
            const ip = val.split(':')[0]; // Strip port for simplified ipv4-addr matching
            pattern = `[ipv4-addr:value = '${ip}']`;
        } else if (ioc.type === 'URL') {
            pattern = `[url:value = '${val}']`;
        } else if (ioc.type === 'DOMAIN') {
            pattern = `[domain-name:value = '${val}']`;
        } else if (ioc.type === 'SHA256') {
            pattern = `[file:hashes.'SHA-256' = '${val}']`;
        } else if (ioc.type === 'MD5' || ioc.type === 'MD5 (JA3)') {
            pattern = `[file:hashes.MD5 = '${val}']`;
        } else if (ioc.type === 'SHA1' || ioc.type === 'SHA1 (CERT)') {
            pattern = `[file:hashes.'SHA-1' = '${val}']`;
        } else {
            pattern = `[x-custom:value = '${val}']`;
        }

        const indicator: any = {
            type: "indicator",
            id: `indicator--${crypto.randomUUID()}`,
            created: new Date().toISOString(),
            modified: new Date().toISOString(),
            name: `${ioc.threat} (${ioc.type})`,
            description: `Detected by ${ioc.source}. Tags: ${(ioc.tags || []).join(', ')}`,
            pattern: pattern,
            pattern_type: "stix",
            valid_from: ioc.firstSeen || new Date().toISOString(),
            labels: [ioc.threat, "malicious-activity", ioc.source, ...(ioc.tags || [])].map(s => s.toLowerCase().replace(/\s+/g, '-')),
            confidence: 85 // Default high confidence for feed data
        };

        if (ioc.country) {
            indicator.x_country = ioc.country;
        }
        if (ioc.asn) {
            indicator.x_asn = ioc.asn;
        }

        return indicator;
    });

    const bundle = {
        type: "bundle",
        id: bundleId,
        objects: objects
    };

    return JSON.stringify(bundle, null, 2);
};

