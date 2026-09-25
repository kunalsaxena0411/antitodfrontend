
import { CveEntry, InventoryAsset, VulnMatch, ExploitEntry } from '../types';

// Helper to normalize version strings
const parseVersion = (version: string): string => {
    return version.replace(/^v/i, '').trim();
};

// Simple Semantic Version Comparator
// Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
const compareVersions = (v1: string, v2: string): number => {
    const p1 = v1.split('.').map(Number);
    const p2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
        const n1 = p1[i] || 0;
        const n2 = p2[i] || 0;
        if (n1 > n2) return 1;
        if (n1 < n2) return -1;
    }
    return 0;
};

// Heuristic CPE generator
export const generateCpe = (vendor: string, product: string, version: string): string => {
    const v = vendor.toLowerCase().replace(/\s+/g, '_');
    const p = product.toLowerCase().replace(/\s+/g, '_');
    const ver = version ? version.trim() : '*';
    // cpe:2.3:a:vendor:product:version:*:*:*:*:*:*:*
    return `cpe:2.3:a:${v}:${p}:${ver}:*:*:*:*:*:*:*`;
};

// Scoring Engine for Personalized Risk
const calculatePriority = (cve: CveEntry, asset: InventoryAsset): number => {
    let score = cve.cvssScore * 10; // Base 0-100

    // Contextual Multipliers
    if (cve.isKev) score += 30; // Active Exploitation is #1 priority
    if (cve.hasExploit) score += 15; // Public PoC exists
    
    // Critical Asset Factor
    if (asset.criticality === 'Critical') score += 20;
    if (asset.criticality === 'High') score += 10;

    // Threat Vector
    if (cve.vector.AV === 'NETWORK') score += 10; // Remote exploitable

    return Math.min(100, score);
};

// Main Matching Logic
export const matchVulnerabilities = (
    assets: InventoryAsset[], 
    cves: CveEntry[]
): VulnMatch[] => {
    const matches: VulnMatch[] = [];

    assets.forEach(asset => {
        const assetVendor = asset.vendor.toLowerCase();
        const assetProduct = asset.product.toLowerCase();
        // Allow empty version
        const assetVersion = asset.version ? parseVersion(asset.version) : '';

        cves.forEach(cve => {
            // 1. Quick String Match (Optimization)
            // If CVE vendor/product doesn't match asset, skip immediately
            if (!cve.vendor.toLowerCase().includes(assetVendor) && !cve.configurations.join(' ').toLowerCase().includes(assetVendor)) return;
            if (!cve.product.toLowerCase().includes(assetProduct) && !cve.configurations.join(' ').toLowerCase().includes(assetProduct)) return;

            let isMatch = false;
            let details = "";

            // If no version specified in asset, match purely on Vendor/Product presence
            if (!assetVersion || asset.version === 'Unknown') {
                // We check if the CVE configurations generally match the vendor/product.
                const configMatch = cve.configurations.some(c => c.includes(assetVendor) && c.includes(assetProduct));
                // Or description match
                const descMatch = cve.description.toLowerCase().includes(assetProduct);
                
                if (configMatch || descMatch) {
                    isMatch = true;
                    details = "Vendor/Product Match (Asset Version Unknown)";
                }
            } else {
                // 2. CPE Matching (Heuristic) with Version
                // We iterate through CVE configs looking for overlaps
                
                for (const config of cve.configurations) {
                    if (config.includes(assetVendor) && config.includes(assetProduct)) {
                        // Check if it contains the specific version
                        if (config.includes(assetVersion)) {
                            isMatch = true;
                            details = "Exact Version Match in CPE";
                            break;
                        }
                        
                        // Check for ranges in description (fallback if structured CPE parsing is limited)
                        // E.g., "versions prior to 9.0.1"
                        const desc = cve.description.toLowerCase();
                        if (desc.includes(`before ${assetVersion}`) || desc.includes(`prior to ${assetVersion}`) || desc.includes(`< ${assetVersion}`)) {
                             isMatch = true;
                             details = "Version Range Match (Description Analysis)";
                             break;
                        }
                    }
                }

                // 3. Fallback: Direct text match if confidence is high
                if (!isMatch && cve.description.toLowerCase().includes(assetProduct) && cve.description.includes(assetVersion)) {
                    isMatch = true;
                    details = "Textual Match in Description";
                }
            }

            if (isMatch) {
                const factors = [];
                if (cve.isKev) factors.push("CISA KEV");
                if (cve.hasExploit) factors.push("Public Exploit");
                if (cve.cvssScore >= 9.0) factors.push("Critical CVSS");
                if (asset.criticality === 'Critical') factors.push("Critical Asset");
                if (!assetVersion || asset.version === 'Unknown') factors.push("Broad Match (No Version)");

                matches.push({
                    assetId: asset.id,
                    cveId: cve.id,
                    cve: cve,
                    priorityScore: calculatePriority(cve, asset),
                    remediationStatus: 'OPEN',
                    matchDetails: details,
                    factors
                });
            }
        });
    });

    // Sort by Priority
    return matches.sort((a, b) => b.priorityScore - a.priorityScore);
};

