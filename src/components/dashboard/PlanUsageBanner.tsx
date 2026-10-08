import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CreditCard,
  Download,
  ExternalLink,
  Layers,
  Lock,
  Server,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import {
  PLAN_TIERS,
  getStoredPlan,
  setStoredPlan,
  type PlanTier,
} from '../../data/planTiering';

interface PlanUsageBannerProps {
  /** Count of active honeypots deployed */
  honeypotCount: number;
  /** Total events ingested in current period */
  eventCount: number;
  /** Optional callback when user clicks navigate to billing */
  onNavigateToBilling?: () => void;
}

export default function PlanUsageBanner({
  honeypotCount,
  eventCount,
  onNavigateToBilling,
}: PlanUsageBannerProps) {
  const [currentPlan, setCurrentPlan] = useState<PlanTier>(getStoredPlan);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);

  const plan = PLAN_TIERS[currentPlan];
  const maxHoneypots = plan.maxHoneypots;
  const maxEvents = plan.maxEventsPerMonth;

  // Usage ratios
  const honeypotRatio = Math.min(100, Math.round((honeypotCount / maxHoneypots) * 100));
  const eventRatio = Math.min(100, Math.round((eventCount / maxEvents) * 100));

  const isNearLimit = honeypotRatio >= 75 || eventRatio >= 75;
  const isBasic = currentPlan === 'basic';
  const isPro = currentPlan === 'pro';

  const handleSelectPlan = (tier: PlanTier) => {
    setCurrentPlan(tier);
    setStoredPlan(tier);
    setIsModalOpen(false);
  };

  return (
    <div className="at-plan-usage-section">
      {/* ── Top Upgrade Notice (for non-enterprise users) ── */}
      {isBasic && !isBannerDismissed && (
        <div className="at-plan-upgrade-banner" role="region" aria-label="Subscription upgrade notice">
          <div className="at-plan-upgrade-left">
            <span className="at-plan-upgrade-icon">
              <Sparkles size={16} />
            </span>
            <div className="at-plan-upgrade-copy">
              <strong>Unlock Pro Capabilities: JSON Exports &amp; 10 Honeypots</strong>
              <p>
                Your Basic plan includes CSV export only. Upgrade to Pro to enable automated JSON threat feeds,
                deploy up to 10 honeypots, and access automated MITRE ATT&amp;CK scoring.
              </p>
            </div>
          </div>

          <div className="at-plan-upgrade-actions">
            <button
              type="button"
              className="at-btn at-btn-primary at-btn-sm at-plan-upgrade-cta"
              onClick={() => setIsModalOpen(true)}
            >
              <Zap size={13} />
              Upgrade to Pro — $49/mo
            </button>
            <button
              type="button"
              className="at-plan-banner-dismiss"
              onClick={() => setIsBannerDismissed(true)}
              aria-label="Dismiss banner"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Main Plan & Usage Quota Card ── */}
      <div className="at-saas-panel at-plan-quota-card">
        <div className="at-plan-quota-header">
          <div className="at-plan-quota-title-wrap">
            <div className="at-plan-badge-group">
              <span className={`at-plan-tag at-plan-tag-${currentPlan}`}>
                <CreditCard size={12} />
                {plan.name} Plan
              </span>
              <span className="at-plan-sub-badge">{plan.badge}</span>
            </div>
            <h3 className="at-plan-heading">Resource Quotas &amp; Ingestion Limits</h3>
            <p className="at-plan-description">
              Current subscription entitlement and telemetry usage for this billing cycle.
            </p>
          </div>

          <div className="at-plan-quota-actions">
            <button
              type="button"
              className="at-btn at-btn-secondary at-btn-sm"
              onClick={() => setIsModalOpen(true)}
            >
              <Layers size={13} />
              Change Plan
            </button>
            {isBasic && (
              <button
                type="button"
                className="at-btn at-btn-primary at-btn-sm"
                onClick={() => setIsModalOpen(true)}
              >
                <ArrowRight size={13} />
                Upgrade
              </button>
            )}
          </div>
        </div>

        <div className="at-plan-meters-grid">
          {/* Meter 1: Honeypots */}
          <div className="at-plan-meter-card">
            <div className="at-plan-meter-top">
              <span className="at-plan-meter-label">
                <Server size={14} />
                Active Honeypots
              </span>
              <span className="at-plan-meter-val">
                <strong>{honeypotCount}</strong> / {maxHoneypots >= 9999 ? '∞' : maxHoneypots}
              </span>
            </div>
            <div className="at-plan-progress-track">
              <div
                className={`at-plan-progress-fill ${
                  honeypotRatio >= 90 ? 'is-danger' : honeypotRatio >= 70 ? 'is-warning' : 'is-normal'
                }`}
                style={{ width: `${maxHoneypots >= 9999 ? 25 : honeypotRatio}%` }}
              />
            </div>
            <div className="at-plan-meter-sub">
              {maxHoneypots >= 9999 ? (
                <span>Unlimited deployments enabled</span>
              ) : honeypotCount >= maxHoneypots ? (
                <span className="at-text-danger">
                  <AlertTriangle size={11} /> Quota reached — upgrade to add more
                </span>
              ) : (
                <span>{maxHoneypots - honeypotCount} slot{maxHoneypots - honeypotCount === 1 ? '' : 's'} available</span>
              )}
            </div>
          </div>

          {/* Meter 2: Monthly Events */}
          <div className="at-plan-meter-card">
            <div className="at-plan-meter-top">
              <span className="at-plan-meter-label">
                <Zap size={14} />
                Monthly Ingestion
              </span>
              <span className="at-plan-meter-val">
                <strong>{eventCount.toLocaleString()}</strong> /{' '}
                {maxEvents >= 1000000 ? '∞' : maxEvents.toLocaleString()}
              </span>
            </div>
            <div className="at-plan-progress-track">
              <div
                className={`at-plan-progress-fill ${
                  eventRatio >= 90 ? 'is-danger' : eventRatio >= 70 ? 'is-warning' : 'is-normal'
                }`}
                style={{ width: `${maxEvents >= 1000000 ? 15 : Math.max(8, eventRatio)}%` }}
              />
            </div>
            <div className="at-plan-meter-sub">
              <span>{plan.retentionDays}-day forensic retention</span>
            </div>
          </div>

          {/* Meter 3: Export Formats Entitlement */}
          <div className="at-plan-meter-card">
            <div className="at-plan-meter-top">
              <span className="at-plan-meter-label">
                <Download size={14} />
                Export Entitlements
              </span>
              <span className="at-plan-meter-val">
                <small>{plan.exportFormats.length} format{plan.exportFormats.length === 1 ? '' : 's'}</small>
              </span>
            </div>
            <div className="at-plan-formats-pills">
              <span className="at-format-tag is-enabled" title="CSV Export included">
                <Check size={10} /> CSV
              </span>
              <span
                className={`at-format-tag ${plan.exportFormats.includes('JSON') ? 'is-enabled' : 'is-locked'}`}
                title={plan.exportFormats.includes('JSON') ? 'JSON Export included (Pro)' : 'Requires Pro Plan'}
              >
                {plan.exportFormats.includes('JSON') ? <Check size={10} /> : <Lock size={10} />} JSON (Pro)
              </span>
              <span
                className={`at-format-tag ${plan.exportFormats.includes('STIX') ? 'is-enabled' : 'is-locked'}`}
                title={plan.exportFormats.includes('STIX') ? 'STIX/TAXII included (Enterprise)' : 'Requires Enterprise'}
              >
                {plan.exportFormats.includes('STIX') ? <Check size={10} /> : <Lock size={10} />} STIX / PDF
              </span>
            </div>
            <div className="at-plan-meter-sub">
              {isBasic && (
                <span className="at-plan-upgrade-link" onClick={() => setIsModalOpen(true)}>
                  Upgrade for JSON exports →
                </span>
              )}
              {isPro && <span>JSON exports unlocked (Task #78)</span>}
              {!isBasic && !isPro && <span>Full TAXII &amp; PDF suite active</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Interactive Plan Comparison Modal ── */}
      {isModalOpen && (
        <div
          className="at-plan-modal-backdrop"
          onClick={() => setIsModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="at-plan-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="at-plan-modal-header">
              <div>
                <span className="at-plan-modal-kicker">Antitode Subscription Tiers</span>
                <h2 className="at-plan-modal-title">Choose Your Security Coverage</h2>
                <p className="at-plan-modal-desc">
                  Scale honeypot sensor networks and unlock structured threat intelligence exports.
                </p>
              </div>
              <button
                type="button"
                className="at-plan-modal-close"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </div>

            <div className="at-plan-cards-grid">
              {(['basic', 'pro', 'enterprise'] as PlanTier[]).map((tierKey) => {
                const tier = PLAN_TIERS[tierKey];
                const isSelected = currentPlan === tierKey;

                return (
                  <div
                    key={tier.id}
                    className={`at-tier-card ${isSelected ? 'is-current' : ''} ${
                      tier.popular ? 'is-popular' : ''
                    }`}
                  >
                    {tier.popular && (
                      <div className="at-tier-ribbon">Most Popular</div>
                    )}

                    <div className="at-tier-header">
                      <span className={`at-plan-tag at-plan-tag-${tier.id}`}>
                        {tier.name}
                      </span>
                      <div className="at-tier-price">
                        {tier.priceMonthly === 0 ? (
                          <strong>Free</strong>
                        ) : (
                          <>
                            <strong>${tier.priceMonthly}</strong>
                            <span>/month</span>
                          </>
                        )}
                      </div>
                      <p className="at-tier-desc">{tier.description}</p>
                    </div>

                    <div className="at-tier-quotas">
                      <div className="at-tier-quota-item">
                        <span>Honeypots:</span>
                        <strong>{tier.maxHoneypots >= 9999 ? 'Unlimited' : tier.maxHoneypots}</strong>
                      </div>
                      <div className="at-tier-quota-item">
                        <span>Monthly Events:</span>
                        <strong>{tier.maxEventsPerMonth >= 1000000 ? 'Unlimited' : tier.maxEventsPerMonth.toLocaleString()}</strong>
                      </div>
                      <div className="at-tier-quota-item">
                        <span>Retention:</span>
                        <strong>{tier.retentionDays} Days</strong>
                      </div>
                      <div className="at-tier-quota-item">
                        <span>Exports:</span>
                        <strong>{tier.exportFormats.join(', ')}</strong>
                      </div>
                    </div>

                    <ul className="at-tier-features-list">
                      {tier.features.map((feat, idx) => (
                        <li key={idx}>
                          <Check size={14} className="at-check-icon" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="at-tier-footer">
                      {isSelected ? (
                        <button
                          type="button"
                          className="at-btn at-btn-secondary at-btn-full"
                          disabled
                        >
                          <Check size={13} />
                          Active Plan
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={`at-btn at-btn-full ${
                            tier.popular ? 'at-btn-primary' : 'at-btn-secondary'
                          }`}
                          onClick={() => handleSelectPlan(tier.id)}
                        >
                          {tier.priceMonthly > plan.priceMonthly ? 'Upgrade to ' : 'Switch to '}
                          {tier.name}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="at-plan-modal-footer">
              <span>All plans include encryption in transit and community vulnerability advisories.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
