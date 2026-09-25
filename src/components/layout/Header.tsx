import { useEffect, useState } from 'react';

import {
  Activity,
  Bell,
  Building2,
  ChevronDown,
  CircleUserRound,
  Command,
  Infinity,
  Menu,
  Search,
} from 'lucide-react';

import {
  NAV_GROUPS,
  TOP_LEVEL_ITEMS,
} from '../../data/navigation';

interface HeaderProps {
  onOpenSearch: () => void;
  onOpenNavigation: () => void;
  activeView: string;
}

function resolveContext(activeView: string) {
  const top = TOP_LEVEL_ITEMS.find(
    (item) => item.id === activeView
  );

  if (top) {
    return {
      group: 'Workspace',
      page: top.label,
    };
  }

  for (const group of NAV_GROUPS) {
    const item = group.items.find(
      (entry) => entry.id === activeView
    );

    if (item) {
      return {
        group: group.title,
        page: item.label,
      };
    }
  }

  return {
    group: 'Workspace',
    page: 'Settings',
  };
}

export default function Header({
  onOpenSearch,
  onOpenNavigation,
  activeView,
}: HeaderProps) {
  const [time, setTime] = useState(new Date());

  const context = resolveContext(activeView);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return (
    <header className="at-header at-header-v2">
      <div className="at-header-left">
        {/* Brand */}
        <button
          type="button"
          className="at-brand at-brand-v2"
          aria-label="ANTITODE"
        >
          <span className="at-brand-mark at-brand-mark-v2">
            <Infinity
              size={20}
              strokeWidth={1.9}
            />
          </span>

          <span className="at-brand-wordmark">
            <strong>ANTITODE</strong>
            <small>THREAT PROCESSOR</small>
          </span>
        </button>

        {/* Navigation trigger */}
        <button
          type="button"
          className="at-nav-trigger"
          onClick={onOpenNavigation}
          aria-label="Open application navigator"
        >
          <Menu size={15} />

          <span>Navigator</span>

          <kbd>⌘1</kbd>
        </button>

        <div className="at-context-divider" />

        {/* Current page context */}
        <div className="at-route-context">
          <span>{context.group}</span>
          <b>/</b>
          <strong>{context.page}</strong>
        </div>
      </div>

      {/* Global Search */}
      <button
        type="button"
        className="at-global-search at-global-search-v2"
        onClick={onOpenSearch}
        aria-label="Open command palette"
      >
        <Search size={15} />

        <span>
          Search pages, indicators, IPs, CVEs...
        </span>

        <span className="at-command-hint">
          <Command size={11} />
          <span>K</span>
        </span>
      </button>

      <div className="at-header-right">
        {/* Workspace */}
        <button
          type="button"
          className="at-workspace at-workspace-v2"
          aria-label="Switch workspace"
        >
          <span className="at-workspace-icon">
            <Building2 size={13} />
          </span>

          <span>Global Operations</span>

          <ChevronDown size={12} />
        </button>

        {/* System status */}
        <div className="at-status-cluster at-status-cluster-v2">
          <span className="at-status-item">
            <span className="at-status-dot online" />
            Online
          </span>

          <span className="at-status-item live">
            <Activity size={12} />
            Live intel
          </span>
        </div>

        {/* Clock */}
        <span className="at-header-time at-header-time-v2">
          {time.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </span>

        {/* Notifications */}
        <button
          type="button"
          className="at-icon-button at-icon-button-v2"
          aria-label="Notifications"
        >
          <Bell size={16} />

          <span className="at-notification-dot" />
        </button>

        {/* Profile */}
        <button
          type="button"
          className="at-profile at-profile-v2"
          aria-label="User menu"
        >
          <span className="at-profile-avatar">
            <CircleUserRound size={17} />
          </span>

          <ChevronDown size={12} />
        </button>
      </div>

      <div className="at-header-line at-header-line-v2" />
    </header>
  );
}