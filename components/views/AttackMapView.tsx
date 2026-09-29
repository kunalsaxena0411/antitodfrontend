

import React, { useEffect, useRef, useState } from 'react';
import * as d3Import from 'd3';
import * as topojson from 'topojson-client';
import { AnalyzedHost } from '../../types';
import { Map as MapIcon, Target, Maximize2, Minimize2, Play, Pause, Globe, Activity, Terminal, ShieldAlert, Zap, Plus, Minus, MousePointer2 } from 'lucide-react';

const d3 = d3Import as any;

export interface AttackTarget {
    type: 'LOCAL' | 'GLOBAL' | 'RANSOMWARE' | 'IOC';
    lat?: number;
    lon?: number;
    country?: string;
    label: string;
    subLabel?: string;
    risk: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

interface AttackMapViewProps {
    results: AnalyzedHost[];
    globalThreats?: AttackTarget[];
    cinematic?: boolean;
    allowInteraction?: boolean;
}

interface Projectile {
    id: number;
    from: [number, number]; // lon, lat
    to: [number, number];
    progress: number;
    speed: number;
    color: string;
    risk: string;
    signature?: string;
}

interface Ripple {
    id: number;
    pos: [number, number];
    r: number;
    maxR: number;
    alpha: number;
    color: string;
}

interface OriginPulse {
    id: number;
    pos: [number, number];
    r: number;
    alpha: number;
    color: string;
    label?: string;
}

interface AttackLogItem {
    id: number;
    timestamp: string;
    srcIp: string;
    srcCountry: string;
    srcFlag?: string;
    signature: string;
    payload: string;
    risk: string;
    source: string;
}

interface AttackLabel {
    id: number;
    x: number;
    y: number;
    text: string;
    subText?: string;
    life: number;
    maxLife: number;
    color: string;
}

// Fixed HQ location (Default to US East / N. Virginia)
const DEFAULT_HQ: [number, number] = [-77.48, 39.04]; 

// Approximate Country Centers for mapping codes to coordinates
const COUNTRY_COORDS: Record<string, [number, number]> = {
    'CN': [104.1, 35.8], 'RU': [105.3, 61.5], 'US': [-95.7, 37.0],
    'BR': [-51.9, -14.2], 'IN': [78.9, 20.5], 'DE': [10.4, 51.1],
    'IR': [53.6, 32.4], 'KP': [127.5, 40.3], 'KR': [127.7, 35.9],
    'GB': [-3.4, 55.3], 'FR': [2.2, 46.2], 'JP': [138.2, 36.2],
    'UA': [31.1, 48.3], 'BY': [27.9, 53.7], 'VN': [108.2, 14.0],
    'TR': [35.2, 38.9], 'RO': [24.9, 45.9], 'NL': [5.2, 52.1],
    'CA': [-106.3, 56.1], 'AU': [133.7, -25.2], 'IT': [12.5, 41.8],
    'ES': [-3.7, 40.4], 'PL': [19.1, 51.9], 'ID': [113.9, -0.7],
    'MX': [-102.5, 23.6], 'SA': [45.0, 23.8], 'ZA': [22.9, -30.5]
};

export const AttackMapView: React.FC<AttackMapViewProps> = ({ results, globalThreats = [], cinematic = false, allowInteraction = false }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [worldData, setWorldData] = useState<any>(null);
    const [hq, setHq] = useState<[number, number]>(DEFAULT_HQ);
    const [stats, setStats] = useState({ active: 0, total: 0, peak: 0 });
    const [isPaused, setIsPaused] = useState(false);
    const [projectionType, setProjectionType] = useState<'ORTHO' | 'MERCATOR'>('ORTHO');
    const [isFullscreen, setIsFullscreen] = useState(false);
    
    const [attackLog, setAttackLog] = useState<AttackLogItem[]>([]);
    const transformRef = useRef({ k: 1, x: 0, y: 0, rotate: [0, -30] as [number, number] });
    const isDraggingRef = useRef(false);

    const reqRef = useRef<number>(0);
    const projectilesRef = useRef<Projectile[]>([]);
    const ripplesRef = useRef<Ripple[]>([]);
    const originPulsesRef = useRef<OriginPulse[]>([]);
    const labelsRef = useRef<AttackLabel[]>([]);
    const attackQueueRef = useRef<AttackTarget[]>([]);
    const lastLogTimeRef = useRef(0);

    useEffect(() => {
        fetch('https://unpkg.com/world-atlas@2.0.2/countries-110m.json')
            .then(res => res.json())
            .then(data => {
                const countries = topojson.feature(data, data.objects.countries);
                setWorldData(countries);
            });
    }, []);

    // Initialize Attack Queue (Merge Local & Global)
    useEffect(() => {
        // 1. Process Local Results
        const localTargets: AttackTarget[] = results
            .filter(h => h.enrichmentData?.latitude && h.enrichmentData?.longitude)
            .map(h => ({
                type: 'LOCAL',
                lat: h.enrichmentData!.latitude!,
                lon: h.enrichmentData!.longitude!,
                country: h.country,
                label: h.signatures[0]?.name || 'Suspicious Activity',
                subLabel: h.ip,
                risk: h.riskLevel
            }));
        
        // 2. Combine with Global Threats
        const combined = [...localTargets, ...globalThreats];
        
        // Shuffle
        attackQueueRef.current = combined.sort(() => Math.random() - 0.5);
    }, [results, globalThreats]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const selection = d3.select(canvas);
        
        // Clear previous event listeners to avoid stacking
        selection.on('.zoom', null).on('.drag', null);

        if (projectionType === 'ORTHO' && (!cinematic || allowInteraction)) {
            const drag = d3.drag()
                .on('start', () => { isDraggingRef.current = true; })
                .on('drag', (event: any) => {
                    const sensitivity = 0.25;
                    const [r1, r2] = transformRef.current.rotate;
                    transformRef.current.rotate = [r1 + event.dx * sensitivity, r2 - event.dy * sensitivity];
                })
                .on('end', () => { isDraggingRef.current = false; });

            const zoom = d3.zoom()
                .scaleExtent([0.5, 4])
                .on('zoom', (event: any) => {
                    transformRef.current.k = event.transform.k;
                });

            selection.call(drag as any).call(zoom as any);
            
            // Only reset if NOT allowing interaction (default cinematic behavior)
            if (!cinematic && !allowInteraction) {
                transformRef.current.x = 0;
                transformRef.current.y = 0;
            }

        } else if (!cinematic || allowInteraction) {
            const zoom = d3.zoom()
                .scaleExtent([1, 8])
                .on('zoom', (event: any) => {
                    transformRef.current.k = event.transform.k;
                    transformRef.current.x = event.transform.x;
                    transformRef.current.y = event.transform.y;
                });

            selection.call(zoom as any);
            if (!cinematic && !allowInteraction) {
                transformRef.current.rotate = [0, 0];
            }
        }
    }, [projectionType, cinematic, allowInteraction]);

    // Animation Loop
    useEffect(() => {
        if (!worldData || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        const render = (time: number) => {
            if (!containerRef.current) return;
            
            const width = containerRef.current.offsetWidth;
            const height = containerRef.current.offsetHeight;
            
            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
            }

            // --- PROJECTION SETUP ---
            let projection: any;
            let path: any;

            if (projectionType === 'ORTHO') {
                const scale = Math.min(width, height) / 2 * transformRef.current.k;
                projection = d3.geoOrthographic()
                    .translate([width / 2, height / 2])
                    .scale(scale)
                    .rotate(transformRef.current.rotate as [number, number, number?])
                    .clipAngle(90);
            } else {
                const baseScale = width / (2 * Math.PI);
                projection = d3.geoMercator()
                    .scale(baseScale * transformRef.current.k)
                    .translate([width / 2 + transformRef.current.x, height / 2 + transformRef.current.y]);
            }

            path = d3.geoPath(projection, ctx);

            if (projectionType === 'ORTHO' && !isPaused && !isDraggingRef.current) {
                transformRef.current.rotate[0] += cinematic ? 0.15 : 0.1; 
            }

            // --- DRAWING ---
            ctx.fillStyle = cinematic ? '#020617' : '#020617';
            ctx.fillRect(0, 0, width, height);

            // 1. Globe/Atmosphere
            if (projectionType === 'ORTHO') {
                const gradient = ctx.createRadialGradient(width/2, height/2, height/3, width/2, height/2, height/1.5);
                gradient.addColorStop(0, '#1c0505');
                gradient.addColorStop(1, '#020617');
                ctx.fillStyle = gradient;
                ctx.beginPath();
                path({ type: 'Sphere' } as any);
                ctx.fill();
                
                ctx.shadowBlur = cinematic ? 30 : 20;
                ctx.shadowColor = 'rgba(214, 40, 40, 0.2)';
                ctx.strokeStyle = 'rgba(214, 40, 40, 0.3)';
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.shadowBlur = 0;
            }

            // 2. Land
            ctx.beginPath();
            path(worldData);
            if (cinematic) {
                ctx.fillStyle = 'rgba(20, 5, 5, 0.9)'; 
                ctx.strokeStyle = 'rgba(214, 40, 40, 0.4)';
            } else {
                ctx.fillStyle = '#1a0505';
                ctx.strokeStyle = '#3a0f0f';
            }
            ctx.fill();
            ctx.lineWidth = 0.5;
            ctx.stroke();

            // 3. HQ Marker
            const hqProj = projection(hq);
            if (hqProj && (projectionType !== 'ORTHO' || isVisible(hq, projection as any))) {
                ctx.beginPath();
                ctx.arc(hqProj[0], hqProj[1], 3, 0, 2 * Math.PI);
                ctx.fillStyle = '#fff';
                ctx.fill();
                
                const pingSize = (Math.sin(time / 200) + 1) * 5 + 2;
                ctx.beginPath();
                ctx.arc(hqProj[0], hqProj[1], pingSize, 0, 2 * Math.PI);
                ctx.strokeStyle = `rgba(255, 255, 255, ${0.8 - (pingSize/15)})`;
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            // 4. Logic: Spawn Attacks
            if (!isPaused && attackQueueRef.current.length > 0 && Math.random() > (cinematic ? 0.90 : 0.93)) {
                const target = attackQueueRef.current[Math.floor(Math.random() * attackQueueRef.current.length)];
                
                let start: [number, number] | null = null;

                if (target.lat && target.lon) {
                    start = [target.lon, target.lat];
                } else if (target.country) {
                    const code = target.country.toUpperCase();
                    if (COUNTRY_COORDS[code]) {
                        const [lon, lat] = COUNTRY_COORDS[code];
                        start = [lon + (Math.random() - 0.5) * 5, lat + (Math.random() - 0.5) * 5];
                    }
                }

                if (!start) {
                    start = [(Math.random() * 360) - 180, (Math.random() * 120) - 60];
                }
                
                if (start) {
                    let color = '#3b82f6';
                    if (target.risk === 'CRITICAL') color = '#ef4444';
                    else if (target.risk === 'HIGH') color = '#f97316';
                    else if (target.risk === 'MEDIUM') color = '#eab308';

                    const jitterHq: [number, number] = [hq[0] + (Math.random() - 0.5), hq[1] + (Math.random() - 0.5)];

                    // Reduced Speed: Slower and smoother
                    // 0.002 is base speed (slow), random adds variation.
                    const speed = 0.002 + Math.random() * 0.003; 

                    projectilesRef.current.push({
                        id: Math.random(),
                        from: start,
                        to: jitterHq,
                        progress: 0,
                        speed,
                        color,
                        risk: target.risk,
                        signature: target.label
                    });

                    // Add Origin Pulse (Highlight Origin)
                    originPulsesRef.current.push({
                        id: Math.random(),
                        pos: start,
                        r: 2,
                        alpha: 1,
                        color,
                        label: target.country
                    });

                    if (!cinematic && Date.now() - lastLogTimeRef.current > 800) { 
                        lastLogTimeRef.current = Date.now();
                        const newLogItem: AttackLogItem = {
                            id: Math.random(),
                            timestamp: new Date().toLocaleTimeString(),
                            srcIp: target.subLabel || 'N/A',
                            srcCountry: target.country || 'XX',
                            srcFlag: target.country ? `https://flagcdn.com/w20/${target.country.toLowerCase()}.png` : undefined,
                            signature: target.label,
                            payload: target.type === 'LOCAL' ? 'Raw Payload' : target.type,
                            risk: target.risk,
                            source: target.type
                        };
                        setAttackLog(prev => [newLogItem, ...prev].slice(0, 20));
                    }
                }
            }

            // 5. Draw Origin Pulses (Highlight)
            for (let i = originPulsesRef.current.length - 1; i >= 0; i--) {
                const p = originPulsesRef.current[i];
                if (!isPaused) {
                    p.r += 0.2;
                    p.alpha -= 0.01;
                }
                if (p.alpha <= 0) {
                    originPulsesRef.current.splice(i, 1);
                    continue;
                }
                if (projectionType === 'ORTHO' && !isVisible(p.pos, projection as any)) continue;

                const pt = projection(p.pos);
                if (pt) {
                    ctx.beginPath();
                    ctx.arc(pt[0], pt[1], p.r, 0, 2 * Math.PI);
                    ctx.strokeStyle = p.color;
                    ctx.globalAlpha = p.alpha * 0.7;
                    ctx.stroke();
                    
                    // Core dot
                    ctx.beginPath();
                    ctx.arc(pt[0], pt[1], 2, 0, 2 * Math.PI);
                    ctx.fillStyle = p.color;
                    ctx.globalAlpha = p.alpha;
                    ctx.fill();
                    ctx.globalAlpha = 1;
                }
            }

            // 6. Draw Projectiles
            ctx.lineCap = 'round';
            for (let i = projectilesRef.current.length - 1; i >= 0; i--) {
                const p = projectilesRef.current[i];
                if (!isPaused) p.progress += p.speed;

                if (p.progress >= 1) {
                    ripplesRef.current.push({
                        id: Math.random(),
                        pos: p.to,
                        r: 1,
                        maxR: p.risk === 'CRITICAL' ? 30 : 15,
                        alpha: 1,
                        color: p.color
                    });
                    
                    const labelPos = projection(p.to);
                    if (labelPos) {
                        labelsRef.current.forEach(l => {
                            if (Math.abs(l.x - labelPos[0]) < 50) {
                                if (l.y > labelPos[1] - 250 && l.y < labelPos[1] + 20) {
                                    l.y -= 24; 
                                    l.life = Math.min(l.life + 10, l.maxLife); 
                                }
                            }
                        });

                        labelsRef.current.push({
                            id: Math.random(),
                            x: labelPos[0],
                            y: labelPos[1],
                            text: p.signature || 'Attack',
                            life: 150, 
                            maxLife: 150,
                            color: p.color
                        });
                    }

                    projectilesRef.current.splice(i, 1);
                    setStats(prev => ({ ...prev, total: prev.total + 1 }));
                    continue;
                }

                const interpolate = d3.geoInterpolate(p.from, p.to);
                const currentPos = interpolate(p.progress);
                const trailPos = interpolate(Math.max(0, p.progress - 0.25)); // Longer trail for slower speed

                if (projectionType === 'ORTHO' && !isVisible(currentPos, projection as any)) continue;

                const p1 = projection(currentPos);
                const p2 = projection(trailPos);

                if (p1 && p2) {
                    const grad = ctx.createLinearGradient(p2[0], p2[1], p1[0], p1[1]);
                    grad.addColorStop(0, 'rgba(0,0,0,0)');
                    grad.addColorStop(1, p.color);
                    
                    ctx.beginPath();
                    ctx.moveTo(p2[0], p2[1]);
                    ctx.lineTo(p1[0], p1[1]);
                    ctx.strokeStyle = grad;
                    ctx.lineWidth = p.risk === 'CRITICAL' ? 3 : 1.5;
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.arc(p1[0], p1[1], p.risk === 'CRITICAL' ? 2 : 1, 0, 2 * Math.PI);
                    ctx.fillStyle = '#fff';
                    ctx.fill();
                }
            }

            // 7. Draw Impact Ripples
            for (let i = ripplesRef.current.length - 1; i >= 0; i--) {
                const r = ripplesRef.current[i];
                if (!isPaused) {
                    r.r += 0.5;
                    r.alpha -= 0.02;
                }

                if (r.alpha <= 0) {
                    ripplesRef.current.splice(i, 1);
                    continue;
                }

                if (projectionType === 'ORTHO' && !isVisible(r.pos, projection as any)) continue;

                const center = projection(r.pos);
                if (center) {
                    ctx.beginPath();
                    ctx.arc(center[0], center[1], r.r, 0, 2 * Math.PI);
                    ctx.strokeStyle = r.color;
                    ctx.globalAlpha = r.alpha;
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                }
            }

            // 8. Draw Labels
            if (cinematic || labelsRef.current.length > 0) {
                for (let i = labelsRef.current.length - 1; i >= 0; i--) {
                    const l = labelsRef.current[i];
                    if (!isPaused) {
                        l.life--;
                        l.y -= 0.5;
                    }
                    if (l.life <= 0) { labelsRef.current.splice(i, 1); continue; }
                    
                    ctx.font = 'bold 12px monospace';
                    ctx.fillStyle = l.color;
                    ctx.globalAlpha = Math.min(1, l.life / 20);
                    ctx.fillText(l.text, l.x + 15, l.y);
                    ctx.globalAlpha = 1;
                    
                    ctx.beginPath();
                    ctx.moveTo(l.x, l.y + 10);
                    ctx.lineTo(l.x + 12, l.y - 5);
                    ctx.strokeStyle = l.color;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }

            if (!cinematic) {
                setStats(prev => ({ ...prev, active: projectilesRef.current.length, peak: Math.max(prev.peak, projectilesRef.current.length) }));
            }
            
            reqRef.current = requestAnimationFrame(render);
        };

        reqRef.current = requestAnimationFrame(render);

        return () => cancelAnimationFrame(reqRef.current);
    }, [worldData, isPaused, projectionType, hq, cinematic, allowInteraction]);

    function isVisible(coords: [number, number], projection: any) {
        const r = projection.rotate();
        const center = [-r[0], -r[1]];
        const d = d3.geoDistance(coords, center as [number, number]);
        return d < Math.PI / 2;
    }

    const toggleFullscreen = () => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().catch(err => console.log(err));
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    const handleZoom = (delta: number) => {
        transformRef.current.k = Math.max(0.5, Math.min(8, transformRef.current.k + delta));
    };

    return (
        <div ref={containerRef} className="w-full h-full bg-[#111] relative overflow-hidden flex flex-col">
            {!cinematic && (
                <div className="absolute top-4 left-4 z-20 flex flex-col gap-4 pointer-events-none">
                    <div className="bg-[#111]/80 backdrop-blur-md border border-red-500/30 p-4 rounded-lg pointer-events-auto shadow-[0_0_20px_rgba(14,165,233,0.1)]">
                        <div className="flex items-center gap-2 mb-3 border-b border-[#222] pb-2">
                            <Target className="text-red-500 animate-pulse" size={20}/>
                            <div>
                                <h2 className="text-white font-cyber font-bold text-lg leading-none">THREAT MAP</h2>
                                <span className="text-[10px] text-[#888] font-mono">LIVE MONITORING</span>
                            </div>
                        </div>
                        <div className="space-y-2 font-mono text-xs">
                            <div className="flex justify-between gap-8">
                                <span className="text-[#AAA]">ACTIVE THREATS</span>
                                <span className="text-red-400 font-bold">{stats.active}</span>
                            </div>
                            <div className="flex justify-between gap-8">
                                <span className="text-[#AAA]">TOTAL IMPACTS</span>
                                <span className="text-white font-bold">{stats.total}</span>
                            </div>
                            <div className="flex justify-between gap-8">
                                <span className="text-[#AAA]">PEAK LOAD</span>
                                <span className="text-white font-bold">{stats.peak}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#111]/80 backdrop-blur-md border border-[#222] p-2 rounded-lg pointer-events-auto flex flex-col gap-2">
                        <button onClick={() => setProjectionType(p => p === 'ORTHO' ? 'MERCATOR' : 'ORTHO')} className="flex items-center gap-2 px-3 py-2 rounded hover:bg-white/10 text-xs font-bold text-neutral-300 transition-colors">
                            {projectionType === 'ORTHO' ? <MapIcon size={14}/> : <Globe size={14}/>} {projectionType === 'ORTHO' ? '2D MAP' : '3D GLOBE'}
                        </button>
                        <div className="h-px bg-[#151515] mx-2"></div>
                        <button onClick={() => handleZoom(0.5)} className="flex items-center gap-2 px-3 py-2 rounded hover:bg-white/10 text-xs font-bold text-neutral-300 transition-colors">
                            <Plus size={14}/> ZOOM IN
                        </button>
                        <button onClick={() => handleZoom(-0.5)} className="flex items-center gap-2 px-3 py-2 rounded hover:bg-white/10 text-xs font-bold text-neutral-300 transition-colors">
                            <Minus size={14}/> ZOOM OUT
                        </button>
                        <div className="h-px bg-[#151515] mx-2"></div>
                        <button onClick={() => setIsPaused(!isPaused)} className="flex items-center gap-2 px-3 py-2 rounded hover:bg-white/10 text-xs font-bold text-neutral-300 transition-colors">
                            {isPaused ? <Play size={14}/> : <Pause size={14}/>} {isPaused ? 'RESUME' : 'PAUSE'}
                        </button>
                        <button onClick={toggleFullscreen} className="flex items-center gap-2 px-3 py-2 rounded hover:bg-white/10 text-xs font-bold text-neutral-300 transition-colors">
                            {isFullscreen ? <Minimize2 size={14}/> : <Maximize2 size={14}/>} FULLSCREEN
                        </button>
                    </div>
                </div>
            )}

            {!cinematic && (
                <div className="absolute top-4 bottom-4 right-4 z-20 w-80 bg-[#111]/80 backdrop-blur-md border border-[#222] rounded-lg pointer-events-auto flex flex-col shadow-2xl overflow-hidden">
                    <div className="p-3 border-b border-[#222] bg-[#111] flex items-center justify-between">
                        <div className="flex items-center gap-2 text-white font-bold text-xs font-cyber">
                            <Terminal size={14} className="text-white"/> INTERCEPT LOG
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                            <span className="text-[10px] text-[#888] font-mono">LIVE</span>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2 relative">
                        {attackLog.length === 0 ? (
                            <div className="text-center text-neutral-600 text-xs font-mono mt-10 flex flex-col items-center">
                                <Activity className="animate-spin mb-2 opacity-20" size={24}/>
                                Waiting for traffic...
                            </div>
                        ) : (
                            attackLog.map(log => (
                                <div key={log.id} className="bg-[#111] border border-[#222] hover:border-neutral-600 p-2 rounded transition-all group animate-fade-in">
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex items-center gap-2">
                                            {log.srcFlag ? <img src={log.srcFlag} alt="flag" className="w-4 h-3 rounded-sm"/> : <Globe size={12} className="text-[#888]"/>}
                                            <span className="text-[10px] text-neutral-300 font-bold uppercase">{log.srcCountry}</span>
                                        </div>
                                        <span className="text-[10px] text-[#888] font-mono">{log.timestamp}</span>
                                    </div>
                                    
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-mono text-red-400 truncate max-w-[120px]" title={log.srcIp}>{log.srcIp}</span>
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${log.risk === 'CRITICAL' ? 'bg-red-900/30 text-red-400 border border-red-500/30' : log.risk === 'HIGH' ? 'bg-neutral-900/30 text-white' : 'bg-[#151515] text-[#AAA]'}`}>
                                            {log.risk}
                                        </span>
                                    </div>

                                    <div className="text-[11px] font-bold text-neutral-200 truncate mb-1" title={log.signature}>
                                        {log.signature}
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="bg-[#111]/50 rounded p-1.5 border border-[#222] text-[10px] font-mono text-[#AAA] break-all line-clamp-2 w-3/4" title={log.payload}>
                                            <span className="text-neutral-600 mr-1">$</span>{log.payload}
                                        </div>
                                        <span className="text-[8px] bg-[#151515] px-1 rounded text-[#888] uppercase">{log.source}</span>
                                    </div>
                                </div>
                            ))
                        )}
                        <div className="h-4"></div>
                    </div>
                    
                    <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none"></div>
                </div>
            )}

            {!cinematic && (
                <div className="absolute bottom-6 left-6 z-20 bg-[#111]/60 backdrop-blur-md border border-[#222] p-3 rounded-lg pointer-events-none">
                    <h3 className="text-[10px] text-[#888] font-bold uppercase mb-2">Risk Classification</h3>
                    <div className="space-y-1.5 text-[10px] font-mono">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]"></span>
                            <span className="text-red-400">CRITICAL</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-neutral-500"></span>
                            <span className="text-white">HIGH</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-neutral-500"></span>
                            <span className="text-white">MEDIUM</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#151515]"></span>
                            <span className="text-red-400">LOW/INFO</span>
                        </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-[#333]/50 text-[9px] text-[#888] flex items-center gap-1">
                        <MousePointer2 size={10}/> <span className="opacity-70">DRAG TO ROTATE/PAN</span>
                    </div>
                </div>
            )}

            {cinematic && allowInteraction && (
                 <div className="absolute bottom-6 right-6 z-30 flex gap-2 pointer-events-auto">
                     <button onClick={() => setIsPaused(!isPaused)} className="p-2 bg-[#111]/40 hover:bg-[#111]/80 text-[#AAA] hover:text-white rounded border border-[#333]/50 backdrop-blur transition-all">
                         {isPaused ? <Play size={16}/> : <Pause size={16}/>}
                     </button>
                     <button onClick={() => setProjectionType(p => p === 'ORTHO' ? 'MERCATOR' : 'ORTHO')} className="p-2 bg-[#111]/40 hover:bg-[#111]/80 text-[#AAA] hover:text-white rounded border border-[#333]/50 backdrop-blur transition-all">
                         {projectionType === 'ORTHO' ? <Globe size={16}/> : <MapIcon size={16}/>}
                     </button>
                 </div>
            )}

            <canvas ref={canvasRef} className="w-full h-full cursor-move touch-none" />
        </div>
    );
};

