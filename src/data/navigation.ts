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

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  desc: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

// Product/module vocabulary is intentionally sourced from the original Xyberah-Admin
// application. The redesign changes presentation, not the module taxonomy.
export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Operations',
    items: [
      { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', desc: 'Real-time threat monitoring and global status overview.' },
      { id: 'honeypot_logs', icon: Database, label: 'Honeypot Logs', desc: 'Search, filter, and inspect honeypot events with threat intelligence.' },
      { id: 'soc_wall', icon: MonitorPlay, label: 'SOC Wall', desc: 'Cinematic full-screen visualization mode.' },
      { id: 'investigation_bench', icon: Briefcase, label: 'Investigation Bench', desc: 'Manage cases, artifacts, and evidence for incidents.' },
      { id: 'playbooks', icon: Archive, label: 'Response Playbooks', desc: 'Execute standard operating procedures for incident response.' },
      { id: 'attackmap', icon: Crosshair, label: 'Threat Map', desc: 'Geospatial visualization of active cyber attacks.' },
      { id: 'ransomware', icon: Skull, label: 'Ransomware Monitor', desc: 'Track active ransomware groups and leak sites.' },
    ],
  },
  {
    title: 'Forensics',
    items: [
      { id: 'analysis', icon: FileText, label: 'Log Analysis', desc: 'Parse, normalize, and score raw server logs.' },
      { id: 'investigate', icon: Network, label: 'Graph Investigation', desc: 'Visual link analysis of entities and relationships.' },
      { id: 'network', icon: Network, label: 'Network Forensics', desc: 'Analyze PCAP files, TCP streams, and packet headers.' },
      { id: 'email_forensic', icon: Mail, label: 'Email Forensic', desc: 'Analyze email headers, hops, and authentication.' },
      { id: 'dynamic_sandbox', icon: Box, label: 'Dynamic Sandbox', desc: 'Detonate files and URLs in a secure isolated environment.' },
    ],
  },
  {
    title: 'Modeling',
    items: [
      { id: 'topology', icon: Share2, label: 'Network Topology', desc: 'Security-focused network builder with attack path simulation.' },
      { id: 'threat_canvas', icon: PencilLine, label: 'Threat Canvas', desc: 'Interactive STRIDE threat modeling with AI analysis.' },
      { id: 'navigator', icon: Layers, label: 'MITRE Navigator', desc: 'Map coverage against MITRE ATT&CK framework.' },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { id: 'intel_search', icon: Search, label: 'Intel Grounding', desc: 'Deep research tool using Gemini Search Grounding.' },
      { id: 'actors', icon: Users, label: 'Threat Actors', desc: 'Detailed profiles of APT groups and cybercriminals.' },
      { id: 'cve', icon: Shield, label: 'Vulnerabilities', desc: 'Search CVE database and KEV catalog.' },
      { id: 'exploits', icon: Bug, label: 'Exploit DB', desc: 'Database of public exploits and PoCs.' },
      { id: 'news', icon: Newspaper, label: 'Intel Feed', desc: 'Aggregated cybersecurity news and advisories.' },
      { id: 'iocs', icon: ShieldAlert, label: 'IOC Manager', desc: 'Manage and export Indicators of Compromise.' },
      { id: 'brand_intel', icon: Fingerprint, label: 'Brand Intel', desc: 'Monitor brand impersonation and typosquatting.' },
    ],
  },
  {
    title: 'Tools',
    items: [
      { id: 'cyberchef', icon: Zap, label: 'CyberChef', desc: 'Tactical data transformation and encoding/decoding suite.' },
      { id: 'nettools', icon: HardDrive, label: 'Network Tools', desc: 'DNS lookup, Whois, Traceroute, and more.' },
      { id: 'webcheck', icon: Globe, label: 'Web Check', desc: 'Deep website analysis and header inspection.' },
      { id: 'sandbox', icon: Monitor, label: 'Security Sandbox', desc: 'Secure web browser for inspecting malicious sites.' },
      { id: 'rules', icon: Book, label: 'SOC Rules', desc: 'Manage detection rules (YARA, Sigma, Suricata).' },
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
      { id: 'recon', icon: Target, label: 'Xyberah Recon', desc: 'Attack surface reconnaissance — workspaces, targets, assets, vulnerabilities, and workers.' },
    ],
  },
  {
    title: 'System',
    items: [
      { id: 'chat', icon: MessageSquare, label: 'AI Assistant', desc: 'Interact with the integrated AI security analyst.' },
      { id: 'help', icon: HelpCircle, label: 'System Guide', desc: 'Documentation, shortcuts, and help topics.' },
    ],
  },
];

export const BOTTOM_ITEMS: NavItem[] = [
  { id: 'settings', icon: Settings, label: 'Settings', desc: 'Application settings.' },
];

export const ALL_NAV_ITEMS = [...NAV_GROUPS.flatMap((group) => group.items), ...BOTTOM_ITEMS];

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
