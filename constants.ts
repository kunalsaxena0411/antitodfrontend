
import { SignatureDefinition } from './types';

export const THREAT_SIGNATURES: SignatureDefinition[] = [
  {
    name: "Log4j RCE",
    pattern: /\$\{jndi:(?:ldap|rmi|dns|nis|iiop|corba|nds|http):/i,
    score: 100,
    description: "Attempted exploitation of CVE-2021-44228 (Log4Shell)",
    mitreId: "T1190",
    mitreTactic: "Initial Access"
  },
  {
    name: "Ransomware Precursor",
    pattern: /vssadmin.*delete.*shadows|wbadmin.*delete.*catalog|bcdedit.*\/set.*recoveryenabled No/i,
    score: 100,
    description: "Destruction of system backups and recovery options",
    mitreId: "T1490",
    mitreTactic: "Impact"
  },
  {
    name: "Crypto-Miner",
    pattern: /miner|xmrig|minerd|cpuminer|stratum\+tcp|pool\.minexmr|\/usr\/\.work|nvidia-smi/i,
    score: 95,
    description: "Unauthorized cryptocurrency mining activity (Resource Hijacking)",
    mitreId: "T1496",
    mitreTactic: "Impact"
  },
  {
    name: "Reverse Shell",
    pattern: /bash -i >& \/dev\/tcp\/|nc -e \/bin\/sh|socat exec|0>&1/i,
    score: 95,
    description: "Interactive command and control channel establishment",
    mitreId: "T1059",
    mitreTactic: "Execution"
  },
  {
    name: "Web Shell Activity",
    pattern: /c99\.php|r57\.php|b374k|wso_shell|chopper|eval\(base64_decode/i,
    score: 90,
    description: "Presence of web-based backdoor scripts",
    mitreId: "T1505",
    mitreTactic: "Persistence"
  },
  {
    name: "Cobalt Strike Beacon",
    pattern: /powershell.*-nop.*-w hidden.*-enc|IEX \(New-Object Net\.WebClient\)|powershell -ep bypass/i,
    score: 90,
    description: "Potential Cobalt Strike or malicious PowerShell loader",
    mitreId: "T1059.001",
    mitreTactic: "Execution"
  },
  {
    name: "Telegram Stealer",
    pattern: /D877F783D5D3EF8Cs|tdata|telegram/i,
    score: 85,
    description: "Exfiltration of Telegram session data (C2 Communication)",
    mitreId: "T1041",
    mitreTactic: "Exfiltration"
  },
  {
    name: "Sensitive File Access",
    pattern: /cat \/etc\/shadow|cat \/etc\/passwd|type C:\\Windows\\System32\\config\\SAM/i,
    score: 85,
    description: "Accessing system credential files",
    mitreId: "T1003",
    mitreTactic: "Credential Access"
  },
  {
    name: "Botnet Dropper",
    pattern: /wget http|curl -O|tftp -g|ftpget/i,
    score: 80,
    description: "Downloading malicious payloads via standard tools (Ingress Tool Transfer)",
    mitreId: "T1105",
    mitreTactic: "Command and Control"
  },
  {
    name: "Cloud Metadata Access",
    pattern: /169\.254\.169\.254/i,
    score: 80,
    description: "Attempting to access Cloud Instance Metadata Service (IMDS)",
    mitreId: "T1552",
    mitreTactic: "Credential Access"
  },
  {
    name: "Docker Escape Attempt",
    pattern: /docker\.sock|mount.*\/host/i,
    score: 90,
    description: "Attempts to mount the Docker socket or host filesystem",
    mitreId: "T1611",
    mitreTactic: "Privilege Escalation"
  },
  {
    name: "Defense Evasion",
    pattern: /rm -rf|history -c|unset HISTFILE|\/dev\/null|truncate -s 0/i,
    score: 70,
    description: "Attempts to cover tracks or delete logs (Indicator Removal)",
    mitreId: "T1070",
    mitreTactic: "Defense Evasion"
  }
];

export const MITRE_ORDER = [
  "Reconnaissance",
  "Resource Development",
  "Initial Access",
  "Execution",
  "Persistence",
  "Privilege Escalation",
  "Defense Evasion",
  "Credential Access",
  "Discovery",
  "Lateral Movement",
  "Collection",
  "Command and Control",
  "Exfiltration",
  "Impact"
];

export const RISK_THRESHOLDS = {
  LOW: 0,
  MEDIUM: 40,
  HIGH: 70,
  CRITICAL: 90
};

export const MITRE_DESCRIPTIONS: Record<string, string> = {
  "Exfiltration": "The adversary is trying to steal data.",
  "Impact": "The adversary is trying to manipulate, interrupt, or destroy your systems and data.",
  "Initial Access": "The adversary is trying to get into your network.",
  "Command and Control": "The adversary is trying to communicate with compromised systems to control them.",
  "Defense Evasion": "The adversary is trying to avoid being detected.",
  "Execution": "The adversary is trying to run malicious code.",
  "Discovery": "The adversary is trying to figure out your environment.",
  "Persistence": "The adversary is trying to maintain their foothold.",
  "Privilege Escalation": "The adversary is trying to gain higher-level permissions.",
  "Credential Access": "The adversary is trying to steal account names and passwords.",
  "Lateral Movement": "The adversary is trying to move through your environment.",
  "Collection": "The adversary is trying to gather data of interest to their goal.",
  "Reconnaissance": "The adversary is trying to gather information they can use to plan for future operations.",
  "Resource Development": "The adversary is trying to establish resources they can use to support operations."
};
