import {
  LayoutDashboard, MonitorPlay, FileText, Crosshair, CloudCog,
  Search as SearchIcon, Network, Briefcase, Share2, HardDrive,
  PencilLine, Zap, Box, Monitor, ShieldAlert, Shield, Bug,
  Users, Newspaper, Skull, Fingerprint, Globe, Mail, Target,
  Book, Layers, Server, Archive, MessageSquare, HelpCircle,
  Settings, UserCircle, Building2, Users2, CreditCard,
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

export const TOP_LEVEL_ITEMS: NavItem[] = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', desc: 'Real-time threat monitoring and global status overview.' },
  { id: 'soc_wall', icon: MonitorPlay, label: 'SOC Wall', desc: 'Full-screen cinematic visualization.' },
];

export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Operations',
    items: [
      { id: 'honeypot_logs', icon: FileText, label: 'Honeypot Logs', desc: 'Live honeypot event stream and log analysis.' },
      { id: 'attack_map', icon: Crosshair, label: 'Attack Map', desc: 'Geospatial attack visualization.' },
      { id: 'infrastructure', icon: CloudCog, label: 'Infrastructure', desc: 'Manage servers, agents, and honeypot deployments.' },
    ],
  },
  {
    title: 'Investigate',
    items: [
      { id: 'analysis', icon: SearchIcon, label: 'Analysis', desc: 'Parse, normalize, and score raw logs.' },
      { id: 'investigation', icon: Network, label: 'Investigation', desc: 'Visual link analysis of entities.' },
      { id: 'investigation_bench', icon: Briefcase, label: 'Investigation Bench', desc: 'Case management workspace.' },
      { id: 'network', icon: Network, label: 'Network', desc: 'PCAP and network forensics.' },
      { id: 'topology', icon: Share2, label: 'Network Topology', desc: 'Security-focused network builder.' },
      { id: 'nettools', icon: HardDrive, label: 'Network Tools', desc: 'DNS, Whois, Traceroute, etc.' },
      { id: 'threat_canvas', icon: PencilLine, label: 'Threat Canvas', desc: 'STRIDE threat modeling.' },
      { id: 'cyberchef', icon: Zap, label: 'CyberChef', desc: 'Data transformation suite.' },
      { id: 'dynamic_sandbox', icon: Box, label: 'Dynamic Sandbox', desc: 'Detonate files and URLs.' },
      { id: 'sandbox_browser', icon: Monitor, label: 'Sandbox Browser', desc: 'Secure web browser for inspection.' },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { id: 'ioc', icon: ShieldAlert, label: 'IOC', desc: 'Indicators of Compromise manager.' },
      { id: 'cve', icon: Shield, label: 'CVE', desc: 'Vulnerability intelligence database.' },
      { id: 'exploit', icon: Bug, label: 'Exploit', desc: 'Public exploits and PoCs.' },
      { id: 'actors', icon: Users, label: 'Actors', desc: 'Threat actor profiles.' },
      { id: 'news', icon: Newspaper, label: 'News', desc: 'Threat intelligence feed.' },
      { id: 'ransomware', icon: Skull, label: 'Ransomware', desc: 'Ransomware group tracker.' },
      { id: 'brand_monitor', icon: Fingerprint, label: 'Brand Monitor', desc: 'Brand impersonation detection.' },
      { id: 'webcheck', icon: Globe, label: 'Web Check', desc: 'Website analysis and inspection.' },
      { id: 'email_forensic', icon: Mail, label: 'Email Forensic', desc: 'Email header analysis.' },
      { id: 'intel_search', icon: SearchIcon, label: 'Intel Search', desc: 'Deep research with AI grounding.' },
      { id: 'recon', icon: Target, label: 'Recon', desc: 'Attack surface reconnaissance.' },
    ],
  },
  {
    title: 'Detection & Response',
    items: [
      { id: 'rules', icon: Book, label: 'Rules', desc: 'Detection rules (YARA, Sigma, Suricata).' },
      { id: 'mitre', icon: Layers, label: 'MITRE Navigator', desc: 'ATT&CK framework coverage.' },
      { id: 'vuln_manager', icon: Server, label: 'Vulnerability Manager', desc: 'Vulnerability tracking and remediation.' },
      { id: 'playbook', icon: Archive, label: 'Playbook', desc: 'Incident response playbooks.' },
    ],
  },
];

export const UTILITY_ITEMS: NavItem[] = [
  { id: 'chat', icon: MessageSquare, label: 'Chat', desc: 'AI security assistant.' },
  { id: 'help', icon: HelpCircle, label: 'Help', desc: 'Documentation and guides.' },
];

export const BOTTOM_ITEMS: NavItem[] = [
  { id: 'settings', icon: Settings, label: 'Settings', desc: 'Application settings.' },
];

