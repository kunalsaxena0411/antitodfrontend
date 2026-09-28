import {
    useEffect,
    useMemo,
    useState,
    type KeyboardEvent,
} from 'react';

import {
    ArrowUpRight,
    CheckCircle2,
    ChevronRight,
    CircleX,
    Clock3,
    Filter,
    Globe2,
    Hash,
    Network,
    Search,
    ShieldAlert,
    ShieldCheck,
    SlidersHorizontal,
    X,
} from 'lucide-react';

import type { AnalyzedHost } from '../../types';

import { dataProvider } from '../services/dataProvider';
import PageHeader from '../components/layout/PageHeader';

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

interface AnalysisPageProps {
    onNavigate: (id: string) => void;
}

type RiskFilter =
    | 'ALL'
    | 'CRITICAL'
    | 'HIGH'
    | 'MEDIUM'
    | 'LOW';

/* -------------------------------------------------------------------------- */
/*                                  Constants                                 */
/* -------------------------------------------------------------------------- */

const RISK_ORDER: Record<
    AnalyzedHost['riskLevel'],
    number
> = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
};

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

function formatDate(value: string | undefined): string {
    if (!value) {
        return 'Unknown';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return 'Unknown';
    }

    return date.toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
}

function riskClass(
    risk: AnalyzedHost['riskLevel'],
): string {
    return risk.toLowerCase();
}

function clampScore(score: number): number {
    if (!Number.isFinite(score)) {
        return 0;
    }

    return Math.min(100, Math.max(0, score));
}

/* -------------------------------------------------------------------------- */
/*                              Analysis Page                                 */
/* -------------------------------------------------------------------------- */

export default function AnalysisPage({
    onNavigate,
}: AnalysisPageProps) {
    const [MOCK_HOSTS, setMockHosts] = useState<AnalyzedHost[]>([]);

    useEffect(() => {
        (dataProvider as any).getHosts().then((hosts: AnalyzedHost[]) => {
            setMockHosts(hosts);
        });
    }, []);

    /* ------------------------------------------------------------------------ */
    /*                                  State                                   */
    /* ------------------------------------------------------------------------ */

    const [query, setQuery] = useState('');
    const [riskFilter, setRiskFilter] =
        useState<RiskFilter>('ALL');
    const [blacklistedOnly, setBlacklistedOnly] =
        useState(false);

    const [selectedHostIp, setSelectedHostIp] =
        useState<string | null>(
            MOCK_HOSTS[0]?.ip ?? null,
        );

    const [showFilters, setShowFilters] =
        useState(false);

    /* ------------------------------------------------------------------------ */
    /*                        Keep selection synchronized                        */
    /* ------------------------------------------------------------------------ */

    useEffect(() => {
        if (MOCK_HOSTS.length === 0) {
            setSelectedHostIp(null);
            return;
        }

        const selectedStillExists = MOCK_HOSTS.some(
            (host) => host.ip === selectedHostIp,
        );

        if (!selectedStillExists) {
            setSelectedHostIp(MOCK_HOSTS[0].ip);
        }
    }, [MOCK_HOSTS, selectedHostIp]);

    /* ------------------------------------------------------------------------ */
    /*                             Selected host                                */
    /* ------------------------------------------------------------------------ */

    const selectedHost = useMemo(
        () =>
            MOCK_HOSTS.find(
                (host) => host.ip === selectedHostIp,
            ) ?? null,
        [MOCK_HOSTS, selectedHostIp],
    );

    /* ------------------------------------------------------------------------ */
    /*                           Filtered hosts                                 */
    /* ------------------------------------------------------------------------ */

    const filteredHosts = useMemo(() => {
        const needle = query.trim().toLowerCase();

        return [...MOCK_HOSTS]
            .filter((host) => {
                if (!needle) {
                    return true;
                }

                const searchableValues = [
                    host.ip,
                    host.country,
                    host.countryCode,
                    host.asn,
                    host.org,
                ];

                return searchableValues.some((value) =>
                    value
                        ? value.toLowerCase().includes(needle)
                        : false,
                );
            })
            .filter((host) => {
                if (riskFilter === 'ALL') {
                    return true;
                }

                return host.riskLevel === riskFilter;
            })
            .filter((host) => {
                if (!blacklistedOnly) {
                    return true;
                }

                return host.rblStatus === 'LISTED';
            })
            .sort(
                (a, b) =>
                    RISK_ORDER[b.riskLevel] -
                    RISK_ORDER[a.riskLevel],
            );
    }, [
        MOCK_HOSTS,
        query,
        riskFilter,
        blacklistedOnly,
    ]);

    /* ------------------------------------------------------------------------ */
    /*                              Summary data                                */
    /* ------------------------------------------------------------------------ */

    const summary = useMemo(
        () => ({
            critical: filteredHosts.filter(
                (host) => host.riskLevel === 'CRITICAL',
            ).length,

            high: filteredHosts.filter(
                (host) => host.riskLevel === 'HIGH',
            ).length,

            blacklisted: filteredHosts.filter(
                (host) => host.rblStatus === 'LISTED',
            ).length,

            total: filteredHosts.length,
        }),
        [filteredHosts],
    );

    const hasActiveFilters =
        riskFilter !== 'ALL' ||
        blacklistedOnly ||
        Boolean(query.trim());

    /* ------------------------------------------------------------------------ */
    /*                                Actions                                   */
    /* ------------------------------------------------------------------------ */

    const clearFilters = () => {
        setQuery('');
        setRiskFilter('ALL');
        setBlacklistedOnly(false);
    };

    const clearQuery = () => {
        setQuery('');
    };

    const openHost = (host: AnalyzedHost) => {
        setSelectedHostIp(host.ip);
    };

    const handleRowKeyDown = (
        event: KeyboardEvent<HTMLTableRowElement>,
        host: AnalyzedHost,
    ) => {
        if (
            event.key === 'Enter' ||
            event.key === ' '
        ) {
            event.preventDefault();
            openHost(host);
        }
    };

    /* ------------------------------------------------------------------------ */
    /*                                  Render                                  */
    /* ------------------------------------------------------------------------ */

    return (
        <div className="at-analysis-page">
            {/* ================================================================== */
      /* PAGE HEADER                                                         */
      /* ================================================================== */}

            <PageHeader
                breadcrumbs={[
                    {
                        label: 'Investigate',
                    },
                    {
                        label: 'Analysis',
                    },
                ]}
                title="Host Analysis"
                description={`${summary.total} analyzed ${summary.total === 1 ? 'host' : 'hosts'
                    } · sorted by risk`}
                actions={
                    <button
                        type="button"
                        className="at-btn at-btn-secondary at-btn-sm"
                        onClick={() =>
                            onNavigate('investigate')
                        }
                    >
                        <Network size={13} />
                        Investigation
                        <ArrowUpRight size={12} />
                    </button>
                }
                filters={
                    <div className="at-analysis-filterbar">
                        {/* Search */}

                        <div className="at-analysis-search">
                            <Search size={14} />

                            <input
                                type="search"
                                value={query}
                                onChange={(event) =>
                                    setQuery(event.target.value)
                                }
                                placeholder="Search IP, ASN, country, organization..."
                                aria-label="Search analyzed hosts"
                                spellCheck={false}
                            />

                            {query && (
                                <button
                                    type="button"
                                    onClick={clearQuery}
                                    aria-label="Clear search"
                                >
                                    <X size={13} />
                                </button>
                            )}
                        </div>

                        {/* Risk */}

                        <label className="at-analysis-select-wrap">
                            <span>RISK</span>

                            <select
                                value={riskFilter}
                                onChange={(event) =>
                                    setRiskFilter(
                                        event.target.value as RiskFilter,
                                    )
                                }
                                aria-label="Filter by risk level"
                            >
                                <option value="ALL">All</option>
                                <option value="CRITICAL">
                                    Critical
                                </option>
                                <option value="HIGH">High</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="LOW">Low</option>
                            </select>
                        </label>

                        {/* Blacklist */}

                        <button
                            type="button"
                            className={`at-analysis-blacklist-filter ${blacklistedOnly ? 'active' : ''
                                }`}
                            onClick={() =>
                                setBlacklistedOnly(
                                    (current) => !current,
                                )
                            }
                            aria-pressed={blacklistedOnly}
                        >
                            <ShieldAlert size={13} />
                            Blacklisted
                        </button>

                        {/* Additional filters */}

                        <button
                            type="button"
                            className={`at-analysis-blacklist-filter ${showFilters ? 'active' : ''
                                }`}
                            onClick={() =>
                                setShowFilters(
                                    (current) => !current,
                                )
                            }
                            aria-expanded={showFilters}
                        >
                            <SlidersHorizontal size={13} />
                            Filters
                        </button>

                        {hasActiveFilters && (
                            <button
                                type="button"
                                className="at-analysis-clear"
                                onClick={clearFilters}
                            >
                                <CircleX size={13} />
                                Clear
                            </button>
                        )}

                        <div className="at-analysis-filter-spacer" />

                        {/* Summary */}

                        <div className="at-analysis-summary">
                            <span>
                                <i className="critical" />
                                {summary.critical}
                                <small>critical</small>
                            </span>

                            <span>
                                <i className="high" />
                                {summary.high}
                                <small>high</small>
                            </span>

                            <span>
                                <i className="blocked" />
                                {summary.blacklisted}
                                <small>blocked</small>
                            </span>
                        </div>
                    </div>
                }
            />

            {showFilters && (
                <div className="at-analysis-extra-filters">
                    <div className="at-analysis-extra-filter">
                        <Filter size={13} />

                        <span>
                            Showing hosts with
                            {riskFilter === 'ALL'
                                ? ' any risk level'
                                : ` ${riskFilter.toLowerCase()} risk`}
                        </span>
                    </div>

                    <div className="at-analysis-extra-filter">
                        {blacklistedOnly ? (
                            <Check size={13} />
                        ) : (
                            <ShieldCheck size={13} />
                        )}

                        <span>
                            {blacklistedOnly
                                ? 'Only RBL-listed hosts'
                                : 'All blacklist states'}
                        </span>
                    </div>

                    <span className="at-analysis-extra-note">
                        Search applies across IP, country, ASN,
                        and organization.
                    </span>
                </div>
            )}

            {/* ================================================================== */
      /* WORKSPACE                                                           */
      /* ================================================================== */}

            <div className="at-analysis-workspace">
                {/* ================================================================ */
        /* HOST TABLE                                                        */
        /* ================================================================ */}

                <section className="at-analysis-list">
                    <div className="at-analysis-list-header">
                        <div>
                            <span className="at-v2-kicker">
                                ANALYZED HOSTS
                            </span>

                            <h2>Host intelligence</h2>
                        </div>

                        <span className="at-analysis-record-count">
                            {filteredHosts.length}{' '}
                            {filteredHosts.length === 1
                                ? 'record'
                                : 'records'}
                        </span>
                    </div>

                    <div className="at-analysis-table-wrap">
                        <table className="at-analysis-table">
                            <thead>
                                <tr>
                                    <th>Host</th>
                                    <th>Risk</th>
                                    <th>Score</th>
                                    <th>Events</th>
                                    <th>Location</th>
                                    <th>ASN</th>
                                    <th>Organization</th>
                                    <th>Last Seen</th>
                                    <th />
                                </tr>
                            </thead>

                            <tbody>
                                {filteredHosts.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={9}
                                            className="at-analysis-empty"
                                        >
                                            <Filter size={20} />

                                            <strong>
                                                No hosts match the current
                                                filters
                                            </strong>

                                            <span>
                                                Try changing the search,
                                                risk, or blacklist filters.
                                            </span>

                                            <button
                                                type="button"
                                                onClick={clearFilters}
                                            >
                                                Clear filters
                                            </button>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredHosts.map((host, index) => {
                                        const active =
                                            selectedHost?.ip === host.ip;

                                        return (
                                            <tr
                                                key={`${host.ip}-${host.firstSeen}-${index}`}
                                                className={
                                                    active ? 'active' : ''
                                                }
                                                tabIndex={0}
                                                aria-selected={active}
                                                onClick={() =>
                                                    openHost(host)
                                                }
                                                onKeyDown={(event) =>
                                                    handleRowKeyDown(
                                                        event,
                                                        host,
                                                    )
                                                }
                                            >
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="at-analysis-host-ip"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            openHost(host);
                                                        }}
                                                    >
                                                        {host.ip}
                                                    </button>

                                                    <span className="at-analysis-host-country">
                                                        {host.country}
                                                        {' · '}
                                                        {host.countryCode}
                                                    </span>
                                                </td>

                                                <td>
                                                    <span
                                                        className={`at-analysis-risk ${riskClass(
                                                            host.riskLevel,
                                                        )}`}
                                                    >
                                                        <i />
                                                        {host.riskLevel}
                                                    </span>
                                                </td>

                                                <td>
                                                    <span className="at-analysis-score">
                                                        {host.totalScore}
                                                    </span>
                                                </td>

                                                <td>
                                                    <span className="at-analysis-events">
                                                        {host.eventCount}
                                                    </span>
                                                </td>

                                                <td>
                                                    <span className="at-analysis-country">
                                                        {host.country}
                                                    </span>
                                                </td>

                                                <td>
                                                    <code className="at-analysis-code">
                                                        {host.asn || '—'}
                                                    </code>
                                                </td>

                                                <td>
                                                    <span className="at-analysis-org">
                                                        {host.org || '—'}
                                                    </span>
                                                </td>

                                                <td>
                                                    <code className="at-analysis-time">
                                                        {formatDate(
                                                            host.lastSeen,
                                                        )}
                                                    </code>
                                                </td>

                                                <td>
                                                    <ChevronRight
                                                        size={13}
                                                        className="at-analysis-row-arrow"
                                                        aria-hidden="true"
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* ================================================================ */
        /* HOST INSPECTOR                                                    */
        /* ================================================================ */}

                <aside className="at-analysis-inspector">
                    {!selectedHost ? (
                        <div className="at-analysis-inspector-empty">
                            <Globe2 size={22} />

                            <strong>Select a host</strong>

                            <span>
                                Host enrichment and supporting
                                analysis will appear here.
                            </span>
                        </div>
                    ) : (
                        <>
                            {/* ---------------------------------------------------------- */
              /* Inspector header                                            */
              /* ---------------------------------------------------------- */}

              <div className="at-analysis-inspector-header">
                <div>
                  <span className="at-v2-kicker">
                    HOST ANALYSIS
                  </span>

                  <h2>{selectedHost.ip}</h2>

                  <span className="at-analysis-inspector-location">
                    {selectedHost.country}
                    {' · '}
                    {selectedHost.countryCode}
                  </span>
                </div>

                <span
                  className={`at-analysis-risk large ${riskClass(
                    selectedHost.riskLevel,
                  )}`}
                >
                  <i />
                  {selectedHost.riskLevel}
                </span>
              </div>

              <div className="at-analysis-inspector-body">
                {/* ======================================================== */
                /* Threat score                                               */
                /* ======================================================== */}

                <section className="at-analysis-score-card">
                  <div className="at-analysis-score-heading">
                    <div>
                      <span>THREAT SCORE</span>

                      <strong>
                        {selectedHost.totalScore}
                      </strong>
                    </div>

                    {selectedHost.isBlacklisted ? (
                      <span className="at-analysis-blacklisted-badge">
                        <ShieldAlert size={11} />
                        BLACKLISTED
                      </span>
                    ) : (
                      <span className="at-analysis-clear-badge">
                        <ShieldCheck size={11} />
                        NOT BLOCKED
                      </span>
                    )}
                  </div>

                  <div className="at-analysis-score-track">
                    <i
                      style={{
                        width: `${clampScore(
                          selectedHost.totalScore,
                        )}%`,
                      }}
                    />
                  </div>

                  <div className="at-analysis-score-range">
                    <span>0</span>
                    <span>50</span>
                    <span>100</span>
                  </div>
                </section>

                {/* ======================================================== */
                /* Host profile                                               */
                /* ======================================================== */}

                <section className="at-analysis-section">
                  <div className="at-analysis-section-title">
                    <span>HOST PROFILE</span>
                    <Globe2 size={12} />
                  </div>

                  <div className="at-analysis-facts">
                    <div>
                      <span>
                        Autonomous System
                      </span>

                      <code>
                        {selectedHost.asn || '—'}
                      </code>
                    </div>

                    <div>
                      <span>Organization</span>

                      <strong>
                        {selectedHost.org || '—'}
                      </strong>
                    </div>

                    <div>
                      <span>Event Count</span>

                      <strong>
                        {selectedHost.eventCount}
                      </strong>
                    </div>

                    <div>
                      <span>Country</span>

                      <strong>
                        {selectedHost.country}
                      </strong>
                    </div>

                    <div>
                      <span>First Seen</span>

                      <code>
                        {formatDate(
                          selectedHost.firstSeen,
                        )}
                      </code>
                    </div>

                    <div>
                      <span>Last Seen</span>

                      <code>
                        {formatDate(
                          selectedHost.lastSeen,
                        )}
                      </code>
                    </div>
                  </div>
                </section>

                {/* ======================================================== */
                /* Ports                                                      */
                /* ======================================================== */}

                <section className="at-analysis-section">
                  <div className="at-analysis-section-title">
                    <span>OBSERVED PORTS</span>
                    <Network size={12} />
                  </div>

                  {!selectedHost.ports || selectedHost.ports.length === 0 ? (
                    <div className="at-analysis-no-signatures">
                      No observed ports
                    </div>
                  ) : (
                    <div className="at-analysis-port-list">
                      {selectedHost.ports.map(
                        (port) => (
                          <code key={port}>
                            {port}
                          </code>
                        ),
                      )}
                    </div>
                  )}
                </section>

                {/* ======================================================== */
                /* Signatures                                                 */
                /* ======================================================== */}

                <section className="at-analysis-section">
                  <div className="at-analysis-section-title">
                    <span>SIGNATURES</span>
                    <Hash size={12} />
                  </div>

                  {!selectedHost.signatures || selectedHost.signatures.length === 0 ? (
                    <div className="at-analysis-no-signatures">
                      No recorded signatures
                    </div>
                  ) : (
                    <div className="at-analysis-signature-list">
                      {selectedHost.signatures.map(
                        (signature, index) => (
                          <span key={signature.name || index}>
                            {signature.name}
                          </span>
                        ),
                      )}
                    </div>
                  )}
                </section>

                {/* ======================================================== */
                /* Observation window                                        */
                /* ======================================================== */}

                <section className="at-analysis-section">
                  <div className="at-analysis-section-title">
                    <span>OBSERVATION WINDOW</span>
                    <Clock3 size={12} />
                  </div>

                  <div className="at-analysis-observation">
                    <div>
                      <span>FIRST OBSERVED</span>

                      <code>
                        {formatDate(
                          selectedHost.firstSeen,
                        )}
                      </code>
                    </div>

                    <div>
                      <span>LAST OBSERVED</span>

                      <code>
                        {formatDate(
                          selectedHost.lastSeen,
                        )}
                      </code>
                    </div>
                  </div>
                </section>

                {/* ======================================================== */
                /* Actions                                                    */
                /* ======================================================== */}

                <div className="at-analysis-actions">
                  <button
                    type="button"
                    className="at-btn at-btn-primary"
                    onClick={() =>
                      onNavigate('investigate')
                    }
                  >
                    <Network size={14} />
                    Investigate
                  </button>

                  <button
                    type="button"
                    className="at-btn at-btn-secondary"
                    onClick={() =>
                      onNavigate('honeypot_logs')
                    }
                  >
                    Event Logs
                    <ArrowUpRight size={12} />
                  </button>
                </div>
              </div>
            </>
                    )}
                </aside>
            </div>
        </div>
    );
}