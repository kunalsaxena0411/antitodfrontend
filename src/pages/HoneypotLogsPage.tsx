import {
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
} from 'react';

import {
  Activity,
  ArrowUpRight,
  ChevronLeft,
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

import type { LogEventV2 } from '../../api/services';
import { dataProvider } from '../services/dataProvider';
import PageHeader from '../components/layout/PageHeader';

interface HoneypotLogsProps {
  onNavigate: (id: string) => void;
}

type Severity = 'critical' | 'high' | 'medium' | 'low';

const SEVERITY_CONFIG: Record<
  Severity,
  {
    label: string;
    short: string;
  }
> = {
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
};

function getSeverity(
  threatScore: number | null | undefined,
): Severity {
  const score = threatScore ?? 0;

  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function formatTimestamp(
  timestamp: string | undefined,
): string {
  if (!timestamp) return 'Unknown';

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatTime(
  timestamp: string | undefined,
): string {
  if (!timestamp) return '—';

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function prettyEventType(
  value: string | undefined,
): string {
  if (!value) return 'Unknown event';

  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

function escapeCsvValue(
  value: unknown,
): string {
  return `"${String(value ?? '').replace(
    /"/g,
    '""',
  )}"`;
}

function downloadFile(
  filename: string,
  content: string,
  mimeType: string,
): void {
  const blob = new Blob([content], {
    type: mimeType,
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  URL.revokeObjectURL(url);
}

function exportEventsToCsv(
  events: LogEventV2[],
): void {
  const headers = [
    'Event ID',
    'Timestamp',
    'Source IP',
    'Destination Port',
    'Event Type',
    'Honeypot',
    'Country',
    'Country Code',
    'ASN',
    'Username',
    'Threat Score',
    'Severity',
    'Command',
  ];

  const rows = events.map((event) => {
    const severity = getSeverity(
      event.threat_score,
    );

    return [
      event.event_id,
      event.timestamp,
      event.src_ip,
      event.dst_port,
      event.event_type,
      event.honeypot,
      event.country,
      event.geo_country,
      event.asn,
      event.username,
      event.threat_score,
      severity,
      event.command,
    ];
  });

  const csv = [
    headers.map(escapeCsvValue).join(','),
    ...rows.map((row) =>
      row.map(escapeCsvValue).join(','),
    ),
  ].join('\n');

  downloadFile(
    `antitode-honeypot-events-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`,
    csv,
    'text/csv;charset=utf-8;',
  );
}

export default function HoneypotLogsPage({
  onNavigate,
}: HoneypotLogsProps) {
  const [events, setEvents] = useState<LogEventV2[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const total = events.length;
  const limit = 100;
  const offset = 0;
  const refresh = () => {};
  const setPage = (page: number) => {};

  useEffect(() => {
    setIsLoadingEvents(true);
    dataProvider.getAttackEvents().then(e => {
      setEvents(e);
      setIsLoadingEvents(false);
    });
  }, []);

  const [search, setSearch] = useState('');
  const [sevFilter, setSevFilter] =
    useState<'ALL' | Severity>('ALL');
  const [honeypotFilter, setHoneypotFilter] =
    useState('ALL');

  const [selectedEventId, setSelectedEventId] =
    useState<string | null>(null);

  const [isRefreshing, setIsRefreshing] =
    useState(false);

  useEffect(() => {
    if (events.length === 0) {
      setSelectedEventId(null);
      return;
    }

    const exists =
      selectedEventId !== null &&
      events.some(
        (event) =>
          event.event_id === selectedEventId,
      );

    if (!exists) {
      setSelectedEventId(
        events[0].event_id,
      );
    }
  }, [events, selectedEventId]);

  const selectedEvent = useMemo(
    () =>
      events.find(
        (event) =>
          event.event_id ===
          selectedEventId,
      ) ?? null,
    [events, selectedEventId],
  );

  const uniqueHoneypots = useMemo(() => {
    return Array.from(
      new Set(
        events
          .map((event) => event.honeypot)
          .filter(Boolean),
      ),
    ).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [events]);

  const filtered = useMemo(() => {
    const normalized =
      search.trim().toLowerCase();

    return events.filter((event) => {
      const searchable = [
        event.src_ip,
        event.event_type,
        event.command,
        event.honeypot,
        event.username,
        event.country,
        event.geo_country,
        event.asn,
        String(event.dst_port ?? ''),
      ];

      const matchesSearch =
        !normalized ||
        searchable.some((value) =>
          value
            ?.toLowerCase()
            .includes(normalized),
        );

      const severity = getSeverity(
        event.threat_score,
      );

      const matchesSeverity =
        sevFilter === 'ALL' ||
        severity === sevFilter;

      const matchesHoneypot =
        honeypotFilter === 'ALL' ||
        event.honeypot === honeypotFilter;

      return (
        matchesSearch &&
        matchesSeverity &&
        matchesHoneypot
      );
    });
  }, [
    events,
    search,
    sevFilter,
    honeypotFilter,
  ]);

  const stats = useMemo(() => {
    const critical = filtered.filter(
      (event) =>
        getSeverity(
          event.threat_score,
        ) === 'critical',
    ).length;

    const high = filtered.filter(
      (event) =>
        getSeverity(
          event.threat_score,
        ) === 'high',
    ).length;

    const medium = filtered.filter(
      (event) =>
        getSeverity(
          event.threat_score,
        ) === 'medium',
    ).length;

    const low = filtered.filter(
      (event) =>
        getSeverity(
          event.threat_score,
        ) === 'low',
    ).length;

    const uniqueSources =
      new Set(
        filtered
          .map((event) => event.src_ip)
          .filter(Boolean),
      ).size;

    const uniqueCountries =
      new Set(
        filtered
          .map(
            (event) =>
              event.country ||
              event.geo_country,
          )
          .filter(Boolean),
      ).size;

    const uniqueTypes =
      new Set(
        filtered
          .map(
            (event) =>
              event.event_type,
          )
          .filter(Boolean),
      ).size;

    return {
      total: filtered.length,
      critical,
      high,
      medium,
      low,
      uniqueSources,
      uniqueCountries,
      uniqueTypes,
    };
  }, [filtered]);

  const currentPage =
    Math.floor(offset / limit) + 1;

  const totalPages = Math.max(
    1,
    Math.ceil(total / limit),
  );

  const hasFilters =
    Boolean(search.trim()) ||
    sevFilter !== 'ALL' ||
    honeypotFilter !== 'ALL';

  const clearFilters = () => {
    setSearch('');
    setSevFilter('ALL');
    setHoneypotFilter('ALL');
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);

    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleEventRowKeyDown = (
    keyboardEvent: KeyboardEvent<HTMLTableRowElement>,
    eventId: string,
  ) => {
    if (
      keyboardEvent.key === 'Enter' ||
      keyboardEvent.key === ' '
    ) {
      keyboardEvent.preventDefault();
      setSelectedEventId(eventId);
    }
  };

  const goToPage = (page: number) => {
    const nextPage = Math.min(
      totalPages,
      Math.max(1, page),
    );

    setPage(
      (nextPage - 1) * limit,
    );
  };

  const selectedSeverity = selectedEvent
    ? getSeverity(
      selectedEvent.threat_score,
    )
    : null;

  return (
    <div className="at-honeypot-page-v2">
      <PageHeader
        breadcrumbs={[
          { label: 'Operations' },
          { label: 'Honeypot Logs' },
        ]}
        title="Honeypot Logs"
        description="Analyze incoming honeypot telemetry, pivot on source indicators, and inspect individual attack events."
        actions={
          <>
            <button
              type="button"
              className="at-btn at-btn-secondary at-btn-sm"
              onClick={handleRefresh}
              disabled={
                isRefreshing ||
                isLoadingEvents
              }
            >
              <RefreshCw
                size={13}
                className={
                  isRefreshing
                    ? 'at-spin'
                    : ''
                }
              />

              {isRefreshing
                ? 'Refreshing'
                : 'Refresh'}
            </button>

            <button
              type="button"
              className="at-btn at-btn-secondary at-btn-sm"
              disabled={
                filtered.length === 0
              }
              onClick={() =>
                exportEventsToCsv(filtered)
              }
            >
              <Download size={13} />
              Export CSV
            </button>
          </>
        }
        filters={
          <div className="at-hp-toolbar">
            <div className="at-hp-search">
              <Search size={14} />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search IPs, commands, event types, honeypots..."
                aria-label="Search honeypot events"
                spellCheck={false}
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

            <label className="at-hp-filter">
              <span>SEVERITY</span>

              <select
                value={sevFilter}
                onChange={(event) =>
                  setSevFilter(
                    event.target
                      .value as
                    | 'ALL'
                    | Severity,
                  )
                }
              >
                <option value="ALL">
                  All severities
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

            <label className="at-hp-filter">
              <span>HONEYPOT</span>

              <select
                value={honeypotFilter}
                onChange={(event) =>
                  setHoneypotFilter(
                    event.target.value,
                  )
                }
              >
                <option value="ALL">
                  All honeypots
                </option>

                {uniqueHoneypots.map(
                  (honeypot) => (
                    <option
                      key={honeypot}
                      value={honeypot}
                    >
                      {honeypot}
                    </option>
                  ),
                )}
              </select>
            </label>

            {hasFilters && (
              <button
                type="button"
                className="at-hp-clear"
                onClick={clearFilters}
              >
                <CircleX size={13} />
                Clear
              </button>
            )}
          </div>
        }
      />

      <div className="at-honeypot-page-scroll custom-scrollbar">
        <div className="at-honeypot-page-content">

          {/* ===============================================================
              Analytics strip
             =============================================================== */}

          <section className="at-hp-summary">
            <div className="at-hp-summary-card">
              <div>
                <span>VISIBLE EVENTS</span>
                <Activity size={15} />
              </div>

              <strong>
                {stats.total.toLocaleString()}
              </strong>

              <small>
                Current filtered result set
              </small>
            </div>

            <div className="at-hp-summary-card danger">
              <div>
                <span>CRITICAL</span>
                <ShieldAlert size={15} />
              </div>

              <strong>
                {stats.critical.toLocaleString()}
              </strong>

              <small>
                Immediate review priority
              </small>
            </div>

            <div className="at-hp-summary-card">
              <div>
                <span>UNIQUE SOURCES</span>
                <Globe2 size={15} />
              </div>

              <strong>
                {stats.uniqueSources.toLocaleString()}
              </strong>

              <small>
                Distinct source IPs
              </small>
            </div>

            <div className="at-hp-summary-card">
              <div>
                <span>COUNTRIES</span>
                <Globe2 size={15} />
              </div>

              <strong>
                {stats.uniqueCountries.toLocaleString()}
              </strong>

              <small>
                Enriched source origins
              </small>
            </div>

            <div className="at-hp-summary-card">
              <div>
                <span>EVENT TYPES</span>
                <Command size={15} />
              </div>

              <strong>
                {stats.uniqueTypes.toLocaleString()}
              </strong>

              <small>
                Distinct attack signatures
              </small>
            </div>
          </section>

          {/* ===============================================================
              Workspace
             =============================================================== */}

          <section className="at-hp-workspace">

            {/* Event stream */}

            <div className="at-hp-stream-panel">
              <div className="at-hp-stream-header">
                <div>
                  <span className="at-eyebrow">
                    EVENT STREAM
                  </span>

                  <div className="at-hp-stream-title-row">
                    <h2>
                      Incoming honeypot activity
                    </h2>

                    <span
                      className={`at-hp-live-state ${isLoadingEvents
                          ? 'loading'
                          : events.length > 0
                            ? 'active'
                            : 'idle'
                        }`}
                    >
                      <i />

                      {isLoadingEvents
                        ? 'SYNCING'
                        : events.length > 0
                          ? 'LIVE'
                          : 'STANDBY'}
                    </span>
                  </div>
                </div>

                <span className="at-hp-record-count">
                  {total.toLocaleString()} records
                </span>
              </div>

              <div className="at-hp-table-wrap">
                <table className="at-hp-table">
                  <thead>
                    <tr>
                      <th>TIME</th>
                      <th>SOURCE</th>
                      <th>EVENT</th>
                      <th>HONEYPOT</th>
                      <th>ORIGIN</th>
                      <th>SCORE</th>
                      <th>SEVERITY</th>
                      <th />
                    </tr>
                  </thead>

                  <tbody>
                    {isLoadingEvents &&
                      events.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="at-hp-empty"
                        >
                          <RefreshCw
                            size={20}
                            className="at-spin"
                          />

                          <strong>
                            Loading telemetry
                          </strong>

                          <span>
                            Fetching the latest
                            honeypot event stream.
                          </span>
                        </td>
                      </tr>
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="at-hp-empty"
                        >
                          <ShieldAlert size={20} />

                          <strong>
                            No events match the
                            current filters
                          </strong>

                          <span>
                            Try changing the
                            search or severity
                            filters.
                          </span>

                          {hasFilters && (
                            <button
                              type="button"
                              onClick={clearFilters}
                            >
                              Clear all filters
                            </button>
                          )}
                        </td>
                      </tr>
                    ) : (
                      filtered.map((event) => {
                        const severity =
                          getSeverity(
                            event.threat_score,
                          );

                        const active =
                          selectedEventId ===
                          event.event_id;

                        return (
                          <tr
                            key={event.event_id}
                            className={
                              active
                                ? 'active'
                                : ''
                            }
                            tabIndex={0}
                            aria-selected={active}
                            onClick={() =>
                              setSelectedEventId(
                                event.event_id,
                              )
                            }
                            onKeyDown={(
                              keyboardEvent,
                            ) =>
                              handleEventRowKeyDown(
                                keyboardEvent,
                                event.event_id,
                              )
                            }
                          >
                            <td>
                              <div className="at-hp-time-cell">
                                <strong>
                                  {formatTime(
                                    event.timestamp,
                                  )}
                                </strong>

                                <span>
                                  {new Date(
                                    event.timestamp,
                                  ).toLocaleDateString(
                                    'en-US',
                                    {
                                      month: 'short',
                                      day: 'numeric',
                                    },
                                  )}
                                </span>
                              </div>
                            </td>

                            <td>
                              <button
                                type="button"
                                className="at-hp-source"
                                onClick={(clickEvent) => {
                                  clickEvent.stopPropagation();

                                  setSearch(
                                    event.src_ip,
                                  );
                                }}
                              >
                                {event.src_ip}
                              </button>

                              {event.src_port && (
                                <span className="at-hp-subvalue">
                                  Source port {event.src_port}
                                </span>
                              )}
                            </td>

                            <td>
                              <div className="at-hp-event-cell">
                                <strong>
                                  {prettyEventType(
                                    event.event_type,
                                  )}
                                </strong>

                                <span>
                                  {event.dst_port
                                    ? `Destination ${event.dst_port}`
                                    : event.protocol ||
                                    'Telemetry event'}
                                </span>
                              </div>
                            </td>

                            <td>
                              <span className="at-hp-honeypot-pill">
                                {event.honeypot ||
                                  'Unknown'}
                              </span>
                            </td>

                            <td>
                              <div className="at-hp-origin-cell">
                                <strong>
                                  {event.country ||
                                    event.geo_country ||
                                    'Unknown'}
                                </strong>

                                {event.asn && (
                                  <span>
                                    {event.asn}
                                  </span>
                                )}
                              </div>
                            </td>

                            <td>
                              <div className="at-hp-score">
                                <strong>
                                  {event.threat_score ??
                                    '—'}
                                </strong>

                                {event.threat_score !==
                                  undefined && (
                                    <span>
                                      <i
                                        className={
                                          severity
                                        }
                                        style={{
                                          width: `${Math.min(
                                            100,
                                            Math.max(
                                              0,
                                              event.threat_score,
                                            ),
                                          )}%`,
                                        }}
                                      />
                                    </span>
                                  )}
                              </div>
                            </td>

                            <td>
                              <span
                                className={`at-hp-severity ${severity}`}
                              >
                                <i />
                                {
                                  SEVERITY_CONFIG[
                                    severity
                                  ].short
                                }
                              </span>
                            </td>

                            <td>
                              <ChevronRight
                                size={14}
                                className="at-hp-row-arrow"
                              />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <footer className="at-hp-table-footer">
                <div>
                  Showing{' '}
                  <strong>
                    {filtered.length}
                  </strong>{' '}
                  visible events
                </div>

                <div className="at-hp-pagination">
                  <button
                    type="button"
                    onClick={() =>
                      goToPage(
                        currentPage - 1,
                      )
                    }
                    disabled={
                      currentPage <= 1
                    }
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={13} />
                  </button>

                  <span>
                    Page{' '}
                    <strong>
                      {currentPage}
                    </strong>{' '}
                    of{' '}
                    <strong>
                      {totalPages}
                    </strong>
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      goToPage(
                        currentPage + 1,
                      )
                    }
                    disabled={
                      currentPage >=
                      totalPages
                    }
                    aria-label="Next page"
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
              </footer>
            </div>

            {/* Inspector */}

            <aside className="at-hp-inspector">
              {!selectedEvent ? (
                <div className="at-hp-inspector-empty">
                  <Server size={24} />

                  <strong>
                    Select an event
                  </strong>

                  <span>
                    Event details and
                    investigation actions will
                    appear here.
                  </span>
                </div>
              ) : (
                <>
                  <div className="at-hp-inspector-header">
                    <div>
                      <span className="at-eyebrow">
                        EVENT DETAIL
                      </span>

                      <h2>
                        {prettyEventType(
                          selectedEvent.event_type,
                        )}
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setSelectedEventId(null)
                      }
                      aria-label="Close event detail"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  <div className="at-hp-inspector-body">

                    <section className="at-hp-identity">
                      <div className="at-hp-identity-top">
                        <span
                          className={`at-hp-severity large ${selectedSeverity
                            }`}
                        >
                          <i />
                          {
                            SEVERITY_CONFIG[
                              selectedSeverity!
                            ].label
                          }
                        </span>

                        <span className="at-hp-event-time">
                          <Clock3 size={11} />
                          {formatTimestamp(
                            selectedEvent.timestamp,
                          )}
                        </span>
                      </div>

                      <span className="at-hp-label">
                        SOURCE IP
                      </span>

                      <button
                        type="button"
                        className="at-hp-source-ip"
                        onClick={() =>
                          setSearch(
                            selectedEvent.src_ip,
                          )
                        }
                      >
                        {selectedEvent.src_ip}
                      </button>

                      <div className="at-hp-score-large">
                        <span>
                          Threat score
                        </span>

                        <strong>
                          {selectedEvent.threat_score ??
                            0}
                        </strong>
                      </div>
                    </section>

                    <section className="at-hp-detail-section">
                      <div className="at-hp-section-heading">
                        <span>
                          CONNECTION
                        </span>
                        <Command size={12} />
                      </div>

                      <div className="at-hp-detail-grid">
                        <div>
                          <span>
                            Honeypot
                          </span>
                          <strong>
                            {selectedEvent.honeypot ||
                              '—'}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Destination port
                          </span>
                          <code>
                            {selectedEvent.dst_port ??
                              '—'}
                          </code>
                        </div>

                        <div>
                          <span>
                            Protocol
                          </span>
                          <strong>
                            {selectedEvent.protocol ||
                              selectedEvent.transport ||
                              '—'}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Country
                          </span>
                          <strong>
                            {selectedEvent.country ||
                              selectedEvent.geo_country ||
                              '—'}
                          </strong>
                        </div>

                        <div>
                          <span>
                            ASN
                          </span>
                          <code>
                            {selectedEvent.asn ||
                              selectedEvent.asn_org ||
                              '—'}
                          </code>
                        </div>

                        <div>
                          <span>
                            Username
                          </span>
                          <code>
                            {selectedEvent.username ||
                              '—'}
                          </code>
                        </div>
                      </div>
                    </section>

                    {selectedEvent.command && (
                      <section className="at-hp-detail-section">
                        <div className="at-hp-section-heading">
                          <span>
                            COMMAND CAPTURED
                          </span>
                          <TerminalSquare size={12} />
                        </div>

                        <div className="at-hp-command">
                          <div>
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
                      </section>
                    )}

                    <section className="at-hp-detail-section">
                      <div className="at-hp-section-heading">
                        <span>
                          EVENT CONTEXT
                        </span>
                        <Activity size={12} />
                      </div>

                      <div className="at-hp-context">
                        <div>
                          <span>
                            Event ID
                          </span>
                          <code>
                            {selectedEvent.event_id}
                          </code>
                        </div>

                        <div>
                          <span>
                            Event type
                          </span>
                          <strong>
                            {selectedEvent.event_type}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Observed
                          </span>
                          <code>
                            {formatTimestamp(
                              selectedEvent.timestamp,
                            )}
                          </code>
                        </div>
                      </div>
                    </section>

                    <section className="at-hp-actions">
                      <button
                        type="button"
                        className="at-btn at-btn-primary"
                        onClick={() =>
                          onNavigate(
                            'investigate',
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
                          onNavigate('iocs')
                        }
                      >
                        Add to IOC
                      </button>
                    </section>

                    <button
                      type="button"
                      className="at-hp-pivot"
                      onClick={() =>
                        setSearch(
                          selectedEvent.src_ip,
                        )
                      }
                    >
                      <Globe2 size={13} />

                      Search this source across
                      telemetry

                      <ChevronRight size={13} />
                    </button>

                    <button
                      type="button"
                      className="at-hp-pivot"
                      onClick={() =>
                        onNavigate(
                          'investigate',
                        )
                      }
                    >
                      <Server size={13} />

                      Open investigation workspace

                      <ChevronRight size={13} />
                    </button>
                  </div>
                </>
              )}
            </aside>
          </section>
        </div>
      </div>
    </div>
  );
}