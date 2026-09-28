import { SHARED_ENTITIES } from './entities';
import type { ThreatNewsItem } from '../../../types';

export const DEMO_NEWS: ThreatNewsItem[] = [
  {
    id: 'NEWS-001',
    title: 'New RDP Vulnerability Exploited by ' + SHARED_ENTITIES.actor,
    description: 'A novel attack chain has been observed utilizing CVE-2026-10443 to gain initial access and pivot via RDP.',
    source: 'Cyber Intel Feed',
    date: new Date(Date.now() - 3600000).toISOString(),
    published: new Date(Date.now() - 3600000).toISOString(),
    link: 'https://example.com/news/1',
    category: 'Vulnerability',
    timestamp: Date.now() - 3600000
  },
  {
    id: 'NEWS-002',
    title: 'Ransomware Gang Threatens Critical Infrastructure',
    description: 'LockBit affiliates have shifted focus to utilities, threatening severe disruption.',
    source: 'BleepingComputer',
    date: new Date(Date.now() - 7200000).toISOString(),
    published: new Date(Date.now() - 7200000).toISOString(),
    link: 'https://example.com/news/2',
    category: 'Ransomware',
    timestamp: Date.now() - 7200000
  },
  {
    id: 'NEWS-003',
    title: 'State-Sponsored Actor Targets Cloud Configurations',
    description: 'APT29 is actively scanning for misconfigured IAM roles to exfiltrate database backups.',
    source: 'The Hacker News',
    date: new Date(Date.now() - 14400000).toISOString(),
    published: new Date(Date.now() - 14400000).toISOString(),
    link: 'https://example.com/news/3',
    category: 'APT',
    timestamp: Date.now() - 14400000
  },
  {
    id: 'NEWS-004',
    title: 'Massive Phishing Campaign Uses Deepfake Audio',
    description: 'Executives are being targeted with AI-generated audio clips in highly sophisticated BEC attacks.',
    source: 'Dark Reading',
    date: new Date(Date.now() - 86400000).toISOString(),
    published: new Date(Date.now() - 86400000).toISOString(),
    link: 'https://example.com/news/4',
    category: 'Phishing',
    timestamp: Date.now() - 86400000
  },
  {
    id: 'NEWS-005',
    title: 'Zero-Day in Popular Supply Chain Vendor',
    description: 'A newly disclosed zero-day affects thousands of enterprise deployments worldwide.',
    source: 'Unit 42',
    date: new Date(Date.now() - 172800000).toISOString(),
    published: new Date(Date.now() - 172800000).toISOString(),
    link: 'https://example.com/news/5',
    category: 'Vulnerability',
    timestamp: Date.now() - 172800000
  },
  {
    id: 'NEWS-006',
    title: 'New Malware Loader Observed in the Wild',
    description: 'A previously unseen loader is distributing infostealers via fake software updates.',
    source: 'Trend Micro',
    date: new Date(Date.now() - 259200000).toISOString(),
    published: new Date(Date.now() - 259200000).toISOString(),
    link: 'https://example.com/news/6',
    category: 'Malware',
    timestamp: Date.now() - 259200000
  }
];
