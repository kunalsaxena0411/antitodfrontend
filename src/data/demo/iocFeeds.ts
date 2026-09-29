import type { 
    UrlHausEntry, 
    FeodoTrackerEntry, 
    MalwareBazaarEntry, 
    SslBlEntry, 
    Ja3FingerprintEntry, 
    ThreatFoxEntry 
} from '../../../types';

export const DEMO_URLHAUS: UrlHausEntry[] = [
    { id: '1001', dateadded: '2026-09-29T10:00:00Z', url: 'http://malicious-node.xyz/payload.exe', url_status: 'online', last_online: '2026-09-29T11:00:00Z', threat: 'malware_download', tags: ['exe', 'payload'], urlhaus_link: '', reporter: 'system' },
    { id: '1002', dateadded: '2026-09-28T10:00:00Z', url: 'https://suspicious-login.com/login.php', url_status: 'offline', last_online: '2026-09-28T12:00:00Z', threat: 'phishing', tags: ['phishing', 'credentials'], urlhaus_link: '', reporter: 'system' },
    { id: '1003', dateadded: '2026-09-27T10:00:00Z', url: 'http://185.112.5.3/config.bin', url_status: 'online', last_online: '2026-09-29T09:00:00Z', threat: 'botnet_c2', tags: ['c2', 'config'], urlhaus_link: '', reporter: 'system' }
];

export const DEMO_FEODO: FeodoTrackerEntry[] = [
    { ip_address: '185.112.5.3', port: 443, status: 'online', hostname: 'unknown', as_number: 12345, as_name: 'MAL-AS', country: 'RU', first_seen: '2026-09-20T10:00:00Z', last_online: '2026-09-29T11:00:00Z', malware: 'QakBot' },
    { ip_address: '192.168.100.11', port: 8080, status: 'online', hostname: 'host-11.net', as_number: 1011, as_name: 'HOST11-AS', country: 'US', first_seen: '2026-09-25T10:00:00Z', last_online: '2026-09-29T10:30:00Z', malware: 'CobaltStrike' },
    { ip_address: '45.33.32.156', port: 80, status: 'offline', hostname: 'linode.com', as_number: 63949, as_name: 'LINODE', country: 'US', first_seen: '2026-09-01T10:00:00Z', last_online: '2026-09-28T11:00:00Z', malware: 'TrickBot' }
];

export const DEMO_THREATFOX: ThreatFoxEntry[] = [
    { id: '2001', ioc_value: 'malicious-node.xyz', ioc_type: 'domain', threat_type: 'botnet_cc', malware: 'qakbot', malware_printable: 'QakBot', first_seen_utc: '2026-09-20T10:00:00Z', last_seen_utc: '2026-09-29T11:00:00Z', confidence_level: 95, reference: null },
    { id: '2002', ioc_value: '192.168.100.11:8080', ioc_type: 'ip:port', threat_type: 'botnet_cc', malware: 'cobaltstrike', malware_printable: 'Cobalt Strike', first_seen_utc: '2026-09-25T10:00:00Z', last_seen_utc: '2026-09-29T10:30:00Z', confidence_level: 100, reference: null },
    { id: '2003', ioc_value: '8df726...hash...1', ioc_type: 'sha256_hash', threat_type: 'payload', malware: 'remcos', malware_printable: 'Remcos RAT', first_seen_utc: '2026-09-28T10:00:00Z', last_seen_utc: '2026-09-28T10:00:00Z', confidence_level: 85, reference: null }
];

export const DEMO_MALWAREBAZAAR: MalwareBazaarEntry[] = [
    { first_seen_utc: '2026-09-28T10:00:00Z', sha256_hash: '8df726...hash...1', md5_hash: 'd41d8c...hash...1', sha1_hash: 'da39a3...hash...1', reporter: 'system', file_name: 'invoice_sep.exe', file_type_mime: 'application/x-dosexec', signature: 'Remcos', clamav: 'Win.Trojan.Remcos', vtpercent: '45/70' }
];

export const DEMO_SSLBL: SslBlEntry[] = [
    { listingdate: '2026-09-25T10:00:00Z', sha1: 'da39a3...hash...1', listingreason: 'Cobalt Strike C2 Certificate' }
];

export const DEMO_JA3: Ja3FingerprintEntry[] = [
    { ja3_md5: 'a1b2c3d4e5f6', first_seen: '2026-09-20T10:00:00Z', last_seen: '2026-09-29T11:00:00Z', listingreason: 'TrickBot C2 Traffic' }
];
