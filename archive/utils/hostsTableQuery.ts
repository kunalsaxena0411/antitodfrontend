import type { HostsV3SortBy, HostsV3SortOrder } from '../api/services/honeypotService';

export type HostsTableColumnSort = 'risk' | 'threat_score' | 'last_seen';

const LEGACY_QS_KEYS = ['h_sort', 'h_order', 'h_page', 'h_limit'] as const;

/** Removes hosts-table query params from the URL (table state stays in React only). */
export function stripHostsTableQueryParamsFromUrl(): void {
  if (typeof window === 'undefined') return;
  const u = new URL(window.location.href);
  let changed = false;
  for (const k of LEGACY_QS_KEYS) {
    if (u.searchParams.has(k)) {
      u.searchParams.delete(k);
      changed = true;
    }
  }
  if (changed) {
    const next = u.pathname + (u.search ? u.search : '') + u.hash;
    window.history.replaceState(null, '', next);
  }
}

const DEFAULT_SORT: HostsV3SortBy = 'threat_score';

/** Maps UI column id to API `sort_by`. */
export function columnIdToSortBy(column: HostsTableColumnSort): HostsV3SortBy {
  switch (column) {
    case 'risk':
      return 'risk_level';
    case 'threat_score':
      return 'threat_score';
    case 'last_seen':
      return 'last_seen';
    default:
      return DEFAULT_SORT;
  }
}

export function sortLabelForColumn(sortBy: HostsV3SortBy, sortOrder: HostsV3SortOrder): string {
  const ord = sortOrder === 'asc' ? 'low → high' : 'high → low';
  switch (sortBy) {
    case 'risk_level':
      return `Risk ${sortOrder === 'asc' ? '(low first)' : '(critical first)'}`;
    case 'threat_score':
      return `Risk score ${ord}`;
    case 'last_seen':
      return sortOrder === 'asc' ? 'Last seen (oldest first)' : 'Last seen (newest first)';
    default:
      return 'Sort';
  }
}
