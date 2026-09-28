
import { IpDataResponse } from '../types';
import { SecurityCheckResult } from './dns';
import { HttpHeaderResult, WhoisResult } from './netTools';

export interface RiskAnalysis {
    score: number;
    level: 'CLEAN' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    factors: { label: string; impact: number; type: 'POSITIVE' | 'NEGATIVE' | 'INFO' }[];
    verdict: string;
}

const WHITELIST_DOMAINS = [
    'google.com', 'www.google.com', 'gstatic.com', 'googleapis.com', 'googleusercontent.com',
    'microsoft.com', 'www.microsoft.com', 'azure.com', 'windows.net', 'live.com', 'office.com',
    'apple.com', 'www.apple.com', 'icloud.com', 'cdn-apple.com',
    'amazon.com', 'www.amazon.com', 'amazonaws.com', 'ssl-images-amazon.com',
    'github.com', 'www.github.com', 'githubusercontent.com',
    'cloudflare.com', 'www.cloudflare.com', 'cloudflare.net',
    'facebook.com', 'www.facebook.com', 'fbcdn.net',
    'twitter.com', 'x.com', 'twimg.com',
    'linkedin.com', 'www.linkedin.com', 'licdn.com',
    'wikipedia.org', 'www.wikipedia.org',
    'instagram.com', 'whatsapp.com',
    'netflix.com', 'nflxso.net',
    'adobe.com', 'dropbox.com'
];

const cleanTarget = (input: string): string => {
    try {
        let domain = input.trim().toLowerCase();
        if (domain.startsWith('http://') || domain.startsWith('https://')) {
            domain = new URL(domain).hostname;
        }
        return domain.replace(/\/$/, '');
    } catch {
        return input.trim().toLowerCase();
    }
};

export const calculateCompositeRisk = (
    target: string,
    ipData: IpDataResponse | null,
    security: SecurityCheckResult[],
    http: HttpHeaderResult | null,
    whois: WhoisResult | null
): RiskAnalysis => {
    let score = 0;
    const factors: RiskAnalysis['factors'] = [];
    const domain = cleanTarget(target);

    // 1. Whitelist Check (Immediate Exit for Trusted)
    const isWhitelisted = WHITELIST_DOMAINS.some(w => domain === w || domain.endsWith('.' + w));
    
    if (isWhitelisted) {
        return {
            score: 0,
            level: 'CLEAN',
            factors: [{ label: 'Trusted High-Traffic Infrastructure (Whitelist)', impact: 0, type: 'POSITIVE' }],
            verdict: 'Safe (Trusted)'
        };
    }

    // 2. Threat Intelligence (DNS/RBL)
    // Only penalize for MALWARE or PHISHING blocks. Ignore 'FAMILY' or 'ADS' unless mass blocking occurs.
    const malwareBlocks = security.filter(s => s.status === 'BLOCKED' && s.filterType === 'MALWARE');
    const otherBlocks = security.filter(s => s.status === 'BLOCKED' && s.filterType !== 'MALWARE');

    if (malwareBlocks.length > 0) {
        const impact = 60 + (malwareBlocks.length * 10);
        score += impact;
        factors.push({ label: `Flagged by ${malwareBlocks.length} Malware Feeds`, impact, type: 'NEGATIVE' });
        malwareBlocks.forEach(b => {
            if (b.details) factors.push({ label: `${b.provider}: ${b.details}`, impact: 0, type: 'INFO' });
        });
    }

    // Minor penalty for non-malware blocks (e.g. gambling/adult content filters)
    if (otherBlocks.length > 0) {
        factors.push({ label: `Flagged by ${otherBlocks.length} Content Filters`, impact: 5, type: 'INFO' });
    }

    // 3. IP Reputation
    if (ipData?.threat) {
        if (ipData.threat.is_known_attacker) {
            score += 50;
            factors.push({ label: 'IP flagged as Known Attacker', impact: 50, type: 'NEGATIVE' });
        }
        if (ipData.threat.is_bot) {
            score += 40;
            factors.push({ label: 'IP flagged as Botnet', impact: 40, type: 'NEGATIVE' });
        }
        if (ipData.threat.is_tor) {
            score += 20;
            factors.push({ label: 'Tor Exit Node', impact: 20, type: 'NEGATIVE' });
        }
        
        // Base score from provider (capped contribution)
        if (ipData.threat.scores?.threat_score) {
            const providerScore = ipData.threat.scores.threat_score;
            if (providerScore > 80) {
                score += 20;
                factors.push({ label: `High Reputation Risk Score (${providerScore})`, impact: 20, type: 'NEGATIVE' });
            }
        }
    }

    // 4. Domain Age (Whois)
    if (whois?.registrationDate && whois.registrationDate !== 'Unknown') {
        const regDate = new Date(whois.registrationDate);
        const ageDays = (Date.now() - regDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (ageDays < 5) {
            score += 40;
            factors.push({ label: 'Newly Registered Domain (< 5 days)', impact: 40, type: 'NEGATIVE' });
        } else if (ageDays < 30) {
            score += 15;
            factors.push({ label: 'Recently Registered Domain (< 30 days)', impact: 15, type: 'NEGATIVE' });
        } else if (ageDays > 365) {
            score = Math.max(0, score - 10);
            factors.push({ label: `Established Domain (> 1 year)`, impact: -10, type: 'POSITIVE' });
        }
    }

    // 5. HTTP Security (Only penalize if content was actually retrieved)
    if (http && http.status > 0) {
        const missingHeaders = http.security.filter(h => !h.valid).length;
        if (missingHeaders > 5) {
            score += 5;
            factors.push({ label: 'Weak Security Posture (Headers)', impact: 5, type: 'INFO' });
        } else if (missingHeaders <= 2) {
            score = Math.max(0, score - 5);
            factors.push({ label: 'Strong Security Headers', impact: -5, type: 'POSITIVE' });
        }
    }

    // 6. Hosting Logic
    if (ipData?.threat?.is_datacenter && !ipData.asn?.name.includes('Cloudflare') && !ipData.asn?.name.includes('Google') && !ipData.asn?.name.includes('Amazon')) {
        // Datacenter hosting is normal for big tech, but suspicious for "banks" or "login pages"
        // Context is hard to guess, but we can flag generic cheap hosting
        // factors.push({ label: 'Hosted on Datacenter Infrastructure', impact: 0, type: 'INFO' });
    }

    // Cap Score
    score = Math.min(100, Math.max(0, score));

    // Determine Level
    let level: RiskAnalysis['level'] = 'CLEAN';
    if (score >= 90) level = 'CRITICAL';
    else if (score >= 70) level = 'HIGH';
    else if (score >= 40) level = 'MEDIUM';
    else if (score >= 10) level = 'LOW';

    let verdict = 'Safe';
    if (level === 'CRITICAL') verdict = 'Malicious';
    else if (level === 'HIGH') verdict = 'High Risk';
    else if (level === 'MEDIUM') verdict = 'Suspicious';
    else if (level === 'LOW') verdict = 'Low Risk';

    return { score, level, factors, verdict };
};

