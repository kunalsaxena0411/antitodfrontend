import {
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
} from 'react';

import {
  Activity,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  CircleX,
  Download,
  ExternalLink,
  Globe,
  Hash,
  Link2,
  Network,
  Plus,
  Search,
  Server,
  ShieldAlert,
  Target,
  TerminalSquare,
  X,
} from 'lucide-react';

import { dataProvider } from '../services/dataProvider';
import { useAppData } from '../contexts/AppDataContext';
import PageHeader from '../components/layout/PageHeader';

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

type IocType =
  | 'ip'
  | 'domain'
  | 'hash'
  | 'url';

type IocSeverity =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | string;

type InspectorTab =
  | 'Overview'
  | 'Timeline'
  | 'Relationships';

interface IocRecord {
  id: string;
  type: IocType | string;
  value: string;
  source: string;
  severity: IocSeverity;
  firstSeen?: string;
  lastSeen?: string;
  tags: string[];
}

interface ParsedAdvancedQuery {
  text: string;
  type?: IocType;
  severity?: IocSeverity;
  source?: string;
  tag?: string;
}

interface StixIndicator {
  type: 'indicator';
  spec_version: '2.1';
  id: string;
  created: string;
  modified: string;
  pattern: string;
  pattern_type: 'stix';
  valid_from: string;
  labels: string[];
  name: string;
  description: string;
  external_references: Array<{
    source_name: string;
    external_id: string;
  }>;
}

/* -------------------------------------------------------------------------- */
/*                              Type metadata                                 */
/* -------------------------------------------------------------------------- */

const TYPE_ICONS = {
  ip: Server,
  domain: Globe,
  hash: Hash,
  url: Link2,
} as const;

const TYPE_LABELS = {
  ip: 'IP ADDRESS',
  domain: 'DOMAIN',
  hash: 'HASH',
  url: 'URL',
} as const;

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

function normalizeIoc(
  value: unknown,
): IocRecord | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const source = value as Partial<IocRecord>;

  if (
    typeof source.id !== 'string' ||
    typeof source.value !== 'string'
  ) {
    return null;
  }

  const normalizedType =
    typeof source.type === 'string'
      ? source.type.toLowerCase()
      : 'unknown';

  const severity =
    typeof source.severity === 'string'
      ? source.severity.toLowerCase()
      : 'low';

  return {
    id: source.id,
    type: normalizedType,
    value: source.value,
    source:
      typeof source.source === 'string'
        ? source.source
        : 'Unknown',
    severity,
    firstSeen:
      typeof source.firstSeen === 'string'
        ? source.firstSeen
        : undefined,
    lastSeen:
      typeof source.lastSeen === 'string'
        ? source.lastSeen
        : undefined,
    tags: Array.isArray(source.tags)
      ? source.tags.filter(
        (tag): tag is string =>
          typeof tag === 'string',
      )
      : [],
  };
}

function formatDate(
  value: string | undefined,
): string {
  if (!value) {
    return 'Unknown';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

function formatDateTime(
  value: string | undefined,
): string {
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

function severityClass(
  severity: IocSeverity,
): string {
  return String(severity).toLowerCase();
}

function typeLabel(
  type: string,
): string {
  if (
    type in TYPE_LABELS
  ) {
    return TYPE_LABELS[
      type as keyof typeof TYPE_LABELS
    ];
  }

  return type
    .replace(/[_-]/g, ' ')
    .toUpperCase();
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

function escapeStixValue(
  value: string,
): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
}

function buildStixPattern(
  ioc: IocRecord,
): string {
  const value = escapeStixValue(
    ioc.value,
  );

  switch (ioc.type) {
    case 'ip':
      return `[ipv4-addr:value = '${value}']`;

    case 'domain':
      return `[domain-name:value = '${value}']`;

    case 'hash':
      return `[file:hashes.MD5 = '${value}']`;

    case 'url':
      return `[url:value = '${value}']`;

    default:
      return `[artifact:mime_type = '${value}']`;
  }
}

function buildStixIndicator(
  ioc: IocRecord,
): StixIndicator {
  const now =
    new Date().toISOString();

  const stableId =
    `indicator--${crypto.randomUUID()}`;

  return {
    type: 'indicator',
    spec_version: '2.1',
    id: stableId,
    created: now,
    modified: now,
    pattern: buildStixPattern(ioc),
    pattern_type: 'stix',
    valid_from:
      ioc.firstSeen ||
      now,
    labels: [
      ioc.severity,
      ...ioc.tags,
    ].filter(Boolean),
    name: `${typeLabel(ioc.type)} — ${ioc.value}`,
    description: `ANTITODE IOC exported from ${ioc.source}.`,
    external_references: [
      {
        source_name:
          'ANTITODE',
        external_id: ioc.id,
      },
    ],
  };
}

function parseAdvancedQuery(
  input: string,
): ParsedAdvancedQuery {
  const tokens = input
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const textTokens: string[] = [];

  let type:
    | IocType
    | undefined;

  let severity:
    | IocSeverity
    | undefined;

  let source: string | undefined;
  let tag: string | undefined;

  for (const token of tokens) {
    const separator =
      token.indexOf(':');

    if (separator <= 0) {
      textTokens.push(token);
      continue;
    }

    const key = token
      .slice(0, separator)
      .toLowerCase();

    const rawValue = token
      .slice(separator + 1)
      .trim();

    const value =
      rawValue.toLowerCase();

    if (!rawValue) {
      continue;
    }

    if (
      key === 'type' &&
      ['ip', 'domain', 'hash', 'url'].includes(
        value,
      )
    ) {
      type = value as IocType;
      continue;
    }

    if (
      key === 'severity'
    ) {
      severity = value;
      continue;
    }

    if (key === 'source') {
      source = rawValue;
      continue;
    }

    if (key === 'tag') {
      tag = rawValue;
      continue;
    }

    textTokens.push(token);
  }

  return {
    text: textTokens.join(' '),
    type,
    severity,
    source,
    tag,
  };
}

/* -------------------------------------------------------------------------- */
/*                               IOC Page                                     */
/* -------------------------------------------------------------------------- */

export default function IocPage() {
  const { MOCK_IOCS, onNavigate } =
    useAppData();

  /* ------------------------------------------------------------------------ */
  /*                          Normalize source data                           */
  /* ------------------------------------------------------------------------ */

  const iocs = useMemo<IocRecord[]>(
    () =>
      MOCK_IOCS.map(normalizeIoc).filter(
        (ioc): ioc is IocRecord =>
          ioc !== null,
      ),
    [MOCK_IOCS],
  );

  /* ------------------------------------------------------------------------ */
  /*                                  State                                   */
  /* ------------------------------------------------------------------------ */

  const [search, setSearch] =
    useState('');

  const [
    advancedMode,
    setAdvancedMode,
  ] = useState(false);

  const [
    severityFilter,
    setSeverityFilter,
  ] = useState<IocSeverity | 'ALL'>(
    'ALL',
  );

  const [
    typeFilter,
    setTypeFilter,
  ] = useState<IocType | 'ALL'>(
    'ALL',
  );

  const [
    sourceFilter,
    setSourceFilter,
  ] = useState('');

  const [
    selectedIocId,
    setSelectedIocId,
  ] = useState<string | null>(null);

  const [
    inspectorTab,
    setInspectorTab,
  ] = useState<InspectorTab>(
    'Overview',
  );

  const [
    showFilters,
    setShowFilters,
  ] = useState(false);

  const [
    addIocNotice,
    setAddIocNotice,
  ] = useState('');

  const [
    currentPage,
    setCurrentPage,
  ] = useState(1);

  const ITEMS_PER_PAGE = 100;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, typeFilter, severityFilter, sourceFilter, advancedMode]);

  /* ------------------------------------------------------------------------ */
  /*                       Synchronize inspector                              */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (iocs.length === 0) {
      setSelectedIocId(null);
      return;
    }

    if (
      selectedIocId &&
      iocs.some(
        (ioc) =>
          ioc.id ===
          selectedIocId,
      )
    ) {
      return;
    }

    setSelectedIocId(
      iocs[0]?.id ?? null,
    );
  }, [iocs, selectedIocId]);

  /* ------------------------------------------------------------------------ */
  /*                            Selected IOC                                  */
  /* ------------------------------------------------------------------------ */

  const selectedIoc = useMemo(
    () =>
      iocs.find(
        (ioc) =>
          ioc.id ===
          selectedIocId,
      ) ?? null,
    [iocs, selectedIocId],
  );

  /* ------------------------------------------------------------------------ */
  /*                         Filter options                                  */
  /* ------------------------------------------------------------------------ */

  const sourceOptions =
    useMemo(
      () =>
        Array.from(
          new Set(
            iocs
              .map(
                (ioc) =>
                  ioc.source,
              )
              .filter(Boolean),
          ),
        ).sort((a, b) =>
          a.localeCompare(b),
        ),
      [iocs],
    );

  /* ------------------------------------------------------------------------ */
  /*                          Advanced query                                 */
  /* ------------------------------------------------------------------------ */

  const parsedQuery = useMemo(
    () =>
      advancedMode
        ? parseAdvancedQuery(
          search,
        )
        : {
          text: search.trim(),
        },
    [advancedMode, search],
  );

  /* ------------------------------------------------------------------------ */
  /*                              Filtering                                  */
  /* ------------------------------------------------------------------------ */

  const filtered =
    useMemo(() => {
      const text =
        parsedQuery.text
          .toLowerCase()
          .trim();

      return [...iocs]
        .filter((ioc) => {
          if (!text) {
            return true;
          }

          const haystack = [
            ioc.value,
            ioc.source,
            ioc.type,
            ioc.severity,
            ...ioc.tags,
          ]
            .join(' ')
            .toLowerCase();

          return haystack.includes(
            text,
          );
        })
        .filter((ioc) => {
          if (
            typeFilter ===
            'ALL'
          ) {
            return true;
          }

          return (
            ioc.type ===
            typeFilter
          );
        })
        .filter((ioc) => {
          if (
            severityFilter ===
            'ALL'
          ) {
            return true;
          }

          return (
            ioc.severity ===
            severityFilter
          );
        })
        .filter((ioc) => {
          if (!sourceFilter) {
            return true;
          }

          return (
            ioc.source ===
            sourceFilter
          );
        })
        .filter((ioc) => {
          if (
            !parsedQuery.type
          ) {
            return true;
          }

          return (
            ioc.type ===
            parsedQuery.type
          );
        })
        .filter((ioc) => {
          if (
            !parsedQuery.severity
          ) {
            return true;
          }

          return (
            ioc.severity ===
            parsedQuery.severity
          );
        })
        .filter((ioc) => {
          if (
            !parsedQuery.source
          ) {
            return true;
          }

          return ioc.source
            .toLowerCase()
            .includes(
              parsedQuery.source.toLowerCase(),
            );
        })
        .filter((ioc) => {
          if (
            !parsedQuery.tag
          ) {
            return true;
          }

          return ioc.tags.some(
            (tag) =>
              tag
                .toLowerCase()
                .includes(
                  parsedQuery.tag!.toLowerCase(),
                ),
          );
        })
        .sort((a, b) => {
          const severityRank: Record<
            string,
            number
          > = {
            critical: 4,
            high: 3,
            medium: 2,
            low: 1,
          };

          const rankDifference =
            (severityRank[
              b.severity
            ] ?? 0) -
            (severityRank[
              a.severity
            ] ?? 0);

          if (rankDifference !== 0) {
            return rankDifference;
          }

          return (
            new Date(
              b.lastSeen ??
              b.firstSeen ??
              0,
            ).getTime() -
            new Date(
              a.lastSeen ??
              a.firstSeen ??
              0,
            ).getTime()
          );
        });
    }, [
      iocs,
      parsedQuery,
      typeFilter,
      severityFilter,
      sourceFilter,
    ]);

  /* ------------------------------------------------------------------------ */
  /*                               Counts                                    */
  /* ------------------------------------------------------------------------ */

  const typeCounts =
    useMemo(
      () => ({
        ip: iocs.filter(
          (ioc) =>
            ioc.type === 'ip',
        ).length,

        domain: iocs.filter(
          (ioc) =>
            ioc.type ===
            'domain',
        ).length,

        hash: iocs.filter(
          (ioc) =>
            ioc.type === 'hash',
        ).length,

        url: iocs.filter(
          (ioc) =>
            ioc.type === 'url',
        ).length,
      }),
      [iocs],
    );

  const criticalCount =
    iocs.filter(
      (ioc) =>
        ioc.severity ===
        'critical',
    ).length;

  const highCount =
    iocs.filter(
      (ioc) =>
        ioc.severity === 'high',
    ).length;

  /* ------------------------------------------------------------------------ */
  /*                           Active filters                                */
  /* ------------------------------------------------------------------------ */

  const activeFilters =
    useMemo(() => {
      const filters: string[] =
        [];

      if (
        typeFilter !==
        'ALL'
      ) {
        filters.push(
          `type:${typeFilter}`,
        );
      }

      if (
        severityFilter !==
        'ALL'
      ) {
        filters.push(
          `severity:${String(
            severityFilter,
          ).toLowerCase()}`,
        );
      }

      if (sourceFilter) {
        filters.push(
          `source:${sourceFilter}`,
        );
      }

      return filters;
    }, [
      typeFilter,
      severityFilter,
      sourceFilter,
    ]);

  const hasFilters =
    Boolean(search.trim()) ||
    activeFilters.length >
    0;

  /* ------------------------------------------------------------------------ */
  /*                               Actions                                   */
  /* ------------------------------------------------------------------------ */

  const removeFilter = (
    filter: string,
  ) => {
    if (
      filter.startsWith(
        'type:',
      )
    ) {
      setTypeFilter('ALL');
    }

    if (
      filter.startsWith(
        'severity:',
      )
    ) {
      setSeverityFilter(
        'ALL',
      );
    }

    if (
      filter.startsWith(
        'source:',
      )
    ) {
      setSourceFilter('');
    }
  };

  const clearAllFilters =
    () => {
      setActiveSearch('');
      setTypeFilter('ALL');
      setSeverityFilter(
        'ALL',
      );
      setSourceFilter('');
    };

  const setActiveSearch = (
    value: string,
  ) => {
    setSearch(value);
  };

  const showAddIocNotice =
    () => {
      /*
       * There is currently no IOC mutation callback in AppDataContext.
       * We therefore do not fabricate a local-only "Add IOC" operation that
       * would disappear on navigation. This notice makes the missing write
       * contract explicit until the backend mutation is wired.
       */
      setAddIocNotice(
        'IOC creation is not connected to the current data API.',
      );

      window.setTimeout(() => {
        setAddIocNotice('');
      }, 3000);
    };

  /* ------------------------------------------------------------------------ */
  /*                                Export                                   */
  /* ------------------------------------------------------------------------ */

  const exportStix =
    () => {
      if (
        filtered.length === 0
      ) {
        return;
      }

      const indicators =
        filtered.map(
          buildStixIndicator,
        );

      const bundle = {
        type: 'bundle',
        id: `bundle--${crypto.randomUUID()}`,
        spec_version: '2.1',
        objects: indicators,
      };

      downloadFile(
        `antitode-iocs-${new Date()
          .toISOString()
          .slice(0, 10)}.json`,
        JSON.stringify(
          bundle,
          null,
          2,
        ),
        'application/stix+json;charset=utf-8',
      );
    };

  const exportCsv =
    () => {
      if (
        filtered.length === 0
      ) {
        return;
      }

      const headers = [
        'ID',
        'Type',
        'Indicator',
        'Severity',
        'Source',
        'First Seen',
        'Last Seen',
        'Tags',
      ];

      const rows =
        filtered.map(
          (ioc) => [
            ioc.id,
            ioc.type,
            ioc.value,
            ioc.severity,
            ioc.source,
            ioc.firstSeen,
            ioc.lastSeen,
            ioc.tags.join(
              ' | ',
            ),
          ],
        );

      const csv = [
        headers
          .map(escapeCsvValue)
          .join(','),
        ...rows.map((row) =>
          row
            .map(
              escapeCsvValue,
            )
            .join(','),
        ),
      ].join('\n');

      downloadFile(
        `antitode-iocs-${new Date()
          .toISOString()
          .slice(0, 10)}.csv`,
        csv,
        'text/csv;charset=utf-8',
      );
    };

  const exportSelectedIoc =
    () => {
      if (!selectedIoc) {
        return;
      }

      const payload =
        JSON.stringify(
          selectedIoc,
          null,
          2,
        );

      downloadFile(
        `antitode-ioc-${selectedIoc.id}.json`,
        payload,
        'application/json;charset=utf-8',
      );
    };

  /* ------------------------------------------------------------------------ */
  /*                           Keyboard interaction                           */
  /* ------------------------------------------------------------------------ */

  const handleRowKeyDown =
    (
      event: KeyboardEvent<HTMLTableRowElement>,
      id: string,
    ) => {
      if (
        event.key ===
        'Enter' ||
        event.key === ' '
      ) {
        event.preventDefault();
        setSelectedIocId(id);
      }
    };

  /* ------------------------------------------------------------------------ */
  /*                                  Render                                  */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="at-ioc-page">
      {/* ================================================================== */
      /* PAGE HEADER                                                         */
      /* ================================================================== */}

      <PageHeader
        breadcrumbs={[
          {
            label: 'Intelligence',
          },
          {
            label: 'IOC',
          },
        ]}
        title="Indicators of Compromise"
        description="Manage and analyze IPs, domains, hashes, and URLs."
        actions={
          <>
            <button
              type="button"
              className="at-btn at-btn-secondary at-btn-sm"
              onClick={exportStix}
              disabled={
                filtered.length === 0
              }
            >
              <Download size={13} />
              STIX 2.1
            </button>

            <button
              type="button"
              className="at-btn at-btn-primary at-btn-sm"
              onClick={
                showAddIocNotice
              }
            >
              <Plus size={13} />
              Add IOC
            </button>
          </>
        }
      />

      {addIocNotice && (
        <div
          className="at-ioc-notice"
          role="status"
          aria-live="polite"
        >
          <ShieldAlert size={14} />
          {addIocNotice}
        </div>
      )}

      {/* ================================================================== */
      /* INTELLIGENCE SUMMARY                                                */
      /* ================================================================== */}

      <section className="at-ioc-summary">
        <div className="at-ioc-summary-intro">
          <span className="at-v2-kicker">
            INDICATOR REPOSITORY
          </span>

          <strong>
            {iocs.length}
          </strong>

          <span>
            tracked indicators
          </span>
        </div>

        <div className="at-ioc-summary-types">
          <div className="at-ioc-type-stat">
            <span className="at-ioc-type-icon ip">
              <Server size={14} />
            </span>

            <span>
              <strong>
                {typeCounts.ip}
              </strong>

              <small>
                IP addresses
              </small>
            </span>
          </div>

          <div className="at-ioc-type-stat">
            <span className="at-ioc-type-icon domain">
              <Globe size={14} />
            </span>

            <span>
              <strong>
                {typeCounts.domain}
              </strong>

              <small>
                Domains
              </small>
            </span>
          </div>

          <div className="at-ioc-type-stat">
            <span className="at-ioc-type-icon hash">
              <Hash size={14} />
            </span>

            <span>
              <strong>
                {typeCounts.hash}
              </strong>

              <small>
                Hashes
              </small>
            </span>
          </div>

          <div className="at-ioc-type-stat">
            <span className="at-ioc-type-icon url">
              <Link2 size={14} />
            </span>

            <span>
              <strong>
                {typeCounts.url}
              </strong>

              <small>URLs</small>
            </span>
          </div>
        </div>

        <div className="at-ioc-summary-severity">
          <div>
            <i className="critical" />

            <strong>
              {criticalCount}
            </strong>

            <small>
              critical
            </small>
          </div>

          <div>
            <i className="high" />

            <strong>
              {highCount}
            </strong>

            <small>
              high
            </small>
          </div>
        </div>
      </section>

      {/* ================================================================== */
      /* QUERY BAR                                                          */
      /* ================================================================== */}

      <section className="flex flex-col gap-4 mt-6 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[300px]">
            {advancedMode ? (
              <TerminalSquare size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666]" />
            ) : (
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666]" />
            )}

            <input
              type="search"
              className="w-full bg-[#111] border border-[#333] rounded-lg py-2.5 pl-10 pr-10 text-sm text-white placeholder-[#555] focus:outline-none focus:border-red-500 transition-colors"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                advancedMode
                  ? 'type:domain severity:critical source:ThreatFox tag:malware'
                  : 'Search indicators, values, tags, sources...'
              }
              aria-label="Search indicators"
              spellCheck={false}
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666] hover:text-white transition-colors"
                aria-label="Clear IOC search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button
            type="button"
            className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm transition-colors ${
              advancedMode ? 'bg-red-950/20 border-red-500 text-red-500' : 'bg-[#111] border-[#333] text-[#888] hover:text-white hover:border-[#444]'
            }`}
            onClick={() => setAdvancedMode((value) => !value)}
            aria-pressed={advancedMode}
          >
            <TerminalSquare size={14} />
            Advanced
          </button>

          <button
            type="button"
            className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm transition-colors ${
              showFilters ? 'bg-red-950/20 border-red-500 text-red-500' : 'bg-[#111] border-[#333] text-[#888] hover:text-white hover:border-[#444]'
            }`}
            onClick={() => setShowFilters((value) => !value)}
            aria-expanded={showFilters}
          >
            <SlidersHorizontal size={14} />
            Filters
            <ChevronDown size={14} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          <div className="ml-auto text-xs text-[#666] font-medium hidden md:block">
            {filtered.length.toLocaleString()} {filtered.length === 1 ? 'result' : 'results'}
          </div>
        </div>

        {showFilters && (
          <div className="flex flex-wrap items-center gap-6 p-4 bg-[#111] border border-[#222] rounded-lg">
            <div className="flex items-center gap-2">
              <label className="text-xs text-[#888]">Type</label>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as 'ALL' | IocType)}
                className="bg-black border border-[#333] text-white text-xs rounded px-2 py-1.5 focus:border-red-500 outline-none cursor-pointer"
              >
                <option value="ALL">All types</option>
                <option value="ip">IP address</option>
                <option value="domain">Domain</option>
                <option value="hash">Hash</option>
                <option value="url">URL</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-[#888]">Severity</label>
              <select
                value={severityFilter}
                onChange={(event) => setSeverityFilter(event.target.value as IocSeverity)}
                className="bg-black border border-[#333] text-white text-xs rounded px-2 py-1.5 focus:border-red-500 outline-none cursor-pointer"
              >
                <option value="ALL">All severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-[#888]">Source</label>
              <select
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
                className="bg-black border border-[#333] text-white text-xs rounded px-2 py-1.5 focus:border-red-500 outline-none cursor-pointer max-w-[200px]"
              >
                <option value="">All sources</option>
                {sourceOptions.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="ml-auto text-xs text-red-500 hover:text-red-400 font-medium transition-colors"
              onClick={clearAllFilters}
            >
              Clear all filters
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <span className="text-[10px] font-bold text-[#555] tracking-widest uppercase">
            ACTIVE FILTERS
          </span>

          {!hasFilters ? (
            <span className="text-xs text-[#444] italic">
              No filters applied
            </span>
          ) : (
            <>
              {activeFilters.map((filter) => (
                <span
                  key={filter}
                  className="flex items-center gap-1.5 bg-[#1a1a1a] border border-[#333] text-white text-[11px] px-2.5 py-1 rounded-full"
                >
                  {filter}
                  <button
                    type="button"
                    onClick={() => removeFilter(filter)}
                    aria-label={`Remove ${filter}`}
                    className="text-[#666] hover:text-white transition-colors"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}

              {search.trim() && !advancedMode && (
                <span className="flex items-center gap-1.5 bg-[#1a1a1a] border border-[#333] text-white text-[11px] px-2.5 py-1 rounded-full">
                  query: {search.trim()}
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label="Remove search query"
                    className="text-[#666] hover:text-white transition-colors"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              <button
                type="button"
                className="flex items-center gap-1.5 text-xs text-[#666] hover:text-white transition-colors ml-2"
                onClick={clearAllFilters}
              >
                <CircleX size={14} />
                Clear all
              </button>
            </>
          )}
        </div>
      </section>

      {/* ================================================================== */
      /* WORKSPACE                                                           */
      /* ================================================================== */}

      <div className="at-ioc-workspace">
        {/* ================================================================ */
        /* LIST                                                               */
        /* ================================================================ */}

        <section className="at-ioc-list">
          <div className="at-ioc-list-head">
            <div>
              <span className="at-v2-kicker">
                INDICATOR FEED
              </span>

              <h2>
                Threat indicators
              </h2>
            </div>

            <span className="at-ioc-list-count">
              Showing{' '}
              <strong>
                {filtered.length}
              </strong>

              {filtered.length !==
                iocs.length && (
                  <>
                    {' '}
                    of {iocs.length}
                  </>
                )}
            </span>
          </div>

          <div className="at-ioc-table-wrap">
            <table className="at-ioc-table">
              <thead>
                <tr>
                  <th>
                    Type
                  </th>

                  <th>
                    Indicator
                  </th>

                  <th>
                    Severity
                  </th>

                  <th>
                    Source
                  </th>

                  <th>
                    Last Seen
                  </th>

                  <th>
                    Tags
                  </th>

                  <th />
                </tr>
              </thead>

              <tbody>
                {filtered.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="at-ioc-empty"
                    >
                      <ShieldAlert
                        size={21}
                      />

                      <strong>
                        No indicators found
                      </strong>

                      <span>
                        No IOC values match the
                        current query and filters.
                      </span>

                      <button
                        type="button"
                        onClick={
                          clearAllFilters
                        }
                      >
                        Clear filters
                      </button>
                    </td>
                  </tr>
                ) : (
                  filtered
                    .slice(
                      (currentPage - 1) * ITEMS_PER_PAGE,
                      currentPage * ITEMS_PER_PAGE,
                    )
                    .map(
                    (ioc) => {
                      const Icon =
                        TYPE_ICONS[
                        ioc.type as IocType
                        ] ??
                        Hash;

                      const selected =
                        selectedIocId ===
                        ioc.id;

                      return (
                        <tr
                          key={ioc.id}
                          className={
                            selected
                              ? 'active'
                              : ''
                          }
                          tabIndex={0}
                          aria-selected={
                            selected
                          }
                          onClick={() =>
                            setSelectedIocId(
                              ioc.id,
                            )
                          }
                          onKeyDown={(
                            event,
                          ) =>
                            handleRowKeyDown(
                              event,
                              ioc.id,
                            )
                          }
                        >
                          <td>
                            <span
                              className={`at-ioc-type-icon-table ${ioc.type}`}
                            >
                              <Icon
                                size={12}
                              />
                            </span>
                          </td>

                          <td>
                            <button
                              type="button"
                              className="at-ioc-value"
                              onClick={(
                                event,
                              ) => {
                                event.stopPropagation();

                                setSelectedIocId(
                                  ioc.id,
                                );
                              }}
                              title={
                                ioc.value
                              }
                            >
                              {ioc.value}
                            </button>

                            <span className="at-ioc-type-label">
                              {typeLabel(
                                ioc.type,
                              )}
                            </span>
                          </td>

                          <td>
                            <span
                              className={`at-ioc-severity ${severityClass(
                                ioc.severity,
                              )}`}
                            >
                              <i />
                              {String(
                                ioc.severity,
                              ).toUpperCase()}
                            </span>
                          </td>

                          <td>
                            <span className="at-ioc-source">
                              {ioc.source}
                            </span>
                          </td>

                          <td>
                            <code className="at-ioc-date">
                              {formatDate(
                                ioc.lastSeen ??
                                ioc.firstSeen,
                              )}
                            </code>
                          </td>

                          <td>
                            <div className="at-ioc-tags">
                              {ioc.tags
                                .slice(
                                  0,
                                  2,
                                )
                                .map(
                                  (
                                    tag,
                                    index,
                                  ) => (
                                    <span
                                      key={`${tag}-${index}`}
                                    >
                                      {tag}
                                    </span>
                                  ),
                                )}

                              {ioc.tags
                                .length >
                                2 && (
                                  <span>
                                    +
                                    {ioc.tags
                                      .length -
                                      2}
                                  </span>
                                )}

                              {ioc.tags.length ===
                                0 && (
                                  <span>
                                    —
                                  </span>
                                )}
                            </div>
                          </td>

                          <td>
                            <ChevronRight
                              size={13}
                              className="at-ioc-row-arrow"
                              aria-hidden="true"
                            />
                          </td>
                        </tr>
                      );
                    },
                  )
                )}
              </tbody>
            </table>
          </div>

          {filtered.length > ITEMS_PER_PAGE && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--at-border)' }}>
              <button
                type="button"
                className="at-btn at-btn-ghost at-btn-sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span style={{ fontSize: '12px', color: 'var(--at-text-muted)' }}>
                Page {currentPage} of {Math.ceil(filtered.length / ITEMS_PER_PAGE)}
              </span>
              <button
                type="button"
                className="at-btn at-btn-ghost at-btn-sm"
                disabled={currentPage === Math.ceil(filtered.length / ITEMS_PER_PAGE)}
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(filtered.length / ITEMS_PER_PAGE), p + 1))}
              >
                Next
              </button>
            </div>
          )}
        </section>

        {/* ================================================================ */
        /* INSPECTOR                                                          */
        /* ================================================================ */}

        <aside className="at-ioc-inspector">
          {!selectedIoc ? (
            <div
              className="at-ioc-empty-state"
              style={{
                flex: 1,
              }}
            >
              <ShieldAlert
                size={28}
                className="mb-2 opacity-20"
              />

              <strong>
                No Indicator Selected
              </strong>

              <span>
                Select an IOC from the list to
                view its properties and context.
              </span>
            </div>
          ) : (
            <>
              <div className="at-ioc-inspector-head">
                <div className="at-ioc-inspector-heading">
                  <span
                    className={`at-ioc-inspector-icon ${selectedIoc.type}`}
                  >
                    {(() => {
                      const Icon =
                        TYPE_ICONS[
                        selectedIoc.type as IocType
                        ] ??
                        Hash;

                      return (
                        <Icon size={19} />
                      );
                    })()}
                  </span>

                  <div>
                    <span>
                      {typeLabel(
                        selectedIoc.type,
                      )}
                    </span>

                    <strong
                      title={
                        selectedIoc.value
                      }
                    >
                      {selectedIoc.value}
                    </strong>
                  </div>
                </div>

                <button
                  type="button"
                  className="at-ioc-close"
                  onClick={() =>
                    setSelectedIocId(
                      null,
                    )
                  }
                  aria-label="Close inspector"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="at-ioc-inspector-meta">
                <span
                  className={`at-ioc-inspector-severity ${selectedIoc.severity}`}
                >
                  <i />

                  {String(
                    selectedIoc.severity,
                  ).toUpperCase()}{' '}
                  RISK
                </span>

                <span className="at-ioc-inspector-source">
                  {selectedIoc.source}
                </span>
              </div>

              {/* ---------------------------------------------------------- */
              /* Tabs                                                        */
              /* ---------------------------------------------------------- */}

              <div
                className="at-ioc-tabs"
                role="tablist"
                aria-label="IOC details"
              >
                {(
                  [
                    'Overview',
                    'Timeline',
                    'Relationships',
                  ] as const
                ).map(
                  (tab) => (
                    <button
                      type="button"
                      key={tab}
                      className={
                        inspectorTab ===
                          tab
                          ? 'active'
                          : ''
                      }
                      onClick={() =>
                        setInspectorTab(
                          tab,
                        )
                      }
                      role="tab"
                      aria-selected={
                        inspectorTab ===
                        tab
                      }
                    >
                      {tab}
                    </button>
                  ),
                )}
              </div>

              {/* ---------------------------------------------------------- */
              /* Inspector content                                           */
              /* ---------------------------------------------------------- */}

              <div className="at-ioc-inspector-scroll">
                {inspectorTab ===
                  'Overview' && (
                    <div className="at-ioc-inspector-content">
                      {/* Observation */}

                      <section className="at-ioc-inspector-block">
                        <div className="at-ioc-block-title">
                          <span>
                            OBSERVATION
                          </span>

                          <Activity
                            size={12}
                          />
                        </div>

                        <div className="at-ioc-observation-grid">
                          <div>
                            <span>
                              First Seen
                            </span>

                            <code>
                              {formatDateTime(
                                selectedIoc.firstSeen,
                              )}
                            </code>
                          </div>

                          <div>
                            <span>
                              Last Seen
                            </span>

                            <code>
                              {formatDateTime(
                                selectedIoc.lastSeen,
                              )}
                            </code>
                          </div>
                        </div>
                      </section>

                      {/* Intelligence tags */}

                      <section className="at-ioc-inspector-block">
                        <div className="at-ioc-block-title">
                          <span>
                            INTELLIGENCE TAGS
                          </span>

                          <Hash size={12} />
                        </div>

                        {selectedIoc.tags
                          .length > 0 ? (
                          <div className="at-ioc-inspector-tags">
                            {selectedIoc.tags.map(
                              (
                                tag,
                                index,
                              ) => (
                                <span
                                  key={`${tag}-${index}`}
                                >
                                  {tag}
                                </span>
                              ),
                            )}
                          </div>
                        ) : (
                          <div className="at-ioc-inline-empty">
                            No intelligence tags
                            recorded.
                          </div>
                        )}
                      </section>

                      {/* Source */}

                      <section className="at-ioc-inspector-block">
                        <div className="at-ioc-block-title">
                          <span>
                            SOURCE
                          </span>

                          <Globe
                            size={12}
                          />
                        </div>

                        <div className="at-ioc-source-card">
                          <strong>
                            {
                              selectedIoc.source
                            }
                          </strong>

                          <span>
                            Intelligence
                            provider
                          </span>
                        </div>
                      </section>

                      {/* Indicator metadata */}

                      <section className="at-ioc-inspector-block">
                        <div className="at-ioc-block-title">
                          <span>
                            INDICATOR METADATA
                          </span>

                          <Hash size={12} />
                        </div>

                        <div className="at-ioc-metadata-grid">
                          <div>
                            <span>
                              ID
                            </span>

                            <code>
                              {
                                selectedIoc.id
                              }
                            </code>
                          </div>

                          <div>
                            <span>
                              TYPE
                            </span>

                            <code>
                              {
                                selectedIoc.type
                              }
                            </code>
                          </div>

                          <div>
                            <span>
                              SEVERITY
                            </span>

                            <strong>
                              {
                                selectedIoc.severity
                              }
                            </strong>
                          </div>
                        </div>
                      </section>

                      {/* Actions */}

                      <section className="at-ioc-inspector-block">
                        <div className="at-ioc-block-title">
                          <span>
                            ANALYST ACTIONS
                          </span>

                          <Target size={12} />
                        </div>

                        <div className="at-ioc-action-list">
                          <button
                            type="button"
                            className="at-ioc-action"
                            onClick={() =>
                              onNavigate(
                                'analysis',
                              )
                            }
                          >
                            <span className="at-ioc-action-icon">
                              <Target
                                size={12}
                              />
                            </span>

                            <span>
                              <strong>
                                Hunt in analysis
                              </strong>

                              <small>
                                Pivot into host
                                analysis for
                                investigation.
                              </small>
                            </span>

                            <ArrowUpRight
                              size={12}
                            />
                          </button>

                          <button
                            type="button"
                            className="at-ioc-action"
                            onClick={() =>
                              onNavigate(
                                'investigate',
                              )
                            }
                          >
                            <span className="at-ioc-action-icon">
                              <Network
                                size={12}
                              />
                            </span>

                            <span>
                              <strong>
                                Pivot to investigation
                              </strong>

                              <small>
                                Continue investigation
                                in the relationship
                                workspace.
                              </small>
                            </span>

                            <ArrowUpRight
                              size={12}
                            />
                          </button>
                        </div>
                      </section>
                    </div>
                  )}

                {inspectorTab ===
                  'Timeline' && (
                    <div className="at-ioc-empty-state">
                      <Activity
                        size={22}
                      />

                      <strong>
                        No timeline events
                      </strong>

                      <span>
                        No timeline events are attached
                        to this indicator in the current
                        application data.
                      </span>
                    </div>
                  )}

                {inspectorTab ===
                  'Relationships' && (
                    <div className="at-ioc-empty-state">
                      <Network
                        size={22}
                      />

                      <strong>
                        No relationships
                      </strong>

                      <span>
                        No related entities are attached
                        to this indicator in the current
                        application data.
                      </span>
                    </div>
                  )}
              </div>

              {/* ---------------------------------------------------------- */
              /* Footer                                                       */
              /* ---------------------------------------------------------- */}

              <div className="at-ioc-inspector-footer">
                <button
                  type="button"
                  className="at-btn at-btn-secondary"
                  onClick={
                    exportSelectedIoc
                  }
                >
                  <Download size={12} />
                  Export IOC
                </button>

                <button
                  type="button"
                  className="at-btn at-btn-primary"
                  onClick={() =>
                    onNavigate(
                      'investigate',
                    )
                  }
                >
                  <ArrowUpRight
                    size={12}
                  />
                  Investigate
                </button>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}