import type { AnalyzedHost } from '../../types';
import { SHARED_ENTITIES } from './entities';

export const DEMO_HOSTS: AnalyzedHost[] = [
  {
    ip: SHARED_ENTITIES.ip,
    totalScore: 95,
    riskLevel: 'CRITICAL',
    country: 'RU',
    city: 'Moscow',
    asn: 'AS4842',
    hostname: 'malicious-host.xyz',
    isMalicious: true,
    isTor: false,
    tags: ['c2', 'malware'],
    signals: [{ source: 'malpedia', score: 90, description: 'Known C2 server', timestamp: Date.now() }],
    lastSeen: Date.now() - 3600000,
    timesSeen: 45
  },
  {
    ip: '45.33.32.156',
    totalScore: 65,
    riskLevel: 'HIGH',
    country: 'US',
    city: 'Newark',
    asn: 'AS63949',
    hostname: 'linode.com',
    isMalicious: true,
    isTor: true,
    tags: ['tor', 'scanner'],
    signals: [{ source: 'urlhaus', score: 60, description: 'Tor exit node used for scanning', timestamp: Date.now() }],
    lastSeen: Date.now() - 7200000,
    timesSeen: 12
  },
  {
    ip: '8.8.8.8',
    totalScore: 10,
    riskLevel: 'LOW',
    country: 'US',
    city: 'Mountain View',
    asn: 'AS15169',
    hostname: 'dns.google',
    isMalicious: false,
    isTor: false,
    tags: ['dns'],
    signals: [],
    lastSeen: Date.now() - 600000,
    timesSeen: 500
  },
  {
    ip: '193.187.112.44',
    totalScore: 82,
    riskLevel: 'HIGH',
    country: 'CN',
    city: 'Beijing',
    asn: 'AS4134',
    hostname: 'unknown.chinatelecom.com',
    isMalicious: true,
    isTor: false,
    tags: ['brute-force', 'ssh'],
    signals: [{ source: 'abuseipdb', score: 85, description: 'SSH Brute force attacks reported', timestamp: Date.now() - 86400000 }],
    lastSeen: Date.now() - 1200000,
    timesSeen: 142
  },
  {
    ip: '178.62.203.111',
    totalScore: 40,
    riskLevel: 'MEDIUM',
    country: 'GB',
    city: 'London',
    asn: 'AS14061',
    hostname: 'digitalocean.com',
    isMalicious: false,
    isTor: false,
    tags: ['proxy', 'vpn'],
    signals: [{ source: 'threatfox', score: 40, description: 'Suspicious proxy node', timestamp: Date.now() - 259200000 }],
    lastSeen: Date.now() - 14400000,
    timesSeen: 3
  },
  {
    ip: '103.224.212.222',
    totalScore: 98,
    riskLevel: 'CRITICAL',
    country: 'IR',
    city: 'Tehran',
    asn: 'AS58224',
    hostname: 'telecommunication-co.ir',
    isMalicious: true,
    isTor: false,
    tags: ['apt', 'c2', 'ransomware'],
    signals: [
      { source: 'alienvault', score: 95, description: 'MuddyWater C2 infrastructure', timestamp: Date.now() - 4000000 },
      { source: 'urlhaus', score: 100, description: 'Ransomware payload distribution', timestamp: Date.now() - 8000000 }
    ],
    lastSeen: Date.now() - 300000,
    timesSeen: 88
  }
];
