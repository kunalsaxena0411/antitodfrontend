
import { Playbook } from '../types';

export const PLAYBOOKS: Playbook[] = [
    {
        id: 'pb-phishing',
        name: 'Phishing Investigation',
        description: 'Standard procedure for analyzing suspicious emails, domains, and sender infrastructure.',
        severity: 'High',
        tags: ['Email', 'Social Engineering'],
        startStepId: 'step-1',
        steps: {
            'step-1': {
                id: 'step-1',
                title: 'Initial Assessment',
                description: 'Review the provided indicators (Sender, Subject, URL). Does the email originate from an external source?',
                type: 'DECISION',
                options: [
                    { label: 'External Sender', nextStepId: 'step-2', style: 'negative' },
                    { label: 'Internal Sender', nextStepId: 'step-internal', style: 'neutral' }
                ]
            },
            'step-internal': {
                id: 'step-internal',
                title: 'Internal Account Check',
                description: 'Verify if the internal account is compromised. Check login logs for anomalies.',
                type: 'ACTION',
                nextStepId: 'step-containment'
            },
            'step-2': {
                id: 'step-2',
                title: 'Reputation Check',
                description: 'Analyze the sender IP and embedded URLs against threat intelligence feeds.',
                type: 'AUTOMATION',
                automationId: 'enrich_all',
                nextStepId: 'step-3'
            },
            'step-3': {
                id: 'step-3',
                title: 'Malicious Verdict',
                description: 'Based on the reputation check, is the infrastructure malicious?',
                type: 'DECISION',
                options: [
                    { label: 'Yes, Malicious', nextStepId: 'step-containment', style: 'negative' },
                    { label: 'No, Benign', nextStepId: 'step-close', style: 'positive' }
                ]
            },
            'step-containment': {
                id: 'step-containment',
                title: 'Containment',
                description: 'Block the sender domain on the Email Gateway. Block URL on Web Proxy. Reset compromised credentials if applicable.',
                type: 'ACTION',
                nextStepId: 'step-report'
            },
            'step-report': {
                id: 'step-report',
                title: 'Final Report',
                description: 'Document findings and close the case.',
                type: 'INPUT',
                inputType: 'text',
                nextStepId: 'step-close'
            },
            'step-close': {
                id: 'step-close',
                title: 'Case Closed',
                description: 'Investigation complete.',
                type: 'ACTION'
            }
        }
    },
    {
        id: 'pb-c2',
        name: 'Malware C2 Containment',
        description: 'Response workflow for detected Command & Control traffic beaconing.',
        severity: 'Critical',
        tags: ['Network', 'Malware'],
        startStepId: 'step-1',
        steps: {
            'step-1': {
                id: 'step-1',
                title: 'Verify Traffic',
                description: 'Review the packet capture or logs. Is the traffic periodic (beaconing) or continuous?',
                type: 'DECISION',
                options: [
                    { label: 'Confirmed Beaconing', nextStepId: 'step-2', style: 'negative' },
                    { label: 'False Positive', nextStepId: 'step-close', style: 'positive' }
                ]
            },
            'step-2': {
                id: 'step-2',
                title: 'Endpoint Isolation',
                description: 'Isolate the affected host from the network immediately to prevent lateral movement.',
                type: 'ACTION',
                nextStepId: 'step-3'
            },
            'step-3': {
                id: 'step-3',
                title: 'IOC Enrichment',
                description: 'Gather intelligence on the destination IP/Domain.',
                type: 'AUTOMATION',
                automationId: 'enrich_ip',
                nextStepId: 'step-4'
            },
            'step-4': {
                id: 'step-4',
                title: 'Firewall Block',
                description: 'Add the C2 IP/Domain to the blocklist on the perimeter firewall.',
                type: 'ACTION',
                nextStepId: 'step-report'
            },
            'step-report': {
                id: 'step-report',
                title: 'Incident Report',
                description: 'Summarize the incident details, affected host, and C2 infrastructure.',
                type: 'INPUT',
                inputType: 'text',
                nextStepId: 'step-close'
            },
            'step-close': {
                id: 'step-close',
                title: 'Case Closed',
                description: 'Remediation complete.',
                type: 'ACTION'
            }
        }
    },
    {
        id: 'pb-ransom',
        name: 'Ransomware Response',
        description: 'Emergency procedure for suspected ransomware activity.',
        severity: 'Critical',
        tags: ['Ransomware', 'Crisis'],
        startStepId: 'step-1',
        steps: {
            'step-1': {
                id: 'step-1',
                title: 'Disconnect Network',
                description: 'IMMEDIATELY disconnect the infected host from the network (physically unplug or disable vNIC).',
                type: 'ACTION',
                nextStepId: 'step-2'
            },
            'step-2': {
                id: 'step-2',
                title: 'Assess Spread',
                description: 'Check adjacent systems and file shares for encrypted files or ransom notes.',
                type: 'DECISION',
                options: [
                    { label: 'Spread Detected', nextStepId: 'step-lockdown', style: 'negative' },
                    { label: 'Isolated', nextStepId: 'step-image', style: 'neutral' }
                ]
            },
            'step-lockdown': {
                id: 'step-lockdown',
                title: 'Full Lockdown',
                description: 'Initiate site-wide network lockdown. Disable SMB and RDP at the firewall level.',
                type: 'ACTION',
                nextStepId: 'step-image'
            },
            'step-image': {
                id: 'step-image',
                title: 'Forensic Capture',
                description: 'Take a memory dump (if possible) and disk image of the affected system for analysis.',
                type: 'ACTION',
                nextStepId: 'step-identify'
            },
            'step-identify': {
                id: 'step-identify',
                title: 'Identify Strain',
                description: 'Upload ransom note or encrypted file sample to ID Ransomware (or check extension).',
                type: 'INPUT',
                inputType: 'text',
                nextStepId: 'step-report'
            },
            'step-report': {
                id: 'step-report',
                title: 'Crisis Management',
                description: 'Notify legal and leadership. Do not contact the threat actor without authorization.',
                type: 'ACTION',
                nextStepId: 'step-close'
            },
            'step-close': {
                id: 'step-close',
                title: 'Recovery Phase',
                description: 'Proceed to backup restoration and root cause analysis.',
                type: 'ACTION'
            }
        }
    },
    {
        id: 'pb-ddos',
        name: 'DDoS Mitigation',
        description: 'Procedure for responding to volumetric or application layer DDoS attacks.',
        severity: 'High',
        tags: ['Network', 'Availability'],
        startStepId: 'step-1',
        steps: {
            'step-1': {
                id: 'step-1',
                title: 'Identify Attack Vector',
                description: 'Analyze traffic patterns. Is this Volumetric (UDP/ICMP Flood) or Application Layer (HTTP Flood)?',
                type: 'DECISION',
                options: [
                    { label: 'Volumetric (L3/L4)', nextStepId: 'step-scrubbing', style: 'negative' },
                    { label: 'Application (L7)', nextStepId: 'step-waf', style: 'neutral' }
                ]
            },
            'step-scrubbing': {
                id: 'step-scrubbing',
                title: 'Activate Scrubbing',
                description: 'Contact ISP or Cloud Provider (e.g., Cloudflare, Akamai) to reroute traffic through scrubbing centers.',
                type: 'ACTION',
                nextStepId: 'step-monitor'
            },
            'step-waf': {
                id: 'step-waf',
                title: 'WAF Tuning',
                description: 'Enable "Under Attack" mode. Rate limit by IP. Challenge (CAPTCHA) suspicious User-Agents.',
                type: 'ACTION',
                nextStepId: 'step-monitor'
            },
            'step-monitor': {
                id: 'step-monitor',
                title: 'Monitor Stability',
                description: 'Observe traffic levels. Has service availability been restored?',
                type: 'DECISION',
                options: [
                    { label: 'Stable', nextStepId: 'step-report', style: 'positive' },
                    { label: 'Still Degrading', nextStepId: 'step-escalate', style: 'negative' }
                ]
            },
            'step-escalate': {
                id: 'step-escalate',
                title: 'Escalate Response',
                description: 'Engage DDoS mitigation vendor emergency support. Prepare for failover to DR site.',
                type: 'ACTION',
                nextStepId: 'step-report'
            },
            'step-report': {
                id: 'step-report',
                title: 'After-Action Report',
                description: 'Log peak bandwidth, duration, and specific attack signatures observed.',
                type: 'INPUT',
                inputType: 'text',
                nextStepId: 'step-close'
            },
            'step-close': {
                id: 'step-close',
                title: 'Mitigation Complete',
                description: 'Return to normal monitoring posture.',
                type: 'ACTION'
            }
        }
    },
    // --- ADVANCED PLAYBOOKS ---
    {
        id: 'pb-golden-ticket',
        name: 'Golden Ticket Response',
        description: 'Critical response procedure for confirmed Kerberos Golden Ticket (TGT) compromise.',
        severity: 'Critical',
        tags: ['Identity', 'Active Directory', 'APT'],
        startStepId: 'step-verify',
        steps: {
            'step-verify': {
                id: 'step-verify',
                title: 'Verify Artifacts',
                description: 'Confirm the detection. Look for Ticket Granting Tickets (TGT) with lifetimes exceeding 10 hours or non-existent SIDs.',
                type: 'DECISION',
                options: [
                    { label: 'Confirmed Forgery', nextStepId: 'step-reset-krbtgt', style: 'negative' },
                    { label: 'Benign', nextStepId: 'step-close', style: 'positive' }
                ]
            },
            'step-reset-krbtgt': {
                id: 'step-reset-krbtgt',
                title: 'Reset KRBTGT (Twice)',
                description: 'Reset the password for the KRBTGT account TWICE. This invalidates all current Golden Tickets immediately. Ensure replication occurs between resets.',
                type: 'ACTION',
                nextStepId: 'step-monitor-dc'
            },
            'step-monitor-dc': {
                id: 'step-monitor-dc',
                title: 'Monitor DC Logs',
                description: 'Watch for Event ID 4769 failures (0x1f - Decryption failed) indicating attackers attempting to use invalidated tickets.',
                type: 'ACTION',
                nextStepId: 'step-audit-admins'
            },
            'step-audit-admins': {
                id: 'step-audit-admins',
                title: 'Audit Admin Group',
                description: 'Verify membership of Domain Admins, Enterprise Admins, and Schema Admins. Remove unauthorized accounts.',
                type: 'ACTION',
                nextStepId: 'step-report'
            },
            'step-report': {
                id: 'step-report',
                title: 'Incident Summary',
                description: 'Document the timestamp of KRBTGT reset and any compromised accounts identified.',
                type: 'INPUT',
                inputType: 'text',
                nextStepId: 'step-close'
            },
            'step-close': {
                id: 'step-close',
                title: 'Remediation Complete',
                description: 'Active Directory integrity restored.',
                type: 'ACTION'
            }
        }
    },
    {
        id: 'pb-aws-compromise',
        name: 'AWS IAM Compromise',
        description: 'Response for leaked or misused AWS Access Keys.',
        severity: 'Critical',
        tags: ['Cloud', 'AWS', 'Identity'],
        startStepId: 'step-validate',
        steps: {
            'step-validate': {
                id: 'step-validate',
                title: 'Validate Activity',
                description: 'Check CloudTrail for "UnauthorizedOperation" errors or usage from anomalous IP addresses for the suspected key.',
                type: 'DECISION',
                options: [
                    { label: 'Confirmed Misuse', nextStepId: 'step-deactivate', style: 'negative' },
                    { label: 'Safe', nextStepId: 'step-close', style: 'positive' }
                ]
            },
            'step-deactivate': {
                id: 'step-deactivate',
                title: 'Deactivate Key',
                description: 'In IAM Console, set the compromised Access Key status to Inactive. Do not delete yet (needed for forensics).',
                type: 'ACTION',
                nextStepId: 'step-policy'
            },
            'step-policy': {
                id: 'step-policy',
                title: 'Attach Deny Policy',
                description: 'Attach an inline "DenyAll" policy to the associated IAM User/Role to stop all active sessions immediately.',
                type: 'ACTION',
                nextStepId: 'step-audit'
            },
            'step-audit': {
                id: 'step-audit',
                title: 'Resource Audit',
                description: 'Review resources created during the compromise window (EC2, S3, Lambda). Terminate unauthorized instances.',
                type: 'ACTION',
                nextStepId: 'step-rotate'
            },
            'step-rotate': {
                id: 'step-rotate',
                title: 'Rotate & Restore',
                description: 'Create new Access Keys. Remove the Deny policy once the user password is reset and MFA is enforced.',
                type: 'ACTION',
                nextStepId: 'step-report'
            },
            'step-report': {
                id: 'step-report',
                title: 'Cloud Forensics',
                description: 'Log the IP addresses used by the attacker and the total cost impact of unauthorized resources.',
                type: 'INPUT',
                inputType: 'text',
                nextStepId: 'step-close'
            },
            'step-close': {
                id: 'step-close',
                title: 'Incident Closed',
                description: 'Cloud environment secured.',
                type: 'ACTION'
            }
        }
    }
];

export const getPlaybook = (id: string) => PLAYBOOKS.find(p => p.id === id);

