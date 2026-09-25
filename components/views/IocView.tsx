
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { iocService, IocFeedItem, IocStats, sourceLabels } from '../../api/services';
import { downloadFile } from '../../services/exporter';
import { enrichIP, checkRBL, checkDomainSecurity } from '../../services/dns';
import { mmdbService } from '../../services/mmdb';
import { fetchOtxWhois, fetchOtxIndicator } from '../../services/otx';
import { fetchShadowserverMalwareInfo, ShadowserverMalwareInfo } from '../../services/shadowserver';
import { 
    Search, Globe, Database, Shield, Hash, Server,
    Download, RefreshCw,
    CheckCircle, XCircle, ExternalLink,
    ChevronRight, X, ChevronLeft, Flag, Activity, MapPin, FileJson,
    Copy, Check, ArrowUpDown, ShieldAlert, Network
} from 'lucide-react';

const SEVERITY_BORDER: Record<string, string> = {
    critical: 'border-l-red-500',
    high:     'border-l-orange-500',
    medium:   'border-l-yellow-500',
    low:      'border-l-gray-500',
};

const SEVERITY_BADGE: Record<string, string> = {
    critical: 'text-red-500 border-red-500/50 bg-red-900/20',
    high:     'text-orange-500 border-orange-500/50 bg-orange-900/20',
    medium:   'text-yellow-500 border-yellow-500/50 bg-yellow-900/20',
    low:      'text-gray-400 border-gray-500/50 bg-gray-900/20',
};

function ageBadge(dateStr: string): string {
    const ms = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
}

function typeIcon(type: string) {
    if (type === 'ip' || type === 'network') return <Server size={14} className="text-blue-400"/>;
    if (type === 'domain' || type === 'url') return <Globe size={14} className="text-orange-400"/>;
    return <Hash size={14} className="text-purple-400"/>;
}

function typeLabel(type: string) {
    const map: Record<string, string> = { ip: 'IP', network: 'Network', domain: 'Domain', url: 'URL', hash: 'HASH' };
    return map[type] ?? type.toUpperCase();
}

interface EnrichmentData {
    loading: boolean;
    geo?: any;
    rbl?: { status: string; listedIn: string[] };
    security?: any[];
    whois?: any;
    otx?: any;
    shadowserver?: ShadowserverMalwareInfo;
    error?: boolean;
    timestamp: number;
}

const StatCard = ({ title, value, icon: Icon, color, subtext }: any) => (
    <div className="bg-gray-900/40 border border-gray-800 p-4 rounded-lg flex items-center justify-between group hover:border-gray-700 transition-all">
        <div>
            <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1">{title}</div>
            <div className={`text-2xl font-mono font-bold ${color}`}>{value}</div>
            {subtext && <div className="text-[10px] text-gray-600 mt-1">{subtext}</div>}
        </div>
        <div className={`p-3 rounded-lg bg-black/20 ${color.replace('text-', 'text-opacity-50 ')}`}>
            <Icon size={24} />
        </div>
    </div>
);

export interface IocViewProps {}

export const IocView: React.FC<IocViewProps> = () => {
    const [stats, setStats] = useState<IocStats | null>(null);
    const [feed, setFeed] = useState<IocFeedItem[]>([]);
    const [feedTotal, setFeedTotal] = useState(0);
    const [feedPages, setFeedPages] = useState(0);
    const [isLoadingFeed, setIsLoadingFeed] = useState(false);
    const [filterOptions, setFilterOptions] = useState<{ sources: string[]; threats: string[]; locs: string[] }>({ sources: [], threats: [], locs: [] });
    const [searchQuery, setSearchQuery] = useState('');
    const [filterSource, setFilterSource] = useState('all');
    const [filterType, setFilterType] = useState<'all'|'network'|'hash'>('all');
    const [filterThreat, setFilterThreat] = useState('all');
    const [filterLoc, setFilterLoc] = useState('all');
    const [sortBy, setSortBy] = useState<'age'|'confidence'|'severity'>('age');
    const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;
    const [showSuggestions, setShowSuggestions] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [selectedIoc, setSelectedIoc] = useState<IocFeedItem | null>(null);
    const [detailTab, setDetailTab] = useState<'INTELLIGENCE'|'TECHNICAL'|'RAW'>('INTELLIGENCE');
    const [enrichmentCache, setEnrichmentCache] = useState<Record<string, EnrichmentData>>({});
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

    const loadStats = useCallback(async () => {
        try { const res = await iocService.getStats(); if (res.success) setStats(res.data); } catch (e) { console.error('[IocView] stats', e); }
    }, []);

    const loadFilters = useCallback(async () => {
        try { const res = await iocService.getFilters(); if (res.success) setFilterOptions(res.data); } catch (e) { console.error('[IocView] filters', e); }
    }, []);

    const loadFeed = useCallback(async (overrides: Record<string, any> = {}) => {
        try {
            setIsLoadingFeed(true);
            const res = await iocService.getFeed({
                search:  overrides.search  ?? (searchQuery || undefined),
                source:  overrides.source  ?? (filterSource !== 'all' ? filterSource : undefined),
                type:    (overrides.type   ?? (filterType   !== 'all' ? filterType   : undefined)) as any,
                threat:  overrides.threat  ?? (filterThreat !== 'all' ? filterThreat : undefined),
                loc:     overrides.loc     ?? (filterLoc    !== 'all' ? filterLoc    : undefined),
                page:    overrides.page    ?? currentPage,
                limit:   itemsPerPage,
                sortBy:  (overrides.sortBy  ?? sortBy) as any,
                sortDir: (overrides.sortDir ?? sortDir) as any,
            });
            if (res.success) { setFeed(res.data); setFeedTotal(res.total); setFeedPages(res.pages); }
        } catch (e) { console.error('[IocView] feed', e); }
        finally { setIsLoadingFeed(false); }
    }, [searchQuery, filterSource, filterType, filterThreat, filterLoc, currentPage, sortBy, sortDir]);

    useEffect(() => { loadStats(); loadFilters(); loadFeed(); }, []);
    useEffect(() => { setCurrentPage(1); loadFeed({ page: 1 }); }, [filterSource, filterType, filterThreat, filterLoc, sortBy, sortDir]);
    useEffect(() => { loadFeed(); }, [currentPage]);

    const handleSearchChange = (val: string) => {
        setSearchQuery(val);
        if (searchDebounce.current) clearTimeout(searchDebounce.current);
        searchDebounce.current = setTimeout(() => { setCurrentPage(1); loadFeed({ search: val || undefined, page: 1 }); }, 400);
    };

    const handleRefresh = async () => {
        try {
            await Promise.all([loadStats(), loadFilters()]);
            setCurrentPage(1);
            await loadFeed({ page: 1 });
        } catch (e) {
            console.error('[IocView] refresh', e);
        }
    };

    const handleSort = (field: 'age'|'confidence'|'severity') => {
        if (sortBy === field) setSortDir(p => p === 'asc' ? 'desc' : 'asc');
        else { setSortBy(field); setSortDir('desc'); }
    };

    const handleCopy = (e: React.MouseEvent, value: string) => {
        e.stopPropagation(); navigator.clipboard.writeText(value); setCopiedId(value); setTimeout(() => setCopiedId(null), 2000);
    };

    const handleEnrich = async (ioc: IocFeedItem) => {
        const key = ioc.indicator_value;
        if (enrichmentCache[key]) return;
        setEnrichmentCache(p => ({ ...p, [key]: { loading: true, timestamp: Date.now() } }));
        try {
            const target = ioc.indicator_value.split(':')[0];
            let geo: any, rbl: any, security: any, whois: any, otx: any, shadowserver: any;
            if (ioc.indicator_type === 'ip' || ioc.indicator_type === 'network') {
                const localGeo = mmdbService.lookup(target);
                geo = localGeo || await enrichIP(target);
                rbl = await checkRBL(target);
                otx = await fetchOtxIndicator(target);
            } else if (ioc.indicator_type === 'domain' || ioc.indicator_type === 'url') {
                let domain = target;
                try { domain = new URL(target.startsWith('http') ? target : `http://${target}`).hostname; } catch {}
                [security, whois, otx] = await Promise.all([checkDomainSecurity(domain), fetchOtxWhois(domain), fetchOtxIndicator(domain)]);
            } else if (ioc.indicator_type === 'hash') {
                [otx, shadowserver] = await Promise.all([fetchOtxIndicator(target), fetchShadowserverMalwareInfo(target)]);
            }
            setEnrichmentCache(p => ({ ...p, [key]: { loading: false, timestamp: Date.now(), geo, rbl: rbl ? { status: rbl.status, listedIn: rbl.listedIn } : undefined, security, whois, otx, shadowserver } }));
        } catch {
            setEnrichmentCache(p => ({ ...p, [key]: { loading: false, error: true, timestamp: Date.now() } }));
        }
    };

    const handleExportCsv = () => {
        const rows = feed.map(i => `${sourceLabels[i.source] ?? i.source},${i.indicator_type},${i.indicator_value},"${i.threat}",${i.loc ?? ''},${i.first_seen}`).join('\n');
        downloadFile(`Source,Type,Value,Threat,Loc,FirstSeen\n${rows}`, `iocs_${Date.now()}.csv`, 'text/csv');
    };

    return (
        <div className="h-full flex flex-col bg-cyber-grid relative overflow-hidden">
            <div className="p-6 border-b border-gray-800 bg-black/40 backdrop-blur-sm shrink-0">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-white font-cyber flex items-center gap-2">
                                <Database className="text-red-500"/> IOC <span className="text-red-500">MANAGER</span>
                            </h2>
                            <p className="text-xs text-gray-500 font-mono">Aggregated Threat Intelligence Database</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleExportCsv} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors text-xs font-bold flex items-center gap-2" title="Export CSV">
                                <Download size={14}/> CSV
                            </button>
                            <button onClick={handleRefresh} disabled={isLoadingFeed} className="px-4 py-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-500/30 rounded text-xs font-bold flex items-center gap-2 transition-colors disabled:opacity-50 ml-2">
                                <RefreshCw className={isLoadingFeed ? 'animate-spin' : ''} size={14}/>
                                REFRESH
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-6 py-3 border-b border-gray-800 bg-gray-900/30 flex flex-wrap items-center gap-3 shrink-0">
                <div className="relative group w-64 z-30">
                    <Search className="absolute left-3 top-2.5 text-gray-500 w-3.5 h-3.5"/>
                    <input ref={searchInputRef} type="text" placeholder="Search IOCs..." className="w-full bg-black/50 border border-gray-700 rounded-lg pl-9 pr-4 py-1.5 text-xs text-gray-300 focus:border-red-500 focus:outline-none transition-all font-mono" value={searchQuery} onChange={e => handleSearchChange(e.target.value)} onFocus={() => setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}/>
                    {showSuggestions && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-3 text-[10px] text-gray-500 animate-fade-in z-50">
                            Type to search indicator values, threats, or tags
                        </div>
                    )}
                </div>
                <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className="bg-black/50 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:border-red-500 outline-none cursor-pointer hover:bg-gray-800 transition-colors max-w-[140px]">
                    <option value="all">All Sources</option>
                    {filterOptions.sources.map(s => <option key={s} value={s}>{sourceLabels[s] ?? s}</option>)}
                </select>
                <select value={filterType} onChange={e => setFilterType(e.target.value as any)} className="bg-black/50 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:border-red-500 outline-none cursor-pointer hover:bg-gray-800 transition-colors">
                    <option value="all">All Types</option><option value="network">Network (IP/URL)</option><option value="hash">Files (Hash)</option>
                </select>
                <select value={filterThreat} onChange={e => setFilterThreat(e.target.value)} disabled={filterOptions.threats.length === 0} className="bg-black/50 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:border-red-500 outline-none cursor-pointer hover:bg-gray-800 transition-colors max-w-[150px] disabled:opacity-50">
                    <option value="all">All Threats</option>
                    {filterOptions.threats.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={filterLoc} onChange={e => setFilterLoc(e.target.value)} disabled={filterOptions.locs.length === 0} className="bg-black/50 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:border-red-500 outline-none cursor-pointer hover:bg-gray-800 transition-colors max-w-[100px] disabled:opacity-50">
                    <option value="all">All Locs</option>
                    {filterOptions.locs.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <div className="ml-auto text-[10px] text-gray-600 font-mono">{feedTotal.toLocaleString()} indicators</div>
            </div>

            <div className="flex-1 flex overflow-hidden relative">
                <div className="flex-1 flex flex-col min-w-0 bg-black/20">
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 relative">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                            <StatCard title="Total Indicators" value={stats ? stats.total_indicators.toLocaleString() : ''} icon={Shield} color="text-blue-400" />
                            <StatCard title="Active Network IOCs" value={stats ? stats.active_network_iocs.toLocaleString() : ''} icon={Globe} color="text-orange-400" subtext="IPs, Domains, URLs"/>
                            <StatCard title="File Hashes" value={stats ? stats.file_hashes.toLocaleString() : ''} icon={FileJson} color="text-purple-400" subtext="MD5, SHA256"/>
                            <StatCard title="New (24h)" value={stats ? stats.new_24h.toLocaleString() : ''} icon={Activity} color="text-green-400" subtext="Fresh Intelligence"/>
                        </div>
                        {isLoadingFeed && feed.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
                                <RefreshCw className="animate-spin opacity-50" size={32}/>
                                <p className="font-mono text-sm">Fetching threat intelligence...</p>
                            </div>
                        ) : feed.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
                                <Database size={48} className="opacity-20"/>
                                <p className="font-mono text-sm">No indicators match the current filters.</p>
                                <button onClick={handleRefresh} className="px-4 py-2 bg-red-900/20 text-red-400 border border-red-500/30 rounded text-xs font-bold">REFRESH</button>
                            </div>
                        ) : (
                            <div className="bg-gray-900/40 border border-gray-800 rounded-lg shadow-lg overflow-x-auto">
                                <table className="min-w-full text-left text-xs">
                                    <thead className="bg-gray-900 text-gray-400 uppercase font-bold sticky top-0 z-10">
                                        <tr>
                                            <th className="p-3 w-10"></th>
                                            <th className="p-3 w-24">Type</th>
                                            <th className="p-3">Indicator</th>
                                            <th className="p-3 w-20">Loc</th>
                                            <th className="p-3 w-44">Threat</th>
                                            <th className="p-3 w-36">Source</th>
                                            <th className="p-3 w-20 cursor-pointer hover:text-white" onClick={() => handleSort('age')}>Age {sortBy === 'age' && <ArrowUpDown size={10} className="inline"/>}</th>
                                            <th className="p-3 w-16 cursor-pointer hover:text-white" onClick={() => handleSort('confidence')}>Conf {sortBy === 'confidence' && <ArrowUpDown size={10} className="inline"/>}</th>
                                            <th className="p-3 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-800/50 text-gray-300">
                                        {feed.map(ioc => {
                                            const sev = ioc.severity?.toLowerCase() ?? 'medium';
                                            const borderClass = SEVERITY_BORDER[sev] ?? 'border-l-blue-500';
                                            const badgeClass  = SEVERITY_BADGE[sev]  ?? SEVERITY_BADGE.medium;
                                            const isSelected = selectedIoc?.indicator_value === ioc.indicator_value;
                                            return (
                                                <tr key={`${ioc.source}-${ioc.indicator_value}`} onClick={() => { setSelectedIoc(ioc); handleEnrich(ioc); }} className={`cursor-pointer hover:bg-white/5 transition-colors border-l-4 ${borderClass} ${isSelected ? 'bg-white/5' : ''}`}>
                                                    <td className="p-3 text-center">{typeIcon(ioc.indicator_type)}</td>
                                                    <td className="p-3 font-mono text-[10px] text-gray-500">{typeLabel(ioc.indicator_type)}</td>
                                                    <td className="p-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="font-mono font-bold text-white truncate max-w-xs" title={ioc.indicator_value}>{ioc.indicator_value}</div>
                                                            <button onClick={e => handleCopy(e, ioc.indicator_value)} className="p-1 text-gray-500 hover:text-white hover:bg-gray-800 rounded transition-colors shrink-0">
                                                                {copiedId === ioc.indicator_value ? <Check size={12} className="text-green-500"/> : <Copy size={12}/>}
                                                            </button>
                                                        </div>
                                                        {ioc.tags?.length > 0 && <div className="flex gap-1 mt-1 flex-wrap">{ioc.tags.slice(0, 4).map(t => <span key={t} className="text-[9px] bg-gray-800 px-1.5 rounded text-gray-400 border border-gray-700">{t}</span>)}</div>}
                                                    </td>
                                                    <td className="p-3">
                                                        {ioc.loc ? <div className="flex items-center gap-1.5"><img src={`https://flagcdn.com/w20/${ioc.loc.toLowerCase()}.png`} className="w-4 h-3 rounded-sm" alt={ioc.loc}/><span className="font-mono text-gray-300">{ioc.loc}</span></div> : <span className="text-gray-600 italic"></span>}
                                                    </td>
                                                    <td className="p-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass}`}>{ioc.threat}</span></td>
                                                    <td className="p-3 text-gray-400">{sourceLabels[ioc.source] ?? ioc.source}</td>
                                                    <td className="p-3 text-right font-mono text-gray-500">{ageBadge(ioc.last_seen)}</td>
                                                    <td className="p-3 text-center font-mono text-gray-500">{ioc.confidence}%</td>
                                                    <td className="p-3 text-right"><ChevronRight size={14} className="text-gray-600"/></td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                    {feedPages > 1 && (
                        <div className="p-3 border-t border-gray-800 bg-gray-900/50 flex items-center justify-between text-xs text-gray-400 shrink-0">
                            <div>Showing {((currentPage-1)*itemsPerPage+1).toLocaleString()}{Math.min(currentPage*itemsPerPage,feedTotal).toLocaleString()} of {feedTotal.toLocaleString()}</div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setCurrentPage(p => Math.max(1,p-1))} disabled={currentPage===1||isLoadingFeed} className="p-1 hover:bg-gray-800 rounded disabled:opacity-50"><ChevronLeft size={16}/></button>
                                <span className="font-mono">{currentPage} / {feedPages}</span>
                                <button onClick={() => setCurrentPage(p => Math.min(feedPages,p+1))} disabled={currentPage===feedPages||isLoadingFeed} className="p-1 hover:bg-gray-800 rounded disabled:opacity-50"><ChevronRight size={16}/></button>
                            </div>
                        </div>
                    )}
                </div>

                {selectedIoc && (
                    <div className="w-[min(62vw,560px)] min-w-[460px] bg-[#0d1117] border-l border-gray-800 flex flex-col shadow-2xl animate-slide-in-right z-20">
                        <div className="p-6 border-b border-gray-800 bg-gray-900/30 flex justify-between items-start shrink-0">
                            <div>
                                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase mb-2">
                                    {typeIcon(selectedIoc.indicator_type)} {typeLabel(selectedIoc.indicator_type)} INDICATOR
                                </div>
                                <h3 className="text-xl font-bold text-white font-mono break-all leading-tight mb-3 select-all">{selectedIoc.indicator_value}</h3>
                                <div className="flex gap-2 flex-wrap">
                                    <span className={`px-2 py-0.5 text-xs font-bold rounded border ${SEVERITY_BADGE[selectedIoc.severity?.toLowerCase()??'medium']??SEVERITY_BADGE.medium}`}>{selectedIoc.severity?.toUpperCase()??'MEDIUM'}</span>
                                    {selectedIoc.loc && <span className="px-2 py-0.5 bg-gray-800 text-gray-300 border border-gray-700 rounded text-xs flex items-center gap-1"><Flag size={10}/> {selectedIoc.loc}</span>}
                                    <span className="px-2 py-0.5 bg-gray-800 text-gray-400 border border-gray-700 rounded text-xs">Conf: {selectedIoc.confidence}%</span>
                                </div>
                            </div>
                            <button onClick={() => setSelectedIoc(null)} className="text-gray-500 hover:text-white bg-gray-800 p-1.5 rounded"><X size={16}/></button>
                        </div>
                        <div className="flex border-b border-gray-800 bg-gray-900/10">
                            <button onClick={() => setDetailTab('INTELLIGENCE')} className={`flex-1 py-3 text-xs font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${detailTab==='INTELLIGENCE'?'border-red-500 text-white':'border-transparent text-gray-500 hover:text-gray-300'}`}><ShieldAlert size={12}/> INTEL</button>
                            <button onClick={() => setDetailTab('TECHNICAL')} className={`flex-1 py-3 text-xs font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${detailTab==='TECHNICAL'?'border-blue-500 text-white':'border-transparent text-gray-500 hover:text-gray-300'}`}><Network size={12}/> TECHNICAL</button>
                            <button onClick={() => setDetailTab('RAW')} className={`flex-1 py-3 text-xs font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${detailTab==='RAW'?'border-purple-500 text-white':'border-transparent text-gray-500 hover:text-gray-300'}`}><FileJson size={12}/> RAW</button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 bg-black/20">
                            {detailTab === 'INTELLIGENCE' && (
                                <div className="space-y-4">
                                    <div className="bg-gray-900/30 border border-gray-800 rounded-lg p-4">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2"><Activity size={12}/> Attribution &amp; Context</h4>
                                        <div className="space-y-2 text-xs text-gray-300">
                                            <div className="flex justify-between border-b border-gray-800/50 pb-1"><span className="text-gray-500">Threat</span><span className="text-white font-bold">{selectedIoc.threat}</span></div>
                                            <div className="flex justify-between border-b border-gray-800/50 pb-1"><span className="text-gray-500">Source</span><span className="text-blue-400">{sourceLabels[selectedIoc.source]??selectedIoc.source}</span></div>
                                            <div className="flex justify-between border-b border-gray-800/50 pb-1"><span className="text-gray-500">First Seen</span><span className="text-white font-mono">{new Date(selectedIoc.first_seen).toLocaleString()}</span></div>
                                            <div className="flex justify-between border-b border-gray-800/50 pb-1"><span className="text-gray-500">Last Seen</span><span className="text-white font-mono">{new Date(selectedIoc.last_seen).toLocaleString()}</span></div>
                                            <div className="flex justify-between border-b border-gray-800/50 pb-1"><span className="text-gray-500">Confidence</span><span className="text-white font-mono">{selectedIoc.confidence}%</span></div>
                                            {selectedIoc.tags?.length > 0 && <div className="pt-2"><div className="text-gray-500 mb-1">Tags</div><div className="flex flex-wrap gap-1">{selectedIoc.tags.map((t,i)=><span key={i} className="px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700 text-[10px]">{t}</span>)}</div></div>}
                                        </div>
                                    </div>
                                    {enrichmentCache[selectedIoc.indicator_value] ? (
                                        enrichmentCache[selectedIoc.indicator_value].loading ? (
                                            <div className="p-8 text-center text-gray-500 italic border border-dashed border-gray-800 rounded flex flex-col items-center gap-2"><RefreshCw className="animate-spin" size={24}/>Running enrichment...</div>
                                        ) : (
                                            <>
                                                {enrichmentCache[selectedIoc.indicator_value].rbl && (
                                                    <div className={`p-4 rounded border text-xs ${enrichmentCache[selectedIoc.indicator_value].rbl?.status==='LISTED'?'bg-red-900/10 border-red-500/30':'bg-green-900/10 border-green-500/30'}`}>
                                                        <div className="font-bold mb-1 flex items-center gap-2 uppercase">
                                                            {enrichmentCache[selectedIoc.indicator_value].rbl?.status==='LISTED'?<XCircle size={14} className="text-red-400"/>:<CheckCircle size={14} className="text-green-400"/>}
                                                            <span className={enrichmentCache[selectedIoc.indicator_value].rbl?.status==='LISTED'?'text-red-400':'text-green-400'}>RBL: {enrichmentCache[selectedIoc.indicator_value].rbl?.status}</span>
                                                        </div>
                                                        {(enrichmentCache[selectedIoc.indicator_value].rbl?.listedIn??[]).length>0 && <div className="text-[10px] text-gray-400 pl-6">Listed in: {enrichmentCache[selectedIoc.indicator_value].rbl?.listedIn.join(', ')}</div>}
                                                    </div>
                                                )}
                                                {enrichmentCache[selectedIoc.indicator_value].otx && (
                                                    <div className="bg-black/40 border border-gray-800 rounded-lg p-4">
                                                        <h4 className="text-xs font-bold text-orange-400 uppercase mb-3 flex items-center gap-2"><ShieldAlert size={12}/> Threat Exchange</h4>
                                                        <div className="text-xs text-gray-300 space-y-2">
                                                            <div className="flex justify-between border-b border-gray-800 pb-2"><span className="text-gray-500">Pulse Count</span><span className="font-bold text-white">{enrichmentCache[selectedIoc.indicator_value].otx.pulse_count}</span></div>
                                                            {enrichmentCache[selectedIoc.indicator_value].otx.pulses?.map((pulse: any, idx: number) => (
                                                                <div key={idx} className="bg-gray-900/50 p-3 rounded border border-gray-700/50 space-y-1">
                                                                    <div className="font-bold text-white text-sm truncate">{pulse.name}</div>
                                                                    {pulse.description && <div className="text-[10px] text-gray-400 italic line-clamp-2">{pulse.description}</div>}
                                                                    {pulse.tags?.length>0 && <div className="flex flex-wrap gap-1">{pulse.tags.map((t:string,i:number)=><span key={i} className="text-[9px] bg-gray-800 text-gray-400 px-1.5 rounded border border-gray-700">{t}</span>)}</div>}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {enrichmentCache[selectedIoc.indicator_value].shadowserver && (
                                                    <div className="bg-black/40 border border-gray-800 rounded-lg p-4">
                                                        <h4 className="text-xs font-bold text-blue-400 uppercase mb-3 flex items-center gap-2"><ShieldAlert size={12}/> Shadowserver</h4>
                                                        <div className="text-xs text-gray-300 space-y-2">
                                                            <div className="flex justify-between border-b border-gray-800 pb-1"><span className="text-gray-500">File Type</span><span className="text-white">{enrichmentCache[selectedIoc.indicator_value].shadowserver!.magic}</span></div>
                                                            <div className="flex justify-between border-b border-gray-800 pb-1"><span className="text-gray-500">First Seen</span><span className="text-white">{enrichmentCache[selectedIoc.indicator_value].shadowserver!.first_seen}</span></div>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )
                                    ) : (
                                        <div className="text-center py-6 text-gray-600 text-xs italic bg-black/40 rounded border border-gray-800 border-dashed">Auto-enrichment pending...</div>
                                    )}
                                    <div className="grid grid-cols-2 gap-2">
                                        <a href={`https://www.virustotal.com/gui/search/${encodeURIComponent(selectedIoc.indicator_value)}`} target="_blank" rel="noopener noreferrer" className="py-2 bg-blue-900/20 hover:bg-blue-900/30 text-blue-400 border border-blue-500/30 rounded text-xs font-bold flex items-center justify-center gap-2 transition-colors"><ExternalLink size={12}/> VirusTotal</a>
                                        <a href={`https://otx.alienvault.com/indicator/${(selectedIoc.indicator_type==='ip'||selectedIoc.indicator_type==='network')?'ip':'domain'}/${selectedIoc.indicator_value}`} target="_blank" rel="noopener noreferrer" className="py-2 bg-orange-900/20 hover:bg-orange-900/30 text-orange-400 border border-orange-500/30 rounded text-xs font-bold flex items-center justify-center gap-2 transition-colors"><ExternalLink size={12}/> AlienVault</a>
                                    </div>
                                </div>
                            )}
                            {detailTab === 'TECHNICAL' && (
                                <div className="space-y-4">
                                    {enrichmentCache[selectedIoc.indicator_value]?.geo && (
                                        <div className="bg-gray-900/30 border border-gray-800 rounded p-4 text-xs space-y-3">
                                            <h4 className="font-bold text-blue-400 flex items-center gap-2 uppercase"><MapPin size={12}/> Geo-Location</h4>
                                            <div className="grid grid-cols-2 gap-4 text-gray-300">
                                                <div><div className="text-gray-500 mb-1">Country</div><div className="flex items-center gap-2"><img src={enrichmentCache[selectedIoc.indicator_value].geo.flag} className="w-4 h-3 rounded-sm" alt=""/> {enrichmentCache[selectedIoc.indicator_value].geo.country_name}</div></div>
                                                <div><div className="text-gray-500 mb-1">City</div><div>{enrichmentCache[selectedIoc.indicator_value].geo.city}</div></div>
                                                <div className="col-span-2"><div className="text-gray-500 mb-1">ASN / ISP</div><div className="font-mono text-white">{enrichmentCache[selectedIoc.indicator_value].geo.asn?.name} ({enrichmentCache[selectedIoc.indicator_value].geo.asn?.asn})</div></div>
                                            </div>
                                        </div>
                                    )}
                                    {enrichmentCache[selectedIoc.indicator_value]?.whois && (
                                        <div className="bg-gray-900/30 border border-gray-800 rounded p-4 text-xs space-y-3">
                                            <h4 className="font-bold text-purple-400 flex items-center gap-2 uppercase"><Globe size={12}/> Whois</h4>
                                            <div className="space-y-2 text-gray-300">
                                                <div className="flex justify-between"><span className="text-gray-500">Registrar</span><span>{enrichmentCache[selectedIoc.indicator_value].whois.org}</span></div>
                                                <div className="flex justify-between"><span className="text-gray-500">Created</span><span>{enrichmentCache[selectedIoc.indicator_value].whois.registrationDate}</span></div>
                                            </div>
                                        </div>
                                    )}
                                    {(!enrichmentCache[selectedIoc.indicator_value]?.geo && !enrichmentCache[selectedIoc.indicator_value]?.whois) && (
                                        <div className="text-center py-8 text-gray-600 text-xs italic">{enrichmentCache[selectedIoc.indicator_value]?.loading ? 'Fetching...' : 'No technical data available.'}</div>
                                    )}
                                </div>
                            )}
                            {detailTab === 'RAW' && (
                                <div className="bg-black p-4 rounded border border-gray-800 font-mono text-[10px] text-green-400 overflow-x-auto whitespace-pre-wrap max-h-[500px] custom-scrollbar">
                                    {JSON.stringify(selectedIoc, null, 2)}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
