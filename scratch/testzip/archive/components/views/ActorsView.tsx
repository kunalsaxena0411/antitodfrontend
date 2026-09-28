
import React, { useState, useMemo, useRef } from 'react';
import { Users, Search, Globe, Filter, X, Target, Bug, BookOpen, ExternalLink, Zap, Shield, Terminal, Activity, Radar, BarChart3, Sparkles, Briefcase, Database, MapPin, RefreshCw, Loader2, CheckCircle } from 'lucide-react';
import { MalpediaActor, UrlHausEntry, FeodoTrackerEntry, MalwareBazaarEntry, ThreatFoxEntry } from '../../types';
import { parseQueryString, filterActor, getSearchContext } from '../../services/search';
import { enrichIP, checkRBL, checkDomainSecurity } from '../../services/dns';

interface ActorsViewProps {
    actors: MalpediaActor[];
    stats: any;
    urlHausItems?: UrlHausEntry[];
    feodoItems?: FeodoTrackerEntry[];
    malwareBazaarItems?: MalwareBazaarEntry[];
    threatFoxItems?: ThreatFoxEntry[];
}

const ACTOR_SEARCH_KEYS = [
    { key: 'name:', label: 'Actor Name', example: 'Lazarus' },
    { key: 'country:', label: 'Origin', example: 'Russia' },
    { key: 'score:', label: 'Threat Score', example: '>80' },
    { key: 'sophistication:', label: 'Sophistication', example: 'High' },
    { key: 'mitre:', label: 'MITRE ID', example: 'T1059' },
    { key: 'malware:', label: 'Malware Family', example: 'Emotet' },
    { key: 'source:', label: 'Data Source', example: 'MITRE' },
];

// --- Heuristic Mappings ---
const TTP_KEYWORDS: Record<string, string> = {
    'phishing': 'T1566',
    'spearphishing': 'T1566.002',
    'powershell': 'T1059.001',
    'command-line': 'T1059.003',
    'cmd.exe': 'T1059.003',
    'scheduled task': 'T1053.005',
    'registry': 'T1112',
    'service': 'T1543.003',
    'wmi': 'T1047',
    'remote desktop': 'T1021.001',
    'rdp': 'T1021.001',
    'smb': 'T1021.002',
    'credential dumping': 'T1003',
    'lsass': 'T1003.001',
    'keylogger': 'T1056.001',
    'screenshot': 'T1113',
    'encrypted channel': 'T1573',
    'tor': 'T1090.003',
    'rootkit': 'T1014',
    'bootkit': 'T1542.003',
    'masquerading': 'T1036',
    'obfuscated': 'T1027',
    'dll injection': 'T1055.001',
    'brute force': 'T1110',
    'exploit': 'T1203',
    'supply chain': 'T1195'
};

const INDUSTRIES = ['Finance', 'Government', 'Healthcare', 'Energy', 'Defense', 'Telecommunications', 'Aerospace', 'Retail', 'Technology', 'Education', 'Critical Infrastructure'];

const getTargetedIndustries = (description: string) => {
    const descLower = description.toLowerCase();
    return INDUSTRIES.filter(ind => descLower.includes(ind.toLowerCase()));
};

const getSuggestedTTPs = (description: string, existingIds: string[] = []) => {
    const descLower = description.toLowerCase();
    const suggestions: {id: string, keyword: string}[] = [];
    const existingSet = new Set(existingIds);

    Object.entries(TTP_KEYWORDS).forEach(([keyword, id]) => {
        if (descLower.includes(keyword) && !existingSet.has(id)) {
            suggestions.push({ id, keyword });
        }
    });
    return suggestions;
};

const getTopTactics = (ttpDetails?: {tactic: string}[]) => {
    if (!ttpDetails) return [];
    const counts: Record<string, number> = {};
    ttpDetails.forEach(t => {
        const tac = t.tactic || 'Uncategorized';
        counts[tac] = (counts[tac] || 0) + 1;
    });
    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
};

// --- Dynamic Sophistication Logic ---
const calculateSophistication = (actor: MalpediaActor) => {
    let score = 0;
    const mitreCount = actor.mitreIds?.length || 0;
    const malwareCount = actor.malwareFamilies?.length || 0;
    
    // 1. MITRE TTPs (Breadth of Capability) - Max 50 points
    score += Math.min(mitreCount * 2.5, 50);
    
    // 2. Malware Families (Tooling Depth) - Max 30 points
    score += Math.min(malwareCount * 5, 30);
    
    // 3. Targeting/Impact (Strategic Intent) - Max 20 points
    score += Math.min(actor.scoreBreakdown.impactScore || 0, 20);

    if (actor.description.length > 800) score += 5;

    return Math.min(Math.round(score), 100);
};

const getSophisticationConfig = (score: number) => {
    if (score >= 80) return { label: 'CRITICAL', color: 'bg-cyber-red shadow-[0_0_10px_#ff2a6d]', text: 'text-cyber-red', bar: 'bg-cyber-red' };
    if (score >= 60) return { label: 'HIGH', color: 'bg-neutral-500 shadow-[0_0_8px_#f97316]', text: 'text-white', bar: 'bg-neutral-500' };
    if (score >= 40) return { label: 'MEDIUM', color: 'bg-neutral-500 shadow-[0_0_6px_#eab308]', text: 'text-white', bar: 'bg-neutral-500' };
    return { label: 'LOW', color: 'bg-neutral-500 shadow-[0_0_5px_#22c55e]', text: 'text-white', bar: 'bg-neutral-500' };
};

interface RelatedIoc {
    value: string;
    type: string;
    source: string;
    firstSeen: string;
    threatName: string;
}

export const ActorsView: React.FC<ActorsViewProps> = ({ actors, stats, urlHausItems = [], feodoItems = [], malwareBazaarItems = [], threatFoxItems = [] }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'score' | 'name'>('score');
    const [sourceFilter, setSourceFilter] = useState<'ALL' | 'MITRE' | 'Malpedia'>('ALL');
    const [selectedActor, setSelectedActor] = useState<MalpediaActor | null>(null);
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'IOA' | 'IOC' | 'INTEL'>('OVERVIEW');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Enrichment State
    const [enrichmentData, setEnrichmentData] = useState<Record<string, any>>({});
    const [isEnriching, setIsEnriching] = useState<Record<string, boolean>>({});

    const filteredActors = useMemo(() => {
        let data = actors;
        if (sourceFilter !== 'ALL') {
            data = data.filter(a => {
                if (sourceFilter === 'MITRE') return a.source === 'MITRE';
                return a.source === 'Malpedia' || !a.source;
            });
        }

        if (searchQuery) {
            const { filters, freeText } = parseQueryString(searchQuery);
            data = data.filter(actor => filterActor(actor, filters, freeText));
        }

        return data.sort((a, b) => {
            if (sortBy === 'score') return b.threatScore - a.threatScore;
            return a.value.localeCompare(b.value);
        });
    }, [actors, searchQuery, sortBy, sourceFilter]);

    // Calculate Related IOCs based on actor malware families
    const relatedIocs = useMemo(() => {
        if (!selectedActor) return [];
        const iocs: RelatedIoc[] = [];
        const families = new Set(((selectedActor.malwareFamilies || []) as string[]).map(f => f.toLowerCase()));
        
        // Add actor name/aliases to search terms
        families.add(selectedActor.value.toLowerCase());
        if (selectedActor.meta?.synonyms) {
            selectedActor.meta.synonyms.forEach(s => families.add(s.toLowerCase()));
        }

        const matchesFamily = (name?: string) => {
            if (!name) return false;
            const n = name.toLowerCase();
            for (const f of families) {
                if (n.includes(f)) return true;
            }
            return false;
        };

        // Correlate Feeds
        urlHausItems.forEach(i => {
            if (matchesFamily(i.threat)) {
                iocs.push({ value: i.url, type: 'URL', source: 'URLHaus', firstSeen: i.dateadded, threatName: i.threat });
            }
        });

        feodoItems.forEach(i => {
            if (matchesFamily(i.malware)) {
                iocs.push({ value: `${i.ip_address}:${i.port}`, type: 'IP:PORT', source: 'Feodo', firstSeen: i.first_seen, threatName: i.malware });
            }
        });

        malwareBazaarItems.forEach(i => {
            if (matchesFamily(i.signature)) {
                iocs.push({ value: i.sha256_hash, type: 'SHA256', source: 'MalwareBazaar', firstSeen: i.first_seen_utc, threatName: i.signature });
            }
        });
        
        threatFoxItems.forEach(i => {
             if (matchesFamily(i.malware_printable)) {
                 iocs.push({ value: i.ioc_value, type: i.ioc_type.toUpperCase(), source: 'ThreatFox', firstSeen: i.first_seen_utc, threatName: i.malware_printable });
             }
        });

        return iocs.sort((a, b) => new Date(b.firstSeen).getTime() - new Date(a.firstSeen).getTime());
    }, [selectedActor, urlHausItems, feodoItems, malwareBazaarItems, threatFoxItems]);

    const insertSearchToken = (token: string) => {
        const current = searchQuery;
        const ctx = getSearchContext(searchQuery);
        let newQuery = '';

        if (ctx.type === 'VALUE' && ctx.key) {
            const keyStart = current.lastIndexOf(ctx.key + ':');
            if (keyStart !== -1) {
                const prefix = current.substring(0, keyStart);
                newQuery = prefix + token + ' ';
            }
        } else {
            newQuery = current + (current.endsWith(' ') || current === '' ? '' : ' ') + token;
        }
        setSearchQuery(newQuery);
        searchInputRef.current?.focus();
        setShowSuggestions(false);
    };

    const suggestions = useMemo(() => {
        const ctx = getSearchContext(searchQuery);
        const list: any[] = [];

        if (ctx.type === 'KEY') {
            ACTOR_SEARCH_KEYS.filter(k => k.key.startsWith(ctx.filter || '')).forEach(k => {
                list.push({ ...k, type: 'FILTER_KEY' });
            });
        }

        if (ctx.type === 'VALUE') {
             const f = ctx.filter || '';
             let values: string[] = [];
             if (ctx.key === 'name') values = Array.from(new Set(actors.map(a => a.value)));
             else if (ctx.key === 'country') values = Array.from(new Set(actors.map(a => a.meta.country).filter((c): c is string => !!c)));
             else if (ctx.key === 'malware') values = Array.from(new Set(actors.flatMap(a => a.malwareFamilies || [] as string[])));
             else if (ctx.key === 'mitre') values = Array.from(new Set(actors.flatMap(a => a.mitreIds || [] as string[])));
             
             values.filter(v => v && v.toLowerCase().includes(f.toLowerCase())).slice(0, 10).forEach(v => {
                 list.push({ key: `${ctx.key}:${v.includes(' ') ? `"${v}"` : v}`, label: v, type: 'FILTER_VALUE' });
             });
        }
        return list;
    }, [searchQuery, actors]);

    const handleEnrichIoc = async (ioc: RelatedIoc) => {
        if (isEnriching[ioc.value] || enrichmentData[ioc.value]) return;
        
        setIsEnriching(prev => ({ ...prev, [ioc.value]: true }));
        
        try {
            let result: any = {};
            
            if (ioc.type === 'IP' || ioc.type === 'IP:PORT') {
                const ip = ioc.value.split(':')[0];
                const [geo, rbl] = await Promise.all([enrichIP(ip), checkRBL(ip)]);
                result = { geo, rbl };
            } else if (ioc.type === 'DOMAIN' || ioc.type === 'URL') {
                let domain = ioc.value;
                try { domain = new URL(ioc.value).hostname; } catch (e) {}
                const [security] = await Promise.all([checkDomainSecurity(domain)]);
                result = { security };
            } else {
                // Hash
                result = { info: "Hash lookup requires VT API (Simulated)" };
            }

            setEnrichmentData(prev => ({ ...prev, [ioc.value]: result }));
        } catch (e) {
            console.error("Enrichment failed", e);
        } finally {
            setIsEnriching(prev => ({ ...prev, [ioc.value]: false }));
        }
    };

    const renderTabContent = () => {
        if (!selectedActor) return null;

        const topTactics = getTopTactics(selectedActor.ttpDetails);
        const sophScore = calculateSophistication(selectedActor);
        const sophConfig = getSophisticationConfig(sophScore);
        const targetedIndustries = getTargetedIndustries(selectedActor.description);
        const suggestedTTPs = getSuggestedTTPs(selectedActor.description, selectedActor.mitreIds);

        switch(activeTab) {
            case 'OVERVIEW':
                return (
                    <div className="space-y-6 animate-fade-in">
                        {/* Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-[#111] p-4 rounded border border-[#222] relative overflow-hidden group hover:border-red-500/30 transition-colors">
                                <div className="absolute right-2 top-2 opacity-10 group-hover:opacity-20 transition-opacity text-red-500"><Bug size={40}/></div>
                                <div className="text-xs text-[#888] font-bold uppercase tracking-wider mb-1">IOC Count</div>
                                <div className="text-3xl font-mono font-bold text-red-400">{selectedActor.malwareFamilies?.length || 0}</div>
                                <div className="text-[10px] text-neutral-600 mt-1">Malware Families & Tools</div>
                            </div>

                            <div className="bg-[#111] p-4 rounded border border-[#222] relative overflow-hidden group hover:border-neutral-500/30 transition-colors">
                                <div className="absolute right-2 top-2 opacity-10 group-hover:opacity-20 transition-opacity text-white"><Radar size={40}/></div>
                                <div className="text-xs text-[#888] font-bold uppercase tracking-wider mb-1">IOA Coverage</div>
                                <div className="text-3xl font-mono font-bold text-white">{selectedActor.mitreIds?.length || 0}</div>
                                <div className="text-[10px] text-neutral-600 mt-1">MITRE ATT&CK Techniques</div>
                            </div>

                            <div className="bg-[#111] p-4 rounded border border-[#222] relative overflow-hidden group hover:border-red-500/30 transition-colors">
                                <div className="absolute right-2 top-2 opacity-10 group-hover:opacity-20 transition-opacity text-red-500"><Activity size={40}/></div>
                                <div className="text-xs text-[#888] font-bold uppercase tracking-wider mb-1">Primary TTP</div>
                                <div className="text-lg font-mono font-bold text-red-500 truncate" title={topTactics[0]?.[0] || 'N/A'}>
                                    {topTactics.length > 0 ? topTactics[0][0] : 'N/A'}
                                </div>
                                <div className="text-[10px] text-neutral-600 mt-1">
                                    {topTactics.length > 0 ? `${topTactics[0][1]} observed techniques` : 'Insufficient Data'}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row gap-6">
                            <div className="flex-1 space-y-4">
                                <div>
                                    <h3 className="text-sm font-bold text-red-500 mb-2 uppercase tracking-widest flex items-center gap-2">
                                        <Activity size={16}/> Executive Summary
                                    </h3>
                                    <p className="text-neutral-300 leading-relaxed font-mono text-sm whitespace-pre-line bg-black/30 p-4 rounded border border-[#222]">
                                        {selectedActor.description || "No detailed description available."}
                                    </p>
                                </div>

                                {/* Targeted Industries */}
                                {targetedIndustries.length > 0 && (
                                    <div>
                                        <h3 className="text-xs font-bold text-[#888] mb-2 uppercase tracking-widest flex items-center gap-2">
                                            <Briefcase size={14}/> Targeted Sectors
                                        </h3>
                                        <div className="flex flex-wrap gap-2">
                                            {targetedIndustries.map(ind => (
                                                <span key={ind} className="px-2 py-1 bg-[#111] text-white border border-neutral-500/30 rounded text-xs font-bold flex items-center gap-1">
                                                    <Target size={10}/> {ind}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* AI Suggestions */}
                                {suggestedTTPs.length > 0 && (
                                    <div className="mt-4 bg-[#111] border border-[#222] rounded p-3">
                                        <h3 className="text-xs font-bold text-white mb-2 uppercase tracking-widest flex items-center gap-2">
                                            <Sparkles size={14} /> AI Suggested Techniques (Inferred)
                                        </h3>
                                        <div className="flex flex-wrap gap-2">
                                            {suggestedTTPs.map(s => (
                                                <div key={s.id} className="px-2 py-1 bg-neutral-900/10 text-white border border-neutral-500/20 rounded text-xs flex items-center gap-2" title={`Inferred from keyword: "${s.keyword}"`}>
                                                    <span className="font-mono font-bold">{s.id}</span>
                                                    <span className="opacity-70 text-[10px] border-l border-neutral-500/30 pl-2">{s.keyword}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            <div className="w-full md:w-72 space-y-4">
                                <div className="bg-[#111] p-4 rounded border border-[#222]">
                                    <h4 className="text-xs font-bold text-[#888] uppercase mb-3 border-b border-[#222] pb-1">Risk Profile</h4>
                                    <div className="space-y-4">
                                        <div>
                                            <div className="flex justify-between text-xs mb-1 text-[#AAA]">
                                                <span>Sophistication Score</span>
                                                <span className={sophConfig.text}>{sophScore}/100</span>
                                            </div>
                                            <div className="w-full bg-[#151515] h-1.5 rounded-full overflow-hidden">
                                                <div className={`h-full transition-all duration-500 ${sophConfig.bar}`} style={{width: `${sophScore}%`}}></div>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-xs mb-1 text-[#AAA]"><span>Activity Volume</span><span className="text-red-400">{selectedActor.scoreBreakdown.activityScore}/30</span></div>
                                            <div className="w-full bg-[#151515] h-1.5 rounded-full overflow-hidden"><div className="bg-[#151515] h-full" style={{width: `${(selectedActor.scoreBreakdown.activityScore/30)*100}%`}}></div></div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-xs mb-1 text-[#AAA]"><span>Impact Severity</span><span className="text-red-400">{selectedActor.scoreBreakdown.impactScore}/30</span></div>
                                            <div className="w-full bg-[#151515] h-1.5 rounded-full overflow-hidden"><div className="bg-red-500 h-full" style={{width: `${(selectedActor.scoreBreakdown.impactScore/30)*100}%`}}></div></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'IOA':
                 const groupedTTPs = new Map<string, typeof selectedActor.ttpDetails>();
                 if (selectedActor.ttpDetails && selectedActor.ttpDetails.length > 0) {
                     selectedActor.ttpDetails.forEach(ttp => {
                         const tactic = ttp.tactic || 'Uncategorized';
                         if (!groupedTTPs.has(tactic)) groupedTTPs.set(tactic, []);
                         groupedTTPs.get(tactic)?.push(ttp);
                     });
                 }

                 return (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex items-center justify-between">
                             <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                                <Radar size={16}/> Kill Chain Analysis (IOA)
                             </h3>
                             <span className="text-xs text-[#888] font-mono bg-[#151515] px-2 py-1 rounded">{selectedActor.mitreIds?.length || 0} Techniques Identified</span>
                        </div>
                        {selectedActor.ttpDetails && selectedActor.ttpDetails.length > 0 ? (
                            <div className="grid grid-cols-1 gap-4">
                                {Array.from(groupedTTPs.entries()).map(([tactic, ttps]) => (
                                    <div key={tactic} className="bg-[#111] border border-[#222] rounded overflow-hidden">
                                        <div className="bg-[#111] px-4 py-2 border-b border-[#222] flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-neutral-500"></div>
                                            <span className="text-xs font-bold text-neutral-300 uppercase">{tactic}</span>
                                        </div>
                                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {ttps?.map(t => (
                                                <div key={t.id} className="flex items-start gap-3 group">
                                                    <span className="text-[10px] font-mono text-white bg-neutral-900/20 px-1.5 py-0.5 rounded border border-neutral-500/30 whitespace-nowrap">{t.id}</span>
                                                    <div>
                                                        <div className="text-xs text-neutral-300 font-bold group-hover:text-white transition-colors">{t.name}</div>
                                                        {t.description && <div className="text-[10px] text-[#888] line-clamp-2 mt-0.5">{t.description}</div>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 border border-dashed border-[#222] rounded bg-black/20">
                                {selectedActor.mitreIds && selectedActor.mitreIds.length > 0 ? (
                                    <div className="space-y-2">
                                        <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
                                            {selectedActor.mitreIds.map(id => (
                                                <span key={id} className="px-2 py-1 bg-[#151515] text-[#888] border border-[#333] rounded text-xs font-mono">{id}</span>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-[#888] text-sm italic">No Indicators of Attack (TTPs) mapped for this actor.</p>
                                )}
                            </div>
                        )}
                    </div>
                 );

            case 'IOC':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div className="bg-[#111] border border-[#222] rounded p-4 h-full">
                                 <h4 className="text-xs font-bold text-[#AAA] uppercase mb-4 border-b border-[#222] pb-2 flex items-center gap-2">
                                     <Terminal size={14}/> Associated Malware Families
                                 </h4>
                                 {selectedActor.malwareFamilies && selectedActor.malwareFamilies.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {selectedActor.malwareFamilies.map(fam => (
                                            <div key={fam} className="px-3 py-2 bg-red-900/10 text-red-300 border border-red-500/30 rounded text-xs font-mono flex items-center gap-2">
                                                <Bug size={12}/> {fam}
                                            </div>
                                        ))}
                                    </div>
                                ) : <p className="text-neutral-600 italic text-xs">No specific malware families attributed.</p>}
                             </div>

                             <div className="bg-[#111] border border-[#222] rounded p-4 h-full">
                                 <h4 className="text-xs font-bold text-[#AAA] uppercase mb-4 border-b border-[#222] pb-2 flex items-center gap-2">
                                     <Zap size={14}/> Tools & Software
                                 </h4>
                                 {selectedActor.ttpDetails?.some(t => t.name.toLowerCase().includes('tool') || t.name.toLowerCase().includes('software')) ? (
                                     <div className="space-y-2">
                                         {selectedActor.ttpDetails.filter(t => t.name.toLowerCase().includes('tool') || t.name.toLowerCase().includes('software')).map(t => (
                                             <div key={t.id} className="text-xs text-neutral-300 flex items-center gap-2">
                                                 <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full"></span> {t.name}
                                             </div>
                                         ))}
                                     </div>
                                 ) : <p className="text-neutral-600 italic text-xs">No specific tooling identified in TTPs.</p>}
                             </div>
                        </div>

                        {/* Live Infrastructure Section */}
                        <div className="bg-[#111] border border-[#222] rounded-lg overflow-hidden">
                            <div className="p-4 border-b border-[#222] flex justify-between items-center bg-black/40">
                                <h4 className="text-xs font-bold text-red-400 uppercase flex items-center gap-2">
                                    <Database size={14}/> Live Infrastructure (Correlated Feeds)
                                </h4>
                                <span className="text-[10px] bg-[#151515] px-2 py-1 rounded text-[#AAA]">{relatedIocs.length} Indicators</span>
                            </div>
                            {relatedIocs.length > 0 ? (
                                <div className="overflow-x-auto max-h-64 custom-scrollbar">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-[#0A0A0A] text-[#888] sticky top-0">
                                            <tr>
                                                <th className="p-3 w-24">Source</th>
                                                <th className="p-3 w-20">Type</th>
                                                <th className="p-3">Value</th>
                                                <th className="p-3 w-32">Family</th>
                                                <th className="p-3 w-24 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-neutral-800">
                                            {relatedIocs.map((ioc, i) => {
                                                const enriched = enrichmentData[ioc.value];
                                                return (
                                                    <tr key={i} className="hover:bg-white/5">
                                                        <td className="p-3 text-[#AAA]">{ioc.source}</td>
                                                        <td className="p-3 font-bold text-[#888]">{ioc.type}</td>
                                                        <td className="p-3 font-mono text-white break-all">
                                                            {ioc.value}
                                                            {enriched && (
                                                                <div className="mt-1 flex gap-2">
                                                                    {enriched.geo && <span className="text-[9px] bg-[#151515] px-1.5 rounded text-[#AAA] flex items-center gap-1"><Globe size={8}/> {enriched.geo.country_code}</span>}
                                                                    {enriched.rbl?.status === 'LISTED' && <span className="text-[9px] bg-red-900/30 text-red-400 px-1.5 rounded border border-red-500/30">BLACKLISTED</span>}
                                                                    {enriched.security?.some((s: any) => s.status === 'BLOCKED') && <span className="text-[9px] bg-red-900/30 text-red-400 px-1.5 rounded border border-red-500/30">MALICIOUS DOMAIN</span>}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="p-3 text-red-400 truncate max-w-[150px]">{ioc.threatName}</td>
                                                        <td className="p-3 text-right">
                                                            <button 
                                                                onClick={() => handleEnrichIoc(ioc)}
                                                                disabled={isEnriching[ioc.value]} 
                                                                className="p-1.5 bg-[#151515] hover:bg-[#1C1C1C] rounded text-[#AAA] hover:text-white transition-colors disabled:opacity-50"
                                                                title="Enrich Indicator"
                                                            >
                                                                {isEnriching[ioc.value] ? <RefreshCw className="animate-spin" size={12}/> : <Zap size={12}/>}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-8 text-center text-[#888] text-xs italic">
                                    No active infrastructure found in loaded feeds for these malware families.
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 'INTEL':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex items-center justify-between">
                             <h3 className="text-sm font-bold text-red-400 uppercase tracking-widest flex items-center gap-2">
                                <BookOpen size={16}/> External Intelligence
                             </h3>
                        </div>
                         <div className="bg-[#111] border border-[#222] rounded p-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                            {selectedActor.meta.refs && selectedActor.meta.refs.length > 0 ? (
                                <ul className="space-y-3">
                                    {selectedActor.meta.refs.map((ref, i) => (
                                        <li key={i} className="flex items-start gap-3 group">
                                            <div className="mt-1 p-1 bg-[#111] rounded text-red-400 group-hover:text-white group-hover:bg-[#151515] transition-colors">
                                                <ExternalLink size={10}/>
                                            </div>
                                            <div>
                                                <a href={ref} target="_blank" rel="noopener noreferrer" className="text-xs text-red-400 hover:text-white break-all font-mono hover:underline">
                                                    {ref}
                                                </a>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : <p className="text-[#888] text-sm italic">No external references available.</p>}
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="bg-cyber-black/80 border border-[#222] rounded-lg overflow-hidden backdrop-blur-md shadow-2xl animate-fade-in relative h-full flex flex-col">
            {selectedActor && (
                <div className="absolute inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col animate-fade-in">
                     {/* Modal Header */}
                    <div className="flex-none p-6 border-b border-[#222] flex items-start justify-between bg-[#111]">
                         <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-lg border ${selectedActor.threatScore >= 80 ? 'bg-red-900/20 border-red-500 text-red-500' : 'bg-[#151515] border-[#333] text-[#AAA]'}`}>
                                <Shield size={32}/>
                            </div>
                            <div>
                                <div className="flex items-center gap-3">
                                    <h2 className="text-3xl font-cyber font-bold text-white tracking-wide">{selectedActor.value}</h2>
                                    {selectedActor.source === 'MITRE' ? (
                                        <span className="px-2 py-0.5 bg-[#111] border border-neutral-500/30 text-white text-[10px] rounded font-mono">MITRE ATT&CK</span>
                                    ) : (
                                        <span className="px-2 py-0.5 bg-neutral-900/50 border border-neutral-500/30 text-white text-[10px] rounded font-mono">MALPEDIA</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-4 mt-1 text-xs font-mono text-[#AAA]">
                                    {(() => {
                                        const score = calculateSophistication(selectedActor);
                                        const config = getSophisticationConfig(score);
                                        return (
                                            <span className={`flex items-center gap-1.5 ${config.text} font-bold border border-[#333] px-2 py-0.5 rounded bg-black/50`}>
                                                <BarChart3 size={12}/>
                                                SOPHISTICATION: {score} ({config.label})
                                            </span>
                                        );
                                    })()}
                                    <span className="text-neutral-600">|</span>
                                    <span className="text-white">ORIGIN: {selectedActor.meta.country || 'UNKNOWN'}</span>
                                </div>
                            </div>
                         </div>
                         <button onClick={() => setSelectedActor(null)} className="text-[#888] hover:text-white transition-colors p-2 hover:bg-[#151515] rounded"><X size={24} /></button>
                    </div>

                    {/* Modal Tabs */}
                    <div className="flex-none px-6 bg-[#111] border-b border-[#222]">
                        <div className="flex gap-6">
                            {[
                                { id: 'OVERVIEW', label: 'Overview', icon: Activity },
                                { id: 'IOA', label: 'Kill Chain (IOA)', icon: Radar },
                                { id: 'IOC', label: 'Indicators (IOC)', icon: Bug },
                                { id: 'INTEL', label: 'Intel Sources', icon: BookOpen },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`py-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${activeTab === tab.id ? 'text-red-500 border-red-500' : 'text-[#888] border-transparent hover:text-white'}`}
                                >
                                    <tab.icon size={16}/> {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Modal Content */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-black/40">
                        <div className="max-w-5xl mx-auto">
                            {renderTabContent()}
                        </div>
                    </div>
                </div>
            )}

            {/* Main View Content (List) */}
            <div className="p-6 border-b border-[#222] flex flex-col md:flex-row justify-between gap-6">
                <div className="flex items-center gap-8">
                   <div className="flex items-center gap-3">
                       <div className="p-3 bg-neutral-500/10 rounded-lg border border-neutral-500/30 text-red-400"><Users size={24} /></div>
                       <div>
                           <div className="text-2xl font-bold text-white">{stats.total}</div>
                           <div className="text-[10px] uppercase text-[#888] tracking-widest">Threat Actors</div>
                       </div>
                   </div>
                   <div className="hidden md:block space-x-4">
                        <span className="text-xs text-cyber-red font-mono border border-red-500/30 bg-red-900/20 px-2 py-1 rounded">HIGH RISK: {stats.highRiskCount}</span>
                        <span className="text-xs text-red-400 font-mono border border-neutral-500/30 bg-[#111] px-2 py-1 rounded">MITRE: {stats.mitreCount}</span>
                   </div>
                </div>
                 <div className="flex gap-3">
                     <div className="flex items-center bg-black/50 border border-[#333] rounded px-2">
                         <Filter size={14} className="text-[#888] mr-2"/>
                         <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as any)} className="bg-transparent text-sm text-neutral-300 focus:outline-none py-2">
                             <option value="ALL">All Sources</option>
                             <option value="MITRE">MITRE ATT&CK</option>
                             <option value="Malpedia">Malpedia</option>
                         </select>
                     </div>
                    <div className="relative group w-48 md:w-64 z-30">
                        <Search className="absolute left-3 top-2.5 text-[#888] w-4 h-4" />
                        <input 
                            ref={searchInputRef}
                            type="text" 
                            placeholder="Search (e.g. country:China)" 
                            className="bg-black/50 border border-[#333] text-sm rounded pl-10 pr-8 py-2 focus:outline-none focus:border-neutral-500 w-full transition-colors" 
                            value={searchQuery} 
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => setShowSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-[#888] hover:text-white">
                                <X size={14} />
                            </button>
                        )}

                        {showSuggestions && suggestions.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-[#0A0A0A] border border-[#333] rounded-lg shadow-2xl overflow-hidden animate-fade-in">
                                <div className="p-2 bg-[#151515]/50 text-[10px] uppercase text-[#888] font-bold tracking-wider">
                                    Search Filters
                                </div>
                                <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                    {suggestions.map((item, i) => (
                                        <button 
                                            key={i} 
                                            className="w-full text-left px-4 py-2 text-xs text-neutral-300 hover:bg-neutral-500/20 hover:text-red-400 flex justify-between items-center group"
                                            onClick={() => insertSearchToken(item.key)}
                                        >
                                            <span className="font-mono font-bold">{item.key}</span>
                                            <span className="text-neutral-600 group-hover:text-[#AAA] italic">ex: {item.example}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div className="p-6 bg-black/20 flex-1 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
                    {filteredActors.map((actor) => {
                        const sophScore = calculateSophistication(actor);
                        const sophConfig = getSophisticationConfig(sophScore);
                        const industries = getTargetedIndustries(actor.description);
                        return (
                            <div key={actor.uuid} className="bg-[#111] border border-[#222] hover:border-neutral-500/50 rounded p-5 transition-all duration-300 hover:bg-[#111] group cursor-pointer flex flex-col relative overflow-hidden" onClick={() => { setSelectedActor(actor); setActiveTab('OVERVIEW'); }}>
                               <div className="flex justify-between items-start mb-2">
                                   <h4 className="text-lg font-bold text-neutral-200 group-hover:text-white transition-colors truncate max-w-[180px]">{actor.value}</h4>
                                   <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#111] border border-[#333]`}>{actor.threatScore}</div>
                               </div>
                               
                               <div className="text-xs text-[#888] mb-3">
                                   <div className="flex items-center gap-2 mb-2">
                                       {actor.meta.country ? (<span className="flex items-center gap-1"><Globe size={10}/> {actor.meta.country}</span>) : <span className="italic">Unknown Origin</span>}
                                   </div>
                                   {/* Industry Badges (Highlight) */}
                                   {industries.length > 0 && (
                                       <div className="flex flex-wrap gap-1 mb-2">
                                           {industries.slice(0, 3).map(ind => (
                                               <span key={ind} className="px-1.5 py-0.5 bg-[#111] text-red-400 border border-neutral-500/20 rounded text-[9px] font-bold">{ind}</span>
                                           ))}
                                           {industries.length > 3 && <span className="text-[9px] text-neutral-600">+{industries.length - 3}</span>}
                                       </div>
                                   )}
                                   {/* Sophistication Bar */}
                                   <div className="w-full">
                                       <div className="flex justify-between text-[9px] uppercase font-bold mb-0.5">
                                           <span className="text-neutral-600">Sophistication</span>
                                           <span className={sophConfig.text}>{sophConfig.label}</span>
                                       </div>
                                       <div className="w-full h-1 bg-[#151515] rounded-full overflow-hidden">
                                           <div className={`h-full ${sophConfig.bar}`} style={{width: `${sophScore}%`}}></div>
                                       </div>
                                   </div>
                               </div>

                               <p className="text-xs text-[#AAA] line-clamp-3 mb-4 flex-1 font-mono leading-relaxed">{actor.description.substring(0, 150)}...</p>
                                <div className="mt-auto pt-3 border-t border-[#222] flex flex-wrap gap-1">
                                    {actor.mitreAttackId && (<span className="text-[9px] px-1.5 py-0.5 bg-[#111] text-white border border-neutral-500/30 rounded">{actor.mitreAttackId}</span>)}
                                    {actor.mitreIds && actor.mitreIds.slice(0, 3).map(m => (<span key={m} className="text-[9px] px-1.5 py-0.5 bg-[#151515] text-[#888] rounded">{m}</span>))}
                                    {actor.mitreIds && actor.mitreIds.length > 3 && <span className="text-[9px] text-neutral-600">+{actor.mitreIds.length - 3}</span>}
                                </div>
                                 <div className={`absolute top-0 right-0 px-2 py-0.5 text-[8px] font-bold uppercase ${actor.source === 'MITRE' ? 'bg-[#0A0A0A] text-white rounded-bl' : 'bg-neutral-900 text-white rounded-bl'}`}>{actor.source || 'MALPEDIA'}</div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
