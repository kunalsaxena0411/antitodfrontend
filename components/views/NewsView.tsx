
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
            date: new Date(c.pubDate).toLocaleDateString(),
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
            case 'APT': return 'text-pink-400 border-pink-500/30 bg-pink-900/20 shadow-[0_0_5px_#ec4899]';
            case 'Phishing': return 'text-orange-400 border-orange-500/30 bg-orange-900/20';
            case 'Vulnerability': return 'text-yellow-400 border-yellow-500/30 bg-yellow-900/20';
            case 'High Sev': return 'text-orange-400 border-orange-500/30 bg-orange-900/20';
            case 'Breach': return 'text-red-300 border-red-400/30 bg-red-950/30';
            case 'Malware': return 'text-purple-400 border-purple-500/30 bg-purple-900/20';
            case 'Cybercrime': return 'text-blue-400 border-blue-500/30 bg-blue-900/20';
            case 'Advisory': return 'text-cyan-400 border-cyan-500/30 bg-cyan-900/20';
            default: return 'text-gray-400 border-gray-600/30 bg-gray-800/20';
        }
    };

    const getSourceStyle = (source: string) => {
        if (source === 'CISA') return 'text-blue-400 bg-blue-900/30 border-blue-500/30';
        if (source === 'ZDI') return 'text-green-400 bg-green-900/30 border-green-500/30';
        if (source === 'CVEFeed') return 'text-orange-400 bg-orange-900/30 border-orange-500/30';
        return 'text-gray-500 bg-gray-800 border-gray-700';
    };

    const isRecent = (timestamp: number) => {
        return Date.now() - timestamp < 24 * 60 * 60 * 1000;
    };

    return (
        <div className="bg-cyber-black/80 border border-gray-800 rounded-lg overflow-hidden backdrop-blur-md shadow-2xl animate-fade-in flex flex-col min-h-[600px]">
            {/* Header & Controls */}
            <div className="p-6 border-b border-gray-800 bg-black/40">
                <div className="flex flex-col gap-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h2 className="text-2xl font-cyber font-bold text-white flex items-center gap-2">
                                    <Newspaper className="text-green-400"/> LIVE INTEL FEED
                                </h2>
                                <span className="text-xs font-mono text-gray-500 bg-gray-900 px-2 py-1 rounded border border-gray-800">
                                    {filteredNews.length} Items
                                </span>
                            </div>
                            <div className="flex items-center gap-4 text-[10px] text-gray-500 font-mono">
                                <span className="flex items-center gap-1"><Clock size={12}/> Updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Never'}</span>
                                <button onClick={onRefresh} className="flex items-center gap-1 hover:text-green-400 transition-colors"><RefreshCw size={12}/> Refresh Now</button>
                            </div>
                        </div>

                        {/* Search */}
                        <div className="relative group w-full md:w-96 z-30">
                            <Search className="absolute left-3 top-2.5 text-gray-500 w-4 h-4" />
                            <input 
                                ref={searchInputRef}
                                type="text" 
                                placeholder="Search (e.g. source:CISA category:Ransomware)" 
                                className="bg-black/50 border border-gray-700 text-sm rounded pl-10 pr-8 py-2 focus:outline-none focus:border-green-500 w-full transition-colors text-white placeholder-gray-600 shadow-inner" 
                                value={searchQuery} 
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onFocus={() => setShowSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-gray-500 hover:text-white">
                                    <X size={14} />
                                </button>
                            )}

                            {showSuggestions && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden animate-fade-in">
                                    <div className="p-2 bg-gray-800/50 text-[10px] uppercase text-gray-500 font-bold tracking-wider">
                                        Search Filters
                                    </div>
                                    <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                        {NEWS_SEARCH_KEYS.map((item) => (
                                            <button 
                                                key={item.key} 
                                                className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-green-500/20 hover:text-green-400 flex justify-between items-center group"
                                                onClick={() => insertSearchToken(item.key)}
                                            >
                                                <span className="font-mono font-bold">{item.key}</span>
                                                <span className="text-gray-600 group-hover:text-gray-400 italic">ex: {item.example}</span>
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
                        <div className="flex items-center bg-black/50 border border-gray-700 rounded px-2 overflow-x-auto custom-scrollbar max-w-full md:max-w-2xl h-10">
                             <Filter size={14} className="text-gray-500 mr-2 flex-shrink-0"/>
                             {BASE_CATEGORIES.map(cat => (
                                 <button 
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`px-3 py-1 text-xs font-bold whitespace-nowrap transition-colors ${selectedCategory === cat ? 'text-green-400' : 'text-gray-500 hover:text-white'}`}
                                 >
                                     {cat}
                                 </button>
                             ))}
                        </div>

                        {/* Sources */}
                        <div className="flex items-center bg-black/50 border border-gray-700 rounded px-2 overflow-x-auto custom-scrollbar max-w-full md:max-w-md h-10">
                             <span className="text-[10px] uppercase font-bold text-gray-500 mr-2 flex-shrink-0">Source:</span>
                             {sources.map(src => (
                                 <button 
                                    key={src}
                                    onClick={() => setSelectedSource(src)}
                                    className={`px-3 py-1 text-xs font-bold whitespace-nowrap transition-colors ${selectedSource === src ? 'text-blue-400' : 'text-gray-500 hover:text-white'}`}
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
                        <div key={idx} className={`bg-gray-900/40 border rounded-lg p-4 transition-all duration-300 hover:bg-gray-900/60 group flex flex-col h-full relative ${item.isCve ? 'border-l-4 border-l-orange-500 border-y-gray-800 border-r-gray-800' : 'border-gray-800 hover:border-green-500/50'}`}>
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex gap-2 flex-wrap">
                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded border whitespace-nowrap ${getCategoryColor(item.subCategory)}`}>
                                        {item.subCategory}
                                    </span>
                                    {item.isCve && <span className="text-[9px] font-bold px-2 py-0.5 rounded border border-orange-500/50 text-orange-400 bg-orange-900/20 flex items-center gap-1"><ShieldAlert size={10}/> CVE</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                    {isRecent(item.timestamp) && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_5px_#22c55e]"></span>}
                                    <span className="text-[10px] text-gray-500 font-mono whitespace-nowrap">{item.date}</span>
                                </div>
                            </div>
                            
                            <h3 className={`text-sm font-bold transition-colors mb-2 line-clamp-2 break-all ${item.isCve ? 'text-gray-100 group-hover:text-orange-400' : 'text-gray-200 group-hover:text-green-400'}`}>
                                {item.title}
                            </h3>
                            
                            <p className="text-xs text-gray-400 line-clamp-3 mb-4 flex-1 leading-relaxed break-words">
                                {item.description}
                            </p>

                            {item.cveIds && item.cveIds.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-3">
                                    {item.cveIds.slice(0, 3).map(id => (
                                        <span key={id} className="text-[9px] bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded border border-gray-700 flex items-center gap-1">
                                            <Radio size={8}/> {id}
                                        </span>
                                    ))}
                                    {item.cveIds.length > 3 && <span className="text-[9px] text-gray-600 px-1">+{item.cveIds.length - 3}</span>}
                                </div>
                            )}

                            <div className="mt-auto pt-3 border-t border-gray-800 flex justify-between items-center">
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded border truncate max-w-[120px] ${getSourceStyle(item.source)}`}>{item.source}</span>
                                <a 
                                    href={item.link} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className={`text-xs flex items-center gap-1 transition-colors ${item.isCve ? 'text-orange-400 hover:text-white' : 'text-green-500 hover:text-white'}`}
                                >
                                    Read {item.isCve ? 'Advisory' : 'Article'} <ExternalLink size={12}/>
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
                {filteredNews.length === 0 && (
                     <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                         <Search size={48} className="opacity-20 mb-4"/>
                         <p>No intel matches your filters.</p>
                     </div>
                )}
            </div>
        </div>
    );
};
