import type { ReactNode } from 'react';
import { Search, TerminalSquare, X } from 'lucide-react';
import PageHeader from './PageHeader';

interface IntelLayoutProps {
  breadcrumbs: { label: string }[];
  title: string;
  description: string;
  headerActions?: ReactNode;
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  activeFilters: string[];
  onRemoveFilter: (filter: string) => void;
  resultsCount: number;
  tableContent: ReactNode;
  inspectorContent?: ReactNode;
  isInspectorOpen: boolean;
  onCloseInspector: () => void;
  advancedMode?: boolean;
  onToggleAdvanced?: () => void;
}

export default function IntelLayout({
  breadcrumbs,
  title,
  description,
  headerActions,
  searchPlaceholder = 'Search...',
  searchValue,
  onSearchChange,
  activeFilters,
  onRemoveFilter,
  resultsCount,
  tableContent,
  inspectorContent,
  isInspectorOpen,
  onCloseInspector,
  advancedMode = false,
  onToggleAdvanced,
}: IntelLayoutProps) {
  return (
    <div className="at-intel-layout flex flex-col flex-1 min-h-0">
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={title}
        description={description}
        actions={headerActions}
      />

      <section className="at-intel-querybar" aria-label="Workspace query controls">
        <div className="at-intel-querybar-inner">
          <div className="at-intel-search-group">
            <div className="at-intel-searchbox">
              {advancedMode ? (
                <TerminalSquare
                  size={15}
                  className="text-at-accent shrink-0"
                />
              ) : (
                <Search
                  size={15}
                  className="text-at-disabled shrink-0"
                />
              )}

              <input
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={
                  advancedMode
                    ? 'e.g. severity:critical AND type:domain'
                    : searchPlaceholder
                }
                aria-label="Search current workspace"
                className={advancedMode ? 'font-mono' : undefined}
              />

              {searchValue && (
                <button
                  type="button"
                  className="inline-flex shrink-0 text-at-disabled hover:text-at-text"
                  onClick={() => onSearchChange('')}
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {onToggleAdvanced && (
              <button
                type="button"
                onClick={onToggleAdvanced}
                className={`at-btn at-btn-secondary at-btn-sm ${advancedMode ? 'border-at-accent/40 text-at-accent' : ''}`}
                title={
                  advancedMode
                    ? 'Switch to standard search'
                    : 'Switch to advanced query'
                }
                aria-pressed={advancedMode}
              >
                <TerminalSquare size={13} />
                {advancedMode ? 'Advanced' : 'Query'}
              </button>
            )}
          </div>

          <div className="at-intel-toolbar-meta">
            <span className="at-results-count">
              {resultsCount.toLocaleString()} results
            </span>
          </div>
        </div>

        {activeFilters.length > 0 && (
          <div className="at-filter-row">
            <span className="at-filter-label">Active</span>

            {activeFilters.map((filter) => (
              <span key={filter} className="at-filter-chip">
                {filter}
                <button
                  type="button"
                  onClick={() => onRemoveFilter(filter)}
                  aria-label={`Remove ${filter} filter`}
                >
                  <X size={11} />
                </button>
              </span>
            ))}

            <button
              type="button"
              className="at-btn at-btn-ghost at-btn-sm"
              onClick={() => {
                activeFilters.forEach(onRemoveFilter);
              }}
            >
              Clear all
            </button>
          </div>
        )}
      </section>

      <div className="at-intel-workspace">
        <div className="at-intel-table">
          {tableContent}
        </div>

        {isInspectorOpen && (
          <aside
            className="at-intel-inspector"
            aria-label="Selected item inspector"
          >
            {inspectorContent}
          </aside>
        )}

        {isInspectorOpen && (
          <button
            type="button"
            className="sr-only"
            onClick={onCloseInspector}
            aria-label="Close inspector"
          >
            Close inspector
          </button>
        )}
      </div>
    </div>
  );
}
