import {
    Activity,
    Crosshair,
    Globe2,
    RefreshCw,
    Server,
    ShieldAlert,
    Target,
    X,
} from 'lucide-react';

import {
    MOCK_EVENTS,
    type MockThreatEvent,
} from '../data/mockData';

import PageHeader from '../components/layout/PageHeader';

interface AttackMapPageProps {
    onNavigate: (id: string) => void;
}

/*
 * The source dataset contains country/countryCode but no geographic
 * coordinates. These are therefore visual layout anchors only.
 * They are not treated as location data from the backend.
 */
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

const severityWeight = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
};

function severityColor(
    severity: MockThreatEvent['severity']
) {
    switch (severity) {
        case 'critical':
            return '#D62828';

        case 'high':
            return '#E7782A';

        case 'medium':
            return '#B78E2C';

        default:
            return '#548A63';
    }
}

function formatTime(
    timestamp: string
) {
    return new Date(timestamp).toLocaleTimeString(
        'en-US',
        {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        }
    );
}

function prettyEvent(
    eventType: string
) {
    return eventType
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (letter) =>
            letter.toUpperCase()
        );
}

export default function AttackMapPage({
    onNavigate,
}: AttackMapPageProps) {
    const events = [...MOCK_EVENTS].sort(
        (a, b) =>
            severityWeight[b.severity] -
            severityWeight[a.severity]
    );

    const countryCounts =
        MOCK_EVENTS.reduce(
            (acc, event) => {
                acc[event.country] =
                    (acc[event.country] || 0) + 1;

                return acc;
            },
            {} as Record<string, number>
        );

    const rankedCountries = Object.entries(
        countryCounts
    )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 7);

    const criticalCount =
        MOCK_EVENTS.filter(
            (event) =>
                event.severity === 'critical'
        ).length;

    const highCount =
        MOCK_EVENTS.filter(
            (event) =>
                event.severity === 'high'
        ).length;

    const uniqueSources = new Set(
        MOCK_EVENTS.map(
            (event) => event.srcIp
        )
    ).size;

    const plottedCountries =
        Object.entries(countryCounts)
            .map(([country, count]) => {
                const event = MOCK_EVENTS.find(
                    (item) =>
                        item.country === country
                );

                if (!event) {
                    return null;
                }

                const layout =
                    COUNTRY_LAYOUT[
                    event.countryCode
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
            })
            .filter(Boolean) as Array<{
                country: string;
                countryCode: string;
                count: number;
                layout: {
                    left: number;
                    top: number;
                };
                severity: MockThreatEvent['severity'];
            }>;

    return (
        <div className="at-attack-map-page">

            <PageHeader
                breadcrumbs={[
                    { label: 'Operations' },
                    { label: 'Attack Map' },
                ]}
                title="Attack Map"
                description="Global view of observed honeypot attack activity."
                actions={
                    <>
                        <button
                            type="button"
                            className="at-btn at-btn-secondary at-btn-sm"
                        >
                            <RefreshCw size={13} />
                            Refresh
                        </button>

                        <button
                            type="button"
                            className="at-btn at-btn-primary at-btn-sm"
                            onClick={() =>
                                onNavigate(
                                    'honeypot_logs'
                                )
                            }
                        >
                            <ShieldAlert size={13} />
                            Open Logs
                        </button>
                    </>
                }
            />

            <div className="at-attack-map-workspace">

                {/* ======================================================
            MAP
            ====================================================== */}

                <section className="at-attack-map-main">

                    <div className="at-attack-map-toolbar">
                        <div className="at-attack-map-toolbar-left">
                            <div className="at-attack-map-mode">
                                <span className="at-attack-map-live-dot" />

                                <strong>
                                    LIVE ACTIVITY
                                </strong>
                            </div>

                            <span className="at-attack-map-toolbar-divider" />

                            <span className="at-attack-map-muted">
                                {MOCK_EVENTS.length}{' '}
                                observed events
                            </span>

                            <span className="at-attack-map-muted">
                                {uniqueSources}{' '}
                                unique sources
                            </span>
                        </div>

                        <div className="at-attack-map-legend">
                            <span>
                                <i className="critical" />
                                Critical
                            </span>

                            <span>
                                <i className="high" />
                                High
                            </span>

                            <span>
                                <i className="medium" />
                                Medium
                            </span>

                            <span>
                                <i className="low" />
                                Low
                            </span>
                        </div>
                    </div>

                    <div className="at-attack-map-canvas">

                        {/* restrained grid */}
                        <div className="at-attack-map-grid" />

                        {/* map-like land masses */}
                        <div className="at-attack-map-continent north-america" />
                        <div className="at-attack-map-continent south-america" />
                        <div className="at-attack-map-continent europe" />
                        <div className="at-attack-map-continent asia" />
                        <div className="at-attack-map-continent africa" />
                        <div className="at-attack-map-continent oceania" />

                        {/* plotted countries */}
                        {plottedCountries.map(
                            (country) => (
                                <button
                                    type="button"
                                    key={
                                        country.countryCode
                                    }
                                    className="at-attack-map-node"
                                    style={{
                                        left: `${country.layout.left}%`,
                                        top: `${country.layout.top}%`,
                                    }}
                                    title={`${country.country} · ${country.count} events`}
                                    onClick={() =>
                                        onNavigate(
                                            'honeypot_logs'
                                        )
                                    }
                                >
                                    <span
                                        className={`at-attack-map-pulse ${country.severity}`}
                                        style={{
                                            '--map-node-color':
                                                severityColor(
                                                    country.severity
                                                ),
                                        } as React.CSSProperties}
                                    />

                                    <span className="at-attack-map-node-core">
                                        {country.count}
                                    </span>

                                    <span className="at-attack-map-node-label">
                                        {country.countryCode}
                                    </span>
                                </button>
                            )
                        )}

                        {/* central operations marker */}
                        <div className="at-attack-map-center">
                            <div className="at-attack-map-center-ring" />

                            <div className="at-attack-map-center-core">
                                <Crosshair size={16} />
                            </div>

                            <span>
                                HONEYPOT
                                INFRASTRUCTURE
                            </span>
                        </div>

                        {/* Scan line */}
                        <div className="at-attack-map-scan-line" />

                        {/* bottom state */}
                        <div className="at-attack-map-canvas-meta">
                            <span>
                                <Activity size={11} />
                                ATTACK TELEMETRY
                            </span>

                            <span>
                                STATIC PROTOTYPE DATA
                            </span>
                        </div>
                    </div>
                </section>

                {/* ======================================================
            SIDE PANEL
            ====================================================== */}

                <aside className="at-attack-map-sidebar">

                    {/* Severity summary */}
                    <section className="at-attack-map-panel">

                        <div className="at-attack-map-panel-header">
                            <div>
                                <span className="at-v2-kicker">
                                    THREAT ACTIVITY
                                </span>

                                <h2>
                                    Current posture
                                </h2>
                            </div>

                            <Activity
                                size={15}
                                className="at-attack-map-panel-icon"
                            />
                        </div>

                        <div className="at-attack-map-posture-grid">

                            <div>
                                <span>
                                    CRITICAL
                                </span>

                                <strong className="critical">
                                    {criticalCount}
                                </strong>
                            </div>

                            <div>
                                <span>
                                    HIGH
                                </span>

                                <strong className="high">
                                    {highCount}
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

                        </div>
                    </section>

                    {/* Source ranking */}
                    <section className="at-attack-map-panel">

                        <div className="at-attack-map-panel-header">
                            <div>
                                <span className="at-v2-kicker">
                                    SOURCE DISTRIBUTION
                                </span>

                                <h2>
                                    Most active countries
                                </h2>
                            </div>

                            <Globe2
                                size={15}
                                className="at-attack-map-panel-icon"
                            />
                        </div>

                        <div className="at-attack-map-country-list">
                            {rankedCountries.map(
                                ([country, count], index) => {
                                    const max =
                                        rankedCountries[0]?.[1] ||
                                        1;

                                    return (
                                        <div
                                            key={country}
                                            className="at-attack-map-country-row"
                                        >
                                            <span className="at-attack-map-country-rank">
                                                {String(
                                                    index + 1
                                                ).padStart(
                                                    2,
                                                    '0'
                                                )}
                                            </span>

                                            <div className="at-attack-map-country-main">
                                                <span>
                                                    {country}
                                                </span>

                                                <div className="at-attack-map-country-track">
                                                    <i
                                                        style={{
                                                            width: `${(count /
                                                                    max) *
                                                                100
                                                                }%`,
                                                        }}
                                                    />
                                                </div>
                                            </div>

                                            <strong>
                                                {count}
                                            </strong>
                                        </div>
                                    );
                                }
                            )}
                        </div>
                    </section>

                    {/* Recent highest severity */}
                    <section className="at-attack-map-panel at-attack-map-events-panel">

                        <div className="at-attack-map-panel-header">
                            <div>
                                <span className="at-v2-kicker">
                                    RECENT HIGH-VALUE EVENTS
                                </span>

                                <h2>
                                    Highest severity
                                </h2>
                            </div>

                            <Target
                                size={15}
                                className="at-attack-map-panel-icon"
                            />
                        </div>

                        <div className="at-attack-map-event-list">
                            {events
                                .slice(0, 6)
                                .map((event) => (
                                    <button
                                        type="button"
                                        key={event.id}
                                        className="at-attack-map-event"
                                        onClick={() =>
                                            onNavigate(
                                                'honeypot_logs'
                                            )
                                        }
                                    >
                                        <span
                                            className={`at-attack-map-event-severity ${event.severity}`}
                                        />

                                        <span className="at-attack-map-event-copy">
                                            <strong>
                                                {event.srcIp}
                                            </strong>

                                            <span>
                                                {prettyEvent(
                                                    event.eventType
                                                )}
                                                {' · '}
                                                {
                                                    event.countryCode
                                                }
                                            </span>
                                        </span>

                                        <span className="at-attack-map-event-time">
                                            {formatTime(
                                                event.timestamp
                                            )}
                                        </span>
                                    </button>
                                ))}
                        </div>
                    </section>

                    {/* Infrastructure */}
                    <section className="at-attack-map-panel">

                        <div className="at-attack-map-panel-header">
                            <div>
                                <span className="at-v2-kicker">
                                    HONEYPOT INFRASTRUCTURE
                                </span>

                                <h2>
                                    Active collection
                                </h2>
                            </div>

                            <Server
                                size={15}
                                className="at-attack-map-panel-icon"
                            />
                        </div>

                        <div className="at-attack-map-infrastructure">
                            <div>
                                <span>
                                    EVENTS
                                </span>

                                <strong>
                                    {MOCK_EVENTS.length}
                                </strong>
                            </div>

                            <div>
                                <span>
                                    ACTIVE SOURCES
                                </span>

                                <strong>
                                    {uniqueSources}
                                </strong>
                            </div>

                            <div>
                                <span>
                                    COLLECTION
                                </span>

                                <strong className="online">
                                    ONLINE
                                </strong>
                            </div>
                        </div>

                        <button
                            type="button"
                            className="at-attack-map-open-logs"
                            onClick={() =>
                                onNavigate(
                                    'honeypot_logs'
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
        </div>
    );
}