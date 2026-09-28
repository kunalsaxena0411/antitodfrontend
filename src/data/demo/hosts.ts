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
  }
];
