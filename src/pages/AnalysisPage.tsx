import { useState } from 'react';

import {
    ArrowUpRight,
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
    X,
} from 'lucide-react';

import {
    MOCK_HOSTS,
    type MockHost,
} from '../data/mockData';

import PageHeader from '../components/layout/PageHeader';

interface AnalysisPageProps {
    onNavigate: (id: string) => void;
}

function formatDate(
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

const RISK_ORDER = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
} as const;

function riskClass(
    risk: MockHost['riskLevel']
) {
    return risk.toLowerCase();
}

export default function AnalysisPage({
    onNavigate,
}: AnalysisPageProps) {
    const [query, setQuery] =
        useState('');

    const [riskFilter, setRiskFilter] =
        useState('ALL');

    const [blacklistedOnly, setBlacklistedOnly] =
        useState(false);

    const [selectedHost, setSelectedHost] =
        useState<MockHost | null>(
            MOCK_HOSTS[0] ?? null
        );

    const filteredHosts =
        MOCK_HOSTS
            .filter((host) => {
                const needle =
                    query.trim().toLowerCase();

                if (!needle) {
                    return true;
                }

                return (
                    host.ip
                        .toLowerCase()
                        .includes(needle) ||
                    host.country
                        .toLowerCase()
                        .includes(needle) ||
                    host.countryCode
                        .toLowerCase()
                        .includes(needle) ||
                    host.asn
                        ?.toLowerCase()
                        .includes(needle) ||
                    false ||
                    host.org
                        ?.toLowerCase()
                        .includes(needle) ||
                    false
                );
            })
            .filter(
                (host) =>
                    riskFilter === 'ALL' ||
                    host.riskLevel === riskFilter
            )
            .filter(
                (host) =>
                    !blacklistedOnly ||
                    host.isBlacklisted
            )
            .sort(
                (a, b) =>
                    RISK_ORDER[b.riskLevel] -
                    RISK_ORDER[a.riskLevel]
            );

    const critical =
        filteredHosts.filter(
            (host) =>
                host.riskLevel === 'CRITICAL'
        ).length;

    const high =
        filteredHosts.filter(
            (host) =>
                host.riskLevel === 'HIGH'
        ).length;

    const blacklisted =
        filteredHosts.filter(
            (host) =>
                host.isBlacklisted
        ).length;

    const activeFilters =
        riskFilter !== 'ALL' ||
        blacklistedOnly ||
        Boolean(query);

    function clearFilters() {
        setQuery('');
        setRiskFilter('ALL');
        setBlacklistedOnly(false);
    }

    return (
        <div className="at-analysis-page">

            <PageHeader
                breadcrumbs={[
                    {
                        label: 'Investigate',
                    },
                    {
                        label: 'Analysis',
                    },
                ]}
                title="Analysis"
                description={`${filteredHosts.length} analyzed hosts · sortable risk intelligence`}
                actions={
                    <button
                        type="button"
                        className="at-btn at-btn-secondary at-btn-sm"
                        onClick={() =>
                            onNavigate(
                                'investigation'
                            )
                        }
                    >
                        <Network size={13} />
                        Investigation
                        <ArrowUpRight
                            size={12}
                        />
                    </button>
                }
                filters={
                    <div className="at-analysis-filterbar">

                        <div className="at-analysis-search">
                            <Search size={14} />

                            <input
                                value={query}
                                onChange={(event) =>
                                    setQuery(
                                        event.target.value
                                    )
                                }
                                placeholder="Search IP, ASN, country, organization..."
                            />

                            {query && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        setQuery('')
                                    }
                                    aria-label="Clear search"
                                >
                                    <X size={13} />
                                </button>
                            )}
                        </div>

                        <label className="at-analysis-select-wrap">
                            <span>
                                RISK
                            </span>

                            <select
                                value={riskFilter}
                                onChange={(event) =>
                                    setRiskFilter(
                                        event.target.value
                                    )
                                }
                            >
                                <option value="ALL">
                                    All
                                </option>

                                <option value="CRITICAL">
                                    Critical
                                </option>

                                <option value="HIGH">
                                    High
                                </option>

                                <option value="MEDIUM">
                                    Medium
                                </option>

                                <option value="LOW">
                                    Low
                                </option>
                            </select>
                        </label>

                        <button
                            type="button"
                            className={`at-analysis-blacklist-filter ${blacklistedOnly
                                    ? 'active'
                                    : ''
                                }`}
                            onClick={() =>
                                setBlacklistedOnly(
                                    (value) =>
                                        !value
                                )
                            }
                        >
                            <ShieldAlert
                                size={13}
                            />

                            Blacklisted
                        </button>

                        {activeFilters && (
                            <button
                                type="button"
                                className="at-analysis-clear"
                                onClick={
                                    clearFilters
                                }
                            >
                                <CircleX size={13} />
                                Clear
                            </button>
                        )}

                        <div className="at-analysis-filter-spacer" />

                        <div className="at-analysis-summary">
                            <span>
                                <i className="critical" />
                                {critical}
                                <small>
                                    critical
                                </small>
                            </span>

                            <span>
                                <i className="high" />
                                {high}
                                <small>
                                    high
                                </small>
                            </span>

                            <span>
                                <i className="blocked" />
                                {blacklisted}
                                <small>
                                    blocked
                                </small>
                            </span>
                        </div>
                    </div>
                }
            />

            <div className="at-analysis-workspace">

                {/* ======================================================
            HOST TABLE
            ====================================================== */}

                <section className="at-analysis-list">

                    <div className="at-analysis-list-header">
                        <div>
                            <span className="at-v2-kicker">
                                ANALYZED HOSTS
                            </span>

                            <h2>
                                Host intelligence
                            </h2>
                        </div>

                        <span className="at-analysis-record-count">
                            {filteredHosts.length}{' '}
                            records
                        </span>
                    </div>

                    <div className="at-analysis-table-wrap">

                        <table className="at-analysis-table">
                            <thead>
                                <tr>
                                    <th>
                                        Host
                                    </th>

                                    <th>
                                        Risk
                                    </th>

                                    <th>
                                        Score
                                    </th>

                                    <th>
                                        Events
                                    </th>

                                    <th>
                                        Location
                                    </th>

                                    <th>
                                        ASN
                                    </th>

                                    <th>
                                        Organization
                                    </th>

                                    <th>
                                        Last Seen
                                    </th>

                                    <th />
                                </tr>
                            </thead>

                            <tbody>
                                {filteredHosts.length ===
                                    0 ? (
                                    <tr>
                                        <td
                                            colSpan={9}
                                            className="at-analysis-empty"
                                        >
                                            <Filter
                                                size={20}
                                            />

                                            <strong>
                                                No hosts match
                                                the current
                                                filters
                                            </strong>

                                            <span>
                                                Try changing
                                                the search or
                                                risk filters.
                                            </span>

                                            <button
                                                type="button"
                                                onClick={
                                                    clearFilters
                                                }
                                            >
                                                Clear filters
                                            </button>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredHosts.map(
                                        (host) => {
                                            const active =
                                                selectedHost?.ip ===
                                                host.ip;

                                            return (
                                                <tr
                                                    key={`${host.ip}-${host.firstSeen}`}
                                                    className={
                                                        active
                                                            ? 'active'
                                                            : ''
                                                    }
                                                    onClick={() =>
                                                        setSelectedHost(
                                                            host
                                                        )
                                                    }
                                                >
                                                    <td>
                                                        <button
                                                            type="button"
                                                            className="at-analysis-host-ip"
                                                            onClick={(
                                                                event
                                                            ) => {
                                                                event.stopPropagation();

                                                                setSelectedHost(
                                                                    host
                                                                );
                                                            }}
                                                        >
                                                            {host.ip}
                                                        </button>

                                                        <span className="at-analysis-host-country">
                                                            {host.country}
                                                            {' · '}
                                                            {
                                                                host.countryCode
                                                            }
                                                        </span>
                                                    </td>

                                                    <td>
                                                        <span
                                                            className={`at-analysis-risk ${riskClass(
                                                                host.riskLevel
                                                            )}`}
                                                        >
                                                            <i />
                                                            {
                                                                host.riskLevel
                                                            }
                                                        </span>
                                                    </td>

                                                    <td>
                                                        <span className="at-analysis-score">
                                                            {host.totalScore}
                                                        </span>
                                                    </td>

                                                    <td>
                                                        <span className="at-analysis-events">
                                                            {
                                                                host.eventCount
                                                            }
                                                        </span>
                                                    </td>

                                                    <td>
                                                        <span className="at-analysis-country">
                                                            {host.country}
                                                        </span>
                                                    </td>

                                                    <td>
                                                        <code className="at-analysis-code">
                                                            {
                                                                host.asn ||
                                                                '—'
                                                            }
                                                        </code>
                                                    </td>

                                                    <td>
                                                        <span className="at-analysis-org">
                                                            {
                                                                host.org ||
                                                                '—'
                                                            }
                                                        </span>
                                                    </td>

                                                    <td>
                                                        <code className="at-analysis-time">
                                                            {formatDate(
                                                                host.lastSeen
                                                            )}
                                                        </code>
                                                    </td>

                                                    <td>
                                                        <ChevronRight
                                                            size={13}
                                                            className="at-analysis-row-arrow"
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

                {/* ======================================================
            HOST INSPECTOR
            ====================================================== */}

                <aside className="at-analysis-inspector">

                    {!selectedHost ? (
                        <div className="at-analysis-inspector-empty">
                            <Globe2 size={22} />

                            <strong>
                                Select a host
                            </strong>

                            <span>
                                Host enrichment and
                                supporting analysis
                                will appear here.
                            </span>
                        </div>
                    ) : (
                        <>
                            <div className="at-analysis-inspector-header">

                                <div>
                                    <span className="at-v2-kicker">
                                        HOST ANALYSIS
                                    </span>

                                    <h2>
                                        {selectedHost.ip}
                                    </h2>

                                    <span className="at-analysis-inspector-location">
                                        {selectedHost.country}
                                        {' · '}
                                        {
                                            selectedHost.countryCode
                                        }
                                    </span>
                                </div>

                                <span
                                    className={`at-analysis-risk large ${riskClass(
                                        selectedHost.riskLevel
                                    )}`}
                                >
                                    <i />

                                    {
                                        selectedHost.riskLevel
                                    }
                                </span>

                            </div>

                            <div className="at-analysis-inspector-body">

                                {/* Score */}
                                <section className="at-analysis-score-card">

                                    <div className="at-analysis-score-heading">
                                        <div>
                                            <span>
                                                THREAT SCORE
                                            </span>

                                            <strong>
                                                {
                                                    selectedHost.totalScore
                                                }
                                            </strong>
                                        </div>

                                        {selectedHost.isBlacklisted ? (
                                            <span className="at-analysis-blacklisted-badge">
                                                <ShieldAlert
                                                    size={11}
                                                />
                                                BLACKLISTED
                                            </span>
                                        ) : (
                                            <span className="at-analysis-clear-badge">
                                                <ShieldCheck
                                                    size={11}
                                                />
                                                NOT BLOCKED
                                            </span>
                                        )}
                                    </div>

                                    <div className="at-analysis-score-track">
                                        <i
                                            style={{
                                                width: `${selectedHost.totalScore}%`,
                                            }}
                                        />
                                    </div>

                                    <div className="at-analysis-score-range">
                                        <span>
                                            0
                                        </span>

                                        <span>
                                            50
                                        </span>

                                        <span>
                                            100
                                        </span>
                                    </div>

                                </section>

                                {/* Core facts */}
                                <section className="at-analysis-section">

                                    <div className="at-analysis-section-title">
                                        <span>
                                            HOST PROFILE
                                        </span>

                                        <Globe2
                                            size={12}
                                        />
                                    </div>

                                    <div className="at-analysis-facts">

                                        <div>
                                            <span>
                                                Autonomous
                                                System
                                            </span>

                                            <code>
                                                {
                                                    selectedHost.asn ||
                                                    '—'
                                                }
                                            </code>
                                        </div>

                                        <div>
                                            <span>
                                                Organization
                                            </span>

                                            <strong>
                                                {
                                                    selectedHost.org ||
                                                    '—'
                                                }
                                            </strong>
                                        </div>

                                        <div>
                                            <span>
                                                Event Count
                                            </span>

                                            <strong>
                                                {
                                                    selectedHost.eventCount
                                                }
                                            </strong>
                                        </div>

                                        <div>
                                            <span>
                                                Country
                                            </span>

                                            <strong>
                                                {
                                                    selectedHost.country
                                                }
                                            </strong>
                                        </div>

                                        <div>
                                            <span>
                                                First Seen
                                            </span>

                                            <code>
                                                {formatDate(
                                                    selectedHost.firstSeen
                                                )}
                                            </code>
                                        </div>

                                        <div>
                                            <span>
                                                Last Seen
                                            </span>

                                            <code>
                                                {formatDate(
                                                    selectedHost.lastSeen
                                                )}
                                            </code>
                                        </div>

                                    </div>

                                </section>

                                {/* Ports */}
                                <section className="at-analysis-section">

                                    <div className="at-analysis-section-title">
                                        <span>
                                            OBSERVED PORTS
                                        </span>

                                        <Network
                                            size={12}
                                        />
                                    </div>

                                    <div className="at-analysis-port-list">
                                        {selectedHost.ports.map(
                                            (port) => (
                                                <code
                                                    key={port}
                                                >
                                                    {port}
                                                </code>
                                            )
                                        )}
                                    </div>

                                </section>

                                {/* Signatures */}
                                <section className="at-analysis-section">

                                    <div className="at-analysis-section-title">
                                        <span>
                                            SIGNATURES
                                        </span>

                                        <Hash size={12} />
                                    </div>

                                    {selectedHost.signatures.length ===
                                        0 ? (
                                        <div className="at-analysis-no-signatures">
                                            No recorded
                                            signatures
                                        </div>
                                    ) : (
                                        <div className="at-analysis-signature-list">
                                            {selectedHost.signatures.map(
                                                (
                                                    signature
                                                ) => (
                                                    <span
                                                        key={
                                                            signature
                                                        }
                                                    >
                                                        {
                                                            signature
                                                        }
                                                    </span>
                                                )
                                            )}
                                        </div>
                                    )}

                                </section>

                                {/* Timing */}
                                <section className="at-analysis-section">

                                    <div className="at-analysis-section-title">
                                        <span>
                                            OBSERVATION WINDOW
                                        </span>

                                        <Clock3
                                            size={12}
                                        />
                                    </div>

                                    <div className="at-analysis-observation">

                                        <div>
                                            <span>
                                                FIRST OBSERVED
                                            </span>

                                            <code>
                                                {formatDate(
                                                    selectedHost.firstSeen
                                                )}
                                            </code>
                                        </div>

                                        <div>
                                            <span>
                                                LAST OBSERVED
                                            </span>

                                            <code>
                                                {formatDate(
                                                    selectedHost.lastSeen
                                                )}
                                            </code>
                                        </div>

                                    </div>

                                </section>

                                {/* Actions */}
                                <div className="at-analysis-actions">

                                    <button
                                        type="button"
                                        className="at-btn at-btn-primary"
                                        onClick={() =>
                                            onNavigate(
                                                'investigation'
                                            )
                                        }
                                    >
                                        <Network
                                            size={14}
                                        />

                                        Investigate
                                    </button>

                                    <button
                                        type="button"
                                        className="at-btn at-btn-secondary"
                                        onClick={() =>
                                            onNavigate(
                                                'honeypot_logs'
                                            )
                                        }
                                    >
                                        Event Logs
                                        <ArrowUpRight
                                            size={12}
                                        />
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