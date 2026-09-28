import React from 'react';
import {
  useMemo,
  useState,
  type KeyboardEvent,
} from 'react';

import type { CveEntry } from '../../types';

import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleX,
  Download,
  ExternalLink,
  FileWarning,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
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

type InspectorTab =
  | 'Overview'
  | 'Affected Systems'
  | 'References';

type SeverityFilter =
  | 'ALL'
  | CveEntry['severity'];

interface ParsedAdvancedQuery {
  text: string;
  severity?: CveEntry['severity'];
  exploit?: boolean;
  vendor?: string;
  product?: string;
}

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

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
  severity: CveEntry['severity'],
): string {
  return String(severity).toLowerCase();
}

function severityLabel(
  severity: CveEntry['severity'],
): string {
  return String(severity).toUpperCase();
}

function cvssClass(score: number): string {
  if (score >= 9) {
    return 'critical';
  }

  if (score >= 7) {
    return 'high';
  }

  if (score >= 4) {
    return 'medium';
  }

  return 'low';
}

function escapeCsvValue(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function downloadTextFile(
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

/**
 * Lightweight advanced query support.
 *
 * Examples:
 *
 *   severity:critical exploit:true
 *   vendor:microsoft
 *   product:exchange
 *   severity:high authentication
 *
 * Unknown tokens remain part of the free-text query, so normal searches
 * continue working even when advanced mode is enabled.
 */
function parseAdvancedQuery(
  input: string,
): ParsedAdvancedQuery {
  const tokens = input
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  let severity:
    | CveEntry['severity']
    | undefined;

  let exploit: boolean | undefined;

  let vendor: string | undefined;
  let product: string | undefined;

  const textTokens: string[] = [];

  for (const token of tokens) {
    const separatorIndex = token.indexOf(':');

    if (separatorIndex <= 0) {
      textTokens.push(token);
      continue;
    }

    const key = token
      .slice(0, separatorIndex)
      .toLowerCase();

    const rawValue = token
      .slice(separatorIndex + 1)
      .trim();

    const value = rawValue.toLowerCase();

    if (!rawValue) {
      continue;
    }

    if (
      key === 'severity' &&
      ['critical', 'high', 'medium', 'low'].includes(
        value,
      )
    ) {
      severity =
        value as CveEntry['severity'];
      continue;
    }

    if (
      key === 'exploit' &&
      ['true', 'false'].includes(value)
    ) {
      exploit = value === 'true';
      continue;
    }

    if (key === 'vendor') {
      vendor = rawValue;
      continue;
    }

    if (key === 'product') {
      product = rawValue;
      continue;
    }

    textTokens.push(token);
  }

  return {
    text: textTokens.join(' '),
    severity,
    exploit,
    vendor,
    product,
  };
}

/* -------------------------------------------------------------------------- */
/*                                CVE Page                                    */
/* -------------------------------------------------------------------------- */

export default function CvePage() {
  const [MOCK_CVES, set_MOCK_CVES] = React.useState<any[]>([]);
    React.useEffect(() => {
        dataProvider.getCves().then(set_MOCK_CVES);
    }, []);

  /* ------------------------------------------------------------------------ */
  /*                                  State                                   */
  /* ------------------------------------------------------------------------ */

  const [search, setSearch] = useState('');
  const [advancedMode, setAdvancedMode] =
    useState(false);

  const [severityFilter, setSeverityFilter] =
    useState<SeverityFilter>('ALL');

  const [exploitOnly, setExploitOnly] =
    useState(false);

  const [vendorFilter, setVendorFilter] =
    useState('');

  const [showFilters, setShowFilters] =
    useState(false);

  const [selectedCveId, setSelectedCveId] =
    useState<string | null>(null);

  const [inspectorTab, setInspectorTab] =
    useState<InspectorTab>('Overview');

  const [visibleCount, setVisibleCount] = useState(50);

  React.useEffect(() => {
    setVisibleCount(50);
  }, [search, advancedMode, severityFilter, exploitOnly, vendorFilter]);

  /* ------------------------------------------------------------------------ */
  /*                            Filter options                                */
  /* ------------------------------------------------------------------------ */

  const vendorOptions = useMemo(() => {
    return Array.from(
      new Set(
        MOCK_CVES
          .map((cve) => cve.vendor)
          .filter(Boolean),
      ),
    ).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [MOCK_CVES]);

  /* ------------------------------------------------------------------------ */
  /*                           Advanced query                                */
  /* ------------------------------------------------------------------------ */

  const parsedQuery = useMemo(
    () =>
      advancedMode
        ? parseAdvancedQuery(search)
        : {
          text: search.trim(),
        },
    [advancedMode, search],
  );

  /* ------------------------------------------------------------------------ */
  /*                             Selected CVE                                 */
  /* ------------------------------------------------------------------------ */

  const selectedCve = useMemo(() => {
    if (!selectedCveId) {
      return null;
    }

    return (
      MOCK_CVES.find(
        (cve) => cve.id === selectedCveId,
      ) ?? null
    );
  }, [MOCK_CVES, selectedCveId]);

  /* ------------------------------------------------------------------------ */
  /*                              Filtering                                   */
  /* ------------------------------------------------------------------------ */

  const filtered = useMemo(() => {
    const textQuery = parsedQuery.text
      .toLowerCase()
      .trim();

    return [...MOCK_CVES]
      .filter((cve) => {
        if (!textQuery) {
          return true;
        }

        const searchableText = [
          cve.id,
          cve.description,
          cve.vendor,
          cve.product,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return searchableText.includes(
          textQuery,
        );
      })
      .filter((cve) => {
        if (severityFilter === 'ALL') {
          return true;
        }

        return cve.severity === severityFilter;
      })
      .filter((cve) => {
        if (!exploitOnly) {
          return true;
        }

        return cve.exploitAvailable;
      })
      .filter((cve) => {
        if (!vendorFilter) {
          return true;
        }

        return cve.vendor === vendorFilter;
      })
      .filter((cve) => {
        if (!parsedQuery.severity) {
          return true;
        }

        return (
          cve.severity ===
          parsedQuery.severity
        );
      })
      .filter((cve) => {
        if (typeof parsedQuery.exploit !== 'boolean') {
          return true;
        }

        return (
          cve.exploitAvailable ===
          parsedQuery.exploit
        );
      })
      .filter((cve) => {
        if (!parsedQuery.vendor) {
          return true;
        }

        return cve.vendor
          .toLowerCase()
          .includes(
            parsedQuery.vendor.toLowerCase(),
          );
      })
      .filter((cve) => {
        if (!parsedQuery.product) {
          return true;
        }

        return cve.product
          .toLowerCase()
          .includes(
            parsedQuery.product.toLowerCase(),
          );
      })
      .sort((a, b) => {
        const scoreDifference =
          b.cvss - a.cvss;

        if (scoreDifference !== 0) {
          return scoreDifference;
        }

        return (
          new Date(b.published).getTime() -
          new Date(a.published).getTime()
        );
      });
  }, [
    MOCK_CVES,
    parsedQuery,
    severityFilter,
    exploitOnly,
    vendorFilter,
  ]);

  /* ------------------------------------------------------------------------ */
  /*                              Statistics                                  */
  /* ------------------------------------------------------------------------ */

  const criticalCount = useMemo(
    () =>
      MOCK_CVES.filter(
        (cve) =>
          cve.severity === 'critical',
      ).length,
    [MOCK_CVES],
  );

  const highCount = useMemo(
    () =>
      MOCK_CVES.filter(
        (cve) =>
          cve.severity === 'high',
      ).length,
    [MOCK_CVES],
  );

  const exploitCount = useMemo(
    () =>
      MOCK_CVES.filter(
        (cve) => cve.exploitAvailable,
      ).length,
    [MOCK_CVES],
  );

  const vendorCount = useMemo(
    () =>
      new Set(
        MOCK_CVES.map(
          (cve) => cve.vendor,
        ),
      ).size,
    [MOCK_CVES],
  );

  /* ------------------------------------------------------------------------ */
  /*                          Active filter chips                             */
  /* ------------------------------------------------------------------------ */

  const activeFilters = useMemo(() => {
    const filters: string[] = [];

    if (severityFilter !== 'ALL') {
      filters.push(
        `severity:${String(
          severityFilter,
        ).toLowerCase()}`,
      );
    }

    if (exploitOnly) {
      filters.push('exploit:true');
    }

    if (vendorFilter) {
      filters.push(
        `vendor:${vendorFilter}`,
      );
    }

    if (
      advancedMode &&
      parsedQuery.severity &&
      parsedQuery.severity !== severityFilter
    ) {
      filters.push(
        `severity:${String(
          parsedQuery.severity,
        ).toLowerCase()}`,
      );
    }

    if (
      advancedMode &&
      typeof parsedQuery.exploit ===
      'boolean' &&
      parsedQuery.exploit !== exploitOnly
    ) {
      filters.push(
        `exploit:${parsedQuery.exploit}`,
      );
    }

    if (
      advancedMode &&
      parsedQuery.vendor &&
      parsedQuery.vendor !== vendorFilter
    ) {
      filters.push(
        `vendor:${parsedQuery.vendor}`,
      );
    }

    if (
      advancedMode &&
      parsedQuery.product
    ) {
      filters.push(
        `product:${parsedQuery.product}`,
      );
    }

    return Array.from(
      new Set(filters),
    );
  }, [
    severityFilter,
    exploitOnly,
    vendorFilter,
    advancedMode,
    parsedQuery,
  ]);

  const hasActiveFilters =
    activeFilters.length > 0 ||
    Boolean(search.trim());

  /* ------------------------------------------------------------------------ */
  /*                               Actions                                    */
  /* ------------------------------------------------------------------------ */

  const clearAllFilters = () => {
    setSearch('');
    setSeverityFilter('ALL');
    setExploitOnly(false);
    setVendorFilter('');
    setShowFilters(false);
  };

  const removeFilter = (
    filter: string,
  ) => {
    if (
      filter.startsWith('severity:')
    ) {
      setSeverityFilter('ALL');
    }

    if (
      filter === 'exploit:true'
    ) {
      setExploitOnly(false);
    }

    if (
      filter.startsWith('vendor:')
    ) {
      setVendorFilter('');
    }

    if (
      filter.startsWith('product:')
    ) {
      setSearch('');
    }
  };

  const handleExport = () => {
    const payload = filtered.map(
      (cve) => ({
        id: cve.id,
          cvss: cve.cvss,
        severity: cve.severity,
        description: cve.description,
        vendor: cve.vendor,
        product: cve.product,
        exploitAvailable:
          cve.exploitAvailable,
        published: cve.published,
      }),
    );

    downloadTextFile(
      `antitode-cve-export-${new Date()
        .toISOString()
        .slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2),
      'application/json;charset=utf-8',
    );
  };

  const openNvdRecord = (
    cveId: string,
  ) => {
    window.open(
      `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(
        cveId,
      )}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  const handleRowKeyDown = (
    event: KeyboardEvent<HTMLTableRowElement>,
    cveId: string,
  ) => {
    if (
      event.key === 'Enter' ||
      event.key === ' '
    ) {
      event.preventDefault();
      setSelectedCveId(cveId);
    }
  };

  /* ------------------------------------------------------------------------ */
  /*                                  Render                                  */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="at-cve-page">
      {/* ================================================================== */
      /* HEADER                                                               */
      /* ================================================================== */}

      <PageHeader
        breadcrumbs={[
          {
            label: 'Intelligence',
          },
          {
            label: 'CVE Database',
          },
        ]}
        title="CVE Database"
        description="Track and analyze Common Vulnerabilities and Exposures."
        actions={
          <button
            type="button"
            className="at-btn at-btn-secondary at-btn-sm"
            onClick={handleExport}
            title={`Export ${filtered.length} visible CVEs`}
          >
            <Download size={13} />
            Export JSON
          </button>
        }
      />

      {/* ================================================================== */
      /* SUMMARY                                                              */
      /* ================================================================== */}

      <section className="flex flex-col gap-6 p-6 border-b border-[#333] bg-[#0a0a0a]">
        {/* SUMMARY HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold text-[#888] tracking-widest uppercase">
              Vulnerability Repository
            </span>
            <div className="flex items-center gap-2">
              <strong className="text-2xl font-semibold text-white">
                {MOCK_CVES.length}
              </strong>
              <span className="text-sm text-[#888]">
                indexed vulnerabilities
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded bg-red-950/30 text-red-500">
                <ShieldAlert size={16} />
              </div>
              <div className="flex flex-col">
                <strong className="text-sm text-white leading-none">{criticalCount}</strong>
                <small className="text-[10px] text-[#888] uppercase tracking-wider">Critical</small>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded bg-[#111] text-white">
                <AlertTriangle size={16} />
              </div>
              <div className="flex flex-col">
                <strong className="text-sm text-white leading-none">{highCount}</strong>
                <small className="text-[10px] text-[#888] uppercase tracking-wider">High</small>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded bg-[#111] text-white">
                <Target size={16} />
              </div>
              <div className="flex flex-col">
                <strong className="text-sm text-white leading-none">{exploitCount}</strong>
                <small className="text-[10px] text-[#888] uppercase tracking-wider">Exploits</small>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded bg-[#111] text-[#888]">
                <FileWarning size={16} />
              </div>
              <div className="flex flex-col">
                <strong className="text-sm text-white leading-none">{vendorCount}</strong>
                <small className="text-[10px] text-[#888] uppercase tracking-wider">Vendors</small>
              </div>
            </div>
          </div>
        </div>

        {/* QUERY & SEARCH BAR */}
        <div className="flex flex-col gap-4 mt-2">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[300px]">
              {advancedMode ? (
                <TerminalSquare size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666]" />
              ) : (
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666]" />
              )}
              
              <input
                className="w-full bg-[#111] border border-[#333] rounded-lg py-2.5 pl-10 pr-10 text-sm text-white placeholder-[#555] focus:outline-none focus:border-red-500 transition-colors"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={
                  advancedMode
                    ? 'severity:critical exploit:true vendor:microsoft authentication...'
                    : 'Search CVE-ID, description, vendor, or product...'
                }
                spellCheck={false}
              />

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666] hover:text-white transition-colors"
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
              onClick={() => setAdvancedMode((c) => !c)}
            >
              <TerminalSquare size={14} />
              Advanced
            </button>

            <button
              type="button"
              className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm transition-colors ${
                showFilters ? 'bg-red-950/20 border-red-500 text-red-500' : 'bg-[#111] border-[#333] text-[#888] hover:text-white hover:border-[#444]'
              }`}
              onClick={() => setShowFilters((c) => !c)}
            >
              <SlidersHorizontal size={14} />
              Filters
              <ChevronDown
                size={14}
                className={`transition-transform ${showFilters ? 'rotate-180' : ''}`}
              />
            </button>
            
            <div className="ml-auto text-xs text-[#666] font-medium hidden md:block">
              {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
            </div>
          </div>

          {/* FILTER PANEL */}
          {showFilters && (
            <div className="flex flex-wrap items-center gap-6 p-4 bg-[#111] border border-[#222] rounded-lg">
              <div className="flex items-center gap-2">
                <label className="text-xs text-[#888]">Severity</label>
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
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
                <label className="text-xs text-[#888]">Vendor</label>
                <select
                  value={vendorFilter}
                  onChange={(e) => setVendorFilter(e.target.value)}
                  className="bg-black border border-[#333] text-white text-xs rounded px-2 py-1.5 focus:border-red-500 outline-none cursor-pointer max-w-[200px]"
                >
                  <option value="">All vendors</option>
                  {vendorOptions.map((vendor) => (
                    <option key={vendor} value={vendor}>{vendor}</option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 text-xs text-[#888] cursor-pointer hover:text-white transition-colors">
                <input
                  type="checkbox"
                  checked={exploitOnly}
                  onChange={(e) => setExploitOnly(e.target.checked)}
                  className="accent-red-500 rounded-sm bg-black border-[#333]"
                />
                Exploit available only
              </label>

              <button
                type="button"
                onClick={clearAllFilters}
                className="ml-auto text-xs text-red-500 hover:text-red-400 font-medium transition-colors"
              >
                Clear all filters
              </button>
            </div>
          )}

          {/* ACTIVE FILTERS BAR */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <span className="text-[10px] font-bold text-[#555] tracking-widest uppercase">
              Active Filters
            </span>

            {!hasActiveFilters ? (
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
                      className="text-[#666] hover:text-white transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}

                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="flex items-center gap-1.5 text-xs text-[#666] hover:text-white transition-colors ml-2"
                >
                  <CircleX size={14} />
                  Clear
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ================================================================== */
      /* WORKSPACE                                                            */
      /* ================================================================== */}

      <div className="at-cve-workspace">
        {/* ================================================================ */
        /* LIST                                                               */
        /* ================================================================ */}

        <section className="at-cve-list">
          <div className="at-cve-list-head">
            <div>
              <span className="at-v2-kicker">
                VULNERABILITY FEED
              </span>

              <h2>Indexed CVEs</h2>
            </div>

            <span className="at-cve-list-count">
              Showing{' '}
              <strong>
                {filtered.length}
              </strong>

              {filtered.length !==
                MOCK_CVES.length && (
                  <>
                    {' '}
                    of {MOCK_CVES.length}
                  </>
                )}
            </span>
          </div>

          <div className="at-cve-table-wrap">
            <table className="at-cve-table">
              <thead>
                <tr>
                  <th>CVE ID</th>
                  <th>CVSS</th>
                  <th>Severity</th>
                  <th>Description</th>
                  <th>Product</th>
                  <th>Published</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8"><div className="at-cve-empty-state mx-auto max-w-sm bg-[#111] border border-[#222] rounded-xl shadow-lg"><FileWarning size={24} className="text-[#666] mb-2" /><strong className="text-white text-sm block">No CVEs found</strong><span className="text-[#888] text-xs block mt-1">No vulnerabilities match the current search and filters.</span><button type="button" onClick={clearAllFilters} className="mt-4 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 transition-colors rounded-lg text-xs text-white border border-neutral-700">Clear filters</button></div></td>
                  </tr>
                ) : (
                  filtered.slice(0, visibleCount).map((cve) => {
                    const selected =
                      selectedCveId ===
                      cve.id;

                    return (
                      <tr
                        key={cve.id}
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
                          setSelectedCveId(
                            cve.id,
                          )
                        }
                        onKeyDown={(
                          event,
                        ) =>
                          handleRowKeyDown(
                            event,
                            cve.id,
                          )
                        }
                      >
                        {/* CVE ID */}

                        <td>
                          <div className="at-cve-id-cell whitespace-nowrap">
                            {cve.exploitAvailable && (
                              <span className="at-cve-exploit-mark">
                                <Target
                                  size={11}
                                />
                              </span>
                            )}

                            <div>
                              <button
                                type="button"
                                className="at-cve-id"
                                onClick={(
                                  event,
                                ) => {
                                  event.stopPropagation();

                                  setSelectedCveId(
                                    cve.id,
                                  );
                                }}
                              >
                                {cve.id}
                              </button>

                              {cve.exploitAvailable && (
                                <span className="at-cve-id-meta">
                                  EXPLOIT
                                  AVAILABLE
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* CVSS */}

                        <td>
                          <span
                            className={`at-cve-score ${cvssClass(
                              cve.cvss,
                            )}`}
                          >
                            {cve.cvss && !Number.isNaN(Number(cve.cvss)) ? Number(
                              cve.cvss,
                            ).toFixed(1) : 'N/A'}
                          </span>
                        </td>

                        {/* Severity */}

                        <td>
                          <span
                            className={`at-cve-severity ${severityClass(
                              cve.severity,
                            )}`}
                          >
                            <i />
                            {severityLabel(
                              cve.severity,
                            )}
                          </span>
                        </td>

                        {/* Description */}

                        <td>
                          <span className="at-cve-description">
                            {cve.description}
                          </span>
                        </td>

                        {/* Product */}

                        <td>
                          <span className="at-cve-product">
                            {cve.vendor}{' '}
                            {cve.product}
                          </span>
                        </td>

                        {/* Published */}

                        <td>
                          <code className="at-cve-date">
                            {formatDate(
                              cve.published,
                            )}
                          </code>
                        </td>

                        {/* Open */}

                        <td>
                          <ChevronRight
                            size={13}
                            className="at-cve-row-arrow"
                            aria-hidden="true"
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {filtered.length > visibleCount && (
              <div className="flex justify-center p-6 border-t border-[#1d1d1d]">
                <button
                  type="button"
                  className="at-btn at-btn-secondary"
                  onClick={() => setVisibleCount((c) => c + 50)}
                >
                  Load More ({filtered.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ================================================================ */
        /* INSPECTOR                                                          */
        /* ================================================================ */}

        {selectedCve && (
          <aside
            className="at-cve-inspector"
            aria-label={`Details for ${selectedCve.id}`}
          >
            {/* -------------------------------------------------------------- */
            /* Header                                                           */
            /* -------------------------------------------------------------- */}

            <div className="at-cve-inspector-head">
              <div className="at-cve-heading">
                <span
                  className={`at-cve-heading-icon ${selectedCve.severity}`}
                >
                  <ShieldAlert size={19} />
                </span>

                <div>
                  <span>
                    VULNERABILITY
                  </span>

                  <strong>
                    {selectedCve.id}
                  </strong>

                  <small>
                    {selectedCve.vendor}{' '}
                    {selectedCve.product}
                  </small>
                </div>
              </div>

              <button
                type="button"
                className="at-cve-close"
                onClick={() =>
                  setSelectedCveId(
                    null,
                  )
                }
                aria-label="Close CVE inspector"
              >
                <X size={15} />
              </button>
            </div>

            {/* -------------------------------------------------------------- */
            /* Metadata                                                         */
            /* -------------------------------------------------------------- */}

            <div className="at-cve-inspector-meta">
              <span
                className={`at-cve-inspector-score ${selectedCve.severity}`}
              >
                CVSS{' '}
                {Number(
                  selectedCve.cvss,
                ).toFixed(1)}
              </span>

              <span
                className={`at-cve-inspector-severity ${selectedCve.severity}`}
              >
                <i />
                {selectedCve.severity}
              </span>

              {selectedCve.exploitAvailable && (
                <span className="at-cve-exploit-badge">
                  <Target size={10} />
                  EXPLOIT AVAILABLE
                </span>
              )}
            </div>

            {/* -------------------------------------------------------------- */
            /* Tabs                                                             */
            /* -------------------------------------------------------------- */}

            <div
              className="at-cve-tabs"
              role="tablist"
              aria-label="CVE details"
            >
              {(
                [
                  'Overview',
                  'Affected Systems',
                  'References',
                ] as const
              ).map((tab) => {
                const active =
                  inspectorTab === tab;

                return (
                  <button
                    type="button"
                    key={tab}
                    className={
                      active
                        ? 'active'
                        : ''
                    }
                    onClick={() =>
                      setInspectorTab(tab)
                    }
                    role="tab"
                    aria-selected={
                      active
                    }
                  >
                    {tab}
                  </button>
                );
              })}
            </div>

            {/* -------------------------------------------------------------- */
            /* Scrollable content                                              */
            /* -------------------------------------------------------------- */}

            <div className="at-cve-inspector-scroll">
              {inspectorTab ===
                'Overview' && (
                  <div className="at-cve-inspector-content">
                    {/* Description */}

                    <section className="at-cve-inspector-block">
                      <div className="at-cve-block-title">
                        <span>
                          DESCRIPTION
                        </span>
                      </div>

                      <div className="at-cve-description-panel">
                        {
                          selectedCve.description
                        }
                      </div>
                    </section>

                    {/* Profile */}

                    <section className="at-cve-inspector-block">
                      <div className="at-cve-block-title">
                        <span>
                          VULNERABILITY PROFILE
                        </span>

                        <ShieldAlert
                          size={12}
                        />
                      </div>

                      <div className="at-cve-profile-grid">
                        <div>
                          <span>CVE ID</span>

                          <code>
                            {selectedCve.id}
                          </code>
                        </div>

                        <div>
                          <span>CVSS</span>

                          <strong>
                            {Number(
                              selectedCve.cvss,
                            ).toFixed(1)}
                          </strong>
                        </div>

                        <div>
                          <span>
                            SEVERITY
                          </span>

                          <strong className="capitalize">
                            {
                              selectedCve.severity
                            }
                          </strong>
                        </div>

                        <div>
                          <span>
                            PRODUCT
                          </span>

                          <strong>
                            {
                              selectedCve.product
                            }
                          </strong>
                        </div>

                        <div>
                          <span>VENDOR</span>

                          <strong>
                            {
                              selectedCve.vendor
                            }
                          </strong>
                        </div>

                        <div>
                          <span>
                            PUBLISHED
                          </span>

                          <code>
                            {formatDate(
                              selectedCve.published,
                            )}
                          </code>
                        </div>
                      </div>
                    </section>

                    {/* Exploit status */}

                    <section className="at-cve-inspector-block">
                      <div className="at-cve-block-title">
                        <span>
                          EXPLOIT STATUS
                        </span>

                        <Target size={12} />
                      </div>

                      <div
                        className={`at-cve-exploit-status ${selectedCve.exploitAvailable
                            ? 'available'
                            : 'unavailable'
                          }`}
                      >
                        <span>
                          {selectedCve.exploitAvailable ? (
                            <Target
                              size={14}
                            />
                          ) : (
                            <ShieldCheck
                              size={14}
                            />
                          )}
                        </span>

                        <div>
                          <strong>
                            {selectedCve.exploitAvailable
                              ? 'Exploit available'
                              : 'No exploit recorded'}
                          </strong>

                          <small>
                            {selectedCve.exploitAvailable
                              ? 'This vulnerability is marked as having an available exploit in the current dataset.'
                              : 'The current dataset does not mark an available exploit for this CVE.'}
                          </small>
                        </div>
                      </div>
                    </section>

                    {/* Publication */}

                    <section className="at-cve-inspector-block">
                      <div className="at-cve-block-title">
                        <span>
                          PUBLICATION
                        </span>

                        <CalendarDays
                          size={12}
                        />
                      </div>

                      <div className="at-cve-publication">
                        <div>
                          <span>
                            Published
                          </span>

                          <code>
                            {formatDateTime(
                              selectedCve.published,
                            )}
                          </code>
                        </div>
                      </div>
                    </section>
                  </div>
                )}

              {/* ------------------------------------------------------------ */
              /* Affected systems                                             */
              /* ------------------------------------------------------------ */}

              {inspectorTab ===
                'Affected Systems' && (
                  <div className="at-cve-empty-state">
                    <Server size={23} />

                    <strong>
                      No affected systems
                      recorded
                    </strong>

                    <span>
                      The current CVE data model does
                      not include internal asset
                      exposure for this vulnerability.
                    </span>
                  </div>
                )}

              {/* ------------------------------------------------------------ */
              /* References                                                    */
              /* ------------------------------------------------------------ */}

              {inspectorTab ===
                'References' && (
                  <div className="at-cve-empty-state">
                    <ExternalLink
                      size={22}
                    />

                    <strong>
                      External CVE record
                    </strong>

                    <span>
                      The current dataset does not
                      include reference URLs. Open
                      the authoritative NVD record
                      using the action below.
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        openNvdRecord(
                          selectedCve.id,
                        )
                      }
                    >
                      Open NVD Record
                      <ExternalLink
                        size={12}
                      />
                    </button>
                  </div>
                )}
            </div>

            {/* -------------------------------------------------------------- */
            /* Footer                                                          */
            /* -------------------------------------------------------------- */}

            <div className="at-cve-inspector-footer">
              <button
                type="button"
                className="at-btn at-btn-secondary"
                onClick={() =>
                  openNvdRecord(
                    selectedCve.id,
                  )
                }
              >
                View NVD Record
                <ExternalLink size={12} />
              </button>

              <button
                type="button"
                className="at-btn at-btn-primary"
                onClick={() => {
                  setInspectorTab(
                    'Overview',
                  );

                  /*
                   * The current CVE page has no navigation prop and there is
                   * no CVE-specific analysis route in its component contract.
                   * Keeping this action local avoids inventing a broken route.
                   */
                  document
                    .querySelector(
                      '.at-cve-inspector',
                    )
                    ?.scrollTo({
                      top: 0,
                      behavior: 'smooth',
                    });
                }}
              >
                <ArrowUpRight
                  size={12}
                />
                Open Analysis
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

