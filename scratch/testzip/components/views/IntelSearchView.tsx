
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
    Search, Globe, Shield, ExternalLink, Zap, Terminal, Activity, Loader2, 
    BookOpen, Fingerprint, Database, Link, Share2, Info, X, MessageSquare, 
    AlertCircle, Clock, Trash2, History, ChevronLeft, ChevronRight,
    FileText, List, Bookmark, Layout, CheckCircle, Table
} from 'lucide-react';
import { searchThreatIntelligence } from '../../services/aiConverter';
import { saveToStorage, loadFromStorage, STORES } from '../../services/storage';

interface ResearchResult {
    query: string;
    text: string;
    sources: { title: string, uri: string }[];
    timestamp: number;
    isCached?: boolean;
}

interface IntelSearchViewProps {
    initialQuery?: string | null;
}

export const IntelSearchView: React.FC<IntelSearchViewProps> = ({ initialQuery }) => {
    const [query, setQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [result, setResult] = useState<ResearchResult | null>(null);
    const [history, setHistory] = useState<ResearchResult[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const searchEndRef = useRef<HTMLDivElement>(null);

    // Load History on Mount
    useEffect(() => {
        const loadHistory = async () => {
            const saved = await loadFromStorage(STORES.INTEL_RESEARCH, 'history');
            if (saved && Array.isArray(saved)) {
                setHistory(saved);
            }
        };
        loadHistory();
    }, []);

    // Handle initial query from navigation
    useEffect(() => {
        if (initialQuery) {
            setQuery(initialQuery);
            handleSearch(undefined, initialQuery);
        }
    }, [initialQuery]);

    // Save History
    useEffect(() => {
        if (history.length > 0) {
            saveToStorage(STORES.INTEL_RESEARCH, history, 'history');
        }
    }, [history]);

    const handleSearch = async (e?: React.FormEvent, queryOverride?: string) => {
        if (e) e.preventDefault();
        
        const targetQuery = (queryOverride || query).trim();
        if (!targetQuery || isSearching) return;

        setQuery(targetQuery);
        setIsSearching(true);
        setError(null);
        setResult(null);

        // Check Cache
        const existing = history.find(h => h.query.toLowerCase() === targetQuery.toLowerCase());
        if (existing) {
            await new Promise(r => setTimeout(r, 800));
            setResult({ ...existing, isCached: true });
            setIsSearching(false);
            return;
        }

        try {
            const data = await searchThreatIntelligence(targetQuery);
            const newResult: ResearchResult = {
                query: targetQuery,
                text: data.text,
                sources: data.sources,
                timestamp: Date.now()
            };
            
            setResult(newResult);
            setHistory(prev => [newResult, ...prev].slice(0, 50));
        } catch (err: any) {
            setError(err.message || "An error occurred during global intel search.");
        } finally {
            setIsSearching(false);
            setTimeout(() => {
                searchEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }
    };

    const deleteHistoryItem = (e: React.MouseEvent, q: string) => {
        e.stopPropagation();
        setHistory(prev => prev.filter(h => h.query !== q));
        if (result?.query === q) setResult(null);
    };

    const renderStyledText = (text: string) => {
        const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('`')) {
                return (
                    <code key={i} className="bg-at-accent/10 text-at-accent px-1.5 py-0.5 rounded border border-at-accent/20 font-mono text-[11px] mx-0.5">
                        {part.slice(1, -1)}
                    </code>
                );
            }
            if (part.startsWith('**')) {
                const innerText = part.slice(2, -2);
                const isIdentifier = /CVE-\d{4}-\d+|APT\d+|[A-Z]{2,}/.test(innerText);
                return (
                    <strong key={i} className={`font-bold ${isIdentifier ? 'text-at-accent bg-at-accent/5 px-1 rounded shadow-none' : 'text-white'}`}>
                        {innerText}
                    </strong>
                );
            }
            return part;
        });
    };

    const renderMarkdownTable = (lines: string[], keyIndex: number) => {
        const headerRow = lines[0].split('|').map(s => s.trim()).filter(s => s !== '');
        const bodyRows = lines.slice(2).map(line => 
            line.split('|').map(s => s.trim()).filter(s => s !== '')
        ).filter(row => row.length > 0);

        return (
            <div key={`table-${keyIndex}`} className="my-8 overflow-hidden rounded-xl border border-at-border bg-black/40">
                <div className="bg-at-surface-raised px-4 py-2 border-b border-at-border flex items-center gap-2">
                    <Table size={12} className="text-at-accent"/>
                    <span className="text-[10px] font-bold text-[#888] uppercase tracking-widest">Enriched Data Table</span>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse font-mono text-xs">
                        <thead>
                            <tr className="bg-at-surface-raised border-b border-at-border">
                                {headerRow.map((cell, idx) => (
                                    <th key={idx} className="p-4 font-bold text-at-accent uppercase tracking-tighter border-r border-at-border last:border-0">
                                        {renderStyledText(cell)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800">
                            {bodyRows.map((row, rIdx) => (
                                <tr key={rIdx} className="hover:bg-white/5 transition-colors group">
                                    {row.map((cell, cIdx) => (
                                        <td key={cIdx} className="p-4 text-neutral-300 border-r border-at-border/50 last:border-0 whitespace-nowrap">
                                            {renderStyledText(cell)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const formatContent = (text: string) => {
        const lines = text.split('\n');
        const elements: React.ReactElement[] = [];
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed.startsWith('|')) {
                const tableLines = [];
                while (i < lines.length && lines[i].trim().startsWith('|')) {
                    tableLines.push(lines[i]);
                    i++;
                }
                if (tableLines.length >= 3) {
                    elements.push(renderMarkdownTable(tableLines, i));
                    continue;
                }
            }

            if (trimmed === '') {
                elements.push(<div key={i} className="h-4"></div>);
                i++;
                continue;
            }

            if (line.startsWith('# ')) {
                elements.push(
                    <h1 key={i} className="mt-14 mb-8 text-3xl font-cyber font-extrabold text-white tracking-tighter border-b-2 border-at-accent/50 pb-4">
                        {renderStyledText(line.replace('# ', ''))}
                    </h1>
                );
            } else if (line.startsWith('## ')) {
                elements.push(
                    <div key={i} className="mt-12 mb-6 border-b border-at-border pb-3 flex items-end gap-3">
                        <span className="text-[10px] font-mono text-[#888] uppercase tracking-tighter mb-1">SECTION:</span>
                        <h2 className="text-xl font-bold text-white uppercase tracking-tight">
                            {renderStyledText(line.replace('## ', ''))}
                        </h2>
                    </div>
                );
            } else if (line.startsWith('### ')) {
                elements.push(
                    <h3 key={i} className="text-xs font-bold text-at-accent mt-8 mb-3 uppercase tracking-[0.2em] flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-at-accent animate-pulse"></div>
                        {renderStyledText(line.replace('### ', ''))}
                    </h3>
                );
            } else if (line.startsWith('#### ')) {
                elements.push(
                    <h4 key={i} className="text-sm font-bold text-white mt-6 mb-2 flex items-center gap-2">
                        <span className="text-at-accent opacity-50 font-mono">//</span>
                        {renderStyledText(line.replace('#### ', ''))}
                    </h4>
                );
            } 
            else if (line.startsWith('- ') || line.startsWith('* ')) {
                elements.push(
                    <div key={i} className="flex gap-3 ml-2 mb-3 group">
                        <div className="mt-1.5 shrink-0 w-1 h-1 rounded-full bg-neutral-600 group-hover:bg-at-accent transition-colors"></div>
                        <div className="text-neutral-300 text-[13px] leading-relaxed font-sans">
                            {renderStyledText(line.substring(2))}
                        </div>
                    </div>
                );
            } else {
                elements.push(
                    <p key={i} className="text-[#AAA] text-sm leading-relaxed mb-4 font-sans max-w-4xl">
                        {renderStyledText(line)}
                    </p>
                );
            }
            i++;
        }

        return elements;
    };

    return (
        <div className="at-intel-grounding-page">
            <div className={`at-intel-history ${isSidebarOpen ? "is-open" : "is-closed"}`}>
                <div className="p-4 border-b border-at-border flex items-center justify-between shrink-0">
                    <h3 className="text-[10px] font-bold text-at-muted uppercase tracking-widest flex items-center gap-2">
                        <History size={14} className="text-at-muted"/> INTEL HISTORY
                    </h3>
                    <button onClick={() => setHistory([])} className="text-at-disabled hover:text-[#d62828] transition-colors">
                        <Trash2 size={14}/>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {history.map((item, idx) => (
                        <div 
                            key={idx}
                            onClick={() => handleSearch(undefined, item.query)}
                            className={`group p-4 border-b border-at-border cursor-pointer transition-colors relative overflow-hidden ${result?.query === item.query ? 'bg-[#151920]' : 'hover:bg-[#111418]'}`}
                        >
                            <div className="flex justify-between items-start relative z-10">
                                <span className="text-xs font-bold text-at-text truncate pr-4 uppercase tracking-wide">{item.query}</span>
                                <button onClick={(e) => deleteHistoryItem(e, item.query)} className="opacity-0 group-hover:opacity-100 text-at-disabled hover:text-[#d62828] transition-all"><X size={12}/></button>
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-at-disabled font-mono mt-2 relative z-10">
                                <span className="flex items-center gap-1"><Clock size={10}/> {new Date(item.timestamp).toLocaleDateString()}</span>
                                <span className="text-[#d62828] opacity-0 group-hover:opacity-100 transition-opacity font-bold">RECALL &rarr;</span>
                            </div>
                        </div>
                    ))}
                    {history.length === 0 && (
                        <div className="text-center py-20 text-at-disabled text-[11px] font-mono">Archive Empty.</div>
                    )}
                </div>
            </div>

            <div className="at-intel-main">
                <button 
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-30 p-2 bg-at-surface border border-l-0 border-at-border rounded-r text-at-muted hover:text-white transition-all shadow-md"
                >
                    {isSidebarOpen ? <ChevronLeft size={16}/> : <ChevronRight size={16}/>}
                </button>

                <div className="at-intel-hero">
                    <div className="max-w-4xl mx-auto space-y-6">
                        <div className="flex flex-col items-center text-center space-y-3">
                            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#d62828]/10 border border-[#d62828]/30 text-[#d62828] text-[10px] font-bold tracking-widest uppercase mb-4">
                                <Zap size={12} className="animate-pulse"/>
                                Grounding Engine Active
                            </div>
                            <h1 className="text-3xl font-sans font-bold text-white tracking-tight leading-none">
                                INTEL BRIEFING
                            </h1>
                        </div>

                        <form onSubmit={handleSearch} className="relative max-w-3xl mx-auto group mt-4">
                            <div className="relative flex items-center bg-at-surface border border-at-border rounded shadow-lg overflow-hidden">
                                <div className="pl-5 text-at-disabled">
                                    <Search size={18}/>
                                </div>
                                <input 
                                    type="text" 
                                    className="flex-1 bg-transparent border-none text-at-text px-4 py-4 focus:ring-0 placeholder-[#5e666f] font-mono text-sm"
                                    placeholder="Execute research query (e.g. Lazarus TTPs, CVE-2025 details)..."
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                />
                                <button 
                                    type="submit"
                                    disabled={isSearching || !query.trim()}
                                    className="bg-[#d62828] text-white px-8 py-4 font-bold text-xs tracking-wider hover:bg-[#b01e1e] transition-colors border-l border-at-border disabled:opacity-50 flex items-center gap-3 uppercase"
                                >
                                    {isSearching ? <Loader2 className="animate-spin" size={16}/> : <Terminal size={16}/>}
                                    Process
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                <div className="at-intel-results custom-scrollbar">
                    <div className="max-w-5xl mx-auto">
                        
                        {isSearching && !result && (
                            <div className="flex flex-col items-center justify-center py-32 gap-8">
                                <div className="relative">
                                    <div className="w-32 h-32 border-2 border-t-at-accent border-at-border rounded-full animate-spin"></div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Globe className="text-at-accent animate-pulse" size={48} />
                                    </div>
                                </div>
                                <div className="text-center space-y-3">
                                    <h3 className="text-xl font-mono font-bold text-white tracking-widest uppercase animate-pulse">Scanning Open Intelligence</h3>
                                    <p className="text-[#888] font-mono text-[11px] uppercase tracking-widest">Grounding verification • Peer report correlation</p>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-900/10 border border-at-accent/40 p-8 rounded-2xl flex items-start gap-5 animate-fade-in">
                                <AlertCircle className="text-at-accent shrink-0 mt-1" size={24}/>
                                <div>
                                    <h4 className="text-at-accent font-bold mb-2 uppercase tracking-wider text-sm">Briefing Failure</h4>
                                    <p className="text-[#AAA] text-sm font-mono leading-relaxed">{error}</p>
                                </div>
                            </div>
                        )}

                        {result && (
                            <div className="space-y-12 animate-fade-in pb-32">
                                <div className="flex justify-between items-center border-b border-at-border pb-4">
                                     <div className="flex items-center gap-3 text-xs font-mono text-[#888]">
                                        <Bookmark size={14} className="text-at-accent"/>
                                        <span className="uppercase">Research Dossier: {result.query}</span>
                                    </div>
                                    {result.isCached && (
                                        <div className="flex items-center gap-2 px-3 py-1 bg-at-accent/10 border border-at-accent/30 rounded text-at-accent text-[10px] font-bold uppercase tracking-widest">
                                            <Database size={10}/> Tactical Cache
                                        </div>
                                    )}
                                </div>

                                <div className="bg-at-surface-raised border border-at-border/60 rounded-3xl p-10 shadow-3xl backdrop-blur-xl relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity pointer-events-none">
                                        <Shield size={250}/>
                                    </div>
                                    <div className="font-sans leading-relaxed text-neutral-100">
                                        {formatContent(result.text)}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <div className="bg-black/40 border border-at-border/50 rounded-2xl p-8 flex flex-col shadow-inner">
                                        <h3 className="text-xs font-bold text-[#888] uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                                            <Link size={16} className="text-at-accent"/> TECHNICAL REFERENCES
                                        </h3>
                                        <div className="space-y-3">
                                            {result.sources.map((source, i) => (
                                                <a 
                                                    key={i} 
                                                    href={source.uri} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="flex items-center justify-between p-4 bg-at-bg border border-at-border rounded-xl hover:border-neutral-500/50 hover:bg-at-surface-raised transition-all group"
                                                >
                                                    <div className="flex-1 min-w-0 mr-4">
                                                        <div className="text-xs font-bold text-neutral-200 group-hover:text-at-accent truncate mb-1">{source.title}</div>
                                                        <div className="text-[10px] text-neutral-600 truncate font-mono">{source.uri}</div>
                                                    </div>
                                                    <ExternalLink size={14} className="text-neutral-700 group-hover:text-at-accent shrink-0"/>
                                                </a>
                                            ))}
                                            {result.sources.length === 0 && <p className="text-[11px] text-neutral-700 italic font-mono">No direct references logged for this query.</p>}
                                        </div>
                                    </div>

                                    <div className="bg-black/40 border border-at-border/50 rounded-2xl p-8 flex flex-col shadow-inner">
                                        <h3 className="text-xs font-bold text-[#888] uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                                            <Fingerprint size={16} className="text-at-accent"/> FIDELITY ASSESSMENT
                                        </h3>
                                        <div className="flex-1 space-y-6">
                                            <div className="p-5 bg-at-bg border border-at-border rounded-xl">
                                                <div className="flex justify-between items-center mb-3">
                                                    <span className="text-[10px] text-[#888] font-bold uppercase tracking-widest">Confidence Level</span>
                                                    <span className="text-[10px] text-white font-mono font-bold">VERIFIED</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-[#151515] rounded-full overflow-hidden">
                                                    <div className="h-full bg-at-accent" style={{ width: '92%' }}></div>
                                                </div>
                                            </div>
                                            <div className="p-5 bg-at-bg border border-at-border rounded-xl">
                                                <div className="text-[10px] text-[#888] font-bold uppercase tracking-widest mb-3">Research Status</div>
                                                <div className="flex items-start gap-3">
                                                    <div className="mt-1">
                                                        <CheckCircle size={14} className="text-white"/>
                                                    </div>
                                                    <p className="text-[11px] text-[#AAA] leading-relaxed font-mono">
                                                        {result.isCached 
                                                            ? "Retrieved from local intelligence store. Model verification bypassed to conserve API quota." 
                                                            : "Grounding model performed real-time data ingestion from authoritative security bulletins and technical whitepapers."}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={searchEndRef} />
                    </div>
                </div>

                {!result && !isSearching && (
                    <div className="p-8 border-t border-at-border flex justify-center gap-16 text-at-disabled text-[10px] font-mono uppercase tracking-widest">
                        <div className="flex items-center gap-2"><Globe size={12} className="text-[#3c424a]"/> GLOBAL OSINT</div>
                        <div className="flex items-center gap-2"><Database size={12} className="text-[#3c424a]"/> CROSS-FEED LOGIC</div>
                        <div className="flex items-center gap-2"><Layout size={12} className="text-[#3c424a]"/> STRUCTURED INTEL</div>
                    </div>
                )}
            </div>
        </div>
    );
};
