import { useEffect, useState } from 'react';
import {
  Bell,
  ChevronRight,
  Command,
  HelpCircle,
  Menu,
  Search,
  Settings,
  Sparkles,
} from 'lucide-react';
import { findNavGroup, findNavItem } from '../../data/navigation';
import { routeForView } from '../../data/routes';

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
  const [time, setTime] = useState(new Date());
  const item = findNavItem(activeView);
  const group = findNavGroup(activeView);
  const path = routeForView(activeView);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

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
          title="AI Assistant"
          aria-label="Open AI Assistant"
          onClick={() => onNavigate && onNavigate('chat')}
        >
          <Sparkles size={15} />
        </button>

        <button
          type="button"
          className="at-header-quick-action"
          title="Help"
          aria-label="Open help"
          onClick={() => onNavigate && onNavigate('help')}
        >
          <HelpCircle size={15} />
        </button>

        <button
          type="button"
          className="at-header-quick-action at-header-notification"
          title="Notifications"
          aria-label="Notifications"
        >
          <Bell size={15} />
          <span />
        </button>

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

        <button
          type="button"
          className="at-header-user"
          aria-label="Account menu"
          title="Account"
        >
          <span className="at-header-user-avatar">A</span>
        </button>
      </div>
    </header>
  );
}
