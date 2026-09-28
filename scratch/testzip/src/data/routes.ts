import { ALL_NAV_ITEMS, canonicalViewId } from './navigation';

export interface AppRoute {
  viewId: string;
  path: string;
}

const ROUTE_SLUGS: Record<string, string> = {
  dashboard: 'dashboard',
  honeypot_logs: 'honeypot-logs',
  soc_wall: 'soc-wall',
  investigation_bench: 'investigation-bench',
  playbooks: 'response-playbooks',
  attackmap: 'threat-map',
  ransomware: 'ransomware-monitor',
  analysis: 'log-analysis',
  investigate: 'graph-investigation',
  network: 'network-forensics',
  email_forensic: 'email-forensic',
  dynamic_sandbox: 'dynamic-sandbox',
  topology: 'network-topology',
  threat_canvas: 'threat-canvas',
  navigator: 'mitre-navigator',
  intel_search: 'intel-grounding',
  actors: 'threat-actors',
  cve: 'vulnerabilities',
  exploits: 'exploit-db',
  news: 'intel-feed',
  iocs: 'ioc-manager',
  brand_intel: 'brand-intel',
  cyberchef: 'cyberchef',
  nettools: 'network-tools',
  webcheck: 'web-check',
  sandbox: 'security-sandbox',
  rules: 'soc-rules',
  infrastructure: 'infrastructure',
  recon: 'recon',
  chat: 'ai-assistant',
  help: 'system-guide',
};

const PATH_TO_VIEW = Object.fromEntries(
  Object.entries(ROUTE_SLUGS).map(([viewId, slug]) => [`/${slug}`, viewId]),
) as Record<string, string>;

export function routeForView(id: string) {
  const viewId = canonicalViewId(id);
  return `/${ROUTE_SLUGS[viewId] ?? viewId}`;
}

export function viewForPath(pathname: string) {
  const clean = pathname.split('?')[0].replace(/\/+$/, '') || '/';
  if (clean === '/') return 'dashboard';
  return PATH_TO_VIEW[clean] ?? 'dashboard';
}

export function isKnownRoute(pathname: string) {
  const clean = pathname.split('?')[0].replace(/\/+$/, '') || '/';
  return clean === '/' || clean === '/login' || Boolean(PATH_TO_VIEW[clean]);
}

export function allAppRoutes(): AppRoute[] {
  return ALL_NAV_ITEMS
    .filter((item) => item.id !== 'settings')
    .map((item) => ({ viewId: item.id, path: routeForView(item.id) }));
}
