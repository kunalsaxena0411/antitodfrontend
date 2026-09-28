export const DEMO_RULES = [
  {
    id: 'RULE-001',
    name: 'Suspicious RDP Login',
    description: 'Detects lateral movement via RDP using known compromised IPs.',
    severity: 'critical',
    status: 'active',
    format: 'sigma',
    mitre: ['T1021.001', 'T1078'],
    lastModified: new Date().toISOString(),
    testStatus: 'passing'
  },
  {
    id: 'RULE-002',
    name: 'PowerShell Downgrade Attack',
    description: 'Identifies attempts to run PowerShell v2 to bypass AMSI logging.',
    severity: 'high',
    status: 'active',
    format: 'sigma',
    mitre: ['T1059.001'],
    lastModified: new Date().toISOString(),
    testStatus: 'passing'
  },
  {
    id: 'RULE-003',
    name: 'Mimikatz Execution Pattern',
    description: 'Detects command line parameters associated with Mimikatz credential dumping.',
    severity: 'critical',
    status: 'active',
    format: 'yara',
    mitre: ['T1003.001'],
    lastModified: new Date().toISOString(),
    testStatus: 'passing'
  },
  {
    id: 'RULE-004',
    name: 'Suspicious Network Connection to Pastebin',
    description: 'Detects potential C2 or payload download from Pastebin-like sites.',
    severity: 'medium',
    status: 'testing',
    format: 'snort',
    mitre: ['T1105'],
    lastModified: new Date().toISOString(),
    testStatus: 'untested'
  },
  {
    id: 'RULE-005',
    name: 'LSASS Memory Dumping',
    description: 'Identifies procdump or comsvcs.dll usage to dump LSASS memory.',
    severity: 'critical',
    status: 'disabled',
    format: 'sigma',
    mitre: ['T1003.001'],
    lastModified: new Date().toISOString(),
    testStatus: 'failing'
  },
  {
    id: 'RULE-006',
    name: 'Unusual Volume Shadow Copy Deletion',
    description: 'Detects vssadmin or wmic deleting shadow copies, often a precursor to ransomware.',
    severity: 'high',
    status: 'active',
    format: 'sigma',
    mitre: ['T1490'],
    lastModified: new Date().toISOString(),
    testStatus: 'passing'
  }
];
