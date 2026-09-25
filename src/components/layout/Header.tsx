import { useEffect, useState } from 'react';
import { Building2, ChevronDown, Command, Menu, Search, Settings } from 'lucide-react';
import { findNavGroup, findNavItem } from '../../data/navigation';

interface HeaderProps {
  activeView: string;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onOpenSearch: () => void;
  onOpenSettings?: () => void;
}

export default function Header({
  activeView,
  sidebarCollapsed,
  onToggleSidebar,
  onOpenSearch,
  onOpenSettings,
}: HeaderProps) {
  const [time, setTime] = useState(new Date());
  const item = findNavItem(activeView);
  const group = findNavGroup(activeView);

  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <header className="at-header at-header-shell">
      <div className="at-header-left at-header-shell-left">
        <button
          type="button"
          className="at-header-menu"
          onClick={onToggleSidebar}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Menu size={17} />
        </button>

        <div className="at-header-route">
          <div className="at-header-route-overline">{group?.title ?? 'Workspace'}</div>
          <div className="at-header-route-title">{item?.label ?? 'Dashboard'}</div>
        </div>
      </div>

      <button
        type="button"
        className="at-global-search at-global-search-shell"
        onClick={onOpenSearch}
        aria-label="Open global search"
      >
        <Search size={15} />
        <span>Search modules and workflows...</span>
        <span className="at-command-hint"><Command size={10} />K</span>
      </button>

      <div className="at-header-right at-header-shell-right">
        <div className="at-header-workspace-pill">
          <span className="at-header-workspace-icon"><Building2 size={13} /></span>
          <span>Global Operations</span>
          <ChevronDown size={12} />
        </div>

        <div className="at-header-system-state" aria-label="Application status">
          <span className="at-status-dot online" />
          <span>Operational</span>
        </div>

        <div className="at-header-time" aria-label="Current time">
          {time.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
        </div>

        {onOpenSettings && (
          <button type="button" className="at-icon-button" onClick={onOpenSettings} aria-label="Open settings" title="Settings">
            <Settings size={16} />
          </button>
        )}

        <button type="button" className="at-header-user" aria-label="User menu">
          <span className="at-header-user-avatar">A</span>
        </button>
      </div>
    </header>
  );
}
