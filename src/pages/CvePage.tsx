import {
  useMemo,
  useState,
} from 'react';

import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  CircleX,
  Download,
  ExternalLink,
  FileWarning,
  Search,
  Server,
  ShieldAlert,
  Target,
  TerminalSquare,
  X,
} from 'lucide-react';

import {
  MOCK_CVES,
  type MockCve,
} from '../data/mockData';

import PageHeader from '../components/layout/PageHeader';

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

function severityClass(
  severity: MockCve['severity']
) {
  return severity;
}

function severityLabel(
  severity: MockCve['severity']
) {
  return severity.toUpperCase();
}

export default function CvePage() {
  const [search, setSearch] =
    useState('');

  const [advancedMode, setAdvancedMode] =
    useState(false);

  const [activeFilters, setActiveFilters] =
    useState<string[]>([
      'has_exploit:true',
    ]);

  const [selectedCveId, setSelectedCveId] =
    useState<string | null>(null);

  const [inspectorTab, setInspectorTab] =
    useState<
      'Overview' |
      'Affected Systems' |
      'References'
    >('Overview');

  const selectedCve =
    useMemo(
      () =>
        MOCK_CVES.find(
          (cve) =>
            cve.id ===
            selectedCveId
        ) || null,
      [selectedCveId]
    );

  const filtered = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return MOCK_CVES.filter(
      (cve) => {
        const matchSearch =
          !query ||
          cve.id
            .toLowerCase()
            .includes(query) ||
          cve.description
            .toLowerCase()
            .includes(query);

        const matchExploit =
          activeFilters.includes(
            'has_exploit:true'
          )
            ? cve.exploitAvailable
            : true;

        return (
          matchSearch &&
          matchExploit
        );
      }
    );
  }, [
    search,
    activeFilters,
  ]);

  const criticalCount =
    MOCK_CVES.filter(
      (cve) =>
        cve.severity ===
        'critical'
    ).length;

  const highCount =
    MOCK_CVES.filter(
      (cve) =>
        cve.severity ===
        'high'
    ).length;

  const exploitCount =
    MOCK_CVES.filter(
      (cve) =>
        cve.exploitAvailable
    ).length;

  const vendorCount =
    new Set(
      MOCK_CVES.map(
        (cve) =>
          cve.vendor
      )
    ).size;

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
    setSearch('');
    setActiveFilters([]);
  };

  return (
    <div className="at-cve-page">

      {/* ======================================================
          HEADER
          ====================================================== */}

      <PageHeader
        breadcrumbs={[
          {
            label: 'Intelligence',
          },
          {
            label: 'CVE Database',
          },
        ]}
        title="CVE Database"
        description="Track and analyze Common Vulnerabilities and Exposures."
        actions={
          <button
            type="button"
            className="at-btn at-btn-secondary at-btn-sm"
          >
            <Download size={13} />
            Export JSON
          </button>
        }
      />

      {/* ======================================================
          VULNERABILITY SUMMARY
          ====================================================== */}

      <section className="at-cve-summary">

        <div className="at-cve-summary-total">
          <span className="at-v2-kicker">
            VULNERABILITY REPOSITORY
          </span>

          <div className="at-cve-total-value">
            <strong>
              {MOCK_CVES.length}
            </strong>

            <span>
              indexed vulnerabilities
            </span>
          </div>
        </div>

        <div className="at-cve-summary-stats">

          <div className="at-cve-summary-stat">
            <span className="at-cve-summary-icon critical">
              <ShieldAlert
                size={14}
              />
            </span>

            <div>
              <strong>
                {criticalCount}
              </strong>

              <small>
                critical
              </small>
            </div>
          </div>

          <div className="at-cve-summary-stat">
            <span className="at-cve-summary-icon high">
              <AlertTriangle
                size={14}
              />
            </span>

            <div>
              <strong>
                {highCount}
              </strong>

              <small>
                high severity
              </small>
            </div>
          </div>

          <div className="at-cve-summary-stat">
            <span className="at-cve-summary-icon exploit">
              <Target size={14} />
            </span>

            <div>
              <strong>
                {exploitCount}
              </strong>

              <small>
                exploits available
              </small>
            </div>
          </div>

          <div className="at-cve-summary-stat">
            <span className="at-cve-summary-icon vendor">
              <FileWarning
                size={14}
              />
            </span>

            <div>
              <strong>
                {vendorCount}
              </strong>

              <small>
                vendors
              </small>
            </div>
          </div>

        </div>

      </section>

      {/* ======================================================
          QUERY
          ====================================================== */}

      <section className="at-cve-query">

        <div className="at-cve-query-main">

          <div
            className={`at-cve-search ${advancedMode
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
                  ? 'Use advanced CVE search syntax...'
                  : 'Search CVE-ID or description...'
              }
            />

            {search && (
              <button
                type="button"
                onClick={() =>
                  setSearch('')
                }
                aria-label="Clear CVE search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <button
            type="button"
            className={`at-cve-advanced ${advancedMode
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

          <span className="at-cve-query-count">
            {filtered.length}
            {' '}
            results
          </span>

        </div>

        <div className="at-cve-filter-row">

          <span className="at-cve-filter-label">
            ACTIVE FILTERS
          </span>

          {activeFilters.map(
            (filter) => (
              <span
                className="at-cve-filter-chip"
                key={filter}
              >
                {filter}

                <button
                  type="button"
                  onClick={() =>
                    removeFilter(
                      filter
                    )
                  }
                  aria-label={`Remove ${filter}`}
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
                className="at-cve-clear"
                onClick={
                  clearAllFilters
                }
              >
                <CircleX size={12} />
                Clear
              </button>
            )}

          <button
            type="button"
            className="at-cve-filter-placeholder"
          >
            + Filter
          </button>

        </div>

      </section>

      {/* ======================================================
          WORKSPACE
          ====================================================== */}

      <div className="at-cve-workspace">

        {/* ====================================================
            LIST
            ==================================================== */}

        <section className="at-cve-list">

          <div className="at-cve-list-head">

            <div>
              <span className="at-v2-kicker">
                VULNERABILITY FEED
              </span>

              <h2>
                Indexed CVEs
              </h2>
            </div>

            <span className="at-cve-list-count">
              Showing{' '}
              <strong>
                {filtered.length}
              </strong>
            </span>

          </div>

          <div className="at-cve-table-wrap">

            <table className="at-cve-table">

              <thead>
                <tr>
                  <th>
                    CVE ID
                  </th>

                  <th>
                    CVSS
                  </th>

                  <th>
                    Severity
                  </th>

                  <th>
                    Description
                  </th>

                  <th>
                    Product
                  </th>

                  <th>
                    Published
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
                      className="at-cve-empty"
                    >
                      <FileWarning
                        size={21}
                      />

                      <strong>
                        No CVEs found
                      </strong>

                      <span>
                        No vulnerabilities
                        match the
                        current search
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
                    (cve) => {
                      const selected =
                        selectedCveId ===
                        cve.id;

                      return (
                        <tr
                          key={cve.id}
                          className={
                            selected
                              ? 'active'
                              : ''
                          }
                          onClick={() =>
                            setSelectedCveId(
                              cve.id
                            )
                          }
                        >
                          <td>

                            <div className="at-cve-id-cell">

                              {cve.exploitAvailable && (
                                <span className="at-cve-exploit-mark">
                                  <Target
                                    size={11}
                                  />
                                </span>
                              )}

                              <div>
                                <button
                                  type="button"
                                  className="at-cve-id"
                                  onClick={(
                                    event
                                  ) => {
                                    event.stopPropagation();

                                    setSelectedCveId(
                                      cve.id
                                    );
                                  }}
                                >
                                  {cve.id}
                                </button>

                                {cve.exploitAvailable && (
                                  <span className="at-cve-id-meta">
                                    EXPLOIT
                                    AVAILABLE
                                  </span>
                                )}
                              </div>

                            </div>

                          </td>

                          <td>

                            <span
                              className={`at-cve-score ${cve.cvss >= 9
                                  ? 'critical'
                                  : cve.cvss >=
                                    7
                                    ? 'high'
                                    : cve.cvss >=
                                      4
                                      ? 'medium'
                                      : 'low'
                                }`}
                            >
                              {cve.cvss.toFixed(
                                1
                              )}
                            </span>

                          </td>

                          <td>

                            <span
                              className={`at-cve-severity ${severityClass(
                                cve.severity
                              )}`}
                            >
                              <i />

                              {severityLabel(
                                cve.severity
                              )}
                            </span>

                          </td>

                          <td>

                            <span className="at-cve-description">
                              {
                                cve.description
                              }
                            </span>

                          </td>

                          <td>

                            <span className="at-cve-product">
                              {cve.vendor}
                              {' '}
                              {cve.product}
                            </span>

                          </td>

                          <td>

                            <code className="at-cve-date">
                              {formatDate(
                                cve.published
                              )}
                            </code>

                          </td>

                          <td>
                            <ChevronRight
                              size={13}
                              className="at-cve-row-arrow"
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

        {selectedCve && (
          <aside className="at-cve-inspector">

            <div className="at-cve-inspector-head">

              <div className="at-cve-heading">

                <span
                  className={`at-cve-heading-icon ${selectedCve.severity}`}
                >
                  <ShieldAlert
                    size={19}
                  />
                </span>

                <div>
                  <span>
                    VULNERABILITY
                  </span>

                  <strong>
                    {
                      selectedCve.id
                    }
                  </strong>

                  <small>
                    {
                      selectedCve.vendor
                    }
                    {' '}
                    {
                      selectedCve.product
                    }
                  </small>
                </div>

              </div>

              <button
                type="button"
                className="at-cve-close"
                onClick={() =>
                  setSelectedCveId(
                    null
                  )
                }
                aria-label="Close CVE inspector"
              >
                <X size={15} />
              </button>

            </div>

            <div className="at-cve-inspector-meta">

              <span
                className={`at-cve-inspector-score ${selectedCve.severity}`}
              >
                CVSS{' '}
                {selectedCve.cvss.toFixed(
                  1
                )}
              </span>

              <span
                className={`at-cve-inspector-severity ${selectedCve.severity}`}
              >
                <i />
                {
                  selectedCve.severity
                }
              </span>

              {selectedCve.exploitAvailable && (
                <span className="at-cve-exploit-badge">
                  <Target size={10} />
                  EXPLOIT AVAILABLE
                </span>
              )}

            </div>

            {/* Tabs */}

            <div className="at-cve-tabs">

              {[
                'Overview',
                'Affected Systems',
                'References',
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
                      | 'Affected Systems'
                      | 'References'
                    )
                  }
                >
                  {tab}
                </button>
              ))}

            </div>

            {/* Content */}

            <div className="at-cve-inspector-scroll">

              {inspectorTab ===
                'Overview' && (
                  <div className="at-cve-inspector-content">

                    <section className="at-cve-inspector-block">

                      <div className="at-cve-block-title">
                        <span>
                          DESCRIPTION
                        </span>
                      </div>

                      <div className="at-cve-description-panel">
                        {
                          selectedCve.description
                        }
                      </div>

                    </section>

                    <section className="at-cve-inspector-block">

                      <div className="at-cve-block-title">
                        <span>
                          VULNERABILITY PROFILE
                        </span>

                        <ShieldAlert
                          size={12}
                        />
                      </div>

                      <div className="at-cve-profile-grid">

                        <div>
                          <span>
                            CVE ID
                          </span>

                          <code>
                            {
                              selectedCve.id
                            }
                          </code>
                        </div>

                        <div>
                          <span>
                            CVSS
                          </span>

                          <strong>
                            {selectedCve.cvss.toFixed(
                              1
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>
                            SEVERITY
                          </span>

                          <strong className="capitalize">
                            {
                              selectedCve.severity
                            }
                          </strong>
                        </div>

                        <div>
                          <span>
                            PRODUCT
                          </span>

                          <strong>
                            {
                              selectedCve.product
                            }
                          </strong>
                        </div>

                        <div>
                          <span>
                            VENDOR
                          </span>

                          <strong>
                            {
                              selectedCve.vendor
                            }
                          </strong>
                        </div>

                        <div>
                          <span>
                            PUBLISHED
                          </span>

                          <code>
                            {formatDate(
                              selectedCve.published
                            )}
                          </code>
                        </div>

                      </div>

                    </section>

                    <section className="at-cve-inspector-block">

                      <div className="at-cve-block-title">
                        <span>
                          EXPLOIT STATUS
                        </span>

                        <Target
                          size={12}
                        />
                      </div>

                      <div
                        className={`at-cve-exploit-status ${selectedCve.exploitAvailable
                            ? 'available'
                            : 'unavailable'
                          }`}
                      >
                        <span>
                          {selectedCve.exploitAvailable ? (
                            <Target
                              size={14}
                            />
                          ) : (
                            <ShieldAlert
                              size={14}
                            />
                          )}
                        </span>

                        <div>
                          <strong>
                            {selectedCve.exploitAvailable
                              ? 'Exploit available'
                              : 'No exploit recorded'}
                          </strong>

                          <small>
                            {selectedCve.exploitAvailable
                              ? 'This vulnerability is marked as having an available exploit in the current dataset.'
                              : 'The current prototype dataset does not mark an available exploit for this CVE.'}
                          </small>
                        </div>
                      </div>

                    </section>

                    <section className="at-cve-inspector-block">

                      <div className="at-cve-block-title">
                        <span>
                          PUBLICATION
                        </span>

                        <CalendarDays
                          size={12}
                        />
                      </div>

                      <div className="at-cve-publication">

                        <div>
                          <span>
                            Published
                          </span>

                          <code>
                            {formatDateTime(
                              selectedCve.published
                            )}
                          </code>
                        </div>

                      </div>

                    </section>

                  </div>
                )}

              {inspectorTab ===
                'Affected Systems' && (
                  <div className="at-cve-empty-state">

                    <Server
                      size={23}
                    />

                    <strong>
                      No internally affected systems
                    </strong>

                    <span>
                      No internally affected
                      systems are available
                      for this CVE in the
                      current prototype.
                    </span>

                    <button
                      type="button"
                    >
                      Run Network Scan
                    </button>

                  </div>
                )}

              {inspectorTab ===
                'References' && (
                  <div className="at-cve-empty-state">

                    <ExternalLink
                      size={22}
                    />

                    <strong>
                      No references loaded
                    </strong>

                    <span>
                      Reference links are not
                      included in the current
                      CVE dataset.
                    </span>

                  </div>
                )}

            </div>

            {/* Footer */}

            <div className="at-cve-inspector-footer">

              <button
                type="button"
                className="at-btn at-btn-secondary"
              >
                View NVD Record
                <ExternalLink
                  size={12}
                />
              </button>

              <button
                type="button"
                className="at-btn at-btn-primary"
              >
                <ArrowUpRight
                  size={12}
                />
                Open Analysis
              </button>

            </div>

          </aside>
        )}

      </div>

    </div>
  );
}