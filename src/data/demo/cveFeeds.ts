import type { CveFeedItem } from '../../types';

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
