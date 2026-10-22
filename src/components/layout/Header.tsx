import { useEffect, useState, useRef } from 'react';
import {
  Bell,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Command,
  CreditCard,
  Crown,
  HelpCircle,
  LogOut,
  Menu,
  Search,
  Settings,
  Sparkles,
  Zap,
} from 'lucide-react';
import { findNavGroup, findNavItem } from '../../data/navigation';
import { routeForView } from '../../data/routes';
import {
  billingService,
  type BillingUsageResponse,
} from '../../../api/services/billingService';
import {
  PLAN_TIERS,
  getStoredPlan,
  type PlanTier,
} from '../../data/planTiering';
import { isPublicDemo, exitDemoMode } from '../../utils/demoMode';
import { useAuth } from '../../../contexts/AuthContext';

interface HeaderProps {
  activeView: string;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onOpenSearch: () => void;
  onNavigate?: (viewId: string) => void;
  onOpenSettings?: () => void;
}

export default function Header({
  activeView,
  sidebarCollapsed,
  onToggleSidebar,
  onOpenSearch,
  onNavigate,
  onOpenSettings,
}: HeaderProps) {
  const { removeToken, admin } = useAuth();
  const [time, setTime] = useState(new Date());
  const [usage, setUsage] = useState<BillingUsageResponse | null>(null);
  const [showPlanMenu, setShowPlanMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const planMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideNotifications = (e: MouseEvent) => {
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(e.target as Node)
      ) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) {
      document.addEventListener('mousedown', handleOutsideNotifications);
    }
    return () =>
      document.removeEventListener('mousedown', handleOutsideNotifications);
  }, [showNotifications]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  const handleSignOut = () => {
    if (isPublicDemo()) {
      exitDemoMode();
    } else {
      removeToken();
      window.location.href = '/login';
    }
  };
  const item = findNavItem(activeView);
  const group = findNavGroup(activeView);
  const path = routeForView(activeView);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadUsage = async () => {
      try {
        if (isPublicDemo()) {
          if (mounted) {
            const stored = getStoredPlan();
            const config = PLAN_TIERS[stored] || PLAN_TIERS.basic;
            setUsage({
              plan: {
                id: stored,
                label: stored === 'basic' ? 'Public Demo' : `${config.name} Plan`,
                status: 'active',
                active: true,
              },
              usage: {
                servers: { used: 3, limit: config.maxHoneypots },
                users: { used: 1, limit: stored === 'enterprise' ? 9999 : stored === 'pro' ? 10 : 5 },
              },
            });
          }
          return;
        }
        const data = await billingService.getUsage();
        if (mounted) setUsage(data);
      } catch {
        // Fallback or unauthenticated
      }
    };
    loadUsage();

    const handleAuth = () => loadUsage();
    const handlePlanChanged = (e: Event) => {
      const custom = e as CustomEvent<{ plan: PlanTier }>;
      const newPlan = custom.detail?.plan;
      if (!newPlan) return;
      const config = PLAN_TIERS[newPlan];
      if (!config) return;

      setUsage((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          plan: {
            ...prev.plan!,
            id: newPlan,
            label: `${config.name} Plan`,
            status: 'active',
            active: true,
          },
          usage: {
            servers: {
              used: prev.usage?.servers?.used ?? 3,
              limit: config.maxHoneypots,
            },
            users: {
              used: prev.usage?.users?.used ?? 1,
              limit: newPlan === 'enterprise' ? 9999 : newPlan === 'pro' ? 10 : 5,
            },
          },
        };
      });
    };

    window.addEventListener('auth-changed', handleAuth);
    window.addEventListener('plan-changed', handlePlanChanged);
    return () => {
      mounted = false;
      window.removeEventListener('auth-changed', handleAuth);
      window.removeEventListener('plan-changed', handlePlanChanged);
    };
  }, []);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (planMenuRef.current && !planMenuRef.current.contains(e.target as Node)) {
        setShowPlanMenu(false);
      }
    };
    if (showPlanMenu) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showPlanMenu]);

  return (
    <header className="at-header at-header-shell">
      <div className="at-header-left">
        <button
          type="button"
          className={`at-header-menu ${sidebarCollapsed ? "is-visible" : ""}`}
          onClick={onToggleSidebar}
          aria-label={sidebarCollapsed ? 'Open sidebar' : 'Collapse sidebar'}
          title={sidebarCollapsed ? 'Open navigation' : 'Collapse navigation'}
        >
          <Menu size={17} />
        </button>

        <div className="at-header-breadcrumbs" aria-label="Current module">
          <span className="at-header-breadcrumb-muted">
            {group?.title ?? 'Workspace'}
          </span>
          <ChevronRight size={13} />
          <strong>{item?.label ?? 'Dashboard'}</strong>
          <span className="at-header-route-path">{path}</span>
        </div>
      </div>

      <button
        type="button"
        className="at-global-search at-global-search-shell"
        onClick={onOpenSearch}
        aria-label="Open global search"
      >
        <Search size={15} />
        <span>Search modules, indicators, CVEs, actors…</span>
        <span className="at-command-hint">
          <Command size={10} /> K
        </span>
      </button>

      <div className="at-header-right">

        <button
          type="button"
          className="at-header-quick-action"
          title="Help"
          aria-label="Open help"
          onClick={() => onNavigate && onNavigate('help')}
        >
          <HelpCircle size={15} />
        </button>

        {/* Notifications Popover */}
        <div className="relative" ref={notificationsRef}>
          <button
            type="button"
            className="at-header-quick-action at-header-notification"
            title="Notifications"
            aria-label="Notifications"
            onClick={() => setShowNotifications((prev) => !prev)}
          >
            <Bell size={15} />
            <span />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-[#111] border border-neutral-800 rounded-xl shadow-2xl p-4 z-50 animate-fade-in font-sans">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                <div className="flex items-center gap-2">
                  <Bell size={14} className="text-red-500" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Notifications
                  </span>
                </div>
                <span className="text-[10px] text-neutral-400 font-mono px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800">
                  0 Unread
                </span>
              </div>
              <div className="py-6 flex flex-col items-center justify-center text-center">
                <div className="w-8 h-8 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500 mb-2">
                  <CheckCircle size={15} className="text-emerald-500" />
                </div>
                <span className="text-xs text-neutral-300 font-medium">
                  All caught up
                </span>
                <span className="text-[11px] text-neutral-400 mt-0.5">
                  Real-time alerts and sensor events will stream here
                </span>
              </div>
              <div className="pt-2.5 border-t border-neutral-800/80 flex items-center justify-between text-[10px] text-neutral-400 font-mono">
                <span>Telemetry Ingestion</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />{' '}
                  Active
                </span>
              </div>
            </div>
          )}
        </div>

        {onOpenSettings && (
          <button
            type="button"
            className="at-header-quick-action"
            onClick={onOpenSettings}
            aria-label="Open settings"
            title="Settings"
          >
            <Settings size={15} />
          </button>
        )}

        {/* Sign Out / Logout */}
        <button
          type="button"
          className="at-header-quick-action hover:text-red-400"
          onClick={handleSignOut}
          aria-label="Sign out"
          title="Sign out / Logout"
        >
          <LogOut size={15} />
        </button>

        {/* Public Demo Badge (Task 62) */}
        {isPublicDemo() && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-950/60 text-amber-300 border border-amber-500/40 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>Public Demo (Read Only)</span>
            <button
              type="button"
              onClick={() => exitDemoMode()}
              className="ml-1 text-[9px] text-amber-400 hover:text-white underline cursor-pointer"
              title="Exit demo and log in with real account"
            >
              Exit
            </button>
          </div>
        )}

        {/* Billing Plan & Quota Badge */}
        {usage && (
          <div className="relative" ref={planMenuRef}>
            {usage.platform ? (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-purple-950/60 text-purple-300 border border-purple-500/40">
                Staff
              </span>
            ) : usage.plan ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowPlanMenu((prev) => !prev)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider border transition-all ${
                    usage.plan.id === 'pro'
                      ? 'bg-blue-950/60 text-blue-400 border-blue-500/40 hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/20'
                      : 'bg-neutral-900/90 text-neutral-300 border-neutral-700/80 hover:border-neutral-500 hover:text-white hover:bg-neutral-800'
                  }`}
                  title={`Subscription: ${usage.plan.label}. Click to view quotas.`}
                >
                  {usage.plan.id === 'pro' ? (
                    <Crown size={12} className="text-blue-400" />
                  ) : (
                    <Zap size={12} className="text-neutral-400" />
                  )}
                  <span>{usage.plan.label}</span>
                  {typeof usage.usage?.servers?.used === 'number' &&
                    typeof usage.usage?.servers?.limit === 'number' && (
                      <span className="text-[10px] text-neutral-400 font-normal">
                        ({usage.usage.servers.used}/{usage.usage.servers.limit})
                      </span>
                    )}
                  <ChevronDown size={11} className="text-neutral-400" />
                </button>

                {showPlanMenu && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-[#0e1117] border border-neutral-800 rounded-xl shadow-2xl p-4 z-50 animate-slide-in-up font-mono text-xs space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                      <div>
                        <span className="text-[10px] text-neutral-400 uppercase tracking-widest block">
                          Current Subscription
                        </span>
                        <span className="text-sm font-bold text-white flex items-center gap-1.5 pt-0.5">
                          {usage.plan.label} Plan
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold ${
                              usage.plan.active
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                                : 'bg-red-950 text-red-400 border border-red-500/30'
                            }`}
                          >
                            {usage.plan.status}
                          </span>
                        </span>
                      </div>
                      {typeof usage.plan.daysLeft === 'number' && (
                        <span className="text-[11px] text-neutral-400">
                          {usage.plan.daysLeft}d left
                        </span>
                      )}
                    </div>

                    {/* Quota meters */}
                    <div className="space-y-2">
                      {usage.usage?.servers && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-neutral-400">Servers Used</span>
                            <span className="text-white font-bold">
                              {usage.usage.servers.used} / {usage.usage.servers.limit}
                            </span>
                          </div>
                          <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                usage.usage.servers.used >= usage.usage.servers.limit
                                  ? 'bg-[#d62828]'
                                  : 'bg-sky-500'
                              }`}
                              style={{
                                width: `${Math.min(
                                  100,
                                  (usage.usage.servers.used /
                                    usage.usage.servers.limit) *
                                    100,
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {usage.usage?.users && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-neutral-400">Team Users</span>
                            <span className="text-white font-bold">
                              {usage.usage.users.used} / {usage.usage.users.limit}
                            </span>
                          </div>
                          <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{
                                width: `${Math.min(
                                  100,
                                  (usage.usage.users.used /
                                    usage.usage.users.limit) *
                                    100,
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Upgrade / Choose Coverage action button */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowPlanMenu(false);
                        window.dispatchEvent(
                          new CustomEvent('open-plan-upgrade', {
                            detail: {
                              code: 'PLAN_UPGRADE',
                              limit: usage.usage?.servers?.limit,
                              used: usage.usage?.servers?.used,
                            },
                          }),
                        );
                      }}
                      className="w-full py-2.5 px-3 rounded-lg bg-[#d62828] hover:bg-[#b91c1c] active:bg-[#991b1b] text-white font-bold text-center border border-[#d62828] transition-all shadow-md shadow-[#d62828]/25 hover:shadow-[#d62828]/40 cursor-pointer"
                    >
                      {usage.plan.id === 'basic'
                        ? `Upgrade to Pro ($${usage.upgrade?.priceUsdPerMonth ?? 155}/mo)`
                        : 'Manage Subscription'}
                    </button>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}

        <div className="at-header-divider" />

        <div className="at-header-session" aria-label="System status">
          <span className="at-header-session-dot" />
          <span className="at-header-session-copy">
            <strong>Operational</strong>
            <small>
              {time.toLocaleTimeString('en-US', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
              })}
            </small>
          </span>
        </div>

        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            className="at-header-user hover:ring-2 hover:ring-red-500/50 transition-all cursor-pointer"
            aria-label="Account menu"
            title="Account profile & sign out"
            onClick={() => setShowUserMenu((prev) => !prev)}
          >
            <span className="at-header-user-avatar">
              {admin?.AdminEmail ? admin.AdminEmail.charAt(0).toUpperCase() : 'A'}
            </span>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-[#0e1117] border border-neutral-800 rounded-xl shadow-2xl p-3 z-50 animate-slide-in-up font-mono text-xs space-y-3">
              <div className="flex items-center gap-3 pb-3 border-b border-neutral-800">
                <div className="w-9 h-9 rounded-full bg-red-950/80 border border-red-500/40 flex items-center justify-center text-red-400 font-bold text-sm">
                  {admin?.AdminEmail ? admin.AdminEmail.charAt(0).toUpperCase() : 'A'}
                </div>
                <div className="overflow-hidden">
                  <div className="text-white font-bold truncate text-xs">
                    {admin?.AdminEmail || 'Security Admin'}
                  </div>
                  <div className="text-[10px] text-neutral-400 flex items-center gap-1.5 pt-0.5">
                    <span className="truncate">ID: {admin?.AdminID || 'ADM-01'}</span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] bg-neutral-800 text-neutral-300">
                      {isPublicDemo() ? 'DEMO' : 'PRO'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      onOpenSettings();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800/80 transition-colors text-left text-xs cursor-pointer"
                  >
                    <Settings size={14} className="text-neutral-400" />
                    <span>Settings & API Keys</span>
                  </button>
                )}

                {onNavigate && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        onNavigate('billing');
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800/80 transition-colors text-left text-xs cursor-pointer"
                    >
                      <CreditCard size={14} className="text-neutral-400" />
                      <span>Billing &amp; Subscriptions</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        onNavigate('help');
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800/80 transition-colors text-left text-xs cursor-pointer"
                    >
                      <HelpCircle size={14} className="text-neutral-400" />
                      <span>System Guide &amp; Help</span>
                    </button>
                  </>
                )}
              </div>

              <div className="pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-950/40 transition-colors text-left text-xs font-bold cursor-pointer"
                >
                  <LogOut size={14} />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
