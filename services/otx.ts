

import { OtxAnalysis, OtxPulse } from '../types';
import { fetchJsonWithCors } from './http';
import { WhoisResult } from './netTools';

const BASE_URL = 'https://otx.alienvault.com/api/v1/indicators';

// Normalize indicator types to OTX format
const getOtxType = (value: string): string | null => {
    if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(value)) return 'IPv4';
    if (value.includes(':')) return 'IPv6';
    if (/^[a-fA-F0-9]{32}$/.test(value)) return 'file'; // MD5
    if (/^[a-fA-F0-9]{40}$/.test(value)) return 'file'; // SHA1
    if (/^[a-fA-F0-9]{64}$/.test(value)) return 'file'; // SHA256
    if (value.includes('://') || value.includes('/')) return 'url';
    if (value.includes('.')) return 'domain';
    return 'domain'; // Fallback to domain as general hostname/domain handler
};

// Normalize tags to remove duplicates and inconsistencies
const normalizeTag = (tag: string): string => {
    let t = tag.toLowerCase().trim();
    
    // Canonical mappings based on common threat intel patterns
    if (t === 'bruteforce' || t === 'brute-force' || t === 'brute force') return 'bruteforce';
    if (t === 'ssh' || t === 'ssh1' || t === 'ssh2' || t === 'secure-shell' || t === 'ssh-scanner') return 'ssh';
    if (t.startsWith('sftp')) return 'sftp'; // sftp-bruteforce -> sftp
    if (t === 'ftp-bruteforce') return 'ftp';
    if (t === 'malicious' || t === 'malicious-ip') return 'malicious';
    if (t === 'scanner' || t === 'scanning' || t === 'port-scanner') return 'scanner';
    if (t === 'botnet' || t === 'bot') return 'botnet';
    if (t === 'spam' || t === 'spammer') return 'spam';
    if (t === 'phishing' || t === 'phish') return 'phishing';
    if (t === 'c2' || t === 'command-and-control') return 'c2';
    if (t === 'ransomware' || t === 'ransom') return 'ransomware';
    
    // Consolidate honeypot related tags
    if (['cowrie', 'dionaea', 'fatt', 'heralding', 'honeypot', 'glastopf', 'kippo', 'conpot', 'amun', 'rdpy', 'elasticpot'].includes(t)) return 'honeypot';
    
    return t;
};

export const fetchOtxIndicator = async (value: string): Promise<OtxAnalysis | null> => {
    const type = getOtxType(value);
    if (!type) return null;

    // OTX API Endpoint: /indicators/{type}/{indicator}/general
    const endpoint = `${BASE_URL}/${type}/${encodeURIComponent(value)}/general`;

    try {
        const data = await fetchJsonWithCors<any>(endpoint);
        
        if (!data) return null;

        // Extract Pulses
        const pulses: OtxPulse[] = [];
        const rawPulses = data.pulse_info?.pulses || [];

        rawPulses.forEach((p: any) => {
            pulses.push({
                id: p.id,
                name: p.name || 'Unknown Pulse',
                description: p.description || '',
                tags: p.tags || [],
                malware_families: p.malware_families?.map((m: any) => m.display_name || m) || [],
                adversary: p.adversary || '',
                industries: p.industries || [],
                attack_ids: p.attack_ids?.map((a: any) => a.display_name || a) || [],
                created: p.created,
                author_name: p.author?.username || 'Unknown',
                targeted_countries: p.targeted_countries || [],
                modified: p.modified,
                TLP: p.TLP,
                upvotes_count: p.upvotes_count,
                downvotes_count: p.downvotes_count,
                votes_count: p.votes_count
            });
        });

        // Aggregate Lists with Normalization
        const tags = new Set<string>();
        const malware_families = new Set<string>();
        const adversaries = new Set<string>();
        const industries = new Set<string>();
        const attack_ids = new Set<string>();
        const targeted_countries = new Set<string>();

        pulses.forEach(p => {
            p.tags.forEach(t => {
                const clean = normalizeTag(t);
                // Strict Filter: Must be purely alphabetic (a-z), no numbers, no symbols, length > 2
                if (clean && /^[a-z]+$/.test(clean) && clean.length > 2) {
                    tags.add(clean);
                }
            });
            
            p.malware_families.forEach(m => {
                // Malware names are usually specific, keep original casing if possible or just trim
                if(m) malware_families.add(m.trim());
            });
            
            if (p.adversary) adversaries.add(p.adversary.trim());
            p.industries.forEach(i => industries.add(i.trim()));
            p.attack_ids.forEach(a => attack_ids.add(a));
            p.targeted_countries?.forEach(c => targeted_countries.add(c));
        });

        return {
            reputation: data.reputation || 0,
            pulse_count: data.pulse_info?.count || 0,
            tags: Array.from(tags).sort(),
            malware_families: Array.from(malware_families).sort(),
            adversaries: Array.from(adversaries).sort(),
            industries: Array.from(industries).sort(),
            attack_ids: Array.from(attack_ids).sort(),
            pulses: pulses,
            targeted_countries: Array.from(targeted_countries).sort()
        };

    } catch (e) {
        // console.warn(`OTX fetch failed for ${value}`, e);
        return null;
    }
};

export const fetchOtxWhois = async (domain: string): Promise<WhoisResult | null> => {
    const url = `${BASE_URL}/domain/${encodeURIComponent(domain)}/whois`;
    try {
        const data = await fetchJsonWithCors<any>(url);
        // OTX structure: { data: [ {key: "...", value: "..."}, ... ], count: 19, related: [...] }
        if (!data || !data.data || !Array.isArray(data.data)) return null;

        const getValue = (k: string) => {
            // Some keys might have spaces or special chars in the response data array
            const item = data.data.find((i: any) => i.key === k || i.key === k.trim());
            return item ? item.value : null;
        };

        const registrar = getValue('registrar') || 'Unknown';
        const creationDate = getValue('creation_date');
        const updatedDate = getValue('updated_date');
        const expirationDate = getValue('expiration_date');
        const registrantName = getValue('registrant_name') || 'Unknown';
        
        // Construct address from available fields
        const address = [];
        if (getValue('registrant_city')) address.push(getValue('registrant_city'));
        if (getValue('registrant_state_province')) address.push(getValue('registrant_state_province'));
        if (getValue('registrant_country')) address.push(getValue('registrant_country'));

        // Handle events
        const events = [];
        if (creationDate) events.push({ eventAction: 'registration', eventDate: creationDate });
        if (updatedDate) events.push({ eventAction: 'last changed', eventDate: updatedDate });
        if (expirationDate) events.push({ eventAction: 'expiration', eventDate: expirationDate });

        return {
            handle: domain,
            name: registrantName,
            org: registrar,
            address: address,
            registrationDate: creationDate ? new Date(creationDate).toLocaleDateString() : 'Unknown',
            lastChangedDate: updatedDate ? new Date(updatedDate).toLocaleDateString() : 'Unknown',
            entities: [], // OTX generic whois doesn't provide structured entities like RDAP
            events: events,
            raw: data // Store full response to allow extraction of other keys if needed
        };
    } catch (e) {
        return null;
    }
};