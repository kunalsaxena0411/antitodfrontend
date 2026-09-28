import { WhitelistEntry } from '../types';

const ipToLong = (ip: string): number => {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
};

const isIpInCidr = (ip: string, cidr: string): boolean => {
    try {
        const [range, bits] = cidr.split('/');
        const mask = ~((1 << (32 - parseInt(bits, 10))) - 1);
        return (ipToLong(ip) & mask) === (ipToLong(range) & mask);
    } catch(e) { return false; }
};

export const isWhitelisted = (target: string, whitelist: WhitelistEntry[]): boolean => {
    if (!target) return false;
    
    // Safe cast to string to prevent "t.toLowerCase is not a function" if target is number/obj
    const strTarget = String(target);
    
    // Normalize target to lower case for consistent matching
    const t = strTarget.trim().toLowerCase();
    
    for (const entry of whitelist) {
        if (!entry.value) continue;
        const val = String(entry.value).trim().toLowerCase();

        if (entry.type === 'IP') {
            if (t === val) return true;
        }
        else if (entry.type === 'CIDR') {
            // Check if target is IP and matches CIDR
            if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(t)) {
                if (isIpInCidr(t, entry.value)) return true;
            }
        }
        else if (entry.type === 'DOMAIN') {
            // Match exact domain or subdomain
            if (t === val || t.endsWith('.' + val)) return true;
        }
        else if (entry.type === 'URL') {
            // Check if target contains the whitelisted URL pattern
            if (t.includes(val)) return true;
        }
    }
    return false;
};
