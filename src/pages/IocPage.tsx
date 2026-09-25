import {
  useMemo,
  useState,
} from 'react';

import {
  Activity,
  ArrowUpRight,
  ChevronRight,
  CircleX,
  Download,
  ExternalLink,
  Globe,
  Hash,
  Link2,
  Network,
  Plus,
  Search,
  Server,
  ShieldAlert,
  Target,
  TerminalSquare,
  X,
} from 'lucide-react';

import {
  MOCK_IOCS,
  type MockIoc,
} from '../data/mockData';

import PageHeader from '../components/layout/PageHeader';

const TYPE_ICONS = {
  ip: Server,
  domain: Globe,
  hash: Hash,
  url: Link2,
} as const;

const TYPE_LABELS = {
  ip: 'IP ADDRESS',
  domain: 'DOMAIN',
  hash: 'HASH',
  url: 'URL',
} as const;

function severityClass(
  severity: MockIoc['severity']
) {
  return severity;
}

function formatDate(
  value: string
) {
  return new Date(value).toLocaleDateString(
    'en-US',
    {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    }
  );
}

function formatDateTime(
  value: string
) {
  return new Date(value).toLocaleString(
    'en-US',
    {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }
  );
}

export default function IocPage() {
  const [search, setSearch] =
    useState('');

  const [advancedMode, setAdvancedMode] =
    useState(false);

  const [activeFilters, setActiveFilters] =
    useState<string[]>([
      'severity:critical',
    ]);

  const [selectedIocId, setSelectedIocId] =
    useState<string | null>(null);

  const [inspectorTab, setInspectorTab] =
    useState<
      'Overview' |
      'Timeline' |
      'Relationships'
    >('Overview');

  const selectedIoc = useMemo(
    () =>
      MOCK_IOCS.find(
        (ioc) =>
          ioc.id === selectedIocId
      ) || null,
    [selectedIocId]
  );

  const filtered = useMemo(() => {
    return MOCK_IOCS.filter((ioc) => {
      const matchSearch =
        !search ||
        ioc.value
          .toLowerCase()
          .includes(
            search.toLowerCase()
          );

      const matchSeverity =
        activeFilters.includes(
          'severity:critical'
        )
          ? ioc.severity ===
          'critical'
          : true;

      return (
        matchSearch &&
        matchSeverity
      );
    });
  }, [
    search,
    activeFilters,
  ]);

  const typeCounts = useMemo(() => {
    return {
      ip: MOCK_IOCS.filter(
        (ioc) =>
          ioc.type === 'ip'
      ).length,

      domain: MOCK_IOCS.filter(
        (ioc) =>
          ioc.type === 'domain'
      ).length,

      hash: MOCK_IOCS.filter(
        (ioc) =>
          ioc.type === 'hash'
      ).length,

      url: MOCK_IOCS.filter(
        (ioc) =>
          ioc.type === 'url'
      ).length,
    };
  }, []);

  const criticalCount =
    MOCK_IOCS.filter(
      (ioc) =>
        ioc.severity ===
        'critical'
    ).length;

  const highCount =
    MOCK_IOCS.filter(
      (ioc) =>
        ioc.severity === 'high'
    ).length;

  const removeFilter = (
    filter: string
  ) => {
    setActiveFilters((prev) =>
      prev.filter(
        (value) =>
          value !== filter
      )
    );
  };

  const clearAllFilters = () => {
    setActiveFilters([]);
    setSearch('');
  };

  return (
    <div className="at-ioc-page">

      {/* ======================================================
          PAGE HEADER
          ====================================================== */}

      <PageHeader
        breadcrumbs={[
          {
            label: 'Intelligence',
          },
          {
            label: 'IOC',
          },
        ]}
        title="Indicators of Compromise"
        description="Manage and analyze IPs, domains, hashes, and URLs."
        actions={
          <>
            <button
              type="button"
              className="at-btn at-btn-secondary at-btn-sm"
            >
              <Download size={13} />
              STIX
            </button>

            <button
              type="button"
              className="at-btn at-btn-primary at-btn-sm"
            >
              <Plus size={13} />
              Add IOC
            </button>
          </>
        }
      />

      {/* ======================================================
          INTELLIGENCE SUMMARY
          ====================================================== */}

      <section className="at-ioc-summary">

        <div className="at-ioc-summary-intro">
          <span className="at-v2-kicker">
            INDICATOR REPOSITORY
          </span>

          <strong>
            {MOCK_IOCS.length}
          </strong>

          <span>
            tracked indicators
          </span>
        </div>

        <div className="at-ioc-summary-types">

          <div className="at-ioc-type-stat">
            <span className="at-ioc-type-icon ip">
              <Server size={14} />
            </span>

            <span>
              <strong>
                {typeCounts.ip}
              </strong>

              <small>
                IP addresses
              </small>
            </span>
          </div>

          <div className="at-ioc-type-stat">
            <span className="at-ioc-type-icon domain">
              <Globe size={14} />
            </span>

            <span>
              <strong>
                {typeCounts.domain}
              </strong>

              <small>
                Domains
              </small>
            </span>
          </div>

          <div className="at-ioc-type-stat">
            <span className="at-ioc-type-icon hash">
              <Hash size={14} />
            </span>

            <span>
              <strong>
                {typeCounts.hash}
              </strong>

              <small>
                Hashes
              </small>
            </span>
          </div>

          <div className="at-ioc-type-stat">
            <span className="at-ioc-type-icon url">
              <Link2 size={14} />
            </span>

            <span>
              <strong>
                {typeCounts.url}
              </strong>

              <small>
                URLs
              </small>
            </span>
          </div>

        </div>

        <div className="at-ioc-summary-severity">

          <div>
            <i className="critical" />

            <strong>
              {criticalCount}
            </strong>

            <small>
              critical
            </small>
          </div>

          <div>
            <i className="high" />

            <strong>
              {highCount}
            </strong>

            <small>
              high
            </small>
          </div>

        </div>

      </section>

      {/* ======================================================
          QUERY BAR
          ====================================================== */}

      <section className="at-ioc-querybar">

        <div className="at-ioc-query-row">

          <div
            className={`at-ioc-search ${advancedMode
                ? 'advanced'
                : ''
              }`}
          >
            {advancedMode ? (
              <TerminalSquare
                size={15}
              />
            ) : (
              <Search size={15} />
            )}

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder={
                advancedMode
                  ? 'e.g. severity:critical AND type:domain'
                  : 'Search indicators, values, tags, sources...'
              }
            />

            {search && (
              <button
                type="button"
                onClick={() =>
                  setSearch('')
                }
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <button
            type="button"
            className={`at-ioc-advanced-toggle ${advancedMode
                ? 'active'
                : ''
              }`}
            onClick={() =>
              setAdvancedMode(
                (value) =>
                  !value
              )
            }
          >
            <TerminalSquare
              size={13}
            />

            Advanced
          </button>

          <div className="at-ioc-query-divider" />

          <span className="at-ioc-result-count">
            {filtered.length.toLocaleString()}
            {' '}
            results
          </span>

        </div>

        <div className="at-ioc-filter-row">

          <span className="at-ioc-filter-label">
            ACTIVE FILTERS
          </span>

          {activeFilters.map(
            (filter) => (
              <span
                key={filter}
                className="at-ioc-filter-chip"
              >
                {filter}

                <button
                  type="button"
                  onClick={() =>
                    removeFilter(
                      filter
                    )
                  }
                >
                  <X size={10} />
                </button>
              </span>
            )
          )}

          {activeFilters.length >
            0 && (
              <button
                type="button"
                className="at-ioc-clear-all"
                onClick={
                  clearAllFilters
                }
              >
                Clear all
              </button>
            )}

          <button
            type="button"
            className="at-ioc-filter-placeholder"
          >
            + Filter
          </button>

        </div>

      </section>

      {/* ======================================================
          WORKSPACE
          ====================================================== */}

      <div className="at-ioc-workspace">

        {/* ====================================================
            LIST
            ==================================================== */}

        <section className="at-ioc-list">

          <div className="at-ioc-list-head">

            <div>
              <span className="at-v2-kicker">
                INDICATOR FEED
              </span>

              <h2>
                Threat indicators
              </h2>
            </div>

            <span className="at-ioc-list-count">
              Showing{' '}
              <strong>
                {filtered.length}
              </strong>
            </span>

          </div>

          <div className="at-ioc-table-wrap">

            <table className="at-ioc-table">

              <thead>
                <tr>
                  <th>
                    Type
                  </th>

                  <th>
                    Indicator
                  </th>

                  <th>
                    Severity
                  </th>

                  <th>
                    Source
                  </th>

                  <th>
                    Last Seen
                  </th>

                  <th>
                    Tags
                  </th>

                  <th />
                </tr>
              </thead>

              <tbody>

                {filtered.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="at-ioc-empty"
                    >
                      <ShieldAlert
                        size={21}
                      />

                      <strong>
                        No indicators
                        found
                      </strong>

                      <span>
                        No IOC values match
                        the current query
                        and filters.
                      </span>

                      <button
                        type="button"
                        onClick={
                          clearAllFilters
                        }
                      >
                        Clear filters
                      </button>
                    </td>
                  </tr>
                ) : (
                  filtered.map(
                    (ioc) => {
                      const Icon =
                        TYPE_ICONS[
                        ioc.type
                        ];

                      const selected =
                        selectedIocId ===
                        ioc.id;

                      return (
                        <tr
                          key={ioc.id}
                          className={
                            selected
                              ? 'active'
                              : ''
                          }
                          onClick={() =>
                            setSelectedIocId(
                              ioc.id
                            )
                          }
                        >
                          <td>
                            <span
                              className={`at-ioc-type-icon-table ${ioc.type}`}
                            >
                              <Icon
                                size={12}
                              />
                            </span>
                          </td>

                          <td>
                            <button
                              type="button"
                              className="at-ioc-value"
                              onClick={(
                                event
                              ) => {
                                event.stopPropagation();

                                setSelectedIocId(
                                  ioc.id
                                );
                              }}
                            >
                              {
                                ioc.value
                              }
                            </button>

                            <span className="at-ioc-type-label">
                              {
                                TYPE_LABELS[
                                ioc.type
                                ]
                              }
                            </span>
                          </td>

                          <td>
                            <span
                              className={`at-ioc-severity ${severityClass(
                                ioc.severity
                              )}`}
                            >
                              <i />
                              {
                                ioc.severity
                              }
                            </span>
                          </td>

                          <td>
                            <span className="at-ioc-source">
                              {
                                ioc.source
                              }
                            </span>
                          </td>

                          <td>
                            <code className="at-ioc-date">
                              {formatDate(
                                ioc.lastSeen
                              )}
                            </code>
                          </td>

                          <td>
                            <div className="at-ioc-tags">
                              {ioc.tags
                                .slice(
                                  0,
                                  2
                                )
                                .map(
                                  (
                                    tag,
                                    index
                                  ) => (
                                    <span
                                      key={`${tag}-${index}`}
                                    >
                                      {
                                        tag
                                      }
                                    </span>
                                  )
                                )}

                              {ioc.tags
                                .length >
                                2 && (
                                  <span>
                                    +
                                    {ioc.tags
                                      .length -
                                      2}
                                  </span>
                                )}
                            </div>
                          </td>

                          <td>
                            <ChevronRight
                              size={13}
                              className="at-ioc-row-arrow"
                            />
                          </td>
                        </tr>
                      );
                    }
                  )
                )}

              </tbody>

            </table>

          </div>

        </section>

        {/* ====================================================
            INSPECTOR
            ==================================================== */}

        <aside className="at-ioc-inspector">
          {!selectedIoc ? (
            <div className="at-ioc-empty-state" style={{ flex: 1 }}>
              <ShieldAlert size={28} className="mb-2 opacity-20" />
              <strong>No Indicator Selected</strong>
              <span>Select an IOC from the list to view its properties and context.</span>
            </div>
          ) : (
            <>
              <div className="at-ioc-inspector-head">

              <div className="at-ioc-inspector-heading">
                <span
                  className={`at-ioc-inspector-icon ${selectedIoc.type}`}
                >
                  {(() => {
                    const Icon =
                      TYPE_ICONS[
                      selectedIoc
                        .type
                      ];

                    return (
                      <Icon size={19} />
                    );
                  })()}
                </span>

                <div>
                  <span>
                    {
                      TYPE_LABELS[
                      selectedIoc
                        .type
                      ]
                    }
                  </span>

                  <strong
                    title={
                      selectedIoc.value
                    }
                  >
                    {
                      selectedIoc.value
                    }
                  </strong>
                </div>
              </div>

              <button
                type="button"
                className="at-ioc-close"
                onClick={() =>
                  setSelectedIocId(
                    null
                  )
                }
                aria-label="Close inspector"
              >
                <X size={15} />
              </button>

            </div>

            <div className="at-ioc-inspector-meta">

              <span
                className={`at-ioc-inspector-severity ${selectedIoc.severity}`}
              >
                <i />

                {selectedIoc.severity.toUpperCase()}
                {' '}
                RISK
              </span>

              <span className="at-ioc-inspector-source">
                {selectedIoc.source}
              </span>

            </div>

            {/* Tabs */}

            <div className="at-ioc-tabs">

              {[
                'Overview',
                'Timeline',
                'Relationships',
              ].map((tab) => (
                <button
                  type="button"
                  key={tab}
                  className={
                    inspectorTab ===
                      tab
                      ? 'active'
                      : ''
                  }
                  onClick={() =>
                    setInspectorTab(
                      tab as
                      | 'Overview'
                      | 'Timeline'
                      | 'Relationships'
                    )
                  }
                >
                  {tab}
                </button>
              ))}

            </div>

            {/* Inspector content */}

            <div className="at-ioc-inspector-scroll">

              {inspectorTab ===
                'Overview' && (
                  <div className="at-ioc-inspector-content">

                    {/* Observation */}
                    <section className="at-ioc-inspector-block">

                      <div className="at-ioc-block-title">
                        <span>
                          OBSERVATION
                        </span>

                        <Activity
                          size={12}
                        />
                      </div>

                      <div className="at-ioc-observation-grid">

                        <div>
                          <span>
                            First Seen
                          </span>

                          <code>
                            {formatDateTime(
                              selectedIoc.firstSeen
                            )}
                          </code>
                        </div>

                        <div>
                          <span>
                            Last Seen
                          </span>

                          <code>
                            {formatDateTime(
                              selectedIoc.lastSeen
                            )}
                          </code>
                        </div>

                      </div>

                    </section>

                    {/* Intelligence tags */}
                    <section className="at-ioc-inspector-block">

                      <div className="at-ioc-block-title">
                        <span>
                          INTELLIGENCE TAGS
                        </span>

                        <Hash size={12} />
                      </div>

                      <div className="at-ioc-inspector-tags">
                        {selectedIoc.tags.map(
                          (
                            tag,
                            index
                          ) => (
                            <span
                              key={`${tag}-${index}`}
                            >
                              {
                                tag
                              }
                            </span>
                          )
                        )}
                      </div>

                    </section>

                    {/* Source */}
                    <section className="at-ioc-inspector-block">

                      <div className="at-ioc-block-title">
                        <span>
                          SOURCE
                        </span>

                        <Globe size={12} />
                      </div>

                      <div className="at-ioc-source-card">

                        <strong>
                          {
                            selectedIoc.source
                          }
                        </strong>

                        <span>
                          Intelligence
                          provider
                        </span>

                      </div>

                    </section>

                    {/* Automated actions */}
                    <section className="at-ioc-inspector-block">

                      <div className="at-ioc-block-title">
                        <span>
                          AUTOMATED ACTIONS
                        </span>

                        <Target size={12} />
                      </div>

                      <div className="at-ioc-action-list">

                        <button
                          type="button"
                          className="at-ioc-action"
                        >
                          <span className="at-ioc-action-icon">
                            <Target
                              size={12}
                            />
                          </span>

                          <span>
                            <strong>
                              Hunt in environment
                            </strong>

                            <small>
                              Search this
                              indicator
                              across the
                              environment.
                            </small>
                          </span>

                          <ExternalLink
                            size={12}
                          />
                        </button>

                        <button
                          type="button"
                          className="at-ioc-action"
                        >
                          <span className="at-ioc-action-icon">
                            <Network
                              size={12}
                            />
                          </span>

                          <span>
                            <strong>
                              Pivot to Graph
                            </strong>

                            <small>
                              Explore
                              relationships
                              around this
                              indicator.
                            </small>
                          </span>

                          <ExternalLink
                            size={12}
                          />
                        </button>

                      </div>

                    </section>

                  </div>
                )}

              {inspectorTab ===
                'Timeline' && (
                  <div className="at-ioc-empty-state">

                    <Activity
                      size={22}
                    />

                    <strong>
                      No timeline events
                    </strong>

                    <span>
                      No timeline events are
                      recorded for this
                      indicator in the
                      current prototype.
                    </span>

                  </div>
                )}

              {inspectorTab ===
                'Relationships' && (
                  <div className="at-ioc-empty-state">

                    <Network
                      size={22}
                    />

                    <strong>
                      No relationships
                    </strong>

                    <span>
                      No related entities are
                      recorded for this
                      indicator in the
                      current prototype.
                    </span>

                  </div>
                )}

            </div>

            {/* Footer actions */}

            <div className="at-ioc-inspector-footer">

              <button
                type="button"
                className="at-btn at-btn-secondary"
              >
                View Full Report
                <ArrowUpRight
                  size={12}
                />
              </button>

            </div>
            </>
          )}
        </aside>

      </div>

    </div>
  );
}