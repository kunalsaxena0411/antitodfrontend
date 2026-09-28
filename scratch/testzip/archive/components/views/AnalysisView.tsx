

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
    HostV3,
    honeypotServiceV3,
    StatsV3,
    HostDetailsV3,
    HostEventV3,
    HostCommandV3,
    HostFiltersV3,
    ActivityTimelineV3Response,
    HostTimelineV3Response,
    HostsV3SortBy,
    HostsV3SortOrder,
    ThreatMapV3Response,
} from '../../api/services';
import { Search, Filter, Terminal, MapPin, Server, Activity, ChevronRight, X, FileText, FileJson, FileSpreadsheet, Globe, ShieldAlert, Download, ChevronDown, RefreshCw, Layers, Eye, Radio, BarChart3, Users, AlertTriangle, LineChart as LineChartIcon, Clock, ArrowUpDown } from 'lucide-react';
import { stripHostsTableQueryParamsFromUrl, columnIdToSortBy, sortLabelForColumn, type HostsTableColumnSort } from '../../utils/hostsTableQuery';
import ReactCountryFlag from 'react-country-flag';
import { getCode, getName } from 'country-list';
import { downloadFile, generateLogAnalysisCsvV3, generateStix21BundleJsonV3 } from '../../services/exporter';
import { MITRE_ORDER } from '../../constants';
import {
    AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
    ResponsiveContainer, Legend, BarChart, Bar
} from 'recharts';

interface AnalysisViewProps {
    logoUrl?: string;
}

/** Parse a UTC timestamp string that may lack a timezone suffix (e.g. "2026-02-27 08:41:53.723"). */
const parseUtc = (s: string): Date => {
    if (!s) return new Date(NaN);
    // Replace space separator with 'T' and ensure 'Z' suffix for unambiguous UTC parsing
    const iso = s.replace(' ', 'T');
    return new Date(/[Zz]$|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + 'Z');
};

const HOST_SEARCH_MAX = 200;

export const AnalysisView: React.FC<AnalysisViewProps> = ({ logoUrl }) => {
    const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem('xyberah_log_search') || '');
    /** Debounced value sent to GET /v3/hosts as `search`. */
    const [debouncedSearch, setDebouncedSearch] = useState(() =>
        (localStorage.getItem('xyberah_log_search') || '').trim().slice(0, HOST_SEARCH_MAX)
    );
    const [riskFilter, setRiskFilter] = useState<string>(() => localStorage.getItem('xyberah_log_risk') || 'ALL');
    
    const [selectedHost, setSelectedHost] = useState<HostV3 | null>(null);
    const [detailTab, setDetailTab] = useState<'OVERVIEW' | 'TIMELINE' | 'EVENTS' | 'COMMANDS'>('OVERVIEW');
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [enrichmentLoading, setEnrichmentLoading] = useState(false);
    const [includeEnrichment, setIncludeEnrichment] = useState(false);

    // V3 API State
    const [hosts, setHosts] = useState<HostV3[]>([]);
    const [isLoadingHosts, setIsLoadingHosts] = useState(false);
    const [hostsError, setHostsError] = useState<string | null>(null);
    const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
    const [stats, setStats] = useState<StatsV3 | null>(null);
    const [isLoadingStats, setIsLoadingStats] = useState(false);

    // Host details state
    const [hostDetails, setHostDetails] = useState<HostDetailsV3 | null>(null);
    const [hostEvents, setHostEvents] = useState<HostEventV3[]>([]);
    const [hostCommands, setHostCommands] = useState<HostCommandV3[]>([]);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [isLoadingEvents, setIsLoadingEvents] = useState(false);
    const [isLoadingCommands, setIsLoadingCommands] = useState(false);

    // Pagination & server-side sort (not written to the browser URL — tabs use in-app state only)
    const [hostsPage, setHostsPage] = useState(0);
    const [hostsLimit, setHostsLimit] = useState(50);
    const [hostsSortBy, setHostsSortBy] = useState<HostsV3SortBy>('threat_score');
    const [hostsSortOrder, setHostsSortOrder] = useState<HostsV3SortOrder>('desc');
    const [hostsTotal, setHostsTotal] = useState(0);
    const [eventsPage, setEventsPage] = useState(0);
    const [hasMoreHosts, setHasMoreHosts] = useState(false);
    /** Echo of `search` from the last hosts API response (normalized by backend). */
    const [hostsSearchApplied, setHostsSearchApplied] = useState<string | null>(null);
    /** Threat map response meta (chart view); keeps search filter in sync with hosts. */
    const [threatMapData, setThreatMapData] = useState<ThreatMapV3Response | null>(null);
    const [threatMapError, setThreatMapError] = useState<string | null>(null);

    // Dynamic filter options from /v3/hosts/filters
    const [hostFilters, setHostFilters] = useState<HostFiltersV3 | null>(null);
    const [filterCountry, setFilterCountry] = useState<string>('ALL');
    const [filterHoneypot, setFilterHoneypot] = useState<string>('ALL');
    const [filterDetectionLabel, setFilterDetectionLabel] = useState<string>('ALL');
    const [filterThreatCategory, setFilterThreatCategory] = useState<string>('ALL');
    const [isCountryMenuOpen, setIsCountryMenuOpen] = useState(false);
    const [countrySearchTerm, setCountrySearchTerm] = useState('');
    const countryMenuRef = useRef<HTMLDivElement | null>(null);

    // View mode: TABLE or CHART
    const [viewMode, setViewMode] = useState<'TABLE' | 'CHART'>('TABLE');

    // Activity timeline (global)
    const [activityTimeline, setActivityTimeline] = useState<ActivityTimelineV3Response | null>(null);
    const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);
    const [timelineGranularity, setTimelineGranularity] = useState<'hour' | 'day'>('hour');

    // IP-specific timeline (in detail panel)
    const [ipTimeline, setIpTimeline] = useState<HostTimelineV3Response | null>(null);
    const [isLoadingIpTimeline, setIsLoadingIpTimeline] = useState(false);
    const [ipTimelineRange, setIpTimelineRange] = useState<'24h' | '7d' | '30d'>('24h');

    // Rotating loading messages shown while hosts are being fetched
    const loadingMessages = useMemo(() => [
        'Tuning the honeypot radars...',
        'Parsing suspicious packets...',
        'Hunting threats — please standby...',
        'Analyzing incoming connections...',
        'Decrypting byte-sized mysteries...'
    ], []);
    const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

    // Polling interval (seconds). Default 5s; 0 = disabled.
    const [pollInterval, setPollInterval] = useState<number>(() => {
        const stored = Number(localStorage.getItem('xyberah_poll_interval'));
        return Number.isFinite(stored) && stored >= 0 ? stored : 5;
    });

    // Persist user's choice
    useEffect(() => {
        localStorage.setItem('xyberah_poll_interval', String(pollInterval));
    }, [pollInterval]);

    const isPolling = pollInterval > 0; 

    useEffect(() => {
        localStorage.setItem('xyberah_log_search', searchTerm);
    }, [searchTerm]);

    useEffect(() => {
        const id = window.setTimeout(() => {
            const next = searchTerm.trim().slice(0, HOST_SEARCH_MAX);
            setDebouncedSearch((prev) => {
                if (prev !== next) {
                    setHostsPage(0);
                    return next;
                }
                return prev;
            });
        }, 300);
        return () => window.clearTimeout(id);
    }, [searchTerm]);

    useEffect(() => {
        localStorage.setItem('xyberah_log_risk', riskFilter);
    }, [riskFilter]);

    useEffect(() => {
        const onDocClick = (event: MouseEvent) => {
            if (!countryMenuRef.current) return;
            if (!countryMenuRef.current.contains(event.target as Node)) {
                setIsCountryMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, []);

    // Fetch hosts from V3 API (`silent` skips loading spinner — used for polling)
    const fetchHosts = useCallback(async (silent = false) => {
        try {
            if (!silent) setIsLoadingHosts(true);
            setHostsError(null);

            const q = debouncedSearch.trim();
            const params = {
                limit: hostsLimit,
                offset: hostsPage * hostsLimit,
                sort_by: hostsSortBy,
                sort_order: hostsSortOrder,
                ...(q && { search: q }),
                ...(riskFilter && riskFilter !== 'ALL' && { risk_level: riskFilter.toLowerCase() as 'low' | 'medium' | 'high' | 'critical' }),
                ...(filterCountry && filterCountry !== 'ALL' && { country: filterCountry }),
                ...(filterHoneypot && filterHoneypot !== 'ALL' && { honeypot: filterHoneypot }),
                ...(filterDetectionLabel && filterDetectionLabel !== 'ALL' && { detection_label: filterDetectionLabel }),
                ...(filterThreatCategory && filterThreatCategory !== 'ALL' && { threat_category: filterThreatCategory }),
            };

            const response = await honeypotServiceV3.getHosts(params);
            setHosts(response.hosts);
            setHostsTotal(response.total);
            setHostsSearchApplied(response.search ?? null);
            const offset = response.offset ?? hostsPage * hostsLimit;
            const returned = response.returned ?? response.hosts.length;
            const more =
                typeof response.has_more === 'boolean'
                    ? response.has_more
                    : offset + returned < response.total;
            setHasMoreHosts(more);
            setLastFetchTime(new Date());
        } catch (error) {
            console.error('[AnalysisView] Error fetching hosts:', error);
            setHostsError('Failed to fetch hosts');
        } finally {
            if (!silent) setIsLoadingHosts(false);
        }
    }, [
        hostsPage,
        hostsLimit,
        hostsSortBy,
        hostsSortOrder,
        riskFilter,
        filterCountry,
        filterHoneypot,
        filterDetectionLabel,
        filterThreatCategory,
        debouncedSearch,
    ]);

    const threatMapFilterParams = useMemo(
        () => ({
            ...(debouncedSearch.trim() && { search: debouncedSearch.trim() }),
            ...(riskFilter !== 'ALL' && { risk_level: riskFilter.toLowerCase() as 'low' | 'medium' | 'high' | 'critical' }),
            ...(filterCountry !== 'ALL' && { country: filterCountry }),
            ...(filterHoneypot !== 'ALL' && { honeypot: filterHoneypot }),
            ...(filterDetectionLabel !== 'ALL' && { detection_label: filterDetectionLabel }),
            ...(filterThreatCategory !== 'ALL' && { threat_category: filterThreatCategory }),
        }),
        [
            debouncedSearch,
            riskFilter,
            filterCountry,
            filterHoneypot,
            filterDetectionLabel,
            filterThreatCategory,
        ]
    );

    const fetchThreatMap = useCallback(async () => {
        setThreatMapError(null);
        try {
            const r = await honeypotServiceV3.getThreatMap(threatMapFilterParams);
            setThreatMapData(r);
        } catch (e) {
            console.error('[AnalysisView] Error fetching threat map:', e);
            setThreatMapData(null);
            setThreatMapError('Threat map unavailable');
        }
    }, [threatMapFilterParams]);

    // Fetch stats from V3 API
    const fetchStats = useCallback(async () => {
        try {
            setIsLoadingStats(true);
            const response = await honeypotServiceV3.getStats();
            setStats(response);
        } catch (error) {
            console.error('[AnalysisView] Error fetching stats:', error);
        } finally {
            setIsLoadingStats(false);
        }
    }, []);

    // Fetch dynamic filter options from /v3/hosts/filters
    const fetchHostFilters = useCallback(async () => {
        try {
            const response = await honeypotServiceV3.getHostFilters();
            setHostFilters(response);
        } catch (error) {
            console.error('[AnalysisView] Error fetching host filters:', error);
        }
    }, []);

    // Fetch global activity timeline
    const fetchActivityTimeline = useCallback(async (granularity: 'hour' | 'day' = 'hour') => {
        try {
            setIsLoadingTimeline(true);
            const start_time = granularity === 'day'
                ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
                : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const response = await honeypotServiceV3.getActivityTimeline({ granularity, start_time });
            setActivityTimeline(response);
        } catch (error) {
            console.error('[AnalysisView] Error fetching activity timeline:', error);
        } finally {
            setIsLoadingTimeline(false);
        }
    }, []);

    // Fetch IP-specific timeline for the detail panel
    const fetchIpTimeline = useCallback(async (ip: string, range: '24h' | '7d' | '30d' = '24h') => {
        try {
            setIsLoadingIpTimeline(true);
            const msMap = { '24h': 24 * 60 * 60 * 1000, '7d': 7 * 24 * 60 * 60 * 1000, '30d': 30 * 24 * 60 * 60 * 1000 };
            const granularity: 'hour' | 'day' = range === '24h' ? 'hour' : 'day';
            const start_time = new Date(Date.now() - msMap[range]).toISOString();
            const response = await honeypotServiceV3.getHostTimeline({ ip, granularity, start_time });
            setIpTimeline(response);
        } catch (error) {
            console.error('[AnalysisView] Error fetching IP timeline:', error);
        } finally {
            setIsLoadingIpTimeline(false);
        }
    }, []);

    // Load stats & filter options once
    useEffect(() => {
        fetchStats();
        fetchHostFilters();
    }, [fetchStats, fetchHostFilters]);

    // Hosts table: refetch when page, sort, limits, or filters change
    useEffect(() => {
        fetchHosts(false);
    }, [fetchHosts]);

    // Remove legacy hosts-table query params from the URL (we do not use the address bar for module routing)
    useEffect(() => {
        stripHostsTableQueryParamsFromUrl();
    }, []);

    // Re-fetch IP timeline when the range selector changes (only when a host is selected and TIMELINE tab is active)
    useEffect(() => {
        if (selectedHost && detailTab === ('TIMELINE' as any)) {
            fetchIpTimeline(selectedHost.src_ip, ipTimelineRange);
        }
    }, [ipTimelineRange]); // eslint-disable-line

    // Fetch activity timeline when chart view is activated or granularity changes
    useEffect(() => {
        if (viewMode === 'CHART') {
            fetchActivityTimeline(timelineGranularity);
        }
    }, [viewMode, timelineGranularity, fetchActivityTimeline]);

    useEffect(() => {
        if (viewMode === 'CHART') {
            fetchThreatMap();
        }
    }, [viewMode, fetchThreatMap]);

    // Silent background polling using configurable interval (pollInterval in seconds)
    useEffect(() => {
        if (!isPolling) return;
        const ms = Math.max(1000, Math.floor(pollInterval) * 1000);
        const id = setInterval(() => {
            fetchHosts(true);
        }, ms);
        return () => clearInterval(id);
    }, [fetchHosts, pollInterval, isPolling]);

    // Rotate loading messages ONLY while the initial hosts load is in progress
    useEffect(() => {
        if (isLoadingHosts && hosts.length === 0) {
            const id = setInterval(() => {
                setLoadingMessageIndex(i => (i + 1) % loadingMessages.length);
            }, 3000);
            return () => clearInterval(id);
        }

        setLoadingMessageIndex(0);
    }, [isLoadingHosts, hosts.length, loadingMessages.length]);

    // Fetch host details when selected
    const fetchHostDetails = useCallback(async (ip: string, includeEnrichment = false) => {
        try {
            setIsLoadingDetails(true);
            const response = await honeypotServiceV3.getHostDetails({ ip, include_enrichment: includeEnrichment });
            setHostDetails(response);
        } catch (error) {
            console.error('[AnalysisView] Error fetching host details:', error);
        } finally {
            setIsLoadingDetails(false);
        }
    }, []);

    // Fetch host events
    const fetchHostEvents = useCallback(async (ip: string, page = 0) => {
        try {
            setIsLoadingEvents(true);
            const response = await honeypotServiceV3.getHostEvents({ ip, limit: 100, offset: page * 100 });
            setHostEvents(response.events);
        } catch (error) {
            console.error('[AnalysisView] Error fetching host events:', error);
        } finally {
            setIsLoadingEvents(false);
        }
    }, []);

    // Fetch host commands
    const fetchHostCommands = useCallback(async (ip: string) => {
        try {
            setIsLoadingCommands(true);
            const response = await honeypotServiceV3.getHostCommands(ip);
            setHostCommands(response.commands);
        } catch (error) {
            console.error('[AnalysisView] Error fetching host commands:', error);
        } finally {
            setIsLoadingCommands(false);
        }
    }, []);

    const handleHostsColumnSort = useCallback((column: HostsTableColumnSort) => {
        const nextSortBy = columnIdToSortBy(column);
        setHostsSortBy((prevBy) => {
            if (prevBy === nextSortBy) {
                setHostsSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
                return prevBy;
            }
            setHostsSortOrder('desc');
            return nextSortBy;
        });
        setHostsPage(0);
    }, []);

    const getRiskColor = (level: string) => {
        switch (level.toLowerCase()) {
            case 'critical': return 'text-red-500';
            case 'high': return 'text-white';
            case 'medium': return 'text-white';
            case 'low': return 'text-red-500';
            default: return 'text-[#888]';
        }
    };

    const getRiskBg = (level: string) => {
        switch (level.toLowerCase()) {
            case 'critical': return 'bg-red-500/10 border-red-500/30';
            case 'high': return 'bg-neutral-500/10 border-neutral-500/30';
            case 'medium': return 'bg-neutral-500/10 border-neutral-500/30';
            case 'low': return 'bg-[#151515]/10 border-neutral-500/30';
            default: return 'bg-[#151515] border-[#333]';
        }
    };

    // Return ISO2 country code (e.g. 'US') or undefined. Accepts either a country name or an ISO2 code.
    const countryCodeFor = (country?: string) => {
        if (!country) return undefined;
        const trimmed = country.trim();
        // If already an ISO2 code (e.g. 'IN', 'BR'), return uppercased
        if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
        // Otherwise try to resolve a name to code
        try {
            return (getCode(trimmed) || undefined) as string | undefined;
        } catch (err) {
            return undefined;
        }
    };

    // Return full country name when possible (accepts ISO2 or name)
    const countryNameFor = (country?: string) => {
        if (!country) return undefined;
        const trimmed = country.trim();
        if (/^[A-Za-z]{2}$/.test(trimmed)) {
            return getName(trimmed.toUpperCase()) || trimmed.toUpperCase();
        }
        // assume it's already a full name
        return trimmed;
    }; 

    const countryFlagEmoji = (country?: string) => {
        const code = countryCodeFor(country);
        if (!code || code.length !== 2) return '';
        const A = 0x1F1E6;
        const chars = code.toUpperCase().split('');
        return String.fromCodePoint(A + chars[0].charCodeAt(0) - 65, A + chars[1].charCodeAt(0) - 65);
    };

    const countryFilterOptionLabel = (country: string) => {
        const name = countryNameFor(country) || country;
        const flag = countryFlagEmoji(country);
        return flag ? `${flag} ${name}` : name;
    };

    const filteredCountries = useMemo(() => {
        const countries = hostFilters?.countries ?? [];
        const q = countrySearchTerm.trim().toLowerCase();
        if (!q) return countries;
        return countries.filter((c) => {
            const full = (countryNameFor(c) || c).toLowerCase();
            const code = c.toLowerCase();
            return full.includes(q) || code.includes(q);
        });
    }, [hostFilters?.countries, countrySearchTerm]);

    const handleExport = useCallback(
        (format: 'CSV' | 'STIX_21_JSON') => {
            setShowExportMenu(false);
            const data = hosts;
            const ts = Date.now();
            if (format === 'CSV') {
                const csv = generateLogAnalysisCsvV3(data);
                downloadFile(csv, `log_analysis_${ts}.csv`, 'text/csv;charset=utf-8');
            } else {
                const json = generateStix21BundleJsonV3(data);
                downloadFile(json, `log_analysis_stix21_${ts}.json`, 'application/stix+json');
            }
        },
        [hosts]
    );

    const threatMapSearchEcho =
        threatMapData?.filters?.search ?? threatMapData?.search ?? null;

    const handleHostSelection = (host: HostV3) => {
        setSelectedHost(host);
        setDetailTab('OVERVIEW');
        setEventsPage(0);
        setIpTimeline(null);
        // Fetch basic details first
        fetchHostDetails(host.src_ip, false);
        // Fetch events, commands, and timeline
        fetchHostEvents(host.src_ip, 0);
        fetchHostCommands(host.src_ip);
        fetchIpTimeline(host.src_ip);
    };

    const handleLoadEnrichment = () => {
        if (selectedHost) {
            setEnrichmentLoading(true);
            fetchHostDetails(selectedHost.src_ip, true);
            setTimeout(() => setEnrichmentLoading(false), 3000);
        }
    };

    return (
        <div className="h-full flex flex-col bg-cyber-grid relative">
            <div className="p-4 border-b border-[#222] bg-black/40 backdrop-blur-sm flex flex-col md:flex-row gap-4 justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#111] rounded-lg border border-neutral-500/30 text-red-400">
                        <FileText size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white font-cyber flex items-center gap-2">
                            LOG <span className="text-red-500">ANALYSIS</span>
                        </h2>
                        <div className="flex items-center gap-3">
                            <p className="text-xs text-[#888] font-mono">V3 API Host Threat Analysis</p>
                            <div className="flex bg-[#111] rounded-lg p-0.5 border border-[#222]">
                                <button
                                    className={`px-3 py-1 text-[10px] font-bold rounded transition-all ${viewMode === 'TABLE' ? 'bg-red-500 text-black shadow-[0_0_10px_rgba(0,243,255,0.3)]' : 'text-[#AAA] hover:text-white'}`}
                                    onClick={() => setViewMode('TABLE')}
                                >
                                    TABLE
                                </button>
                                <button
                                    className={`px-3 py-1 text-[10px] font-bold rounded transition-all flex items-center gap-1 ${viewMode === 'CHART' ? 'bg-red-500 text-black shadow-[0_0_10px_rgba(0,243,255,0.3)]' : 'text-[#AAA] hover:text-white'}`}
                                    onClick={() => setViewMode('CHART')}
                                >
                                    <BarChart3 size={10}/> CHART
                                </button>
                            </div>
                            <div className="flex items-center gap-2 px-2 py-0.5 bg-black/40 border border-[#222] rounded text-[9px] font-mono text-[#888]">
                                <span className={`w-1.5 h-1.5 rounded-full ${isLoadingHosts ? 'bg-[#151515] animate-ping' : 'bg-neutral-500'}`}></span>
                                <span>Last: {lastFetchTime ? lastFetchTime.toLocaleTimeString() : '—'}</span>

                                {/* subtle polling indicator (always visible) */}
                                <span className={`ml-2 inline-flex items-center gap-2 px-2 py-0.5 rounded border border-[#222] bg-black/30 text-[10px] ${isPolling ? 'text-[#AAA]' : 'text-neutral-600'}`} title={isPolling ? `Auto updates every ${pollInterval}s` : 'Auto-poll disabled'}>
                                    <span className={`w-2 h-2 rounded-full ${isPolling ? 'bg-neutral-400 animate-pulse' : 'bg-neutral-600'}`} />
                                    {isPolling ? `Auto · ${pollInterval}s` : 'Auto · Off'}
                                </span>

                                {/* interval selector */}
                                <select
                                    value={pollInterval}
                                    onChange={(e) => setPollInterval(Number(e.target.value))}
                                    className="ml-2 bg-black/30 border border-[#222] text-xs text-neutral-300 rounded px-2 py-0.5 cursor-pointer"
                                    title="Background poll interval (seconds)"
                                >
                                    <option value={0}>Off</option>
                                    <option value={2}>2s</option>
                                    <option value={5}>5s</option>
                                    <option value={10}>10s</option>
                                    <option value={30}>30s</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64 group">
                        <Search className="absolute left-3 top-2.5 text-[#888] w-4 h-4" />
                        <input 
                            type="text" 
                            placeholder="Search hosts (IP, DNS, geo, ASN, labels…)" 
                            maxLength={HOST_SEARCH_MAX}
                            className="w-full bg-black/50 border border-[#333] rounded-lg pl-10 pr-4 py-2 text-sm text-neutral-300 focus:border-red-500 focus:outline-none transition-all font-mono"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    <div className="relative">
                        <Filter className="absolute left-3 top-2.5 text-[#888] w-4 h-4 pointer-events-none" />
                        <select 
                            className="bg-black/50 border border-[#333] rounded-lg pl-10 pr-4 py-2 text-sm text-neutral-300 focus:border-red-500 focus:outline-none appearance-none cursor-pointer hover:bg-[#0A0A0A] transition-colors"
                            value={riskFilter}
                            onChange={(e) => {
                                setRiskFilter(e.target.value);
                                setHostsPage(0);
                            }}
                        >
                            <option value="ALL">All Risks</option>
                            <option value="CRITICAL">Critical</option>
                            <option value="HIGH">High</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="LOW">Low</option>
                        </select>
                    </div>

                    <button 
                        type="button"
                        onClick={() => { fetchHosts(false); fetchStats(); }}
                        className="p-2 bg-[#151515] hover:bg-[#1C1C1C] border border-[#333] rounded-lg text-neutral-300 hover:text-white transition-colors"
                        title="Refresh data"
                    >
                        <RefreshCw size={16} className={isLoadingHosts ? 'animate-spin' : ''} />
                    </button>

                    <div className="relative">
                        <button 
                            onClick={() => setShowExportMenu(!showExportMenu)}
                            className="px-3 py-2 bg-[#151515] hover:bg-[#1C1C1C] border border-[#333] rounded-lg text-neutral-300 hover:text-white transition-colors flex items-center gap-2 text-xs font-bold"
                        >
                            <Download size={14}/> Export <ChevronDown size={12}/>
                        </button>
                        
                        {showExportMenu && (
                            <div className="absolute right-0 top-full mt-2 w-56 bg-[#0A0A0A] border border-[#333] rounded-lg shadow-xl z-50 overflow-hidden animate-fade-in">
                                <button type="button" onClick={() => handleExport('CSV')} className="w-full text-left px-4 py-2 text-xs text-neutral-300 hover:bg-white/10 hover:text-white flex items-center gap-2">
                                    <FileSpreadsheet size={14}/> CSV
                                </button>
                                <button type="button" onClick={() => handleExport('STIX_21_JSON')} className="w-full text-left px-4 py-2 text-xs text-neutral-300 hover:bg-white/10 hover:text-white flex items-center gap-2">
                                    <FileJson size={14}/> STIX 2.1 (JSON)
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Dynamic Filter Bar */}
            {hostFilters && (
                <div className="px-4 py-2 border-b border-[#222] bg-black/30 flex flex-wrap items-center gap-2 shrink-0">
                    <Filter size={12} className="text-[#888]" />
                    <span className="text-[10px] text-[#888] font-bold uppercase tracking-wider mr-1">Filters:</span>

                    {/* Country */}
                    <div className="relative" ref={countryMenuRef}>
                        <button
                            type="button"
                            onClick={() => {
                                setIsCountryMenuOpen((prev) => {
                                    const next = !prev;
                                    if (!next) setCountrySearchTerm('');
                                    return next;
                                });
                            }}
                            className="bg-black/50 border border-[#333] rounded px-2 py-1 text-xs text-neutral-300 hover:bg-[#0A0A0A] transition-colors inline-flex items-center gap-2 min-w-[170px] justify-between"
                        >
                            <span className="inline-flex items-center gap-2 truncate">
                                {filterCountry !== 'ALL' && countryCodeFor(filterCountry) ? (
                                    <ReactCountryFlag
                                        svg
                                        countryCode={countryCodeFor(filterCountry) as string}
                                        style={{ width: '14px', height: '10px' }}
                                        title={countryNameFor(filterCountry) || filterCountry}
                                    />
                                ) : null}
                                <span className="truncate">{filterCountry === 'ALL' ? 'All Countries' : (countryNameFor(filterCountry) || filterCountry)}</span>
                            </span>
                            <ChevronDown size={12} className={`shrink-0 transition-transform ${isCountryMenuOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isCountryMenuOpen && (
                            <div className="absolute left-0 top-full mt-1 z-50 max-h-64 w-64 overflow-y-auto rounded border border-[#333] bg-[#0d1117] shadow-xl custom-scrollbar">
                                <div className="p-2 border-b border-[#333]/70 sticky top-0 bg-[#0d1117] z-10">
                                    <div className="relative">
                                        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#888]" />
                                        <input
                                            type="text"
                                            value={countrySearchTerm}
                                            onChange={(e) => setCountrySearchTerm(e.target.value)}
                                            placeholder="Search country"
                                            className="w-full rounded border border-[#333] bg-black/40 py-1 pl-7 pr-2 text-xs text-neutral-300 focus:border-red-500 focus:outline-none"
                                        />
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => { setFilterCountry('ALL'); setHostsPage(0); setIsCountryMenuOpen(false); setCountrySearchTerm(''); }}
                                    className="w-full px-2 py-1.5 text-left text-xs text-neutral-300 hover:bg-white/10"
                                >
                                    All Countries
                                </button>
                                {filteredCountries.map((c) => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => { setFilterCountry(c); setHostsPage(0); setIsCountryMenuOpen(false); setCountrySearchTerm(''); }}
                                        className={`w-full px-2 py-1.5 text-left text-xs hover:bg-white/10 flex items-center gap-2 ${
                                            filterCountry === c ? 'text-red-500 bg-red-500/10' : 'text-neutral-300'
                                        }`}
                                    >
                                        {countryCodeFor(c) ? (
                                            <ReactCountryFlag
                                                svg
                                                countryCode={countryCodeFor(c) as string}
                                                style={{ width: '14px', height: '10px' }}
                                                title={countryNameFor(c) || c}
                                            />
                                        ) : (
                                            <Globe size={12} className="text-[#888]" />
                                        )}
                                        <span>{countryFilterOptionLabel(c)}</span>
                                    </button>
                                ))}
                                {filteredCountries.length === 0 && (
                                    <div className="px-2 py-2 text-xs text-[#888]">No countries match your search.</div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Honeypot filter — temporarily disabled (see product request) */}
                    {/*
                    <select
                        value={filterHoneypot}
                        onChange={e => { setFilterHoneypot(e.target.value); setHostsPage(0); }}
                        className="bg-black/50 border border-[#333] rounded px-2 py-1 text-xs text-neutral-300 focus:border-red-500 outline-none cursor-pointer hover:bg-[#0A0A0A] transition-colors"
                    >
                        <option value="ALL">All Honeypots</option>
                        {hostFilters.honeypots.map(h => (
                            <option key={h} value={h}>{h}</option>
                        ))}
                    </select>
                    */}

                    {/* Detection Label */}
                    <select
                        value={filterDetectionLabel}
                        onChange={e => { setFilterDetectionLabel(e.target.value); setHostsPage(0); }}
                        className="bg-black/50 border border-[#333] rounded px-2 py-1 text-xs text-neutral-300 focus:border-red-500 outline-none cursor-pointer hover:bg-[#0A0A0A] transition-colors max-w-[180px]"
                    >
                        <option value="ALL">All Labels</option>
                        {hostFilters.detection_labels.map(l => (
                            <option key={l} value={l}>{l}</option>
                        ))}
                    </select>

                    {/* Threat Category */}
                    <select
                        value={filterThreatCategory}
                        onChange={e => { setFilterThreatCategory(e.target.value); setHostsPage(0); }}
                        className="bg-black/50 border border-[#333] rounded px-2 py-1 text-xs text-neutral-300 focus:border-red-500 outline-none cursor-pointer hover:bg-[#0A0A0A] transition-colors max-w-[180px]"
                    >
                        <option value="ALL">All Threat Categories</option>
                        {hostFilters.threat_categories.map(tc => (
                            <option key={tc.label} value={tc.label}>{tc.label}</option>
                        ))}
                    </select>

                    {/* Reset filters button */}
                    {(filterCountry !== 'ALL' || filterHoneypot !== 'ALL' || filterDetectionLabel !== 'ALL' || filterThreatCategory !== 'ALL') && (
                        <button
                            onClick={() => { setFilterCountry('ALL'); setFilterHoneypot('ALL'); setFilterDetectionLabel('ALL'); setFilterThreatCategory('ALL'); }}
                            className="px-2 py-1 text-[10px] bg-red-900/20 border border-red-500/30 text-red-400 rounded hover:bg-red-900/40 transition-colors font-bold"
                        >
                            CLEAR FILTERS
                        </button>
                    )}

                    {/* Date range hint */}
                    {hostFilters.date_range.min && (
                        <span className="ml-auto text-[10px] text-neutral-600 font-mono">
                            Data: {new Date(hostFilters.date_range.min).toLocaleDateString()} – {hostFilters.date_range.max ? new Date(hostFilters.date_range.max).toLocaleDateString() : 'now'}
                        </span>
                    )}
                </div>
            )}

            <div className="flex-1 overflow-hidden relative">

                {/* ── CHART VIEW ── */}
                {viewMode === 'CHART' && (
                    <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-6 space-y-6">
                        {stats && (
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="bg-black/40 border border-[#222] rounded-xl p-4 shadow-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-[#111] rounded-lg border border-neutral-500/30">
                                            <Users className="text-red-400" size={20} />
                                        </div>
                                        <div>
                                            <div className="text-2xl font-mono font-bold text-white">{stats.total_hosts.toLocaleString()}</div>
                                            <div className="text-xs text-[#888] uppercase font-bold">Total Hosts</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-black/40 border border-[#222] rounded-xl p-4 shadow-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-neutral-900/20 rounded-lg border border-neutral-500/30">
                                            <Activity className="text-white" size={20} />
                                        </div>
                                        <div>
                                            <div className="text-2xl font-mono font-bold text-white">{stats.total_events.toLocaleString()}</div>
                                            <div className="text-xs text-[#888] uppercase font-bold">Total Events</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-black/40 border border-[#222] rounded-xl p-4 shadow-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-red-900/20 rounded-lg border border-red-500/30">
                                            <AlertTriangle className="text-red-400" size={20} />
                                        </div>
                                        <div>
                                            <div className="text-2xl font-mono font-bold text-white">
                                                {stats.hosts_by_risk.find(r => r.risk_level === 'critical')?.count || 0}
                                            </div>
                                            <div className="text-xs text-[#888] uppercase font-bold">Critical Threats</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-black/40 border border-[#222] rounded-xl p-4 shadow-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-neutral-900/20 rounded-lg border border-neutral-500/30">
                                            <Globe className="text-white" size={20} />
                                        </div>
                                        <div>
                                            <div className="text-2xl font-mono font-bold text-white">{stats.top_countries.length}</div>
                                            <div className="text-xs text-[#888] uppercase font-bold">Countries</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        {/* Granularity controls */}
                        <div className="flex items-center gap-3">
                            <BarChart3 size={16} className="text-red-500" />
                            <span className="text-sm font-bold text-white">Global Attack Activity Timeline</span>
                            <div className="flex bg-[#111] rounded p-0.5 border border-[#222] ml-2">
                                {(['hour', 'day'] as const).map(g => (
                                    <button
                                        key={g}
                                        onClick={() => setTimelineGranularity(g)}
                                        className={`px-3 py-1 text-[10px] font-bold rounded transition-all ${timelineGranularity === g ? 'bg-red-500 text-black' : 'text-[#AAA] hover:text-white'}`}
                                    >
                                        {g === 'hour' ? 'HOURLY (24h)' : 'DAILY (7d)'}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => fetchActivityTimeline(timelineGranularity)}
                                className="p-1.5 bg-[#151515] hover:bg-[#1C1C1C] border border-[#333] rounded text-[#AAA] hover:text-white transition-colors"
                            >
                                <RefreshCw size={12} className={isLoadingTimeline ? 'animate-spin' : ''} />
                            </button>
                        </div>
                        {(threatMapError != null || threatMapData != null) && (
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#888] font-mono px-1 mt-1">
                                {threatMapError ? (
                                    <span className="text-white/90">{threatMapError}</span>
                                ) : (
                                    <>
                                        <MapPin size={12} className="text-red-500 shrink-0" />
                                        <span>
                                            Threat map uses the same filters as the host list
                                            {threatMapSearchEcho ? (
                                                <span className="text-neutral-300 ml-1 font-mono">&quot;{threatMapSearchEcho}&quot;</span>
                                            ) : (
                                                <span className="text-neutral-600 ml-1">(no search)</span>
                                            )}
                                        </span>
                                    </>
                                )}
                            </div>
                        )}

                        {isLoadingTimeline ? (
                            <div className="flex items-center justify-center h-72 text-[#888]">
                                <RefreshCw className="animate-spin mr-2" size={20} /> Loading timeline...
                            </div>
                        ) : activityTimeline && activityTimeline.buckets.length > 0 ? (
                            <>
                                {/* Peak banner */}
                                {activityTimeline.peak && (
                                    <div className="flex items-center gap-3 px-4 py-2 bg-neutral-900/10 border border-neutral-500/20 rounded-lg text-xs text-white">
                                        <AlertTriangle size={14} /> Peak activity: <span className="font-mono font-bold">{activityTimeline.peak.events.toLocaleString()} events</span> at {activityTimeline.peak.time}
                                    </div>
                                )}

                                {/* Events + Unique IPs dual-axis chart */}
                                <div className="bg-black/40 border border-[#222] rounded-xl p-6">
                                    <h3 className="text-xs font-bold text-[#AAA] uppercase mb-4">Events &amp; Unique Attackers</h3>
                                    <ResponsiveContainer width="100%" height={320}>
                                        <AreaChart data={activityTimeline.buckets} margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
                                            <defs>
                                                <linearGradient id="eventsGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.25} />
                                                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="ipsGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                                            <XAxis
                                                dataKey="time"
                                                tick={{ fill: '#6b7280', fontSize: 10 }}
                                                tickFormatter={(v: string) => {
                                                    try { return timelineGranularity === 'day' ? new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : new Date(v).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); } catch { return v; }
                                                }}
                                            />
                                            <YAxis yAxisId="left" tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : String(v)} />
                                            <YAxis yAxisId="right" orientation="right" tick={{ fill: '#6b7280', fontSize: 10 }} />
                                            <ReTooltip
                                                contentStyle={{ background: '#0d1117', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                                                labelStyle={{ color: '#9ca3af' }}
                                            />
                                            <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                                            <Area yAxisId="left" type="monotone" dataKey="total_events" name="Total Events" stroke="#f97316" fill="url(#eventsGrad)" strokeWidth={2} dot={false} />
                                            <Area yAxisId="right" type="monotone" dataKey="unique_ips" name="Unique IPs" stroke="#3b82f6" fill="url(#ipsGrad)" strokeWidth={2} dot={false} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Bar chart of event types if available */}
                                <div className="bg-black/40 border border-[#222] rounded-xl p-6">
                                    <h3 className="text-xs font-bold text-[#AAA] uppercase mb-4">Event Volume (Bar)</h3>
                                    <ResponsiveContainer width="100%" height={200}>
                                        <BarChart data={activityTimeline.buckets} margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                                            <XAxis
                                                dataKey="time"
                                                tick={{ fill: '#6b7280', fontSize: 10 }}
                                                tickFormatter={(v: string) => {
                                                    try { return timelineGranularity === 'day' ? new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : new Date(v).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); } catch { return v; }
                                                }}
                                            />
                                            <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
                                            <ReTooltip contentStyle={{ background: '#0d1117', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#9ca3af' }} />
                                            <Bar dataKey="total_events" name="Events" fill="#f97316" opacity={0.8} radius={[2, 2, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-center h-72 text-[#888] font-mono">No timeline data available.</div>
                        )}
                    </div>
                )}

                {/* ── TABLE VIEW ── */}
                <div className={`absolute inset-0 overflow-y-auto custom-scrollbar p-6 ${viewMode === 'CHART' ? 'hidden' : ''}`}>
                    {stats && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-black/40 border border-[#222] rounded-xl p-4 shadow-lg">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-[#111] rounded-lg border border-neutral-500/30">
                                        <Users className="text-red-400" size={20} />
                                    </div>
                                    <div>
                                        <div className="text-2xl font-mono font-bold text-white">{stats.total_hosts.toLocaleString()}</div>
                                        <div className="text-xs text-[#888] uppercase font-bold">Total Hosts</div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-black/40 border border-[#222] rounded-xl p-4 shadow-lg">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-neutral-900/20 rounded-lg border border-neutral-500/30">
                                        <Activity className="text-white" size={20} />
                                    </div>
                                    <div>
                                        <div className="text-2xl font-mono font-bold text-white">{stats.total_events.toLocaleString()}</div>
                                        <div className="text-xs text-[#888] uppercase font-bold">Total Events</div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-black/40 border border-[#222] rounded-xl p-4 shadow-lg">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-red-900/20 rounded-lg border border-red-500/30">
                                        <AlertTriangle className="text-red-400" size={20} />
                                    </div>
                                    <div>
                                        <div className="text-2xl font-mono font-bold text-white">
                                            {stats.hosts_by_risk.find(r => r.risk_level === 'critical')?.count || 0}
                                        </div>
                                        <div className="text-xs text-[#888] uppercase font-bold">Critical Threats</div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-black/40 border border-[#222] rounded-xl p-4 shadow-lg">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-neutral-900/20 rounded-lg border border-neutral-500/30">
                                        <Globe className="text-white" size={20} />
                                    </div>
                                    <div>
                                        <div className="text-2xl font-mono font-bold text-white">{stats.top_countries.length}</div>
                                        <div className="text-xs text-[#888] uppercase font-bold">Countries</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {hostsError && (
                        <div className="mb-4 p-4 bg-red-900/20 border border-red-500/50 rounded-lg flex items-center gap-3">
                            <ShieldAlert className="text-red-500" />
                            <span className="text-red-200 font-mono text-sm">{hostsError}</span>
                        </div>
                    )}

                    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-[#222] bg-[#111] px-3 py-2.5">
                        <div className="flex items-center gap-2">
                            <ArrowUpDown size={14} className="text-red-500 shrink-0" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#888]">Sort</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {(
                                [
                                    { col: 'risk' as const, by: 'risk_level' as const, label: 'Risk level' },
                                    { col: 'threat_score' as const, by: 'threat_score' as const, label: 'Threat score' },
                                    { col: 'last_seen' as const, by: 'last_seen' as const, label: 'Last seen' },
                                ] as const
                            ).map(({ col, by, label }) => (
                                <button
                                    key={by}
                                    type="button"
                                    onClick={() => handleHostsColumnSort(col)}
                                    className={`rounded-md border px-2.5 py-1 text-[11px] font-mono font-bold transition-colors ${
                                        hostsSortBy === by
                                            ? 'border-red-500/60 bg-red-500/15 text-red-500'
                                            : 'border-[#333] bg-black/40 text-[#AAA] hover:border-neutral-600 hover:text-neutral-200'
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <div className="hidden sm:block h-5 w-px bg-[#1C1C1C]" aria-hidden />
                        <button
                            type="button"
                            onClick={() => setHostsSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
                            className="inline-flex items-center gap-1.5 rounded-md border border-[#333] bg-black/40 px-2.5 py-1 text-[11px] font-mono text-neutral-300 hover:border-neutral-600 hover:text-white"
                            title="Reverse ascending / descending order for the active column"
                        >
                            <ArrowUpDown size={12} />
                            Reverse order ({hostsSortOrder === 'desc' ? 'desc' : 'asc'})
                        </button>
                        <span className="text-[10px] text-neutral-600 font-mono max-w-[min(100%,280px)] truncate" title={sortLabelForColumn(hostsSortBy, hostsSortOrder)}>
                            {sortLabelForColumn(hostsSortBy, hostsSortOrder)}
                        </span>
                    </div>
                    
                    <div className="bg-black/40 border border-[#222] rounded-lg overflow-x-auto">
                        <table className="w-full min-w-[1000px] text-left text-sm">
                            <thead className="bg-[#111] text-[#888] uppercase font-bold text-xs sticky top-0 z-10 backdrop-blur-md">
                                <tr>
                                    <th className="p-4 w-32">Risk level</th>
                                    <th className="p-4 w-48">Host Identity</th>
                                    <th className="p-4 w-32">Location</th>
                                    <th className="p-4 w-48">Threat score</th>
                                    <th className="p-4">Activity</th>
                                    <th className="p-4 w-40">
                                        <span className="inline-flex items-center gap-1">
                                            <Clock size={11} className="opacity-70" />
                                            Last seen
                                        </span>
                                    </th>
                                    <th className="p-4 text-right w-24">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-800/50">
                                {isLoadingHosts && hosts.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center">
                                            <div className="flex items-center justify-center gap-3">
                                                <RefreshCw className="w-5 h-5 animate-spin text-red-500" />
                                                <span className="text-[#AAA] font-mono">{loadingMessages[loadingMessageIndex]}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : !isLoadingHosts && hostsTotal === 0 && debouncedSearch.trim() ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-[#888] font-mono">
                                            <div className="space-y-2">
                                                <p>No hosts match your search.</p>
                                                <p className="text-[11px] text-neutral-600">
                                                    Query: <span className="text-white/90 font-mono">{debouncedSearch.trim()}</span>
                                                    {hostsSearchApplied ? (
                                                        <span className="block mt-1">Normalized: {hostsSearchApplied}</span>
                                                    ) : null}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : !isLoadingHosts && hostsTotal === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-[#888] font-mono">
                                            No hosts found for the current filters.
                                        </td>
                                    </tr>
                                ) : (
                                    hosts.map((host, idx) => (
                                        <tr 
                                            key={`${host.src_ip}-${idx}`} 
                                            className="hover:bg-white/5 transition-colors cursor-pointer group"
                                            onClick={() => handleHostSelection(host)}
                                        >
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold border ${getRiskBg(host.risk_level ?? '')} ${getRiskColor(host.risk_level ?? '')}`}>
                                                    {(host.risk_level ?? 'unknown').toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-white font-bold">{host.src_ip}</span>
                                                </div>
                                                <div className="text-[10px] text-[#888] font-mono mt-0.5">
                                                    ASN: {host.asn_number} ({host.asn_org})
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2 text-neutral-300">
                                                    {countryCodeFor(host.geo_country) ? (
                                                        <ReactCountryFlag svg countryCode={countryCodeFor(host.geo_country) as string} style={{ width: '20px', height: '14px' }} title={countryNameFor(host.geo_country) || host.geo_country} />
                                                    ) : (
                                                        <Globe className="text-[#888]" size={14} />
                                                    )}
                                                    <span className="ml-2">{countryNameFor(host.geo_country) || host.geo_country}</span>
                                                </div>
                                                <div className="text-[10px] text-[#888] font-mono">
                                                    {host.geo_city}
                                                </div>
                                            </td> 
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <span className={`font-bold font-mono ${host.threat_score > 75 ? 'text-red-500' : host.threat_score > 50 ? 'text-white' : 'text-red-500'}`}>
                                                        {host.threat_score}
                                                    </span>
                                                    <div className="flex-1 h-1.5 bg-[#151515] rounded-full overflow-hidden max-w-[100px]">
                                                        <div className={`h-full ${host.threat_score > 75 ? 'bg-red-500' : host.threat_score > 50 ? 'bg-neutral-500' : 'bg-[#151515]'}`} 
                                                             style={{ width: `${host.threat_score}%` }}>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="space-y-1">
                                                    <div className="text-xs text-neutral-300">
                                                        {host.total_events} events, {host.total_commands} commands
                                                    </div>
                                                    <div className="text-[10px] text-[#888]">
                                                        Active {host.active_days} days • {host.unique_sessions} sessions
                                                    </div>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {(host.detection_labels ?? []).slice(0, 2).map((label, i) => (
                                                            <span key={i} className="px-1.5 py-0.5 bg-[#151515] border border-[#333] rounded text-[9px] text-neutral-300 truncate max-w-[100px]" title={label}>
                                                                {label}
                                                            </span>
                                                        ))}
                                                        {(host.detection_labels ?? []).length > 2 && (
                                                            <span className="px-1.5 py-0.5 bg-[#151515] border border-[#333] rounded text-[9px] text-[#888]">
                                                                +{(host.detection_labels ?? []).length - 2}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 w-40">
                                                {(() => {
                                                    const d = parseUtc(host.last_updated);
                                                    const diff = Date.now() - d.getTime();
                                                    const mins = Math.floor(diff / 60000);
                                                    const hrs = Math.floor(diff / 3600000);
                                                    const days = Math.floor(diff / 86400000);
                                                    const rel = mins < 1 ? 'just now' : mins < 60 ? `${mins}m ago` : hrs < 24 ? `${hrs}h ago` : `${days}d ago`;
                                                    return (
                                                        <>
                                                            <div className="flex items-center gap-1 text-xs text-neutral-300 font-mono">
                                                                <Clock size={10} className="text-neutral-600 shrink-0" />
                                                                {rel}
                                                            </div>
                                                            <div className="text-[10px] text-neutral-600 font-mono mt-0.5">
                                                                {d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                {' '}
                                                                {d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </td>
                                            <td className="p-4 text-right">
                                                <button className="p-2 bg-[#151515] hover:bg-[#1C1C1C] text-[#AAA] hover:text-white rounded transition-colors">
                                                    <ChevronRight size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-xs text-[#888] font-mono">
                        <div className="space-y-1">
                            <div>
                                {hostsTotal === 0
                                    ? 'No hosts'
                                    : `Showing ${hostsPage * hostsLimit + 1}–${hostsPage * hostsLimit + hosts.length} of ${hostsTotal}`}
                            </div>
                            {debouncedSearch.trim() ? (
                                <div className="text-[10px] text-neutral-600">
                                    API search
                                    {hostsSearchApplied != null && hostsSearchApplied !== '' ? (
                                        <span className="text-white/90 font-mono ml-1">&quot;{hostsSearchApplied}&quot;</span>
                                    ) : (
                                        <span className="text-white/90 font-mono ml-1">&quot;{debouncedSearch.trim()}&quot;</span>
                                    )}
                                </div>
                            ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <label className="flex items-center gap-2 text-[11px] text-[#AAA]">
                                <span>Rows</span>
                                <select
                                    value={hostsLimit}
                                    onChange={(e) => {
                                        setHostsLimit(Number(e.target.value));
                                        setHostsPage(0);
                                    }}
                                    className="rounded border border-[#333] bg-black/50 px-2 py-1 text-neutral-200"
                                >
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </label>
                            <button
                                type="button"
                                disabled={hostsPage <= 0}
                                onClick={() => setHostsPage((p) => Math.max(0, p - 1))}
                                className="rounded-lg bg-[#151515] px-3 py-1.5 text-neutral-200 hover:bg-[#1C1C1C] disabled:opacity-40"
                            >
                                Previous
                            </button>
                            <span className="rounded border border-[#333] bg-black/40 px-2 py-1 text-neutral-300">
                                Page {hostsPage + 1} / {Math.max(1, Math.ceil(hostsTotal / hostsLimit) || 1)}
                            </span>
                            <button
                                type="button"
                                disabled={!hasMoreHosts}
                                onClick={() => setHostsPage((p) => p + 1)}
                                className="rounded-lg bg-[#151515] px-3 py-1.5 text-neutral-200 hover:bg-[#1C1C1C] disabled:opacity-40"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>

                {selectedHost && (
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-50 flex justify-end animate-fade-in">
                        <div className="w-full max-w-[88vw] bg-[#0a0a0a] border-l border-[#222] h-full shadow-2xl flex flex-col animate-slide-in-right">
                            <div className="p-6 border-b border-[#222] flex justify-between items-start bg-[#111]">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <h2 className="text-2xl font-mono font-bold text-white">{selectedHost.src_ip}</h2>
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getRiskBg(selectedHost.risk_level)} ${getRiskColor(selectedHost.risk_level)}`}>
                                            {selectedHost.risk_level.toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-[#AAA]">
                                        <span className="flex items-center gap-1">
                                            {countryCodeFor(selectedHost.geo_country) ? (
                                                <ReactCountryFlag svg countryCode={countryCodeFor(selectedHost.geo_country) as string} style={{ width: '18px', height: '12px' }} title={countryNameFor(selectedHost.geo_country) || selectedHost.geo_country} />
                                            ) : (
                                                <MapPin size={12} />
                                            )}
                                            <span className="ml-2">{countryNameFor(selectedHost.geo_country) || selectedHost.geo_country}, {selectedHost.geo_city}</span>
                                        </span>
                                        <span className="text-neutral-600">|</span>
                                        <span className="flex items-center gap-1"><Server size={12}/> ASN {selectedHost.asn_number}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={handleLoadEnrichment}
                                        disabled={enrichmentLoading}
                                        className="px-4 py-2 bg-[#1C1C1C] hover:bg-[#151515] disabled:bg-neutral-800 text-white rounded text-xs font-bold flex items-center gap-2 transition-colors shadow-lg shadow-blue-900/20"
                                    >
                                        {enrichmentLoading ? <RefreshCw size={14} className="animate-spin" /> : <Eye size={14} />}
                                        {hostDetails?.enrichment ? 'REFRESH' : 'LOAD'} ENRICHMENT
                                    </button>
                                    <button 
                                        onClick={() => setSelectedHost(null)}
                                        className="p-2 hover:bg-[#151515] rounded text-[#888] hover:text-white transition-colors"
                                    >
                                        <X size={20}/>
                                    </button>
                                </div>
                            </div>

                            <div className="flex bg-black/40 border-b border-[#222] px-6">
                                <button onClick={() => setDetailTab('OVERVIEW')} className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${detailTab === 'OVERVIEW' ? 'border-red-500 text-white' : 'border-transparent text-[#888] hover:text-neutral-300'}`}>
                                    <Activity size={14}/> OVERVIEW
                                </button>
                                <button onClick={() => setDetailTab('TIMELINE' as any)} className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${detailTab === ('TIMELINE' as any) ? 'border-neutral-500 text-white' : 'border-transparent text-[#888] hover:text-neutral-300'}`}>
                                    <BarChart3 size={14}/> TIMELINE
                                </button>
                                <button onClick={() => setDetailTab('EVENTS')} className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${detailTab === 'EVENTS' ? 'border-neutral-500 text-white' : 'border-transparent text-[#888] hover:text-neutral-300'}`}>
                                    <Terminal size={14}/> EVENTS ({hostEvents.length})
                                </button>
                                <button onClick={() => setDetailTab('COMMANDS')} className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${detailTab === 'COMMANDS' ? 'border-red-500 text-white' : 'border-transparent text-[#888] hover:text-neutral-300'}`}>
                                    <ShieldAlert size={14}/> COMMANDS ({hostCommands.length})
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                                {detailTab === 'OVERVIEW' && (
                                    <>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="bg-black/40 border border-[#222] rounded p-3">
                                                <div className="text-[10px] text-[#888] uppercase font-bold mb-1">First Seen</div>
                                                <div className="text-xs text-white font-mono">{parseUtc(selectedHost.first_seen).toLocaleString()}</div>
                                            </div>
                                            <div className="bg-black/40 border border-[#222] rounded p-3">
                                                <div className="text-[10px] text-[#888] uppercase font-bold mb-1">Last Seen</div>
                                                <div className="text-xs text-white font-mono">{parseUtc(selectedHost.last_seen).toLocaleString()}</div>
                                            </div>
                                            <div className="bg-black/40 border border-[#222] rounded p-3">
                                                <div className="text-[10px] text-[#888] uppercase font-bold mb-1">Active Duration</div>
                                                <div className="text-xl text-red-500 font-bold">{selectedHost.active_days} <span className="text-xs text-[#888] font-normal">Days</span></div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-black/40 border border-[#222] rounded p-4">
                                                <div className="text-xs text-[#888] uppercase font-bold mb-1">Threat Score</div>
                                                <div className="text-3xl font-cyber font-bold text-white mb-2">{selectedHost.threat_score}<span className="text-neutral-600 text-lg">/100</span></div>
                                                <div className="w-full bg-[#151515] h-1.5 rounded-full overflow-hidden">
                                                    <div className={`h-full ${selectedHost.threat_score > 75 ? 'bg-red-500' : selectedHost.threat_score > 50 ? 'bg-neutral-500' : 'bg-[#151515]'}`} style={{ width: `${selectedHost.threat_score}%` }}></div>
                                                </div>
                                            </div>
                                            <div className="bg-black/40 border border-[#222] rounded p-4">
                                                <div className="text-xs text-[#888] uppercase font-bold mb-1">Activity Summary</div>
                                                <div className="text-2xl font-mono font-bold text-white mb-1">{selectedHost.total_events}</div>
                                                <div className="text-xs text-[#AAA]">Total Events</div>
                                                <div className="text-lg font-mono font-bold text-red-400 mt-2">{selectedHost.total_commands}</div>
                                                <div className="text-xs text-[#AAA]">Commands Executed</div>
                                            </div>
                                        </div>

                                        <div className="bg-black/40 border border-[#222] rounded-lg p-4">
                                            <div className="text-xs font-bold text-[#888] uppercase mb-3">Detection Labels</div>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedHost.detection_labels.map((label, i) => (
                                                    <span key={i} className="px-2 py-1 bg-[#151515] border border-[#333] rounded text-xs text-neutral-300">
                                                        {label}
                                                    </span>
                                                ))}
                                                {selectedHost.detection_labels.length === 0 && (
                                                    <span className="text-neutral-600 text-xs italic">No specific detections</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="bg-black/40 border border-[#222] rounded-lg p-4">
                                            <div className="text-xs font-bold text-[#888] uppercase mb-3">Network Information</div>
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <div className="text-[#AAA]">ASN</div>
                                                    <div className="text-white font-mono">{selectedHost.asn_number} - {selectedHost.asn_org}</div>
                                                </div>
                                                <div>
                                                    <div className="text-[#AAA]">Location</div>
                                                    <div className="text-white">
                                                    {countryCodeFor(selectedHost.geo_country) ? (
                                                        <span className="inline-flex items-center gap-2">
                                                            <ReactCountryFlag svg countryCode={countryCodeFor(selectedHost.geo_country) as string} style={{ width: '18px', height: '12px' }} title={countryNameFor(selectedHost.geo_country) || selectedHost.geo_country} />
                                                            <span>{selectedHost.geo_city}, {countryNameFor(selectedHost.geo_country) || selectedHost.geo_country}</span>
                                                        </span>
                                                    ) : (
                                                        <span>{selectedHost.geo_city}, {countryNameFor(selectedHost.geo_country) || selectedHost.geo_country}</span>
                                                    )}
                                                </div>
                                                </div>
                                                <div>
                                                    <div className="text-[#AAA]">IP Flags</div>
                                                    <div className="flex gap-2">
                                                        {selectedHost.ip_is_cloud && <span className="px-2 py-0.5 bg-[#111] text-red-400 border border-neutral-500/30 rounded text-xs">Cloud</span>}
                                                        {selectedHost.ip_is_tor && <span className="px-2 py-0.5 bg-neutral-900/30 text-red-400 border border-neutral-500/30 rounded text-xs">Tor</span>}
                                                        {selectedHost.ip_is_private && <span className="px-2 py-0.5 bg-[#111] text-[#AAA] border border-neutral-500/30 rounded text-xs">Private</span>}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-[#AAA]">Honeypots Targeted</div>
                                                    <div className="text-white">{selectedHost.honeypots_targeted.join(', ')}</div>
                                                </div>
                                                {selectedHost.dns_hostname && (
                                                    <div className="col-span-2">
                                                        <div className="text-[#AAA]">DNS Hostname</div>
                                                        <div className="text-white font-mono text-xs break-all">{selectedHost.dns_hostname}</div>
                                                    </div>
                                                )}
                                                <div className="col-span-2">
                                                    <div className="text-[#AAA] mb-1">Last Updated</div>
                                                    <div className="text-white font-mono text-xs">{parseUtc(selectedHost.last_updated).toLocaleString()}</div>
                                                </div>
                                            </div>
                                        </div>

                                        {hostDetails?.enrichment && (
                                            <div className="bg-black/40 border border-[#222] rounded-lg p-4">
                                                <div className="text-xs font-bold text-[#888] uppercase mb-3">Deep Enrichment</div>
                                                <div className="space-y-4">
                                                    <div>
                                                        <div className="text-[#AAA] mb-2">AbuseIPDB</div>
                                                        <div className="bg-[#111] p-3 rounded border border-[#222]">
                                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                                <div>
                                                                    <div className="text-[#AAA]">Confidence Score</div>
                                                                    <div className="text-white font-mono">{hostDetails.enrichment.reputation.abuseipdb.abuse_confidence_score}%</div>
                                                                </div>
                                                                <div>
                                                                    <div className="text-[#AAA]">Total Reports</div>
                                                                    <div className="text-white font-mono">{hostDetails.enrichment.reputation.abuseipdb.total_reports}</div>
                                                                </div>
                                                                <div>
                                                                    <div className="text-[#AAA]">Usage Type</div>
                                                                    <div className="text-white">{hostDetails.enrichment.reputation.abuseipdb.usage_type}</div>
                                                                </div>
                                                                <div>
                                                                    <div className="text-[#AAA]">ISP</div>
                                                                    <div className="text-white">{hostDetails.enrichment.reputation.abuseipdb.isp}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-[#AAA] mb-2">OTX Pulses</div>
                                                        <div className="space-y-2">
                                                            {hostDetails.enrichment.reputation.otx.pulses.slice(0, 3).map((pulse, i) => (
                                                                <div key={i} className="bg-[#111] p-3 rounded border border-[#222]">
                                                                    <div className="text-white font-bold text-sm">{pulse.name}</div>
                                                                    <div className="text-[#AAA] text-xs mt-1">{pulse.description}</div>
                                                                    <div className="flex gap-2 mt-2">
                                                                        {pulse.tags.slice(0, 3).map((tag, j) => (
                                                                            <span key={j} className="px-1.5 py-0.5 bg-[#151515] rounded text-xs text-neutral-300">{tag}</span>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}

                                {detailTab === ('TIMELINE' as any) && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-xs font-bold text-[#AAA] uppercase shrink-0">Hit Timeline — {selectedHost.src_ip}</span>
                                            <div className="flex items-center gap-2">
                                                <div className="flex bg-[#111] rounded p-0.5 border border-[#222]">
                                                    {(['24h', '7d', '30d'] as const).map(r => (
                                                        <button
                                                            key={r}
                                                            onClick={() => setIpTimelineRange(r)}
                                                            className={`px-2.5 py-1 text-[10px] font-bold rounded transition-all ${
                                                                ipTimelineRange === r
                                                                    ? 'bg-red-500 text-black shadow-[0_0_8px_rgba(0,243,255,0.3)]'
                                                                    : 'text-[#AAA] hover:text-white'
                                                            }`}
                                                        >
                                                            {r.toUpperCase()}
                                                        </button>
                                                    ))}
                                                </div>
                                                <button onClick={() => fetchIpTimeline(selectedHost.src_ip, ipTimelineRange)} className="p-1.5 bg-[#151515] hover:bg-[#1C1C1C] border border-[#333] rounded text-[#AAA] hover:text-white transition-colors">
                                                    <RefreshCw size={12} className={isLoadingIpTimeline ? 'animate-spin' : ''} />
                                                </button>
                                            </div>
                                        </div>
                                        {isLoadingIpTimeline ? (
                                            <div className="flex items-center justify-center h-64 text-[#888]">
                                                <RefreshCw className="animate-spin mr-2" size={18} /> Loading timeline...
                                            </div>
                                        ) : ipTimeline && ipTimeline.buckets.length > 0 ? (
                                            <>
                                                <div className="flex gap-4 text-xs text-[#AAA]">
                                                    <span>Total events: <span className="font-mono font-bold text-white">{ipTimeline.total_events.toLocaleString()}</span></span>
                                                </div>
                                                <div className="bg-black/40 border border-[#222] rounded-xl p-4">
                                                    <ResponsiveContainer width="100%" height={220}>
                                                        <AreaChart data={ipTimeline.buckets} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                                                            <defs>
                                                                <linearGradient id="ipTimelineGrad" x1="0" y1="0" x2="0" y2="1">
                                                                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                                                                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                                                </linearGradient>
                                                            </defs>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                                                            <XAxis
                                                                dataKey="time"
                                                                tick={{ fill: '#6b7280', fontSize: 9 }}
                                                                tickFormatter={(v: string) => {
                                                                    try {
                                                                        const d = new Date(v);
                                                                        return ipTimelineRange === '24h'
                                                                            ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                                                                            : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                                                                    } catch { return v; }
                                                                }}
                                                            />
                                                            <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} />
                                                            <ReTooltip
                                                                contentStyle={{ background: '#0d1117', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
                                                                labelStyle={{ color: '#9ca3af' }}
                                                                formatter={(val: any, name: string) => [val, 'Events']}
                                                            />
                                                            <Area type="monotone" dataKey="total_events" name="Events" stroke="#f97316" fill="url(#ipTimelineGrad)" strokeWidth={2} dot={false} />
                                                        </AreaChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex items-center justify-center h-64 text-[#888] font-mono text-sm">No timeline data for this host.</div>
                                        )}
                                    </div>
                                )}

                                {detailTab === 'EVENTS' && (
                                    <div className="space-y-4">
                                        {isLoadingEvents && hostEvents.length === 0 ? (
                                            <div className="text-center py-8">
                                                <RefreshCw className="w-8 h-8 animate-spin text-white mx-auto mb-4" />
                                                <div className="text-[#AAA] font-mono">Loading events...</div>
                                            </div>
                                        ) : hostEvents.length === 0 ? (
                                            <div className="text-center py-8 text-[#888]">
                                                No events found for this host.
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {hostEvents.map((event, i) => (
                                                    <div key={i} className="bg-black/40 border border-[#222] rounded-lg p-4">
                                                        <div className="flex justify-between items-start mb-3">
                                                            <div className="flex items-center gap-3">
                                                                <span className="px-2 py-1 bg-neutral-900/30 text-white border border-neutral-500/30 rounded text-xs font-bold">
                                                                    {event.honeypot.toUpperCase()}
                                                                </span>
                                                                <span className="text-xs text-[#AAA] font-mono">
                                                                    {new Date(event.timestamp).toLocaleString()}
                                                                </span>
                                                            </div>
                                                            <span className="text-xs text-[#888] font-mono">
                                                                {event.event_type}
                                                            </span>
                                                        </div>
                                                        <div className="text-sm text-neutral-300 font-mono bg-black/40 p-3 rounded border border-[#222]">
                                                            {event.honeypot_data ? JSON.stringify(JSON.parse(event.honeypot_data), null, 2) : 'No additional data'}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {detailTab === 'COMMANDS' && (
                                    <div className="space-y-4">
                                        {isLoadingCommands && hostCommands.length === 0 ? (
                                            <div className="text-center py-8">
                                                <RefreshCw className="w-8 h-8 animate-spin text-red-500 mx-auto mb-4" />
                                                <div className="text-[#AAA] font-mono">Loading commands...</div>
                                            </div>
                                        ) : hostCommands.length === 0 ? (
                                            <div className="text-center py-8 text-[#888]">
                                                No commands found for this host.
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {hostCommands.map((cmd, i) => (
                                                    <div key={i} className="bg-black/40 border border-[#222] rounded-lg p-4">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className="text-red-400 font-mono text-sm">
                                                                <span className="text-neutral-600">$</span> {cmd.command}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs text-[#888] font-mono">
                                                                    {cmd.frequency} times
                                                                </span>
                                                                <div className="flex gap-1">
                                                                    {cmd.honeypots.map((hp, j) => (
                                                                        <span key={j} className="px-1.5 py-0.5 bg-[#151515] border border-[#333] rounded text-xs text-neutral-300">
                                                                            {hp}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-xs text-[#888]">
                                                            First: {new Date(cmd.first_seen).toLocaleString()} | 
                                                            Last: {new Date(cmd.last_seen).toLocaleString()}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
