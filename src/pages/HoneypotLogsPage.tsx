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

import {
  useHoneypotData,
} from '../../hooks/useHoneypotData';

import PageHeader from '../components/layout/PageHeader';

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

interface HoneypotLogsProps {
  onNavigate: (id: string) => void;
}

type Severity =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low';

/* -------------------------------------------------------------------------- */
/*                                  Constants                                 */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

function getSeverity(
  threatScore: number | null | undefined,
): Severity {
  const score = threatScore ?? 0;

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

function formatTimestamp(
  timestamp: string | undefined,
): string {
  if (!timestamp) {
    return 'Unknown';
  }

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
  if (!timestamp) {
    return '—';
  }

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
  if (!value) {
    return 'Unknown event';
  }

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
  const anchor =
    document.createElement('a');

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
    const eventWithOptionalData =
      event as LogEventV2 & {
        country?: string;
        countryCode?: string;
        asn?: string;
      };

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
      eventWithOptionalData.country,
      eventWithOptionalData.countryCode,
      eventWithOptionalData.asn,
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

/* -------------------------------------------------------------------------- */
/*                              Page component                                */
/* -------------------------------------------------------------------------- */

export default function HoneypotLogsPage({
  onNavigate,
}: HoneypotLogsProps) {
  const {
    events: rawEvents,
    isLoadingEvents,
    refresh,
    offset,
    limit,
    total,
    setPage,
  } = useHoneypotData({
    limit: 100,
    offset: 0,
  });

  const events = rawEvents ?? [];

  /* ------------------------------------------------------------------------ */
  /*                                  State                                   */
  /* ------------------------------------------------------------------------ */

  const [search, setSearch] = useState('');
  const [sevFilter, setSevFilter] =
    useState<'ALL' | Severity>('ALL');
  const [honeypotFilter, setHoneypotFilter] =
    useState('ALL');

  const [selectedEventId, setSelectedEventId] =
    useState<string | null>(
      events[0]?.event_id ?? null,
    );

  const [isRefreshing, setIsRefreshing] =
    useState(false);

  /* ------------------------------------------------------------------------ */
  /*                         Synchronize selection                            */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (events.length === 0) {
      setSelectedEventId(null);
      return;
    }

    const selectedStillExists =
      selectedEventId !== null &&
      events.some(
        (event) =>
          event.event_id === selectedEventId,
      );

    if (!selectedStillExists) {
      setSelectedEventId(
        events[0].event_id,
      );
    }
  }, [events, selectedEventId]);

  /* ------------------------------------------------------------------------ */
  /*                             Selected event                               */
  /* ------------------------------------------------------------------------ */

  const selectedEvent = useMemo(
    () =>
      events.find(
        (event) =>
          event.event_id ===
          selectedEventId,
      ) ?? null,
    [events, selectedEventId],
  );

  /* ------------------------------------------------------------------------ */
  /*                          Filter options                                  */
  /* ------------------------------------------------------------------------ */

  const uniqueHoneypots = useMemo(() => {
    return Array.from(
      new Set(
        events
          .map(
            (event) => event.honeypot,
          )
          .filter(Boolean),
      ),
    ).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [events]);

  /* ------------------------------------------------------------------------ */
  /*                           Filtered events                                */
  /* ------------------------------------------------------------------------ */

  const filtered = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    return events.filter((event) => {
      const eventWithOptionalData =
        event as LogEventV2 & {
          country?: string;
          countryCode?: string;
          asn?: string;
        };

      const searchableValues = [
        event.src_ip,
        event.event_type,
        event.command,
        event.honeypot,
        event.username,
        eventWithOptionalData.country,
        eventWithOptionalData.countryCode,
        eventWithOptionalData.asn,
        String(event.dst_port ?? ''),
      ];

      const matchesSearch =
        !normalizedSearch ||
        searchableValues.some((value) =>
          value
            ? value
              .toLowerCase()
              .includes(
                normalizedSearch,
              )
            : false,
        );

      const severity = getSeverity(
        event.threat_score,
      );

      const matchesSeverity =
        sevFilter === 'ALL' ||
        severity === sevFilter;

      const matchesHoneypot =
        honeypotFilter === 'ALL' ||
        event.honeypot ===
        honeypotFilter;

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

  /* ------------------------------------------------------------------------ */
  /*                               Statistics                                 */
  /* ------------------------------------------------------------------------ */

  const stats = useMemo(() => {
    const critical = filtered.filter(
      (event) =>
        getSeverity(event.threat_score) ===
        'critical',
    ).length;

    const high = filtered.filter(
      (event) =>
        getSeverity(event.threat_score) ===
        'high',
    ).length;

    const medium = filtered.filter(
      (event) =>
        getSeverity(event.threat_score) ===
        'medium',
    ).length;

    const low = filtered.filter(
      (event) =>
        getSeverity(event.threat_score) ===
        'low',
    ).length;

    const uniqueSources =
      new Set(
        filtered
          .map((event) => event.src_ip)
          .filter(Boolean),
      ).size;

    return {
      total: filtered.length,
      critical,
      high,
      medium,
      low,
      uniqueSources,
    };
  }, [filtered]);

  /* ------------------------------------------------------------------------ */
  /*                            Pagination                                    */
  /* ------------------------------------------------------------------------ */

  const currentPage =
    Math.floor(offset / limit) + 1;

  const totalPages = Math.max(
    1,
    Math.ceil(total / limit),
  );

  const canGoPrevious =
    currentPage > 1;

  const canGoNext =
    currentPage < totalPages;

  const goToPage = (
    page: number,
  ) => {
    const nextPage = Math.min(
      totalPages,
      Math.max(1, page),
    );

    setPage(
      (nextPage - 1) * limit,
    );
  };

  /* ------------------------------------------------------------------------ */
  /*                               Filters                                    */
  /* ------------------------------------------------------------------------ */

  const clearFilters = () => {
    setSearch('');
    setSevFilter('ALL');
    setHoneypotFilter('ALL');
  };

  const hasFilters =
    Boolean(search.trim()) ||
    sevFilter !== 'ALL' ||
    honeypotFilter !== 'ALL';

  /* ------------------------------------------------------------------------ */
  /*                                Refresh                                   */
  /* ------------------------------------------------------------------------ */

  const handleRefresh = async () => {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);

    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /*                                 Export                                   */
  /* ------------------------------------------------------------------------ */

  const handleExport = () => {
    exportEventsToCsv(filtered);
  };

  /* ------------------------------------------------------------------------ */
  /*                            Keyboard access                               */
  /* ------------------------------------------------------------------------ */

  const handleEventRowKeyDown = (
    event: KeyboardEvent<HTMLTableRowElement>,
    eventId: string,
  ) => {
    if (
      event.key === 'Enter' ||
      event.key === ' '
    ) {
      event.preventDefault();
      setSelectedEventId(eventId);
    }
  };

  /* ------------------------------------------------------------------------ */
  /*                                  Render                                  */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="at-honeypot-page">
      {/* ================================================================== */
      /* PAGE HEADER                                                         */
      /* ================================================================== */}

      <PageHeader
        breadcrumbs={[
          { label: 'Operations' },
          { label: 'Honeypot Logs' },
        ]}
        title="Honeypot Logs"
        description={`${stats.total.toLocaleString()} visible ${stats.total === 1
            ? 'event'
            : 'events'
          } · ${stats.uniqueSources.toLocaleString()} unique sources`}
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
              onClick={handleExport}
              disabled={
                filtered.length === 0
              }
              title={`Export ${filtered.length} visible events`}
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
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search IPs, commands, event types..."
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

            {/* Severity */}

            <label className="at-honeypot-select-wrap">
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
                className="at-honeypot-select"
                aria-label="Filter by severity"
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
                    event.target.value,
                  )
                }
                className="at-honeypot-select"
                aria-label="Filter by honeypot"
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
                  ),
                )}
              </select>
            </label>

            {hasFilters && (
              <button
                type="button"
                className="at-honeypot-clear"
                onClick={clearFilters}
              >
                <CircleX size={13} />
                Clear
              </button>
            )}

            <div className="at-honeypot-filter-spacer" />

            {/* Severity telemetry */}

            <div className="at-honeypot-telemetry">
              <span>
                <i className="critical" />
                {stats.critical}
                <small>critical</small>
              </span>

              <span>
                <i className="high" />
                {stats.high}
                <small>high</small>
              </span>
            </div>
          </div>
        }
      />

      {/* ================================================================== */
      /* WORKSPACE                                                           */
      /* ================================================================== */}

      <div className="at-honeypot-workspace">
        {/* ================================================================ */
        /* EVENT STREAM                                                      */
        /* ================================================================ */}

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

            <div
              className={`at-honeypot-live ${isLoadingEvents
                  ? 'loading'
                  : events.length > 0
                    ? 'active'
                    : 'idle'
                }`}
            >
              <span />

              {isLoadingEvents
                ? 'SYNCING'
                : events.length > 0
                  ? 'LIVE'
                  : 'STANDBY'}
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
                {isLoadingEvents &&
                  events.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="at-honeypot-empty"
                    >
                      <RefreshCw
                        size={20}
                        className="at-spin"
                      />

                      <strong>
                        Loading honeypot
                        telemetry
                      </strong>

                      <span>
                        Fetching the latest
                        event stream.
                      </span>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="at-honeypot-empty"
                    >
                      <ShieldAlert
                        size={20}
                      />

                      <strong>
                        No events match the
                        current filters
                      </strong>

                      <span>
                        Adjust the search or
                        severity filters to
                        continue.
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
                  filtered.map((event) => {
                    const severity =
                      getSeverity(
                        event.threat_score,
                      );

                    const active =
                      selectedEventId ===
                      event.event_id;

                    const eventWithOptionalData =
                      event as LogEventV2 & {
                        country?: string;
                        countryCode?: string;
                      };

                    return (
                      <tr
                        key={
                          event.event_id
                        }
                        className={
                          active
                            ? 'active'
                            : ''
                        }
                        tabIndex={0}
                        aria-selected={
                          active
                        }
                        onClick={() =>
                          setSelectedEventId(
                            event.event_id,
                          )
                        }
                        onKeyDown={(keyboardEvent) =>
                          handleEventRowKeyDown(
                            keyboardEvent,
                            event.event_id,
                          )
                        }
                      >
                        <td>
                          <span className="at-honeypot-time">
                            {formatTime(
                              event.timestamp,
                            )}
                          </span>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="at-honeypot-ip"
                            onClick={(
                              clickEvent,
                            ) => {
                              clickEvent.stopPropagation();

                              setSearch(
                                event.src_ip,
                              );
                            }}
                          >
                            {event.src_ip}
                          </button>
                        </td>

                        <td>
                          <code className="at-honeypot-port">
                            {event.dst_port ??
                              '—'}
                          </code>
                        </td>

                        <td>
                          <span className="at-honeypot-event-type">
                            {prettyEventType(
                              event.event_type,
                            )}
                          </span>
                        </td>

                        <td>
                          <span className="at-honeypot-honeypot">
                            {event.honeypot ||
                              '—'}
                          </span>
                        </td>

                        <td>
                          <span className="at-honeypot-country">
                            {eventWithOptionalData.country ||
                              '—'}
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
                            className={`at-honeypot-severity ${severity}`}
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
                            size={13}
                            className="at-honeypot-row-arrow"
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

          <footer className="at-honeypot-stream-footer">
            <span>
              Showing{' '}
              <strong>
                {filtered.length}
              </strong>{' '}
              visible events
            </span>

            <span>
              {total.toLocaleString()} total
              records
            </span>

            <div className="at-honeypot-pagination">
              <button
                type="button"
                className="at-btn at-btn-ghost at-btn-sm"
                onClick={() =>
                  goToPage(
                    currentPage - 1,
                  )
                }
                disabled={
                  !canGoPrevious
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
                className="at-btn at-btn-ghost at-btn-sm"
                onClick={() =>
                  goToPage(
                    currentPage + 1,
                  )
                }
                disabled={!canGoNext}
                aria-label="Next page"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </footer>
        </section>

        {/* ================================================================ */
        /* DETAIL INSPECTOR                                                  */
        /* ================================================================ */}

        <aside className="at-honeypot-inspector">
          {!selectedEvent ? (
            <div className="at-honeypot-inspector-empty">
              <Server size={24} />

              <strong>
                Select an event
              </strong>

              <span>
                Event details and available
                actions will appear here.
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
                      selectedEvent.event_type,
                    )}
                  </h2>
                </div>

                <button
                  type="button"
                  className="at-honeypot-close"
                  onClick={() =>
                    setSelectedEventId(
                      null,
                    )
                  }
                  aria-label="Close event detail"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="at-honeypot-inspector-body">
                {/* ======================================================== */
                /* Threat identity                                             */
                /* ======================================================== */}

                <div className="at-honeypot-identity">
                  <div className="at-honeypot-identity-top">
                    <span
                      className={`at-honeypot-severity large ${getSeverity(
                        selectedEvent.threat_score,
                      )}`}
                    >
                      <i />

                      {
                        SEVERITY_CONFIG[
                          getSeverity(
                            selectedEvent.threat_score,
                          )
                        ].label
                      }
                    </span>

                    <span className="at-honeypot-event-time">
                      <Clock3 size={11} />

                      {formatTimestamp(
                        selectedEvent.timestamp,
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
                        selectedEvent.src_ip,
                      )
                    }
                  >
                    {selectedEvent.src_ip}
                  </button>

                  <span className="at-honeypot-threat-score">
                    Threat score:{' '}
                    <strong>
                      {selectedEvent.threat_score ??
                        0}
                    </strong>
                  </span>
                </div>

                {/* ======================================================== */
                /* Connection                                                 */
                /* ======================================================== */}

                <div className="at-honeypot-section">
                  <div className="at-honeypot-section-title">
                    <span>
                      CONNECTION
                    </span>

                    <Command size={12} />
                  </div>

                  {(() => {
                    const eventWithOptionalData =
                      selectedEvent as LogEventV2 & {
                        country?: string;
                        countryCode?: string;
                        asn?: string;
                      };

                    return (
                      <div className="at-honeypot-detail-grid">
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
                            {eventWithOptionalData.country ||
                              '—'}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Country code
                          </span>

                          <code>
                            {eventWithOptionalData.countryCode ||
                              '—'}
                          </code>
                        </div>

                        <div>
                          <span>ASN</span>

                          <code>
                            {eventWithOptionalData.asn ||
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
                    );
                  })()}
                </div>

                {/* ======================================================== */
                  /* Command                                                    */
                  /* ======================================================== */}

                  {
                    selectedEvent.command && (
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
                            {
                              selectedEvent.command
                            }
                          </code>
                        </div>
                      </div>
                    )
                  }

                {/* ======================================================== */
                  /* Event context                                             */
                  /* ======================================================== */}

                  <div className="at-honeypot-section">
                    <div className="at-honeypot-section-title">
                      <span>
                        EVENT CONTEXT
                      </span>

                      <Activity size={12} />
                    </div>

                    <div className="at-honeypot-event-context">
                      <div>
                        <span>Event ID</span>

                        <code>
                          {
                            selectedEvent.event_id
                          }
                        </code>
                      </div>

                      <div>
                        <span>
                          Event type
                        </span>

                        <strong>
                          {
                            selectedEvent.event_type
                          }
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
                  </div>

                {/* ======================================================== */
                  /* Actions                                                    */
                  /* ======================================================== */}

                  <div className="at-honeypot-actions">
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
                  </div>

                {/* ======================================================== */
                /* Investigation pivots                                      */
                /* ======================================================== */}

                <button
                  type="button"
                  className="at-honeypot-pivot"
                  onClick={() =>
                    setSearch(
                      selectedEvent.src_ip,
                    )
                  }
                >
                  <Globe2 size={13} />

                  Search this source across
                  the event stream

                  <ChevronRight size={13} />
                </button>

                <button
                  type="button"
                  className="at-honeypot-pivot"
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
      </div>
    </div>
  );
}