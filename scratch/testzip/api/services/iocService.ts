import api from '../client';
import { API_ENDPOINTS } from '../../config/config';

// ============================================
// IOC API Types
// ============================================

export interface IocStats {
    total_indicators: number;
    active_network_iocs: number;
    file_hashes: number;
    new_24h: number;
}

export interface IocStatsResponse {
    success: boolean;
    data: IocStats;
}

export type IocIndicatorType = 'ip' | 'network' | 'domain' | 'url' | 'hash' | string;
export type IocSeverity = 'critical' | 'high' | 'medium' | 'low' | string;
export type IocSource =
    | 'abuseipdb'
    | 'urlhaus'
    | 'malwarebazaar'
    | 'spamhaus'
    | 'alienvault_otx'
    | string;

export interface IocFeedItem {
    indicator_type: IocIndicatorType;
    indicator_value: string;
    source: IocSource;
    threat: string;
    severity: IocSeverity;
    confidence: number;
    tags: string[];
    loc: string | null;
    first_seen: string;
    last_seen: string;
    ingested_at: string;
}

export interface GetIocFeedParams {
    search?: string;
    source?: string;
    type?: 'network' | 'hash' | 'all';
    threat?: string;
    loc?: string;
    page?: number;
    limit?: number;
    sortBy?: 'age' | 'confidence' | 'severity';
    sortDir?: 'asc' | 'desc';
}

export interface IocFeedResponse {
    success: boolean;
    data: IocFeedItem[];
    total: number;
    page: number;
    limit: number;
    pages: number;
}

export interface IocFiltersResponse {
    success: boolean;
    data: {
        sources: string[];
        threats: string[];
        locs: string[];
    };
}

export interface IocSyncBody {
    source?: IocSource;
}

export interface IocSyncResponse {
    success: boolean;
    data: {
        summary: Record<string, number>;
        total: number;
    };
}

export const sourceLabels: Record<string, string> = {
    abuseipdb: 'AbuseIPDB',
    urlhaus: 'URLhaus',
    malwarebazaar: 'MalwareBazaar',
    spamhaus: 'Spamhaus',
    alienvault_otx: 'AlienVault OTX',
};

// ============================================
// IOC API Service
// ============================================

export const iocService = {
    /** Dashboard stat cards */
    async getStats(): Promise<IocStatsResponse> {
        const response = await api.get<IocStatsResponse>(API_ENDPOINTS.IOC_STATS);
        return response.data;
    },

    /** Paginated, filterable feed */
    async getFeed(params?: GetIocFeedParams): Promise<IocFeedResponse> {
        const response = await api.get<IocFeedResponse>(API_ENDPOINTS.IOC_FEED, { params });
        return response.data;
    },

    /** Filter dropdown options */
    async getFilters(): Promise<IocFiltersResponse> {
        const response = await api.get<IocFiltersResponse>(API_ENDPOINTS.IOC_FILTERS);
        return response.data;
    },

    /** Force re-sync one or all sources */
    async sync(body: IocSyncBody = {}): Promise<IocSyncResponse> {
        const response = await api.post<IocSyncResponse>(API_ENDPOINTS.IOC_SYNC, body);
        return response.data;
    },
};
