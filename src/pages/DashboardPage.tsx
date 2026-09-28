import { useEffect, useState, useMemo } from 'react';

import {
  Activity,
  ArrowUpRight,
  BarChart3,
  ChevronRight,
  Database,
  Globe2,
  Hash,
  Network,
  Radio,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldBan,
  ShieldCheck,
  Target,
  Users,
} from 'lucide-react';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type {
  AnalyzedHost,
  CveFeedItem,
  ThreatNewsItem,
} from '../../types';

import { useHoneypotData } from '../../hooks/useHoneypotData';
import { dataProvider } from '../services/dataProvider';
import PageHeader from '../components/layout/PageHeader';

interface DashboardProps {
  onNavigate: (id: string) => void;
  results: AnalyzedHost[];
  newsItems: ThreatNewsItem[];
  cveFeedItems: CveFeedItem[];
}

type SeverityBucket =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low';

interface TimelineBucket {
  hour: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

const numberFormatter =
  new Intl.NumberFormat('en-US');

function hourKey(date: Date): string {
  return `${String(date.getHours()).padStart(
    2,
    '0',
  )}:00`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatRelativeTime(value: string): string {
  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return '—';
  }

  const seconds = Math.max(
    0,
    Math.floor(
      (Date.now() - timestamp) / 1000,
    ),
  );

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  return `${Math.floor(hours / 24)}d ago`;
}

function eventSeverityFromScore(
  score: number,
): SeverityBucket {
  if (score >= 80) {
    return 'critical';
  }

  if (score >= 60) {
    return 'high';
  }

  if (score >= 40) {
    return 'medium';
  }

  return 'low';
}

function prettyEventType(
  eventType: string,
): string {
  return eventType
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

function getEventId(
  event: {
    event_id: string;
    id?: string;
  },
  index: number,
): string {
  return (
    event.event_id ||
    event.id ||
    `event-${index}`
  );
}

export default function DashboardPage({
  onNavigate
}: Omit<DashboardProps, 'results' | 'newsItems' | 'cveFeedItems'>) {
  const [results, setResults] = useState<AnalyzedHost[]>([]);
  const [newsItems, setNewsItems] = useState<ThreatNewsItem[]>([]);
  const [cveFeedItems, setCveFeedItems] = useState<CveFeedItem[]>([]);
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
      // Fetch dynamic non-prop metrics if any
      Promise.all([
      dataProvider.getDashboardMetrics(),
      (dataProvider as any).getHosts(),
      dataProvider.getNews(),
      (dataProvider as any).getCveFeeds()
    ]).then(([m, h, n, c]) => {
      setMetrics(m);
      setResults(h);
      setNewsItems(n);
      setCveFeedItems(c);
    });
  }, []);

  const {
    events,
    stats: honeypotStats,
    isLoadingEvents,
    refresh,
  } = useHoneypotData({
    limit: 100,
    offset: 0,
  });

  const safeEvents = events ?? [];

  const hostMetrics = useMemo(() => {
    const critical = results.filter(
      (host) =>
        host.riskLevel === 'CRITICAL',
    ).length;

    const high = results.filter(
      (host) =>
        host.riskLevel === 'HIGH',
    ).length;

    const medium = results.filter(
      (host) =>
        host.riskLevel === 'MEDIUM',
    ).length;

    const low = results.filter(
      (host) =>
        host.riskLevel === 'LOW',
    ).length;

    const blacklisted = results.filter(
      (host) =>
        host.rblStatus === 'LISTED',
    ).length;

    const countries = new Set(
      results
        .map((host) => host.country)
        .filter(Boolean),
    ).size;

    return {
      critical,
      high,
      medium,
      low,
      blacklisted,
      countries,
    };
  }, [results]);

  const timeline = useMemo<TimelineBucket[]>(
    () => {
      const buckets = new Map<
        string,
        TimelineBucket
      >();

      for (
        let index = 23;
        index >= 0;
        index -= 1
      ) {
        const date = new Date();

        date.setMinutes(0, 0, 0);
        date.setHours(
          date.getHours() - index,
        );

        const key = hourKey(date);

        buckets.set(key, {
          hour: key,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
        });
      }

      for (const event of safeEvents) {
        const date = new Date(
          event.timestamp,
        );

        if (
          Number.isNaN(date.getTime())
        ) {
          continue;
        }

        const bucket = buckets.get(
          hourKey(date),
        );

        if (!bucket) {
          continue;
        }

        const severity =
          eventSeverityFromScore(
            event.threat_score ??
            event.threat?.threat_score ??
            0,
          );

        bucket[severity] += 1;
      }

      return Array.from(
        buckets.values(),
      );
    },
    [safeEvents],
  );

  const attackGeo = useMemo(() => {
    const counts =
      safeEvents.reduce<
        Record<string, number>
      >((accumulator, event) => {
        const country =
          event.country ||
          event.geo_country;

        if (!country) {
          return accumulator;
        }

        accumulator[country] =
          (accumulator[country] ?? 0) + 1;

        return accumulator;
      }, {});

    return Object.entries(counts)
      .sort(
        (a, b) => b[1] - a[1],
      )
      .slice(0, 6);
  }, [safeEvents]);

  const topAsns = useMemo(() => {
    const counts =
      safeEvents.reduce<
        Record<string, number>
      >((accumulator, event) => {
        const asn =
          event.asn ||
          event.asn_org ||
          (event.asn_number
            ? `AS${event.asn_number}`
            : 'Unknown ASN');

        accumulator[asn] =
          (accumulator[asn] ?? 0) + 1;

        return accumulator;
      }, {});

    return Object.entries(counts)
      .sort(
        (a, b) => b[1] - a[1],
      )
      .slice(0, 5);
  }, [safeEvents]);

  const recentCritical = useMemo(() => {
    return [...safeEvents]
      .filter(
        (event) =>
          (event.threat_score ??
            event.threat?.threat_score ??
            0) >= 80,
      )
      .sort(
        (a, b) =>
          new Date(
            b.timestamp,
          ).getTime() -
          new Date(
            a.timestamp,
          ).getTime(),
      )
      .slice(0, 5);
  }, [safeEvents]);

  const recentHoneypot = useMemo(() => {
    return [...safeEvents]
      .sort(
        (a, b) =>
          new Date(
            b.timestamp,
          ).getTime() -
          new Date(
            a.timestamp,
          ).getTime(),
      )
      .slice(0, 7);
  }, [safeEvents]);

  const priorityHosts = useMemo(() => {
    return [...results]
      .filter(
        (host) =>
          host.riskLevel ===
          'CRITICAL' ||
          host.riskLevel === 'HIGH',
      )
      .sort(
        (a, b) =>
          b.totalScore -
          a.totalScore,
      )
      .slice(0, 5);
  }, [results]);

  const intelCount =
    newsItems.length +
    cveFeedItems.length;

  const totalEvents =
    honeypotStats?.total_events ??
    safeEvents.length;

  const totalHosts = results.length;

  const totalHighValue =
    hostMetrics.critical +
    hostMetrics.high;

  const postureTotal = Math.max(
    totalHosts,
    1,
  );

  const criticalPct = Math.round(
    (hostMetrics.critical /
      postureTotal) *
    100,
  );

  const highPct = Math.round(
    (hostMetrics.high /
      postureTotal) *
    100,
  );

  const mediumPct = Math.round(
    (hostMetrics.medium /
      postureTotal) *
    100,
  );

  const lowPct = Math.max(
    0,
    100 -
    criticalPct -
    highPct -
    mediumPct,
  );

  const severityCounts = [
    {
      key: 'critical',
      label: 'Critical',
      value: hostMetrics.critical,
      colorClass: 'critical',
    },
    {
      key: 'high',
      label: 'High',
      value: hostMetrics.high,
      colorClass: 'high',
    },
    {
      key: 'medium',
      label: 'Medium',
      value: hostMetrics.medium,
      colorClass: 'medium',
    },
    {
      key: 'low',
      label: 'Low',
      value: hostMetrics.low,
      colorClass: 'low',
    },
  ];

  const distinctDataSources =
    new Set(
      results
        .map(
          (host) =>
            host.org || host.asn,
        )
        .filter(Boolean),
    ).size;

  return (
    <div className="at-dashboard at-dashboard-v2">
      <PageHeader
        breadcrumbs={[
          { label: 'Operations' },
          { label: 'Dashboard' },
        ]}
        title="Command Center"
        description="A live operational view of threats, exposed infrastructure, telemetry and intelligence coverage."
        timeRange="Last 24 Hours"
        actions={
          <div className="at-dashboard-header-actions">
            <button
              type="button"
              className="at-btn at-btn-secondary"
              onClick={() =>
                void refresh()
              }
              disabled={isLoadingEvents}
            >
              <RefreshCw
                size={14}
                className={
                  isLoadingEvents
                    ? 'at-spin'
                    : ''
                }
              />
              Refresh
            </button>

            <button
              type="button"
              className="at-btn at-btn-primary"
              onClick={() =>
                onNavigate(
                  'soc_wall',
                )
              }
            >
              <Radio size={14} />
              Open SOC Wall
            </button>
          </div>
        }
      />

      <div className="at-dashboard-scroll custom-scrollbar">
        <div className="at-dashboard-content">

          {/* ---------------------------------------------------------------- */}
          {/* Executive overview                                                */}
          {/* ---------------------------------------------------------------- */}

          <section className="at-dashboard-overview-strip">
            <button
              type="button"
              className="at-overview-card at-overview-card-danger"
              onClick={() =>
                onNavigate('analysis')
              }
            >
              <div className="at-overview-topline">
                <span>
                  Critical hosts
                </span>
                <ShieldAlert size={15} />
              </div>

              <strong>
                {numberFormatter.format(
                  hostMetrics.critical,
                )}
              </strong>

              <div className="at-overview-bottomline">
                <span>
                  {criticalPct}% of analyzed hosts
                </span>
                <ChevronRight size={13} />
              </div>
            </button>

            <button
              type="button"
              className="at-overview-card"
              onClick={() =>
                onNavigate(
                  'honeypot_logs',
                )
              }
            >
              <div className="at-overview-topline">
                <span>
                  Telemetry events
                </span>
                <Activity size={15} />
              </div>

              <strong>
                {numberFormatter.format(
                  totalEvents,
                )}
              </strong>

              <div className="at-overview-bottomline">
                <span>
                  Observed in active window
                </span>
                <ChevronRight size={13} />
              </div>
            </button>

            <button
              type="button"
              className="at-overview-card"
              onClick={() =>
                onNavigate('iocs')
              }
            >
              <div className="at-overview-topline">
                <span>
                  Blacklisted IPs
                </span>
                <ShieldBan size={15} />
              </div>

              <strong>
                {numberFormatter.format(
                  hostMetrics.blacklisted,
                )}
              </strong>

              <div className="at-overview-bottomline">
                <span>
                  Current blocklist matches
                </span>
                <ChevronRight size={13} />
              </div>
            </button>

            <button
              type="button"
              className="at-overview-card"
              onClick={() =>
                onNavigate('news')
              }
            >
              <div className="at-overview-topline">
                <span>
                  Intel coverage
                </span>
                <Database size={15} />
              </div>

              <strong>
                {numberFormatter.format(
                  intelCount,
                )}
              </strong>

              <div className="at-overview-bottomline">
                <span>
                  {newsItems.length} news ·{' '}
                  {cveFeedItems.length} CVE
                </span>
                <ChevronRight size={13} />
              </div>
            </button>
          </section>

          {/* ---------------------------------------------------------------- */}
          {/* Posture + operational pulse                                      */}
          {/* ---------------------------------------------------------------- */}

          <section className="at-dashboard-hero-grid">

            <article className="at-saas-panel at-posture-card">
              <div className="at-saas-panel-header at-panel-header-large">
                <div>
                  <span className="at-eyebrow">
                    THREAT POSTURE
                  </span>

                  <h3>
                    Current security posture
                  </h3>

                  <p>
                    Risk distribution across the
                    analyzed host population.
                  </p>
                </div>

                <button
                  type="button"
                  className="at-dashboard-text-action"
                  onClick={() =>
                    onNavigate('analysis')
                  }
                >
                  Inspect hosts
                  <ArrowUpRight size={13} />
                </button>
              </div>

              <div className="at-posture-body">
                <div className="at-posture-main-number">
                  <span className="at-posture-icon">
                    <ShieldAlert size={18} />
                  </span>

                  <div>
                    <strong>
                      {numberFormatter.format(
                        totalHighValue,
                      )}
                    </strong>

                    <span>
                      high-priority hosts
                    </span>
                  </div>
                </div>

                <div
                  className="at-posture-segmented-bar"
                  aria-label="Risk distribution"
                >
                  <span
                    className="critical"
                    style={{
                      width: `${criticalPct}%`,
                    }}
                  />

                  <span
                    className="high"
                    style={{
                      width: `${highPct}%`,
                    }}
                  />

                  <span
                    className="medium"
                    style={{
                      width: `${mediumPct}%`,
                    }}
                  />

                  <span
                    className="low"
                    style={{
                      width: `${lowPct}%`,
                    }}
                  />
                </div>

                <div className="at-posture-stats">
                  {severityCounts.map(
                    (item) => (
                      <button
                        key={item.key}
                        type="button"
                        className="at-posture-stat"
                        onClick={() =>
                          onNavigate(
                            'analysis',
                          )
                        }
                      >
                        <span
                          className={`at-severity-dot ${item.colorClass}`}
                        />

                        <span>
                          {item.label}
                        </span>

                        <strong>
                          {numberFormatter.format(
                            item.value,
                          )}
                        </strong>
                      </button>
                    ),
                  )}
                </div>
              </div>

              <div className="at-posture-footer">
                <div>
                  <span>
                    Observed countries
                  </span>
                  <strong>
                    {numberFormatter.format(
                      hostMetrics.countries,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Active events
                  </span>
                  <strong>
                    {numberFormatter.format(
                      totalEvents,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Blocklist matches
                  </span>
                  <strong>
                    {numberFormatter.format(
                      hostMetrics.blacklisted,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Data sources
                  </span>
                  <strong>
                    {numberFormatter.format(
                      distinctDataSources,
                    )}
                  </strong>
                </div>
              </div>
            </article>

            <article className="at-saas-panel at-ops-pulse-card">
              <div className="at-saas-panel-header at-panel-header-large">
                <div>
                  <span className="at-eyebrow">
                    OPERATIONS PULSE
                  </span>

                  <h3>
                    Workspace activity
                  </h3>
                </div>

                <span className="at-live-pill">
                  <i />
                  Live
                </span>
              </div>

              <div className="at-pulse-list">
                <button
                  type="button"
                  onClick={() =>
                    onNavigate('analysis')
                  }
                >
                  <span className="at-pulse-icon">
                    <Users size={15} />
                  </span>

                  <span>
                    <strong>
                      Analyzed hosts
                    </strong>

                    <small>
                      Current analysis dataset
                    </small>
                  </span>

                  <b>
                    {numberFormatter.format(
                      totalHosts,
                    )}
                  </b>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onNavigate(
                      'honeypot_logs',
                    )
                  }
                >
                  <span className="at-pulse-icon">
                    <Activity size={15} />
                  </span>

                  <span>
                    <strong>
                      Telemetry
                    </strong>

                    <small>
                      Honeypot events received
                    </small>
                  </span>

                  <b>
                    {numberFormatter.format(
                      totalEvents,
                    )}
                  </b>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onNavigate('iocs')
                  }
                >
                  <span className="at-pulse-icon">
                    <Target size={15} />
                  </span>

                  <span>
                    <strong>
                      Blocked sources
                    </strong>

                    <small>
                      Blocklist matches
                    </small>
                  </span>

                  <b>
                    {numberFormatter.format(
                      hostMetrics.blacklisted,
                    )}
                  </b>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onNavigate('news')
                  }
                >
                  <span className="at-pulse-icon">
                    <Hash size={15} />
                  </span>

                  <span>
                    <strong>
                      Intel records
                    </strong>

                    <small>
                      News + CVE sources
                    </small>
                  </span>

                  <b>
                    {numberFormatter.format(
                      intelCount,
                    )}
                  </b>
                </button>
              </div>
            </article>
          </section>

          {/* ---------------------------------------------------------------- */}
          {/* Main analytics                                                     */}
          {/* ---------------------------------------------------------------- */}

          <section className="at-dashboard-main-grid">

            <article className="at-saas-panel at-chart-panel">
              <div className="at-saas-panel-header at-panel-header-large">
                <div>
                  <span className="at-eyebrow">
                    THREAT ACTIVITY
                  </span>

                  <h3>
                    Telemetry volume by severity
                  </h3>

                  <p>
                    Last 24 hours · bucketed by hour.
                  </p>
                </div>

                <div className="at-chart-legend at-chart-legend-large">
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

              <div className="at-chart-wrap at-chart-wrap-large">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <AreaChart
                    data={timeline}
                    margin={{
                      top: 12,
                      right: 18,
                      left: -24,
                      bottom: 0,
                    }}
                  >
                    <defs>
                      <linearGradient
                        id="atCriticalFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#ef4444"
                          stopOpacity={0.18}
                        />

                        <stop
                          offset="100%"
                          stopColor="#ef4444"
                          stopOpacity={0}
                        />
                      </linearGradient>

                      <linearGradient
                        id="atHighFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#f59e0b"
                          stopOpacity={0.14}
                        />

                        <stop
                          offset="100%"
                          stopColor="#f59e0b"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>

                    <CartesianGrid
                      stroke="rgba(255,255,255,0.045)"
                      vertical={false}
                    />

                    <XAxis
                      dataKey="hour"
                      tick={{
                        fill: '#6f737c',
                        fontSize: 10,
                      }}
                      axisLine={false}
                      tickLine={false}
                      interval={3}
                    />

                    <YAxis
                      tick={{
                        fill: '#5d626b',
                        fontSize: 10,
                      }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />

                    <Tooltip
                      cursor={{
                        stroke:
                          'rgba(229,72,77,0.30)',
                      }}
                      contentStyle={{
                        background:
                          '#111216',
                        border:
                          '1px solid #2a2b30',
                        borderRadius: 8,
                        color: '#f4f4f5',
                        fontSize: 11,
                      }}
                      labelStyle={{
                        color: '#a1a1aa',
                        marginBottom: 5,
                      }}
                    />

                    <Area
                      type="monotone"
                      dataKey="low"
                      stackId="1"
                      stroke="#4b5563"
                      fill="transparent"
                      strokeWidth={1.1}
                    />

                    <Area
                      type="monotone"
                      dataKey="medium"
                      stackId="1"
                      stroke="#a97816"
                      fill="transparent"
                      strokeWidth={1.2}
                    />

                    <Area
                      type="monotone"
                      dataKey="high"
                      stackId="1"
                      stroke="#f59e0b"
                      fill="url(#atHighFill)"
                      strokeWidth={1.35}
                    />

                    <Area
                      type="monotone"
                      dataKey="critical"
                      stackId="1"
                      stroke="#ef4444"
                      fill="url(#atCriticalFill)"
                      strokeWidth={1.5}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="at-saas-panel at-feed-panel">
              <div className="at-saas-panel-header at-panel-header-large">
                <div>
                  <span className="at-eyebrow">
                    LIVE TELEMETRY
                  </span>

                  <h3>
                    Latest high-value events
                  </h3>
                </div>

                <button
                  type="button"
                  className="at-dashboard-text-action"
                  onClick={() =>
                    onNavigate(
                      'honeypot_logs',
                    )
                  }
                >
                  Full log
                  <ArrowUpRight size={13} />
                </button>
              </div>

              <div className="at-feed-list">
                {(
                  recentCritical.length > 0
                    ? recentCritical
                    : recentHoneypot.slice(
                      0,
                      5,
                    )
                ).map(
                  (event, index) => {
                    const score =
                      event.threat_score ??
                      event.threat
                        ?.threat_score ??
                      0;

                    const severity =
                      eventSeverityFromScore(
                        score,
                      );

                    return (
                      <button
                        type="button"
                        className="at-feed-row"
                        key={getEventId(
                          event,
                          index,
                        )}
                        onClick={() =>
                          onNavigate(
                            'honeypot_logs',
                          )
                        }
                      >
                        <span
                          className={`at-feed-dot ${severity}`}
                        />

                        <span className="at-feed-copy">
                          <strong>
                            {prettyEventType(
                              event.event_type,
                            )}
                          </strong>

                          <span>
                            {event.src_ip}
                            {event.country
                              ? ` · ${event.country}`
                              : ''}
                          </span>
                        </span>

                        <span className="at-feed-right">
                          <b>
                            {score || '—'}
                          </b>

                          <small>
                            {formatRelativeTime(
                              event.timestamp,
                            )}
                          </small>
                        </span>
                      </button>
                    );
                  },
                )}

                {recentCritical.length === 0 &&
                  recentHoneypot.length ===
                  0 && (
                    <div className="at-dashboard-inline-empty at-dashboard-inline-empty-large">
                      <Activity size={18} />

                      <strong>
                        No events in the current
                        window
                      </strong>

                      <span>
                        Telemetry will appear here as
                        events arrive.
                      </span>
                    </div>
                  )}
              </div>
            </article>
          </section>

          {/* ---------------------------------------------------------------- */}
          {/* Priority + geography                                             */}
          {/* ---------------------------------------------------------------- */}

          <section className="at-dashboard-secondary-grid">

            <article className="at-saas-panel">
              <div className="at-saas-panel-header">
                <div>
                  <span className="at-eyebrow">
                    PRIORITY REVIEW
                  </span>

                  <h3>
                    Hosts requiring attention
                  </h3>
                </div>

                <button
                  type="button"
                  className="at-dashboard-text-action"
                  onClick={() =>
                    onNavigate('analysis')
                  }
                >
                  Open analysis
                  <ArrowUpRight size={13} />
                </button>
              </div>

              <div className="at-priority-list">
                {priorityHosts.map(
                  (host) => (
                    <button
                      key={host.ip}
                      type="button"
                      className="at-priority-row"
                      onClick={() =>
                        onNavigate(
                          'analysis',
                        )
                      }
                    >
                      <span
                        className={`at-priority-score ${host.riskLevel.toLowerCase()}`}
                      >
                        {Math.round(
                          host.totalScore,
                        )}
                      </span>

                      <span className="at-priority-main">
                        <strong>
                          {host.ip}
                        </strong>

                        <span>
                          {host.country ||
                            'Unknown location'}
                          {host.asn
                            ? ` · ${host.asn}`
                            : ''}
                        </span>
                      </span>

                      <span
                        className={`at-dashboard-severity-badge ${host.riskLevel.toLowerCase()}`}
                      >
                        {host.riskLevel}
                      </span>
                    </button>
                  ),
                )}

                {priorityHosts.length ===
                  0 && (
                    <div className="at-dashboard-inline-empty">
                      <ShieldCheck size={18} />

                      <strong>
                        No high-priority hosts
                      </strong>

                      <span>
                        The current analysis dataset
                        contains no critical or high-risk
                        hosts.
                      </span>
                    </div>
                  )}
              </div>
            </article>

            <article className="at-saas-panel">
              <div className="at-saas-panel-header">
                <div>
                  <span className="at-eyebrow">
                    ORIGIN INTELLIGENCE
                  </span>

                  <h3>
                    Top attack origins
                  </h3>
                </div>

                <Globe2
                  size={16}
                  className="at-saas-panel-icon"
                />
              </div>

              <div className="at-origin-list">
                {attackGeo.map(
                  (
                    [country, count],
                    index,
                  ) => {
                    const max =
                      attackGeo[0]?.[1] ||
                      1;

                    return (
                      <button
                        key={country}
                        type="button"
                        className="at-origin-row"
                        onClick={() =>
                          onNavigate(
                            'honeypot_logs',
                          )
                        }
                      >
                        <span className="at-origin-rank">
                          {String(
                            index + 1,
                          ).padStart(
                            2,
                            '0',
                          )}
                        </span>

                        <span className="at-origin-main">
                          <strong>
                            {country}
                          </strong>

                          <span className="at-origin-bar">
                            <i
                              style={{
                                width: `${Math.max(
                                  8,
                                  (count / max) *
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
                    );
                  },
                )}

                {attackGeo.length ===
                  0 && (
                    <div className="at-dashboard-inline-empty">
                      <Globe2 size={18} />

                      <strong>
                        No origin data
                      </strong>

                      <span>
                        Source geography will populate as
                        events are enriched.
                      </span>
                    </div>
                  )}
              </div>
            </article>
          </section>

          {/* ---------------------------------------------------------------- */}
          {/* Recent telemetry table                                            */}
          {/* ---------------------------------------------------------------- */}

          <section className="at-saas-panel at-dashboard-table-card">
            <div className="at-saas-panel-header at-panel-header-large">
              <div>
                <span className="at-eyebrow">
                  RECENT ACTIVITY
                </span>

                <h3>
                  Latest honeypot telemetry
                </h3>

                <p>
                  Most recent events enriched by the
                  active telemetry pipeline.
                </p>
              </div>

              <button
                type="button"
                className="at-dashboard-text-action"
                onClick={() =>
                  onNavigate(
                    'honeypot_logs',
                  )
                }
              >
                Open full logs
                <ArrowUpRight size={13} />
              </button>
            </div>

            {recentHoneypot.length >
              0 ? (
              <div className="at-dashboard-table-wrap">
                <table className="at-dashboard-table at-dashboard-table-modern">
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
                        Honeypot
                      </th>

                      <th>
                        Location
                      </th>

                      <th>
                        Observed
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {recentHoneypot.map(
                      (
                        event,
                        index,
                      ) => {
                        const score =
                          event.threat_score ??
                          event.threat
                            ?.threat_score ??
                          0;

                        const severity =
                          eventSeverityFromScore(
                            score,
                          );

                        return (
                          <tr
                            key={getEventId(
                              event,
                              index,
                            )}
                            onClick={() =>
                              onNavigate(
                                'honeypot_logs',
                              )
                            }
                          >
                            <td>
                              <span
                                className={`at-dashboard-severity-badge ${severity}`}
                              >
                                {severity}
                              </span>
                            </td>

                            <td>
                              <strong className="at-dashboard-code-strong">
                                {event.src_ip}
                              </strong>
                            </td>

                            <td>
                              <span>
                                {prettyEventType(
                                  event.event_type,
                                )}
                              </span>
                            </td>

                            <td>
                              <code>
                                {event.honeypot ||
                                  '—'}
                              </code>
                            </td>

                            <td>
                              {event.country ||
                                event.geo_city ||
                                '—'}
                            </td>

                            <td>
                              <time
                                title={formatDateTime(
                                  event.timestamp,
                                )}
                              >
                                {formatRelativeTime(
                                  event.timestamp,
                                )}
                              </time>
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="at-dashboard-table-empty at-dashboard-table-empty-large">
                <Activity size={20} />

                <strong>
                  No recent telemetry
                </strong>

                <span>
                  Event records will appear here as
                  honeypot activity is collected.
                </span>
              </div>
            )}
          </section>

          {/* ---------------------------------------------------------------- */}
          {/* Intelligence coverage                                             */}
          {/* ---------------------------------------------------------------- */}

          <section className="at-dashboard-intelligence-grid">
            <button
              type="button"
              className="at-intel-module-card"
              onClick={() =>
                onNavigate('news')
              }
            >
              <span className="at-intel-module-icon">
                <Globe2 size={16} />
              </span>

              <span className="at-intel-module-copy">
                <small>
                  Threat intelligence
                </small>

                <strong>
                  {numberFormatter.format(
                    newsItems.length,
                  )}
                </strong>

                <em>
                  News records available
                </em>
              </span>

              <ArrowUpRight size={14} />
            </button>

            <button
              type="button"
              className="at-intel-module-card"
              onClick={() =>
                onNavigate('cve')
              }
            >
              <span className="at-intel-module-icon">
                <ShieldAlert size={16} />
              </span>

              <span className="at-intel-module-copy">
                <small>
                  Vulnerability feed
                </small>

                <strong>
                  {numberFormatter.format(
                    cveFeedItems.length,
                  )}
                </strong>

                <em>
                  CVE intelligence records
                </em>
              </span>

              <ArrowUpRight size={14} />
            </button>

            <button
              type="button"
              className="at-intel-module-card"
              onClick={() =>
                onNavigate('topology')
              }
            >
              <span className="at-intel-module-icon">
                <Network size={16} />
              </span>

              <span className="at-intel-module-copy">
                <small>
                  Infrastructure
                </small>

                <strong>
                  {numberFormatter.format(
                    topAsns.length,
                  )}
                </strong>

                <em>
                  Observed source ASN groups
                </em>
              </span>

              <ArrowUpRight size={14} />
            </button>

            <button
              type="button"
              className="at-intel-module-card"
              onClick={() =>
                onNavigate('analysis')
              }
            >
              <span className="at-intel-module-icon">
                <BarChart3 size={16} />
              </span>

              <span className="at-intel-module-copy">
                <small>
                  Analysis coverage
                </small>

                <strong>
                  {numberFormatter.format(
                    totalHosts,
                  )}
                </strong>

                <em>
                  Analyzed hosts in workspace
                </em>
              </span>

              <ArrowUpRight size={14} />
            </button>
          </section>

          {/* ---------------------------------------------------------------- */}
          {/* Quick operations                                                  */}
          {/* ---------------------------------------------------------------- */}

          <section className="at-dashboard-utility-row">
            <div className="at-dashboard-utility-copy">
              <span className="at-eyebrow">
                QUICK OPERATIONS
              </span>

              <strong>
                Move directly into an investigation
                surface.
              </strong>
            </div>

            <div className="at-dashboard-utility-actions">
              <button
                type="button"
                onClick={() =>
                  onNavigate(
                    'investigation_bench',
                  )
                }
              >
                <Target size={14} />
                Investigation Bench
              </button>

              <button
                type="button"
                onClick={() =>
                  onNavigate('iocs')
                }
              >
                <Hash size={14} />
                IOC Manager
              </button>

              <button
                type="button"
                onClick={() =>
                  onNavigate('cve')
                }
              >
                <ShieldAlert size={14} />
                Vulnerabilities
              </button>

              <button
                type="button"
                onClick={() =>
                  onNavigate('topology')
                }
              >
                <Network size={14} />
                Network Topology
              </button>

              <button
                type="button"
                onClick={() =>
                  onNavigate(
                    'honeypot_logs',
                  )
                }
              >
                <Server size={14} />
                Honeypot Logs
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}