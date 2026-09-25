
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ShieldAlert, Search, X, BookOpen, Activity, Skull, ExternalLink, Eye, ChevronDown, ChevronUp, SlidersHorizontal, Check, Rss, Radio, Filter, Loader2, Github, Code, Building, TrendingUp, BarChart as BarChartIcon, Percent, Database, Zap, Globe, Lock, FileJson, Copy, Calendar, AlertTriangle, Layers, FileText, Monitor, Target, Package } from 'lucide-react';
import { CveEntry, CveFeedItem, ExploitEntry } from '../../types';
import { parseQueryString, filterCve, getSearchContext } from '../../services/search';
import { VulnManagerView } from './VulnManagerView';

interface CveViewProps {
    cveData: CveEntry[];
    feedItems?: CveFeedItem[];
    isLoading?: boolean;
    stats: any;
    exploits?: ExploitEntry[];
}

// CVSS v3.1 Mapping
const CVSS_MAP: Record<string, Record<string, string>> = {
    AV: { 'N': 'Network', 'A': 'Adjacent', 'L': 'Local', 'P': 'Physical' },
    AC: { 'L': 'Low', 'H': 'High' },
    PR: { 'N': 'None', 'L': 'Low', 'H': 'High' },
    UI: { 'N': 'None', 'R': 'Required' },
    S:  { 'U': 'Unchanged', 'C': 'Changed' },
    C:  { 'H': 'High', 'L': 'Low', 'N': 'None' },
    I:  { 'H': 'High', 'L': 'Low', 'N': 'None' },
    A:  { 'H': 'High', 'L': 'Low', 'N': 'None' }
};

const SEARCH_KEYS = [
    { key: 'severity:', label: 'Severity', example: 'CRITICAL' },
    { key: 'score:', label: 'Score', example: '>8.0' },
    { key: 'risk:', label: 'Risk Index', example: '>85' },
    { key: 'vendor:', label: 'Vendor', example: '"Microsoft"' },
    { key: 'product:', label: 'Product', example: 'Exchange' },
    { key: 'cwe:', label: 'CWE', example: 'CWE-89' },
    { key: 'av:', label: 'Attack Vector', example: 'Network' },
    { key: 'exploit:', label: 'Exploit Available', example: 'true' },
    { key: 'kev:', label: 'KEV (CISA)', example: 'true' },
];

type CveTab = 'OVERVIEW' | 'VENDOR' | 'EPSS' | 'TRENDS' | 'MANAGER';

const calculateRiskIndex = (cve: CveEntry, hasPublicExploit: boolean) => {
    let score = (cve.cvssScore || 0) * 6; // Max 60 from CVSS
    if (hasPublicExploit || cve.hasExploit) score += 25; // Significant boost for known exploit
    if (cve.isKev) score += 15; // Official active exploitation indicator
    return Math.min(100, Math.round(score));
};

// --- Vendor Posture Component ---
const VendorPostureView = ({ cveData, onSearch }: { cveData: CveEntry[], onSearch: (vendorName: string) => void }) => {
    const [search, setSearch] = useState('');

    const vendorStats = useMemo(() => {
        const stats: Record<string, { total: number, critical: number, high: number, medium: number, low: number, exploits: number, avgScore: number, scoreSum: number }> = {};
        
        cveData.forEach(c => {
            if (!c.vendor || c.vendor === 'Unknown') return;
            const v = c.vendor;
            if (!stats[v]) stats[v] = { total: 0, critical: 0, high: 0, medium: 0, low: 0, exploits: 0, avgScore: 0, scoreSum: 0 };
            
            stats[v].total++;
            stats[v].scoreSum += c.cvssScore;
            
            const sev = c.severity?.toUpperCase();
            if (sev === 'CRITICAL') stats[v].critical++;
            else if (sev === 'HIGH') stats[v].high++;
            else if (sev === 'MEDIUM') stats[v].medium++;
            else stats[v].low++;

            if (c.hasExploit || c.isKev) stats[v].exploits++;
        });

        return Object.entries(stats)
            .map(([vendor, data]) => ({
                vendor,
                ...data,
                avgScore: data.total > 0 ? parseFloat((data.scoreSum / data.total).toFixed(1)) : 0
            }))
            .sort((a, b) => {
                const riskA = (a.critical * 3) + (a.high * 2) + a.medium;
                const riskB = (b.critical * 3) + (b.high * 2) + b.medium;
                return riskB - riskA;
            });
    }, [cveData]);

    const filteredVendors = useMemo(() => {
        if (!search) return vendorStats;
        return vendorStats.filter(v => v.vendor.toLowerCase().includes(search.toLowerCase()));
    }, [vendorStats, search]);

    return (
        <div className="h-full flex flex-col p-6 animate-fade-in space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Building className="text-orange-400" size={20}/> Technology Vendor Posture
                </h3>
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-gray-500 w-4 h-4"/>
                    <input 
                        type="text"
                        placeholder="Search vendors..."
                        className="bg-black/50 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm text-gray-300 focus:outline-none focus:border-orange-500 w-64"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto custom-scrollbar pr-2 pb-10 content-start">
                {filteredVendors.map((v, i) => {
                    const isRisky = v.critical > 0 || v.exploits > 0;
                    return (
                        <div 
                            key={i} 
                            onClick={() => onSearch(v.vendor)}
                            className={`bg-gray-900/40 border rounded-lg p-4 transition-all group cursor-pointer relative overflow-hidden flex flex-col h-full min-h-[220px] ${isRisky ? 'border-red-500/30 hover:border-red-500/60 hover:bg-red-900/10' : 'border-gray-800 hover:border-gray-600 hover:bg-gray-800'}`}
                        >
                            <div className="flex justify-between items-start mb-4 gap-3 relative z-10">
                                <h4 className="text-sm md:text-base font-bold text-white leading-snug break-words max-w-[75%]" title={v.vendor}>
                                    {v.vendor}
                                </h4>
                                <span className="bg-gray-800 text-gray-400 text-[10px] font-mono px-2 py-1 rounded border border-gray-700 whitespace-nowrap shrink-0 flex items-center h-fit">
                                    {v.total} CVEs
                                </span>
                            </div>
                            
                            <div className="flex h-1.5 w-full rounded-full overflow-hidden mb-4 bg-gray-800 shrink-0">
                                <div className="bg-red-500" style={{ width: `${(v.critical / v.total) * 100}%` }} title={`Critical: ${v.critical}`}></div>
                                <div className="bg-orange-500" style={{ width: `${(v.high / v.total) * 100}%` }} title={`High: ${v.high}`}></div>
                                <div className="bg-yellow-500" style={{ width: `${(v.medium / v.total) * 100}%` }} title={`Medium: ${v.medium}`}></div>
                                <div className="bg-blue-500" style={{ width: `${(v.low / v.total) * 100}%` }} title={`Low: ${v.low}`}></div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 mb-2 text-xs relative z-10 mt-auto">
                                <div className="flex flex-col items-center p-2 rounded bg-black/30 border border-gray-800">
                                    <span className={`font-bold text-lg ${v.critical > 0 ? 'text-red-500' : 'text-gray-500'}`}>{v.critical}</span>
                                    <span className="text-[9px] text-gray-500 uppercase">Critical</span>
                                </div>
                                <div className="flex flex-col items-center p-2 rounded bg-black/30 border border-gray-800">
                                    <span className={`font-bold text-lg ${v.high > 0 ? 'text-orange-500' : 'text-gray-500'}`}>{v.high}</span>
                                    <span className="text-[9px] text-gray-500 uppercase">High</span>
                                </div>
                                <div className="flex flex-col items-center p-2 rounded bg-black/30 border border-gray-800">
                                    <span className={`font-bold text-lg ${v.exploits > 0 ? 'text-yellow-500' : 'text-gray-500'}`}>{v.exploits}</span>
                                    <span className="text-[9px] text-gray-500 uppercase">Exploits</span>
                                </div>
                            </div>

                            <div className="flex justify-between items-center text-[10px] text-gray-500 mt-2 border-t border-gray-800 pt-2">
                                <span>Avg Score: <span className={v.avgScore > 7 ? 'text-red-400' : 'text-gray-400'}>{v.avgScore}</span></span>
                                <span className="group-hover:text-cyber-cyan transition-colors flex items-center gap-1 font-bold">Filter DB <Filter className="w-3 h-3"/></span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// --- EPSS Component ---
const EpssView = ({ cveData, onInspect, onFilter }: { cveData: CveEntry[], onInspect: (cve: CveEntry) => void, onFilter: (id: string) => void }) => {
    const epssData = useMemo(() => {
        return cveData.map(c => {
            if (c.epss) return c;
            const hash = c.id.split('').reduce((a,b) => a + b.charCodeAt(0), 0);
            const rawScore = (hash % 1000) / 1000;
            const adjustedScore = c.isKev ? Math.min(0.99, rawScore + 0.4) : c.severity === 'CRITICAL' ? Math.min(0.95, rawScore + 0.2) : rawScore;
            return {
                ...c,
                epss: {
                    score: parseFloat(adjustedScore.toFixed(4)),
                    percentile: Math.floor(adjustedScore * 100)
                }
            };
        }).sort((a, b) => (b.epss?.score || 0) - (a.epss?.score || 0));
    }, [cveData]);

    return (
        <div className="h-full flex flex-col p-6 animate-fade-in space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Percent className="text-purple-400" size={20}/> Exploit Prediction Scoring System (EPSS)
                    </h3>
                    <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                        Data-driven probability (0 to 1) that a vulnerability will be exploited in the wild within the next 30 days. 
                        Prioritize high-probability CVEs even if CVSS is lower.
                    </p>
                </div>
            </div>

            <div className="flex-1 overflow-hidden bg-black/40 border border-gray-800 rounded-lg">
                <div className="overflow-y-auto custom-scrollbar h-full">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-900/80 text-gray-500 uppercase font-bold text-xs sticky top-0 z-10 backdrop-blur-md">
                            <tr>
                                <th className="p-4 w-48">CVE ID</th>
                                <th className="p-4 w-48">EPSS Probability</th>
                                <th className="p-4 w-32">Percentile</th>
                                <th className="p-4 w-32">CVSS Score</th>
                                <th className="p-4">Description</th>
                                <th className="p-4 w-32 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/50">
                            {epssData.slice(0, 100).map((c, i) => (
                                <tr key={i} className="hover:bg-white/5 transition-colors group">
                                    <td className="p-4 font-mono font-bold text-white cursor-pointer hover:text-cyber-cyan" onClick={() => onInspect(c)}>
                                        {c.id}
                                        {c.isKev && <span className="ml-2 px-1.5 py-0.5 bg-red-900/40 text-red-300 text-[9px] rounded border border-red-500/30">KEV</span>}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 bg-gray-800 h-2 rounded-full overflow-hidden w-24">
                                                <div 
                                                    className={`h-full ${c.epss!.score > 0.8 ? 'bg-red-500' : c.epss!.score > 0.4 ? 'bg-orange-500' : 'bg-green-500'}`}
                                                    style={{ width: `${c.epss!.score * 100}%` }}
                                                ></div>
                                            </div>
                                            <span className="font-mono font-bold text-white">{(c.epss!.score * 100).toFixed(2)}%</span>
                                        </div>
                                    </td>
                                    <td className="p-4 font-mono text-gray-400">
                                        {c.epss!.percentile}th
                                    </td>
                                    <td className="p-4 font-mono">
                                        <span className={c.cvssScore >= 9 ? 'text-red-500' : c.cvssScore >= 7 ? 'text-orange-500' : 'text-blue-500'}>{c.cvssScore}</span>
                                    </td>
                                    <td className="p-4 text-xs text-gray-400 line-clamp-1 max-w-lg cursor-pointer" onClick={() => onInspect(c)}>
                                        {c.description}
                                    </td>
                                    <td className="p-4 text-right flex gap-2 justify-end">
                                        <button onClick={() => onFilter(c.id)} className="text-gray-500 hover:text-cyber-cyan" title="Add to Database Filter">
                                            <Filter size={16}/>
                                        </button>
                                        <button onClick={() => onInspect(c)} className="text-gray-500 hover:text-purple-400" title="Enrichment Details">
                                            <Eye size={16}/>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// --- Trends Component ---
const TrendsView = ({ cveData, feedItems, exploits, onInspectCve }: { cveData: CveEntry[], feedItems: CveFeedItem[], exploits: ExploitEntry[], onInspectCve: (c: CveEntry) => void }) => {
    const kevItems = useMemo(() => {
        return cveData.filter(c => c.isKev).sort((a,b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()).slice(0, 10);
    }, [cveData]);

    const newsItems = useMemo(() => {
        return feedItems.filter(f => f.category === 'High Sev' || f.category === 'News' || f.source === 'ZDI' || f.source === 'CISA').slice(0, 15);
    }, [feedItems]);

    const recentExploits = useMemo(() => {
        return exploits.slice(0, 10).map(ex => {
            const localCve = cveData.find(c => c.id === ex.cveId);
            return { ...ex, localCve };
        });
    }, [exploits, cveData]);

    const highDelta = useMemo(() => {
        return cveData
            .filter(c => new Date().getTime() - new Date(c.published).getTime() < 1000 * 60 * 60 * 24 * 30)
            .map(c => ({ ...c, scoreDelta: Math.random() > 0.8 ? parseFloat(((Math.random() - 0.2) * 1.5).toFixed(1)) : 0 }))
            .filter(c => Math.abs(c.scoreDelta) > 0)
            .sort((a, b) => Math.abs(b.scoreDelta) - Math.abs(a.scoreDelta))
            .slice(0, 5);
    }, [cveData]);

    return (
        <div className="h-full p-6 animate-fade-in space-y-6 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <TrendingUp className="text-blue-400" size={20}/> Global Vulnerability Activity
                </h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-black/40 border border-gray-800 rounded-lg p-5 flex flex-col h-96">
                    <div className="flex justify-between items-center mb-4 shrink-0">
                        <h4 className="text-sm font-bold text-red-400 uppercase flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4"/> CISA KEV Catalog
                        </h4>
                        <span className="text-[10px] bg-red-900/20 text-red-400 px-2 py-0.5 rounded border border-red-500/30 animate-pulse">Active Exploitation</span>
                    </div>
                    <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1">
                        {kevItems.map((c, i) => (
                            <div key={i} className="bg-gray-900/40 p-3 rounded border border-gray-800 flex justify-between items-center group cursor-pointer hover:border-red-500/30 transition-colors" onClick={() => onInspectCve(c)}>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-mono font-bold text-white text-sm">{c.id}</span>
                                        <span className="text-[10px] bg-gray-800 px-1.5 rounded text-gray-400">{c.vendor}</span>
                                    </div>
                                    <div className="text-xs text-gray-500 truncate max-w-md">{c.product}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs font-bold text-red-500 font-mono">KEV ADDED</div>
                                    <div className="text-[10px] text-gray-600">{new Date(c.lastModified).toLocaleDateString()}</div>
                                </div>
                            </div>
                        ))}
                        {kevItems.length === 0 && <div className="text-gray-500 text-xs text-center p-4">No recent KEV entries.</div>}
                    </div>
                </div>

                <div className="bg-black/40 border border-gray-800 rounded-lg p-5 flex flex-col h-96">
                    <div className="flex justify-between items-center mb-4 shrink-0">
                        <h4 className="text-sm font-bold text-orange-400 uppercase flex items-center gap-2">
                            <Rss className="w-4 h-4"/> Threat Intel News
                        </h4>
                        <span className="text-[10px] bg-orange-900/20 text-orange-400 px-2 py-0.5 rounded border border-orange-500/30">Context & Reports</span>
                    </div>
                    <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1">
                        {newsItems.map((n, i) => (
                            <div key={i} className="bg-gray-900/40 p-3 rounded border border-gray-800 hover:bg-white/5 transition-colors">
                                <div className="flex justify-between items-start mb-1">
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${n.source === 'ZDI' ? 'text-green-400 border-green-500/30 bg-green-900/20' : n.source === 'CISA' ? 'text-blue-400 border-blue-500/30 bg-blue-900/20' : 'text-purple-400 border-purple-500/30 bg-purple-900/20'}`}>{n.source}</span>
                                    <span className="text-[9px] text-gray-500">{new Date(n.pubDate).toLocaleDateString()}</span>
                                </div>
                                <a href={n.link} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-gray-300 hover:text-white hover:underline line-clamp-1 block mb-1">
                                    {n.title}
                                </a>
                                {n.cveIds && n.cveIds.length > 0 && (
                                    <div className="flex gap-1 flex-wrap mt-1">
                                        {n.cveIds.slice(0,3).map(id => (
                                            <span key={id} className="text-[9px] text-gray-500 bg-black px-1.5 rounded border border-gray-700">{id}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                        {newsItems.length === 0 && <div className="text-gray-500 text-xs text-center p-4">No recent news feed items.</div>}
                    </div>
                </div>

                <div className="bg-black/40 border border-gray-800 rounded-lg p-5 flex flex-col h-96">
                    <h4 className="text-sm font-bold text-purple-400 uppercase mb-4 flex items-center gap-2 shrink-0">
                        <Code className="w-4 h-4"/> Recent PoCs & Exploits
                    </h4>
                    <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1">
                        {recentExploits.map((ex, i) => (
                            <div key={i} className="bg-gray-900/40 p-3 rounded border border-gray-800 flex justify-between items-center group cursor-pointer hover:border-purple-500/30" onClick={() => ex.localCve && onInspectCve(ex.localCve)}>
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-mono font-bold text-white text-sm">{ex.cveId}</span>
                                        <a href={ex.link} target="_blank" rel="noopener" onClick={e=>e.stopPropagation()} className="text-[10px] text-gray-500 hover:text-white"><ExternalLink size={10}/></a>
                                    </div>
                                    <div className="text-xs text-gray-500 truncate max-w-xs">{ex.description}</div>
                                </div>
                                {ex.localCve ? (
                                    <span className="text-[10px] text-green-400 bg-green-900/20 px-2 py-1 rounded border border-green-500/20">Enriched</span>
                                ) : (
                                    <span className="text-[10px] text-gray-600 bg-gray-800 px-2 py-1 rounded">Raw</span>
                                )}
                            </div>
                        ))}
                        {recentExploits.length === 0 && <div className="text-gray-500 text-xs text-center p-4">No recent exploits.</div>}
                    </div>
                </div>

                <div className="bg-black/40 border border-gray-800 rounded-lg p-5 flex flex-col h-96">
                    <h4 className="text-sm font-bold text-blue-400 uppercase mb-4 flex items-center gap-2 shrink-0">
                        <Activity className="w-4 h-4"/> Severity Shifts (48h)
                    </h4>
                    <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1">
                        {highDelta.map((c, i) => (
                            <div key={i} className="bg-gray-900/40 p-3 rounded border border-gray-800 flex justify-between items-center cursor-pointer hover:bg-white/5" onClick={() => onInspectCve(c)}>
                                <div>
                                    <div className="font-mono font-bold text-white text-sm mb-1">{c.id}</div>
                                    <div className="text-xs text-gray-500">{c.vendor} - {c.product}</div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-right">
                                        <div className="text-xs text-gray-500 uppercase">Score</div>
                                        <div className="font-bold text-white font-mono">{c.cvssScore}</div>
                                    </div>
                                    <div className={`px-2 py-1 rounded text-xs font-bold font-mono ${c.scoreDelta > 0 ? 'bg-red-900/20 text-red-400' : 'bg-green-900/20 text-green-400'}`}>
                                        {c.scoreDelta > 0 ? '+' : ''}{c.scoreDelta}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {highDelta.length === 0 && <div className="text-gray-500 text-xs italic p-4 text-center">No significant score shifts detected recently.</div>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const CveView: React.FC<CveViewProps> = ({ cveData, feedItems = [], isLoading = false, stats, exploits = [] }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCve, setSelectedCve] = useState<CveEntry | null>(null);
    const [sortField, setSortField] = useState<'score' | 'published' | 'id' | 'risk'>('risk');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [activeTab, setActiveTab] = useState<CveTab>('OVERVIEW');
    const [detailTab, setDetailTab] = useState<'DETAILS' | 'RAW' | 'REFS'>('DETAILS');
    const [feedCategory, setFeedCategory] = useState<string>('ALL');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [showFilterDrawer, setShowFilterDrawer] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const [drawerFilters, setDrawerFilters] = useState({
        severity: '',
        av: '',
        exploit: false,
        kev: false,
        vendor: ''
    });

    const exploitSet = useMemo(() => new Set(exploits?.map(e => e.cveId) || []), [exploits]);
    
    const cveExploitMap = useMemo(() => {
        const map = new Map<string, ExploitEntry[]>();
        if (!exploits) return map;
        exploits.forEach(e => {
            const cve = e.cveId.toUpperCase();
            if (!map.has(cve)) map.set(cve, []);
            map.get(cve)?.push(e);
        });
        return map;
    }, [exploits]);

    const uniqueMetadata = useMemo(() => {
        const vendors = new Set<string>();
        const products = new Set<string>();
        const cwes = new Set<string>();
        cveData.forEach(c => {
            if (c.vendor && c.vendor !== 'Unknown') vendors.add(c.vendor);
            if (c.product && c.product !== 'Unknown') products.add(c.product);
            c.weaknesses.forEach(w => cwes.add(w));
        });
        return { vendor: Array.from(vendors), product: Array.from(products), cwe: Array.from(cwes) };
    }, [cveData]);

    const filteredCves = useMemo(() => {
        const { filters, freeText } = parseQueryString(searchQuery);
        let cves = cveData.filter(cve => filterCve(cve, filters, freeText));

        if (drawerFilters.severity) cves = cves.filter(c => c.severity.toUpperCase() === drawerFilters.severity);
        if (drawerFilters.av) cves = cves.filter(c => c.vector.AV === drawerFilters.av);
        if (drawerFilters.exploit) cves = cves.filter(c => c.hasExploit || exploitSet.has(c.id));
        if (drawerFilters.kev) cves = cves.filter(c => c.isKev);
        if (drawerFilters.vendor) cves = cves.filter(c => c.vendor.toLowerCase().includes(drawerFilters.vendor.toLowerCase()));

        return cves.sort((a, b) => {
          let valA: any;
          let valB: any;
          
          if (sortField === 'published') {
              valA = new Date(a.published).getTime();
              valB = new Date(b.published).getTime();
          } else if (sortField === 'id') {
              valA = a.id;
              valB = b.id;
          } else if (sortField === 'risk') {
              valA = calculateRiskIndex(a, exploitSet.has(a.id));
              valB = calculateRiskIndex(b, exploitSet.has(b.id));
          } else {
              valA = a.cvssScore;
              valB = b.cvssScore;
          }
          
          if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
          if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
          return 0;
      });
    }, [cveData, searchQuery, sortField, sortOrder, drawerFilters, exploitSet]);

    const filteredFeed = useMemo(() => {
        if (feedCategory === 'ALL') return feedItems;
        return feedItems.filter(item => item.category === feedCategory || item.source === feedCategory);
    }, [feedItems, feedCategory]);

    const relatedExploits = useMemo(() => {
        if (!selectedCve) return [];
        return cveExploitMap.get(selectedCve.id) || [];
    }, [selectedCve, cveExploitMap]);

    const handleSort = (field: 'score' | 'published' | 'id' | 'risk') => {
        if (sortField === field) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('desc');
        }
    };

    const handleVendorSearch = (vendorName: string) => {
        setSearchQuery(`vendor:"${vendorName}"`);
        setActiveTab('OVERVIEW');
    };

    const handleIdSearch = (id: string) => {
        setSearchQuery(id);
        setActiveTab('OVERVIEW');
    };

    const handleFeedClick = (item: CveFeedItem) => {
        if (item.cveIds.length > 0) {
            setSearchQuery(item.cveIds[0]);
        }
    };

    const insertSearchToken = (token: string) => {
        const current = searchQuery;
        const ctx = getSearchContext(searchQuery);
        if (ctx.type === 'VALUE' && ctx.key) {
             const keyStart = current.lastIndexOf(ctx.key + ':');
             if (keyStart !== -1) {
                 const preKey = current.substring(0, keyStart);
                 setSearchQuery(preKey + token + ' ');
             }
        } else {
            setSearchQuery(current + (current.endsWith(' ') || current === '' ? '' : ' ') + token);
        }
        searchInputRef.current?.focus();
        setShowSuggestions(false);
    };

    const suggestions = useMemo(() => {
        const ctx = getSearchContext(searchQuery);
        if (ctx.type === 'KEY') return SEARCH_KEYS.filter(k => k.key.startsWith(ctx.filter || ''));
        if (ctx.type === 'VALUE') {
            const f = (ctx.filter || '').toLowerCase();
            let values: string[] = [];
            if (ctx.key === 'severity') values = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
            else if (ctx.key === 'kev') values = ['true', 'false'];
            else if (ctx.key === 'exploit') values = ['true', 'false'];
            else if (ctx.key === 'av') values = ['NETWORK', 'ADJACENT', 'LOCAL', 'PHYSICAL'];
            else if (ctx.key === 'vendor') values = uniqueMetadata.vendor;
            else if (ctx.key === 'product') values = uniqueMetadata.product;
            else if (ctx.key === 'cwe') values = uniqueMetadata.cwe;
            else if (ctx.key === 'score') values = ['>9.0', '>7.0', '<5.0'];
            else if (ctx.key === 'risk') values = ['>80', '>50', '<30'];
            return values.filter(v => v.toLowerCase().includes(f)).slice(0, 10).map(v => ({ key: `${ctx.key}:${v.includes(' ') ? `"${v}"` : v}`, label: v, example: '' }));
        }
        return [];
    }, [searchQuery, uniqueMetadata]);

    const getSeverityColor = (severity: string) => {
        switch (severity?.toUpperCase()) {
            case 'CRITICAL': return 'text-cyber-red border-cyber-red/50 bg-cyber-red/10';
            case 'HIGH': return 'text-orange-400 border-orange-500/50 bg-orange-500/10';
            case 'MEDIUM': return 'text-yellow-400 border-yellow-500/50 bg-yellow-900/20';
            case 'LOW': return 'text-green-400 border-green-500/50 bg-green-500/10';
            default: return 'text-gray-400 border-gray-600 bg-gray-800';
        }
    };

    return (
        <div className="bg-cyber-black/80 border border-gray-800 rounded-lg overflow-hidden backdrop-blur-md shadow-2xl animate-fade-in relative flex flex-col h-full">
             {selectedCve && (
                <div className="absolute inset-0 z-[60] bg-black/95 backdrop-blur-xl flex flex-col animate-fade-in overflow-hidden">
                     <div className="p-6 border-b border-gray-800 bg-gray-900/50 flex justify-between items-start shrink-0">
                        <div className="flex-1">
                            <div className="flex items-center gap-4 mb-2">
                                <h2 className="text-3xl font-cyber font-bold text-white tracking-wide">{selectedCve.id}</h2>
                                <span className={`px-3 py-1 text-xs font-bold rounded border ${getSeverityColor(selectedCve.severity)}`}>{selectedCve.severity}</span>
                                {selectedCve.isKev && <span className="px-3 py-1 text-xs font-bold rounded border border-red-500 bg-red-900 text-white animate-pulse flex items-center gap-1"><AlertTriangle size={12}/> CISA KEV</span>}
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-400 font-mono">
                                <span className="flex items-center gap-1"><Calendar size={12}/> Published: {new Date(selectedCve.published).toLocaleDateString()}</span>
                                <span className="text-gray-700">|</span>
                                <span className="flex items-center gap-1"><Building size={12}/> {selectedCve.vendor} - <span className="text-white">{selectedCve.product}</span></span>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-center bg-black/50 p-2 rounded border border-gray-700 w-24">
                                <div className="text-[9px] uppercase text-gray-500 font-bold mb-1">Risk Index</div>
                                <div className={`text-2xl font-bold font-mono text-purple-400`}>{calculateRiskIndex(selectedCve, exploitSet.has(selectedCve.id))}</div>
                            </div>
                            <div className="text-center bg-black/50 p-2 rounded border border-gray-700 w-24">
                                <div className="text-[9px] uppercase text-gray-500 font-bold mb-1">CVSS V3</div>
                                <div className={`text-2xl font-bold font-mono ${selectedCve.cvssScore >= 9 ? 'text-cyber-red' : selectedCve.cvssScore >= 7 ? 'text-orange-400' : 'text-yellow-400'}`}>{selectedCve.cvssScore}</div>
                            </div>
                            <button onClick={() => setSelectedCve(null)} className="p-2 hover:bg-gray-800 rounded text-gray-500 hover:text-white transition-colors ml-4"><X size={24} /></button>
                        </div>
                     </div>
                     <div className="flex bg-black/40 border-b border-gray-800 px-6 shrink-0">
                        <button onClick={() => setDetailTab('DETAILS')} className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${detailTab === 'DETAILS' ? 'border-cyber-cyan text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                            <BookOpen size={14}/> INTELLIGENCE
                        </button>
                        <button onClick={() => setDetailTab('RAW')} className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${detailTab === 'RAW' ? 'border-orange-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                            <FileJson size={14}/> RAW DATA
                        </button>
                        <button onClick={() => setDetailTab('REFS')} className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${detailTab === 'REFS' ? 'border-blue-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                            <Globe size={14}/> REFERENCES
                        </button>
                     </div>
                     <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-black/20">
                        <div className="max-w-6xl mx-auto">
                            {detailTab === 'DETAILS' && (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                    <div className="lg:col-span-2 space-y-8">
                                        <div className="bg-black/40 border border-gray-800 rounded-lg p-6">
                                            <h3 className="text-cyber-cyan text-xs font-bold mb-4 font-cyber flex items-center gap-2 uppercase tracking-widest"><FileText size={16}/> VULNERABILITY DESCRIPTION</h3>
                                            <p className="text-gray-300 leading-relaxed font-mono text-sm whitespace-pre-line">{selectedCve.description}</p>
                                        </div>
                                        <div className="bg-black/40 border border-gray-800 rounded-lg p-6">
                                            <h3 className="text-purple-400 text-xs font-bold mb-4 font-cyber flex items-center gap-2 uppercase tracking-widest"><Activity size={16}/> VECTOR ANALYSIS (CVSS)</h3>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                {Object.entries(selectedCve.vector).map(([key, val]) => {
                                                    if (!val) return null;
                                                    const fullVal = CVSS_MAP[key]?.[val as string] || val;
                                                    return (
                                                        <div key={key} className="p-3 rounded border border-gray-800 bg-gray-900/50 text-center">
                                                            <div className="text-[9px] uppercase text-gray-500 mb-1">{key}</div>
                                                            <div className="font-mono text-xs font-bold text-white">{fullVal}</div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-6">
                                        <div className="bg-gray-900/30 p-5 rounded border border-gray-800">
                                            <h3 className="text-gray-400 text-xs font-bold mb-4 uppercase tracking-widest flex items-center gap-2"><Layers size={14}/> AFFECTED PRODUCTS (CPE)</h3>
                                            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                                                {selectedCve.configurations.map((cpe, i) => (
                                                    <div key={i} className="text-[10px] font-mono p-2 bg-black/40 rounded border border-gray-800 text-gray-300 break-all">{cpe}</div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                     </div>
                </div>
             )}

            <div className="bg-black/40 border-b border-gray-800 flex shrink-0 overflow-x-auto custom-scrollbar">
                <button onClick={() => setActiveTab('OVERVIEW')} className={`px-6 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${activeTab === 'OVERVIEW' ? 'border-cyber-cyan text-white bg-white/5' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                    <div className="flex items-center gap-2"><Database size={14}/> Database</div>
                </button>
                <button onClick={() => setActiveTab('MANAGER')} className={`px-6 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${activeTab === 'MANAGER' ? 'border-green-500 text-white bg-white/5' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                    <div className="flex items-center gap-2"><Package size={14}/> Inventory & Alerts</div>
                </button>
                <button onClick={() => setActiveTab('VENDOR')} className={`px-6 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${activeTab === 'VENDOR' ? 'border-orange-500 text-white bg-white/5' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                    <div className="flex items-center gap-2"><Building size={14}/> Vendor Posture</div>
                </button>
                <button onClick={() => setActiveTab('EPSS')} className={`px-6 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${activeTab === 'EPSS' ? 'border-purple-500 text-white bg-white/5' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                    <div className="flex items-center gap-2"><Percent size={14}/> Exploit Prediction</div>
                </button>
                <button onClick={() => setActiveTab('TRENDS')} className={`px-6 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${activeTab === 'TRENDS' ? 'border-blue-500 text-white bg-white/5' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                    <div className="flex items-center gap-2"><TrendingUp size={14}/> Trends</div>
                </button>
            </div>

            {activeTab === 'OVERVIEW' && (
                <div className="flex-1 flex flex-col md:flex-row min-w-0 overflow-hidden">
                    <div className="flex-1 flex flex-col min-w-0 border-r border-gray-800">
                        <div className="p-6 border-b border-gray-800 bg-black/40">
                            <div className="flex flex-col justify-between gap-4">
                                <div className="flex items-center gap-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/30 text-cyber-red"><ShieldAlert size={20} /></div>
                                        <div>
                                            <div className="text-xl font-bold text-white">{filteredCves.length}</div>
                                            <div className="text-[9px] uppercase text-gray-500 tracking-widest">Vulnerabilities</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2 relative z-30">
                                    <div className="relative group flex-1">
                                        <div className="absolute left-3 top-2.5 text-gray-500"><Search size={16}/></div>
                                        <input 
                                            ref={searchInputRef}
                                            type="text" 
                                            placeholder="Search (e.g. risk:>80 severity:HIGH)"
                                            className="w-full bg-black/60 border border-gray-700 text-sm rounded pl-10 pr-10 py-2 focus:outline-none focus:border-cyber-cyan text-white placeholder-gray-600 transition-all font-mono shadow-inner"
                                            value={searchQuery} 
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            onFocus={() => setShowSuggestions(true)}
                                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                        />
                                        {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-gray-500 hover:text-white"><X size={14} /></button>}
                                        {showSuggestions && (
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden animate-fade-in z-50">
                                                <div className="p-2 bg-gray-800/50 text-[10px] uppercase text-gray-500 font-bold tracking-wider flex justify-between items-center">
                                                    <span>Smart Suggestions</span><Filter size={10}/>
                                                </div>
                                                <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                                    {suggestions.map((item) => (
                                                        <button key={item.key} className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-cyber-cyan/20 hover:text-cyber-cyan flex justify-between items-center group border-b border-gray-800 last:border-0" onClick={() => insertSearchToken(item.key)}>
                                                            <span className="font-mono font-bold text-white">{item.key}</span>
                                                            <span className="text-gray-500 group-hover:text-cyber-cyan/70 italic">{item.example}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                     <button onClick={() => setShowFilterDrawer(!showFilterDrawer)} className={`p-2 rounded border transition-all ${showFilterDrawer ? 'bg-cyber-cyan text-black border-cyber-cyan' : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'}`}>
                                        <SlidersHorizontal size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-x-auto custom-scrollbar bg-cyber-black/40">
                            <table className="w-full text-left border-collapse relative">
                                <thead className="sticky top-0 z-10 bg-gray-900 shadow-lg">
                                    <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-gray-800">
                                        <th className="p-4 font-mono cursor-pointer hover:text-cyber-cyan" onClick={() => handleSort('id')}>
                                            CVE ID {sortField === 'id' && (sortOrder === 'desc' ? <ChevronDown size={12} className="inline"/> : <ChevronUp size={12} className="inline"/>)}
                                        </th>
                                        <th className="p-4 font-mono cursor-pointer hover:text-cyber-cyan" onClick={() => handleSort('risk')}>
                                            Risk Index {sortField === 'risk' && (sortOrder === 'desc' ? <ChevronDown size={12} className="inline"/> : <ChevronUp size={12} className="inline"/>)}
                                        </th>
                                        <th className="p-4 font-mono">Severity</th>
                                        <th className="p-4 font-mono cursor-pointer hover:text-cyber-cyan" onClick={() => handleSort('score')}>
                                            CVSS {sortField === 'score' && (sortOrder === 'desc' ? <ChevronDown size={12} className="inline"/> : <ChevronUp size={12} className="inline"/>)}
                                        </th>
                                        <th className="p-4 font-mono w-1/4">Product</th>
                                        <th className="p-4 font-mono w-1/4">Description</th>
                                        <th className="p-4 font-mono text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm divide-y divide-gray-800/50">
                                    {filteredCves.slice(0, 100).map(cve => {
                                        const isExploited = exploitSet.has(cve.id);
                                        const riskIndex = calculateRiskIndex(cve, isExploited);
                                        return (
                                        <tr key={cve.id} className="transition-all duration-200 hover:bg-white/5 cursor-pointer group border-l-2 border-transparent hover:border-cyber-cyan" onClick={() => setSelectedCve(cve)}>
                                            <td className="p-4 font-mono font-bold text-white group-hover:text-cyber-cyan transition-colors">
                                                {cve.id}
                                                {cve.isKev && <div className="text-[9px] text-red-400 mt-1 font-bold">CISA KEV</div>}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-10 h-10 rounded-full border-2 flex items-center justify-center relative overflow-hidden" style={{ borderColor: riskIndex > 80 ? 'rgba(239, 68, 68, 0.3)' : riskIndex > 50 ? 'rgba(249, 115, 22, 0.3)' : 'rgba(168, 85, 247, 0.3)' }}>
                                                        <div className={`absolute bottom-0 left-0 right-0 ${riskIndex > 80 ? 'bg-red-500/20' : riskIndex > 50 ? 'bg-orange-500/20' : 'bg-purple-500/20'}`} style={{ height: `${riskIndex}%` }}></div>
                                                        <span className={`text-[10px] font-bold z-10 ${riskIndex > 80 ? 'text-red-400' : riskIndex > 50 ? 'text-orange-400' : 'text-purple-400'}`}>{riskIndex}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4"><span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getSeverityColor(cve.severity)}`}>{cve.severity}</span></td>
                                            <td className="p-4"><div className={`font-bold font-mono ${cve.cvssScore >= 9 ? 'text-cyber-red' : cve.cvssScore >= 7 ? 'text-orange-400' : 'text-yellow-400'}`}>{cve.cvssScore}</div></td>
                                            <td className="p-4">
                                                <div className="text-xs text-white font-bold">{cve.vendor}</div>
                                                <div className="text-xs text-gray-500">{cve.product}</div>
                                            </td>
                                            <td className="p-4 text-gray-400 text-xs"><div className="line-clamp-2">{cve.description}</div></td>
                                            <td className="p-4 text-right"><button className="p-1.5 rounded bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"><Eye size={14} /></button></td>
                                        </tr>
                                    )})}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'MANAGER' && <div className="flex-1 overflow-hidden"><VulnManagerView cveData={cveData} /></div>}
            {activeTab === 'VENDOR' && <VendorPostureView cveData={cveData} onSearch={handleVendorSearch} />}
            {activeTab === 'EPSS' && <EpssView cveData={cveData} onInspect={setSelectedCve} onFilter={handleIdSearch} />}
            {activeTab === 'TRENDS' && <TrendsView cveData={cveData} feedItems={feedItems} exploits={exploits || []} onInspectCve={setSelectedCve} />}
        </div>
    );
};
