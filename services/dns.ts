
import { IpDataResponse, ExtendedSecurityInfo, DnsBlockResult, ShodanData } from '../types';
import { IPDATA_API_KEY } from '../config/config';
import { Buffer } from 'buffer';

if (typeof window !== 'undefined' && !(window as any).Buffer) {
    (window as any).Buffer = Buffer;
}

const BASE_URL = 'https://api.ipdata.co';

// --- DGA ANALYSIS DATA ---

// Relative frequency of characters in top 1M domains (Normalized)
const BENIGN_CHAR_FREQ: Record<string, number> = {
    'a': 0.08, 'b': 0.01, 'c': 0.03, 'd': 0.03, 'e': 0.11, 'f': 0.01, 'g': 0.02, 'h': 0.04,
    'i': 0.07, 'j': 0.00, 'k': 0.01, 'l': 0.04, 'm': 0.03, 'n': 0.07, 'o': 0.08, 'p': 0.02,
    'q': 0.00, 'r': 0.06, 's': 0.06, 't': 0.09, 'u': 0.03, 'v': 0.01, 'w': 0.01, 'x': 0.00,
    'y': 0.02, 'z': 0.00, '0': 0.01, '1': 0.01, '2': 0.01, '3': 0.01, '4': 0.01, '5': 0.01,
    '6': 0.01, '7': 0.01, '8': 0.01, '9': 0.01, '-': 0.01
};

// Common Bigrams in benign domains (Top 50 transition pairs)
const BENIGN_BIGRAMS = new Set([
    'th', 'he', 'in', 'er', 'an', 're', 'on', 'at', 'en', 'nd', 'ti', 'es', 'or', 'te', 'ed', 
    'is', 'it', 'al', 'as', 'st', 'to', 'nt', 'ng', 'se', 'ha', 'ou', 'io', 'le', 've', 'co', 
    'me', 'de', 'hi', 'ri', 'ro', 'ic', 'ne', 'ea', 'ra', 'ce', 'li', 'ch', 'll', 'be', 'ma', 
    'st', 'ar', 'of', 'wi', 'wa'
]);

// Blocklist.de Return Code Mapping
const BLOCKLIST_DE_MAP: Record<string, string> = {
    '127.0.0.2': 'Amavis',
    '127.0.0.3': 'Apache DDoS',
    '127.0.0.4': 'Asterisk',
    '127.0.0.5': 'BadBot',
    '127.0.0.6': 'FTP',
    '127.0.0.7': 'IMAP',
    '127.0.0.8': 'IRC Bot',
    '127.0.0.9': 'Mail',
    '127.0.0.10': 'POP3',
    '127.0.0.11': 'RegBot',
    '127.0.0.12': 'RFI Attack',
    '127.0.0.13': 'SASL',
    '127.0.0.14': 'SSH',
    '127.0.0.15': 'w00tw00t',
    '127.0.0.16': 'Port Flood',
    '127.0.0.17': 'SQL Injection',
    '127.0.0.18': 'Webmin',
    '127.0.0.19': 'Trigger Spam',
    '127.0.0.20': 'Manual',
    '127.0.0.21': 'BruteForce Login',
    '127.0.0.22': 'MySQL'
};

// Extended RBL List for IP checks (Comprehensive Suite)
const RBL_DOMAINS = [
  'zen.spamhaus.org',         
  'drop.spamhaus.org',        
  'bl.spamcop.net',           
  'dnsbl.sorbs.net',          
  'ivmSIP.invaluement.com',   
  'ivmSIP24.invaluement.com', 
  'ivmTDR.invaluement.com',   
  'b.barracudacentral.org',   
  'ix.dnsbl.manitu.net',      
  'cbl.abuseat.org',
  'spam.dnsbl.sorbs.net',
  'dnsbl-1.uceprotect.net',
  'db.wpbl.info',             
  'psbl.surriel.com',         
  'bl.blocklist.de',          
  'all.bl.blocklist.de',
  'ssh.bl.blocklist.de',
  'mail.bl.blocklist.de',
  'apache.bl.blocklist.de',
  'imap.bl.blocklist.de',
  'ftp.bl.blocklist.de',
  'sip.bl.blocklist.de',
  'bruteforcelogin.bl.blocklist.de',
  'all.s5h.net',              
  'rbl.interserver.net',      
  'virbl.dnsbl.bit.nl',       
  'dnsbl.dronebl.org',        
  'hostkarma.junkemailfilter.com', 
  'spam.dnsbl.anonmails.de',       
  'ubl.unsubscore.com',            
  'all.spamrats.com',              
  'fresh.spameatingmonkey.net',    
  'fresh10.spameatingmonkey.net',  
  'fresh15.spameatingmonkey.net',  
  'fresh30.spameatingmonkey.net',  
  'bl.rspamd.com'                  
];

const DOMAIN_BLOCKLISTS = [
    'dbl.spamhaus.org',
    'multi.surbl.org',
    'black.uribl.com',
    'grey.uribl.com',
    'red.uribl.com',
    'multi.uribl.com',
    'uribl.mailcleaner.net',
    'uribl.spameatingmonkey.net',
    'urired.spameatingmonkey.net',
    'uribl.rspamd.com',
    'black.dnsbl.brukalai.lt',
    'uribl.pofon.foobar.hu',
    'uribl.swinog.ch',
    'uri.blacklist.woody.ch',
    'dob.sibl.support-intelligence.net',
    'rhsbl.sorbs.net',
    'rhsbl.abuseat.org',
    'rhsbl.rbl.polspam.pl',
    'rhsbl-h.rbl.polspam.pl',
    'rhsbl.rymsho.ru',
    'rhsbl.zapbl.net',
    'dnsbl.spfbl.net'
];

// Proxy Rotation for Binary DNS (DoH GET params)
const PROXIES = [
    (url: string) => url, // Direct DoH support
    (url: string) => `/api/proxy?url=${encodeURIComponent(url)}`, // Vercel
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`
];

export interface DetailedDnsRecord {
    type: string;
    name: string;
    ttl: number;
    data: string;
    provider: string;
}

export interface DnsProviderConfig {
    id: string;
    name: string;
    url: string;
    type: 'JSON' | 'BINARY';
    category?: string; 
    filterType: 'MALWARE' | 'ADS' | 'FAMILY' | 'GENERAL'; 
}

export interface DgaResult {
    isDga: boolean;
    score: number;
    entropy: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    flags: string[];
}

export interface SecurityCheckResult {
    provider: string;
    status: 'BLOCKED' | 'CLEAN' | 'FAILED';
    type: 'RBL' | 'DNS_FILTER';
    filterType?: 'MALWARE' | 'ADS' | 'FAMILY' | 'GENERAL';
    details?: string;
}

export const EXTENDED_DNS_PROVIDERS: DnsProviderConfig[] = [
    { id: 'cloudflare', name: 'Cloudflare', url: 'https://cloudflare-dns.com/dns-query', type: 'JSON', filterType: 'GENERAL' },
    { id: 'google', name: 'Google DNS', url: 'https://dns.google/resolve', type: 'JSON', filterType: 'GENERAL' },
    { id: 'quad9', name: 'Quad9', url: 'https://dns.quad9.net/dns-query', type: 'JSON', filterType: 'MALWARE' },
    { id: 'cloudflare_security', name: 'Cloudflare Security', url: 'https://security.cloudflare-dns.com/dns-query', type: 'JSON', filterType: 'MALWARE' },
    { id: 'dns0', name: 'DNS0.eu', url: 'https://zero.dns0.eu/dns-query', type: 'BINARY', filterType: 'MALWARE' },
    { id: 'cira', name: 'CIRA Shield', url: 'https://protected.canadianshield.cira.ca/dns-query', type: 'BINARY', filterType: 'MALWARE' }
];

export const DNS_RECORD_TYPES = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME', 'SOA', 'CAA', 'PTR'];

export const fetchShodanInternetDb = async (ip: string): Promise<ShodanData | undefined> => {
    try {
        const res = await fetch(`https://internetdb.shodan.io/${ip}`);
        if (res.ok) {
            return await res.json();
        }
    } catch (e) {
    }
    return undefined;
};

export const enrichIP = async (ip: string): Promise<IpDataResponse | null> => {
  try {
    if (isPrivateIP(ip)) {
        return null;
    }

    if (!IPDATA_API_KEY) return null;
    const url = `${BASE_URL}/${ip}?api-key=${IPDATA_API_KEY}`;

    const [ipDataResponse, shodanData] = await Promise.all([
        fetch(url),
        fetchShodanInternetDb(ip)
    ]);

    if (!ipDataResponse.ok) {
        return null;
    }

    const data = await ipDataResponse.json();

    return {
        ip: data.ip,
        is_eu: data.is_eu,
        city: data.city || null,
        region: data.region || null,
        region_code: data.region_code || null,
        region_type: data.region_type || null,
        country_name: data.country_name || 'Unknown',
        country_code: data.country_code || 'XX',
        continent_name: data.continent_name || null,
        continent_code: data.continent_code || null,
        latitude: data.latitude,
        longitude: data.longitude,
        postal: data.postal || null,
        calling_code: data.calling_code || null,
        flag: data.flag || null,
        emoji_flag: data.emoji_flag || null,
        emoji_unicode: data.emoji_unicode || null,
        asn: data.asn ? {
            asn: data.asn.asn,
            name: data.asn.name,
            domain: data.asn.domain || null,
            route: data.asn.route,
            type: data.asn.type || 'isp'
        } : undefined,
        company: data.company ? {
            name: data.company.name,
            domain: data.company.domain || null,
            type: data.company.type,
            network: data.company.network
        } : undefined,
        carrier: data.carrier ? {
            name: data.carrier.name,
            mcc: data.carrier.mcc,
            mnc: data.carrier.mnc
        } : undefined,
        time_zone: data.time_zone ? {
            name: data.time_zone.name || null,
            abbr: data.time_zone.abbr || null,
            offset: data.time_zone.offset || null,
            is_dst: data.time_zone.is_dst || null,
            current_time: data.time_zone.current_time || null
        } : undefined,
        currency: data.currency ? {
            name: data.currency.name,
            code: data.currency.code,
            symbol: data.currency.symbol,
            native: data.currency.native,
            plural: data.currency.plural
        } : undefined,
        languages: data.languages || [],
        count: data.count,
        threat: {
            is_tor: data.threat?.is_tor || false,
            is_vpn: data.threat?.is_vpn || false,
            is_icloud_relay: data.threat?.is_icloud_relay || false,
            is_proxy: data.threat?.is_proxy || false,
            is_datacenter: data.threat?.is_datacenter || false,
            is_anonymous: data.threat?.is_anonymous || false,
            is_known_attacker: data.threat?.is_known_attacker || false,
            is_known_abuser: data.threat?.is_known_abuser || false,
            is_bot: data.threat?.is_bot || false,
            is_threat: data.threat?.is_threat || false,
            is_bogon: data.threat?.is_bogon || false,
            blocklists: data.threat?.blocklists || [],
            scores: data.threat?.scores
        },
        shodan: shodanData
    };

  } catch (error) {
    return null;
  }
};

export const queryDoH = async (name: string, type: string = 'A'): Promise<any> => {
    const endpoints = [
        `https://dns.google/resolve?name=${name}&type=${type}`,
        `https://cloudflare-dns.com/dns-query?name=${name}&type=${type}`
    ];

    for (const url of endpoints) {
        try {
            const res = await fetch(url, {
                headers: { 'Accept': 'application/dns-json' }
            });
            if (res.ok) {
                return await res.json();
            }
        } catch (e) {
            continue;
        }
    }
    return null;
};

const isPrivateIP = (ip: string): boolean => {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) return false;
    if (parts[0] === 10) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 127) return true;
    return false;
};

export const resolveHostname = async (ip: string): Promise<string | null> => {
  if (isPrivateIP(ip)) return null;
  try {
      const reversedIp = ip.split('.').reverse().join('.');
      const data = await queryDoH(`${reversedIp}.in-addr.arpa`, 'PTR');
      if (data?.Status === 0 && data.Answer && data.Answer.length > 0) {
           let hostname = data.Answer[0].data;
           if (hostname.endsWith('.')) hostname = hostname.slice(0, -1);
           return hostname;
      }
      return null;
  } catch (e) {
      return null;
  }
};

export const checkRBL = async (ip: string): Promise<{ status: 'CLEAN' | 'LISTED' | 'FAILED', listedIn: string[] }> => {
   if (isPrivateIP(ip)) return { status: 'CLEAN', listedIn: [] };
   const reversedIp = ip.split('.').reverse().join('.');
   const listedIn: string[] = [];
   try {
       const results = await Promise.all(RBL_DOMAINS.map(async (domain) => {
           try {
               const lookup = `${reversedIp}.${domain}`;
               const data = await queryDoH(lookup, 'A');
               
               let isListed = false;
               if (data?.Status === 0 && data.Answer && data.Answer.length > 0) {
                   const resultIp = data.Answer[0].data;
                   if (!resultIp.startsWith('127.255.255.')) {
                       isListed = true;
                   }
                   if (domain.includes('hostkarma') && resultIp === '127.0.0.1') {
                       isListed = false;
                   }
                   if (isListed && (domain === 'all.bl.blocklist.de' || domain === 'bl.blocklist.de') && BLOCKLIST_DE_MAP[resultIp]) {
                       return { domain: `${domain} (${BLOCKLIST_DE_MAP[resultIp]})`, isListed: true };
                   }
               }
               return { domain, isListed };
           } catch (e) {
               return { domain, isListed: false };
           }
       }));
       results.forEach(r => { if (r.isListed) listedIn.push(r.domain); });
       return { status: listedIn.length > 0 ? 'LISTED' : 'CLEAN', listedIn };
   } catch (error) {
       return { status: 'FAILED', listedIn: [] };
   }
};

/**
 * Advanced DGA Detection Engine
 * Uses a combination of:
 * 1. Shannon Entropy (Randomness measurement)
 * 2. Bigram Analysis (Character transition probabilities)
 * 3. KL Divergence (Statistical distribution distance from normal English/Web patterns)
 * 4. Structural Heuristics (Consonant clusters, numeric density, length)
 */
export const analyzeDga = (domain: string): DgaResult => {
    const rawDomain = domain.toLowerCase();
    const parts = rawDomain.split('.');
    
    // Extract the most significant part (the label before the TLD)
    const commonTlds = ['com', 'net', 'org', 'io', 'co', 'uk', 'us', 'gov', 'edu', 'info', 'biz', 'online', 'xyz', 'top', 'win', 'icu'];
    const candidateParts = parts.filter(p => !commonTlds.includes(p));
    // Usually the longest part in a DGA is the target
    const core = candidateParts.sort((a, b) => b.length - a.length)[0] || rawDomain;
    
    const len = core.length;
    const flags: string[] = [];
    let score = 0;

    if (len === 0) return { isDga: false, score: 0, entropy: 0, riskLevel: 'LOW', flags: [] };

    // --- 1. SHANNON ENTROPY (Randomness) ---
    const frequencies = new Map<string, number>();
    for (let char of core) {
        frequencies.set(char, (frequencies.get(char) || 0) + 1);
    }
    let entropy = 0;
    frequencies.forEach(count => {
        const p = count / len;
        entropy -= p * Math.log2(p);
    });

    if (entropy > 4.2) { score += 45; flags.push('Extreme Entropy (>4.2)'); }
    else if (entropy > 3.7) { score += 25; flags.push('Elevated Entropy'); }

    // --- 2. KL DIVERGENCE (Distribution Analysis) ---
    let divergence = 0;
    const coreCharFreq: Record<string, number> = {};
    for (let char of core) {
        coreCharFreq[char] = (coreCharFreq[char] || 0) + (1 / len);
    }

    Object.keys(coreCharFreq).forEach(char => {
        const targetP = coreCharFreq[char];
        const benignP = BENIGN_CHAR_FREQ[char] || 0.001; // Avoid divide by zero
        divergence += targetP * Math.log2(targetP / benignP);
    });

    if (divergence > 3.5) { score += 30; flags.push('Atypical Character Distribution'); }

    // --- 3. BIGRAM ANALYSIS (Transition Logic) ---
    if (len > 3) {
        let suspiciousTransitions = 0;
        for (let i = 0; i < len - 1; i++) {
            const bigram = core[i] + core[i+1];
            // Only check alphabetic bigrams for natural language feel
            if (/^[a-z]{2}$/.test(bigram) && !BENIGN_BIGRAMS.has(bigram)) {
                suspiciousTransitions++;
            }
        }
        const transitionRatio = suspiciousTransitions / (len - 1);
        if (transitionRatio > 0.7) { score += 35; flags.push('Non-Natural Character Transitions'); }
    }

    // --- 4. STRUCTURAL HEURISTICS ---
    // Consonant Clusters (e.g., "zbgf")
    const consonantClusters = core.match(/[^aeiouy0-9\-]{4,}/gi);
    if (consonantClusters) {
        score += 25;
        flags.push(`Consonant Cluster (${consonantClusters[0]})`);
    }

    // Vowel Ratio
    const vowels = core.match(/[aeiouy]/gi)?.length || 0;
    const vowelRatio = vowels / len;
    if (vowelRatio < 0.15 && len > 6) { score += 20; flags.push('Low Vowel Ratio'); }

    // Numeric Density
    const numbers = core.match(/[0-9]/g)?.length || 0;
    const numRatio = numbers / len;
    if (numRatio > 0.4 && len > 4) { score += 20; flags.push('High Numeric Density'); }

    // Abnormal Length
    if (len > 30) { score += 15; flags.push('Abnormal Length'); }

    // Punycode check
    if (rawDomain.startsWith('xn--')) {
        score += 10;
        flags.push('Internationalized Domain (Punycode)');
    }

    // Risk Classification
    let riskLevel: DgaResult['riskLevel'] = 'LOW';
    const finalScore = Math.min(100, score);
    
    if (finalScore >= 80) riskLevel = 'CRITICAL';
    else if (finalScore >= 60) riskLevel = 'HIGH';
    else if (finalScore >= 40) riskLevel = 'MEDIUM';

    return { 
        isDga: finalScore >= 45, 
        score: finalScore, 
        entropy, 
        riskLevel, 
        flags 
    };
};

const createDnsQuery = (domain: string, typeVal: number = 1): Uint8Array => {
    const header = new Uint8Array(12);
    header[0] = 0x12; header[1] = 0x34; // ID
    header[2] = 0x01; header[3] = 0x00; // Flags (Recursion Desired)
    header[4] = 0x00; header[5] = 0x01; // QDCOUNT = 1
    
    const parts = domain.split('.');
    let qnameLen = 0;
    parts.forEach(p => qnameLen += p.length + 1);
    qnameLen += 1; // Root null byte

    const packet = new Uint8Array(12 + qnameLen + 4);
    packet.set(header, 0);

    let offset = 12;
    parts.forEach(part => {
        packet[offset++] = part.length;
        for (let i = 0; i < part.length; i++) packet[offset++] = part.charCodeAt(i);
    });
    packet[offset++] = 0x00; // End of Name
    packet[offset++] = (typeVal >> 8) & 0xFF; packet[offset++] = typeVal & 0xFF; // QTYPE
    packet[offset++] = 0x00; packet[offset++] = 0x01; // QCLASS (IN)
    return packet;
};

const readDomainName = (view: DataView, offset: number): { name: string, nextOffset: number } => {
    let name = '';
    let jumpOffset = -1;
    let currentOffset = offset;
    let loops = 0;

    while (true) {
        if (loops++ > 50) break;
        if (currentOffset >= view.byteLength) break;
        const len = view.getUint8(currentOffset);
        if (len === 0) { currentOffset++; break; }
        if ((len & 0xC0) === 0xC0) {
            if (jumpOffset === -1) jumpOffset = currentOffset + 2;
            const ptr = ((len & 0x3F) << 8) | view.getUint8(currentOffset + 1);
            currentOffset = ptr;
        } else {
            currentOffset++;
            for (let i = 0; i < len; i++) name += String.fromCharCode(view.getUint8(currentOffset + i));
            name += '.';
            currentOffset += len;
        }
    }
    if (name.endsWith('.')) name = name.slice(0, -1);
    return { name, nextOffset: jumpOffset !== -1 ? jumpOffset : currentOffset };
};

const parseDnsResponse = (buffer: ArrayBuffer): { rcode: number, answers: { type: number, data: string, ttl: number }[] } => {
    const view = new DataView(buffer);
    const flags = view.getUint16(2);
    const rcode = flags & 0x000F;
    const ancount = view.getUint16(6);
    const answers: { type: number, data: string, ttl: number }[] = [];
    let offset = 12;

    while(offset < view.byteLength) {
        const len = view.getUint8(offset);
        if (len === 0) { offset++; break; }
        if ((len & 0xC0) === 0xC0) { offset += 2; break; } 
        offset += len + 1;
    }
    offset += 4; // QType + QClass

    for(let i=0; i<ancount; i++) {
        if (offset >= view.byteLength) break;
        const nameInfo = readDomainName(view, offset);
        offset = nameInfo.nextOffset; 
        
        const type = view.getUint16(offset); offset += 2;
        const cls = view.getUint16(offset); offset += 2;
        const ttl = view.getUint32(offset); offset += 4;
        const rdlen = view.getUint16(offset); offset += 2;
        const rdataEnd = offset + rdlen;

        if (type === 1 && rdlen === 4) {
            const ip = `${view.getUint8(offset)}.${view.getUint8(offset+1)}.${view.getUint8(offset+2)}.${view.getUint8(offset+3)}`;
            answers.push({ type, data: ip, ttl });
        } else if (type === 28 && rdlen === 16) {
            const parts = [];
            for(let k=0; k<8; k++) parts.push(view.getUint16(offset + k*2).toString(16));
            answers.push({ type, data: parts.join(':'), ttl });
        } else if (type === 5 || type === 2 || type === 12) {
            const dName = readDomainName(view, offset);
            answers.push({ type, data: dName.name, ttl });
        } else if (type === 15) {
            const pref = view.getUint16(offset);
            const exchange = readDomainName(view, offset + 2);
            answers.push({ type, data: `${pref} ${exchange.name}`, ttl });
        } else if (type === 16) {
            let txtOffset = offset;
            let txtData = '';
            while(txtOffset < rdataEnd) {
                const tLen = view.getUint8(txtOffset);
                txtOffset++;
                for(let k=0; k<tLen; k++) txtData += String.fromCharCode(view.getUint8(txtOffset+k));
                txtOffset += tLen;
                txtData += ' ';
            }
            answers.push({ type, data: txtData.trim(), ttl });
        } else if (type === 6) {
            const mname = readDomainName(view, offset);
            const rname = readDomainName(view, mname.nextOffset);
            const serial = view.getUint32(rname.nextOffset);
            answers.push({ type, data: `SOA: ${mname.name} ${rname.name} (Serial: ${serial})`, ttl });
        }
        offset = rdataEnd;
    }
    return { rcode, answers };
};

export const performMultiDnsLookup = async (domain: string, recordType: string, provider: DnsProviderConfig): Promise<DetailedDnsRecord[] | null> => {
    const results: DetailedDnsRecord[] = [];
    const typeMap: Record<string, number> = { 'A': 1, 'NS': 2, 'CNAME': 5, 'SOA': 6, 'PTR': 12, 'MX': 15, 'TXT': 16, 'AAAA': 28, 'CAA': 257 };
    const typeNum = typeMap[recordType] || 1;

    let queryName = domain.trim();
    const isIp = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(queryName);
    if (recordType === 'PTR' && isIp) {
        queryName = queryName.split('.').reverse().join('.') + '.in-addr.arpa';
    }

    try {
        if (provider.type === 'JSON') {
            const url = `${provider.url}?name=${queryName}&type=${recordType}`;
            const headers: HeadersInit = { 'Accept': 'application/dns-json' };
            const res = await fetch(url, { headers });
            if (!res.ok) throw new Error("Fetch failed");
            const json = await res.json();
            if (json.Answer) {
                json.Answer.forEach((ans: any) => {
                    let rType = 'UNKNOWN';
                    if (ans.type === 1) rType = 'A';
                    else if (ans.type === 28) rType = 'AAAA';
                    else if (ans.type === 16) rType = 'TXT';
                    else if (ans.type === 15) rType = 'MX';
                    else if (ans.type === 5) rType = 'CNAME';
                    else if (ans.type === 2) rType = 'NS';
                    else if (ans.type === 6) rType = 'SOA';
                    else if (ans.type === 12) rType = 'PTR';
                    else if (ans.type === 257) rType = 'CAA';
                    
                    results.push({
                        type: rType,
                        name: ans.name,
                        ttl: ans.TTL,
                        data: ans.data.replace(/"/g, ''),
                        provider: provider.name
                    });
                });
            }
            return results;
        } else {
            const query = createDnsQuery(queryName, typeNum);
            const base64Query = Buffer.from(query).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            const targetUrl = `${provider.url}?dns=${base64Query}`;
            
            let response: Response | null = null;
            
            for (const proxyGen of PROXIES) {
                try {
                    const proxyUrl = proxyGen(targetUrl);
                    const headers: HeadersInit = { 'Accept': 'application/dns-message' };
                    const res = await fetch(proxyUrl, { method: 'GET', headers });
                    if (res.ok) {
                        response = res;
                        break;
                    }
                } catch (e) {}
            }

            if (response && response.ok) {
                const buf = await response.arrayBuffer();
                if (buf.byteLength < 12) return null;
                try {
                    const parsed = parseDnsResponse(buf);
                    parsed.answers.forEach(ans => {
                        const rKey = Object.keys(typeMap).find(k => typeMap[k] === ans.type) || 'UNKNOWN';
                        results.push({
                            type: rKey,
                            name: queryName, 
                            ttl: ans.ttl,
                            data: ans.data,
                            provider: provider.name
                        });
                    });
                    return results;
                } catch (parseError) {
                    return null;
                }
            }
            return null;
        }
    } catch (e) {
        return null;
    }
};

export const checkDnsBlocking = async (domain: string): Promise<DnsBlockResult[]> => {
    const results: DnsBlockResult[] = [];
    const check = await checkDomainSecurity(domain);
    const relevant = check.filter(c => c.type === 'DNS_FILTER' && c.filterType === 'MALWARE');
    relevant.forEach(r => results.push({ provider: r.provider, status: r.status, details: r.details, filterType: r.filterType, type: r.type }));
    return results;
};

export const checkDomainSecurity = async (target: string): Promise<SecurityCheckResult[]> => {
    const results: SecurityCheckResult[] = [];
    const isIp = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(target);

    if (isIp) {
        const reversedIp = target.split('.').reverse().join('.');
        await Promise.all(RBL_DOMAINS.map(async (rbl) => {
            try {
                const lookup = `${reversedIp}.${rbl}`;
                const res = await queryDoH(lookup, 'A');
                let listed = false;
                if (res?.Status === 0 && res.Answer && res.Answer.length > 0) {
                     const resultIp = res.Answer[0].data;
                     if (!resultIp.startsWith('127.255.255.')) listed = true;
                     if (rbl.includes('hostkarma') && resultIp === '127.0.0.1') listed = false;
                }
                results.push({
                    provider: rbl,
                    status: listed ? 'BLOCKED' : 'CLEAN',
                    type: 'RBL',
                    filterType: 'MALWARE',
                    details: listed ? res.Answer[0].data : undefined
                });
            } catch (e) {
                results.push({ provider: rbl, status: 'FAILED', type: 'RBL' });
            }
        }));
    } else {
        await Promise.all(DOMAIN_BLOCKLISTS.map(async (dbl) => {
            try {
                const lookup = `${target}.${dbl}`;
                const res = await queryDoH(lookup, 'A');
                let listed = false;
                if (res?.Status === 0 && res.Answer && res.Answer.length > 0) {
                     const resultIp = res.Answer[0].data;
                     if (!resultIp.startsWith('127.255.255.')) listed = true;
                }
                results.push({
                    provider: dbl,
                    status: listed ? 'BLOCKED' : 'CLEAN',
                    type: 'RBL',
                    filterType: 'MALWARE',
                    details: listed ? res.Answer[0].data : undefined
                });
            } catch (e) {
                results.push({ provider: dbl, status: 'FAILED', type: 'RBL' });
            }
        }));
    }

    const securityProviders = EXTENDED_DNS_PROVIDERS.filter(p => p.filterType === 'MALWARE');
    let googleResolved = false;
    try {
        const googleRes = await performMultiDnsLookup(target, 'A', EXTENDED_DNS_PROVIDERS.find(p => p.id === 'google')!);
        if (googleRes && googleRes.length > 0) googleResolved = true;
    } catch(e) {}

    await Promise.all(securityProviders.map(async (provider) => {
        try {
            const records = await performMultiDnsLookup(target, 'A', provider);
            if (records === null) {
                 results.push({ provider: provider.name, status: 'FAILED', type: 'DNS_FILTER', filterType: provider.filterType });
                 return;
            }
            let status: 'BLOCKED' | 'CLEAN' | 'FAILED' = 'CLEAN';
            let details = 'Resolved';

            if (records.length === 0) {
                if (googleResolved) {
                    if (provider.type === 'JSON') {
                        status = 'BLOCKED';
                        details = 'NXDOMAIN (Blocked)';
                    } else {
                        status = 'FAILED'; 
                        details = 'Lookup Failed (Empty)';
                    }
                } else {
                    status = 'CLEAN'; 
                    details = 'NXDOMAIN';
                }
            } else {
                const ips = records.map(r => r.data);
                details = ips[0];
                if (ips.some(ip => ip === '0.0.0.0' || ip === '127.0.0.1' || ip === '::1' || ip === '146.112.61.106' || ip === '10.10.34.35')) {
                    status = 'BLOCKED';
                    details = `Sinkholed to ${ips[0]}`;
                }
            }
            results.push({ provider: provider.name, status, type: 'DNS_FILTER', filterType: provider.filterType, details });
        } catch (e) {
            results.push({ provider: provider.name, status: 'FAILED', type: 'DNS_FILTER', filterType: provider.filterType });
        }
    }));

    return results;
};

export const fetchExtendedSecurityInfo = async (ip: string): Promise<ExtendedSecurityInfo> => {
    const [rblResult, hostname] = await Promise.all([
        checkRBL(ip),
        resolveHostname(ip)
    ]);

    const rblBlockStatus: DnsBlockResult[] = [];
    if (rblResult.status === 'LISTED') {
        rblResult.listedIn.forEach(rbl => {
            rblBlockStatus.push({
                provider: rbl,
                status: 'BLOCKED',
                filterType: 'MALWARE',
                type: 'RBL'
            });
        });
    }

    return {
        rblBlockStatus,
        domain: hostname || undefined
    };
};
