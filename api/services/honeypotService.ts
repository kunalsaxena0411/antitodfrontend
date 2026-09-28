import api from '../client';
import { API_ENDPOINTS } from '../../config/config';

// ============================================
// V2 API Types (ClickHouse-based)
// ============================================

export interface HoneyPotLogV2 {
    timestamp: string;
    honeypot: string;
    event_type: string;
    src_ip: string;
    src_port?: number;
    dst_port?: number;
    username?: string;
    password?: string;
    session_id?: string;
    command?: string;
    raw_log?: string | object;
}

export interface IngestLogsV2Request {
    logs: HoneyPotLogV2[];
}

export interface IngestLogsV2Response {
    success: boolean;
    ingested: number;
    enriched_entities: string[];
    timestamp: string;
}

export interface LogEventV2 {
    event_id: string;
    timestamp: string;
    honeypot: string;
    event_type: string;
    src_ip: string;
    src_port: number | null;
    dst_ip?: string;
    dst_port: number | null;
    protocol?: string;
    transport?: string;
    session_id?: string;
    honeypot_data?: string;
    server_id?: string;
    container_name?: string;
    id?: string;
    country?: string | null;
    countryCode?: string | null;
    asn?: string | null;
    severity?: string;
    geo_country?: string | null;
    geo_city?: string | null;
    geo_lat?: number | null;
    geo_lon?: number | null;
    asn_number?: number | null;
    asn_org?: string | null;
    ip_is_cloud?: boolean | null;
    ip_is_tor?: boolean | null;
    ip_is_private?: boolean | null;
    threat?: {
        threat_score: number;
        risk_level: string;
        detections: string[];
    };
    // Support flattened fields if present
    username?: string;
    password?: string;
    command?: string;
    threat_score?: number;
    is_suspicious?: boolean;
}

export interface GetLogEventsV2Params {
    limit?: number;
    offset?: number;
    honeypot?: string;
    event_type?: string;
    src_ip?: string;
    start_time?: string;
    end_time?: string;
}

export interface GetLogEventsV2Response {
    success?: boolean;
    events: LogEventV2[];
    total: number;
    limit: number;
    offset: number;
}

export interface EntityThreatIntelV2 {
    success: boolean;
    entity_id: string;
    entity_type: string;
    threat_score: number;
    risk_level: string;
    first_seen: string;
    last_seen: string;
    total_events: number;
    event_breakdown: Record<string, number>;
    honeypots_targeted: string[];
    top_usernames: Array<{ username: string; count: number }>;
    top_passwords: Array<{ password: string; count: number }>;
    suspicious_behaviors: string[];
    external_threat_intel?: {
        abuseipdb?: {
            abuse_confidence_score: number;
            total_reports: number;
            last_reported: string;
        };
    };
    recommendations: string[];
}

export interface GetProxyLogsResponse {
    success: boolean;
    logs: any[];
    total: number;
    limit: number;
    offset: number;
    stats: {
        totalInMemory: number;
        capacity: number;
        oldestLog: string;
        newestLog: string;
    };
}

export interface LogStatsV2Params {
    time_range?: '1h' | '24h' | '7d' | '30d' | 'all';
    group_by?: 'honeypot' | 'event_type' | 'hour' | 'day';
}

export interface LogStatsV2Response {
    success: boolean;
    time_range: string;
    start_time: string;
    end_time: string;
    total_events: number;
    unique_source_ips: number;
    unique_targets: number;
    top_honeypots: Array<{ name: string; count: number; percentage: number }>;
    top_event_types: Array<{ type: string; count: number; percentage: number }>;
    top_attacking_ips: Array<{
        ip: string;
        count: number;
        threat_score: number;
        country?: string
    }>;
    geographic_distribution: Array<{ country: string; count: number; percentage: number }>;
    hourly_distribution?: Array<{ hour: string; count: number }>;
    high_threat_entities: number;
    new_attackers_24h: number;
}

// ============================================
// V2 API Service
// ============================================

export const honeypotServiceV2 = {
    /**
     * Ingest honeypot logs (V2) - Shipper only
     */
    async ingestLogs(data: IngestLogsV2Request): Promise<IngestLogsV2Response> {
        const response = await api.post<IngestLogsV2Response>(
            API_ENDPOINTS.INGEST_LOGS_V2,
            data
        );
        return response.data;
    },

    /**
     * Get log events with filtering and pagination (V2)
     */
    async getLogEvents(params?: GetLogEventsV2Params): Promise<GetLogEventsV2Response> {
        const response = await api.get<GetLogEventsV2Response>(
            API_ENDPOINTS.GET_LOG_EVENTS_V2,
            { params }
        );
        return response.data;
    },

    /**
     * Get threat intelligence for a specific entity (IP address) (V2)
     */
    async getEntityThreatIntel(entityId: string): Promise<EntityThreatIntelV2> {
        const endpoint = API_ENDPOINTS.GET_ENTITY_THREAT_INTEL_V2.replace(':entity_id', entityId);
        const response = await api.get<EntityThreatIntelV2>(
            `${endpoint}/${entityId}`
        );
        return response.data;
    },

    /**
     * Get aggregated log statistics (V2)
     */
    async getLogStats(params?: LogStatsV2Params): Promise<LogStatsV2Response> {
        const response = await api.get<LogStatsV2Response>(
            API_ENDPOINTS.GET_LOG_STATS_V2,
            { params }
        );
        return response.data;
    },

    /**
     * Get real-time proxy logs (V2)
     */
    async getProxyLogs(): Promise<GetProxyLogsResponse> {
        const response = await api.get<GetProxyLogsResponse>(
            API_ENDPOINTS.GET_PROXY_LOGS_V2
        );
        return response.data;
    },
};

// ============================================
// V3 API Types (Latest - Aggregated & Optimized)
// ============================================

export interface HostV3 {
    src_ip: string;
    first_seen: string;
    last_seen: string;
    active_days: number;
    activity_dates: string[];
    total_events: number;
    total_commands: number;
    unique_sessions: number;
    threat_score: number;
    risk_level: 'low' | 'medium' | 'high' | 'critical';
    detection_labels: string[];
    geo_country: string;
    geo_city: string;
    geo_lat: number;
    geo_lon: number;
    asn_number: number;
    asn_org: string;
    ip_is_cloud: boolean;
    ip_is_tor: boolean;
    ip_is_private: boolean;
    honeypots_targeted: string[];
    last_updated: string;
    dns_hostname: string | null;
}

export type HostsV3SortBy = 'risk_level' | 'threat_score' | 'last_seen';
export type HostsV3SortOrder = 'asc' | 'desc';

export interface GetHostsV3Params {
    /** Case-insensitive substring search (preferred over `q`). Max 200 chars after trim on the server. */
    search?: string;
    /** Alias for `search` on the API; prefer `search` when building requests. */
    q?: string;
    risk_level?: 'low' | 'medium' | 'high' | 'critical';
    limit?: number;
    offset?: number;
    start_time?: string;
    end_time?: string;
    country?: string;
    honeypot?: string;
    detection_label?: string;
    threat_category?: string;
    sort_by?: HostsV3SortBy;
    sort_order?: HostsV3SortOrder;
}

export interface GetHostsV3Response {
    hosts: HostV3[];
    total: number;
    returned: number;
    limit: number;
    offset: number;
    has_more: boolean;
    sort_by?: string;
    sort_order?: string;
    /** Normalized search term applied by the API, or null if none. */
    search?: string | null;
}

/** Same filter/search fields as hosts, without pagination or sort (for threat map). */
export type ThreatMapV3Params = Pick<
    GetHostsV3Params,
    'search' | 'q' | 'risk_level' | 'country' | 'honeypot' | 'detection_label' | 'threat_category' | 'start_time' | 'end_time'
>;

export interface ThreatMapV3Response {
    search: string | null;
    filters?: { search?: string | null };
    [key: string]: unknown;
}

export interface HostDetailsV3 {
    host: HostV3;
    enrichment?: {
        geo: {
            country: string;
            city: string;
            lat: number;
            lon: number;
            timezone: string;
        };
        asn: {
            number: number;
            org: string;
        };
        flags: {
            is_cloud: boolean;
            is_tor: boolean;
            is_private: boolean;
            is_vpn: boolean;
            is_proxy: boolean;
        };
        reputation: {
            abuseipdb: {
                abuse_confidence_score: number;
                total_reports: number;
                country_code: string;
                usage_type: string;
                isp: string;
                domain: string;
                is_whitelisted: boolean;
            };
            otx: {
                pulse_count: number;
                pulses: Array<{
                    name: string;
                    description: string;
                    created: string;
                    tags: string[];
                }>;
            };
        };
    };
}

export interface GetHostDetailsV3Params {
    ip: string;
    include_enrichment?: boolean;
}

export interface GetHostDetailsV3Response extends HostDetailsV3 {}

export interface HostEventV3 {
    event_id: string;
    timestamp: string;
    honeypot: string;
    event_type: string;
    src_ip: string;
    src_port: number;
    dst_ip: string;
    dst_port: number;
    protocol: string;
    transport: string;
    session_id: string;
    honeypot_data: string;
}

export interface GetHostEventsV3Params {
    ip: string;
    limit?: number;
    offset?: number;
}

export interface GetHostEventsV3Response {
    events: HostEventV3[];
    total: number;
    returned: number;
    limit: number;
    offset: number;
    has_more: boolean;
}

export interface HostCommandV3 {
    command: string;
    frequency: number;
    first_seen: string;
    last_seen: string;
    honeypots: string[];
}

export interface GetHostCommandsV3Response {
    commands: HostCommandV3[];
    total: number;
}

export interface StatsV3 {
    total_hosts: number;
    total_events: number;
    hosts_by_risk: Array<{
        risk_level: 'low' | 'medium' | 'high' | 'critical';
        count: number;
    }>;
    top_countries: Array<{
        country: string;
        count: number;
    }>;
}

// ── V3 Filters ──────────────────────────────────────────────────────────────
export interface ThreatCategoryEntry {
    label: string;
    signal_type: string;
}

export interface HostFiltersV3 {
    risk_levels: string[];
    countries: string[];
    honeypots: string[];
    detection_labels: string[];
    threat_categories: ThreatCategoryEntry[];
    date_range: { min: string | null; max: string | null };
}

// ── V3 Timelines ─────────────────────────────────────────────────────────────
export interface TimelineBucket {
    time: string;
    total_events: number;
    event_types?: string[];
    honeypots?: string[];
}

export interface HostTimelineV3Response {
    ip: string;
    granularity: string;
    total_events: number;
    buckets: TimelineBucket[];
}

export interface GetHostTimelineV3Params {
    ip: string;
    granularity?: 'minute' | 'hour' | 'day';
    start_time?: string;
    end_time?: string;
    honeypot?: string;
}

export interface ActivityTimelineBucket extends TimelineBucket {
    unique_ips: number;
}

export interface ActivityTimelineV3Response {
    granularity: string;
    total_events: number;
    peak?: { time: string; events: number };
    buckets: ActivityTimelineBucket[];
}

export interface GetActivityTimelineV3Params {
    granularity?: 'minute' | 'hour' | 'day';
    start_time?: string;
    end_time?: string;
    honeypot?: string;
    event_type?: string;
}

const V3_HOSTS_SEARCH_MAX = 200;

/**
 * Builds GET /v3/hosts query string with URLSearchParams.
 * Sets `search` only when the trimmed value is non-empty (max 200 chars).
 */
export function buildGetHostsV3QueryParams(p?: GetHostsV3Params): URLSearchParams {
    const sp = new URLSearchParams();
    if (!p) return sp;
    const searchTrimmed = p.search?.trim();
    if (searchTrimmed) {
        sp.set('search', searchTrimmed.slice(0, V3_HOSTS_SEARCH_MAX));
    } else if (p.q?.trim()) {
        sp.set('q', p.q.trim().slice(0, V3_HOSTS_SEARCH_MAX));
    }
    if (p.risk_level) sp.set('risk_level', p.risk_level);
    if (p.limit !== undefined) sp.set('limit', String(p.limit));
    if (p.offset !== undefined) sp.set('offset', String(p.offset));
    if (p.start_time) sp.set('start_time', p.start_time);
    if (p.end_time) sp.set('end_time', p.end_time);
    if (p.country) sp.set('country', p.country);
    if (p.honeypot) sp.set('honeypot', p.honeypot);
    if (p.detection_label) sp.set('detection_label', p.detection_label);
    if (p.threat_category) sp.set('threat_category', p.threat_category);
    if (p.sort_by) sp.set('sort_by', p.sort_by);
    if (p.sort_order) sp.set('sort_order', p.sort_order);
    return sp;
}

/** Query string for GET /v3/threat-map (same search/filters as hosts, no pagination/sort). */
export function buildThreatMapV3QueryParams(p?: ThreatMapV3Params): URLSearchParams {
    const sp = new URLSearchParams();
    if (!p) return sp;
    const searchTrimmed = p.search?.trim();
    if (searchTrimmed) {
        sp.set('search', searchTrimmed.slice(0, V3_HOSTS_SEARCH_MAX));
    } else if (p.q?.trim()) {
        sp.set('q', p.q.trim().slice(0, V3_HOSTS_SEARCH_MAX));
    }
    if (p.risk_level) sp.set('risk_level', p.risk_level);
    if (p.start_time) sp.set('start_time', p.start_time);
    if (p.end_time) sp.set('end_time', p.end_time);
    if (p.country) sp.set('country', p.country);
    if (p.honeypot) sp.set('honeypot', p.honeypot);
    if (p.detection_label) sp.set('detection_label', p.detection_label);
    if (p.threat_category) sp.set('threat_category', p.threat_category);
    return sp;
}


// ============================================
// V3 API Service
// ============================================

export const honeypotServiceV3 = {
    /**
     * Get all hosts with threat analysis (V3)
     */
    async getHosts(params?: GetHostsV3Params): Promise<GetHostsV3Response> {
        const query = buildGetHostsV3QueryParams(params);
        const response = await api.get<GetHostsV3Response>(API_ENDPOINTS.GET_HOSTS_V3, { params: query });
        return response.data;
    },

    /**
     * Threat map (V3); same `search` / `q` and host filters as GET /v3/hosts.
     */
    async getThreatMap(params?: ThreatMapV3Params): Promise<ThreatMapV3Response> {
        const query = buildThreatMapV3QueryParams(params);
        const response = await api.get<ThreatMapV3Response>(API_ENDPOINTS.GET_THREAT_MAP_V3, { params: query });
        return response.data;
    },

    /**
     * Get detailed information about a specific IP (V3)
     */
    async getHostDetails(params: GetHostDetailsV3Params): Promise<GetHostDetailsV3Response> {
        const endpoint = API_ENDPOINTS.GET_HOST_DETAILS_V3.replace(':ip', params.ip);
        const response = await api.get<GetHostDetailsV3Response>(
            endpoint,
            { params: { include_enrichment: params.include_enrichment } }
        );
        return response.data;
    },

    /**
     * Get all events for a specific IP (V3)
     */
    async getHostEvents(params: GetHostEventsV3Params): Promise<GetHostEventsV3Response> {
        const endpoint = API_ENDPOINTS.GET_HOST_EVENTS_V3.replace(':ip', params.ip);
        const response = await api.get<GetHostEventsV3Response>(
            endpoint,
            { params: { limit: params.limit, offset: params.offset } }
        );
        return response.data;
    },

    /**
     * Get all commands executed by a specific IP (V3)
     */
    async getHostCommands(ip: string): Promise<GetHostCommandsV3Response> {
        const endpoint = API_ENDPOINTS.GET_HOST_COMMANDS_V3.replace(':ip', ip);
        const response = await api.get<GetHostCommandsV3Response>(endpoint);
        return response.data;
    },

    /**
     * Get dashboard statistics (V3)
     */
    async getStats(): Promise<StatsV3> {
        const response = await api.get<StatsV3>(API_ENDPOINTS.GET_STATS_V3);
        return response.data;
    },

    /**
     * Get dynamic filter options for hosts (V3)
     */
    async getHostFilters(): Promise<HostFiltersV3> {
        const response = await api.get<HostFiltersV3>(API_ENDPOINTS.GET_HOST_FILTERS_V3);
        return response.data;
    },

    /**
     * Get single-IP hit timeline (V3)
     */
    async getHostTimeline(params: GetHostTimelineV3Params): Promise<HostTimelineV3Response> {
        const endpoint = API_ENDPOINTS.GET_HOST_TIMELINE_V3.replace(':ip', params.ip);
        const { ip, ...queryParams } = params;
        const response = await api.get<HostTimelineV3Response>(endpoint, { params: queryParams });
        return response.data;
    },

    /**
     * Get global attack activity timeline (V3)
     */
    async getActivityTimeline(params?: GetActivityTimelineV3Params): Promise<ActivityTimelineV3Response> {
        const response = await api.get<ActivityTimelineV3Response>(API_ENDPOINTS.GET_ACTIVITY_TIMELINE_V3, { params });
        return response.data;
    },
};

// ============================================
// V1 API Types (Legacy - PostgreSQL-based)
// ============================================

export interface HoneyPotLogV1 {
    EventId: string;
    ServerId: string;
    ContainerId: string;
    ContainerName: string;
    HoneypotType: string;
    Image: string;
    Timestamp: string;
    RawLog: any;
}

export interface GetLogsV1Params {
    serverId?: string;
    honeypotType?: string;
    containerName?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
    sortOrder?: 'ASC' | 'DESC';
}

export interface GetLogsV1Response {
    message: string;
    count: number;
    totalCount: number;
    limit: number;
    offset: number;
    logs: HoneyPotLogV1[];
}

export interface GetLatestLogsV1Params {
    since?: string;
    limit?: number;
}

export interface GetLatestLogsV1Response {
    message: string;
    count: number;
    logs: HoneyPotLogV1[];
    timestamp: string;
}

export interface LogStatsV1Params {
    startDate?: string;
    endDate?: string;
    serverId?: string;
}

export interface LogStatsV1Response {
    message: string;
    stats: {
        totalLogs: number;
        logsByHoneypot: Array<{ HoneypotType: string; count: string }>;
        logsByServer: Array<{ ServerId: string; count: string }>;
        logsByContainer: Array<{ ContainerName: string; HoneypotType: string; count: string }>;
        logsOverTime: Array<{ hour: string; count: string }>;
    };
}

export interface HoneypotType {
    type: string;
}

export interface GetHoneypotTypesResponse {
    message: string;
    count: number;
    honeypotTypes: string[];
}

export interface HoneypotServer {
    ServerId: string;
    Hostname: string;
    PublicIp: string;
    Region: string;
    Provider: string;
    logCount: number;
}

export interface GetHoneypotServersResponse {
    message: string;
    count: number;
    servers: HoneypotServer[];
}

// ============================================
// V1 API Service (Legacy)
// ============================================

export const honeypotServiceV1 = {
    /**
     * Get honeypot logs (V1) - Legacy
     */
    async getLogs(params?: GetLogsV1Params): Promise<GetLogsV1Response> {
        const response = await api.get<GetLogsV1Response>(
            API_ENDPOINTS.GET_LOGS_V1,
            { params }
        );
        return response.data;
    },

    /**
     * Get latest logs for realtime polling (V1)
     */
    async getLatestLogs(params?: GetLatestLogsV1Params): Promise<GetLatestLogsV1Response> {
        const response = await api.get<GetLatestLogsV1Response>(
            API_ENDPOINTS.GET_LATEST_LOGS_V1,
            { params }
        );
        return response.data;
    },

    /**
     * Get log statistics (V1)
     */
    async getLogStats(params?: LogStatsV1Params): Promise<LogStatsV1Response> {
        const response = await api.get<LogStatsV1Response>(
            API_ENDPOINTS.GET_LOG_STATS_V1,
            { params }
        );
        return response.data;
    },

    /**
     * Get honeypot types
     */
    async getHoneypotTypes(): Promise<GetHoneypotTypesResponse> {
        const response = await api.get<GetHoneypotTypesResponse>(
            API_ENDPOINTS.GET_HONEYPOT_TYPES
        );
        return response.data;
    },

    /**
     * Get honeypot servers
     */
    async getHoneypotServers(): Promise<GetHoneypotServersResponse> {
        const response = await api.get<GetHoneypotServersResponse>(
            API_ENDPOINTS.GET_HONEYPOT_SERVERS
        );
        return response.data;
    },
};
