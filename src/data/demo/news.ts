import { SHARED_ENTITIES } from './entities';
import type { ThreatNewsItem } from '../../../types';

export const DEMO_NEWS: ThreatNewsItem[] = [
  {
    id: 'NEWS-001',
    title: 'New RDP Vulnerability Exploited by ' + SHARED_ENTITIES.actor,
    description: 'A novel attack chain has been observed utilizing CVE-2026-10443 to gain initial access and pivot via RDP.',
    source: 'Cyber Intel Feed',
    date: new Date().toISOString(),
    published: new Date().toISOString(),
    link: 'https://example.com/news/1',
    category: 'news'
  }
];
