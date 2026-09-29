
import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { 
    Network, Upload, Activity, FileCode, Wifi, ShieldAlert, List, Server, 
    Map as MapIcon, ChevronRight, ChevronDown, Download, Search, Filter,
    FileText, Lock, Globe, Cpu, AlertTriangle, Eye, ArrowRight, Fingerprint
} from 'lucide-react';
import { NetworkAnalysisResult, MalpediaActor, NetworkPacket, TcpStream, ExtractedFile } from '../../types';
import { analyzePcap } from '../../services/network';
import { downloadFile } from '../../services/exporter';

interface NetworkViewProps {
    actors: MalpediaActor[];
    savedResult: NetworkAnalysisResult | null;
    onUpdateResult: (result: NetworkAnalysisResult | null) => void;
}

const TimeSeriesChart = ({ data, yKey, color = "#8b5cf6" }: { data: any[], yKey: string, color?: string }) => {
    const ref = useRef<SVGSVGElement>(null);
    useEffect(() => {
        if (!ref.current || !data || data.length === 0) return;
        const svg = d3.select(ref.current); svg.selectAll("*").remove();
        const margin = { top: 10, right: 10, bottom: 20, left: 40 };
        const width = (ref.current.clientWidth || 400) - margin.left - margin.right;
        const height = (ref.current.clientHeight || 200) - margin.top - margin.bottom;
        const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
        
        const startTime = data.length > 0 ? Number(data[0].timestamp) : 0;
        
        const x = d3.scaleLinear().domain(d3.extent(data, (d: any) => d.timestamp) as [number, number]).range([0, width]);
        const y = d3.scaleLinear().domain([0, (d3.max(data, (d: any) => d[yKey]) as number) || 0]).range([height, 0]);
        
        const area = d3.area()
            .x((d: any) => x(d.timestamp))
            .y0(height)
            .y1((d: any) => y(d[yKey]))
            .curve(d3.curveMonotoneX);
            
        const line = d3.line()
            .x((d: any) => x(d.timestamp))
            .y((d: any) => y(d[yKey]))
            .curve(d3.curveMonotoneX);

        g.append("path").datum(data).attr("fill", color).attr("fill-opacity", 0.2).attr("d", area as any);
        g.append("path").datum(data).attr("fill", "none").attr("stroke", color).attr("stroke-width", 1.5).attr("d", line as any);
        
        g.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).ticks(5).tickFormat((d: any) => `+${(Number(d) - startTime).toFixed(0)}s`));
            
        g.append("g").call(d3.axisLeft(y).ticks(5));
    }, [data, yKey, color]);
    
    if (!data || data.length === 0) return <div className="flex items-center justify-center h-full text-[#888] text-xs">No Time Series Data</div>;
    return <svg ref={ref} width="100%" height="100%"></svg>;
};

export const NetworkView: React.FC<NetworkViewProps> = ({ actors, savedResult, onUpdateResult }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'PACKETS' | 'STREAMS' | 'FILES' | 'THREATS'>('DASHBOARD');
    const [selectedStream, setSelectedStream] = useState<TcpStream | null>(null);
    const [packetSearch, setPacketSearch] = useState('');
    
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setIsProcessing(true);
            try {
                const result = await analyzePcap(e.target.files[0], actors);
                onUpdateResult(result);
            } catch (err) {
                console.error(err);
                alert("Failed to analyze PCAP file. Check console for details.");
            } finally {
                setIsProcessing(false);
            }
        }
    };

    const filteredPackets = useMemo(() => {
        if (!savedResult || !packetSearch) return savedResult?.packets || [];
        const lower = packetSearch.toLowerCase();
        return savedResult.packets.filter(p => 
            p.protocol.toLowerCase().includes(lower) ||
            p.source.includes(lower) ||
            p.destination.includes(lower) ||
            p.info.toLowerCase().includes(lower)
        ).slice(0, 1000); // Limit for performance
    }, [savedResult, packetSearch]);

    if (!savedResult) {
        return (
            <div className="h-full min-h-[calc(100vh-140px)] flex flex-col items-center justify-center bg-transparent text-[#AAA] p-8 w-full">
                <div className="w-full max-w-md border border-[#222] rounded-xl p-10 flex flex-col items-center justify-center text-center bg-[#111] hover:border-[#333] transition-colors group relative overflow-hidden shadow-lg">
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleFileUpload} accept=".pcap,.pcapng,.json"/>
                    
                    <div className="w-16 h-16 flex items-center justify-center bg-[#111] border border-[#333] rounded-2xl mb-6 group-hover:scale-105 group-hover:border-[#444] transition-all duration-300 shadow-sm">
                        <Network size={28} className="text-[#888] group-hover:text-white transition-colors"/>
                    </div>
                    
                    <h3 className="text-sm font-semibold text-[#e5e7eb] mb-2 font-sans tracking-wide">Network Traffic Analysis</h3>
                    <p className="text-xs text-[#737a84] mb-8 max-w-[280px] leading-relaxed">
                        Drag & drop PCAP, PCAPNG, or Wireshark JSON dumps to extract traffic patterns, embedded files, and threats.
                    </p>
                    
                    {isProcessing ? (
                        <div className="flex items-center gap-2 text-red-500 text-xs font-semibold animate-pulse">
                            <Activity className="animate-spin" size={14}/> 
                            <span>PROCESSING PACKETS...</span>
                        </div>
                    ) : (
                        <button className="px-5 py-2.5 bg-[#151515] hover:bg-[#1c1c1c] border border-[#333] hover:border-[#444] text-neutral-300 rounded-lg font-semibold text-[11px] transition-all shadow-sm">
                            SELECT CAPTURE FILE
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="h-full min-h-[calc(100vh-140px)] flex flex-col bg-transparent overflow-hidden w-full">
            {/* Header */}
            <div className="bg-[#111]/40 border-b border-[#222] p-4 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-[#111] rounded border border-neutral-500/30">
                        <Activity size={20} className="text-red-400"/>
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white font-cyber flex items-center gap-2">
                            NETWORK <span className="text-red-400">FORENSICS</span>
                        </h2>
                        <div className="flex gap-4 text-xs font-mono text-[#888]">
                            <span>{savedResult.fileType}</span>
                            <span>{savedResult.stats.totalPackets.toLocaleString()} pkts</span>
                            <span>{(Number(savedResult.stats.totalBytes) / 1024 / 1024).toFixed(2)} MB</span>
                            <span>Duration: {(Number(savedResult.stats.duration) / 1000).toFixed(2)}s</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => onUpdateResult(null)} className="px-3 py-1.5 text-xs font-bold text-[#AAA] hover:text-white border border-[#333] rounded hover:bg-[#151515]">
                        NEW ANALYSIS
                    </button>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex bg-[#111] border-b border-[#222] px-4 shrink-0 overflow-x-auto">
                <button onClick={() => setActiveTab('DASHBOARD')} className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'DASHBOARD' ? 'border-neutral-500 text-white' : 'border-transparent text-[#888] hover:text-neutral-300'}`}>
                    <Activity size={14}/> OVERVIEW
                </button>
                <button onClick={() => setActiveTab('PACKETS')} className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'PACKETS' ? 'border-neutral-500 text-white' : 'border-transparent text-[#888] hover:text-neutral-300'}`}>
                    <List size={14}/> PACKETS
                </button>
                <button onClick={() => setActiveTab('STREAMS')} className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'STREAMS' ? 'border-neutral-500 text-white' : 'border-transparent text-[#888] hover:text-neutral-300'}`}>
                    <ArrowRight size={14}/> TCP STREAMS
                </button>
                <button onClick={() => setActiveTab('FILES')} className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'FILES' ? 'border-neutral-500 text-white' : 'border-transparent text-[#888] hover:text-neutral-300'}`}>
                    <FileCode size={14}/> FILES ({savedResult.files.length})
                </button>
                <button onClick={() => setActiveTab('THREATS')} className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'THREATS' ? 'border-red-500 text-white' : 'border-transparent text-[#888] hover:text-neutral-300'}`}>
                    <ShieldAlert size={14}/> THREATS ({savedResult.anomalies.length + savedResult.actorMatches.length})
                </button>
            </div>

            <div className="flex-1 overflow-hidden relative bg-[#111]/20">
                {activeTab === 'DASHBOARD' && (
                    <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-6 space-y-6">
                        {/* Traffic Volume */}
                        <div className="h-64 bg-[#111] border border-[#222] rounded-lg p-4">
                            <h3 className="text-xs font-bold text-[#AAA] uppercase mb-4 flex items-center gap-2"><Activity size={14}/> Traffic Volume (Bytes)</h3>
                            <TimeSeriesChart data={savedResult.stats.timeSeries} yKey="bytes" color="#3b82f6" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Protocols */}
                            <div className="bg-[#111] border border-[#222] rounded-lg p-4">
                                <h3 className="text-xs font-bold text-[#AAA] uppercase mb-4">Protocol Distribution</h3>
                                <div className="space-y-2">
                                    {Object.entries(savedResult.stats.protocols).sort((a: any, b: any) => Number(b[1]) - Number(a[1])).slice(0, 8).map(([proto, count], i) => (
                                        <div key={i} className="flex items-center justify-between text-xs">
                                            <span className="text-neutral-300 font-mono">{proto}</span>
                                            <div className="flex items-center gap-2 flex-1 mx-3">
                                                <div className="h-1.5 bg-[#151515] rounded-full flex-1 overflow-hidden">
                                                    <div className="h-full bg-[#151515]" style={{ width: `${(Number(count) / Number(savedResult.stats.totalPackets)) * 100}%` }}></div>
                                                </div>
                                            </div>
                                            <span className="text-[#888] font-mono">{Number(count)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Top Talkers */}
                            <div className="bg-[#111] border border-[#222] rounded-lg p-4">
                                <h3 className="text-xs font-bold text-[#AAA] uppercase mb-4">Top Talkers (Source IP)</h3>
                                <div className="space-y-2">
                                    {savedResult.stats.topTalkers.slice(0, 8).map((talker: any, i: number) => (
                                        <div key={i} className="flex justify-between items-center text-xs p-1.5 hover:bg-white/5 rounded">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[#888] font-mono w-4">{i+1}.</span>
                                                <span className="text-white font-mono">{talker.ip}</span>
                                            </div>
                                            <span className="text-[#AAA]">{(Number(talker.bytes) / 1024).toFixed(1)} KB</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Anomalies */}
                            <div className="bg-[#111] border border-[#222] rounded-lg p-4">
                                <h3 className="text-xs font-bold text-[#AAA] uppercase mb-4 flex items-center gap-2"><AlertTriangle size={14}/> Detected Anomalies</h3>
                                <div className="space-y-2 overflow-y-auto custom-scrollbar max-h-60">
                                    {savedResult.anomalies.length > 0 ? savedResult.anomalies.map((anom, i) => (
                                        <div key={i} className="p-2 bg-red-900/10 border border-red-500/20 rounded text-xs">
                                            <div className="flex justify-between mb-1">
                                                <span className="text-red-400 font-bold">{anom.type}</span>
                                                <span className="text-red-300/50 text-[10px]">{anom.severity}</span>
                                            </div>
                                            <p className="text-[#AAA]">{anom.description}</p>
                                        </div>
                                    )) : <div className="text-center text-neutral-600 text-xs italic py-10">No anomalies detected.</div>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'PACKETS' && (
                    <div className="absolute inset-0 flex flex-col">
                        <div className="p-2 border-b border-[#222] bg-[#111] flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-2 top-2 text-[#888] w-3 h-3"/>
                                <input 
                                    type="text" 
                                    className="w-full bg-[#111] border border-[#333] rounded pl-8 pr-4 py-1 text-xs text-neutral-300 focus:border-neutral-500 focus:outline-none"
                                    placeholder="Filter packets (protocol, ip, info)..."
                                    value={packetSearch}
                                    onChange={(e) => setPacketSearch(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <table className="w-full text-left text-xs font-mono">
                                <thead className="bg-[#111] text-[#888] sticky top-0 z-10">
                                    <tr>
                                        <th className="p-2 w-16">No.</th>
                                        <th className="p-2 w-24">Time</th>
                                        <th className="p-2 w-32">Source</th>
                                        <th className="p-2 w-32">Destination</th>
                                        <th className="p-2 w-16">Proto</th>
                                        <th className="p-2 w-16 text-right">Len</th>
                                        <th className="p-2">Info</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-800 text-neutral-300">
                                    {filteredPackets.map((pkt) => (
                                        <tr key={pkt.id} className="hover:bg-white/5 cursor-pointer">
                                            <td className="p-2 text-[#888]">{pkt.id}</td>
                                            <td className="p-2 text-[#888]">{pkt.timestamp.toFixed(4)}</td>
                                            <td className="p-2 text-white">{pkt.source}</td>
                                            <td className="p-2 text-white">{pkt.destination}</td>
                                            <td className="p-2 font-bold">{pkt.protocol}</td>
                                            <td className="p-2 text-right text-[#888]">{pkt.length}</td>
                                            <td className="p-2 text-[#AAA] truncate max-w-lg" title={pkt.info}>{pkt.info}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'STREAMS' && (
                    <div className="absolute inset-0 flex flex-col">
                         {selectedStream ? (
                             <div className="flex-1 flex flex-col p-4">
                                 <div className="flex justify-between items-center mb-4">
                                     <button onClick={() => setSelectedStream(null)} className="text-xs text-red-400 hover:text-white flex items-center gap-1">
                                         <ChevronRight size={12} className="rotate-180"/> Back to Streams
                                     </button>
                                     <div className="text-xs font-mono text-[#AAA]">
                                         Stream {selectedStream.id} • {selectedStream.application} • {selectedStream.duration.toFixed(2)}ms
                                     </div>
                                 </div>
                                 <div className="flex-1 bg-[#111] border border-[#222] rounded p-4 overflow-auto custom-scrollbar font-mono text-xs">
                                     {selectedStream.payloads.map((p, i) => (
                                         <div key={i} className={`mb-2 ${p.direction === 'CLIENT_TO_SERVER' ? 'text-white' : 'text-white'}`}>
                                             {/* Simulated text decoding for demo - in real app would use Hex view */}
                                             <div className="opacity-50 text-[10px] mb-0.5">{p.direction === 'CLIENT_TO_SERVER' ? 'Client -> Server' : 'Server -> Client'} ({p.data.length} bytes)</div>
                                             <div className="whitespace-pre-wrap break-all bg-white/5 p-2 rounded">
                                                 {/* Placeholder for raw data view */}
                                                 [Binary Data: {p.data.length} bytes]
                                             </div>
                                         </div>
                                     ))}
                                 </div>
                             </div>
                         ) : (
                             <div className="flex-1 overflow-auto custom-scrollbar p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                 {savedResult.streams.map(stream => (
                                     <div 
                                        key={stream.id} 
                                        onClick={() => setSelectedStream(stream)}
                                        className="bg-[#111] border border-[#222] p-4 rounded hover:border-neutral-500/30 cursor-pointer group transition-colors"
                                     >
                                         <div className="flex justify-between items-start mb-2">
                                             <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${stream.protocol === 'TCP' ? 'bg-[#111] text-white' : 'bg-neutral-900/20 text-white'}`}>{stream.application}</span>
                                             <span className="text-[10px] text-[#888]">{stream.packetCount} pkts</span>
                                         </div>
                                         <div className="text-xs font-mono text-neutral-300 mb-1">
                                             {stream.srcIp}:{stream.srcPort} <span className="text-neutral-600">→</span> {stream.dstIp}:{stream.dstPort}
                                         </div>
                                         <div className="text-[10px] text-[#888]">
                                             Duration: {stream.duration.toFixed(2)}ms | Size: {(Number(stream.bytes)/1024).toFixed(2)} KB
                                         </div>
                                         {stream.metadata?.sni && <div className="mt-2 text-[10px] text-red-400 bg-neutral-900/10 px-2 py-1 rounded truncate">SNI: {stream.metadata.sni}</div>}
                                     </div>
                                 ))}
                             </div>
                         )}
                    </div>
                )}

                {activeTab === 'FILES' && (
                    <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {savedResult.files.map(file => (
                                <div key={file.id} className="bg-[#111] border border-[#222] p-4 rounded hover:border-neutral-600 transition-colors group">
                                    <div className="flex items-start justify-between mb-2">
                                        <FileCode size={24} className="text-[#888]"/>
                                        <button 
                                            onClick={() => {
                                                const url = URL.createObjectURL(file.data);
                                                const a = document.createElement('a'); a.href = url; a.download = file.name; a.click();
                                            }}
                                            className="text-[#888] hover:text-white"
                                        >
                                            <Download size={16}/>
                                        </button>
                                    </div>
                                    <div className="font-bold text-sm text-white truncate mb-1" title={file.name}>{file.name}</div>
                                    <div className="text-xs text-[#888] mb-2">{file.type} • {(file.size / 1024).toFixed(1)} KB</div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${file.entropy > 7 ? 'border-red-500/30 text-red-400 bg-red-900/10' : 'border-neutral-500/30 text-white bg-neutral-900/10'}`}>
                                            Entropy: {file.entropy.toFixed(2)}
                                        </span>
                                        {file.isCompressed && <span className="text-[10px] text-[#888] bg-[#151515] px-1.5 py-0.5 rounded">Compressed</span>}
                                    </div>
                                </div>
                            ))}
                            {savedResult.files.length === 0 && (
                                <div className="col-span-full text-center text-[#888] italic py-10">No files extracted from stream.</div>
                            )}
                        </div>
                    </div>
                )}
                
                {activeTab === 'THREATS' && (
                     <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-6 space-y-8">
                         {/* Threat Intel Matches */}
                         <div className="space-y-4">
                             <h3 className="text-sm font-bold text-red-400 uppercase flex items-center gap-2"><ShieldAlert size={16}/> Intelligence Hits</h3>
                             {savedResult.actorMatches.length > 0 ? (
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     {savedResult.actorMatches.map((match, i) => (
                                         <div key={i} className="bg-red-900/10 border border-red-500/30 p-4 rounded flex justify-between items-start">
                                             <div>
                                                 <div className="font-bold text-red-300">{match.actor.value}</div>
                                                 <div className="text-xs text-[#AAA]">Trigger: {match.trigger} ({match.type})</div>
                                             </div>
                                             <span className="text-[10px] bg-red-900/40 text-red-200 px-2 py-1 rounded font-bold border border-red-500/30">{match.confidence} CONFIDENCE</span>
                                         </div>
                                     ))}
                                 </div>
                             ) : <div className="text-[#888] text-xs italic">No known threat actors matched.</div>}
                         </div>

                         {/* JA3 Fingerprints */}
                         <div className="space-y-4">
                             <h3 className="text-sm font-bold text-white uppercase flex items-center gap-2"><Fingerprint size={16} className="lucide-icon"/> TLS Fingerprints (JA3)</h3>
                             <div className="bg-[#111] border border-[#222] rounded overflow-hidden">
                                 <table className="w-full text-left text-xs font-mono">
                                     <thead className="bg-[#111] text-[#888]">
                                         <tr><th className="p-3">JA3 Hash</th><th className="p-3 text-right">Count</th></tr>
                                     </thead>
                                     <tbody className="divide-y divide-neutral-800 text-neutral-300">
                                         {savedResult.tlsFingerprints.slice(0, 20).map((ja3, i) => (
                                             <tr key={i} className="hover:bg-white/5">
                                                 <td className="p-3">{ja3.hash}</td>
                                                 <td className="p-3 text-right">{ja3.count}</td>
                                             </tr>
                                         ))}
                                     </tbody>
                                 </table>
                             </div>
                         </div>
                     </div>
                )}
            </div>
        </div>
    );
};

