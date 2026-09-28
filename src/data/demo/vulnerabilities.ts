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
  }
];
