import { SHARED_ENTITIES } from './entities';
import type { CveEntry } from '../../../types';

export const DEMO_CVES: CveEntry[] = [
  {
    id: SHARED_ENTITIES.cve,
    published: new Date().toISOString(),
    modified: new Date().toISOString(),
    status: 'Analyzed',
    description: 'A critical remote code execution vulnerability in the core parsing engine.',
    cvss: 9.8,
    cwe: ['CWE-79'],
    references: [{ url: 'https://nvd.nist.gov/vuln/detail/CVE-2026-10443', tags: [] }]
  },
  {
    id: 'CVE-2026-9921',
    published: new Date().toISOString(),
    modified: new Date().toISOString(),
    status: 'Analyzed',
    description: 'Improper bounds checking allows a local user to gain root privileges.',
    cvss: 7.8,
    cwe: ['CWE-119', 'CWE-20'],
    references: [{ url: 'https://nvd.nist.gov/vuln/detail/CVE-2026-9921', tags: ['Patch'] }]
  },
  {
    id: 'CVE-2024-3094',
    published: new Date(Date.now() - 86400000 * 30).toISOString(),
    modified: new Date().toISOString(),
    status: 'Exploited',
    description: 'Malicious code in xz/liblzma can intercept and modify data interacting with the library, allowing for authentication bypass.',
    cvss: 10.0,
    cwe: ['CWE-506'],
    references: [{ url: 'https://nvd.nist.gov/vuln/detail/CVE-2024-3094', tags: ['Exploit'] }]
  },
  {
    id: 'CVE-2025-1337',
    published: new Date(Date.now() - 86400000 * 10).toISOString(),
    modified: new Date(Date.now() - 86400000 * 2).toISOString(),
    status: 'Under Review',
    description: 'A flaw in path resolution allows unauthenticated attackers to read arbitrary files from the server.',
    cvss: 7.5,
    cwe: ['CWE-22'],
    references: [{ url: 'https://nvd.nist.gov/vuln/detail/CVE-2025-1337', tags: [] }]
  },
  {
    id: 'CVE-2025-8899',
    published: new Date(Date.now() - 86400000 * 5).toISOString(),
    modified: new Date(Date.now() - 86400000 * 5).toISOString(),
    status: 'Analyzed',
    description: 'Stored XSS vulnerability in the logging module allows attackers to execute JS in the context of an administrator.',
    cvss: 5.4,
    cwe: ['CWE-79'],
    references: [{ url: 'https://nvd.nist.gov/vuln/detail/CVE-2025-8899', tags: [] }]
  },
  {
    id: 'CVE-2026-0001',
    published: new Date(Date.now() - 86400000 * 2).toISOString(),
    modified: new Date().toISOString(),
    status: 'Mitigated',
    description: 'Specially crafted packets can cause the VPN service to crash, requiring a manual reboot.',
    cvss: 6.5,
    cwe: ['CWE-400'],
    references: [{ url: 'https://nvd.nist.gov/vuln/detail/CVE-2026-0001', tags: ['Workaround'] }]
  }
];
