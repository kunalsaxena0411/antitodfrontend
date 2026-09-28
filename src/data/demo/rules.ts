import { SHARED_ENTITIES } from './entities';

export const DEMO_RULES = [
  {
    id: 'RULE-001',
    name: 'Suspicious RDP Login',
    description: 'Detects lateral movement via RDP using known compromised IPs.',
    severity: 'High',
    status: 'Active',
    type: 'Sigma',
    mitre: [SHARED_ENTITIES.mitre], format: 'sigma', lastModified: new Date().toISOString(), testStatus: 'passing'
  }
];
