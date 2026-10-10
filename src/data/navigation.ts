import {
  Archive,
  Book,
  Box,
  Briefcase,
  Bug,
  CloudCog,
  Crosshair,
  FileText,
  Fingerprint,
  Globe,
  HardDrive,
  HelpCircle,
  Layers,
  LayoutDashboard,
  Mail,
  MessageSquare,
  Monitor,
  MonitorPlay,
  Network,
  Newspaper,
  PencilLine,
  Search,
  Settings,
  Share2,
  Shield,
  ShieldAlert,
  Skull,
  Target,
  Database,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/**
 * View lifecycle status for v1 product launch.
 *
 * - 'live'    — Fully functional, ship to customers.
 * - 'preview' — Visible in sidebar with a "Preview" badge. Accessible but may
 *               use demo data or lack backend integration.
 * - 'hidden'  — Removed from sidebar, command palette, and search entirely.
 *               The ViewRouter fallback still catches direct URL access.
 *
 * Default is 'live' when omitted (backwards-compatible).
 */
export type ViewStatus = 'live' | 'preview' | 'hidden';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  desc: string;
  /** @default 'live' */
  status?: ViewStatus;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

/** Resolve the effective status of a nav item (defaults to 'live'). */
export function viewStatus(item: NavItem): ViewStatus {
  return item.status ?? 'live';
}

/** True when the item should be rendered in the sidebar / command palette. */
export function isVisible(item: NavItem): boolean {
  return viewStatus(item) !== 'hidden';
}

/** True when the item carries the "Preview" badge. */
export function isPreview(item: NavItem): boolean {
  return viewStatus(item) === 'preview';
}

// Product/module vocabulary is intentionally sourced from the original Xyberah-Admin
// application. The redesign changes presentation, not the module taxonomy.
export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Operations',
    items: [
      { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', desc: 'Real-time threat monitoring and global status overview.' },
      { id: 'honeypot_logs', icon: Database, label: 'Honeypot Logs', desc: 'Search, filter, and inspect honeypot events with threat intelligence.' },
      { id: 'soc_wall', icon: MonitorPlay, label: 'SOC Wall', desc: 'Cinematic full-screen visualization mode.', status: 'preview' },
      { id: 'investigation_bench', icon: Briefcase, label: 'Investigation Bench', desc: 'Manage cases, artifacts, and evidence for incidents.', status: 'preview' },
      { id: 'playbooks', icon: Archive, label: 'Response Playbooks', desc: 'Execute standard operating procedures for incident response.', status: 'preview' },
      { id: 'attackmap', icon: Crosshair, label: 'Threat Map', desc: 'Geospatial visualization of active cyber attacks.' },
      { id: 'ransomware', icon: Skull, label: 'Ransomware Monitor', desc: 'Track active ransomware groups and leak sites.', status: 'preview' },
    ],
  },
  {
    title: 'Forensics',
    items: [
      { id: 'analysis', icon: FileText, label: 'Log Analysis', desc: 'Parse, normalize, and score raw server logs.' },
      { id: 'investigate', icon: Network, label: 'Graph Investigation', desc: 'Visual link analysis of entities and relationships.', status: 'preview' },
      { id: 'network', icon: Network, label: 'Network Forensics', desc: 'Analyze PCAP files, TCP streams, and packet headers.', status: 'preview' },
      { id: 'email_forensic', icon: Mail, label: 'Email Forensic', desc: 'Analyze email headers, hops, and authentication.', status: 'preview' },
      { id: 'dynamic_sandbox', icon: Box, label: 'Dynamic Sandbox', desc: 'Detonate files and URLs in a secure isolated environment.', status: 'hidden' },
    ],
  },
  {
    title: 'Modeling',
    items: [
      { id: 'topology', icon: Share2, label: 'Network Topology', desc: 'Security-focused network builder with attack path simulation.', status: 'preview' },
      { id: 'threat_canvas', icon: PencilLine, label: 'Threat Canvas', desc: 'Interactive STRIDE threat modeling with AI analysis.', status: 'preview' },
      { id: 'navigator', icon: Layers, label: 'MITRE Navigator', desc: 'Map coverage against MITRE ATT&CK framework.' },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { id: 'intel_search', icon: Search, label: 'Intel Grounding', desc: 'Deep research tool using Gemini Search Grounding.', status: 'preview' },
      { id: 'actors', icon: Users, label: 'Threat Actors', desc: 'Detailed profiles of APT groups and cybercriminals.' },
      { id: 'cve', icon: Shield, label: 'Vulnerabilities', desc: 'Search CVE database and KEV catalog.' },
      { id: 'exploits', icon: Bug, label: 'Exploit DB', desc: 'Database of public exploits and PoCs.' },
      { id: 'news', icon: Newspaper, label: 'Intel Feed', desc: 'Aggregated cybersecurity news and advisories.' },
      { id: 'iocs', icon: ShieldAlert, label: 'IOC Manager', desc: 'Manage and export Indicators of Compromise.' },
      { id: 'brand_intel', icon: Fingerprint, label: 'Brand Intel', desc: 'Monitor brand impersonation and typosquatting.', status: 'preview' },
    ],
  },
  {
    title: 'Tools',
    items: [
      { id: 'cyberchef', icon: Zap, label: 'CyberChef', desc: 'Tactical data transformation and encoding/decoding suite.', status: 'preview' },
      { id: 'nettools', icon: HardDrive, label: 'Network Tools', desc: 'DNS lookup, Whois, Traceroute, and more.', status: 'preview' },
      { id: 'webcheck', icon: Globe, label: 'Web Check', desc: 'Deep website analysis and header inspection.', status: 'preview' },
      { id: 'sandbox', icon: Monitor, label: 'Security Sandbox', desc: 'Secure web browser for inspecting malicious sites.', status: 'hidden' },
      { id: 'rules', icon: Book, label: 'SOC Rules', desc: 'Manage detection rules (YARA, Sigma, Suricata).', status: 'preview' },
    ],
  },
  {
    title: 'Infrastructure',
    items: [
      { id: 'infrastructure', icon: CloudCog, label: 'Infrastructure', desc: 'Manage servers, agents, log shippers, containers, and honeypot deployments.' },
    ],
  },
  {
    title: 'Reconnaissance',
    items: [
      { id: 'recon', icon: Target, label: 'Xyberah Recon', desc: 'Attack surface reconnaissance — workspaces, targets, assets, vulnerabilities, and workers.', status: 'preview' },
    ],
  },
  {
    title: 'System',
    items: [
      { id: 'access_control', icon: Users, label: 'Access Control', desc: 'Manage users, RBAC groups, and inspect the security audit trail.' },
      { id: 'chat', icon: MessageSquare, label: 'AI Assistant', desc: 'Interact with the integrated AI security analyst.', status: 'hidden' },
      { id: 'help', icon: HelpCircle, label: 'System Guide', desc: 'Documentation, shortcuts, and help topics.' },
    ],
  },
];

export const BOTTOM_ITEMS: NavItem[] = [
  { id: 'settings', icon: Settings, label: 'Settings', desc: 'Application settings.' },
];

export const ALL_NAV_ITEMS = [...NAV_GROUPS.flatMap((group) => group.items), ...BOTTOM_ITEMS];

/**
 * NAV_GROUPS with hidden items stripped out and empty groups removed.
 * Use this in the sidebar and command palette instead of raw NAV_GROUPS.
 */
export const VISIBLE_NAV_GROUPS: NavGroup[] = NAV_GROUPS
  .map((group) => ({ ...group, items: group.items.filter(isVisible) }))
  .filter((group) => group.items.length > 0);

/** Flat list of all visible nav items (for command palette search). */
export const VISIBLE_NAV_ITEMS = VISIBLE_NAV_GROUPS.flatMap((group) => group.items);

// Backwards compatibility with the IDs used by the current redesign screens.
export const VIEW_ALIASES: Record<string, string> = {
  attack_map: 'attackmap',
  investigation: 'investigate',
  playbook: 'playbooks',
  mitre: 'navigator',
  ioc: 'iocs',
  exploit: 'exploits',
  brand_monitor: 'brand_intel',
  sandbox_browser: 'sandbox',
};

export function canonicalViewId(id: string) {
  return VIEW_ALIASES[id] ?? id;
}

export function findNavItem(id: string) {
  const canonical = canonicalViewId(id);
  return ALL_NAV_ITEMS.find((item) => item.id === canonical);
}

export function findNavGroup(id: string) {
  const canonical = canonicalViewId(id);
  return NAV_GROUPS.find((group) => group.items.some((item) => item.id === canonical));
}
