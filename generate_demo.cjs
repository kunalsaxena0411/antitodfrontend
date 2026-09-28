const fs = require('fs');
const path = require('path');

const demoDir = path.join(__dirname, 'src', 'data', 'demo');
if (!fs.existsSync(demoDir)) fs.mkdirSync(demoDir, { recursive: true });

const files = {
  'index.ts': `
export * from './entities';
export * from './dashboard';
export * from './vulnerabilities';
export * from './actors';
export * from './iocs';
export * from './investigations';
export * from './attackMap';
export * from './rules';
export * from './playbooks';
export * from './news';
`,
  'dashboard.ts': `
import { SHARED_ENTITIES } from './entities';

export const DEMO_DASHBOARD = {
  metrics: {
    activeIncidents: 12,
    criticalAlerts: 3,
    monitoredAssets: 1450,
    threatLevel: 'Elevated'
  },
  recentActivity: [
    { id: SHARED_ENTITIES.event, type: 'incident', title: 'Suspicious Login', relatedTo: SHARED_ENTITIES.ip, time: new Date().toISOString() },
    { id: 'EVT-7813', type: 'scan', title: 'Port Scan Detected', relatedTo: '45.33.32.156', time: new Date().toISOString() }
  ]
};
`,
  'vulnerabilities.ts': `
import { SHARED_ENTITIES } from './entities';
import type { CveEntry } from '../../../types';

export const DEMO_CVES: CveEntry[] = [
  {
    id: SHARED_ENTITIES.cve,
    assigner: 'cve@mitre.org',
    published: new Date().toISOString(),
    modified: new Date().toISOString(),
    status: 'Analyzed',
    description: 'A critical remote code execution vulnerability in the core parsing engine.',
    cvss: {
      score: 9.8,
      vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
      severity: 'CRITICAL'
    },
    cwe: ['CWE-79'],
    references: ['https://nvd.nist.gov/vuln/detail/CVE-2026-10443']
  }
];
`,
  'actors.ts': `
import { SHARED_ENTITIES } from './entities';
import type { MalpediaActor } from '../../../types';

export const DEMO_ACTORS: MalpediaActor[] = [
  {
    name: SHARED_ENTITIES.actor,
    uuid: 'actor-1',
    description: 'A well-resourced APT group known for targeting critical infrastructure and utilizing advanced persistence mechanisms.',
    associated_families: ['malware-1'],
    synonyms: ['Fancy Bear', 'APT28'],
    mitre_id: 'G0007',
    mitre_url: 'https://attack.mitre.org/groups/G0007/'
  }
];
`,
  'iocs.ts': `
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
`,
  'investigations.ts': `
import { SHARED_ENTITIES } from './entities';

export const DEMO_INVESTIGATIONS = [
  {
    id: SHARED_ENTITIES.incident,
    title: 'Lateral Movement via RDP',
    status: 'In Progress',
    severity: 'High',
    assignedTo: 'Analyst-1',
    createdAt: new Date().toISOString(),
    relatedEntities: [SHARED_ENTITIES.ip, SHARED_ENTITIES.actor]
  }
];
`,
  'attackMap.ts': `
import { SHARED_ENTITIES } from './entities';
import type { LogEventV2 } from '../../../api/services';

export const DEMO_EVENTS: LogEventV2[] = [
  {
    id: SHARED_ENTITIES.event,
    timestamp: new Date().toISOString(),
    source_ip: SHARED_ENTITIES.ip,
    dest_ip: '10.0.0.5',
    dest_port: 3389,
    service: 'RDP',
    protocol: 'TCP',
    action: 'allowed',
    severity: 'high',
    event_type: 'lateral_movement',
    geoip: {
      country_name: 'Russia',
      country_code: 'RU',
      city_name: 'Moscow',
      latitude: 55.7558,
      longitude: 37.6173
    }
  }
];
`,
  'rules.ts': `
import { SHARED_ENTITIES } from './entities';

export const DEMO_RULES = [
  {
    id: 'RULE-001',
    name: 'Suspicious RDP Login',
    description: 'Detects lateral movement via RDP using known compromised IPs.',
    severity: 'High',
    status: 'Active',
    type: 'Sigma',
    tags: [SHARED_ENTITIES.mitre, 'lateral_movement']
  }
];
`,
  'playbooks.ts': `
import { PLAYBOOKS as DEFAULT_PLAYBOOKS } from '../../../services/playbooks';

// We can just reuse the existing local playbooks for demo since they are already static.
export const DEMO_PLAYBOOKS = DEFAULT_PLAYBOOKS;
`,
  'news.ts': `
import { SHARED_ENTITIES } from './entities';
import type { ThreatNewsItem } from '../../../types';

export const DEMO_NEWS: ThreatNewsItem[] = [
  {
    id: 'NEWS-001',
    title: 'New RDP Vulnerability Exploited by ' + SHARED_ENTITIES.actor,
    summary: 'A novel attack chain has been observed utilizing CVE-2026-10443 to gain initial access and pivot via RDP.',
    source: 'Cyber Intel Feed',
    published: new Date().toISOString(),
    link: 'https://example.com/news/1',
    tags: [SHARED_ENTITIES.cve, 'RDP', 'APT']
  }
];
`
};

for (const [name, content] of Object.entries(files)) {
  fs.writeFileSync(path.join(demoDir, name), content.trim() + '\\n');
}
console.log('Generated demo data files.');
