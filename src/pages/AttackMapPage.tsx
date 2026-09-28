import React from 'react';
import {
    useMemo,
    type CSSProperties,
} from 'react';

import {
    Activity,
    ArrowUpRight,
    ChevronRight,
    Crosshair,
    Globe2,
    Maximize2,
    RefreshCw,
    Server,
    ShieldAlert,
    Target,
    Wifi,
} from 'lucide-react';

import type { LogEventV2 } from '../../api/services';

import { dataProvider } from '../services/dataProvider';
import { useAppData } from '../contexts/AppDataContext';
import PageHeader from '../components/layout/PageHeader';

interface AttackMapPageProps {
    onNavigate: (id: string) => void;
}

interface CountryPlot {
    country: string;
    countryCode: string;
    count: number;
    layout: {
        left: number;
        top: number;
    };
    severity: LogEventV2['severity'];
}

type Severity = NonNullable<LogEventV2['severity']>;

const COUNTRY_LAYOUT: Record<
    string,
    { left: number; top: number }
> = {
    CN: { left: 70, top: 42 },
    RU: { left: 61, top: 26 },
    US: { left: 19, top: 43 },
    DE: { left: 50, top: 39 },
    NL: { left: 49, top: 36 },
    BR: { left: 30, top: 68 },
    IN: { left: 63, top: 54 },
    VN: { left: 74, top: 55 },
    KR: { left: 79, top: 44 },
    IR: { left: 58, top: 51 },
    KP: { left: 78, top: 41 },
    UA: { left: 54, top: 36 },
    FR: { left: 47, top: 43 },
    JP: { left: 84, top: 43 },
};

const SEVERITY_WEIGHT: Record<Severity, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
};

function severityColor(
    severity: Severity,
): string {
    switch (severity) {
        case 'critical':
            return '#e5484d';

        case 'high':
            return '#f59e0b';

        case 'medium':
            return '#a97816';

        case 'low':
        default:
            return '#4d8760';
    }
}

function formatTime(timestamp: string): string {
    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
        return '—';
    }

    return date.toLocaleTimeString(
        'en-US',
        {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        },
    );
}

function formatDate(timestamp: string): string {
    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
        return '—';
    }

    return date.toLocaleDateString(
        'en-US',
        {
            month: 'short',
            day: 'numeric',
        },
    );
}

function prettyEvent(
    eventType: string,
): string {
    return eventType
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (letter) =>
            letter.toUpperCase(),
        );
}

export default function AttackMapPage({
    onNavigate,
}: AttackMapPageProps) {
    const [MOCK_EVENTS, set_MOCK_EVENTS] = React.useState<any[]>([]);
    React.useEffect(() => {
        dataProvider.getAttackEvents().then(set_MOCK_EVENTS);
    }, []);

    const events = useMemo(() => {
        return [...MOCK_EVENTS].sort(
            (a, b) =>
                new Date(b.timestamp).getTime() -
                new Date(a.timestamp).getTime(),
        );
    }, [MOCK_EVENTS]);

    const prioritizedEvents = useMemo(() => {
        return [...MOCK_EVENTS].sort(
            (a, b) =>
                SEVERITY_WEIGHT[b.severity] -
                SEVERITY_WEIGHT[a.severity],
        );
    }, [MOCK_EVENTS]);

    const eventCount = MOCK_EVENTS.length;

    const countryCounts = useMemo(() => {
        return MOCK_EVENTS.reduce<Record<string, number>>(
            (accumulator, event) => {
                if (!event.country) {
                    return accumulator;
                }

                accumulator[event.country] =
                    (accumulator[event.country] ?? 0) + 1;

                return accumulator;
            },
            {},
        );
    }, [MOCK_EVENTS]);

    const rankedCountries = useMemo(() => {
        return Object.entries(countryCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6);
    }, [countryCounts]);

    const criticalCount = useMemo(
        () =>
            MOCK_EVENTS.filter(
                (event) =>
                    event.severity === 'critical',
            ).length,
        [MOCK_EVENTS],
    );

    const highCount = useMemo(
        () =>
            MOCK_EVENTS.filter(
                (event) =>
                    event.severity === 'high',
            ).length,
        [MOCK_EVENTS],
    );

    const mediumCount = useMemo(
        () =>
            MOCK_EVENTS.filter(
                (event) =>
                    event.severity === 'medium',
            ).length,
        [MOCK_EVENTS],
    );

    const lowCount = useMemo(
        () =>
            MOCK_EVENTS.filter(
                (event) =>
                    event.severity === 'low',
            ).length,
        [MOCK_EVENTS],
    );

    const uniqueSources = useMemo(
        () =>
            new Set(
                MOCK_EVENTS
                    .map(
                        (event) =>
                            event.src_ip,
                    )
                    .filter(Boolean),
            ).size,
        [MOCK_EVENTS],
    );

    const uniqueEventTypes = useMemo(
        () =>
            new Set(
                MOCK_EVENTS
                    .map(
                        (event) =>
                            event.event_type,
                    )
                    .filter(Boolean),
            ).size,
        [MOCK_EVENTS],
    );

    const plottedCountries =
        useMemo<CountryPlot[]>(
            () => {
                return Object.entries(countryCounts)
                    .map(
                        (
                            [country, count],
                        ): CountryPlot | null => {
                            const event =
                                MOCK_EVENTS.find(
                                    (item) =>
                                        item.country ===
                                        country,
                                );

                            if (!event) {
                                return null;
                            }

                            const layout =
                                COUNTRY_LAYOUT[
                                event
                                    .countryCode
                                ];

                            if (!layout) {
                                return null;
                            }

                            return {
                                country,
                                countryCode:
                                    event.countryCode,
                                count,
                                layout,
                                severity:
                                    event.severity,
                            };
                        },
                    )
                    .filter(
                        (
                            item,
                        ): item is CountryPlot =>
                            item !== null,
                    );
            },
            [
                MOCK_EVENTS,
                countryCounts,
            ],
        );

    const maxCountryEvents =
        rankedCountries[0]?.[1] ?? 1;

    const telemetryAvailable =
        eventCount > 0;

    const severityTotal = Math.max(
        eventCount,
        1,
    );

    const criticalPct = Math.round(
        (criticalCount /
            severityTotal) *
        100,
    );

    const highPct = Math.round(
        (highCount /
            severityTotal) *
        100,
    );

    const mediumPct = Math.round(
        (mediumCount /
            severityTotal) *
        100,
    );

    const lowPct = Math.max(
        0,
        100 -
        criticalPct -
        highPct -
        mediumPct,
    );

    const topEvent =
        prioritizedEvents[0] ?? null;

    const latestEvent =
        events[0] ?? null;

    return (
        <div className="at-attack-map-page-v2">
            <PageHeader
                breadcrumbs={[
                    {
                        label: 'Operations',
                    },
                    {
                        label: 'Attack Map',
                    },
                ]}
                title="Attack Map"
                description="Investigate the geographic distribution, severity and source profile of observed honeypot activity."
                actions={
                    <div className="at-attack-map-actions">
                        <button
                            type="button"
                            className="at-btn at-btn-secondary at-btn-sm"
                            onClick={() =>
                                onNavigate(
                                    'honeypot_logs',
                                )
                            }
                        >
                            <Activity size={13} />
                            Event stream
                        </button>

                        <button
                            type="button"
                            className="at-btn at-btn-primary at-btn-sm"
                            onClick={() =>
                                onNavigate(
                                    'soc_wall',
                                )
                            }
                        >
                            <Wifi size={13} />
                            Open SOC Wall
                        </button>
                    </div>
                }
            />

            <div className="at-attack-map-v2-scroll custom-scrollbar">
                <div className="at-attack-map-v2-content">

                    {/* ==========================================================
                        Operational summary
                       ========================================================== */}

                    <div className="at-map-summary-grid">
                        <div className="at-map-summary-card">
                            <span>
                                OBSERVED EVENTS
                            </span>

                            <strong>
                                {eventCount}
                            </strong>

                            <small>
                                Active telemetry window
                            </small>
                        </div>

                        <div className="at-map-summary-card danger">
                            <span>
                                CRITICAL EVENTS
                            </span>

                            <strong>
                                {criticalCount}
                            </strong>

                            <small>
                                Highest-priority telemetry
                            </small>
                        </div>

                        <div className="at-map-summary-card">
                            <span>
                                UNIQUE SOURCES
                            </span>

                            <strong>
                                {uniqueSources}
                            </strong>

                            <small>
                                Distinct attacking sources
                            </small>
                        </div>

                        <div className="at-map-summary-card">
                            <span>
                                ORIGIN COUNTRIES
                            </span>

                            <strong>
                                {rankedCountries.length}
                            </strong>

                            <small>
                                Geographically enriched sources
                            </small>
                        </div>

                        <div className="at-map-summary-card">
                            <span>
                                EVENT TYPES
                            </span>

                            <strong>
                                {uniqueEventTypes}
                            </strong>

                            <small>
                                Observed attack signatures
                            </small>
                        </div>
                    </div>

                    {/* ==========================================================
                        Primary workspace
                       ========================================================== */}

                    <div className="at-map-primary-grid">

                        <section className="at-map-canvas-panel">

                            <div className="at-map-panel-toolbar">
                                <div className="at-map-toolbar-heading">
                                    <span className="at-map-kicker">
                                        GLOBAL TELEMETRY
                                    </span>

                                    <div className="at-map-toolbar-title-row">
                                        <h2>
                                            Global attack surface
                                        </h2>

                                        <span
                                            className={`at-map-live-state ${telemetryAvailable
                                                    ? 'active'
                                                    : 'idle'
                                                }`}
                                        >
                                            <i />

                                            {telemetryAvailable
                                                ? 'LIVE'
                                                : 'STANDBY'}
                                        </span>
                                    </div>
                                </div>

                                <div className="at-map-toolbar-actions">
                                    <button
                                        type="button"
                                        title="Refresh telemetry"
                                        onClick={() =>
                                            onNavigate(
                                                'honeypot_logs',
                                            )
                                        }
                                    >
                                        <RefreshCw
                                            size={14}
                                        />
                                    </button>

                                    <button
                                        type="button"
                                        title="Open full map"
                                        onClick={() =>
                                            onNavigate(
                                                'soc_wall',
                                            )
                                        }
                                    >
                                        <Maximize2
                                            size={14}
                                        />
                                    </button>
                                </div>
                            </div>

                            <div className="at-map-canvas-v2">

                                <div className="at-map-grid-lines" />

                                <div className="at-map-world world-north-america" />
                                <div className="at-map-world world-south-america" />
                                <div className="at-map-world world-europe" />
                                <div className="at-map-world world-africa" />
                                <div className="at-map-world world-asia" />
                                <div className="at-map-world world-oceania" />

                                <div className="at-map-route route-one" />
                                <div className="at-map-route route-two" />
                                <div className="at-map-route route-three" />

                                <div className="at-map-hq">
                                    <span className="at-map-hq-ring" />

                                    <span className="at-map-hq-core">
                                        <Crosshair
                                            size={16}
                                        />
                                    </span>

                                    <span>
                                        COLLECTION
                                        <br />
                                        INFRASTRUCTURE
                                    </span>
                                </div>

                                {plottedCountries.map(
                                    (country) => {
                                        const nodeStyle = {
                                            left: `${country.layout.left}%`,
                                            top: `${country.layout.top}%`,
                                            '--map-node-color':
                                                severityColor(
                                                    country.severity,
                                                ),
                                        } as CSSProperties;

                                        return (
                                            <button
                                                key={
                                                    country.countryCode
                                                }
                                                type="button"
                                                className={`at-map-country-node ${country.severity}`}
                                                style={
                                                    nodeStyle
                                                }
                                                title={`${country.country} · ${country.count} ${country.count ===
                                                        1
                                                        ? 'event'
                                                        : 'events'
                                                    }`}
                                                onClick={() =>
                                                    onNavigate(
                                                        'honeypot_logs',
                                                    )
                                                }
                                            >
                                                <span className="at-map-node-pulse" />

                                                <span className="at-map-node-core">
                                                    {country.count}
                                                </span>

                                                <span className="at-map-node-code">
                                                    {
                                                        country.countryCode
                                                    }
                                                </span>
                                            </button>
                                        );
                                    },
                                )}

                                {!telemetryAvailable && (
                                    <div className="at-map-empty-state">
                                        <div>
                                            <Globe2
                                                size={24}
                                            />

                                            <strong>
                                                No attack telemetry
                                            </strong>

                                            <span>
                                                The global view will populate
                                                as enriched honeypot events
                                                enter the telemetry stream.
                                            </span>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    onNavigate(
                                                        'honeypot_logs',
                                                    )
                                                }
                                            >
                                                Inspect telemetry
                                                <ArrowUpRight
                                                    size={13}
                                                />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="at-map-canvas-footer">
                                    <span>
                                        <Activity
                                            size={11}
                                        />
                                        ATTACK TELEMETRY
                                    </span>

                                    <span>
                                        {eventCount}{' '}
                                        events ·{' '}
                                        {uniqueSources}{' '}
                                        sources
                                    </span>
                                </div>
                            </div>
                        </section>

                        {/* ======================================================
                            Right-side intelligence rail
                           ====================================================== */}

                        <aside className="at-map-intel-rail">

                            <section className="at-map-side-panel">
                                <div className="at-map-side-header">
                                    <div>
                                        <span>
                                            POSTURE
                                        </span>

                                        <h3>
                                            Current severity
                                        </h3>
                                    </div>

                                    <ShieldAlert
                                        size={16}
                                    />
                                </div>

                                <div className="at-map-severity-bar">
                                    <i
                                        className="critical"
                                        style={{
                                            width: `${criticalPct}%`,
                                        }}
                                    />

                                    <i
                                        className="high"
                                        style={{
                                            width: `${highPct}%`,
                                        }}
                                    />

                                    <i
                                        className="medium"
                                        style={{
                                            width: `${mediumPct}%`,
                                        }}
                                    />

                                    <i
                                        className="low"
                                        style={{
                                            width: `${lowPct}%`,
                                        }}
                                    />
                                </div>

                                <div className="at-map-severity-summary">
                                    <div>
                                        <span>
                                            Critical
                                        </span>

                                        <strong>
                                            {criticalCount}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>
                                            High
                                        </span>

                                        <strong>
                                            {highCount}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>
                                            Medium
                                        </span>

                                        <strong>
                                            {mediumCount}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>
                                            Low
                                        </span>

                                        <strong>
                                            {lowCount}
                                        </strong>
                                    </div>
                                </div>
                            </section>

                            <section className="at-map-side-panel">
                                <div className="at-map-side-header">
                                    <div>
                                        <span>
                                            ORIGIN INTELLIGENCE
                                        </span>

                                        <h3>
                                            Most active countries
                                        </h3>
                                    </div>

                                    <Globe2
                                        size={16}
                                    />
                                </div>

                                {rankedCountries.length >
                                    0 ? (
                                    <div className="at-map-country-list-v2">
                                        {rankedCountries.map(
                                            (
                                                [
                                                    country,
                                                    count,
                                                ],
                                                index,
                                            ) => (
                                                <button
                                                    type="button"
                                                    key={
                                                        country
                                                    }
                                                    onClick={() =>
                                                        onNavigate(
                                                            'honeypot_logs',
                                                        )
                                                    }
                                                >
                                                    <span className="rank">
                                                        {String(
                                                            index +
                                                            1,
                                                        ).padStart(
                                                            2,
                                                            '0',
                                                        )}
                                                    </span>

                                                    <span className="country">
                                                        <strong>
                                                            {
                                                                country
                                                            }
                                                        </strong>

                                                        <span>
                                                            <i
                                                                style={{
                                                                    width: `${Math.max(
                                                                        7,
                                                                        (count /
                                                                            maxCountryEvents) *
                                                                        100,
                                                                    )}%`,
                                                                }}
                                                            />
                                                        </span>
                                                    </span>

                                                    <b>
                                                        {count}
                                                    </b>
                                                </button>
                                            ),
                                        )}
                                    </div>
                                ) : (
                                    <div className="at-map-small-empty">
                                        <Globe2
                                            size={17}
                                        />

                                        <span>
                                            Geographic source
                                            data will appear
                                            here when telemetry
                                            is enriched.
                                        </span>
                                    </div>
                                )}
                            </section>

                            <section className="at-map-side-panel">
                                <div className="at-map-side-header">
                                    <div>
                                        <span>
                                            PRIORITY SIGNAL
                                        </span>

                                        <h3>
                                            Highest severity
                                        </h3>
                                    </div>

                                    <Target
                                        size={16}
                                    />
                                </div>

                                {prioritizedEvents.length >
                                    0 ? (
                                    <div className="at-map-priority-list">
                                        {prioritizedEvents
                                            .slice(
                                                0,
                                                4,
                                            )
                                            .map(
                                                (
                                                    event,
                                                ) => (
                                                    <button
                                                        type="button"
                                                        key={
                                                            event.id
                                                        }
                                                        onClick={() =>
                                                            onNavigate(
                                                                'honeypot_logs',
                                                            )
                                                        }
                                                    >
                                                        <span
                                                            className={`priority-dot ${event.severity}`}
                                                        />

                                                        <span>
                                                            <strong>
                                                                {
                                                                    event.src_ip
                                                                }
                                                            </strong>

                                                            <small>
                                                                {prettyEvent(
                                                                    event.event_type,
                                                                )}
                                                            </small>
                                                        </span>

                                                        <em>
                                                            {
                                                                event.countryCode
                                                            }
                                                        </em>
                                                    </button>
                                                ),
                                            )}
                                    </div>
                                ) : (
                                    <div className="at-map-small-empty">
                                        <Target
                                            size={17}
                                        />

                                        <span>
                                            No priority event
                                            signals are
                                            currently available.
                                        </span>
                                    </div>
                                )}
                            </section>

                            <section className="at-map-side-panel">
                                <div className="at-map-side-header">
                                    <div>
                                        <span>
                                            COLLECTION
                                        </span>

                                        <h3>
                                            Honeypot infrastructure
                                        </h3>
                                    </div>

                                    <Server
                                        size={16}
                                    />
                                </div>

                                <div className="at-map-infra-grid">
                                    <div>
                                        <span>
                                            EVENTS
                                        </span>

                                        <strong>
                                            {eventCount}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>
                                            SOURCES
                                        </span>

                                        <strong>
                                            {uniqueSources}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>
                                            TYPES
                                        </span>

                                        <strong>
                                            {uniqueEventTypes}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>
                                            STATUS
                                        </span>

                                        <strong
                                            className={
                                                telemetryAvailable
                                                    ? 'online'
                                                    : 'standby'
                                            }
                                        >
                                            {telemetryAvailable
                                                ? 'ONLINE'
                                                : 'STANDBY'}
                                        </strong>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    className="at-map-side-action"
                                    onClick={() =>
                                        onNavigate(
                                            'honeypot_logs',
                                        )
                                    }
                                >
                                    Inspect event stream
                                    <ChevronRight
                                        size={13}
                                    />
                                </button>
                            </section>

                        </aside>
                    </div>

                    {/* ==========================================================
                        Lower analytical layer
                       ========================================================== */}

                    <div className="at-map-lower-grid">

                        <section className="at-map-table-panel">
                            <div className="at-map-table-header">
                                <div>
                                    <span>
                                        EVENT STREAM
                                    </span>

                                    <h3>
                                        Recent telemetry
                                    </h3>
                                </div>

                                <button
                                    type="button"
                                    onClick={() =>
                                        onNavigate(
                                            'honeypot_logs',
                                        )
                                    }
                                >
                                    View all
                                    <ArrowUpRight
                                        size={13}
                                    />
                                </button>
                            </div>

                            {events.length > 0 ? (
                                <div className="at-map-events-table-wrap">
                                    <table className="at-map-events-table">
                                        <thead>
                                            <tr>
                                                <th>
                                                    Severity
                                                </th>

                                                <th>
                                                    Source
                                                </th>

                                                <th>
                                                    Event
                                                </th>

                                                <th>
                                                    Country
                                                </th>

                                                <th>
                                                    Date
                                                </th>

                                                <th>
                                                    Time
                                                </th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {events
                                                .slice(
                                                    0,
                                                    7,
                                                )
                                                .map(
                                                    (
                                                        event,
                                                    ) => (
                                                        <tr
                                                            key={
                                                                event.id
                                                            }
                                                            onClick={() =>
                                                                onNavigate(
                                                                    'honeypot_logs',
                                                                )
                                                            }
                                                        >
                                                            <td>
                                                                <span
                                                                    className={`at-map-severity-pill ${event.severity}`}
                                                                >
                                                                    {
                                                                        event.severity
                                                                    }
                                                                </span>
                                                            </td>

                                                            <td>
                                                                <code>
                                                                    {
                                                                        event.src_ip
                                                                    }
                                                                </code>
                                                            </td>

                                                            <td>
                                                                <span>
                                                                    {prettyEvent(
                                                                        event.event_type,
                                                                    )}
                                                                </span>
                                                            </td>

                                                            <td>
                                                                {
                                                                    event.countryCode
                                                                }
                                                            </td>

                                                            <td>
                                                                {formatDate(
                                                                    event.timestamp,
                                                                )}
                                                            </td>

                                                            <td>
                                                                {formatTime(
                                                                    event.timestamp,
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ),
                                                )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="at-map-table-empty">
                                    <Activity
                                        size={20}
                                    />

                                    <strong>
                                        No telemetry records
                                    </strong>

                                    <span>
                                        Recent events will
                                        appear here once the
                                        honeypot stream is
                                        active.
                                    </span>
                                </div>
                            )}
                        </section>

                        <section className="at-map-signal-panel">
                            <div className="at-map-table-header">
                                <div>
                                    <span>
                                        LATEST SIGNAL
                                    </span>

                                    <h3>
                                        Current activity
                                    </h3>
                                </div>

                                <Crosshair
                                    size={16}
                                />
                            </div>

                            {latestEvent ? (
                                <div className="at-map-latest-signal">
                                    <div className="signal-score">
                                        <span
                                            className={
                                                latestEvent.severity
                                            }
                                        >
                                            {
                                                latestEvent.severity
                                            }
                                        </span>

                                        <strong>
                                            {
                                                latestEvent.src_ip
                                            }
                                        </strong>
                                    </div>

                                    <div className="signal-detail">
                                        <span>
                                            EVENT
                                        </span>

                                        <strong>
                                            {prettyEvent(
                                                latestEvent.event_type,
                                            )}
                                        </strong>
                                    </div>

                                    <div className="signal-detail">
                                        <span>
                                            ORIGIN
                                        </span>

                                        <strong>
                                            {latestEvent.country ||
                                                latestEvent.countryCode ||
                                                'Unknown'}
                                        </strong>
                                    </div>

                                    <div className="signal-detail">
                                        <span>
                                            OBSERVED
                                        </span>

                                        <strong>
                                            {formatTime(
                                                latestEvent.timestamp,
                                            )}
                                        </strong>
                                    </div>

                                    {topEvent && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                onNavigate(
                                                    'honeypot_logs',
                                                )
                                            }
                                        >
                                            Investigate signal
                                            <ArrowUpRight
                                                size={13}
                                            />
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="at-map-table-empty">
                                    <Crosshair
                                        size={20}
                                    />

                                    <strong>
                                        No active signal
                                    </strong>

                                    <span>
                                        The latest enriched
                                        telemetry signal will be
                                        shown here.
                                    </span>
                                </div>
                            )}
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}