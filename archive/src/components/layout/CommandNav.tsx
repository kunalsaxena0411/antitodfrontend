import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ArrowRight,
  Grid2X2,
  Search,
  X,
} from 'lucide-react';

import {
  BOTTOM_ITEMS,
  NAV_GROUPS,
  TOP_LEVEL_ITEMS,
  UTILITY_ITEMS,
  type NavItem,
} from '../../data/navigation';

interface CommandNavProps {
  isOpen: boolean;
  activeView: string;
  onClose: () => void;
  onNavigate: (id: string) => void;
}

const ALL_ITEMS = [
  ...TOP_LEVEL_ITEMS,
  ...NAV_GROUPS.flatMap((group) => group.items),
  ...UTILITY_ITEMS,
  ...BOTTOM_ITEMS,
];

function matches(
  item: NavItem,
  query: string
) {
  const needle = query.trim().toLowerCase();

  if (!needle) {
    return true;
  }

  return (
    item.label.toLowerCase().includes(needle) ||
    item.desc.toLowerCase().includes(needle)
  );
}

export default function CommandNav({
  isOpen,
  activeView,
  onClose,
  onNavigate,
}: CommandNavProps) {
  const [query, setQuery] = useState('');

  const inputRef =
    useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setQuery('');

    const frame =
      window.requestAnimationFrame(() => {
        inputRef.current?.focus();
      });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (
      event: KeyboardEvent
    ) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener(
      'keydown',
      onKeyDown
    );

    return () => {
      document.removeEventListener(
        'keydown',
        onKeyDown
      );
    };
  }, [isOpen, onClose]);

  const filteredGroups = useMemo(
    () =>
      NAV_GROUPS
        .map((group) => ({
          ...group,
          items: group.items.filter(
            (item) => matches(item, query)
          ),
        }))
        .filter(
          (group) => group.items.length > 0
        ),
    [query]
  );

  const filteredUtilities = useMemo(
    () =>
      [
        ...UTILITY_ITEMS,
        ...BOTTOM_ITEMS,
      ].filter((item) =>
        matches(item, query)
      ),
    [query]
  );

  const exactMatches = useMemo(
    () =>
      ALL_ITEMS.filter((item) =>
        matches(item, query)
      ),
    [query]
  );

  const handleNavigate = (
    id: string
  ) => {
    onNavigate(id);
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  const ItemButton = ({
    item,
  }: {
    item: NavItem;
  }) => {
    const Icon = item.icon;

    const active =
      activeView === item.id;

    return (
      <button
        type="button"
        className={`at-command-nav-item ${active ? 'active' : ''
          }`}
        onClick={() =>
          handleNavigate(item.id)
        }
      >
        <span className="at-command-nav-icon">
          <Icon
            size={15}
            strokeWidth={1.8}
          />
        </span>

        <span className="at-command-nav-copy">
          <span className="at-command-nav-label">
            {item.label}
          </span>

          {!query && (
            <span className="at-command-nav-desc">
              {item.desc}
            </span>
          )}
        </span>

        {active && (
          <span className="at-command-nav-current">
            Current
          </span>
        )}

        <ArrowRight
          className="at-command-nav-arrow"
          size={14}
        />
      </button>
    );
  };

  return (
    <div
      className="at-command-nav-layer"
      role="dialog"
      aria-label="Application navigator"
    >
      {/* Backdrop */}
      <button
        className="at-command-nav-backdrop"
        type="button"
        aria-label="Close navigation"
        onClick={onClose}
      />

      {/* Navigation panel */}
      <section className="at-command-nav-panel">
        {/* Heading */}
        <div className="at-command-nav-topline">
          <div>
            <span className="at-command-nav-kicker">
              APPLICATION NAVIGATOR
            </span>

            <h2>
              Move through ANTITODE
            </h2>
          </div>

          <button
            type="button"
            className="at-command-nav-close"
            onClick={onClose}
            aria-label="Close navigator"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="at-command-nav-search-wrap">
          <Search size={16} />

          <input
            ref={inputRef}
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
            placeholder="Find a workspace, investigation, feed or tool..."
            aria-label="Find a page"
          />

          <kbd>ESC</kbd>
        </div>

        {/* Top-level shortcuts */}
        {!query && (
          <div className="at-command-nav-quick">
            {TOP_LEVEL_ITEMS.map((item) => {
              const Icon = item.icon;

              const active =
                activeView === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`at-command-nav-quick-item ${active ? 'active' : ''
                    }`}
                  onClick={() =>
                    handleNavigate(item.id)
                  }
                >
                  <span className="at-command-nav-quick-icon">
                    <Icon size={16} />
                  </span>

                  <span>
                    <strong>
                      {item.label}
                    </strong>

                    <small>
                      {item.desc}
                    </small>
                  </span>

                  <ArrowRight size={14} />
                </button>
              );
            })}
          </div>
        )}

        {/* Search results */}
        {query ? (
          <div className="at-command-nav-results">
            {exactMatches.length > 0 ? (
              exactMatches.map((item) => (
                <ItemButton
                  item={item}
                  key={item.id}
                />
              ))
            ) : (
              <div className="at-command-nav-empty">
                <Grid2X2 size={22} />

                <strong>
                  No matching pages
                </strong>

                <span>
                  Try a broader term such as
                  “network”, “intel”, or “rules”.
                </span>
              </div>
            )}
          </div>
        ) : (
          /* Grouped navigation */
          <div className="at-command-nav-grid">
            {filteredGroups.map((group) => (
              <section
                key={group.title}
                className="at-command-nav-group"
              >
                <div className="at-command-nav-group-title">
                  {group.title}
                </div>

                <div className="at-command-nav-group-items">
                  {group.items.map((item) => (
                    <ItemButton
                      item={item}
                      key={item.id}
                    />
                  ))}
                </div>
              </section>
            ))}

            {/* Utility navigation */}
            <section className="at-command-nav-group utility">
              <div className="at-command-nav-group-title">
                Workspace
              </div>

              <div className="at-command-nav-group-items">
                {filteredUtilities.map((item) => (
                  <ItemButton
                    item={item}
                    key={item.id}
                  />
                ))}
              </div>
            </section>
          </div>
        )}

        {/* Footer */}
        <div className="at-command-nav-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            move
          </span>

          <span>
            <kbd>↵</kbd>
            open
          </span>

          <span>
            <kbd>⌘K</kbd>
            command palette
          </span>
        </div>
      </section>
    </div>
  );
}