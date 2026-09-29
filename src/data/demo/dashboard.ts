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
    { id: 'EVT-7813', type: 'scan', title: 'Port Scan Detected', relatedTo: '45.33.32.156', time: new Date(Date.now() - 300000).toISOString() },
    { id: 'INC-2041', type: 'incident', title: 'Malware Dropper Blocked', relatedTo: 'wkst-marketing-04', time: new Date(Date.now() - 1500000).toISOString() },
    { id: 'EVT-9001', type: 'alert', title: 'Unusual Data Exfiltration', relatedTo: '193.187.112.44', time: new Date(Date.now() - 3600000).toISOString() },
    { id: 'INC-2045', type: 'investigation', title: 'Ransomware Precursor Activity', relatedTo: 'srv-db-primary', time: new Date(Date.now() - 7200000).toISOString() },
    { id: 'EVT-1022', type: 'scan', title: 'Vulnerability Scan Completed', relatedTo: 'DMZ-Subnet', time: new Date(Date.now() - 14400000).toISOString() }
  ]
};
