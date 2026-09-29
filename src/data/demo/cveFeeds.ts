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
  },
  {
    id: 'CVE-2024-3094',
    cveId: 'CVE-2024-3094',
    title: 'Malicious Code Injection in XZ Utils',
    description: 'Malicious code in xz/liblzma can intercept and modify data interacting with the library, allowing for authentication bypass.',
    severity: 'CRITICAL',
    cvss: 10.0,
    published: new Date(Date.now() - 86400000 * 30).toISOString(),
    link: 'https://nvd.nist.gov/vuln/detail/CVE-2024-3094',
    source: 'NVD'
  },
  {
    id: 'CVE-2025-1337',
    cveId: 'CVE-2025-1337',
    title: 'Directory Traversal in WebServer Pro',
    description: 'A flaw in path resolution allows unauthenticated attackers to read arbitrary files from the server.',
    severity: 'HIGH',
    cvss: 7.5,
    published: new Date(Date.now() - 86400000 * 10).toISOString(),
    link: 'https://nvd.nist.gov/vuln/detail/CVE-2025-1337',
    source: 'Mitre'
  },
  {
    id: 'CVE-2025-8899',
    cveId: 'CVE-2025-8899',
    title: 'Cross-Site Scripting in Admin Panel',
    description: 'Stored XSS vulnerability in the logging module allows attackers to execute JS in the context of an administrator.',
    severity: 'MEDIUM',
    cvss: 5.4,
    published: new Date(Date.now() - 86400000 * 5).toISOString(),
    link: 'https://nvd.nist.gov/vuln/detail/CVE-2025-8899',
    source: 'Vendor'
  },
  {
    id: 'CVE-2026-0001',
    cveId: 'CVE-2026-0001',
    title: 'Denial of Service in VPN Appliance',
    description: 'Specially crafted packets can cause the VPN service to crash, requiring a manual reboot.',
    severity: 'MEDIUM',
    cvss: 6.5,
    published: new Date(Date.now() - 86400000 * 2).toISOString(),
    link: 'https://nvd.nist.gov/vuln/detail/CVE-2026-0001',
    source: 'NVD'
  }
];
