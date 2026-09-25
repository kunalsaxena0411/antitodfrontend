// Rule Engine Service
// Provides rule management and evaluation capabilities

export interface RuleSource {
    id: string;
    name: string;
    url: string;
    type: 'sigma' | 'yara' | 'snort' | 'suricata';
    enabled: boolean;
}

export interface Rule {
    id: string;
    name: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    type: string;
    content: string;
    enabled: boolean;
    tags?: string[];
    mitreTactics?: string[];
    source?: string;
}

export const DEFAULT_SOURCES: RuleSource[] = [
    {
        id: 'sigma-core',
        name: 'Sigma Core Rules',
        url: 'https://github.com/SigmaHQ/sigma/tree/master/rules',
        type: 'sigma',
        enabled: true
    },
    {
        id: 'emerging-threats',
        name: 'Emerging Threats',
        url: 'https://rules.emergingthreats.net/open/suricata/',
        type: 'suricata',
        enabled: true
    }
];

export const DEFAULT_RULES: Rule[] = [
    {
        id: 'default-ssh-bruteforce',
        name: 'SSH Brute Force Detection',
        description: 'Detects multiple failed SSH login attempts',
        severity: 'high',
        type: 'sigma',
        content: 'title: SSH Brute Force\ndetection:\n  selection:\n    event_type: ssh_login_attempt\n    failed: true\n  condition: selection | count() > 5',
        enabled: true,
        tags: ['ssh', 'brute-force'],
        mitreTactics: ['Credential Access']
    },
    {
        id: 'default-port-scan',
        name: 'Port Scan Detection',
        description: 'Detects port scanning activity',
        severity: 'medium',
        type: 'sigma',
        content: 'title: Port Scan\ndetection:\n  selection:\n    event_type: connection_attempt\n  condition: selection | count(dst_port) > 10',
        enabled: true,
        tags: ['reconnaissance', 'port-scan'],
        mitreTactics: ['Discovery']
    }
];

export const RULE_TEMPLATES = {
    sigma: `title: Rule Name
description: Rule description
status: experimental
logsource:
  category: honeypot
detection:
  selection:
    event_type: 'event_name'
  condition: selection
level: medium`,

    yara: `rule RuleName {
  meta:
    description = "Rule description"
    author = "Security Team"
  strings:
    $s1 = "suspicious_string"
  condition:
    $s1
}`,

    snort: `alert tcp any any -> any any (msg:"Rule Name"; content:"pattern"; sid:1000001; rev:1;)`,

    suricata: `alert http any any -> any any (msg:"Rule Name"; content:"pattern"; http_uri; sid:2000001; rev:1;)`
};

export async function syncSource(source: RuleSource): Promise<Rule[]> {
    console.log(`[RuleEngine] Syncing source: ${source.name}`);
    // Placeholder - would fetch rules from the source URL
    return [];
}

export function parseImport(content: string, type: string): Rule[] {
    console.log(`[RuleEngine] Parsing ${type} rules`);
    // Placeholder - would parse rule content based on type
    return [];
}
