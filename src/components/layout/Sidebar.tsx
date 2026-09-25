import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Command,
  Menu,
  Search,
  Star,
  X,
} from 'lucide-react';
import {
  BOTTOM_ITEMS,
  NAV_GROUPS,
  canonicalViewId,
  findNavItem,
  type NavGroup,
  type NavItem,
} from '../../data/navigation';

interface SidebarProps {
  activeView: string;
  collapsed: boolean;
  onToggle: () => void;
  onNavigate: (id: string) => void;
  onOpenSearch: () => void;
}

const GROUP_STORAGE_KEY = 'antitode_collapsed_groups';
const FAVORITES_STORAGE_KEY = 'antitode_favorites';

function readStringArray(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

function readCollapsedGroups(): string[] {
  return readStringArray(GROUP_STORAGE_KEY);
}

function SidebarItem({
  item,
  active,
  collapsed,
  favorite,
  onNavigate,
  onToggleFavorite,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  favorite: boolean;
  onNavigate: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}) {
  const Icon = item.icon;

  return (
    <div className={`at-sidebar-item-wrap ${active ? 'is-active' : ''}`}>
      <button
        type="button"
        className={`at-sidebar-item ${active ? 'is-active' : ''}`}
        onClick={() => onNavigate(item.id)}
        title={collapsed ? `${item.label} — ${item.desc}` : undefined}
      >
        <span className="at-sidebar-item-icon">
          <Icon size={16} strokeWidth={1.8} />
        </span>
        {!collapsed && <span className="at-sidebar-item-label">{item.label}</span>}
      </button>

      {!collapsed && (
        <button
          type="button"
          className={`at-sidebar-favorite ${favorite ? 'is-favorite' : ''}`}
          aria-label={favorite ? `Remove ${item.label} from favorites` : `Add ${item.label} to favorites`}
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite(item.id);
          }}
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
  onNavigate: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}) {
  const activeCanonical = canonicalViewId(activeView);
  const hasActive = group.items.some((item) => item.id === activeCanonical);
  const hidden = !collapsed && groupCollapsed && !hasActive;

  return (
    <section className={`at-sidebar-group ${hidden ? 'is-collapsed' : ''}`}>
      <button
        type="button"
        className="at-sidebar-group-title"
        onClick={() => !collapsed && onToggleGroup(group.title)}
        aria-expanded={!groupCollapsed}
      >
        {!collapsed && <span>{group.title}</span>}
        {collapsed ? (
          <span className="at-sidebar-group-rule" />
        ) : groupCollapsed ? (
          <ChevronRight size={12} />
        ) : (
          <ChevronDown size={12} />
        )}
      </button>

      {!hidden && (
        <div className="at-sidebar-group-items">
          {group.items.map((item) => (
            <SidebarItem
              key={item.id}
              item={item}
              active={item.id === activeCanonical}
              collapsed={collapsed}
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

export default function Sidebar({
  activeView,
  collapsed,
  onToggle,
  onNavigate,
  onOpenSearch,
}: SidebarProps) {
  const [menuSearch, setMenuSearch] = useState('');
  const [favorites, setFavorites] = useState<string[]>(() => readStringArray(FAVORITES_STORAGE_KEY));
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>(() => readCollapsedGroups());
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem(GROUP_STORAGE_KEY, JSON.stringify(collapsedGroups));
  }, [collapsedGroups]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        onToggle();
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        setTimeout(() => searchRef.current?.blur(), 0);
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onToggle]);

  const activeCanonical = canonicalViewId(activeView);
  const favoriteItems = useMemo(
    () => favorites.map((id) => findNavItem(id)).filter((item): item is NavItem => Boolean(item)),
    [favorites],
  );

  const filteredGroups = useMemo(() => {
    const query = menuSearch.trim().toLowerCase();
    if (!query) return NAV_GROUPS;

    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        `${item.label} ${item.desc} ${group.title}`.toLowerCase().includes(query),
      ),
    })).filter((group) => group.items.length > 0);
  }, [menuSearch]);

  function toggleFavorite(id: string) {
    setFavorites((current) =>
      current.includes(id) ? current.filter((favorite) => favorite !== id) : [...current, id],
    );
  }

  function toggleGroup(title: string) {
    setCollapsedGroups((current) =>
      current.includes(title)
        ? current.filter((group) => group !== title)
        : [...current, title],
    );
  }

  return (
    <aside className={`at-sidebar ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="at-sidebar-top">
        <div className="at-sidebar-brand-row">
          <button
            type="button"
            className="at-sidebar-brand"
            onClick={() => onNavigate('dashboard')}
            aria-label="ANTITODE dashboard"
          >
            <span className="at-sidebar-brand-mark">A</span>
            {!collapsed && (
              <span className="at-sidebar-brand-copy">
                <strong>ANTITODE</strong>
                <small>THREAT PROCESSOR</small>
              </span>
            )}
          </button>

          <button
            type="button"
            className="at-sidebar-collapse-button"
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <Menu size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {!collapsed ? (
          <button type="button" className="at-sidebar-workspace" onClick={() => onNavigate('dashboard')}>
            <span className="at-sidebar-workspace-mark">G</span>
            <span className="at-sidebar-workspace-copy">
              <strong>Global Operations</strong>
              <small>Security workspace</small>
            </span>
            <ChevronDown size={13} />
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

        {!collapsed ? (
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
          <button type="button" className="at-sidebar-search-collapsed" onClick={onOpenSearch} aria-label="Open global search">
            <Search size={15} />
          </button>
        )}
      </div>

      <div className="at-sidebar-scroll">
        {favoriteItems.length > 0 && !menuSearch && (
          <section className="at-sidebar-group at-sidebar-favorites">
            <div className="at-sidebar-group-title static-title">
              {!collapsed && <span>Favorites</span>}
              {collapsed ? <span className="at-sidebar-group-rule" /> : <Star size={12} fill="currentColor" />}
            </div>
            <div className="at-sidebar-group-items">
              {favoriteItems.map((item) => (
                <SidebarItem
                  key={item.id}
                  item={item}
                  active={item.id === activeCanonical}
                  collapsed={collapsed}
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
            collapsed={collapsed}
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
            collapsed={collapsed}
            favorite={favorites.includes(item.id)}
            onNavigate={onNavigate}
            onToggleFavorite={toggleFavorite}
          />
        ))}

        {!collapsed && (
          <div className="at-sidebar-footnote">
            <span className="at-sidebar-footnote-dot" />
            <span>ANTITODE workspace</span>
          </div>
        )}
      </div>
    </aside>
  );
}

