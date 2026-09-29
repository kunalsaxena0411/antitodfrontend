import type { Playbook } from '../../../types';

export const DEMO_PLAYBOOKS: Playbook[] = [
    {
        id: 'pb-supply-chain',
        name: 'Supply Chain Compromise Response',
        description: 'Procedure for identifying and isolating compromised third-party software updates or dependencies.',
        severity: 'Critical',
        tags: ['Supply Chain', 'APT', 'Zero-Day'],
        startStepId: 'step-1',
        steps: {
            'step-1': {
                id: 'step-1',
                title: 'Identify Affected Vendor',
                description: 'Determine which third-party software or dependency has been compromised (e.g., SolarWinds, XZ Utils).',
                type: 'DECISION',
                options: [
                    { label: 'Confirmed Compromise', nextStepId: 'step-isolate', style: 'negative' },
                    { label: 'Unverified', nextStepId: 'step-monitor', style: 'neutral' }
                ]
            },
            'step-isolate': {
                id: 'step-isolate',
                title: 'Isolate Systems',
                description: 'Immediately isolate servers running the affected software from the internet and internal network segments.',
                type: 'ACTION',
                nextStepId: 'step-hunt'
            },
            'step-monitor': {
                id: 'step-monitor',
                title: 'Monitor for Anomalies',
                description: 'Enable verbose logging on the suspected vendor service and monitor for unauthorized network connections.',
                type: 'ACTION',
                nextStepId: 'step-hunt'
            },
            'step-hunt': {
                id: 'step-hunt',
                title: 'Threat Hunting',
                description: 'Search EDR logs for known IOCs associated with the supply chain actor (e.g., anomalous DLL loads, unusual C2 beacons).',
                type: 'AUTOMATION',
                automationId: 'enrich_all',
                nextStepId: 'step-report'
            },
            'step-report': {
                id: 'step-report',
                title: 'Incident Report',
                description: 'Document systems affected and IOCs discovered. Escalate to the incident response retainer if needed.',
                type: 'INPUT',
                inputType: 'text',
                nextStepId: 'step-close'
            },
            'step-close': {
                id: 'step-close',
                title: 'Case Closed',
                description: 'Mitigation applied and systems restored from clean backups.',
                type: 'ACTION'
            }
        }
    },
    {
        id: 'pb-insider-threat',
        name: 'Insider Threat Data Exfiltration',
        description: 'Workflow for handling suspected large-scale data exfiltration by an authenticated user.',
        severity: 'High',
        tags: ['Insider Threat', 'DLP', 'Data Exfiltration'],
        startStepId: 'step-1',
        steps: {
            'step-1': {
                id: 'step-1',
                title: 'Review DLP Alerts',
                description: 'Verify if the data transfer was approved (e.g., massive SharePoint download, USB copy).',
                type: 'DECISION',
                options: [
                    { label: 'Unauthorized', nextStepId: 'step-revoke', style: 'negative' },
                    { label: 'Authorized/Expected', nextStepId: 'step-close', style: 'positive' }
                ]
            },
            'step-revoke': {
                id: 'step-revoke',
                title: 'Revoke Access',
                description: 'Temporarily suspend the users AD account and terminate active sessions in the IdP (Okta/Azure AD).',
                type: 'ACTION',
                nextStepId: 'step-forensics'
            },
            'step-forensics': {
                id: 'step-forensics',
                title: 'Workstation Forensics',
                description: 'Image the users workstation. Check browser history for personal cloud storage uploads (e.g., Dropbox, Mega).',
                type: 'ACTION',
                nextStepId: 'step-legal'
            },
            'step-legal': {
                id: 'step-legal',
                title: 'Legal and HR Escalation',
                description: 'Engage HR and Legal counsel to determine the next steps regarding employee confrontation.',
                type: 'INPUT',
                inputType: 'text',
                nextStepId: 'step-close'
            },
            'step-close': {
                id: 'step-close',
                title: 'Case Closed',
                description: 'Investigation handed over to Legal/HR.',
                type: 'ACTION'
            }
        }
    },
    {
        id: 'pb-zero-day',
        name: 'Zero-Day Vulnerability Mitigation',
        description: 'Rapid response plan for newly disclosed, actively exploited vulnerabilities (e.g., Log4Shell).',
        severity: 'Critical',
        tags: ['Vulnerability', 'Zero-Day', 'Exploit'],
        startStepId: 'step-1',
        steps: {
            'step-1': {
                id: 'step-1',
                title: 'Assess Exposure',
                description: 'Run network scanners and query EDR to identify vulnerable software versions across the enterprise.',
                type: 'ACTION',
                nextStepId: 'step-2'
            },
            'step-2': {
                id: 'step-2',
                title: 'Apply Mitigations',
                description: 'Can a patch be applied immediately? If not, apply WAF rules or environment variable workarounds.',
                type: 'DECISION',
                options: [
                    { label: 'Patch Available', nextStepId: 'step-patch', style: 'positive' },
                    { label: 'No Patch', nextStepId: 'step-waf', style: 'negative' }
                ]
            },
            'step-patch': {
                id: 'step-patch',
                title: 'Emergency Patching',
                description: 'Deploy the patch to external-facing assets first, followed by internal servers.',
                type: 'ACTION',
                nextStepId: 'step-hunt'
            },
            'step-waf': {
                id: 'step-waf',
                title: 'WAF & Network Blocks',
                description: 'Implement virtual patching on the WAF to block known exploit payloads in HTTP headers.',
                type: 'ACTION',
                nextStepId: 'step-hunt'
            },
            'step-hunt': {
                id: 'step-hunt',
                title: 'Post-Exploitation Hunting',
                description: 'Assume breach. Hunt for web shells, unexpected outbound connections, and reverse shells on vulnerable hosts.',
                type: 'AUTOMATION',
                automationId: 'enrich_ip',
                nextStepId: 'step-report'
            },
            'step-report': {
                id: 'step-report',
                title: 'Status Report',
                description: 'Document the patching percentage and any indicators of compromise found during the hunt.',
                type: 'INPUT',
                inputType: 'text',
                nextStepId: 'step-close'
            },
            'step-close': {
                id: 'step-close',
                title: 'Remediation Complete',
                description: 'Vulnerability mitigated enterprise-wide.',
                type: 'ACTION'
            }
        }
    },
    {
        id: 'pb-cloud-exposure',
        name: 'Cloud Data Exposure (Public S3)',
        description: 'Workflow to secure and investigate publicly exposed cloud storage buckets.',
        severity: 'High',
        tags: ['Cloud', 'AWS', 'Data Leak'],
        startStepId: 'step-1',
        steps: {
            'step-1': {
                id: 'step-1',
                title: 'Verify Exposure',
                description: 'Test the bucket URL without authentication to confirm it is publicly readable or writable.',
                type: 'DECISION',
                options: [
                    { label: 'Public Access Confirmed', nextStepId: 'step-secure', style: 'negative' },
                    { label: 'False Positive', nextStepId: 'step-close', style: 'positive' }
                ]
            },
            'step-secure': {
                id: 'step-secure',
                title: 'Block Public Access',
                description: 'Enable "Block Public Access" at the account or bucket level. Revert bucket policy to deny public access.',
                type: 'ACTION',
                nextStepId: 'step-audit'
            },
            'step-audit': {
                id: 'step-audit',
                title: 'Audit Access Logs',
                description: 'Enable and review S3 server access logs or CloudTrail data events to see if data was downloaded by unauthorized IPs.',
                type: 'ACTION',
                nextStepId: 'step-report'
            },
            'step-report': {
                id: 'step-report',
                title: 'Impact Assessment',
                description: 'List the types of PII or sensitive data exposed and outline regulatory notification requirements.',
                type: 'INPUT',
                inputType: 'text',
                nextStepId: 'step-close'
            },
            'step-close': {
                id: 'step-close',
                title: 'Exposure Contained',
                description: 'Bucket secured and impact documented.',
                type: 'ACTION'
            }
        }
    },
    {
        id: 'pb-bec-fraud',
        name: 'BEC & Invoice Fraud Handling',
        description: 'Procedure to handle Business Email Compromise targeting finance and wire transfers.',
        severity: 'High',
        tags: ['Phishing', 'Fraud', 'Email'],
        startStepId: 'step-1',
        steps: {
            'step-1': {
                id: 'step-1',
                title: 'Halt Wire Transfers',
                description: 'Immediately contact the Finance department to freeze any pending outbound wire transfers.',
                type: 'ACTION',
                nextStepId: 'step-2'
            },
            'step-2': {
                id: 'step-2',
                title: 'Account Takeover Check',
                description: 'Review login history for the affected executives account for Impossible Travel or unfamiliar devices.',
                type: 'DECISION',
                options: [
                    { label: 'Compromised', nextStepId: 'step-reset', style: 'negative' },
                    { label: 'Spoofing Only', nextStepId: 'step-block', style: 'neutral' }
                ]
            },
            'step-reset': {
                id: 'step-reset',
                title: 'Credential Reset',
                description: 'Reset the executives Active Directory password and revoke all active session tokens in Office 365/Google Workspace.',
                type: 'ACTION',
                nextStepId: 'step-rules'
            },
            'step-block': {
                id: 'step-block',
                title: 'Gateway Blocking',
                description: 'Block the look-alike domain and sender IP on the email gateway.',
                type: 'ACTION',
                nextStepId: 'step-rules'
            },
            'step-rules': {
                id: 'step-rules',
                title: 'Audit Inbox Rules',
                description: 'Check the compromised inbox for malicious forwarding rules or inbox sweeps (e.g., auto-deleting emails with "invoice").',
                type: 'ACTION',
                nextStepId: 'step-report'
            },
            'step-report': {
                id: 'step-report',
                title: 'Fraud Escalation',
                description: 'Document the incident and report to relevant authorities (e.g., IC3) if funds were lost.',
                type: 'INPUT',
                inputType: 'text',
                nextStepId: 'step-close'
            },
            'step-close': {
                id: 'step-close',
                title: 'Case Closed',
                description: 'Email infrastructure secured and fraud mitigated.',
                type: 'ACTION'
            }
        }
    },
    {
        id: 'pb-ot-ransomware',
        name: 'OT/ICS Ransomware Isolation',
        description: 'Emergency isolation plan when ransomware is detected bridging IT to OT networks.',
        severity: 'Critical',
        tags: ['Ransomware', 'ICS', 'Critical Infrastructure'],
        startStepId: 'step-1',
        steps: {
            'step-1': {
                id: 'step-1',
                title: 'Verify OT Spread',
                description: 'Determine if the ransomware has crossed the IT/OT boundary firewall into the plant network.',
                type: 'DECISION',
                options: [
                    { label: 'Crossed Boundary', nextStepId: 'step-sever', style: 'negative' },
                    { label: 'IT Only', nextStepId: 'step-it-lockdown', style: 'neutral' }
                ]
            },
            'step-sever': {
                id: 'step-sever',
                title: 'Sever IT/OT Link',
                description: 'Physically disconnect or drop the firewall interface connecting the IT network to the OT/SCADA network.',
                type: 'ACTION',
                nextStepId: 'step-safety'
            },
            'step-it-lockdown': {
                id: 'step-it-lockdown',
                title: 'IT Lockdown',
                description: 'Initiate IT-side ransomware containment to protect the boundary.',
                type: 'ACTION',
                nextStepId: 'step-safety'
            },
            'step-safety': {
                id: 'step-safety',
                title: 'Safety Check',
                description: 'Contact plant managers. Ensure physical safety protocols and manual override systems are operational.',
                type: 'ACTION',
                nextStepId: 'step-hunt'
            },
            'step-hunt': {
                id: 'step-hunt',
                title: 'OT Environment Hunt',
                description: 'Use passive network monitoring (e.g., Claroty, Dragos) to hunt for lateral movement indicators in the OT network.',
                type: 'AUTOMATION',
                automationId: 'enrich_all',
                nextStepId: 'step-report'
            },
            'step-report': {
                id: 'step-report',
                title: 'Incident Post-Mortem',
                description: 'Document the vector of IT/OT compromise and production downtime incurred.',
                type: 'INPUT',
                inputType: 'text',
                nextStepId: 'step-close'
            },
            'step-close': {
                id: 'step-close',
                title: 'Recovery Phase',
                description: 'Begin safe restoration of the IT/OT bridge once both environments are verified clean.',
                type: 'ACTION'
            }
        }
    }
];
