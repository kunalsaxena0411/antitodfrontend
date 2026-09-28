import api from '../client';

export type TargetType = 'DOMAIN' | 'CIDR' | 'IP';

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  archivedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  targetCount?: number;
  memberCount?: number;
  role?: string;
}

export interface Target {
  id: string;
  value: string;
  type: TargetType;
  workspaceId?: string;
  createdAt?: string;
  updatedAt?: string;
  lastDiscoveredAt?: string;
  [key: string]: unknown;
}

export interface Asset {
  id: string;
  type: string;
  value: string;
  workspaceId?: string;
  [key: string]: unknown;
}

export interface Vulnerability {
  id: string;
  title: string;
  severity: string;
  [key: string]: unknown;
}

export interface PaginatedResponse<T> {
  data: T[];
  total?: number;
  page?: number;
  limit?: number;
  pageCount?: number;
  hasNextPage?: boolean;
}

/** When the API only returns `data`, `total`, `page`, `limit` (1-based page), derive `pageCount` and `hasNextPage`. */
export function normalizePaginatedResponse<T>(raw: PaginatedResponse<T> | null | undefined): PaginatedResponse<T> {
  if (!raw) {
    return { data: [] as T[], total: 0, page: 1, limit: 10, pageCount: 1, hasNextPage: false };
  }
  const total = Number(raw.total ?? 0);
  const limit = Math.max(1, Number(raw.limit ?? 10));
  const page = Math.max(1, Number(raw.page ?? 1));
  const pageCount =
    raw.pageCount !== undefined && raw.pageCount !== null
      ? Math.max(1, Number(raw.pageCount))
      : total === 0
        ? 1
        : Math.max(1, Math.ceil(total / limit));
  const hasNextPage =
    raw.hasNextPage !== undefined && raw.hasNextPage !== null
      ? Boolean(raw.hasNextPage)
      : total > 0 && page * limit < total;

  return {
    ...raw,
    data: raw.data ?? [],
    total,
    page,
    limit,
    pageCount,
    hasNextPage,
  };
}

export interface WorkspaceQueryParams {
  page?: number;
  limit?: number;
  isArchived?: boolean;
}

export interface TargetQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  value?: string;
  type?: TargetType | '';
  status?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC' | 'asc' | 'desc';
}

/** Facet keys may be repeated in query string (e.g. multiple tlsHosts=). */
export type AsmFacetParam = string | string[];

export interface AssetQueryParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC' | 'asc' | 'desc';
  type?: string;
  search?: string;
  value?: string;
  targetIds?: string;
  ipAddresses?: AsmFacetParam;
  ports?: AsmFacetParam;
  hosts?: AsmFacetParam;
  techs?: AsmFacetParam;
  statusCodes?: AsmFacetParam;
  tlsHosts?: AsmFacetParam;
}

export interface VulnerabilityQueryParams {
  page?: number;
  limit?: number;
  severity?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC' | 'asc' | 'desc';
  search?: string;
  createdFrom?: string;
  createdTo?: string;
  targetIds?: string;
}

export type AssetGroupTab = 'all' | 'ip' | 'port' | 'tech' | 'status-code' | 'host' | 'tls';

export interface BulkCreateTargetItem {
  value: string;
  type?: TargetType;
}

export interface BulkCreateTargetsResponse {
  created?: Target[];
  skipped?: Array<Record<string, unknown>>;
  requestedCount?: number;
  createdCount?: number;
  skippedCount?: number;
  [key: string]: unknown;
}

export interface AssetGroupCreateResponse {
  id?: string;
  name?: string;
  [key: string]: unknown;
}

export interface SeverityStat {
  severity: string;
  count: number;
}

export interface AsmWorkerTool {
  id?: string;
  name?: string;
  description?: string;
  version?: string;
  logoUrl?: string;
  category?: string;
  [key: string]: unknown;
}

export interface AsmWorker {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  lastSeenAt?: string;
  currentJobsCount?: number;
  type?: string;
  scope?: string;
  tools?: AsmWorkerTool[];
  [key: string]: unknown;
}

export interface WorkerQueryParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC' | 'asc' | 'desc';
  workspaceId?: string;
}

export interface OpenAsmHealthResponse {
  status?: string;
  upstream?: Record<string, unknown>;
  session?: Record<string, unknown>;
  workspace?: Record<string, unknown>;
}

export interface OpenAsmApiError extends Error {
  response?: {
    status?: number;
    data?: {
      error?: string;
      detail?: string;
      issues?: { field?: string; message?: string }[];
      message?: string | string[];
    };
  };
}

export interface TlsAsset {
  host?: string;
  sni?: string;
  subject_dn?: string;
  subject_cn?: string;
  issuer_dn?: string;
  subject_an?: string[];
  not_after?: string;
  not_before?: string;
  tls_version?: string;
  cipher?: string;
  tls_connection?: string;
  [key: string]: unknown;
}

export interface StatisticsTimelinePoint {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
  assets?: number;
  targets?: number;
  vuls?: number;
  criticalVuls?: number;
  highVuls?: number;
  mediumVuls?: number;
  lowVuls?: number;
  infoVuls?: number;
  techs?: number;
  ports?: number;
  services?: number;
  score?: number | string;
  workspace?: { id?: string };
  [key: string]: unknown;
}

export interface IssuesTimelinePoint {
  date?: string;
  time?: string;
  count?: number;
  total?: number;
  [key: string]: unknown;
}

export interface AssetLocation {
  query?: string;
  status?: string;
  continent?: string;
  country?: string;
  countryCode?: string;
  lat?: number;
  lon?: number;
  isp?: string;
  org?: string;
  as?: string;
  asname?: string;
  [key: string]: unknown;
}

class OpenAsmClient {
  private withWorkspaceHeader(workspaceId: string) {
    return { headers: { 'X-Workspace-Id': workspaceId } };
  }

  private normalizeSortOrder<T extends { sortOrder?: string }>(params?: T): T | undefined {
    if (!params?.sortOrder) return params;
    return { ...params, sortOrder: params.sortOrder.toUpperCase() };
  }

  private cleanParams<T extends object>(params?: T): T | undefined {
    if (!params) return params;
    const cleaned = Object.fromEntries(
      Object.entries(params as Record<string, unknown>).filter(([, v]) => v !== '' && v !== undefined && v !== null),
    ) as T;
    return cleaned;
  }

  /** Flatten params for ASM: omit empties; arrays become repeated keys in the query string. */
  private prepareAsmAssetParams(params?: AssetQueryParams): Record<string, string | number | string[]> | undefined {
    const normalized = this.normalizeSortOrder(params) as AssetQueryParams | undefined;
    if (!normalized) return undefined;
    const out: Record<string, string | number | string[]> = {};
    for (const [k, v] of Object.entries(normalized as Record<string, unknown>)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) {
        const arr = v.map(String).map((s) => s.trim()).filter(Boolean);
        if (arr.length) out[k] = arr;
      } else if (typeof v === 'string') {
        if (v.trim() === '' && k !== 'value' && k !== 'search') continue;
        out[k] = v;
      } else if (typeof v === 'number' && !Number.isNaN(v)) {
        out[k] = v;
      }
    }
    return Object.keys(out).length ? out : undefined;
  }

  private serializeAsmAssetParams(params: Record<string, unknown>): string {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) {
        for (const item of v) {
          if (item !== undefined && item !== null && String(item).trim() !== '') sp.append(k, String(item));
        }
      } else if (v !== '') {
        sp.append(k, String(v));
      }
    }
    return sp.toString();
  }

  private assetGetConfig(params?: AssetQueryParams) {
    const prepared = this.prepareAsmAssetParams(params) ?? {};
    return {
      params: prepared,
      paramsSerializer: (p: Record<string, unknown>) => this.serializeAsmAssetParams(p),
    };
  }

  async getActiveWorkspace() {
    const response = await api.get<{ workspaceId: string }>('/asm/active-workspace');
    return response.data;
  }

  /** Optional BFF route; fails silently in UI if not implemented. */
  async getMetadata() {
    const response = await api.get<Record<string, unknown>>('/asm/metadata');
    return response.data;
  }

  async listWorkspaces(params?: WorkspaceQueryParams) {
    const response = await api.get<PaginatedResponse<Workspace>>('/asm/workspaces', { params });
    return normalizePaginatedResponse(response.data);
  }

  async createWorkspace(body: { name: string; description?: string }) {
    const response = await api.post<Workspace>('/asm/workspaces', body);
    return response.data;
  }

  async getWorkspaceById(id: string) {
    const response = await api.get<Workspace>(`/asm/workspaces/${encodeURIComponent(id)}`);
    return response.data;
  }

  async listTargets(
    params?: TargetQueryParams,
    workspaceId?: string,
  ) {
    const normalized = this.cleanParams(this.normalizeSortOrder(params));
    const response = await api.get<PaginatedResponse<Target>>('/asm/targets', {
      params: normalized,
      ...(workspaceId ? this.withWorkspaceHeader(workspaceId) : {}),
    });
    return normalizePaginatedResponse(response.data);
  }

  async createTarget(body: { value: string; type?: TargetType }, workspaceId: string) {
    const response = await api.post<Target>('/asm/targets', body, this.withWorkspaceHeader(workspaceId));
    return response.data;
  }

  async createTargetsBulk(body: { targets: BulkCreateTargetItem[] }, workspaceId: string) {
    const response = await api.post<BulkCreateTargetsResponse>('/asm/targets/bulk', body, this.withWorkspaceHeader(workspaceId));
    return response.data;
  }

  async getTargetById(id: string, workspaceId?: string) {
    const response = await api.get<Target>(`/asm/targets/${encodeURIComponent(id)}`, {
      ...(workspaceId ? this.withWorkspaceHeader(workspaceId) : {}),
    });
    return response.data;
  }

  async triggerVulnerabilityScan(targetId: string, workspaceId: string) {
    const response = await api.post<{ message?: string }>(
      '/asm/vulnerabilities/scan',
      { targetId },
      this.withWorkspaceHeader(workspaceId),
    );
    return response.data;
  }

  async updateTarget(id: string, body: { scanSchedule?: string }, workspaceId: string) {
    const response = await api.patch<Target>(
      `/asm/targets/${encodeURIComponent(id)}`,
      body,
      this.withWorkspaceHeader(workspaceId),
    );
    return response.data;
  }

  async rescanTarget(id: string, workspaceId: string) {
    const response = await api.post<{ message?: string }>(
      `/asm/targets/${encodeURIComponent(id)}/re-scan`,
      {},
      this.withWorkspaceHeader(workspaceId),
    );
    return response.data;
  }

  async deleteTargetFromWorkspace(id: string, workspaceId: string) {
    const response = await api.delete<{ message?: string }>(
      `/asm/targets/${encodeURIComponent(id)}/workspace/${encodeURIComponent(workspaceId)}`,
      this.withWorkspaceHeader(workspaceId),
    );
    return response.data;
  }

  async listAssets(
    params?: AssetQueryParams,
    workspaceId?: string,
  ) {
    const { params: p, paramsSerializer } = this.assetGetConfig(params);
    const response = await api.get<PaginatedResponse<Asset>>('/asm/assets', {
      params: p,
      paramsSerializer,
      ...(workspaceId ? this.withWorkspaceHeader(workspaceId) : {}),
    });
    return normalizePaginatedResponse(response.data);
  }

  async listAssetsByGroup(
    group: AssetGroupTab,
    params?: AssetQueryParams,
    workspaceId?: string,
  ) {
    const path = group === 'all' ? '/asm/assets' : `/asm/assets/${group}`;
    const { params: p, paramsSerializer } = this.assetGetConfig(params);
    const response = await api.get<PaginatedResponse<Asset>>(path, {
      params: p,
      paramsSerializer,
      ...(workspaceId ? this.withWorkspaceHeader(workspaceId) : {}),
    });
    return normalizePaginatedResponse(response.data);
  }

  async exportAssetServices(
    params?: AssetQueryParams,
    workspaceId?: string,
  ) {
    const headers: Record<string, string> = {
      Accept: 'text/csv,application/vnd.ms-excel,text/plain',
    };
    if (workspaceId) {
      Object.assign(headers, this.withWorkspaceHeader(workspaceId).headers as Record<string, string>);
    }
    const { params: p, paramsSerializer } = this.assetGetConfig(params);
    const response = await api.get<Blob>('/asm/assets/services/export', {
      params: p,
      paramsSerializer,
      responseType: 'blob',
      headers,
    });
    return response;
  }

  async getAssetById(id: string, workspaceId: string) {
    const response = await api.get<Asset>(
      `/asm/assets/${encodeURIComponent(id)}`,
      this.withWorkspaceHeader(workspaceId),
    );
    return response.data;
  }

  async updateAsset(id: string, body: { tags?: string[] }, workspaceId: string) {
    const response = await api.patch<Asset>(
      `/asm/assets/${encodeURIComponent(id)}`,
      body,
      this.withWorkspaceHeader(workspaceId),
    );
    return response.data;
  }

  async switchAsset(body: { assetId: string; enabled: boolean }, workspaceId: string) {
    const response = await api.post<{ message?: string }>(
      '/asm/assets/switch',
      body,
      this.withWorkspaceHeader(workspaceId),
    );
    return response.data;
  }

  async generateAssetTags(body: { domain: string }, workspaceId: string) {
    const response = await api.post<{ tags?: string[] }>(
      '/asm/ai-assistant/generate-tags',
      body,
      this.withWorkspaceHeader(workspaceId),
    );
    return response.data;
  }

  async createAssetGroup(body: { name: string }, workspaceId: string) {
    const response = await api.post<AssetGroupCreateResponse>(
      '/asm/asset-group',
      body,
      this.withWorkspaceHeader(workspaceId),
    );
    return response.data;
  }

  async listWorkers(params?: WorkerQueryParams, workspaceId?: string) {
    const response = await api.get<PaginatedResponse<AsmWorker>>('/asm/workers', {
      params: this.cleanParams(this.normalizeSortOrder(params)),
      ...(workspaceId ? this.withWorkspaceHeader(workspaceId) : {}),
    });
    return normalizePaginatedResponse(response.data);
  }

  async listVulnerabilities(
    params?: VulnerabilityQueryParams,
    workspaceId?: string,
  ) {
    const response = await api.get<PaginatedResponse<Vulnerability>>('/asm/vulnerabilities', {
      params: this.cleanParams(this.normalizeSortOrder(params)),
      ...(workspaceId ? this.withWorkspaceHeader(workspaceId) : {}),
    });
    return normalizePaginatedResponse(response.data);
  }

  async getVulnerabilityStatistics(workspaceId: string, params?: { targetIds?: string }) {
    const response = await api.get<{ data: SeverityStat[] }>(
      '/asm/vulnerabilities/statistics',
      {
        params: this.cleanParams({ workspaceId, ...params }),
        ...this.withWorkspaceHeader(workspaceId),
      },
    );
    return response.data;
  }

  async getVulnerabilityById(id: string, workspaceId: string) {
    const response = await api.get<Vulnerability>(
      `/asm/vulnerabilities/${encodeURIComponent(id)}`,
      this.withWorkspaceHeader(workspaceId),
    );
    return response.data;
  }

  async dismissVulnerabilities(
    body: { ids: string[]; reason: string; comment?: string },
    workspaceId: string,
  ) {
    const response = await api.post<Record<string, unknown>>(
      '/asm/vulnerabilities/dismiss',
      body,
      this.withWorkspaceHeader(workspaceId),
    );
    return response.data;
  }

  async reopenVulnerabilities(body: { ids: string[] }, workspaceId: string) {
    const response = await api.post<Record<string, unknown>>(
      '/asm/vulnerabilities/reopen',
      body,
      this.withWorkspaceHeader(workspaceId),
    );
    return response.data;
  }

  async getStatistics(workspaceId: string) {
    const response = await api.get<Record<string, unknown>>('/asm/statistics', {
      params: { workspaceId },
      ...this.withWorkspaceHeader(workspaceId),
    });
    return response.data;
  }

  async getStatisticsTimeline(workspaceId: string) {
    const response = await api.get<{ data: StatisticsTimelinePoint[]; total?: number }>(
      '/asm/statistics/timeline',
      {
        params: { workspaceId },
        ...this.withWorkspaceHeader(workspaceId),
      },
    );
    return response.data;
  }

  async getIssuesTimeline(workspaceId: string) {
    const response = await api.get<{ data: IssuesTimelinePoint[]; total?: number }>(
      '/asm/statistics/issues-timeline',
      {
        params: { workspaceId },
        ...this.withWorkspaceHeader(workspaceId),
      },
    );
    return response.data;
  }

  async getAssetLocations(workspaceId: string) {
    const response = await api.get<AssetLocation[]>(
      '/asm/statistics/asset-locations',
      {
        params: { workspaceId },
        ...this.withWorkspaceHeader(workspaceId),
      },
    );
    return response.data;
  }

  async getTlsAssets(
    params: AssetQueryParams,
    workspaceId: string,
  ) {
    const { params: p, paramsSerializer } = this.assetGetConfig(params);
    const response = await api.get<PaginatedResponse<TlsAsset>>('/asm/assets/tls', {
      params: p,
      paramsSerializer,
      ...this.withWorkspaceHeader(workspaceId),
    });
    return normalizePaginatedResponse(response.data);
  }

  async getTopAssetsVulnerabilities(workspaceId: string) {
    const response = await api.get<Record<string, unknown>[]>(
      '/asm/statistics/top-assets-vulnerabilities',
      {
        params: { workspaceId },
        ...this.withWorkspaceHeader(workspaceId),
      },
    );
    return response.data;
  }

  async getTopTagsAssets(workspaceId: string) {
    const response = await api.get<Record<string, unknown>[]>(
      '/asm/statistics/top-tags-assets',
      {
        params: { workspaceId },
        ...this.withWorkspaceHeader(workspaceId),
      },
    );
    return response.data;
  }

  async getVulnerabilitiesStatistics(workspaceId: string) {
    const response = await api.get<{ data: { severity: string; count: number }[] }>(
      '/asm/vulnerabilities/statistics',
      {
        params: { workspaceId },
        ...this.withWorkspaceHeader(workspaceId),
      },
    );
    return response.data;
  }

  async getHealth() {
    const response = await api.get<OpenAsmHealthResponse>('/internal/openasm/health');
    return response.data;
  }

  async bootstrap() {
    const response = await api.post<{ success: boolean; activeWorkspaceId: string; bootstrappedAt: string }>(
      '/internal/openasm/bootstrap',
      {},
    );
    return response.data;
  }
}

export const openasm = new OpenAsmClient();
