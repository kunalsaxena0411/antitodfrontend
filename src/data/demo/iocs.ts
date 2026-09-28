import { SHARED_ENTITIES } from './entities';

export const DEMO_IOCS = [
  {
    id: 'IOC-1042',
    type: 'ip',
    value: SHARED_ENTITIES.ip,
    source: 'ThreatFox',
    severity: 'critical',
    firstSeen: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    tags: ['malware', 'c2']
  },
  {
    id: 'IOC-1043',
    type: 'domain',
    value: SHARED_ENTITIES.domain,
    source: 'URLhaus',
    severity: 'high',
    firstSeen: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    tags: ['phishing']
  }
];
