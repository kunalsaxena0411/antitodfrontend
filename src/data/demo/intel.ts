export interface ResearchResult {
  query: string;
  text: string;
  sources: { title: string; uri: string }[];
  timestamp: number;
  isCached?: boolean;
}

export const DEMO_INTEL_HISTORY: ResearchResult[] = [
  {
    query: "Lazarus Group TTPs recent attacks",
    text: "### Lazarus Group Activity Summary\n\nRecent intelligence indicates that the **Lazarus Group** (APT38) has been heavily focusing on cryptocurrency exchanges and decentralized finance (DeFi) platforms. \n\n#### Key Tactics, Techniques, and Procedures (TTPs):\n1. **Initial Access**: Extensive use of spearphishing campaigns targeting employees of cryptocurrency firms, often masquerading as lucrative job offers via LinkedIn or email.\n2. **Execution**: Deployment of custom trojanized cryptocurrency trading applications (e.g., AppleJeus).\n3. **Defense Evasion**: Advanced obfuscation of payloads, disabling of endpoint detection and response (EDR) agents, and leveraging legitimate cloud services for C2 communication.\n4. **Credential Access**: Use of tools like Mimikatz and customized keyloggers to steal credentials and private keys.\n5. **Exfiltration**: Rapid draining of hot wallets using automated scripts once access is secured.",
    sources: [
      { title: "CISA Alert: Lazarus Group Cryptocurrency Theft", uri: "https://www.cisa.gov" },
      { title: "Mandiant Threat Research: APT38", uri: "https://www.mandiant.com" }
    ],
    timestamp: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago
    isCached: true
  },
  {
    query: "CVE-2023-46805 details and mitigation",
    text: "### Vulnerability Profile: CVE-2023-46805\n\n**CVE-2023-46805** is a critical authentication bypass vulnerability affecting Ivanti Connect Secure (ICS) and Ivanti Policy Secure (IPS) gateways. It allows an unauthenticated attacker to access restricted resources by bypassing control checks.\n\n#### Exploitation\nThis vulnerability is frequently chained with **CVE-2024-21887** (a command injection vulnerability) to achieve unauthenticated remote code execution (RCE) on vulnerable appliances.\n\n#### Mitigation Strategies\n- **Immediate Action**: Apply the mitigation XML file provided by Ivanti immediately if patches cannot be applied.\n- **Patching**: Upgrade to the latest patched firmware versions released by the vendor.\n- **Monitoring**: Monitor access logs for anomalous requests to the `/api/v1/totp/user-backup-code/` endpoint.\n- **Compromise Verification**: Utilize the internal Integrity Checker Tool (ICT) provided by Ivanti, though external integrity checking is recommended as the internal tool has been previously bypassed by advanced threat actors.",
    sources: [
      { title: "NVD - CVE-2023-46805", uri: "https://nvd.nist.gov" },
      { title: "Ivanti Security Advisory", uri: "https://forums.ivanti.com" }
    ],
    timestamp: Date.now() - 1000 * 60 * 60 * 24, // 1 day ago
    isCached: true
  },
  {
    query: "Indicators for Akira Ransomware",
    text: "### Akira Ransomware Threat Intelligence\n\n**Akira** is a ransomware-as-a-service (RaaS) group that emerged in early 2023, primarily targeting small and medium-sized businesses across North America, Europe, and Australia.\n\n#### Known Indicators of Compromise (IOCs)\n\n**Network Indicators:**\n- `185.213.155.161` (C2 Server)\n- `45.141.215.111` (Data Exfiltration destination)\n\n**File Hashes (SHA-256):**\n- `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z` (Akira Windows payload)\n- `c9b8a7f6e5d4c3b2a10987654321fedcba0987654321fedcb` (Akira ESXi payload)\n\n#### Defensive Posture\nAkira actors typically gain initial access through compromised VPN credentials (especially Cisco ASA) without MFA enabled. Ensure all external-facing VPNs require robust Multi-Factor Authentication.",
    sources: [
      { title: "FBI Flash: Akira Ransomware", uri: "https://www.ic3.gov" },
      { title: "Sophos X-Ops Intel", uri: "https://news.sophos.com" }
    ],
    timestamp: Date.now() - 1000 * 60 * 60 * 48, // 2 days ago
    isCached: true
  }
];
