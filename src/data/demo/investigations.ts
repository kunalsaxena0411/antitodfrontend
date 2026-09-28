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
