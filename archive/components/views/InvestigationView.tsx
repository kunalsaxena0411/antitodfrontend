
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AnalyzedHost, GraphNode, GraphLink, GraphData } from '../../types';
import { Search, Focus, Trash2, Globe, Network, Server, Bug, Play, Pause, X, Loader2, ExternalLink, AlignJustify, SlidersHorizontal, Workflow, Save, DownloadCloud, Layers, EyeOff, FileJson, Upload, FileUp, ShieldAlert, MapPin, Activity, Info, ChevronRight, ChevronLeft, Plus, Minus, Filter } from 'lucide-react';
import { convertStixToGraph } from '../../services/mitre';
import { parseQueryString, getSearchContext, filterHost } from '../../services/search';
import { MITRE_ORDER } from '../../constants';

interface InvestigationViewProps {
    results: AnalyzedHost[];
}

// --- Node Configuration ---
const INVESTIGATION_SEARCH_KEYS = [
    { key: 'type:', label: 'Node Type', example: 'MALWARE' },
    { key: 'label:', label: 'Label Name', example: 'Log4j' },
    { key: 'id:', label: 'Node ID', example: '192.168.' },
    { key: 'risk:', label: 'Risk Level (IPs)', example: 'CRITICAL' },
    { key: 'country:', label: 'Country', example: 'China' },
    { key: 'asn:', label: 'ASN', example: 'DigitalOcean' },
    { key: 'rel:', label: 'Relationship', example: 'uses' },
];

// --- Helper Functions ---
const getNodeTactic = (node: GraphNode) => {
    if (node.data?.tactic) return node.data.tactic;
    if (node.data?.kill_chain_phases && Array.isArray(node.data.kill_chain_phases)) {
        const phase = node.data.kill_chain_phases.find((p: any) => p.kill_chain_name === 'mitre-attack');
        if (phase) return phase.phase_name.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
        return node.data.kill_chain_phases[0]?.phase_name.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
    }
    return null;
};

// --- Physics Engine Hook ---
const useForceGraph = (initialNodes: GraphNode[], initialLinks: GraphLink[], width: number, height: number, isPaused: boolean, layoutMode: 'FORCE' | 'CHAIN') => {
    const [nodes, setNodes] = useState<GraphNode[]>([]);
    const [links, setLinks] = useState<GraphLink[]>([]);
    
    // Increased repulsion to prevent clumping
    const REPULSION = 6000; 
    const SPRING_LENGTH = 180;
    const DAMPING = 0.80;
    const CENTER_PULL = 0.008; 
    const COLLISION_RADIUS = 150; // Stronger collision radius

    const requestRef = useRef<number>(0);
    
    useEffect(() => {
        setNodes(currentNodes => {
            const nodeMap = new Map<string, GraphNode>(currentNodes.map((n): [string, GraphNode] => [n.id, n]));
            return initialNodes.map(n => {
                const existing = nodeMap.get(n.id);
                if (existing) {
                    return { ...n, x: existing.x, y: existing.y, vx: existing.vx || 0, vy: existing.vy || 0, fx: existing.fx, fy: existing.fy, data: n.data };
                }
                return { ...n, x: n.x !== undefined ? n.x : width / 2 + (Math.random() - 0.5) * 100, y: n.y !== undefined ? n.y : height / 2 + (Math.random() - 0.5) * 100, vx: n.vx || 0, vy: n.vy || 0 };
            });
        });
        setLinks(initialLinks);
    }, [initialNodes, initialLinks, width, height]); 

    const tick = () => {
        if (isPaused && layoutMode === 'FORCE') return;

        setNodes(prevNodes => {
            if (layoutMode === 'CHAIN') {
                return prevNodes.map(n => ({ ...n, x: n.fx ?? n.x, y: n.fy ?? n.y, vx: 0, vy: 0 }));
            }

            const nextNodes = prevNodes.map(n => ({ ...n, vx: n.vx || 0, vy: n.vy || 0 }));
            const len = nextNodes.length;

            // Repulsion and Collision
            for (let i = 0; i < len; i++) {
                for (let j = i + 1; j < len; j++) {
                    const n1 = nextNodes[i];
                    const n2 = nextNodes[j];
                    const dx = n1.x! - n2.x!;
                    const dy = n1.y! - n2.y!;
                    let distSq = dx * dx + dy * dy;
                    if (distSq === 0) distSq = 0.1;
                    
                    const dist = Math.sqrt(distSq);
                    
                    // 1. General Repulsion
                    const force = REPULSION / (distSq + 100); 
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;

                    if (n1.fx === undefined) { n1.vx! += fx; n1.vy! += fy; }
                    if (n2.fx === undefined) { n2.vx! -= fx; n2.vy! -= fy; }

                    // 2. Hard Collision (Anti-Overlap)
                    if (dist < COLLISION_RADIUS) {
                        const push = (COLLISION_RADIUS - dist) * 0.5; // Pushback
                        const cx = (dx / dist) * push;
                        const cy = (dy / dist) * push;
                        
                        if (n1.fx === undefined) { n1.vx! += cx; n1.vy! += cy; }
                        if (n2.fx === undefined) { n2.vx! -= cx; n2.vy! -= cy; }
                    }
                }
            }

            // Spring Forces
            links.forEach(link => {
                const sId = typeof link.source === 'object' ? (link.source as any).id : link.source;
                const tId = typeof link.target === 'object' ? (link.target as any).id : link.target;
                const sNode = nextNodes.find(n => n.id === sId);
                const tNode = nextNodes.find(n => n.id === tId);

                if (sNode && tNode) {
                    const dx = tNode.x! - sNode.x!;
                    const dy = tNode.y! - sNode.y!;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    const force = (dist - SPRING_LENGTH) * 0.05; 
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;

                    if (sNode.fx === undefined) { sNode.vx! += fx; sNode.vy! += fy; }
                    if (tNode.fx === undefined) { tNode.vx! -= fx; tNode.vy! -= fy; }
                }
            });

            // Center Pull and Integration
            return nextNodes.map(n => {
                // If dragged or fixed, maintain position
                if (n.fx !== undefined && n.fx !== null) return { ...n, x: n.fx, y: n.fy ?? n.y, vx: 0, vy: 0 };
                
                n.vx! += (width / 2 - n.x!) * CENTER_PULL;
                n.vy! += (height / 2 - n.y!) * CENTER_PULL;
                
                const vMag = Math.sqrt(n.vx! * n.vx! + n.vy! * n.vy!);
                const limit = 10; 
                if (vMag > limit) { n.vx = (n.vx! / vMag) * limit; n.vy = (n.vy! / vMag) * limit; }
                
                return { ...n, vx: n.vx! * DAMPING, vy: n.vy! * DAMPING, x: n.x! + n.vx!, y: n.y! + n.vy! };
            });
        });
        
        requestRef.current = requestAnimationFrame(tick);
    };

    useEffect(() => {
        if (!isPaused || layoutMode === 'CHAIN') {
            requestRef.current = requestAnimationFrame(tick);
        }
        return () => cancelAnimationFrame(requestRef.current!);
    }, [isPaused, links, nodes.length, layoutMode]);

    return { nodes, setNodes, links };
};

export const InvestigationView: React.FC<InvestigationViewProps> = ({ results = [] }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    
    const [dimensions, setDimensions] = useState({ w: 1000, h: 800 });
    const [isPhysicsPaused, setIsPhysicsPaused] = useState(false);
    const [layoutMode, setLayoutMode] = useState<'FORCE' | 'CHAIN'>('FORCE');

    const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
    const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);
    const [tooltipData, setTooltipData] = useState<{ x: number, y: number, node: GraphNode } | null>(null);
    
    const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
    const [hiddenNodeIds, setHiddenNodeIds] = useState<Set<string>>(new Set());
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const dragNodeRef = useRef<string | null>(null);
    
    const [searchQuery, setSearchQuery] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [viewMode, setViewMode] = useState<'INTERNAL' | 'STIX'>('INTERNAL');
    const [activeNodes, setActiveNodes] = useState<GraphNode[]>([]);
    const [activeLinks, setActiveLinks] = useState<GraphLink[]>([]);
    const [activeLinkTypes, setActiveLinkTypes] = useState<Set<string>>(new Set(['ALL']));
    const [activeTacticFilter, setActiveTacticFilter] = useState<string>('ALL');

    useEffect(() => {
        const updateDims = () => {
            if (containerRef.current) {
                setDimensions({ w: containerRef.current.offsetWidth, h: containerRef.current.offsetHeight });
            }
        };
        window.addEventListener('resize', updateDims);
        updateDims();
        return () => window.removeEventListener('resize', updateDims);
    }, []);

    useEffect(() => {
        if (selectedNode) setIsPanelCollapsed(false);
    }, [selectedNode]);

    const availableTactics = useMemo(() => {
        const tactics = new Set<string>();
        activeNodes.forEach(n => {
            const t = getNodeTactic(n);
            if (t) tactics.add(t);
        });
        return Array.from(tactics).sort();
    }, [activeNodes]);

    const buildInternalGraph = (hosts: AnalyzedHost[]) => {
        const nodes: GraphNode[] = [];
        const links: GraphLink[] = [];
        const nodeSet = new Set<string>();

        nodes.push({ id: 'ROOT', label: 'Threat Intel', type: 'ROOT', val: 25, color: '#fff', x: dimensions.w/2, y: dimensions.h/2 });
        nodeSet.add('ROOT');

        hosts.forEach(host => {
            if (!nodeSet.has(host.ip)) {
                nodes.push({
                    id: host.ip,
                    label: host.ip,
                    type: host.riskLevel === 'CRITICAL' ? 'THREAT' : 'IP',
                    val: host.totalScore > 50 ? 15 : 10,
                    color: host.riskLevel === 'CRITICAL' ? '#ef4444' : '#3b82f6',
                    data: host
                });
                nodeSet.add(host.ip);
                links.push({ source: 'ROOT', target: host.ip, color: '#334155', label: 'analyzed' });
            }

            host.signatures.forEach(sig => {
                const sigId = `SIG-${sig.name}`;
                if (!nodeSet.has(sigId)) {
                    nodes.push({
                        id: sigId,
                        label: sig.name,
                        type: 'MALWARE',
                        val: 12,
                        color: '#f59e0b',
                        data: { tactic: sig.mitreTactic, description: sig.description } 
                    });
                    nodeSet.add(sigId);
                }
                links.push({ source: host.ip, target: sigId, color: '#ef4444', value: 2, label: 'infected_with' });
            });
        });
        return { nodes, links };
    };

    const handleInternalLogs = () => {
        const topResults = results
            .sort((a, b) => b.totalScore - a.totalScore)
            .slice(0, 5);
            
        const { nodes, links } = buildInternalGraph(topResults);
        setActiveNodes(nodes);
        setActiveLinks(links);
        setViewMode('INTERNAL');
        setSearchQuery('');
        setHiddenNodeIds(new Set());
        setActiveLinkTypes(new Set(['ALL']));
        setLayoutMode('FORCE');
    };

    useEffect(() => {
        if (viewMode === 'INTERNAL' && results.length > 0 && activeNodes.length === 0) {
             handleInternalLogs();
        }
    }, [results]);

    const handleStixUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const json = JSON.parse(ev.target?.result as string);
                    const { nodes, links } = convertStixToGraph(json);
                    
                    if (nodes.length === 0) {
                        alert("No valid STIX objects found in file. Ensure JSON is a valid STIX 2.1 bundle or list of objects.");
                        return;
                    }

                    setActiveNodes(nodes);
                    setActiveLinks(links);
                    setHiddenNodeIds(new Set());
                    setSearchQuery('');
                    setViewMode('STIX'); 
                    setLayoutMode('FORCE');
                } catch (err) {
                    console.error("Failed to parse STIX", err);
                    alert("Failed to parse STIX JSON. Invalid format.");
                }
            };
            reader.readAsText(file);
        }
    };

    const handleSaveSession = () => {
        const sessionData = { timestamp: Date.now(), nodes: nodes, links: activeLinks, viewMode, transform, layoutMode };
        const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `investigation-session-${Date.now()}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    };

    const handleLoadSession = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const session = JSON.parse(ev.target?.result as string);
                    if (session.nodes && session.links) {
                        setActiveNodes(session.nodes);
                        setActiveLinks(session.links);
                        if (session.viewMode) setViewMode(session.viewMode);
                        if (session.transform) setTransform(session.transform);
                        if (session.layoutMode) setLayoutMode(session.layoutMode);
                    }
                } catch (err) { console.error("Failed to load session", err); }
            };
            reader.readAsText(file);
        }
    };

    const handleClearGraph = () => {
        setActiveNodes([]);
        setActiveLinks([]);
        setSearchQuery('');
        setHiddenNodeIds(new Set());
    };

    const handleFocusNode = (node: GraphNode) => {
        if (!containerRef.current || !node.x || !node.y) return;
        
        const width = containerRef.current.offsetWidth;
        const height = containerRef.current.offsetHeight;
        
        // Center the node
        const newK = 1.5; // Zoom level
        const newX = width / 2 - node.x * newK;
        const newY = height / 2 - node.y * newK;
        
        setTransform({ x: newX, y: newY, k: newK });
    };

    const addHostsToGraph = (hosts: AnalyzedHost[]) => {
        setActiveNodes(prev => {
            const newNodes = [...prev];
            const existingIds = new Set(newNodes.map(n => n.id));
            let added = false;

            hosts.forEach(host => {
                if (!existingIds.has(host.ip)) {
                    newNodes.push({
                        id: host.ip,
                        label: host.ip,
                        type: host.riskLevel === 'CRITICAL' ? 'THREAT' : 'IP',
                        val: host.totalScore > 50 ? 15 : 10,
                        color: host.riskLevel === 'CRITICAL' ? '#ef4444' : '#3b82f6',
                        data: host,
                        x: dimensions.w / 2 + (Math.random() - 0.5) * 50,
                        y: dimensions.h / 2 + (Math.random() - 0.5) * 50
                    });
                    existingIds.add(host.ip);
                    added = true;
                }
            });
            return added ? newNodes : prev;
        });
    };

    const handleAddGroupToGraph = (type: 'COUNTRY' | 'MALWARE' | 'ASN', value: string) => {
        let hostsToAdd: AnalyzedHost[] = [];
        if (type === 'COUNTRY') {
            hostsToAdd = results.filter(h => h.country === value);
        } else if (type === 'MALWARE') {
            hostsToAdd = results.filter(h => h.signatures.some(s => s.name === value));
        } else if (type === 'ASN') {
            hostsToAdd = results.filter(h => h.enrichmentData?.asn?.name === value);
        }
        // Limit to top 10 to avoid explosion
        addHostsToGraph(hostsToAdd.slice(0, 10));
    };

    const suggestions = useMemo(() => {
        const ctx = getSearchContext(searchQuery);
        const list: any[] = [];

        if (ctx.type === 'KEY') {
            INVESTIGATION_SEARCH_KEYS.filter(k => k.key.startsWith(ctx.filter || '')).forEach(k => {
                list.push({ ...k, type: 'FILTER_KEY' });
            });
        }

        if (ctx.type === 'VALUE') {
             const f = ctx.filter || '';
             let values: string[] = [];
             if (ctx.key === 'country') values = Array.from(new Set(results.map(h => h.country).filter(Boolean) as string[]));
             else if (ctx.key === 'type') values = Array.from(new Set(activeNodes.map(n => n.type)));
             else if (ctx.key === 'asn') values = Array.from(new Set(results.map(h => h.enrichmentData?.asn?.name).filter(Boolean) as string[]));
             
             values.filter(v => v.toLowerCase().includes(f.toLowerCase())).slice(0, 10).forEach(v => {
                 list.push({ key: `${ctx.key}:${v.includes(' ') ? `"${v}"` : v}`, label: v, type: 'FILTER_VALUE' });
             });
        }

        const lower = (ctx.filter || searchQuery).toLowerCase();
        if ((ctx.type === 'KEY' || ctx.type === 'FREE') && lower.length > 1) {
             const matchingHosts = results.filter(h => 
                (h.ip.includes(lower) || (h.dnsHostname && h.dnsHostname.toLowerCase().includes(lower)))
            );

            matchingHosts.slice(0, 3).forEach(m => {
                if (!activeNodes.some(n => n.id === m.ip)) {
                    list.push({
                        key: m.ip,
                        label: m.ip,
                        subLabel: m.country,
                        example: 'Add Host',
                        type: 'ADD_NODE',
                        data: m
                    });
                }
            });

            const countries = Array.from(new Set(results.map(h => h.country).filter(Boolean)));
            countries.filter(c => c.toLowerCase().includes(lower)).forEach(c => {
                 list.push({ key: `country:${c}`, label: `Add all from ${c}`, type: 'ADD_GROUP', groupType: 'COUNTRY', value: c });
            });
        }

        return list;
    }, [searchQuery, activeNodes, results]);

    const handleSuggestionClick = (item: any) => {
        if (item.type === 'ADD_NODE') {
            addHostsToGraph([item.data]);
            setSearchQuery(''); 
            setShowSuggestions(false);
        } else if (item.type === 'ADD_GROUP') {
            handleAddGroupToGraph(item.groupType, item.value);
            setSearchQuery('');
            setShowSuggestions(false);
        } else {
            const current = searchQuery;
            const ctx = getSearchContext(searchQuery);
            let newQuery = '';

            if (ctx.type === 'VALUE' && ctx.key) {
                const keyStart = current.lastIndexOf(ctx.key + ':');
                if (keyStart !== -1) {
                    const prefix = current.substring(0, keyStart);
                    newQuery = prefix + item.key + ' ';
                }
            } else {
                const tokens = current.trimEnd().split(' ');
                tokens.pop(); 
                const prefix = tokens.join(' ');
                newQuery = (prefix ? prefix + ' ' : '') + item.key;
            }
            setSearchQuery(newQuery);
            searchInputRef.current?.focus();
            setShowSuggestions(false);
        }
    };
    
    const handleSearchKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            if (suggestions.length > 0 && showSuggestions) {
                handleSuggestionClick(suggestions[0]);
            } else if (searchQuery.trim()) {
                const { filters, freeText } = parseQueryString(searchQuery);
                const mappedFilters = filters.map(f => f.key === 'id' ? { ...f, key: 'ip' } : f);
                const matches = results.filter(h => filterHost(h, mappedFilters, freeText));

                if (matches.length > 0) {
                    addHostsToGraph(matches.slice(0, 10));
                    setSearchQuery('');
                    setShowSuggestions(false);
                }
            }
        }
    };

    const handleWheel = (e: React.WheelEvent) => {
        const scaleChange = -e.deltaY * 0.001;
        const newScale = Math.min(Math.max(0.1, transform.k + scaleChange), 4);
        setTransform(prev => ({ ...prev, k: newScale }));
    };
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 0) {
            setIsPanning(true);
            setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
        }
    };
    const handleMouseMove = (e: React.MouseEvent) => {
        if (dragNodeRef.current) {
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
                const x = (e.clientX - rect.left - transform.x) / transform.k;
                const y = (e.clientY - rect.top - transform.y) / transform.k;
                setNodes(prev => prev.map(n => n.id === dragNodeRef.current ? { ...n, fx: x, fy: y } : n));
                const node = nodes.find(n => n.id === dragNodeRef.current);
                if (node) { setTooltipData({ x: e.clientX, y: e.clientY, node }); }
            }
        } else if (isPanning) {
            setTransform(prev => ({ ...prev, x: e.clientX - panStart.x, y: e.clientY - panStart.y }));
        } else {
            if (hoveredNode) {
                const node = nodes.find(n => n.id === hoveredNode);
                if (node) {
                    const rect = containerRef.current?.getBoundingClientRect();
                    if (rect) {
                        const screenX = (node.x! * transform.k) + transform.x + rect.left;
                        const screenY = (node.y! * transform.k) + transform.y + rect.top;
                        setTooltipData({ x: screenX, y: screenY, node });
                    }
                }
            } else {
                setTooltipData(null);
            }
        }
    };
    const handleMouseUp = () => {
        if (dragNodeRef.current) {
             dragNodeRef.current = null;
        }
        setIsPanning(false);
    };

    const visibleNodes = useMemo(() => {
        let filtered = activeNodes.filter(n => !hiddenNodeIds.has(n.id));
        
        if (activeTacticFilter !== 'ALL') {
            filtered = filtered.filter(n => {
                // Always keep Context nodes (Root, IP, Threat) visible for structure
                if (n.type === 'ROOT' || n.type === 'IP' || n.type === 'THREAT') return true;
                const t = getNodeTactic(n);
                return t === activeTacticFilter;
            });
        }

        if (searchQuery) {
            const { filters, freeText } = parseQueryString(searchQuery);
            filtered = filtered.filter(node => {
                if (freeText && !(node.label.toLowerCase().includes(freeText) || node.id.toLowerCase().includes(freeText))) return false;
                for (const f of filters) {
                    const val = f.value.toLowerCase();
                    if (f.key === 'type' && !node.type.toLowerCase().includes(val)) return false;
                    if (f.key === 'country' && !node.data?.country?.toLowerCase().includes(val)) return false;
                    if (f.key === 'asn' && !node.data?.enrichmentData?.asn?.name?.toLowerCase().includes(val)) return false;
                    if (f.key === 'risk' && !node.data?.riskLevel?.toLowerCase().includes(val)) return false;
                    if (f.key === 'rel') { if (!activeLinks.some(l => (l.source === node.id || l.target === node.id || (l.source as any).id === node.id || (l.target as any).id === node.id) && l.label?.toLowerCase().includes(val))) return false; }
                }
                return true;
            });
        }
        return filtered;
    }, [activeNodes, hiddenNodeIds, searchQuery, activeLinks, activeTacticFilter]);

    const visibleLinks = useMemo(() => {
        const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
        return activeLinks.filter(l => {
            const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
            const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
            if (!visibleNodeIds.has(sId) || !visibleNodeIds.has(tId)) return false;
            if (activeLinkTypes.has('ALL')) return true;
            return l.label ? activeLinkTypes.has(l.label) : false;
        });
    }, [activeLinks, visibleNodes, activeLinkTypes]);

    const connectedNodeIds = useMemo(() => {
        const set = new Set<string>();
        if (hoveredNode || selectedNode) {
            const root = hoveredNode || selectedNode?.id;
            if (root) set.add(root);
            visibleLinks.forEach(l => {
                const s = typeof l.source === 'object' ? (l.source as any).id : l.source;
                const t = typeof l.target === 'object' ? (l.target as any).id : l.target;
                if (s === root) set.add(t);
                if (t === root) set.add(s);
            });
        }
        return set;
    }, [hoveredNode, selectedNode, visibleLinks]);

    const { nodes, setNodes, links } = useForceGraph(visibleNodes, visibleLinks, dimensions.w, dimensions.h, isPhysicsPaused, layoutMode);

    useEffect(() => {
        if (layoutMode === 'CHAIN') {
            setNodes(current => {
                const COLUMN_WIDTH = 250;
                const ROW_HEIGHT = 80;
                const tacticBuckets: Record<string, GraphNode[]> = {};
                const hostBucket: GraphNode[] = [];
                const otherBucket: GraphNode[] = [];
                MITRE_ORDER.forEach(t => tacticBuckets[t] = []);
                current.forEach(node => {
                    if (node.type === 'IP' || node.type === 'THREAT') { hostBucket.push(node); } 
                    else {
                        const tactic = getNodeTactic(node);
                        if (tactic) {
                            const match = MITRE_ORDER.find(mo => tactic.toLowerCase().includes(mo.toLowerCase()));
                            if (match) tacticBuckets[match].push(node);
                            else otherBucket.push(node);
                        } else { otherBucket.push(node); }
                    }
                });
                const centerX = dimensions.w / 2;
                const centerY = dimensions.h / 2;
                const totalCols = MITRE_ORDER.length + 2;
                const totalWidth = totalCols * COLUMN_WIDTH;
                const startX = centerX - (totalWidth / 2);
                const getStartY = (count: number) => centerY - ((count * ROW_HEIGHT) / 2);

                return current.map(n => {
                    let fx = n.x;
                    let fy = n.y;
                    if (hostBucket.includes(n)) {
                        const idx = hostBucket.indexOf(n);
                        fx = startX;
                        fy = getStartY(hostBucket.length) + (idx * ROW_HEIGHT);
                    } else if (otherBucket.includes(n)) {
                        const idx = otherBucket.indexOf(n);
                        fx = startX + ((totalCols - 1) * COLUMN_WIDTH); 
                        fy = getStartY(otherBucket.length) + (idx * ROW_HEIGHT);
                    } else {
                        const tactic = getNodeTactic(n);
                        const match = tactic ? MITRE_ORDER.find(mo => tactic.toLowerCase().includes(mo.toLowerCase())) : null;
                        if (match) {
                            const colIdx = MITRE_ORDER.indexOf(match) + 1;
                            const bucket = tacticBuckets[match];
                            const rowIdx = bucket.indexOf(n);
                            fx = startX + (colIdx * COLUMN_WIDTH);
                            fy = getStartY(bucket.length) + (rowIdx * ROW_HEIGHT);
                        }
                    }
                    return { ...n, fx, fy, vx: 0, vy: 0 };
                });
            });
            setTransform(t => ({ ...t, k: 0.6, x: 0, y: 0 }));
        } else {
            setNodes(current => current.map(n => ({ ...n, fx: undefined, fy: undefined })));
        }
    }, [layoutMode, dimensions, activeNodes.length]);

    const expandNode = (node: GraphNode, targetType: 'IP' | 'ASN' | 'COUNTRY' | 'MALWARE') => {
        if (viewMode !== 'INTERNAL') return;
        const newNodes = [...activeNodes];
        const newLinks = [...activeLinks];
        const existingIds = new Set(newNodes.map(n => n.id));
        const addEntity = (n: GraphNode, sourceId: string, color: string, label: string) => {
            if (!existingIds.has(n.id)) { newNodes.push(n); existingIds.add(n.id); }
            if (!newLinks.some(l => (l.source === sourceId && l.target === n.id) || (l.source === n.id && l.target === sourceId))) {
                newLinks.push({ source: sourceId, target: n.id, color, label });
            }
        };
        if (node.type === 'MALWARE' || node.type === 'STIX_MALWARE') {
            results.forEach(host => {
                if (host.signatures.some(s => `SIG-${s.name}` === node.id || s.name === node.label)) {
                    if (targetType === 'IP') addEntity({ id: host.ip, label: host.ip, type: host.riskLevel === 'CRITICAL' ? 'THREAT' : 'IP', val: 10, color: host.riskLevel === 'CRITICAL' ? '#ef4444' : '#3b82f6', data: host, x: node.x, y: node.y }, node.id, '#ef4444', 'infected');
                }
            });
        } else if (node.type === 'IP' || node.type === 'THREAT') {
            const host = results.find(h => h.ip === node.id);
            if (host) {
                if (targetType === 'MALWARE') host.signatures.forEach(sig => addEntity({ id: `SIG-${sig.name}`, label: sig.name, type: 'MALWARE', val: 12, color: '#f59e0b', data: { tactic: sig.mitreTactic, description: sig.description }, x: node.x, y: node.y }, node.id, '#ef4444', 'infected_with'));
            }
        } else if (node.type === 'ASN') {
            if (targetType === 'IP') results.filter(h => h.enrichmentData?.asn && `ASN-${h.enrichmentData.asn.asn}` === node.id).forEach(host => addEntity({ id: host.ip, label: host.ip, type: host.riskLevel === 'CRITICAL' ? 'THREAT' : 'IP', val: 10, color: host.riskLevel === 'CRITICAL' ? '#ef4444' : '#3b82f6', data: host, x: node.x, y: node.y }, node.id, '#a855f7', 'contains'));
        } else if (node.type === 'COUNTRY') {
            if (targetType === 'IP') results.filter(h => h.country === node.label).forEach(host => addEntity({ id: host.ip, label: host.ip, type: host.riskLevel === 'CRITICAL' ? 'THREAT' : 'IP', val: 10, color: host.riskLevel === 'CRITICAL' ? '#ef4444' : '#3b82f6', data: host, x: node.x, y: node.y }, node.id, '#10b981', 'originates_from'));
        }
        setActiveNodes(newNodes);
        setActiveLinks(newLinks);
    };

    const collapseNode = (node: GraphNode) => {
        // Identify nodes that are ONLY connected to the target node (Leaf nodes)
        const neighborLinks = activeLinks.filter(l => 
            l.source === node.id || l.target === node.id || 
            (l.source as any).id === node.id || (l.target as any).id === node.id
        );

        const neighborIds = new Set<string>();
        neighborLinks.forEach(l => {
             const s = typeof l.source === 'object' ? (l.source as any).id : l.source;
             const t = typeof l.target === 'object' ? (l.target as any).id : l.target;
             if (s !== node.id) neighborIds.add(s);
             if (t !== node.id) neighborIds.add(t);
        });

        const leafIds = new Set<string>();
        
        // Check each neighbor: if it has only 1 connection (which must be to our target), it's a leaf
        neighborIds.forEach(nid => {
             const connections = activeLinks.filter(l => {
                 const s = typeof l.source === 'object' ? (l.source as any).id : l.source;
                 const t = typeof l.target === 'object' ? (l.target as any).id : l.target;
                 return s === nid || t === nid;
             });
             if (connections.length === 1) leafIds.add(nid);
        });

        // Remove leaf nodes
        setActiveNodes(prev => prev.filter(n => !leafIds.has(n.id)));
        setActiveLinks(prev => prev.filter(l => {
             const s = typeof l.source === 'object' ? (l.source as any).id : l.source;
             const t = typeof l.target === 'object' ? (l.target as any).id : l.target;
             return !leafIds.has(s) && !leafIds.has(t);
        }));
    };

    const handleNodeDoubleClick = (node: GraphNode) => {
        if (node.type === 'MALWARE' || node.type === 'STIX_MALWARE') expandNode(node, 'IP');
        else if (node.type === 'IP' || node.type === 'THREAT') expandNode(node, 'MALWARE');
        else if (node.type === 'ASN' || node.type === 'COUNTRY') expandNode(node, 'IP');
    };

    const showMetadataNodes = (targetNode?: GraphNode) => {
        const newNodes = [...activeNodes];
        const newLinks = [...activeLinks];
        const existingIds = new Set(newNodes.map(n => n.id));
        
        const targets = targetNode 
            ? [targetNode.id]
            : (selectedNode ? [selectedNode.id] : activeNodes.filter(n => n.type === 'IP' || n.type === 'THREAT').map(n => n.id));

        const targetSet = new Set(targets);

        results.forEach(host => {
            if (targetSet.has(host.ip)) {
                const ipNode = newNodes.find(n => n.id === host.ip);
                if (!ipNode) return;
                
                const offsetX = (Math.random() - 0.5) * 50;
                const offsetY = (Math.random() - 0.5) * 50;

                if (host.country && host.country !== 'Unknown') {
                    const cid = `CN-${host.country}`;
                    if (!existingIds.has(cid)) { newNodes.push({ id: cid, label: host.country, type: 'COUNTRY', val: 14, color: '#10b981', x: ipNode.x! + offsetX, y: ipNode.y! + offsetY }); existingIds.add(cid); }
                    if (!newLinks.some(l => l.source === ipNode.id && l.target === cid)) { newLinks.push({ source: ipNode.id, target: cid, color: '#10b981', label: 'located_in' }); }
                }
                if (host.enrichmentData?.asn) {
                    const aid = `ASN-${host.enrichmentData.asn.asn}`;
                    if (!existingIds.has(aid)) { newNodes.push({ id: aid, label: host.enrichmentData.asn.name, type: 'ASN', val: 14, color: '#a855f7', x: ipNode.x! + offsetX, y: ipNode.y! + offsetY }); existingIds.add(aid); }
                    if (!newLinks.some(l => l.source === ipNode.id && l.target === aid)) { newLinks.push({ source: ipNode.id, target: aid, color: '#a855f7', label: 'belongs_to' }); }
                }
            }
        });
        setActiveNodes(newNodes);
        setActiveLinks(newLinks);
    };

    const renderNodeDetails = (node: GraphNode) => {
        if (node.type === 'IP' || node.type === 'THREAT') {
            const host = node.data as AnalyzedHost;
            if (!host) return null;
            return (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-black/40 p-2 rounded border border-[#222]">
                            <div className="text-[9px] uppercase text-[#888]">Risk Score</div>
                            <div className={`text-lg font-bold ${host.riskLevel === 'CRITICAL' ? 'text-red-500' : host.riskLevel === 'HIGH' ? 'text-white' : 'text-red-400'}`}>{host.totalScore}/100</div>
                        </div>
                        <div className="bg-black/40 p-2 rounded border border-[#222]">
                            <div className="text-[9px] uppercase text-[#888]">Signatures</div>
                            <div className="text-lg font-bold text-white">{host.signatures.length}</div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-[#AAA]"><Globe size={12}/> <span>{host.country || 'Unknown Country'}</span></div>
                        <div className="flex items-center gap-2 text-xs text-[#AAA]"><Network size={12}/> <span>{host.enrichmentData?.asn?.name || 'Unknown ASN'}</span></div>
                         <div className="flex items-center gap-2 text-xs text-[#AAA]"><MapPin size={12}/> <span>{host.enrichmentData?.city || '-'}</span></div>
                    </div>
                    {host.enrichmentData?.threat && (
                        <div className="flex flex-wrap gap-2">
                            {host.enrichmentData.threat.is_tor && <span className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-900/30 text-white border border-neutral-500/30">TOR</span>}
                            {host.enrichmentData.threat.is_proxy && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#111] text-white border border-neutral-500/30">PROXY</span>}
                            {host.enrichmentData.threat.is_vpn && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#111] text-white border border-neutral-500/30">VPN</span>}
                        </div>
                    )}
                    {host.signatures.length > 0 && (
                        <div>
                            <div className="text-[10px] uppercase text-[#888] font-bold mb-2 border-b border-[#222] pb-1">Detected Threats</div>
                            <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                                {host.signatures.map((s, i) => <div key={i} className="text-xs text-red-300 flex items-center gap-2"><Bug size={10}/> {s.name}</div>)}
                            </div>
                        </div>
                    )}
                </div>
            );
        }
        if (node.type === 'MALWARE' || node.type === 'STIX_MALWARE') {
            const tactic = node.data?.tactic || 'Uncategorized';
            const infectedCount = activeLinks.filter(l => { const t = typeof l.target === 'object' ? (l.target as any).id : l.target; return t === node.id; }).length;
            return (
                <div className="space-y-4">
                    <div className="bg-black/40 p-3 rounded border border-[#222]">
                        <div className="text-[9px] uppercase text-[#888] mb-1">MITRE Tactic</div>
                        <div className="text-sm font-bold text-white">{tactic}</div>
                    </div>
                    {node.data?.description && <div><div className="text-[10px] uppercase text-[#888] font-bold mb-1">Description</div><p className="text-xs text-[#AAA] leading-relaxed">{node.data.description}</p></div>}
                    <div className="bg-red-900/10 p-3 rounded border border-red-500/20">
                        <div className="flex items-center gap-2 text-red-400 text-xs font-bold"><ShieldAlert size={14}/> Impacted Hosts</div>
                        <div className="text-2xl font-bold text-white mt-1">{infectedCount}</div>
                        <div className="text-[9px] text-[#888]">Nodes connected in current graph</div>
                    </div>
                </div>
            );
        }
        if (node.type.startsWith('STIX_') || node.type === 'ROOT') {
             return (
                <div className="space-y-4">
                    {node.data?.description && <div><div className="text-[10px] uppercase text-[#888] font-bold mb-1">Description</div><p className="text-xs text-[#AAA] leading-relaxed">{node.data.description}</p></div>}
                     {node.data?.type && <div className="flex justify-between border-b border-[#222] pb-1"><span className="text-xs text-[#888]">Object Type</span><span className="text-xs text-white font-mono">{node.data.type}</span></div>}
                     {node.data?.kill_chain_phases && <div><div className="text-[10px] uppercase text-[#888] font-bold mb-1">Kill Chain Phases</div><div className="flex flex-wrap gap-1">{node.data.kill_chain_phases.map((p: any, i: number) => <span key={i} className="text-[9px] bg-[#151515] text-neutral-300 px-1.5 py-0.5 rounded border border-[#333]">{p.phase_name}</span>)}</div></div>}
                     {!node.data?.description && !node.data?.kill_chain_phases && (
                         <div className="max-h-40 overflow-y-auto custom-scrollbar border border-[#222] rounded p-2 bg-black/20">
                             <pre className="text-[9px] text-[#AAA] font-mono whitespace-pre-wrap">{JSON.stringify(node.data, null, 2)}</pre>
                         </div>
                     )}
                </div>
             );
        }
        if (node.type === 'ASN' || node.type === 'COUNTRY') {
             const relatedIPs = activeLinks.filter(l => { const s = typeof l.source === 'object' ? (l.source as any).id : l.source; const t = typeof l.target === 'object' ? (l.target as any).id : l.target; return s === node.id || t === node.id; }).length;
             return ( <div className="space-y-4"> <div className="bg-black/40 p-3 rounded border border-[#222]"> <div className="text-[9px] uppercase text-[#888] mb-1">Activity Volume</div> <div className="text-2xl font-bold text-white">{relatedIPs}</div> <div className="text-[9px] text-[#888]">Connected IP nodes</div> </div> </div> )
        }
        return <div className="text-xs text-[#888] italic">No additional metadata available.</div>;
    };

    return (
        <div className="h-full min-h-[600px] bg-[#0A0A0A] flex flex-col relative overflow-hidden border border-[#222] rounded-lg w-full">
            {tooltipData && (
                <div 
                    className="absolute z-50 pointer-events-none bg-black/90 backdrop-blur-md border border-[#333] rounded p-3 text-xs shadow-xl animate-fade-in"
                    style={{ left: tooltipData.x + 15, top: tooltipData.y + 15, maxWidth: '250px' }}
                >
                    <div className="font-bold text-white mb-1">{tooltipData.node.label}</div>
                    <div className="text-[#AAA] text-[10px] mb-1 font-mono">{tooltipData.node.id}</div>
                    {tooltipData.node.type === 'IP' || tooltipData.node.type === 'THREAT' ? (
                        <div className="space-y-1">
                            <div className="flex gap-2">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${tooltipData.node.color === '#ef4444' ? 'bg-red-900/50 text-red-200' : 'bg-[#111] text-white'}`}>{tooltipData.node.type}</span>
                                {tooltipData.node.data?.country && <span className="px-1.5 py-0.5 rounded bg-[#151515] text-neutral-300 text-[9px]">{tooltipData.node.data.country}</span>}
                            </div>
                            {tooltipData.node.data?.signatures?.length > 0 && <div className="text-red-300 text-[9px] mt-1 border-t border-[#333] pt-1">{tooltipData.node.data.signatures[0].name}{tooltipData.node.data.signatures.length > 1 && ` +${tooltipData.node.data.signatures.length-1}`}</div>}
                        </div>
                    ) : ( <div className="text-[10px] text-[#888] uppercase">{tooltipData.node.type} Node</div> )}
                </div>
            )}

            <div className="border-b border-[#222] bg-black/40 flex flex-col z-20 backdrop-blur-sm">
                <div className="h-14 flex flex-wrap items-center justify-between px-4 gap-2">
                    <div className="flex items-center bg-[#0A0A0A] rounded-lg p-1 border border-[#222] mr-4">
                        <button onClick={handleInternalLogs} className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition-colors ${viewMode === 'INTERNAL' ? 'bg-red-500 text-black shadow-[0_0_10px_rgba(14,165,233,0.3)]' : 'text-[#888] hover:text-neutral-300'}`}><Server size={14}/> Internal Logs</button>
                        <label className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${viewMode === 'STIX' ? 'bg-neutral-500 text-black' : 'text-[#888] hover:text-neutral-300'}`}><Upload size={14}/> Load STIX <input type="file" className="hidden" accept=".json" onChange={handleStixUpload} /></label>
                        <button onClick={handleClearGraph} className="px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition-colors text-red-400 hover:bg-red-900/20 hover:text-red-300" title="Clear Graph & Build New"><Trash2 size={14}/> Clear</button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <div className="relative group">
                            <div className="flex items-center bg-[#0A0A0A] border border-[#333] rounded px-2 py-1.5">
                                <Filter size={14} className="text-[#888] mr-2"/>
                                <select 
                                    value={activeTacticFilter} 
                                    onChange={(e) => setActiveTacticFilter(e.target.value)}
                                    className="bg-transparent text-xs text-neutral-300 focus:outline-none w-32"
                                >
                                    <option value="ALL">All Tactics</option>
                                    {availableTactics.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="relative group w-64">
                            <Search className="absolute left-3 top-2 text-[#888] w-3.5 h-3.5" />
                            <input 
                                ref={searchInputRef} 
                                type="text" 
                                placeholder="Search IP to build graph..." 
                                className="bg-black/50 border border-[#333] rounded pl-9 pr-8 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-red-500 w-full transition-colors" 
                                value={searchQuery} 
                                onChange={(e) => setSearchQuery(e.target.value)} 
                                onFocus={() => setShowSuggestions(true)} 
                                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                onKeyDown={handleSearchKeyDown}
                            />
                            {showSuggestions && suggestions.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-[#0A0A0A] border border-[#333] rounded-lg shadow-xl overflow-hidden z-50 animate-fade-in">
                                    <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                        {suggestions.map((item, idx) => (
                                            <button 
                                                key={idx} 
                                                className="w-full text-left px-4 py-2 text-xs text-neutral-300 hover:bg-red-500/20 hover:text-red-500 flex justify-between items-center group border-b border-[#222] last:border-0" 
                                                onClick={() => handleSuggestionClick(item)}
                                            >
                                                <div>
                                                    <div className="font-mono font-bold">{item.label}</div>
                                                    {item.subLabel && <div className="text-[9px] text-[#888]">{item.subLabel}</div>}
                                                </div>
                                                {(item.type === 'ADD_NODE' || item.type === 'ADD_GROUP') ? (
                                                    <span className="text-white text-[9px] font-bold bg-neutral-900/20 px-1.5 rounded border border-neutral-500/30">ADD</span>
                                                ) : (
                                                    <span className="text-neutral-600 group-hover:text-[#AAA] italic">{item.example || 'Filter'}</span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="flex gap-2 ml-auto">
                        <button onClick={() => setIsPhysicsPaused(!isPhysicsPaused)} className="p-1.5 bg-[#151515] hover:bg-[#1C1C1C] rounded text-neutral-300 transition-colors">{isPhysicsPaused ? <Play size={16}/> : <Pause size={16}/>}</button>
                        <button onClick={() => setLayoutMode(m => m === 'FORCE' ? 'CHAIN' : 'FORCE')} className="p-1.5 bg-[#151515] hover:bg-[#1C1C1C] rounded text-neutral-300 transition-colors" title="Toggle Layout">{layoutMode === 'FORCE' ? <Network size={16}/> : <Workflow size={16}/>}</button>
                        <button onClick={handleSaveSession} className="p-1.5 bg-[#151515] hover:bg-[#1C1C1C] rounded text-neutral-300 transition-colors" title="Save Session"><Save size={16}/></button>
                        <label className="p-1.5 bg-[#151515] hover:bg-[#1C1C1C] rounded text-neutral-300 transition-colors cursor-pointer" title="Load Session"><Upload size={16}/><input type="file" className="hidden" accept=".json" onChange={handleLoadSession} /></label>
                    </div>
                </div>
            </div>

            <div className="flex-1 relative flex overflow-hidden">
                <div className="flex-1 relative bg-[#0A0A0A] cursor-move" ref={containerRef} onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
                    <svg width="100%" height="100%">
                        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
                            {links.map((link, i) => {
                                const s = typeof link.source === 'object' ? link.source : nodes.find(n => n.id === link.source);
                                const t = typeof link.target === 'object' ? link.target : nodes.find(n => n.id === link.target);
                                if (!s || !t || !s.x || !t.x) return null;
                                return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke={link.color || '#334155'} strokeWidth={1} opacity={0.6}/>;
                            })}
                            {nodes.map((node) => (
                                <g key={node.id} transform={`translate(${node.x},${node.y})`} onDoubleClick={(e) => { e.stopPropagation(); handleNodeDoubleClick(node); }} onClick={(e) => { e.stopPropagation(); setSelectedNode(node); }} onMouseEnter={() => setHoveredNode(node.id)} onMouseLeave={() => setHoveredNode(null)} onMouseDown={(e) => { e.stopPropagation(); dragNodeRef.current = node.id; }} className="cursor-pointer transition-opacity duration-200" style={{ opacity: hoveredNode && connectedNodeIds.size > 0 && !connectedNodeIds.has(node.id) ? 0.2 : 1 }}>
                                    <circle r={node.val} fill={node.type === 'IP' ? '#0f172a' : node.color} stroke={node.color} strokeWidth={selectedNode?.id === node.id ? 3 : 1.5} className="transition-all duration-300"/>
                                    {node.type === 'IP' && <text dy=".3em" textAnchor="middle" fill={node.color} fontSize="8px" fontWeight="bold">IP</text>}
                                    <text dy={node.val + 12} textAnchor="middle" fill={node.color} fontSize="10px" fontWeight={selectedNode?.id === node.id ? "bold" : "normal"} className="pointer-events-none shadow-black drop-shadow-md">{node.label}</text>
                                </g>
                            ))}
                        </g>
                    </svg>
                    {nodes.length === 0 && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-[#888] pointer-events-none">
                            <Network size={48} className="opacity-20 mb-4"/>
                            <p className="text-sm font-mono">Graph is empty.</p>
                            <p className="text-xs mt-2">Use search to add nodes or click 'Internal Logs'.</p>
                        </div>
                    )}
                </div>
                {selectedNode && (
                    <div className={`w-80 bg-[#111] border-l border-[#222] backdrop-blur-md flex flex-col transition-all duration-300 absolute right-0 top-0 bottom-0 z-30 shadow-2xl ${isPanelCollapsed ? 'translate-x-full' : 'translate-x-0'}`}>
                        <div className="p-4 border-b border-[#222] flex justify-between items-start"><div><h3 className="text-white font-bold text-lg truncate max-w-[200px]" title={selectedNode.label}>{selectedNode.label}</h3><div className="flex gap-2 mt-1"><span className="text-[10px] px-2 py-0.5 rounded bg-[#151515] border border-[#333] text-[#AAA] font-mono">{selectedNode.type}</span><span className="text-[10px] px-2 py-0.5 rounded bg-[#151515] border border-[#333] text-[#AAA] font-mono">ID: {selectedNode.id.substring(0,8)}...</span></div></div><button onClick={() => setSelectedNode(null)} className="text-[#888] hover:text-white"><X size={18}/></button></div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                            {renderNodeDetails(selectedNode)}
                            <div className="pt-4 border-t border-[#222]">
                                <div className="text-[10px] text-[#888] uppercase font-bold mb-2">Actions</div>
                                <div className="flex flex-col gap-2">
                                    <button onClick={() => handleFocusNode(selectedNode)} className="w-full py-2 bg-[#111] hover:bg-[#111] text-red-400 border border-neutral-500/30 rounded text-xs font-bold flex items-center justify-center gap-2"><Focus size={14}/> FOCUS NODE</button>
                                    <button onClick={() => showMetadataNodes(selectedNode)} className="w-full py-2 bg-neutral-900/20 hover:bg-neutral-900/40 text-red-400 border border-neutral-500/30 rounded text-xs font-bold flex items-center justify-center gap-2"><Layers size={14}/> EXPAND METADATA</button>
                                    <button onClick={() => collapseNode(selectedNode)} className="w-full py-2 bg-neutral-900/20 hover:bg-neutral-900/40 text-white border border-neutral-500/30 rounded text-xs font-bold flex items-center justify-center gap-2"><Minus size={14}/> COLLAPSE BRANCH</button>
                                    <button onClick={() => { setHiddenNodeIds(prev => new Set([...prev, selectedNode.id])); setSelectedNode(null); }} className="w-full py-2 bg-[#151515] hover:bg-[#1C1C1C] text-[#AAA] border border-[#333] rounded text-xs font-bold flex items-center justify-center gap-2"><EyeOff size={14}/> HIDE NODE</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
