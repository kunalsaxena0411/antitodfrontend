import React, { useMemo } from 'react';
import { Activity, PieChart, ShieldAlert, Server, Zap, Crosshair, Terminal, Radio, AlertTriangle, Globe, Settings, Minus, Plus, Play, Pause, Gauge, Users, Database, Lock, Clock, Bug, BarChart3, Hash, FileWarning, ExternalLink, Newspaper, Flame, Target, Download, Share2, FileText } from 'lucide-react';
import { ClusterGroup, ThreatNewsItem, CveFeedItem, AnalyzedHost, FeodoTrackerEntry, UrlHausEntry, MalwareBazaarEntry, SslBlEntry, Ja3FingerprintEntry, ThreatFoxEntry, CveEntry, ExploitEntry } from '../../types';
import { ActiveFilter, FilterType } from '../../hooks/useAnalysisData';
import { LiveThreatFeed } from '../widgets/LiveThreatFeed';
import { generateCSV, generateSTIX, downloadFile, generateAnalysisPDF } from '../../services/exporter';

interface DashboardViewProps {
    clusters: any;
    results: AnalyzedHost[];
    activeFilter: ActiveFilter | null;
    onFilterClick: (type: FilterType, value: string) => void;
    onClearFilter: () => void;
    onNavigate: (view: string) => void;
    newsItems: ThreatNewsItem[];
    cveFeedItems: CveFeedItem[];
    exploitStats?: { total: number; recent: number; withCveContext: number };
    cveStats?: { total: number; critical: number; high: number; recent: number };
    urlHausItems?: UrlHausEntry[];
    feodoItems?: FeodoTrackerEntry[];
    malwareBazaarItems?: MalwareBazaarEntry[];
    threatFoxItems?: ThreatFoxEntry[];
    sslBlItems?: SslBlEntry[];
    ja3Items?: Ja3FingerprintEntry[];
    cveData?: CveEntry[];
    exploitData?: ExploitEntry[];
    logoUrl?: string;
}

const StatCard = ({ title, value, subtext, icon: Icon, color, onClick }: any) => (
    <div onClick={onClick} className={`bg-black/40 border border-gray-800 p-4 rounded-lg cursor-pointer hover:border-${color}-500/50 transition-all group`}>
        <div className="flex justify-between items-start mb-2">
            <div className={`p-2 rounded bg-${color}-500/10 text-${color}-500`}>
                <Icon size={20} />
            </div>
            {onClick && <Activity size={14} className="text-gray-600 group-hover:text-white"/>}
        </div>
        <div className="text-2xl font-bold text-white font-mono">{value}</div>
        <div className="text-xs text-gray-500 uppercase font-bold mt-1">{title}</div>
        {subtext && <div className="text-[10px] text-gray-600 mt-1">{subtext}</div>}
    </div>
);

const ClusterWidget = ({ title, items, type, onFilterClick }: { title: string, items: ClusterGroup[], type: FilterType, onFilterClick: any }) => (
    <div className="bg-black/40 border border-gray-800 rounded-lg p-4 flex flex-col h-full">
        <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
            <PieChart size={14} /> {title}
        </h3>
        <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar pr-2">
            {items.map((item, i) => (
                <div 
                    key={i} 
                    className="flex justify-between items-center p-2 rounded hover:bg-white/5 cursor-pointer group"
                    onClick={() => onFilterClick(type, item.id)}
                >
                    <div className="flex items-center gap-2 overflow-hidden">
                        <div className="w-1 h-8 bg-gray-700 rounded group-hover:bg-cyber-cyan transition-colors"></div>
                        <span className="text-xs text-gray-300 truncate group-hover:text-white">{item.label}</span>
                    </div>
                    <div className="text-xs font-mono text-gray-500 font-bold bg-black/50 px-2 py-1 rounded border border-gray-800 group-hover:border-gray-600">{item.count}</div>
                </div>
            ))}
            {items.length === 0 && <div className="text-xs text-gray-600 text-center py-4">No data available</div>}
        </div>
    </div>
);

const IocStatWidget = ({ title, items, icon: Icon, color }: { title: string, items: {label: string, count: number}[], icon: any, color: string }) => (
    <div className="bg-black/40 border border-gray-800 rounded-lg p-4 flex flex-col h-full hover:border-gray-700 transition-colors">
        <h3 className={`text-xs font-bold ${color} uppercase mb-3 flex items-center gap-2`}>
            <Icon size={14} /> {title}
        </h3>
        <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar pr-2">
            {items.map((item, i) => (
                <div key={i} className="flex justify-between items-center p-2 rounded hover:bg-white/5 bg-gray-900/20 border border-gray-800/50">
                    <span className="text-xs text-gray-300 truncate w-2/3" title={item.label}>{item.label}</span>
                    <span className="text-xs font-mono text-gray-500 font-bold">{item.count.toLocaleString()}</span>
                </div>
            ))}
            {items.length === 0 && <div className="text-xs text-gray-600 text-center py-4">No data available</div>}
        </div>
    </div>
);

export const DashboardView: React.FC<DashboardViewProps> = ({ 
    clusters, 
    results, 
    activeFilter, 
    onFilterClick, 
    onClearFilter,
    onNavigate,
    newsItems,
    cveFeedItems,
    exploitStats,
    cveStats,
    urlHausItems = [],
    feodoItems = [],
    malwareBazaarItems = [],
    threatFoxItems = [],
    sslBlItems = [],
    ja3Items = [],
    cveData = [],
    exploitData = [],
    logoUrl
}) => {
    const criticalCount = results.filter(r => r.riskLevel === 'CRITICAL').length;
    const highCount = results.filter(r => r.riskLevel === 'HIGH').length;
    const listedCount = results.filter(r => r.rblStatus === 'LISTED').length;

    const totalIocs = urlHausItems.length + feodoItems.length + malwareBazaarItems.length + threatFoxItems.length + sslBlItems.length + ja3Items.length;

    // --- Compute IOC Statistics ---
    const iocStats = useMemo(() => {
        const types: Record<string, number> = { URL: 0, IP: 0, Hash: 0, Certificate: 0 };
        const malware: Record<string, number> = {};
        const asns: Record<string, number> = {};
        const reasons: Record<string, number> = {};

        // URLHaus
        types.URL += urlHausItems.length;
        urlHausItems.forEach(i => {
            if (i.threat) malware[i.threat] = (malware[i.threat] || 0) + 1;
            i.tags?.forEach(t => reasons[t] = (reasons[t] || 0) + 1);
        });

        // Feodo
        types.IP += feodoItems.length;
        feodoItems.forEach(i => {
            if (i.malware) malware[i.malware] = (malware[i.malware] || 0) + 1;
            if (i.as_name) asns[`AS${i.as_number} ${i.as_name}`] = (asns[`AS${i.as_number} ${i.as_name}`] || 0) + 1;
        });

        // ThreatFox
        threatFoxItems.forEach(i => {
            if (i.ioc_type.includes('ip')) types.IP++;
            else if (i.ioc_type.includes('url') || i.ioc_type.includes('domain')) types.URL++;
            else if (i.ioc_type.includes('hash') || i.ioc_type.includes('sha') || i.ioc_type.includes('md5')) types.Hash++;
            else types[i.ioc_type] = (types[i.ioc_type] || 0) + 1;

            if (i.malware_printable) malware[i.malware_printable] = (malware[i.malware_printable] || 0) + 1;
        });

        // MalwareBazaar
        types.Hash += malwareBazaarItems.length;
        malwareBazaarItems.forEach(i => {
            if (i.signature) malware[i.signature] = (malware[i.signature] || 0) + 1;
        });

        // SSL & JA3
        types.Certificate += sslBlItems.length + ja3Items.length;
        sslBlItems.forEach(i => reasons[i.listingreason] = (reasons[i.listingreason] || 0) + 1);
        ja3Items.forEach(i => reasons[i.listingreason] = (reasons[i.listingreason] || 0) + 1);

        // Sorting Helper
        const sortMap = (map: Record<string, number>) => Object.entries(map)
            .map(([label, count]) => ({ label, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        return {
            types: sortMap(types),
            malware: sortMap(malware),
            asns: sortMap(asns),
            reasons: sortMap(reasons)
        };
    }, [urlHausItems, feodoItems, malwareBazaarItems, threatFoxItems, sslBlItems, ja3Items]);

    // --- Compute CVE/Exploit Statistics ---
    const vulnStats = useMemo(() => {
        // Top Vendors
        const vendors: Record<string, number> = {};
        cveData.forEach(c => {
            if (c.vendor && c.vendor !== 'Unknown') vendors[c.vendor] = (vendors[c.vendor] || 0) + 1;
        });
        const topVendors = Object.entries(vendors)
            .map(([label, count]) => ({ label, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8);

        // Recent Exploit Activity (by date)
        const recentExploits = exploitData
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 8)
            .map(e => ({ 
                label: `${e.cveId} - ${e.description.substring(0, 30)}...`, 
                count: 1, // Using count field for consistent rendering, though logically it's a list item
                id: e.id,
                fullDate: e.timestamp
            }));

        return { topVendors, recentExploits };
    }, [cveData, exploitData]);

    // --- Placeholder data for RansomWatch since it's not passed deeply to dashboard yet ---
    const ransomwarePosts: any[] = []; 

    const handleExport = (format: 'CSV' | 'STIX' | 'PDF') => {
        if (format === 'CSV') {
            const csv = generateCSV(results);
            downloadFile(csv, `analysis_report_${Date.now()}.csv`, 'text/csv');
        } else if (format === 'STIX') {
            const stix = generateSTIX(results);
            downloadFile(stix, `analysis_report_${Date.now()}.json`, 'application/json');
        } else if (format === 'PDF') {
             generateAnalysisPDF(results, logoUrl);
        }
    };

    return (
        <div className="h-full p-6 overflow-y-auto custom-scrollbar space-y-6">
            
            {/* Header with Exports */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-800 pb-4">
                <div>
                    <h2 className="text-2xl font-cyber font-bold text-white tracking-wide">OPERATIONS DASHBOARD</h2>
                    <p className="text-xs text-gray-500 font-mono">Live Threat Monitoring & Analysis</p>
                </div>
                <div className="flex gap-2">
                     <button onClick={() => handleExport('PDF')} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-xs font-bold flex items-center gap-2 border border-gray-700 transition-colors">
                        <FileText size={14}/> Export PDF
                    </button>
                     <button onClick={() => handleExport('CSV')} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-xs font-bold flex items-center gap-2 border border-gray-700 transition-colors">
                        <Download size={14}/> Export CSV
                    </button>
                    <button onClick={() => handleExport('STIX')} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-xs font-bold flex items-center gap-2 border border-gray-700 transition-colors">
                        <Share2 size={14}/> Export STIX
                    </button>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                    title="Analyzed Hosts" 
                    value={results.length} 
                    subtext="Total logs processed"
                    icon={Server} 
                    color="blue"
                    onClick={() => onNavigate('analysis')}
                />
                <StatCard 
                    title="Critical Threats" 
                    value={criticalCount} 
                    subtext="Requires immediate attention"
                    icon={ShieldAlert} 
                    color="red" 
                    onClick={() => onFilterClick('risk', 'CRITICAL')}
                />
                <StatCard 
                    title="High Risks" 
                    value={highCount} 
                    subtext="Elevated threat score"
                    icon={AlertTriangle} 
                    color="orange" 
                    onClick={() => onFilterClick('risk', 'HIGH')}
                />
                <StatCard 
                    title="Blacklisted IPs" 
                    value={listedCount} 
                    subtext="Detected on RBLs"
                    icon={Crosshair} 
                    color="purple" 
                    onClick={() => onFilterClick('rbl', 'LISTED')}
                />
            </div>

            {/* Knowledge Base & Feed Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                 <div 
                    onClick={() => onNavigate('exploits')}
                    className="bg-gray-900/30 border border-gray-800 rounded-lg p-4 flex items-center justify-between cursor-pointer hover:bg-gray-900/60 hover:border-red-500/30 transition-all group"
                 >
                     <div>
                         <div className="text-xs text-gray-500 font-bold uppercase group-hover:text-gray-300">Known Exploits</div>
                         <div className="text-2xl font-mono font-bold text-white">{exploitStats?.total || 0}</div>
                         <div className="text-[10px] text-gray-600 font-mono">Recent: <span className="text-orange-400">{exploitStats?.recent || 0}</span></div>
                     </div>
                     <Bug className="text-red-500 opacity-50 group-hover:opacity-100 group-hover:scale-110 transition-all" size={32}/>
                 </div>
                 
                 <div 
                    onClick={() => onNavigate('cve')}
                    className="bg-gray-900/30 border border-gray-800 rounded-lg p-4 flex items-center justify-between cursor-pointer hover:bg-gray-900/60 hover:border-orange-500/30 transition-all group"
                 >
                     <div>
                         <div className="text-xs text-gray-500 font-bold uppercase group-hover:text-gray-300">Vulnerabilities</div>
                         <div className="text-2xl font-mono font-bold text-white">{cveStats?.total || cveFeedItems.length}</div>
                         <div className="text-[10px] text-gray-600 font-mono">
                             Critical: <span className="text-red-400">{cveStats?.critical || 0}</span> | Feed: <span className="text-blue-400">{cveFeedItems.length}</span>
                         </div>
                     </div>
                     <Flame className="text-orange-500 opacity-50 animate-pulse group-hover:opacity-100" size={32}/>
                 </div>
                 
                 <div 
                    onClick={() => onNavigate('news')}
                    className="bg-gray-900/30 border border-gray-800 rounded-lg p-4 flex items-center justify-between cursor-pointer hover:bg-gray-900/60 hover:border-blue-500/30 transition-all group"
                 >
                     <div>
                         <div className="text-xs text-gray-500 font-bold uppercase group-hover:text-gray-300">Intel Articles</div>
                         <div className="text-2xl font-mono font-bold text-white">{newsItems.length}</div>
                         <div className="text-[10px] text-gray-600">Threat News Feed</div>
                     </div>
                     <Globe className="text-blue-500 opacity-50 group-hover:opacity-100 group-hover:scale-110 transition-all" size={32}/>
                 </div>
                 
                 <div 
                    onClick={() => onNavigate('iocs')}
                    className="bg-gray-900/30 border border-gray-800 rounded-lg p-4 flex items-center justify-between cursor-pointer hover:bg-gray-900/60 hover:border-purple-500/30 transition-all group"
                 >
                     <div>
                         <div className="text-xs text-gray-500 font-bold uppercase group-hover:text-gray-300">Active Indicators</div>
                         <div className="text-2xl font-mono font-bold text-white">{totalIocs.toLocaleString()}</div>
                         <div className="text-[10px] text-gray-600">Across 6 Feeds</div>
                     </div>
                     <Database className="text-purple-500 opacity-50 group-hover:opacity-100 group-hover:scale-110 transition-all" size={32}/>
                 </div>
            </div>

            {/* Split View: Analytics Left, Live Feed Right */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Left Column: Analytics & Vulnerabilities (2/3 width) */}
                <div className="xl:col-span-2 space-y-6">
                    {/* Vulnerability Landscape */}
                    {(cveData?.length > 0 || exploitData?.length > 0) && (
                        <div>
                            <h3 className="text-sm font-bold text-white uppercase mb-4 flex items-center gap-2 border-b border-gray-800 pb-2">
                                <Target size={16} className="text-orange-400"/> Vulnerability Landscape
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="h-64 cursor-pointer hover:border-orange-500/50 transition-colors bg-black/40 border border-gray-800 rounded-lg p-4 flex flex-col" onClick={() => onNavigate('cve')}>
                                    <h3 className="text-xs font-bold text-orange-400 uppercase mb-3 flex items-center gap-2">
                                        <Flame size={14} /> Top Vulnerable Vendors
                                    </h3>
                                    <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar">
                                        {vulnStats.topVendors.map((item, i) => (
                                            <div key={i} className="flex justify-between items-center p-2 rounded hover:bg-white/5 bg-gray-900/30 border border-gray-800/50">
                                                <span className="text-xs text-gray-300 truncate font-mono">{item.label}</span>
                                                <span className="text-xs font-mono text-white font-bold">{item.count}</span>
                                            </div>
                                        ))}
                                        {vulnStats.topVendors.length === 0 && <div className="text-xs text-gray-600 text-center py-4">No vendor data available.</div>}
                                    </div>
                                </div>

                                <div className="h-64 cursor-pointer hover:border-red-500/50 transition-colors bg-black/40 border border-gray-800 rounded-lg p-4 flex flex-col" onClick={() => onNavigate('exploits')}>
                                    <h3 className="text-xs font-bold text-red-400 uppercase mb-3 flex items-center gap-2">
                                        <Bug size={14} /> Recent Exploit Activity
                                    </h3>
                                    <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar">
                                        {vulnStats.recentExploits.map((item, i) => (
                                            <div key={i} className="flex justify-between items-center p-2 rounded hover:bg-white/5 bg-gray-900/30 border border-gray-800/50">
                                                <div className="flex flex-col truncate w-3/4">
                                                    <span className="text-xs text-gray-300 truncate" title={item.label}>{item.label}</span>
                                                    <span className="text-[9px] text-gray-500">{new Date(item.fullDate).toLocaleDateString()}</span>
                                                </div>
                                                <ExternalLink size={12} className="text-gray-600"/>
                                            </div>
                                        ))}
                                        {vulnStats.recentExploits.length === 0 && <div className="text-xs text-gray-600 text-center py-4">No recent exploit data.</div>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Main Widgets Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="h-96">
                            <ClusterWidget 
                                title="Top ASNs by Volume" 
                                items={clusters.byAsn} 
                                type="asn" 
                                onFilterClick={onFilterClick} 
                            />
                        </div>
                        <div className="h-96">
                            <ClusterWidget 
                                title="Top Attack Tactics" 
                                items={clusters.byTactic} 
                                type="mitre" 
                                onFilterClick={onFilterClick} 
                            />
                        </div>
                        <div className="h-96">
                            <ClusterWidget 
                                title="Top Origin Countries" 
                                items={clusters.byCountry} 
                                type="country" 
                                onFilterClick={onFilterClick} 
                            />
                        </div>
                    </div>
                </div>

                {/* Right Column: Live Feed (1/3 width) */}
                <div className="xl:col-span-1 h-[700px] xl:h-auto">
                    <LiveThreatFeed 
                        ransomwarePosts={ransomwarePosts}
                        threatFoxItems={threatFoxItems}
                        cveItems={cveFeedItems}
                    />
                </div>
            </div>

            {/* Global IOC Analytics Section */}
            <div>
                <h3 className="text-sm font-bold text-white uppercase mb-4 flex items-center gap-2 border-b border-gray-800 pb-2">
                    <Database size={16} className="text-purple-400"/> Global IOC Analytics
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="h-80">
                        <IocStatWidget 
                            title="Top C2 Malware" 
                            items={iocStats.malware} 
                            icon={Bug} 
                            color="text-red-400"
                        />
                    </div>
                    <div className="h-80">
                        <IocStatWidget 
                            title="Indicator Types" 
                            items={iocStats.types} 
                            icon={Hash} 
                            color="text-blue-400"
                        />
                    </div>
                    <div className="h-80">
                        <IocStatWidget 
                            title="Malicious Infrastructure (ASN)" 
                            items={iocStats.asns} 
                            icon={Server} 
                            color="text-orange-400"
                        />
                    </div>
                    <div className="h-80">
                        <IocStatWidget 
                            title="Top Listing Reasons" 
                            items={iocStats.reasons} 
                            icon={FileWarning} 
                            color="text-yellow-400"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};