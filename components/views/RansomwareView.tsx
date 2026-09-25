
import React, { useState, useMemo } from 'react';
import { RansomWatchPost, RansomWatchGroup } from '../../types';
import { Skull, AlertTriangle, Globe, Lock, ExternalLink, RefreshCw, Search, Target, Users, Calendar, Activity, Zap, ImageIcon, Eye } from 'lucide-react';

interface RansomwareViewProps {
    posts: RansomWatchPost[];
    groups: RansomWatchGroup[];
}

export const RansomwareView: React.FC<RansomwareViewProps> = ({ posts, groups }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [victimSearch, setVictimSearch] = useState('');
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const lastUpdated = useMemo(() => new Date(), [posts]);

    // Calculate Victim Counts per Group based on posts
    const groupVictimCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        posts.forEach(p => {
            const g = p.group_name;
            counts[g] = (counts[g] || 0) + 1;
        });
        return counts;
    }, [posts]);

    // Top Active Groups (for stats)
    const topGroups = useMemo(() => {
        return Object.entries(groupVictimCounts)
            .sort((a, b) => (b[1] as number) - (a[1] as number))
            .slice(0, 5);
    }, [groupVictimCounts]);

    // Filtered Groups for List
    const filteredGroups = useMemo(() => {
        if (!searchTerm) return groups;
        const lower = searchTerm.toLowerCase();
        return groups.filter(g => g.name.toLowerCase().includes(lower) || (g.meta && g.meta.toLowerCase().includes(lower)));
    }, [groups, searchTerm]);

    // Filtered Posts for Feed (Optimized)
    const filteredPosts = useMemo(() => {
        let data = posts;
        if (victimSearch) {
            const lower = victimSearch.toLowerCase();
            data = data.filter(p => 
                p.post_title.toLowerCase().includes(lower) || 
                p.group_name.toLowerCase().includes(lower) ||
                (p.country && p.country.toLowerCase().includes(lower)) ||
                (p.activity && p.activity.toLowerCase().includes(lower))
            );
        }
        return data.slice(0, 100); // Limit rendering for performance
    }, [posts, victimSearch]);

    const recentVelocity = useMemo(() => {
        // Count posts in last 24h
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        return posts.filter(p => now - new Date(p.discovered).getTime() < oneDay).length;
    }, [posts]);

    return (
        <div className="h-[calc(100vh-70px)] bg-cyber-grid flex flex-col overflow-hidden relative">
            {/* Screenshot Preview Overlay */}
            {previewImage && (
                <div 
                    className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8 cursor-zoom-out"
                    onClick={() => setPreviewImage(null)}
                >
                    <div className="relative max-w-4xl w-full bg-gray-900 border border-gray-700 rounded-lg overflow-hidden shadow-2xl">
                        <div className="p-2 bg-black flex justify-between items-center border-b border-gray-800">
                            <span className="text-xs font-mono text-gray-400">EVIDENCE SNAPSHOT</span>
                            <button className="text-white hover:text-red-400"><ExternalLink size={16}/></button>
                        </div>
                        <img src={previewImage} alt="Victim Site" className="w-full h-auto max-h-[80vh] object-contain"/>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="bg-black/40 border-b border-gray-800 p-6 flex flex-col gap-4 shrink-0">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-red-900/20 rounded-lg border border-red-500/30 text-red-500">
                            <Skull size={24}/>
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white font-cyber flex items-center gap-2">
                                RANSOMWARE <span className="text-red-500">WATCH</span>
                            </h2>
                            <p className="text-sm text-gray-500 font-mono mt-1">Live Double Extortion Monitoring</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-mono text-gray-500">
                        {posts.length > 0 ? (
                            <span>Last Sync: {lastUpdated.toLocaleTimeString()}</span>
                        ) : (
                            <span>Waiting for feed...</span>
                        )}
                        <span className="bg-gray-800 px-2 py-1 rounded border border-gray-700">Auto-Update Active</span>
                    </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-gray-900/40 border border-gray-800 rounded p-3 flex items-center justify-between">
                        <div>
                            <div className="text-[10px] text-gray-500 uppercase font-bold">Total Victims</div>
                            <div className="text-2xl font-mono text-white">{posts.length}</div>
                        </div>
                        <Target size={20} className="text-gray-600"/>
                    </div>
                    <div className="bg-gray-900/40 border border-gray-800 rounded p-3 flex items-center justify-between">
                        <div>
                            <div className="text-[10px] text-gray-500 uppercase font-bold">Active Groups</div>
                            <div className="text-2xl font-mono text-orange-400">{groups.length}</div>
                        </div>
                        <Users size={20} className="text-orange-900"/>
                    </div>
                    <div className="bg-gray-900/40 border border-gray-800 rounded p-3 flex items-center justify-between">
                        <div>
                            <div className="text-[10px] text-gray-500 uppercase font-bold">24h Velocity</div>
                            <div className="text-2xl font-mono text-red-500">{recentVelocity}</div>
                        </div>
                        <Activity size={20} className="text-red-900"/>
                    </div>
                    <div className="bg-gray-900/40 border border-gray-800 rounded p-3">
                        <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Top Threat</div>
                        <div className="text-sm font-bold text-white truncate">{topGroups[0]?.[0] || 'N/A'}</div>
                        <div className="text-[10px] text-gray-600">{topGroups[0]?.[1] || 0} victims</div>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Left Column: Victim Feed */}
                <div className="w-1/3 min-w-[400px] border-r border-gray-800 flex flex-col bg-black/20">
                    <div className="p-3 bg-gray-900/50 border-b border-gray-800 flex items-center justify-between sticky top-0 z-10">
                        <div className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2">
                            <Zap size={14}/> Live Victim Feed
                        </div>
                        <div className="relative">
                            <Search className="absolute left-2 top-1.5 text-gray-600 w-3 h-3"/>
                            <input 
                                type="text" 
                                placeholder="Filter victims or country..." 
                                className="bg-black border border-gray-700 rounded-full pl-7 pr-3 py-1 text-xs text-gray-300 focus:outline-none focus:border-red-500 w-32 transition-all focus:w-48"
                                value={victimSearch}
                                onChange={(e) => setVictimSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                        {posts.length === 0 ? (
                            <div className="p-8 text-center text-gray-500 text-xs italic">Loading ransomware feed...</div>
                        ) : filteredPosts.length === 0 ? (
                             <div className="p-8 text-center text-gray-500 text-xs italic">No victims found matching filter.</div>
                        ) : (
                            filteredPosts.map((post, i) => (
                                <div key={i} className="p-4 border-b border-gray-800 hover:bg-white/5 transition-colors group relative">
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-mono text-gray-500">{new Date(post.discovered).toLocaleString()}</span>
                                            {post.country && <img src={`https://flagcdn.com/w20/${post.country.toLowerCase()}.png`} className="w-4 h-3 rounded-sm opacity-80" alt={post.country} title={post.country}/>}
                                        </div>
                                        <div className="flex gap-2 items-center">
                                            {post.source === 'Ransomware.live' && <span className="text-[9px] bg-blue-900/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded font-bold flex items-center gap-1"><Zap size={8} fill="currentColor"/> LIVE</span>}
                                            <span className="text-[10px] bg-red-900/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded font-bold uppercase">{post.group_name}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <h4 className="text-sm font-bold text-gray-200 group-hover:text-red-400 transition-colors mb-1">{post.post_title}</h4>
                                            {post.description && post.description !== 'N/A' && (
                                                <p className="text-[10px] text-gray-500 line-clamp-1 mb-1 max-w-[250px]">{post.description}</p>
                                            )}
                                            {post.activity && post.activity !== 'N/A' && post.activity !== 'Not Found' && (
                                                <div className="text-[10px] text-gray-500 flex items-center gap-1">
                                                    <Activity size={10}/> {post.activity}
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className="flex gap-2">
                                            {post.website && (
                                                <a href={post.website.startsWith('http') ? post.website : `http://${post.website}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded bg-gray-800 text-gray-400 hover:text-cyber-cyan hover:bg-gray-700 transition-colors" title="Visit Site">
                                                    <Globe size={12}/>
                                                </a>
                                            )}
                                            {post.screenshot && (
                                                <button 
                                                    onClick={() => setPreviewImage(post.screenshot!)}
                                                    className="p-1.5 rounded bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors relative group/img" 
                                                    title="View Proof"
                                                >
                                                    <ImageIcon size={12}/>
                                                    <span className="absolute right-0 top-0 w-2 h-2 bg-green-500 rounded-full animate-ping"></span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                        {filteredPosts.length === 100 && (
                            <div className="p-2 text-center text-[10px] text-gray-600 border-t border-gray-800 bg-black/20 font-mono">
                                Showing recent 100 of {posts.length}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Gang Profiles */}
                <div className="flex-1 flex flex-col bg-black/40">
                    <div className="p-3 bg-gray-900/50 border-b border-gray-800 flex items-center justify-between">
                        <div className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2">
                            <Lock size={14}/> Gang Profiles
                        </div>
                        <div className="relative">
                            <Search className="absolute left-2 top-1.5 text-gray-600 w-3 h-3"/>
                            <input 
                                type="text" 
                                placeholder="Search groups..." 
                                className="bg-black border border-gray-700 rounded-full pl-7 pr-3 py-1 text-xs text-gray-300 focus:outline-none focus:border-red-500 w-48"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 grid grid-cols-1 xl:grid-cols-2 gap-4 content-start">
                        {filteredGroups.length === 0 && !searchTerm ? (
                            <div className="col-span-full text-center text-gray-500 text-xs italic mt-10">Loading group profiles...</div>
                        ) : (
                            filteredGroups.map((group, i) => (
                                <div key={i} className="bg-gray-900/30 border border-gray-800 rounded-lg p-4 hover:border-red-500/30 transition-colors flex flex-col h-full">
                                    <div className="flex justify-between items-start mb-3">
                                        <h3 className="text-lg font-bold text-white uppercase tracking-wide">{group.name}</h3>
                                        <span className="text-xs font-mono text-gray-500 bg-black/50 px-2 py-1 rounded border border-gray-800">
                                            {groupVictimCounts[group.name] || 0} Victims
                                        </span>
                                    </div>
                                    
                                    {group.meta && (
                                        <div className="text-xs text-gray-400 mb-4 italic border-l-2 border-gray-700 pl-2">
                                            {group.meta}
                                        </div>
                                    )}

                                    <div className="mt-auto space-y-2">
                                        <div className="text-[10px] font-bold text-gray-500 uppercase">Darkweb Locations</div>
                                        <div className="space-y-1">
                                            {group.locations.map((loc, idx) => (
                                                <div key={idx} className="flex items-center justify-between bg-black/40 p-1.5 rounded text-xs border border-gray-800">
                                                    <div className="flex items-center gap-2 truncate">
                                                        <div className={`w-2 h-2 rounded-full ${loc.available ? 'bg-green-500' : 'bg-red-500'}`} title={loc.available ? 'Online' : 'Offline'}></div>
                                                        <span className="font-mono text-gray-300 truncate" title={loc.slug}>{loc.fqdn || loc.slug}</span>
                                                    </div>
                                                    <span className="text-[9px] text-gray-600 font-mono ml-2 whitespace-nowrap">v{loc.version}</span>
                                                </div>
                                            ))}
                                            {group.locations.length === 0 && <span className="text-gray-600 text-xs italic">No known leaksites.</span>}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
