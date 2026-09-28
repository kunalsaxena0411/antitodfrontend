
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Activity, ShieldAlert, Zap, Skull, Pause, Play, 
    Wifi, Globe, Lock, ExternalLink, AlertTriangle 
} from 'lucide-react';
import { RansomWatchPost, ThreatFoxEntry, CveFeedItem } from '../../types';

interface LiveThreatFeedProps {
    ransomwarePosts: RansomWatchPost[];
    threatFoxItems: ThreatFoxEntry[];
    cveItems: CveFeedItem[];
}

interface FeedItem {
    id: string;
    /** Stable unique key for React lists (same logical item can appear twice when the queue loops). */
    streamKey: string;
    type: 'RANSOMWARE' | 'IOC' | 'CVE';
    title: string;
    subtitle: string;
    timestamp: number; // Unix ms
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'INFO';
    source: string;
    meta?: string;
    link?: string;
}

function feedRowKey(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    return `sk-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export const LiveThreatFeed: React.FC<LiveThreatFeedProps> = ({ 
    ransomwarePosts, 
    threatFoxItems, 
    cveItems 
}) => {
    const [stream, setStream] = useState<FeedItem[]>([]);
    const [isPaused, setIsPaused] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const queueIndexRef = useRef(0);

    // 1. Unify and Sort Data
    const fullQueue = useMemo(() => {
        const items: FeedItem[] = [];

        // Ransomware
        ransomwarePosts.forEach((p, i) => {
            items.push({
                id: `rw-${p.group_name ?? 'x'}-${p.discovered ?? i}-${i}`,
                streamKey: feedRowKey(),
                type: 'RANSOMWARE',
                title: p.post_title,
                subtitle: p.group_name,
                timestamp: new Date(p.discovered).getTime(),
                severity: 'CRITICAL',
                source: 'RansomWatch',
                meta: p.country,
                link: p.website
            });
        });

        // ThreatFox (Limit to recent 50 to avoid noise)
        threatFoxItems.slice(0, 50).forEach((t, i) => {
            items.push({
                id: `tf-${t.ioc_value}-${t.first_seen_utc}-${i}`,
                streamKey: feedRowKey(),
                type: 'IOC',
                title: t.ioc_value,
                subtitle: t.malware_printable,
                timestamp: new Date(t.first_seen_utc).getTime(),
                severity: 'HIGH',
                source: 'ThreatFox',
                meta: t.ioc_type
            });
        });

        // CVEs
        cveItems.forEach((c, i) => {
            items.push({
                id: `cve-${c.cveIds?.[0] ?? 'na'}-${c.pubDate}-${i}`,
                streamKey: feedRowKey(),
                type: 'CVE',
                title: c.title,
                subtitle: c.cveIds[0] || 'Vulnerability',
                timestamp: new Date(c.pubDate).getTime(),
                severity: c.category === 'High Sev' ? 'HIGH' : 'MEDIUM',
                source: c.source,
                link: c.link
            });
        });

        // Sort by time descending (newest first)
        return items.sort((a, b) => b.timestamp - a.timestamp);
    }, [ransomwarePosts, threatFoxItems, cveItems]);

    // 2. Feed Logic (Simulation)
    useEffect(() => {
        if (fullQueue.length === 0) return;

        // Initial load: show top 5 immediately
        if (stream.length === 0) {
            setStream(fullQueue.slice(0, 5));
            queueIndexRef.current = 5;
        }

        const interval = setInterval(() => {
            if (isPaused) return;

            // If we have items left in the queue
            if (queueIndexRef.current < fullQueue.length) {
                const nextItem = fullQueue[queueIndexRef.current];
                setStream((prev) => [{ ...nextItem, streamKey: feedRowKey() }, ...prev].slice(0, 50));
                queueIndexRef.current++;
            } else {
                // Loop simulation: random older item "re-detected" or keep waiting
                // For now, we just stop or could restart index. 
                // Let's restart index to simulate endless activity for the "vibe"
                queueIndexRef.current = 0;
            }
        }, 2500); // Add new item every 2.5 seconds

        return () => clearInterval(interval);
    }, [fullQueue, isPaused, stream.length]);

    const getIcon = (type: string) => {
        switch(type) {
            case 'RANSOMWARE': return <Skull size={16} className="text-red-500" />;
            case 'IOC': return <Wifi size={16} className="text-red-500" />;
            case 'CVE': return <ShieldAlert size={16} className="text-white" />;
            default: return <Activity size={16} className="text-neutral-500" />;
        }
    };

    const getBorderColor = (type: string) => {
        switch(type) {
            case 'RANSOMWARE': return 'border-l-red-500 bg-red-900/10';
            case 'IOC': return 'border-l-purple-500 bg-neutral-900/10';
            case 'CVE': return 'border-l-orange-500 bg-neutral-900/10';
            default: return 'border-l-gray-500 bg-neutral-900/10';
        }
    };

    return (
        <div className="bg-black/40 border border-neutral-800 rounded-lg flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="p-3 border-b border-neutral-800 bg-neutral-900/50 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                    <Zap size={14} className="text-white animate-pulse"/>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Live Threat Stream</h3>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-[9px] font-mono text-neutral-500">
                        <span className={`w-1.5 h-1.5 rounded-full ${isPaused ? 'bg-neutral-600' : 'bg-neutral-500 animate-pulse'}`}></span>
                        {isPaused ? 'PAUSED' : 'LIVE'}
                    </div>
                    <button 
                        onClick={() => setIsPaused(!isPaused)}
                        className="p-1 hover:bg-white/10 rounded text-neutral-400 hover:text-white transition-colors"
                    >
                        {isPaused ? <Play size={12}/> : <Pause size={12}/>}
                    </button>
                </div>
            </div>

            {/* Feed List */}
            <div className="flex-1 overflow-hidden relative">
                <div ref={scrollRef} className="absolute inset-0 overflow-y-auto custom-scrollbar p-2 space-y-2">
                    {stream.map((item) => (
                        <div 
                            key={item.streamKey} 
                            className={`
                                relative p-3 rounded border-l-2 border-y border-r border-y-gray-800 border-r-gray-800 
                                ${getBorderColor(item.type)} 
                                animate-slide-in-right hover:bg-white/5 transition-colors group
                            `}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <div className="flex items-center gap-2">
                                    {getIcon(item.type)}
                                    <span className="text-[10px] font-bold text-neutral-400 bg-black/40 px-1.5 py-0.5 rounded border border-neutral-700">
                                        {item.source}
                                    </span>
                                    {item.meta && (
                                        <span className="text-[10px] text-neutral-500 font-mono">
                                            [{item.meta}]
                                        </span>
                                    )}
                                </div>
                                <span className="text-[9px] text-neutral-600 font-mono">
                                    {new Date(item.timestamp).toLocaleTimeString()}
                                </span>
                            </div>
                            
                            <div className="flex justify-between items-center">
                                <div className="min-w-0 pr-2">
                                    <div className="text-sm font-bold text-neutral-200 truncate" title={item.title}>
                                        {item.title}
                                    </div>
                                    <div className="text-xs text-neutral-500 truncate font-mono">
                                        {item.subtitle}
                                    </div>
                                </div>
                                {item.link && (
                                    <a 
                                        href={item.link} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-neutral-800 text-neutral-300 rounded hover:bg-red-500 hover:text-black"
                                    >
                                        <ExternalLink size={12}/>
                                    </a>
                                )}
                            </div>
                        </div>
                    ))}
                    
                    {stream.length === 0 && (
                        <div className="text-center text-neutral-500 text-xs py-10 flex flex-col items-center gap-2">
                            <Activity className="opacity-20 animate-spin" size={24}/>
                            Initializing Stream...
                        </div>
                    )}
                </div>
                
                {/* Gradient Fade at Bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#020617] to-transparent pointer-events-none"></div>
            </div>
        </div>
    );
};
