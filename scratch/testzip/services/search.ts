

import { CveEntry, AnalyzedHost, MalpediaActor, ThreatNewsItem, ExploitEntry } from "../types";
import { UnifiedIoc } from "./stixConverter";

export interface QueryFilter {
    key: string;
    operator: ':' | '>' | '<';
    value: string;
}

export interface SearchContext {
    type: 'KEY' | 'VALUE' | 'FREE';
    key?: string;
    filter?: string;
}

// Helper to parse a "lucene-like" string:  severity:high score:>8 vendor:"Microsoft Corp"
export const parseQueryString = (query: string): { filters: QueryFilter[], freeText: string } => {
    const filters: QueryFilter[] = [];
    let freeText = "";
    
    const regex = /(\w+)(:|>:|<:)(?:"([^"]+)"|([^\s]+))|(\S+)/g;
    
    let match;
    while ((match = regex.exec(query)) !== null) {
        if (match[1]) {
            const key = match[1].toLowerCase();
            const rawOperator = match[2];
            let operator: ':' | '>' | '<' = ':';

            if (rawOperator === '>:') operator = '>';
            else if (rawOperator === '<:') operator = '<';

            const value = match[3] || match[4]; 
            filters.push({ key, operator, value });
        } else if (match[5]) {
            freeText += (freeText ? " " : "") + match[5];
        }
    }

    return { filters, freeText: freeText.toLowerCase() };
};

export const getSearchContext = (query: string): SearchContext => {
    if (!query) return { type: 'KEY', filter: '' };
    
    const lastChar = query.slice(-1);
    if (lastChar === ' ') return { type: 'KEY', filter: '' };

    const tokens = query.split(' ');
    const lastToken = tokens[tokens.length - 1];
    
    // Regex to see if we are in a value part "key:val"
    const match = lastToken.match(/^([a-zA-Z0-9_]+):(.*)$/);
    if (match) {
        return { type: 'VALUE', key: match[1].toLowerCase(), filter: match[2].toLowerCase() };
    }
    
    return { type: 'KEY', filter: lastToken.toLowerCase() };
};

export const filterCve = (cve: CveEntry, filters: QueryFilter[], freeText: string): boolean => {
    if (freeText) {
        const textMatch = 
            cve.id.toLowerCase().includes(freeText) ||
            cve.description.toLowerCase().includes(freeText) ||
            cve.product.toLowerCase().includes(freeText) ||
            cve.vendor.toLowerCase().includes(freeText);
        if (!textMatch) return false;
    }

    for (const f of filters) {
        const key = f.key;
        const val = f.value.toLowerCase();
        let fieldVal: string | number | boolean | undefined;
        
        switch (key) {
            case 'severity': fieldVal = cve.severity.toLowerCase(); break;
            case 'score': fieldVal = cve.cvssScore; break;
            case 'vendor': fieldVal = cve.vendor.toLowerCase(); break;
            case 'product': fieldVal = cve.product.toLowerCase(); break;
            case 'cwe': fieldVal = cve.weaknesses.join(' ').toLowerCase(); break;
            case 'av': fieldVal = cve.vector.AV?.toLowerCase(); break;
            case 'exploit': fieldVal = cve.hasExploit; break;
            case 'kev': fieldVal = cve.isKev; break;
            default: continue; 
        }

        if (typeof fieldVal === 'number') {
            const numVal = parseFloat(val);
            if (isNaN(numVal)) continue;
            if (f.operator === '>' && !(fieldVal > numVal)) return false;
            if (f.operator === '<' && !(fieldVal < numVal)) return false;
            if (f.operator === ':' && fieldVal !== numVal) return false;
        } else if (typeof fieldVal === 'boolean') {
            const boolVal = val === 'true' || val === 'yes' || val === '1';
            if (fieldVal !== boolVal) return false;
        } else if (typeof fieldVal === 'string') {
            if (!fieldVal.includes(val)) return false;
        } else {
            return false;
        }
    }
    return true;
};

export const filterHost = (host: AnalyzedHost, filters: QueryFilter[], freeText: string): boolean => {
    if (freeText) {
        let textMatch = 
            host.ip.includes(freeText) ||
            host.country.toLowerCase().includes(freeText) ||
            (host.enrichmentData?.asn?.name && host.enrichmentData.asn.name.toLowerCase().includes(freeText)) ||
            (host.dnsHostname && host.dnsHostname.toLowerCase().includes(freeText)) ||
            host.signatures.some(sig => sig.name.toLowerCase().includes(freeText));
        
        if (!textMatch && host.otxData) {
            const otxStr = (host.otxData.malware_families.join(' ') + host.otxData.tags.join(' ') + host.otxData.adversaries.join(' ')).toLowerCase();
            if (otxStr.includes(freeText)) textMatch = true;
        }

        if (!textMatch && host.enrichmentData) {
            const jsonStr = JSON.stringify(host.enrichmentData).toLowerCase();
            if (jsonStr.includes(freeText)) textMatch = true;
        }
        if (!textMatch) return false;
    }

    for (const f of filters) {
        const key = f.key;
        const val = f.value.toLowerCase();
        let fieldVal: string | number | boolean | undefined;

        switch (key) {
            case 'ip': fieldVal = host.ip; break;
            case 'country': fieldVal = host.country.toLowerCase(); break;
            case 'score': fieldVal = host.totalScore; break;
            case 'risk': fieldVal = host.riskLevel.toLowerCase(); break;
            case 'asn': fieldVal = host.enrichmentData?.asn?.name.toLowerCase(); break;
            case 'rbl': fieldVal = host.rblStatus?.toLowerCase() || 'checking'; break;
            case 'sig': fieldVal = host.signatures.map(s => s.name).join(' ').toLowerCase(); break;
            case 'mitre': fieldVal = host.signatures.map(s => s.mitreTactic).join(' ').toLowerCase(); break;
            case 'days': fieldVal = host.activeDays; break;
            case 'urlhaus': fieldVal = host.isUrlHaus; break;
            // OTX Filters
            case 'malware': fieldVal = host.otxData?.malware_families.join(' ').toLowerCase() || ''; break;
            case 'adversary': fieldVal = host.otxData?.adversaries.join(' ').toLowerCase() || ''; break;
            case 'tag': fieldVal = host.otxData?.tags.join(' ').toLowerCase() || ''; break;
            case 'industry': fieldVal = host.otxData?.industries.join(' ').toLowerCase() || ''; break;
            default: continue;
        }

        if (typeof fieldVal === 'number') {
            const numVal = parseFloat(val);
            if (isNaN(numVal)) continue;
            if (f.operator === '>' && !(fieldVal > numVal)) return false;
            if (f.operator === '<' && !(fieldVal < numVal)) return false;
            if (f.operator === ':' && fieldVal !== numVal) return false;
        } else if (typeof fieldVal === 'boolean') {
            const boolVal = val === 'true' || val === 'yes' || val === '1';
            if (fieldVal !== boolVal) return false;
        } else if (typeof fieldVal === 'string') {
            if (!fieldVal.includes(val)) return false;
        } else {
            return false;
        }
    }
    return true;
};

export const filterActor = (actor: MalpediaActor, filters: QueryFilter[], freeText: string): boolean => {
    if (freeText) {
        const textMatch = 
            actor.value.toLowerCase().includes(freeText) ||
            actor.description.toLowerCase().includes(freeText) ||
            (actor.meta.country && actor.meta.country.toLowerCase().includes(freeText));
        if (!textMatch) return false;
    }

    for (const f of filters) {
        const key = f.key;
        const val = f.value.toLowerCase();
        let fieldVal: string | number | undefined;

        switch (key) {
            case 'name': fieldVal = actor.value.toLowerCase(); break;
            case 'country': fieldVal = actor.meta.country?.toLowerCase(); break;
            case 'score': fieldVal = actor.threatScore; break;
            case 'sophistication': fieldVal = actor.sophistication.toLowerCase(); break;
            case 'source': fieldVal = actor.source?.toLowerCase(); break;
            case 'malware': fieldVal = actor.malwareFamilies?.join(' ').toLowerCase(); break;
            case 'mitre': fieldVal = actor.mitreIds?.join(' ').toLowerCase(); break;
            default: continue;
        }

        if (typeof fieldVal === 'number') {
            const numVal = parseFloat(val);
            if (isNaN(numVal)) continue;
            if (f.operator === '>' && !(fieldVal > numVal)) return false;
            if (f.operator === '<' && !(fieldVal < numVal)) return false;
            if (f.operator === ':' && fieldVal !== numVal) return false;
        } else if (typeof fieldVal === 'string') {
            if (!fieldVal.includes(val)) return false;
        } else {
            return false;
        }
    }
    return true;
};

export const filterNews = (item: ThreatNewsItem, filters: QueryFilter[], freeText: string): boolean => {
    if (freeText) {
        const textMatch = 
            item.title.toLowerCase().includes(freeText) ||
            item.description.toLowerCase().includes(freeText) ||
            item.source.toLowerCase().includes(freeText);
        if (!textMatch) return false;
    }

    for (const f of filters) {
        const key = f.key;
        const val = f.value.toLowerCase();
        let fieldVal: string | undefined;

        switch (key) {
            case 'source': fieldVal = item.source.toLowerCase(); break;
            case 'category': fieldVal = item.category.toLowerCase(); break;
            case 'title': fieldVal = item.title.toLowerCase(); break;
            default: continue;
        }

        if (typeof fieldVal === 'string') {
            if (!fieldVal.includes(val)) return false;
        } else {
            return false;
        }
    }
    return true;
};

export const filterExploit = (exploit: ExploitEntry, filters: QueryFilter[], freeText: string, cveContext?: CveEntry): boolean => {
    if (freeText) {
        const textMatch = 
            exploit.cveId.toLowerCase().includes(freeText) ||
            exploit.description.toLowerCase().includes(freeText) ||
            exploit.link.toLowerCase().includes(freeText) ||
            (cveContext && (
                cveContext.product.toLowerCase().includes(freeText) ||
                cveContext.vendor.toLowerCase().includes(freeText)
            ));
        if (!textMatch) return false;
    }

    for (const f of filters) {
        const key = f.key;
        const val = f.value.toLowerCase();
        
        // Date Comparison Logic
        if (key === 'date') {
             if (f.operator === '>' || f.operator === '<') {
                 const eTime = new Date(exploit.timestamp).getTime();
                 const fTime = new Date(val).getTime();
                 if (!isNaN(fTime)) {
                     if (f.operator === '>' && !(eTime > fTime)) return false;
                     if (f.operator === '<' && !(eTime < fTime)) return false;
                     continue; 
                 }
             }
        }

        let fieldVal: string | number | boolean | undefined;

        switch (key) {
            case 'cve': fieldVal = exploit.cveId.toLowerCase(); break;
            case 'desc': fieldVal = exploit.description.toLowerCase(); break;
            case 'source': fieldVal = exploit.link.includes('github') ? 'github' : 'other'; break;
            case 'date': fieldVal = exploit.timestamp.split('T')[0]; break;
            case 'product': fieldVal = cveContext?.product.toLowerCase(); break;
            case 'vendor': fieldVal = cveContext?.vendor.toLowerCase(); break;
            case 'score': fieldVal = cveContext?.cvssScore; break;
            case 'kev': fieldVal = cveContext?.isKev; break;
            case 'verified': fieldVal = cveContext?.hasExploit; break; // Maps to 'Has Exploit' tag in NVD
            default: continue;
        }

        if (fieldVal === undefined) return false; // Filter key exists but data is missing

        if (typeof fieldVal === 'string') {
            if (!fieldVal.includes(val)) return false;
        } else if (typeof fieldVal === 'number') {
            const numVal = parseFloat(val);
            if (isNaN(numVal)) continue;
            if (f.operator === '>' && !(fieldVal > numVal)) return false;
            if (f.operator === '<' && !(fieldVal < numVal)) return false;
            if (f.operator === ':' && fieldVal !== numVal) return false;
        } else if (typeof fieldVal === 'boolean') {
            const boolVal = val === 'true' || val === 'yes' || val === '1';
            if (fieldVal !== boolVal) return false;
        } else {
            return false;
        }
    }
    return true;
};

export const filterIoc = (ioc: UnifiedIoc, filters: QueryFilter[], freeText: string): boolean => {
    if (freeText) {
        const textMatch = 
            ioc.value.toLowerCase().includes(freeText) ||
            ioc.threat.toLowerCase().includes(freeText) ||
            (ioc.country && ioc.country.toLowerCase().includes(freeText)) ||
            (ioc.tags && ioc.tags.some(t => t.toLowerCase().includes(freeText)));
        if (!textMatch) return false;
    }

    for (const f of filters) {
        const key = f.key;
        const val = f.value.toLowerCase();
        let fieldVal: string | undefined;

        switch (key) {
            case 'tag':
                 // Special handling for array
                 if (!ioc.tags || !ioc.tags.some(t => t.toLowerCase().includes(val))) return false;
                 continue;
            case 'country': fieldVal = ioc.country?.toLowerCase(); break;
            case 'threat': fieldVal = ioc.threat.toLowerCase(); break;
            case 'source': fieldVal = ioc.source.toLowerCase(); break;
            case 'type': fieldVal = ioc.type.toLowerCase(); break;
            case 'val':
            case 'value': fieldVal = ioc.value.toLowerCase(); break;
            default: continue; 
        }

        if (typeof fieldVal === 'string') {
            if (!fieldVal.includes(val)) return false;
        } else {
            return false;
        }
    }
    return true;
};

