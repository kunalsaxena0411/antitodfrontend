import {
  DEMO_CVES,
  DEMO_ACTORS,
  DEMO_IOCS,
  DEMO_EVENTS,
  DEMO_INVESTIGATIONS,
  DEMO_RULES,
  DEMO_PLAYBOOKS,
  DEMO_NEWS,
  DEMO_DASHBOARD,
  DEMO_HOSTS,
  DEMO_CVE_FEEDS,
  DEMO_INTEL_HISTORY,
} from '../data/demo';

import { fetchThreatNews } from '../../services/news';
import { fetchCveUpdates } from '../../services/cve';
import { fetchRemoteMalpedia } from '../../services/malpedia';
import { isPublicDemo } from '../utils/demoMode';

import {
  honeypotServiceV3,
  honeypotServiceV2,
  iocService,
  type HostV3,
  type GetHostsV3Params,
  type GetHostsV3Response,
  type GetHostDetailsV3Params,
  type GetHostDetailsV3Response,
  type GetHostEventsV3Params,
  type GetHostEventsV3Response,
  type GetHostTimelineV3Params,
  type HostTimelineV3Response,
  type HostFiltersV3,
  type StatsV3,
  type ActivityTimelineV3Response,
  type GetActivityTimelineV3Params,
  type ThreatMapV3Params,
  type ThreatMapV3Response,
  type LogEventV2,
  type GetLogEventsV2Params,
  type GetLogEventsV2Response,
  type LogStatsV2Params,
  type LogStatsV2Response,
  type IocStatsResponse,
  type IocFeedResponse,
  type GetIocFeedParams,
  type IocFiltersResponse,
} from '../../api/services';

import type { AnalyzedHost } from '../../types';

export { isPublicDemo };
export const DEMO_MODE = false;

/**
 * Transforms a backend HostV3 object into an AnalyzedHost compatible with existing views.
 */
export function transformHostV3ToAnalyzedHost(host: HostV3): AnalyzedHost {
  return {
    ip: host.src_ip,
    country: host.geo_country || 'Unknown',
    countryCode: (host as any).geo_country_code || undefined,
    totalScore: host.threat_score || 0,
    signatures: (host.detection_labels || []).map((label) => ({
      name: label,
      category: 'Honeypot Detection',
      severity: (host.risk_level?.toUpperCase() as any) || 'MEDIUM',
      description: `Observed on honeypots: ${(host.honeypots_targeted || []).join(', ')}`,
      weight: 10,
    })),
    riskLevel: (host.risk_level?.toUpperCase() as any) || 'LOW',
    rawCommands: [],
    activeDays: host.active_days || 1,
    firstSeen: host.first_seen,
    lastSeen: host.last_seen,
    timeline: {},
    dnsHostname: host.dns_hostname,
    asn: host.asn_org || (host.asn_number ? `AS${host.asn_number}` : undefined),
    org: host.asn_org,
    eventCount: host.total_events || 0,
    honeypots_targeted: host.honeypots_targeted || [],
    total_commands: host.total_commands,
    isCloud: host.ip_is_cloud,
    isTor: host.ip_is_tor,
  } as any;
}

/**
 * Facade provider connecting pages to live backend APIs.
 * Only falls back to DEMO_* datasets when isPublicDemo() is explicitly true (Task 62).
 * Real customer accounts always receive live data, or clean empty states when no honeypots exist.
 */
export const dataProvider = {
  /* ========================================================================
   * HOSTS API (V3)
   * ======================================================================== */

  /**
   * Fetch attacking hosts. Returns AnalyzedHost array for existing UI views.
   */
  getHosts: async (params?: GetHostsV3Params): Promise<AnalyzedHost[]> => {
    if (isPublicDemo()) return DEMO_HOSTS;
    try {
      const resp = await honeypotServiceV3.getHosts(params);
      if (resp && Array.isArray(resp.hosts)) {
        return resp.hosts.map(transformHostV3ToAnalyzedHost);
      }
    } catch (err) {
      console.warn('[dataProvider] Failed to fetch live hosts:', err);
    }
    return [];
  },

  /**
   * Fetch raw HostV3 response including pagination counters.
   */
  getRawHostsV3: async (params?: GetHostsV3Params): Promise<GetHostsV3Response> => {
    if (isPublicDemo()) {
      return {
        hosts: DEMO_HOSTS.map((h) => ({
          src_ip: h.ip,
          first_seen: h.firstSeen,
          last_seen: h.lastSeen,
          active_days: h.activeDays,
          activity_dates: [],
          total_events: h.eventCount || 0,
          total_commands: null,
          unique_sessions: 1,
          threat_score: h.totalScore,
          risk_level: (h.riskLevel?.toLowerCase() as any) || 'low',
          detection_labels: (h.signatures || []).map((s: any) => s.name),
          geo_country: h.country,
          geo_city: '',
          geo_lat: 0,
          geo_lon: 0,
          asn_number: 0,
          asn_org: h.org || '',
          ip_is_cloud: false,
          ip_is_tor: false,
          ip_is_private: false,
          honeypots_targeted: [],
          last_updated: h.lastSeen,
          dns_hostname: h.dnsHostname || null,
        })),
        total: DEMO_HOSTS.length,
        returned: DEMO_HOSTS.length,
        limit: params?.limit || 50,
        offset: params?.offset || 0,
        has_more: false,
      };
    }
    return honeypotServiceV3.getHosts(params);
  },

  /**
   * Detailed profile for a specific host IP.
   */
  getHostDetails: async (params: GetHostDetailsV3Params): Promise<GetHostDetailsV3Response> => {
    return honeypotServiceV3.getHostDetails(params);
  },

  /**
   * Events associated with a specific host IP.
   */
  getHostEvents: async (params: GetHostEventsV3Params): Promise<GetHostEventsV3Response> => {
    return honeypotServiceV3.getHostEvents(params);
  },

  /**
   * Timeline buckets for a specific host IP.
   */
  getHostTimeline: async (params: GetHostTimelineV3Params): Promise<HostTimelineV3Response> => {
    return honeypotServiceV3.getHostTimeline(params);
  },

  /**
   * Available filter options for hosts.
   */
  getHostFilters: async (): Promise<HostFiltersV3> => {
    return honeypotServiceV3.getHostFilters();
  },

  /* ========================================================================
   * STATS & CHARTS API (V3)
   * ======================================================================== */

  /**
   * High-level threat statistics.
   */
  getStats: async (): Promise<StatsV3> => {
    if (isPublicDemo()) {
      return {
        total_hosts: DEMO_HOSTS.length,
        total_events: DEMO_EVENTS.length,
        hosts_by_risk: [
          { risk_level: 'critical', count: DEMO_HOSTS.filter((h) => h.riskLevel === 'CRITICAL').length },
          { risk_level: 'high', count: DEMO_HOSTS.filter((h) => h.riskLevel === 'HIGH').length },
          { risk_level: 'medium', count: DEMO_HOSTS.filter((h) => h.riskLevel === 'MEDIUM').length },
          { risk_level: 'low', count: DEMO_HOSTS.filter((h) => h.riskLevel === 'LOW').length },
        ],
        top_countries: [
          { country: 'China', count: 42 },
          { country: 'Russia', count: 35 },
          { country: 'United States', count: 28 },
        ],
      };
    }
    try {
      return await honeypotServiceV3.getStats();
    } catch (err) {
      console.warn('[dataProvider] Failed to fetch live stats:', err);
      return { total_hosts: 0, total_events: 0, hosts_by_risk: [], top_countries: [] };
    }
  },

  /**
   * Aggregate activity timeline for charts.
   */
  getActivityTimeline: async (params?: GetActivityTimelineV3Params): Promise<ActivityTimelineV3Response> => {
    if (isPublicDemo()) {
      return {
        granularity: params?.granularity || 'hour',
        total_events: DEMO_EVENTS.length,
        buckets: [],
      };
    }
    try {
      return await honeypotServiceV3.getActivityTimeline(params);
    } catch (err) {
      console.warn('[dataProvider] Failed to fetch live activity timeline:', err);
      return { granularity: params?.granularity || 'hour', total_events: 0, buckets: [] };
    }
  },

  /**
   * Dashboard metric cards and recent activity list.
   */
  getDashboardMetrics: async () => {
    if (isPublicDemo()) return DEMO_DASHBOARD;
    try {
      const [statsRes, logsRes] = await Promise.allSettled([
        honeypotServiceV3.getStats(),
        honeypotServiceV2.getLogEvents({ limit: 6 }),
      ]);

      const stats = statsRes.status === 'fulfilled' ? statsRes.value : null;
      const recentEvents = logsRes.status === 'fulfilled' ? logsRes.value?.events || [] : [];

      const criticalAlerts =
        stats?.hosts_by_risk?.find((r) => r.risk_level === 'critical')?.count || 0;
      const highAlerts =
        stats?.hosts_by_risk?.find((r) => r.risk_level === 'high')?.count || 0;

      return {
        metrics: {
          activeIncidents: 0,
          criticalAlerts,
          monitoredAssets: stats?.total_hosts || 0,
          totalEvents: stats?.total_events || 0,
          threatLevel:
            criticalAlerts > 0
              ? 'Critical'
              : highAlerts > 0
              ? 'Elevated'
              : 'Nominal',
        },
        recentActivity: recentEvents.map((e) => ({
          id: e.event_id || e.id || 'evt',
          type: e.event_type || 'incident',
          title: `${(e.event_type || 'Event').replace(/_/g, ' ')} detected on ${e.honeypot || 'honeypot'}`,
          relatedTo: e.src_ip || 'Unknown',
          time: e.timestamp || new Date().toISOString(),
        })),
      };
    } catch (err) {
      console.warn('[dataProvider] Failed to fetch live dashboard metrics:', err);
      return {
        metrics: {
          activeIncidents: 0,
          criticalAlerts: 0,
          monitoredAssets: 0,
          totalEvents: 0,
          threatLevel: 'Nominal',
        },
        recentActivity: [],
      };
    }
  },

  /* ========================================================================
   * THREAT MAP API (V3)
   * ======================================================================== */

  /**
   * Threat map geographic attack arcs and points.
   */
  getThreatMap: async (params?: ThreatMapV3Params): Promise<ThreatMapV3Response> => {
    if (isPublicDemo()) {
      return {
        search: null,
        total: DEMO_EVENTS.length,
        returned_points: DEMO_EVENTS.length,
        points: DEMO_EVENTS.map((e, idx) => ({
          src_ip: e.src_ip || '192.0.2.1',
          geo_lat: 30 + (idx % 20),
          geo_lon: 100 + (idx % 30),
          geo_country: e.country || 'Demo Country',
          threat_score: e.threat_score || 50,
          risk_level: (e.severity || 'medium') as any,
          total_events: 1,
          honeypots_targeted: [e.honeypot || 'honeypot-1'],
          last_seen: e.timestamp || new Date().toISOString(),
        })),
        targets: [
          { honeypot: 'honeypot-1', geo_lat: 37.7749, geo_lon: -122.4194 }
        ],
      };
    }
    try {
      return await honeypotServiceV3.getThreatMap(params);
    } catch (err) {
      console.warn('[dataProvider] Failed to fetch live threat map:', err);
      return { search: null, total: 0, returned_points: 0, points: [], targets: [] };
    }
  },

  /* ========================================================================
   * EVENTS & LOGS API (V2)
   * ======================================================================== */

  /**
   * Attack events for Honeypot Logs and real-time feeds.
   */
  getAttackEvents: async (params?: GetLogEventsV2Params): Promise<LogEventV2[]> => {
    if (isPublicDemo()) return DEMO_EVENTS;
    try {
      const resp = await honeypotServiceV2.getLogEvents(params);
      if (resp && Array.isArray(resp.events)) {
        return resp.events;
      }
    } catch (err) {
      console.warn('[dataProvider] Failed to fetch live attack events:', err);
    }
    return [];
  },

  /**
   * Paginated attack logs response with total count.
   */
  getLogEventsPaged: async (params?: GetLogEventsV2Params): Promise<GetLogEventsV2Response> => {
    if (isPublicDemo()) {
      return {
        events: DEMO_EVENTS,
        total: DEMO_EVENTS.length,
        limit: params?.limit || 100,
        offset: params?.offset || 0,
        success: true,
      };
    }
    try {
      return await honeypotServiceV2.getLogEvents(params);
    } catch (err) {
      console.warn('[dataProvider] Failed to fetch live log events:', err);
      return {
        events: [],
        total: 0,
        limit: params?.limit || 50,
        offset: params?.offset || 0,
        success: false,
      };
    }
  },

  /**
   * Log statistics aggregated across honeypots and servers.
   */
  getLogsEventStats: async (params?: LogStatsV2Params): Promise<LogStatsV2Response> => {
    try {
      return await honeypotServiceV2.getLogStats(params);
    } catch (err) {
      console.warn('[dataProvider] Failed to fetch live log stats:', err);
      return {
        success: false,
        time_range: params?.time_range || '24h',
        start_time: '',
        end_time: '',
        total_events: 0,
        unique_source_ips: 0,
        unique_targets: 0,
        top_honeypots: [],
        top_event_types: [],
        top_attacking_ips: [],
        geographic_distribution: [],
        high_threat_entities: 0,
        new_attackers_24h: 0,
      };
    }
  },

  /* ========================================================================
   * IOC API
   * ======================================================================== */

  /**
   * Indicator metrics (total, active, hashes, new 24h).
   */
  getIocStats: async (): Promise<IocStatsResponse> => {
    if (isPublicDemo()) {
      return {
        success: true,
        data: {
          total_indicators: DEMO_IOCS.length,
          active_network_iocs: DEMO_IOCS.filter((i) => i.type === 'ip').length,
          file_hashes: DEMO_IOCS.filter((i) => i.type === 'hash').length,
          new_24h: 12,
        },
      };
    }
    return iocService.getStats();
  },

  /**
   * Paginated IOC feed.
   */
  getIocFeed: async (params?: GetIocFeedParams): Promise<IocFeedResponse> => {
    if (isPublicDemo()) {
      return {
        success: true,
        data: DEMO_IOCS as any,
        total: DEMO_IOCS.length,
        page: 1,
        limit: params?.limit || 100,
        pages: 1,
      };
    }
    try {
      return await iocService.getFeed(params);
    } catch (err) {
      console.warn('[dataProvider] Failed to fetch live IOC feed:', err);
      return { success: false, data: [], total: 0, page: 1, limit: 100, pages: 0 };
    }
  },

  /**
   * Available IOC source/type/location filter options.
   */
  getIocFilters: async (): Promise<IocFiltersResponse> => {
    if (isPublicDemo()) {
      return {
        success: true,
        data: {
          sources: ['AlienVault OTX', 'URLhaus', 'ThreatFox', 'Feodo Tracker'],
          threats: ['Malware', 'Botnet', 'Phishing'],
          locs: ['US', 'DE', 'CN', 'RU'],
        },
      };
    }
    return iocService.getFilters();
  },

  /**
   * Backward-compatible IOC list for legacy views.
   */
  getIocs: async () => {
    if (isPublicDemo()) return DEMO_IOCS;
    try {
      const resp = await iocService.getFeed({ limit: 100 });
      if (resp?.data && Array.isArray(resp.data)) {
        return resp.data.map((item) => ({
          id: `${item.source}-${item.indicator_value}`,
          type: item.indicator_type,
          value: item.indicator_value,
          source: item.source,
          severity: item.severity,
          firstSeen: item.first_seen,
          lastSeen: item.last_seen,
          tags: item.tags || [],
        }));
      }
    } catch (err) {
      console.warn('[dataProvider] Failed to fetch live IOCs:', err);
    }
    return [];
  },

  /* ========================================================================
   * CASE WORKSPACES & INVESTIGATIONS
   * ======================================================================== */

  getInvestigations: async () => {
    if (isPublicDemo()) return DEMO_INVESTIGATIONS;
    return [];
  },

  getIntelHistory: async () => {
    if (isPublicDemo()) return DEMO_INTEL_HISTORY;
    return [];
  },

  getRules: async () => {
    if (isPublicDemo()) return DEMO_RULES;
    return [];
  },

  getPlaybooks: async () => {
    if (isPublicDemo()) return DEMO_PLAYBOOKS;
    return [];
  },

  /* ========================================================================
   * OPEN-SOURCE FEEDS (LIVE PUBLIC DATA)
   * ======================================================================== */

  getCveFeeds: async () => {
    if (isPublicDemo()) return DEMO_CVE_FEEDS;
    return [];
  },

  getNews: async () => {
    if (isPublicDemo()) return DEMO_NEWS;
    try {
      const data = await fetchThreatNews();
      if (data && data.length > 0) return data;
    } catch (e) {
      console.warn('Failed to fetch live news:', e);
    }
    return [];
  },

  getCves: async () => {
    if (isPublicDemo()) return DEMO_CVES;
    try {
      const data = await fetchCveUpdates();
      if (data && data.length > 0) return data;
    } catch (e) {
      console.warn('Failed to fetch live CVEs:', e);
    }
    return [];
  },

  getActors: async () => {
    if (isPublicDemo()) return DEMO_ACTORS;
    try {
      const data = await fetchRemoteMalpedia();
      if (data && data.length > 0) return data;
    } catch (e) {
      console.warn('Failed to fetch live actors:', e);
    }
    return [];
  },
};
