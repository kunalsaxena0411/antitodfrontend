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
  },
  {
    id: 'INV-8821',
    title: 'Suspicious PowerShell Execution',
    status: 'Open',
    severity: 'Medium',
    assignedTo: 'Analyst-2',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    relatedEntities: ['wkst-marketing-04', 'Lazarus Group']
  },
  {
    id: 'INV-8834',
    title: 'Data Exfiltration to Pastebin',
    status: 'In Progress',
    severity: 'Critical',
    assignedTo: 'Analyst-3',
    createdAt: new Date(Date.now() - 43200000).toISOString(),
    relatedEntities: ['193.187.112.44', 'Turla']
  },
  {
    id: 'INV-8850',
    title: 'Multiple Failed SSH Logins',
    status: 'Closed',
    severity: 'Low',
    assignedTo: 'Analyst-1',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    relatedEntities: ['45.33.32.156']
  }
];
