
import React, { useState, useMemo, useRef } from 'react';
import { Newspaper, Search, Filter, ExternalLink, Clock, X, RefreshCw, ShieldAlert, Radio, AlertTriangle } from 'lucide-react';
import { ThreatNewsItem, CveFeedItem, UrlHausEntry } from '../../types';
import { parseQueryString, filterNews } from '../../services/search';

interface NewsViewProps {
    newsItems: ThreatNewsItem[];
    cveItems: CveFeedItem[];
    lastUpdated: Date | null;
    onRefresh: () => void;
    urlHausItems?: UrlHausEntry[]; 
}

const NEWS_SEARCH_KEYS = [
    { key: 'source:', label: 'Source', example: 'BleepingComputer' },
    { key: 'category:', label: 'Category', example: 'Ransomware' },
    { key: 'title:', label: 'Title Keyword', example: 'Zero-Day' },
];

// Extended list of categories to include CVE types
const BASE_CATEGORIES = ['ALL', 'Ransomware', 'Vulnerability', 'APT', 'Phishing', 'Breach', 'Malware', 'Cybercrime', 'General'];

export const NewsView: React.FC<NewsViewProps> = ({ newsItems, cveItems, lastUpdated, onRefresh, urlHausItems = [] }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('ALL');
    const [selectedSource, setSelectedSource] = useState('ALL');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Unified Feed Item Interface for Display
    const combinedFeed = useMemo(() => {
        const normalizedCves = cveItems.map(c => ({
            title: c.title,
            link: c.link,
            source: c.source,
            published: new Date(c.pubDate).toLocaleDateString(),
            timestamp: new Date(c.pubDate).getTime(),
            description: c.description,
            category: 'Vulnerability', // Map all CVEs to Vulnerability for broad filtering
            subCategory: c.category, // Keep specific (High Sev, Advisory)
            isCve: true,
            cveIds: c.cveIds
        }));

        const normalizedNews = newsItems.map(n => ({
            ...n,
            subCategory: n.category,
            isCve: false,
            cveIds: []
        }));

        // EXPLICIT REMOVAL: URLHaus is not merged here. 
        // Only News and CVEs are returned to reduce noise as per configuration.
        return [...normalizedNews, ...normalizedCves].sort((a, b) => b.timestamp - a.timestamp);
    }, [newsItems, cveItems]);

    // Extract unique sources for filter
    const sources = useMemo(() => {
        const s = new Set(combinedFeed.map(i => i.source));
        return ['ALL', ...Array.from(s).sort()];
    }, [combinedFeed]);

    const filteredNews = useMemo(() => {
        let data = combinedFeed;

        // Filter by Category
        if (selectedCategory !== 'ALL') {
            data = data.filter(item => item.category === selectedCategory || item.subCategory === selectedCategory);
        }

        // Filter by Source
        if (selectedSource !== 'ALL') {
            data = data.filter(item => item.source === selectedSource);
        }

        // Search Query
        if (searchQuery) {
            const { filters, freeText } = parseQueryString(searchQuery);
            // Cast to any to allow duck-typing with filterNews which expects ThreatNewsItem
            data = data.filter(item => filterNews(item as any, filters, freeText));
        }

        return data;
    }, [combinedFeed, searchQuery, selectedCategory, selectedSource]);

    const insertSearchToken = (token: string) => {
        const current = searchQuery;
        setSearchQuery(current + (current.endsWith(' ') || current === '' ? '' : ' ') + token);
        searchInputRef.current?.focus();
        setShowSuggestions(false);
    };

    const getCategoryColor = (cat: string) => {
        switch(cat) {
            case 'Ransomware': return 'text-red-400 border-red-500/30 bg-red-900/20';
            case 'APT': return 'text-white border-neutral-500/30 bg-neutral-900/20 shadow-[0_0_5px_#ec4899]';
            case 'Phishing': return 'text-white border-neutral-500/30 bg-neutral-900/20';
            case 'Vulnerability': return 'text-white border-neutral-500/30 bg-neutral-900/20';
            case 'High Sev': return 'text-white border-neutral-500/30 bg-neutral-900/20';
            case 'Breach': return 'text-red-300 border-red-400/30 bg-red-950/30';
            case 'Malware': return 'text-red-400 border-neutral-500/30 bg-neutral-900/20';
            case 'Cybercrime': return 'text-red-400 border-neutral-500/30 bg-[#111]';
            case 'Advisory': return 'text-red-400 border-neutral-500/30 bg-[#111]';
            default: return 'text-[#AAA] border-neutral-600/30 bg-[#151515]/20';
        }
    };

    const getSourceStyle = (source: string) => {
        if (source === 'CISA') return 'text-red-400 bg-[#111] border-neutral-500/30';
        if (source === 'ZDI') return 'text-white bg-neutral-900/30 border-neutral-500/30';
        if (source === 'CVEFeed') return 'text-white bg-neutral-900/30 border-neutral-500/30';
        return 'text-[#888] bg-[#151515] border-[#333]';
    };

    const isRecent = (timestamp: number) => {
        return Date.now() - timestamp < 24 * 60 * 60 * 1000;
    };

    return (
        <div className="bg-cyber-black/80 border border-[#222] rounded-lg overflow-hidden backdrop-blur-md shadow-2xl animate-fade-in flex flex-col min-h-[600px]">
            {/* Header & Controls */}
            <div className="p-6 border-b border-[#222] bg-black/40">
                <div className="flex flex-col gap-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h2 className="text-2xl font-cyber font-bold text-white flex items-center gap-2">
                                    <Newspaper className="text-white"/> LIVE INTEL FEED
                                </h2>
                                <span className="text-xs font-mono text-[#888] bg-[#0A0A0A] px-2 py-1 rounded border border-[#222]">
                                    {filteredNews.length} Items
                                </span>
                            </div>
                            <div className="flex items-center gap-4 text-[10px] text-[#888] font-mono">
                                <span className="flex items-center gap-1"><Clock size={12}/> Updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Never'}</span>
                                <button onClick={onRefresh} className="flex items-center gap-1 hover:text-white transition-colors"><RefreshCw size={12}/> Refresh Now</button>
                            </div>
                        </div>

                        {/* Search */}
                        <div className="relative group w-full md:w-96 z-30">
                            <Search className="absolute left-3 top-2.5 text-[#888] w-4 h-4" />
                            <input 
                                ref={searchInputRef}
                                type="text" 
                                placeholder="Search (e.g. source:CISA category:Ransomware)" 
                                className="bg-black/50 border border-[#333] text-sm rounded pl-10 pr-8 py-2 focus:outline-none focus:border-neutral-500 w-full transition-colors text-white placeholder-neutral-600 shadow-inner" 
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

                            {showSuggestions && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-[#0A0A0A] border border-[#333] rounded-lg shadow-2xl overflow-hidden animate-fade-in">
                                    <div className="p-2 bg-[#151515]/50 text-[10px] uppercase text-[#888] font-bold tracking-wider">
                                        Search Filters
                                    </div>
                                    <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                        {NEWS_SEARCH_KEYS.map((item) => (
                                            <button 
                                                key={item.key} 
                                                className="w-full text-left px-4 py-2 text-xs text-neutral-300 hover:bg-neutral-500/20 hover:text-white flex justify-between items-center group"
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

                    {/* Filter Bars */}
                    <div className="flex flex-wrap gap-4">
                        {/* Categories */}
                        <div className="flex items-center bg-black/50 border border-[#333] rounded px-2 overflow-x-auto custom-scrollbar max-w-full md:max-w-2xl h-10">
                             <Filter size={14} className="text-[#888] mr-2 flex-shrink-0"/>
                             {BASE_CATEGORIES.map(cat => (
                                 <button 
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`px-3 py-1 text-xs font-bold whitespace-nowrap transition-colors ${selectedCategory === cat ? 'text-white' : 'text-[#888] hover:text-white'}`}
                                 >
                                     {cat}
                                 </button>
                             ))}
                        </div>

                        {/* Sources */}
                        <div className="flex items-center bg-black/50 border border-[#333] rounded px-2 overflow-x-auto custom-scrollbar max-w-full md:max-w-md h-10">
                             <span className="text-[10px] uppercase font-bold text-[#888] mr-2 flex-shrink-0">Source:</span>
                             {sources.map(src => (
                                 <button 
                                    key={src}
                                    onClick={() => setSelectedSource(src)}
                                    className={`px-3 py-1 text-xs font-bold whitespace-nowrap transition-colors ${selectedSource === src ? 'text-red-400' : 'text-[#888] hover:text-white'}`}
                                 >
                                     {src}
                                 </button>
                             ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Feed Grid */}
            <div className="p-6 bg-black/20 flex-1 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredNews.map((item, idx) => (
                        <div key={idx} className={`bg-[#111] border rounded-lg p-4 transition-all duration-300 hover:bg-[#111] group flex flex-col h-full relative ${item.isCve ? 'border-l-4 border-l-orange-500 border-y-gray-800 border-r-gray-800' : 'border-[#222] hover:border-neutral-500/50'}`}>
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex gap-2 flex-wrap">
                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded border whitespace-nowrap ${getCategoryColor(item.subCategory)}`}>
                                        {item.subCategory}
                                    </span>
                                    {item.isCve && <span className="text-[9px] font-bold px-2 py-0.5 rounded border border-neutral-500/50 text-white bg-neutral-900/20 flex items-center gap-1"><ShieldAlert size={10}/> CVE</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                    {isRecent(item.timestamp) && <span className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-pulse shadow-[0_0_5px_#22c55e]"></span>}
                                    <span className="text-[10px] text-[#888] font-mono whitespace-nowrap">{item.date}</span>
                                </div>
                            </div>
                            
                            <h3 className={`text-sm font-bold transition-colors mb-2 line-clamp-2 break-all ${item.isCve ? 'text-neutral-100 group-hover:text-white' : 'text-neutral-200 group-hover:text-white'}`}>
                                {item.title}
                            </h3>
                            
                            <p className="text-xs text-[#AAA] line-clamp-3 mb-4 flex-1 leading-relaxed break-words">
                                {item.description}
                            </p>

                            {item.cveIds && item.cveIds.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-3">
                                    {item.cveIds.slice(0, 3).map(id => (
                                        <span key={id} className="text-[9px] bg-[#151515] text-neutral-300 px-1.5 py-0.5 rounded border border-[#333] flex items-center gap-1">
                                            <Radio size={8}/> {id}
                                        </span>
                                    ))}
                                    {item.cveIds.length > 3 && <span className="text-[9px] text-neutral-600 px-1">+{item.cveIds.length - 3}</span>}
                                </div>
                            )}

                            <div className="mt-auto pt-3 border-t border-[#222] flex justify-between items-center">
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded border truncate max-w-[120px] ${getSourceStyle(item.source)}`}>{item.source}</span>
                                <a 
                                    href={item.link} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className={`text-xs flex items-center gap-1 transition-colors ${item.isCve ? 'text-white hover:text-white' : 'text-white hover:text-white'}`}
                                >
                                    Read {item.isCve ? 'Advisory' : 'Article'} <ExternalLink size={12}/>
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
                {filteredNews.length === 0 && (
                     <div className="flex flex-col items-center justify-center h-64 text-[#888]">
                         <Search size={48} className="opacity-20 mb-4"/>
                         <p>No intel matches your filters.</p>
                     </div>
                )}
            </div>
        </div>
    );
};
