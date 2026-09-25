import {
  useMemo,
  useState,
} from 'react';

import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  ChevronRight,
  CircleX,
  Clock3,
  Command,
  Download,
  Globe2,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  TerminalSquare,
  X,
} from 'lucide-react';

import {
  MOCK_EVENTS,
  type MockThreatEvent,
} from '../data/mockData';

import PageHeader from '../components/layout/PageHeader';

interface HoneypotLogsProps {
  onNavigate: (id: string) => void;
}

const SEVERITY_CONFIG = {
  critical: {
    label: 'Critical',
    short: 'CRIT',
  },
  high: {
    label: 'High',
    short: 'HIGH',
  },
  medium: {
    label: 'Medium',
    short: 'MED',
  },
  low: {
    label: 'Low',
    short: 'LOW',
  },
} as const;

function formatTimestamp(
  timestamp: string
) {
  return new Date(timestamp).toLocaleString(
    'en-US',
    {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }
  );
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

function prettyEventType(
  value: string
) {
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

export default function HoneypotLogsPage({
  onNavigate,
}: HoneypotLogsProps) {
  const [search, setSearch] =
    useState('');

  const [sevFilter, setSevFilter] =
    useState<string>('ALL');

  const [honeypotFilter, setHoneypotFilter] =
    useState<string>('ALL');

  const [selectedEvent, setSelectedEvent] =
    useState<MockThreatEvent | null>(
      MOCK_EVENTS[0] ?? null
    );

  const uniqueHoneypots = useMemo(
    () =>
      [
        ...new Set(
          MOCK_EVENTS.map(
            (event) => event.honeypot
          )
        ),
      ].sort(),
    []
  );

  const filtered = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    return MOCK_EVENTS.filter(
      (event) => {
        const matchesSearch =
          !normalizedSearch ||
          event.srcIp
            .toLowerCase()
            .includes(normalizedSearch) ||
          event.eventType
            .toLowerCase()
            .includes(normalizedSearch) ||
          event.command
            ?.toLowerCase()
            .includes(normalizedSearch) ||
          false;

        const matchesSeverity =
          sevFilter === 'ALL' ||
          event.severity === sevFilter;

        const matchesHoneypot =
          honeypotFilter === 'ALL' ||
          event.honeypot ===
          honeypotFilter;

        return (
          matchesSearch &&
          matchesSeverity &&
          matchesHoneypot
        );
      }
    );
  }, [
    search,
    sevFilter,
    honeypotFilter,
  ]);

  const stats = useMemo(
    () => ({
      total: filtered.length,

      critical: filtered.filter(
        (event) =>
          event.severity ===
          'critical'
      ).length,

      high: filtered.filter(
        (event) =>
          event.severity === 'high'
      ).length,

      unique: new Set(
        filtered.map(
          (event) => event.srcIp
        )
      ).size,
    }),
    [filtered]
  );

  const clearFilters = () => {
    setSearch('');
    setSevFilter('ALL');
    setHoneypotFilter('ALL');
  };

  const hasFilters =
    Boolean(search) ||
    sevFilter !== 'ALL' ||
    honeypotFilter !== 'ALL';

  return (
    <div className="at-honeypot-page">

      {/* ========================================================
          PAGE HEADER
          ======================================================== */}

      <PageHeader
        breadcrumbs={[
          { label: 'Operations' },
          { label: 'Honeypot Logs' },
        ]}
        title="Honeypot Logs"
        description={`${stats.total.toLocaleString()} events · ${stats.unique.toLocaleString()} unique sources`}
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
              className="at-btn at-btn-secondary at-btn-sm"
            >
              <Download size={13} />
              Export
            </button>
          </>
        }
        filters={
          <div className="at-honeypot-filterbar">

            {/* Search */}
            <div className="at-honeypot-search">
              <Search size={14} />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search IPs, commands, event types..."
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

            {/* Severity */}
            <label className="at-honeypot-select-wrap">
              <span>SEVERITY</span>

              <select
                value={sevFilter}
                onChange={(event) =>
                  setSevFilter(
                    event.target.value
                  )
                }
                className="at-honeypot-select"
              >
                <option value="ALL">
                  All
                </option>

                <option value="critical">
                  Critical
                </option>

                <option value="high">
                  High
                </option>

                <option value="medium">
                  Medium
                </option>

                <option value="low">
                  Low
                </option>
              </select>
            </label>

            {/* Honeypot */}
            <label className="at-honeypot-select-wrap">
              <span>HONEYPOT</span>

              <select
                value={honeypotFilter}
                onChange={(event) =>
                  setHoneypotFilter(
                    event.target.value
                  )
                }
                className="at-honeypot-select"
              >
                <option value="ALL">
                  All
                </option>

                {uniqueHoneypots.map(
                  (honeypot) => (
                    <option
                      key={honeypot}
                      value={honeypot}
                    >
                      {honeypot}
                    </option>
                  )
                )}
              </select>
            </label>

            {/* Filter state */}
            {hasFilters && (
              <button
                type="button"
                className="at-honeypot-clear"
                onClick={
                  clearFilters
                }
              >
                <CircleX size={13} />
                Clear
              </button>
            )}

            <div className="at-honeypot-filter-spacer" />

            {/* Small telemetry */}
            <div className="at-honeypot-telemetry">
              <span>
                <i className="critical" />
                {stats.critical}
                <small>
                  critical
                </small>
              </span>

              <span>
                <i className="high" />
                {stats.high}
                <small>
                  high
                </small>
              </span>
            </div>
          </div>
        }
      />

      {/* ========================================================
          WORKSPACE
          ======================================================== */}

      <div className="at-honeypot-workspace">

        {/* ======================================================
            EVENT STREAM
            ====================================================== */}

        <section className="at-honeypot-stream">

          <div className="at-honeypot-stream-header">
            <div>
              <span className="at-v2-kicker">
                EVENT STREAM
              </span>

              <h2>
                Incoming honeypot activity
              </h2>
            </div>

            <div className="at-honeypot-live">
              <span />
              LIVE
            </div>
          </div>

          <div className="at-honeypot-table-wrap">

            <table className="at-honeypot-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Source</th>
                  <th>Port</th>
                  <th>Event</th>
                  <th>Honeypot</th>
                  <th>Country</th>
                  <th>User</th>
                  <th>Severity</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="at-honeypot-empty"
                    >
                      <ShieldAlert
                        size={20}
                      />

                      <strong>
                        No events match
                        the current
                        filters
                      </strong>

                      <span>
                        Adjust the
                        search or
                        severity filters
                        to continue.
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
                  filtered.map(
                    (event) => {
                      const active =
                        selectedEvent?.id ===
                        event.id;

                      return (
                        <tr
                          key={event.id}
                          className={
                            active
                              ? 'active'
                              : ''
                          }
                          onClick={() =>
                            setSelectedEvent(
                              event
                            )
                          }
                        >
                          <td>
                            <span className="at-honeypot-time">
                              {formatTime(
                                event.timestamp
                              )}
                            </span>
                          </td>

                          <td>
                            <button
                              type="button"
                              className="at-honeypot-ip"
                              onClick={(
                                clickEvent
                              ) => {
                                clickEvent.stopPropagation();

                                setSearch(
                                  event.srcIp
                                );
                              }}
                            >
                              {event.srcIp}
                            </button>
                          </td>

                          <td>
                            <code className="at-honeypot-port">
                              {event.dstPort}
                            </code>
                          </td>

                          <td>
                            <span className="at-honeypot-event-type">
                              {
                                prettyEventType(
                                  event.eventType
                                )
                              }
                            </span>
                          </td>

                          <td>
                            <span className="at-honeypot-honeypot">
                              {event.honeypot}
                            </span>
                          </td>

                          <td>
                            <span className="at-honeypot-country">
                              {
                                event.country
                              }
                            </span>
                          </td>

                          <td>
                            <code className="at-honeypot-user">
                              {event.username ||
                                '—'}
                            </code>
                          </td>

                          <td>
                            <span
                              className={`at-honeypot-severity ${event.severity}`}
                            >
                              <i />
                              {
                                SEVERITY_CONFIG[
                                  event.severity
                                ].short
                              }
                            </span>
                          </td>

                          <td>
                            <ChevronRight
                              size={13}
                              className="at-honeypot-row-arrow"
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

          <footer className="at-honeypot-stream-footer">
            <span>
              Showing{' '}
              <strong>
                {filtered.length}
              </strong>{' '}
              events
            </span>

            <span>
              Static prototype data
            </span>
          </footer>
        </section>

        {/* ======================================================
            DETAIL INSPECTOR
            ====================================================== */}

        <aside className="at-honeypot-inspector">

          {!selectedEvent ? (
            <div className="at-honeypot-inspector-empty">
              <Server size={24} />

              <strong>
                Select an event
              </strong>

              <span>
                Event details and
                available actions
                will appear here.
              </span>
            </div>
          ) : (
            <>
              <div className="at-honeypot-inspector-header">
                <div>
                  <span className="at-v2-kicker">
                    EVENT DETAIL
                  </span>

                  <h2>
                    {prettyEventType(
                      selectedEvent.eventType
                    )}
                  </h2>
                </div>

                <button
                  type="button"
                  className="at-honeypot-close"
                  onClick={() =>
                    setSelectedEvent(
                      null
                    )
                  }
                  aria-label="Close event detail"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="at-honeypot-inspector-body">

                {/* Threat identity */}
                <div className="at-honeypot-identity">

                  <div className="at-honeypot-identity-top">
                    <span
                      className={`at-honeypot-severity large ${selectedEvent.severity}`}
                    >
                      <i />
                      {
                        SEVERITY_CONFIG[
                          selectedEvent
                            .severity
                        ].label
                      }
                    </span>

                    <span className="at-honeypot-event-time">
                      <Clock3
                        size={11}
                      />
                      {formatTimestamp(
                        selectedEvent.timestamp
                      )}
                    </span>
                  </div>

                  <span className="at-honeypot-identity-label">
                    SOURCE IP
                  </span>

                  <button
                    type="button"
                    className="at-honeypot-source-ip"
                    onClick={() =>
                      setSearch(
                        selectedEvent.srcIp
                      )
                    }
                  >
                    {selectedEvent.srcIp}
                  </button>
                </div>

                {/* Core metadata */}
                <div className="at-honeypot-section">
                  <div className="at-honeypot-section-title">
                    <span>
                      CONNECTION
                    </span>

                    <Command size={12} />
                  </div>

                  <div className="at-honeypot-detail-grid">

                    <div>
                      <span>
                        Destination port
                      </span>

                      <code>
                        {
                          selectedEvent.dstPort
                        }
                      </code>
                    </div>

                    <div>
                      <span>
                        Honeypot
                      </span>

                      <strong>
                        {
                          selectedEvent.honeypot
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        Country
                      </span>

                      <strong>
                        {
                          selectedEvent.country
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        Country code
                      </span>

                      <code>
                        {
                          selectedEvent.countryCode
                        }
                      </code>
                    </div>

                    <div>
                      <span>
                        ASN
                      </span>

                      <code>
                        {
                          selectedEvent.asn ||
                          '—'
                        }
                      </code>
                    </div>

                    <div>
                      <span>
                        Username
                      </span>

                      <code>
                        {
                          selectedEvent.username ||
                          '—'
                        }
                      </code>
                    </div>

                  </div>
                </div>

                {/* Command */}
                {selectedEvent.command && (
                  <div className="at-honeypot-section">

                    <div className="at-honeypot-section-title">
                      <span>
                        COMMAND EXECUTED
                      </span>

                      <TerminalSquare
                        size={12}
                      />
                    </div>

                    <div className="at-honeypot-command">

                      <div className="at-honeypot-command-header">
                        <span>
                          shell
                        </span>

                        <span>
                          captured
                        </span>
                      </div>

                      <code>
                        {selectedEvent.command}
                      </code>

                    </div>
                  </div>
                )}

                {/* Event context */}
                <div className="at-honeypot-section">

                  <div className="at-honeypot-section-title">
                    <span>
                      EVENT CONTEXT
                    </span>

                    <Activity
                      size={12}
                    />
                  </div>

                  <div className="at-honeypot-event-context">

                    <div>
                      <span>
                        Event ID
                      </span>

                      <code>
                        {selectedEvent.id}
                      </code>
                    </div>

                    <div>
                      <span>
                        Event type
                      </span>

                      <strong>
                        {
                          selectedEvent.eventType
                        }
                      </strong>
                    </div>

                  </div>
                </div>

                {/* Actions */}
                <div className="at-honeypot-actions">

                  <button
                    type="button"
                    className="at-btn at-btn-primary"
                    onClick={() =>
                      onNavigate(
                        'investigation'
                      )
                    }
                  >
                    <ShieldAlert
                      size={14}
                    />
                    Investigate
                    <ArrowUpRight
                      size={13}
                    />
                  </button>

                  <button
                    type="button"
                    className="at-btn at-btn-secondary"
                    onClick={() =>
                      onNavigate('ioc')
                    }
                  >
                    Add to IOC
                  </button>

                </div>

                {/* Related source search */}
                <button
                  type="button"
                  className="at-honeypot-pivot"
                  onClick={() =>
                    setSearch(
                      selectedEvent.srcIp
                    )
                  }
                >
                  <Globe2 size={13} />

                  Search this source across
                  the event stream

                  <ChevronRight
                    size={13}
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