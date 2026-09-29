import { SHARED_ENTITIES } from './entities';

export const DEMO_IOCS = [
  {
    id: 'IOC-1042',
    type: 'ip',
    value: SHARED_ENTITIES.ip,
    source: 'ThreatFox',
    severity: 'critical',
    firstSeen: new Date(Date.now() - 259200000).toISOString(),
    lastSeen: new Date().toISOString(),
    tags: ['malware', 'c2']
  },
  {
    id: 'IOC-1043',
    type: 'domain',
    value: SHARED_ENTITIES.domain,
    source: 'URLhaus',
    severity: 'high',
    firstSeen: new Date(Date.now() - 432000000).toISOString(),
    lastSeen: new Date(Date.now() - 86400000).toISOString(),
    tags: ['phishing']
  },
  {
    id: 'IOC-1044',
    type: 'hash',
    value: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    source: 'VirusTotal',
    severity: 'critical',
    firstSeen: new Date(Date.now() - 172800000).toISOString(),
    lastSeen: new Date().toISOString(),
    tags: ['ransomware', 'lockbit']
  },
  {
    id: 'IOC-1045',
    type: 'url',
    value: 'http://malicious-update-server.com/payload.exe',
    source: 'AlienVault',
    severity: 'high',
    firstSeen: new Date(Date.now() - 60000000).toISOString(),
    lastSeen: new Date(Date.now() - 10000000).toISOString(),
    tags: ['dropper']
  },
  {
    id: 'IOC-1046',
    type: 'ip',
    value: '193.187.112.44',
    source: 'AbuseIPDB',
    severity: 'medium',
    firstSeen: new Date(Date.now() - 1200000000).toISOString(),
    lastSeen: new Date(Date.now() - 40000000).toISOString(),
    tags: ['scanner']
  },
  {
    id: 'IOC-1047',
    type: 'hash',
    value: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    source: 'Malpedia',
    severity: 'critical',
    firstSeen: new Date(Date.now() - 90000000).toISOString(),
    lastSeen: new Date(Date.now() - 100000).toISOString(),
    tags: ['apt', 'cobaltstrike']
  }
];
