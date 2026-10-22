import api from '../client';
import { API_ENDPOINTS } from '../../config/config';

export type BillingPlanId = 'basic' | 'pro' | 'enterprise' | (string & {});

export interface BillingResourceUsage {
  used: number;
  limit: number;
  percent?: number;
}

export interface BillingPlanInfo {
  id: BillingPlanId;
  label: string;
  priceUsdPerMonth?: number;
  status: 'trial' | 'active' | 'past_due' | 'cancelled' | string;
  active: boolean;
  paidUntil?: string | null;
  daysLeft?: number | null;
}

export interface BillingWarning {
  code: string;
  message: string;
}

export interface BillingUpgradeInfo {
  available: boolean;
  nextPlan?: string;
  priceUsdPerMonth?: number;
  message?: string;
  contact?: string | null;
}

export interface BillingUsage {
  platform?: boolean;
  customer?: {
    CustomerID: string;
    Name: string | null;
  };
  plan?: BillingPlanInfo;
  usage?: {
    servers?: BillingResourceUsage;
    honeypots?: BillingResourceUsage;
    users?: BillingResourceUsage;
  };
  retentionDays?: number;
  exportFormats?: string[];
  warnings?: BillingWarning[];
  upgrade?: BillingUpgradeInfo;
  message?: string;
}

export type BillingUsageResponse = BillingUsage;

export interface BillingPlanCard {
  id: BillingPlanId;
  label: string;
  priceUsdPerMonth: number;
  maxServers: number;
  maxUsers: number;
  retentionDays: number;
  exportFormats: string[];
  current?: boolean;
}

export interface BillingPlansResponse {
  plans: BillingPlanCard[];
  currentPlan: BillingPlanId | null;
  contact: string | null;
}

export interface BillingHistoryItem {
  type: string;
  label: string;
  at: string | null;
}

export interface BillingHistoryResponse {
  platform?: boolean;
  events: BillingHistoryItem[];
}

export interface SubscribeResponse {
  subscriptionId: string;
  razorpayCustomerId: string;
  plan: BillingPlanId;
  totalCount?: number;
  status: string;
  shortUrl: string | null;
  checkout: {
    keyId: string;
    subscriptionId: string;
    name: string;
    description: string;
    prefill: { email: string; name: string };
    notes: { customer_id: string; plan: string };
  };
}

export interface SubscriptionStatus {
  platform?: boolean;
  customerId?: string;
  plan?: BillingPlanId;
  planStatus?: string;
  paidUntil?: string | null;
  razorpayCustomerId?: string | null;
  razorpaySubscriptionId?: string | null;
  gatewayConfigured?: boolean;
  remote?: {
    status: string | null;
    shortUrl: string | null;
    currentEnd: string | null;
  } | null;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-razorpay]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Razorpay script failed')));
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    s.dataset.razorpay = '1';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Razorpay Checkout'));
    document.body.appendChild(s);
  });
}

export const billingService = {
  /**
   * Get current customer's plan, usage quotas, and expiration details.
   * Returns { platform: true } if called by platform staff.
   */
  getUsage: async (): Promise<BillingUsage> => {
    const { data } = await api.get<BillingUsage>(API_ENDPOINTS.BILLING_USAGE);
    return data;
  },

  /**
   * Get available billing plans catalog.
   */
  getPlans: async (): Promise<BillingPlansResponse> => {
    const { data } = await api.get<BillingPlansResponse>(API_ENDPOINTS.BILLING_PLANS);
    return data;
  },

  /**
   * Get customer's billing event history.
   */
  getHistory: async (): Promise<BillingHistoryResponse> => {
    const { data } = await api.get<BillingHistoryResponse>(API_ENDPOINTS.BILLING_HISTORY);
    return data;
  },

  /**
   * Get customer's current Razorpay subscription state.
   */
  getSubscription: async (): Promise<SubscriptionStatus> => {
    const { data } = await api.get<SubscriptionStatus>(API_ENDPOINTS.BILLING_SUBSCRIPTION);
    return data;
  },

  /**
   * Create Razorpay subscription for specified plan.
   * Backend requires permission rbac.users.manage.
   */
  subscribe: async (plan: BillingPlanId, totalCount?: number): Promise<SubscribeResponse> => {
    const { data } = await api.post<SubscribeResponse>(API_ENDPOINTS.BILLING_SUBSCRIBE, {
      plan,
      totalCount,
    });
    return data;
  },

  /**
   * Change plan for an existing Razorpay subscription.
   * Backend requires permission rbac.users.manage.
   */
  changePlan: async (plan: BillingPlanId, scheduleChangeAt: 'now' | 'cycle_end' = 'now') => {
    const { data } = await api.post(API_ENDPOINTS.BILLING_CHANGE_PLAN, {
      plan,
      scheduleChangeAt,
    });
    return data;
  },

  /**
   * Cancel Razorpay subscription.
   * Backend requires permission rbac.users.manage.
   */
  cancel: async (atPeriodEnd = true) => {
    const { data } = await api.post(API_ENDPOINTS.BILLING_CANCEL, { atPeriodEnd });
    return data;
  },

  /**
   * Opens Razorpay Checkout for a subscription created by /billing/subscribe.
   * Resolves when the customer completes auth/payment; rejects on dismiss/failure.
   */
  openCheckout: async (
    checkout: SubscribeResponse['checkout'],
  ): Promise<Record<string, unknown>> => {
    await loadRazorpayScript();
    if (!window.Razorpay) throw new Error('Razorpay Checkout is not available');

    const envKey = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_RAZORPAY_KEY_ID;
    const key = checkout.keyId || envKey || '';

    return new Promise((resolve, reject) => {
      const rzp = new window.Razorpay!({
        key,
        subscription_id: checkout.subscriptionId,
        name: checkout.name || 'ANTITODE',
        description: checkout.description || 'Subscription',
        prefill: checkout.prefill,
        notes: checkout.notes,
        theme: { color: '#d62828' },
        handler: (response: Record<string, unknown>) => resolve(response),
        modal: {
          ondismiss: () => reject(new Error('Checkout closed')),
        },
      });
      rzp.open();
    });
  },
};
