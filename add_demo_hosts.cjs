const fs = require('fs');
const path = require('path');

const demoDir = path.join(__dirname, 'src', 'data', 'demo');
const entitiesPath = path.join(demoDir, 'entities.ts');

const hostsContent = `import type { AnalyzedHost } from '../../types';
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
`;

const cveFeedsContent = `import type { CveFeedItem } from '../../types';

export const DEMO_CVE_FEEDS: CveFeedItem[] = [
  {
    id: 'CVE-2026-10443',
    cveId: 'CVE-2026-10443',
    title: 'Remote Code Execution in Enterprise Gateway',
    description: 'A critical vulnerability allows remote attackers to execute arbitrary code without authentication.',
    severity: 'CRITICAL',
    cvss: 9.8,
    published: new Date().toISOString(),
    link: 'https://nvd.nist.gov/vuln/detail/CVE-2026-10443',
    source: 'NVD'
  },
  {
    id: 'CVE-2026-9921',
    cveId: 'CVE-2026-9921',
    title: 'Local Privilege Escalation in Kernel module',
    description: 'Improper bounds checking allows a local user to gain root privileges.',
    severity: 'HIGH',
    cvss: 7.8,
    published: new Date().toISOString(),
    link: 'https://nvd.nist.gov/vuln/detail/CVE-2026-9921',
    source: 'NVD'
  }
];
`;

fs.writeFileSync(path.join(demoDir, 'hosts.ts'), hostsContent);
fs.writeFileSync(path.join(demoDir, 'cveFeeds.ts'), cveFeedsContent);

let indexContent = fs.readFileSync(path.join(demoDir, 'index.ts'), 'utf8');
if (!indexContent.includes('export * from \'./hosts\'')) {
    indexContent += `\nexport * from './hosts';\nexport * from './cveFeeds';\n`;
    fs.writeFileSync(path.join(demoDir, 'index.ts'), indexContent);
}

const dpPath = path.join(__dirname, 'src', 'services', 'dataProvider.ts');
let dp = fs.readFileSync(dpPath, 'utf8');
dp = dp.replace('DEMO_DASHBOARD', 'DEMO_DASHBOARD,\n  DEMO_HOSTS,\n  DEMO_CVE_FEEDS');
dp += `\n
dataProvider.getHosts = async () => {
    return DEMO_HOSTS;
};
dataProvider.getCveFeeds = async () => {
    return DEMO_CVE_FEEDS;
};
`;
fs.writeFileSync(dpPath, dp);

console.log("Demo files created and dataProvider updated");
