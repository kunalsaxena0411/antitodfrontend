/**
 * ANTITODE Plan & Tiering Configuration
 *
 * Sourced from the Product Launch Tiering Specification:
 * - Basic: 3 Honeypots, CSV export only, Community Feeds
 * - Pro: 10 Honeypots, CSV + JSON export (Task #78), Automated Scoring
 * - Enterprise: Unlimited Honeypots, STIX 2.1 + PDF + TAXII push, SOC connectors
 */

export type PlanTier = 'basic' | 'pro' | 'enterprise';

export interface PlanConfig {
  id: PlanTier;
  name: string;
  badge: string;
  priceMonthly: number;
  billingPeriod: string;
  description: string;
  maxHoneypots: number;
  maxEventsPerMonth: number;
  retentionDays: number;
  exportFormats: Array<'CSV' | 'JSON' | 'STIX' | 'PDF'>;
  features: string[];
  popular?: boolean;
}

export const PLAN_TIERS: Record<PlanTier, PlanConfig> = {
  basic: {
    id: 'basic',
    name: 'Basic',
    badge: 'Starter',
    priceMonthly: 0,
    billingPeriod: 'Free forever',
    description: 'Essential telemetry and honeypot monitoring for small setups and evaluation.',
    maxHoneypots: 3,
    maxEventsPerMonth: 10000,
    retentionDays: 7,
    exportFormats: ['CSV'],
    features: [
      'Up to 3 active honeypots',
      'CSV log & indicator export',
      'Community threat intelligence feeds',
      'Standard 7-day log retention',
      'Real-time attack map view',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    badge: 'Recommended',
    priceMonthly: 49,
    billingPeriod: '$49 / month',
    description: 'Advanced threat intelligence, extended quotas, and structured JSON integrations.',
    maxHoneypots: 10,
    maxEventsPerMonth: 100000,
    retentionDays: 30,
    exportFormats: ['CSV', 'JSON'],
    features: [
      'Up to 10 active honeypots',
      'JSON + CSV automated threat exports',
      'Automated threat scoring & heuristics',
      'MITRE ATT&CK technique mapping',
      '30-day forensic log history',
      'Priority alert webhooks',
    ],
    popular: true,
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    badge: 'Full Defense',
    priceMonthly: 199,
    billingPeriod: '$199 / month',
    description: 'Full-spectrum cyber defense, STIX 2.1 & TAXII sharing, and dedicated SOC connectors.',
    maxHoneypots: 9999,
    maxEventsPerMonth: 1000000,
    retentionDays: 90,
    exportFormats: ['CSV', 'JSON', 'STIX', 'PDF'],
    features: [
      'Unlimited honeypot deployments',
      'Full STIX 2.1 bundle & PDF threat reports',
      'Built-in TAXII 2.1 server & remote push',
      '90-day extended forensics retention',
      'Custom YARA / Sigma detection rules',
      'Dedicated 24/7 SOC integration',
    ],
  },
};

const PLAN_STORAGE_KEY = 'antitode_active_plan';

/**
 * Get active plan from localStorage (defaults to 'basic' for launch demo).
 */
export function getStoredPlan(): PlanTier {
  try {
    const stored = localStorage.getItem(PLAN_STORAGE_KEY);
    if (stored === 'basic' || stored === 'pro' || stored === 'enterprise') {
      return stored;
    }
  } catch {
    // Ignore storage errors
  }
  return 'basic';
}

/**
 * Persist user plan choice in localStorage.
 */
export function setStoredPlan(tier: PlanTier): void {
  try {
    localStorage.setItem(PLAN_STORAGE_KEY, tier);
  } catch {
    // Ignore storage errors
  }
}
