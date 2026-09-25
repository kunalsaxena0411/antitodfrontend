import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Command,
  MoreHorizontal,
  Search,
  Star,
  X,
} from 'lucide-react';
import { BOTTOM_ITEMS, NAV_GROUPS, canonicalViewId, type NavGroup, type NavItem } from '../../data/navigation';
import { routeForView } from '../../data/routes';

interface SidebarProps {
  activeView: string;
  collapsed: boolean;
  onToggle: () => void;
  onNavigate: (viewId: string) => void;
  onOpenSearch: () => void;
}

interface SidebarItemProps {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  favorite: boolean;
  onNavigate: (viewId: string) => void;
  onToggleFavorite: (viewId: string) => void;
}

const STORAGE_KEY = 'antitode_sidebar_groups';
const FAVORITES_KEY = 'antitode_favorites';

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function SidebarItem({ item, active, collapsed, favorite, onNavigate, onToggleFavorite }: SidebarItemProps) {
  const Icon = item.icon;

  return (
    <div className={`at-sidebar-item-wrap ${active ? 'is-active' : ''}`}>
      <button
        type="button"
        className={`at-sidebar-item ${active ? 'is-active' : ''}`}
        onClick={() => onNavigate(item.id)}
        title={collapsed ? `${item.label} • ${routeForView(item.id)}` : item.label}
        aria-current={active ? 'page' : undefined}
      >
        <span className="at-sidebar-item-icon"><Icon size={16} strokeWidth={active ? 2.1 : 1.8} /></span>
        {!collapsed && <span className="at-sidebar-item-label">{item.label}</span>}
      </button>

      {!collapsed && (
        <button
          type="button"
          className={`at-sidebar-favorite ${favorite ? 'is-favorite' : ''}`}
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite(item.id);
          }}
          title={favorite ? `Remove ${item.label} from favorites` : `Favorite ${item.label}`}
          aria-label={favorite ? `Remove ${item.label} from favorites` : `Favorite ${item.label}`}
        >
          <Star size={12} fill={favorite ? 'currentColor' : 'none'} />
        </button>
      )}
    </div>
  );
}

function SidebarGroup({
  group,
  collapsed,
  groupCollapsed,
  activeView,
  favorites,
  onToggleGroup,
  onNavigate,
  onToggleFavorite,
}: {
  group: NavGroup;
  collapsed: boolean;
  groupCollapsed: boolean;
  activeView: string;
  favorites: string[];
  onToggleGroup: (title: string) => void;
  onNavigate: (viewId: string) => void;
  onToggleFavorite: (viewId: string) => void;
}) {
  const activeCanonical = canonicalViewId(activeView);
  const hasActive = group.items.some((item) => item.id === activeCanonical);

  if (collapsed) {
    return (
      <section className={`at-sidebar-group at-sidebar-group-collapsed ${hasActive ? 'has-active' : ''}`}>
        <div className="at-sidebar-group-items">
          {group.items.map((item) => (
            <SidebarItem
              key={item.id}
              item={item}
              active={item.id === activeCanonical}
              collapsed={true}
              favorite={favorites.includes(item.id)}
              onNavigate={onNavigate}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="at-sidebar-group">
      <button
        type="button"
        className={`at-sidebar-group-title ${hasActive ? 'has-active' : ''}`}
        onClick={() => onToggleGroup(group.title)}
      >
        <span>{group.title}</span>
        <ChevronDown size={13} className={groupCollapsed ? 'is-collapsed' : ''} />
      </button>

      {!groupCollapsed && (
        <div className="at-sidebar-group-items">
          {group.items.map((item) => (
            <SidebarItem
              key={item.id}
              item={item}
              active={item.id === activeCanonical}
              collapsed={false}
              favorite={favorites.includes(item.id)}
              onNavigate={onNavigate}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default function Sidebar({ activeView, collapsed, onToggle, onNavigate, onOpenSearch }: SidebarProps) {
  const [hoverPeek, setHoverPeek] = useState(false);
  const [autoPeek, setAutoPeek] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth > 900;
  });
  const [menuSearch, setMenuSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>(() => readStored(STORAGE_KEY, []));
  const [favorites, setFavorites] = useState<string[]>(() => readStored(FAVORITES_KEY, []));
  const searchRef = useRef<HTMLInputElement>(null);
  const hoverCloseTimer = useRef<number | null>(null);
  const activeCanonical = canonicalViewId(activeView);

  const visuallyExpanded = !autoPeek ? !collapsed : hoverPeek;

  const filteredGroups = useMemo(() => {
    const value = menuSearch.trim().toLowerCase();
    if (!value) return NAV_GROUPS;

    return NAV_GROUPS
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => `${item.label} ${item.desc}`.toLowerCase().includes(value)),
      }))
      .filter((group) => group.items.length > 0);
  }, [menuSearch]);

  const favoriteItems = useMemo(() => {
    const all = NAV_GROUPS.flatMap((group) => group.items);
    return favorites.map((id) => all.find((item) => item.id === id)).filter(Boolean) as NavItem[];
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsedGroups));
  }, [collapsedGroups]);

  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    if (!autoPeek) {
      setHoverPeek(false);
    }
  }, [autoPeek, collapsed]);

  useEffect(() => {
    const handleResize = () => {
      const desktop = window.innerWidth > 900;
      setAutoPeek(desktop);
      if (!desktop) {
        setHoverPeek(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenSearch();
        return;
      }
      if (modifier && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        onToggle();
      }
      if (event.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        event.preventDefault();
        if (visuallyExpanded) searchRef.current?.focus();
        else onOpenSearch();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpenSearch, onToggle, visuallyExpanded]);

  const toggleGroup = (title: string) => {
    setCollapsedGroups((current) => current.includes(title)
      ? current.filter((entry) => entry !== title)
      : [...current, title]);
  };

  const toggleFavorite = (id: string) => {
    setFavorites((current) => {
      const next = current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id];
      window.dispatchEvent(new Event('antitode-favorites-changed'));
      return next;
    });
  };

  const handleSidebarEnter = () => {
    if (!autoPeek) return;
    if (hoverCloseTimer.current !== null) {
      window.clearTimeout(hoverCloseTimer.current);
      hoverCloseTimer.current = null;
    }
    setHoverPeek(true);
  };

  const handleSidebarLeave = () => {
    if (!autoPeek) return;
    if (hoverCloseTimer.current !== null) {
      window.clearTimeout(hoverCloseTimer.current);
    }
    hoverCloseTimer.current = window.setTimeout(() => {
      setHoverPeek(false);
      hoverCloseTimer.current = null;
    }, 90);
  };

  return (
    <aside
      className={`at-sidebar ${!visuallyExpanded ? 'is-collapsed' : ''} ${hoverPeek ? 'is-peeked' : ''} ${autoPeek ? 'is-auto-peek' : ''}`}
      onMouseEnter={handleSidebarEnter}
      onMouseLeave={handleSidebarLeave}
    >
      <div className="at-sidebar-top">
        <div className="at-sidebar-brand-row">
          <button type="button" className="at-sidebar-brand" onClick={() => onNavigate('dashboard')} title="Open dashboard">
            <span className="at-sidebar-brand-mark">A</span>
            {visuallyExpanded && (
              <span className="at-sidebar-brand-copy">
                <strong>ANTITODE</strong>
                <small>THREAT PROCESSOR</small>
              </span>
            )}
          </button>

          <button
            type="button"
            className="at-sidebar-collapse-button"
            onClick={() => {
              setAutoPeek(false);
              setHoverPeek(false);
              onToggle();
            }}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {visuallyExpanded ? (
          <button type="button" className="at-sidebar-workspace" onClick={() => onNavigate('dashboard')}>
            <span className="at-sidebar-workspace-mark">G</span>
            <span className="at-sidebar-workspace-copy">
              <strong>Global Operations</strong>
              <small>Security workspace</small>
            </span>
            <ChevronDown size={14} />
          </button>
        ) : (
          <button
            type="button"
            className="at-sidebar-workspace at-sidebar-workspace-collapsed"
            onClick={() => onNavigate('dashboard')}
            title="Global Operations"
          >
            <span className="at-sidebar-workspace-mark">G</span>
          </button>
        )}

        {visuallyExpanded ? (
          <div className="at-sidebar-search-row">
            <Search size={14} />
            <input
              ref={searchRef}
              value={menuSearch}
              onChange={(event) => setMenuSearch(event.target.value)}
              placeholder="Search modules"
              aria-label="Search modules"
            />
            {menuSearch ? (
              <button type="button" onClick={() => setMenuSearch('')} aria-label="Clear module search">
                <X size={13} />
              </button>
            ) : (
              <kbd><Command size={10} /> K</kbd>
            )}
          </div>
        ) : (
          <button type="button" className="at-sidebar-search-collapsed" onClick={onOpenSearch} aria-label="Open global search" title="Search modules">
            <Search size={15} />
          </button>
        )}
      </div>

      <div className="at-sidebar-scroll">
        {favoriteItems.length > 0 && !menuSearch && (
          <section className="at-sidebar-group at-sidebar-favorites">
            <div className="at-sidebar-group-title static-title">
              {visuallyExpanded ? <span>Favorites</span> : <Star size={12} fill="currentColor" />}
            </div>
            <div className="at-sidebar-group-items">
              {favoriteItems.map((item) => (
                <SidebarItem
                  key={item.id}
                  item={item}
                  active={item.id === activeCanonical}
                  collapsed={!visuallyExpanded}
                  favorite
                  onNavigate={onNavigate}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          </section>
        )}

        {(menuSearch ? filteredGroups : NAV_GROUPS).map((group) => (
          <SidebarGroup
            key={group.title}
            group={group}
            collapsed={!visuallyExpanded}
            groupCollapsed={collapsedGroups.includes(group.title)}
            activeView={activeView}
            favorites={favorites}
            onToggleGroup={toggleGroup}
            onNavigate={onNavigate}
            onToggleFavorite={toggleFavorite}
          />
        ))}
      </div>

      <div className="at-sidebar-bottom">
        {BOTTOM_ITEMS.map((item) => (
          <SidebarItem
            key={item.id}
            item={item}
            active={activeCanonical === item.id}
            collapsed={!visuallyExpanded}
            favorite={favorites.includes(item.id)}
            onNavigate={onNavigate}
            onToggleFavorite={toggleFavorite}
          />
        ))}

        {visuallyExpanded && (
          <div className="at-sidebar-status-card">
            <div className="at-sidebar-status-head">
              <span className="at-sidebar-status-dot" />
              <span>Operational</span>
              <MoreHorizontal size={13} />
            </div>
            <span>Workspace services ready</span>
          </div>
        )}
      </div>
    </aside>
  );
}
