import { useMemo } from 'react';
import {
  Activity,
  ArrowUpRight,
  ChevronRight,
  Globe2,
  Hash,
  Lock,
  Network,
  Radio,
  Server,
  ShieldAlert,
  ShieldBan,
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

import {
  MOCK_EVENTS,
  MOCK_HOSTS,
  MOCK_STATS,
} from '../data/mockData';

import PageHeader from '../components/layout/PageHeader';

interface DashboardProps {
  onNavigate: (id: string) => void;
}

const number = new Intl.NumberFormat('en-US');

function hourKey(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:00`;
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export default function DashboardPage({
  onNavigate,
}: DashboardProps) {
  const highRisk = MOCK_HOSTS.filter(
    (host) => host.riskLevel === 'HIGH'
  ).length;

  const blacklisted = MOCK_HOSTS.filter(
    (host) => host.isBlacklisted
  ).length;

  const timeline = useMemo(() => {
    const buckets = new Map<
      string,
      {
        hour: string;
        critical: number;
        high: number;
        medium: number;
        low: number;
      }
    >();

    for (let i = 23; i >= 0; i -= 1) {
      const date = new Date();

      date.setMinutes(0, 0, 0);
      date.setHours(
        date.getHours() - i
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

    MOCK_EVENTS.forEach((event) => {
      const date = new Date(event.timestamp);
      const key = hourKey(date);
      const bucket = buckets.get(key);

      if (bucket) {
        bucket[event.severity] += 1;
      }
    });

    return [...buckets.values()];
  }, []);

  const attackGeo = useMemo(() => {
    const values = MOCK_EVENTS.reduce(
      (acc, event) => {
        acc[event.country] =
          (acc[event.country] || 0) + 1;

        return acc;
      },
      {} as Record<string, number>
    );

    return Object.entries(values)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, []);

  const topAsns = useMemo(() => {
    const values = MOCK_EVENTS.reduce(
      (acc, event) => {
        const asn =
          event.asn || 'AS0000 Unknown';

        acc[asn] =
          (acc[asn] || 0) + 1;

        return acc;
      },
      {} as Record<string, number>
    );

    return Object.entries(values)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, []);

  const recentCritical = MOCK_EVENTS
    .filter(
      (event) =>
        event.severity === 'critical'
    )
    .slice(0, 5);

  const recentHoneypot =
    MOCK_EVENTS.slice(0, 5);

  const investigations = [
    {
      id: 'INV-2901',
      title: 'Cobalt Strike Beacon Activity',
      assignee: 'Analyst-1',
      status: 'Active',
      severity: 'critical',
    },
    {
      id: 'INV-2900',
      title: 'Mirai Botnet Propagation',
      assignee: 'Analyst-2',
      status: 'Pending',
      severity: 'high',
    },
    {
      id: 'INV-2899',
      title: 'Mass SSH Brute Force (RU)',
      assignee: 'Analyst-1',
      status: 'Active',
      severity: 'medium',
    },
  ];

  const metrics = [
    {
      label: 'Active Honeypots',
      value: MOCK_STATS.activeHoneypots,
      helper: 'Live deployments',
      icon: Server,
      destination: 'infrastructure',
    },
    {
      label: 'Unique Attackers',
      value: MOCK_STATS.uniqueAttackers,
      helper: 'Observed sources',
      icon: Users,
      destination: 'honeypot_logs',
    },
    {
      label: 'Blocked IPs',
      value: MOCK_STATS.blockedIps,
      helper: 'Current blacklist',
      icon: ShieldBan,
      destination: 'ioc',
    },
    {
      label: 'Active Indicators',
      value: MOCK_STATS.iocCount,
      helper: 'IOC records',
      icon: Hash,
      destination: 'ioc',
    },
    {
      label: 'Active Cases',
      value: MOCK_STATS.activeCases,
      helper: 'Investigation queue',
      icon: Lock,
      destination: 'investigation_bench',
    },
  ];

  return (
    <div className="at-dashboard-v2">
      <PageHeader
        breadcrumbs={[
          { label: 'Operations' },
          { label: 'Dashboard' },
        ]}
        title="Command Center"
        description="Global threat operations and analyst workspace."
        timeRange="Last 24 Hours"
        actions={
          <button
            type="button"
            className="at-btn at-btn-primary"
            onClick={() =>
              onNavigate('soc_wall')
            }
          >
            <Radio size={14} />
            Launch SOC Wall
          </button>
        }
      />

      <div className="at-dashboard-v2-scroll">
        <div className="at-dashboard-v2-container">

          {/* ---------------------------------------------------- */}
          {/* Operational metrics                                 */}
          {/* ---------------------------------------------------- */}

          <section className="at-dashboard-metrics">
            {metrics.map((metric, index) => {
              const Icon = metric.icon;

              return (
                <button
                  type="button"
                  key={metric.label}
                  className="at-dashboard-metric"
                  onClick={() =>
                    onNavigate(
                      metric.destination
                    )
                  }
                >
                  <span className="at-dashboard-metric-index">
                    {String(index + 1).padStart(
                      2,
                      '0'
                    )}
                  </span>

                  <span className="at-dashboard-metric-icon">
                    <Icon size={16} />
                  </span>

                  <span className="at-dashboard-metric-copy">
                    <strong>
                      {metric.label}
                    </strong>

                    <small>
                      {metric.helper}
                    </small>
                  </span>

                  <span className="at-dashboard-metric-value">
                    {number.format(
                      metric.value
                    )}
                  </span>

                  <ChevronRight
                    size={14}
                    className="at-dashboard-metric-arrow"
                  />
                </button>
              );
            })}
          </section>

          {/* ---------------------------------------------------- */}
          {/* Threat posture                                      */}
          {/* ---------------------------------------------------- */}

          <section className="at-dashboard-posture">
            <div className="at-dashboard-posture-main">
              <div className="at-dashboard-posture-heading">
                <div>
                  <span className="at-v2-kicker">
                    THREAT POSTURE
                  </span>

                  <h2>
                    Critical activity
                  </h2>
                </div>

                <button
                  type="button"
                  className="at-dashboard-text-action"
                  onClick={() =>
                    onNavigate(
                      'honeypot_logs'
                    )
                  }
                >
                  Open logs
                  <ArrowUpRight
                    size={13}
                  />
                </button>
              </div>

              <div className="at-dashboard-posture-number">
                <span className="at-dashboard-critical-icon">
                  <ShieldAlert
                    size={20}
                  />
                </span>

                <strong>
                  {MOCK_STATS.criticalThreats}
                </strong>

                <span>
                  critical threats
                </span>
              </div>

              <div className="at-dashboard-posture-meta">
                <span className="at-dashboard-trend">
                  +{MOCK_STATS.eventsTrend}%
                </span>

                <span>
                  event activity today
                </span>

                <small>
                  {number.format(
                    MOCK_STATS.eventsToday
                  )}{' '}
                  total events
                </small>
              </div>
            </div>

            <div className="at-dashboard-posture-side">
              <div>
                <span>HIGH RISK HOSTS</span>
                <strong>
                  {number.format(
                    highRisk
                  )}
                </strong>
              </div>

              <div>
                <span>BLACKLISTED IPS</span>
                <strong>
                  {number.format(
                    blacklisted
                  )}
                </strong>
              </div>

              <div>
                <span>COUNTRIES</span>
                <strong>
                  {MOCK_STATS.countriesSource}
                </strong>
              </div>
            </div>
          </section>

          {/* ---------------------------------------------------- */}
          {/* Main analytics                                      */}
          {/* ---------------------------------------------------- */}

          <section className="at-dashboard-main-grid">

            {/* Threat timeline */}
            <article className="at-dashboard-card at-dashboard-chart-card">
              <div className="at-dashboard-card-header">
                <div>
                  <span className="at-v2-kicker">
                    THREAT ACTIVITY TIMELINE
                  </span>

                  <h3>
                    Event volume by severity
                  </h3>

                  <p>
                    Event volume by severity
                    over the last 24 hours.
                  </p>
                </div>

                <div className="at-dashboard-legend">
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
                </div>
              </div>

              <div className="at-dashboard-chart">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <AreaChart
                    data={timeline}
                    margin={{
                      top: 8,
                      right: 8,
                      left: -24,
                      bottom: 0,
                    }}
                  >
                    <CartesianGrid
                      stroke="rgba(255,255,255,0.045)"
                      vertical={false}
                    />

                    <XAxis
                      dataKey="hour"
                      tick={{
                        fill: '#666',
                        fontSize: 10,
                        fontFamily:
                          'JetBrains Mono',
                      }}
                      axisLine={false}
                      tickLine={false}
                      interval={3}
                    />

                    <YAxis
                      tick={{
                        fill: '#666',
                        fontSize: 10,
                        fontFamily:
                          'JetBrains Mono',
                      }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />

                    <Tooltip
                      cursor={{
                        stroke:
                          'rgba(214,40,40,0.3)',
                      }}
                      contentStyle={{
                        background:
                          '#111111',
                        border:
                          '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 8,
                        color: '#F5F5F5',
                        fontFamily:
                          'JetBrains Mono',
                        fontSize: 11,
                      }}
                    />

                    <Area
                      type="monotone"
                      dataKey="medium"
                      stackId="1"
                      stroke="#A97816"
                      fill="#A97816"
                      fillOpacity={0.08}
                      strokeWidth={1.4}
                    />

                    <Area
                      type="monotone"
                      dataKey="high"
                      stackId="1"
                      stroke="#F97316"
                      fill="#F97316"
                      fillOpacity={0.09}
                      strokeWidth={1.5}
                    />

                    <Area
                      type="monotone"
                      dataKey="critical"
                      stackId="1"
                      stroke="#D62828"
                      fill="#D62828"
                      fillOpacity={0.13}
                      strokeWidth={1.7}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </article>

            {/* Attack geography */}
            <article className="at-dashboard-card at-dashboard-geo-card">
              <div className="at-dashboard-card-header">
                <div>
                  <span className="at-v2-kicker">
                    ATTACK GEOGRAPHY
                  </span>

                  <h3>
                    Source distribution
                  </h3>
                </div>

                <Globe2
                  size={16}
                  className="at-dashboard-card-icon"
                />
              </div>

              <div className="at-dashboard-geo-list">
                {attackGeo.map(
                  ([country, count], index) => {
                    const max =
                      attackGeo[0]?.[1] || 1;

                    return (
                      <button
                        type="button"
                        className="at-dashboard-geo-row"
                        key={country}
                      >
                        <span className="at-dashboard-rank">
                          {String(
                            index + 1
                          ).padStart(
                            2,
                            '0'
                          )}
                        </span>

                        <span className="at-dashboard-geo-copy">
                          <span>
                            {country}
                          </span>

                          <span className="at-dashboard-geo-track">
                            <i
                              style={{
                                width: `${(count /
                                    max) *
                                  100
                                  }%`,
                              }}
                            />
                          </span>
                        </span>

                        <strong>
                          {count}
                        </strong>
                      </button>
                    );
                  }
                )}
              </div>
            </article>

          </section>

          {/* ---------------------------------------------------- */}
          {/* Investigative activity                              */}
          {/* ---------------------------------------------------- */}

          <section className="at-dashboard-two-column">

            <article className="at-dashboard-card">
              <div className="at-dashboard-card-header">
                <div>
                  <span className="at-v2-kicker">
                    CRITICAL EVENTS
                  </span>

                  <h3>
                    Immediate attention
                  </h3>
                </div>

                <button
                  type="button"
                  className="at-dashboard-text-action"
                  onClick={() =>
                    onNavigate(
                      'honeypot_logs'
                    )
                  }
                >
                  View all
                  <ChevronRight
                    size={13}
                  />
                </button>
              </div>

              <div className="at-dashboard-event-list">
                {recentCritical.map(
                  (event) => (
                    <button
                      type="button"
                      className="at-dashboard-event"
                      key={event.id}
                      onClick={() =>
                        onNavigate(
                          'honeypot_logs'
                        )
                      }
                    >
                      <span className="at-dashboard-event-bar critical" />

                      <span className="at-dashboard-event-main">
                        <strong>
                          {event.eventType.replace(
                            /_/g,
                            ' '
                          )}
                        </strong>

                        <span>
                          <code>
                            {event.srcIp}
                          </code>

                          <i>→</i>

                          <code>
                            {event.honeypot}
                          </code>
                        </span>
                      </span>

                      <time>
                        {formatTime(
                          event.timestamp
                        )}
                      </time>
                    </button>
                  )
                )}
              </div>
            </article>

            <article className="at-dashboard-card">
              <div className="at-dashboard-card-header">
                <div>
                  <span className="at-v2-kicker">
                    INVESTIGATION QUEUE
                  </span>

                  <h3>
                    Active investigations
                  </h3>
                </div>

                <button
                  type="button"
                  className="at-dashboard-text-action"
                  onClick={() =>
                    onNavigate(
                      'investigation_bench'
                    )
                  }
                >
                  Workspace
                  <ArrowUpRight
                    size={13}
                  />
                </button>
              </div>

              <div className="at-dashboard-investigation-list">
                {investigations.map(
                  (investigation) => (
                    <button
                      type="button"
                      className="at-dashboard-investigation"
                      key={investigation.id}
                      onClick={() =>
                        onNavigate(
                          'investigation'
                        )
                      }
                    >
                      <span
                        className={`at-dashboard-severity-dot ${investigation.severity}`}
                      />

                      <span className="at-dashboard-investigation-copy">
                        <strong>
                          {
                            investigation.title
                          }
                        </strong>

                        <span>
                          <code>
                            {
                              investigation.id
                            }
                          </code>

                          <em>
                            {
                              investigation.assignee
                            }
                          </em>
                        </span>
                      </span>

                      <span
                        className={`at-dashboard-state ${investigation.status.toLowerCase()}`}
                      >
                        {
                          investigation.status
                        }
                      </span>

                      <ChevronRight
                        size={13}
                      />
                    </button>
                  )
                )}
              </div>
            </article>

          </section>

          {/* ---------------------------------------------------- */}
          {/* Recent activity                                    */}
          {/* ---------------------------------------------------- */}

          <section className="at-dashboard-card at-dashboard-table-card">
            <div className="at-dashboard-card-header">
              <div>
                <span className="at-v2-kicker">
                  RECENT ACTIVITY
                </span>

                <h3>
                  Recent honeypot activity
                </h3>
              </div>

              <button
                type="button"
                className="at-dashboard-text-action"
                onClick={() =>
                  onNavigate(
                    'honeypot_logs'
                  )
                }
              >
                Full logs
                <ArrowUpRight
                  size={13}
                />
              </button>
            </div>

            <div className="at-dashboard-table-wrap">
              <table className="at-dashboard-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Source IP</th>
                    <th>Type</th>
                    <th>Honeypot</th>
                    <th>Country</th>
                    <th>Severity</th>
                  </tr>
                </thead>

                <tbody>
                  {recentHoneypot.map(
                    (event) => (
                      <tr
                        key={event.id}
                        onClick={() =>
                          onNavigate(
                            'honeypot_logs'
                          )
                        }
                      >
                        <td>
                          <code>
                            {formatDateTime(
                              event.timestamp
                            )}
                          </code>
                        </td>

                        <td>
                          <strong className="at-dashboard-code-strong">
                            {event.srcIp}
                          </strong>
                        </td>

                        <td>
                          {
                            event.eventType.replace(
                              /_/g,
                              ' '
                            )
                          }
                        </td>

                        <td>
                          <code>
                            {
                              event.honeypot
                            }
                          </code>
                        </td>

                        <td>
                          {event.country}
                        </td>

                        <td>
                          <span
                            className={`at-dashboard-severity-badge ${event.severity}`}
                          >
                            {event.severity}
                          </span>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* ---------------------------------------------------- */}
          {/* Infrastructure + live intelligence                  */}
          {/* ---------------------------------------------------- */}

          <section className="at-dashboard-bottom-grid">

            <article className="at-dashboard-card">
              <div className="at-dashboard-card-header">
                <div>
                  <span className="at-v2-kicker">
                    INFRASTRUCTURE
                  </span>

                  <h3>
                    Top malicious ASNs
                  </h3>
                </div>

                <Network
                  size={16}
                  className="at-dashboard-card-icon"
                />
              </div>

              <div className="at-dashboard-asn-list">
                {topAsns.map(
                  ([asn, count], index) => (
                    <button
                      type="button"
                      className="at-dashboard-asn"
                      key={asn}
                      onClick={() =>
                        onNavigate(
                          'analysis'
                        )
                      }
                    >
                      <span className="at-dashboard-asn-rank">
                        {index + 1}
                      </span>

                      <code>
                        {asn}
                      </code>

                      <span>
                        {count} events
                      </span>
                    </button>
                  )
                )}
              </div>
            </article>

            <article className="at-dashboard-card at-dashboard-intel-card">
              <div className="at-dashboard-card-header">
                <div>
                  <span className="at-v2-kicker">
                    INTELLIGENCE
                  </span>

                  <h3>
                    Live intelligence
                  </h3>
                </div>

                <button
                  type="button"
                  className="at-dashboard-text-action"
                  onClick={() =>
                    onNavigate('news')
                  }
                >
                  Open feed
                  <ArrowUpRight
                    size={13}
                  />
                </button>
              </div>

              <div className="at-dashboard-intel-status">
                <div className="at-dashboard-intel-indicator">
                  <span />
                  LIVE INTEL
                </div>

                <div className="at-dashboard-intel-divider" />

                <div className="at-dashboard-intel-copy">
                  <strong>
                    Threat intelligence feed is active.
                  </strong>

                  <span>
                    New indicators,
                    advisories, and research
                    are available in the
                    Intelligence workspace.
                  </span>
                </div>

                <div className="at-dashboard-intel-receiving">
                  <Activity size={12} />
                  Receiving
                </div>
              </div>
            </article>

          </section>

        </div>
      </div>
    </div>
  );
}