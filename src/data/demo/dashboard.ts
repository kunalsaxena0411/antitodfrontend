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
