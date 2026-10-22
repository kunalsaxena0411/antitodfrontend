import React, { useState, Suspense } from 'react';
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
    Map as MapIcon,
    Globe,
    Loader2,
} from 'lucide-react';

import type { LogEventV2, ThreatMapV3Response } from '../../api/services';

import { dataProvider } from '../services/dataProvider';
import { useAppData } from '../contexts/AppDataContext';
import { isPublicDemo } from '../utils/demoMode';
import { DEFAULT_HQ, COUNTRY_COORDS } from '../../components/views/AttackMapView';
import type { ThreeGlobeArc, ThreeGlobeRing, ThreeGlobePoint, ThreeGlobeLabel } from '../../components/views/ThreeGlobeView';

const ThreeGlobeView = React.lazy(() =>
    import('../../components/views/ThreeGlobeView').catch((error) => {
        // Retry dynamically imported module if first attempt fails during a server restart or deployment
        return new Promise((resolve) => setTimeout(resolve, 800)).then(() =>
            import('../../components/views/ThreeGlobeView')
        );
    })
);
import EmptyState from '../components/common/EmptyState';
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
    const [threatMapData, setThreatMapData] = React.useState<ThreatMapV3Response | null>(null);
    const [isLoading, setIsLoading] = React.useState<boolean>(true);

    const fetchEvents = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const [evts, tMap] = await Promise.all([
                dataProvider.getAttackEvents(),
                dataProvider.getThreatMap(),
            ]);
            // Raw events use geo_country / threat score. Normalise them to what this page reads,
            // and fall back to the host-level geo for older events that were stored without it.
            const byIp = new Map<string, any>();
            (tMap?.points || []).forEach((p: any) => { if (p?.src_ip) byIp.set(p.src_ip, p); });
            let names: Intl.DisplayNames | null = null;
            try { names = new Intl.DisplayNames(['en'], { type: 'region' }); } catch { /* unsupported */ }
            const sev = (n: number) => (n >= 80 ? 'critical' : n >= 60 ? 'high' : n >= 40 ? 'medium' : 'low');
            const filled = (evts || []).map((e: any) => {
                const hp = byIp.get(e?.src_ip);
                const rawCode = e?.geo_country || hp?.geo_country;
                const code = rawCode ? String(rawCode).toUpperCase() : undefined;
                let nm = code;
                try { nm = code ? (names?.of(code) || code) : undefined; } catch { /* keep code */ }
                const score = e?.threat_score ?? e?.threat?.threat_score ?? hp?.threat_score ?? 0;
                return { ...e, country: e?.country || nm, countryCode: e?.countryCode || code, severity: e?.severity || sev(score) };
            });
            set_MOCK_EVENTS(filled);
            setThreatMapData(tMap || null);
        } catch (err) {
            console.error('Failed to load attack map events:', err);
            set_MOCK_EVENTS([]);
            setThreatMapData(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void fetchEvents();
    }, [fetchEvents]);

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

    const [mapMode, setMapMode] = useState<'2d' | '3d'>(() => {
        try {
            const saved = localStorage.getItem('antitode-threat-map-mode');
            if (saved === '2d' || saved === '3d') return saved;
        } catch {
            // ignore
        }
        return '3d';
    });

    const handleToggleMapMode = () => {
        setMapMode(prev => {
            const next = prev === '3d' ? '2d' : '3d';
            try {
                localStorage.setItem('antitode-threat-map-mode', next);
            } catch {
                // ignore
            }
            return next;
        });
    };

    const globeData = useMemo(() => {
        const arcs: ThreeGlobeArc[] = [];
        const points: ThreeGlobePoint[] = [
            {
                id: 'hq-collection',
                lat: DEFAULT_HQ[1],
                lng: DEFAULT_HQ[0],
                color: '#38bdf8',
                radius: 0.65,
                altitude: 0.02,
                label: 'COLLECTION INFRASTRUCTURE'
            }
        ];
        const rings: ThreeGlobeRing[] = [
            {
                id: 'hq-pulse',
                lat: DEFAULT_HQ[1],
                lng: DEFAULT_HQ[0],
                color: '#38bdf8',
                maxR: 3.8,
                speed: 2.0,
                repeat: 1400
            }
        ];

        plottedCountries.forEach((c, idx) => {
            const coords = COUNTRY_COORDS[c.countryCode?.toUpperCase()];
            if (coords) {
                const color = severityColor(c.severity || 'low');
                const sevUpper = (c.severity?.toUpperCase() || 'MEDIUM') as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
                arcs.push({
                    id: `arc-${c.countryCode}-${idx}`,
                    startLat: coords[1],
                    startLng: coords[0],
                    endLat: DEFAULT_HQ[1],
                    endLng: DEFAULT_HQ[0],
                    color,
                    risk: sevUpper === 'CRITICAL' || sevUpper === 'HIGH' || sevUpper === 'MEDIUM' || sevUpper === 'LOW' ? sevUpper : 'HIGH',
                    country: c.country,
                    order: idx
                });
                points.push({
                    id: `pt-${c.countryCode}`,
                    lat: coords[1],
                    lng: coords[0],
                    color,
                    radius: c.severity === 'critical' ? 0.6 : 0.45,
                    altitude: 0.015,
                    label: `${c.country} (${c.count} events)`
                });
                rings.push({
                    id: `ring-${c.countryCode}`,
                    lat: coords[1],
                    lng: coords[0],
                    color,
                    maxR: 3.5,
                    speed: 1.8,
                    repeat: 1600
                });
            }
        });

        // Add live threat map points from V3 threat-map endpoint
        if (threatMapData?.points && threatMapData.points.length > 0) {
            const targetLat = threatMapData.targets?.[0]?.geo_lat ?? DEFAULT_HQ[1];
            const targetLng = threatMapData.targets?.[0]?.geo_lon ?? DEFAULT_HQ[0];

            threatMapData.points.forEach((p, idx) => {
                if (typeof p.geo_lat === 'number' && typeof p.geo_lon === 'number' && (p.geo_lat !== 0 || p.geo_lon !== 0)) {
                    const color = severityColor((p.risk_level?.toLowerCase() || 'medium') as any);
                    const riskUpper = (p.risk_level?.toUpperCase() || 'MEDIUM') as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

                    arcs.push({
                        id: `arc-threat-${p.src_ip}-${idx}`,
                        startLat: p.geo_lat,
                        startLng: p.geo_lon,
                        endLat: targetLat,
                        endLng: targetLng,
                        color,
                        risk: riskUpper,
                        country: p.geo_country || 'Unknown',
                        order: idx + 100,
                    });

                    points.push({
                        id: `pt-threat-${p.src_ip}`,
                        lat: p.geo_lat,
                        lng: p.geo_lon,
                        color,
                        radius: p.risk_level === 'critical' ? 0.65 : 0.45,
                        altitude: 0.015,
                        label: `${p.src_ip} (${p.geo_country || 'Host'}) - ${p.total_events} events`,
                    });

                    rings.push({
                        id: `ring-threat-${p.src_ip}`,
                        lat: p.geo_lat,
                        lng: p.geo_lon,
                        color,
                        maxR: 3.5,
                        speed: 1.8,
                        repeat: 1600,
                    });
                }
            });
        }

        const labels: ThreeGlobeLabel[] = [
            {
                id: 'hq-label',
                lat: DEFAULT_HQ[1],
                lng: DEFAULT_HQ[0],
                text: 'COLLECTION HQ',
                color: '#38bdf8',
                size: 1.1
            }
        ];

        return { arcs, points, rings, labels };
    }, [plottedCountries]);

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

    const hasData = MOCK_EVENTS.length > 0 || (threatMapData?.points && threatMapData.points.length > 0);

    if (!isLoading && !hasData && !isPublicDemo()) {
        return (
            <div className="at-attack-map-page-v2">
                <PageHeader
                    breadcrumbs={[
                        { label: 'Operations' },
                        { label: 'Attack Map' },
                    ]}
                    title="Live Threat Map"
                    description="Geospatial distribution of honeypot sensor alerts and active attack vectors."
                    actions={
                        <button
                            type="button"
                            className="at-btn at-btn-secondary at-btn-sm"
                            onClick={() => void fetchEvents()}
                            disabled={isLoading}
                        >
                            <RefreshCw size={13} className={isLoading ? 'at-spin' : ''} />
                            Refresh
                        </button>
                    }
                />
                <div style={{ padding: '24px' }}>
                    <EmptyState
                        title="No Inbound Attacks Detected"
                        description="Global attack paths and originating ASNs will plot dynamically once malicious connections hit your honeypot nodes."
                        actionLabel="Connect Your First Honeypot"
                        onAction={() => onNavigate('infrastructure')}
                        secondaryLabel="Explore SOC Documentation"
                        onSecondaryAction={() => onNavigate('help')}
                    />
                </div>
            </div>
        );
    }

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
                                        title={mapMode === '3d' ? "Switch to 2D Map" : "Switch to 3D Globe"}
                                        onClick={handleToggleMapMode}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '5px',
                                            padding: '4px 8px',
                                            fontSize: '11px',
                                            fontWeight: 'bold',
                                            fontFamily: 'monospace',
                                            background: mapMode === '3d' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                            border: '1px solid ' + (mapMode === '3d' ? 'rgba(56, 189, 248, 0.4)' : 'rgba(255, 255, 255, 0.1)'),
                                            color: mapMode === '3d' ? '#38bdf8' : '#aaa',
                                            borderRadius: '4px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {mapMode === '3d' ? <MapIcon size={14} /> : <Globe size={14} />}
                                        <span>{mapMode === '3d' ? '2D MAP' : '3D GLOBE'}</span>
                                    </button>

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

                            <div className="at-map-canvas-v2" style={{ position: 'relative', flex: 1, minHeight: '520px', height: '520px', overflow: 'hidden' }}>
                                {mapMode === '3d' ? (
                                    <div style={{ position: 'absolute', inset: 0, zIndex: 5 }}>
                                        <Suspense fallback={
                                            <div className="w-full h-full flex flex-col items-center justify-center text-cyan-400 gap-3">
                                                <Loader2 className="animate-spin" size={32}/>
                                                <span className="font-mono text-xs tracking-widest uppercase">INITIALIZING 3D GLOBE...</span>
                                            </div>
                                        }>
                                            <ThreeGlobeView
                                                arcs={globeData.arcs}
                                                rings={globeData.rings}
                                                points={globeData.points}
                                                labels={globeData.labels}
                                                isPaused={false}
                                                allowInteraction={true}
                                                initialAltitude={2.45}
                                                initialLat={18}
                                                initialLng={-30}
                                            />
                                        </Suspense>
                                    </div>
                                ) : (
                                    <>
                                        <div className="at-map-grid-lines" />

                                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.25, backgroundImage: 'url(/world-map.svg)', backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', filter: 'invert(1)', pointerEvents: 'none', zIndex: 0 }} />

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
                                                            country.severity || 'low',
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
                                    </>
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
