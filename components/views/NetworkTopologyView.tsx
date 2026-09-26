import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import ReactFlow, { 
    addEdge, 
    Background, 
    Controls, 
    useNodesState, 
    useEdgesState, 
    Panel,
    MarkerType,
    Handle,
    Position,
    ReactFlowInstance,
    Connection,
    Edge,
    Node
} from 'reactflow';
import * as d3 from 'd3';
import { 
    Globe, Shield, Server, Database, User, Zap, Activity, Lock, Cloud, Box, Radio, 
    Cpu, Laptop, Smartphone, Network, Key, Landmark, Monitor, Wifi, Tablet, Flame,
    HardDrive, Briefcase, Building, Code, Construction, Users, Terminal, Layers,
    Router, Bot, SmartphoneNfc, DatabaseZap, BoxSelect, HardHat, Bomb, LockKeyhole,
    Cable, Power, Unplug, ToyBrick, Brackets, Container, Workflow, Webhook,
    ShieldCheck, UserCheck, UserPlus, Send, Boxes, Microchip, FileKey,
    Repeat, Command, Fingerprint, BarChart3, Gauge, Camera, Archive, Package, 
    Component, Code2, FileSearch, MessageSquareText,
    KeySquare, PhoneCall, Bell, Contact, Gavel, FileCheck, ClipboardCheck,
    Settings, RadioReceiver, ScanFace, ScanLine, DoorOpen, ShieldQuestion,
    Mail, Siren, Skull, Plus, Search, BookOpen, Save, Trash2, FileUp, Layout,
    Move, AlignJustify, Download, ImageIcon, FileWarning, FileCode, ShieldAlert,
    X, Target, ExternalLink, Palette, Loader2, RefreshCw, ArrowRightLeft, ArrowDownUp, Info, CheckCircle, Sparkles, Hash,
    MessageCircleQuestion, HelpCircle, Check
} from 'lucide-react';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { GEMINI_API_KEY } from '../../config/config';
import { TopologyNodeData, TopologyEdgeData, AttackSimulationResult } from '../../types';
import { runBlastRadiusSimulation, calculateNodeSecurityIndex } from '../../services/topologyEngine';
import { parseNetworkConfig, ParsedTopology } from '../../services/configParser';
import { exportTopologyImage, exportToVisio, downloadFile } from '../../services/exporter';
import { saveToStorage, loadFromStorage, STORES } from '../../services/storage';

// --- CONSTANTS ---
const PROTOCOLS = ['HTTPS', 'HTTP', 'SQL', 'SSH', 'gRPC', 'AMQP', 'LDAP', 'DNS', 'SMB', 'FTP', 'SMTP', 'Custom'];
const ENCRYPTION_LEVELS = ['None', 'TLS 1.2', 'TLS 1.3', 'IPSec', 'SSH-Encrypted', 'VPN'];
const AUTH_METHODS = ['None', 'OAuth2', 'JWT', 'Basic', 'mTLS', 'API Key', 'Kerberos'];

const SENSITIVITY_LEVELS = ['None', 'Public', 'Internal', 'Confidential', 'Restricted', 'Protected', 'PII', 'PHI', 'Financial', 'Secret'];
const CRITICALITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'MISSION_CRITICAL'];

// --- ICON REGISTRY ---
const STENCIL_ICONS: Record<string, any> = {
    Globe, Shield, Server, Database, User, Zap, Activity, Lock, Cloud, Box, Radio, 
    Cpu, Laptop, Smartphone, Network, Key, Landmark, Monitor, Wifi, Tablet, Flame,
    HardDrive, Briefcase, Building, Code, Construction, Users, Terminal, Layers,
    Router, Bot, SmartphoneNfc, DatabaseZap, BoxSelect, HardHat, Bomb, LockKeyhole,
    Cable, Power, Unplug, ToyBrick, Brackets, Container, Workflow, Webhook,
    ShieldCheck, UserCheck, UserPlus, Send, Boxes, Microchip, FileKey,
    Repeat, Command, Fingerprint, BarChart3, Gauge, Camera, Archive, Package, 
    Component, Code2, FileSearch, MessageSquareText,
    KeySquare, TapeDrive: HardDrive, PhoneCall, Bell, Contact, Gavel, FileCheck, ClipboardCheck,
    Settings, ServerRack: HardDrive, RadioReceiver, ScanFace, ScanLine, DoorOpen, ShieldQuestion,
    Mail, Siren, HsmIcon: FileKey, PodIcon: Monitor, vpcIcon: Layers, ApiGwIcon: Network, QueueIcon: MessageSquareText, StreamIcon: Activity, WarehouseIcon: Database,
    Loop: RefreshCw, ArrowRightLeft, ArrowDownUp
};

// --- CUSTOM NODES ---

const NetworkNode = ({
    data,
    selected,
    icon: DefaultIcon,
    colorClass,
    typeLabel,
}: any) => {
    const Icon =
        data.iconName &&
        STENCIL_ICONS[data.iconName]
            ? STENCIL_ICONS[data.iconName]
            : DefaultIcon;

    const isCompromised =
        data.status === 'COMPROMISED';

    const isReachable =
        data.isReachable;

    return (
        <div
            className={`flex flex-col min-w-[160px] p-3 bg-[#111216] border rounded-lg shadow-sm text-[#ececec] transition-colors ${
                selected ? 'border-[#555] bg-[#16181d]' : 'border-[#222328]'
            } ${isCompromised ? 'border-[#ea4a4a] shadow-[0_0_15px_rgba(234,74,74,0.15)]' : ''}`}
        >
            <Handle
                type="target"
                position={Position.Left}
                className="!w-2 !h-2 !bg-[#444] !border-none"
            />

            <Handle
                type="target"
                position={Position.Top}
                className="!w-2 !h-2 !bg-[#444] !border-none"
            />

            <div className="flex items-center gap-3 mb-2">
                <span className={`p-1.5 rounded-md bg-[#1d1e22] text-[#888] ${isCompromised ? 'bg-[#ea4a4a] text-white' : ''}`}>
                    <Icon size={14} />
                </span>

                <div className="min-w-0 flex-1">
                    <div className="text-[9px] font-bold text-[#666] uppercase tracking-wider truncate">
                        {typeLabel}
                    </div>

                    <div
                        className="text-xs font-bold text-[#ececec] truncate"
                        title={data.label}
                    >
                        {data.label}
                    </div>
                </div>
            </div>

            <div className="text-[10px] text-[#7a7a7a] truncate mt-1">
                {data.ipAddress ||
                    data.interface ||
                    (data.isInternetFacing
                        ? 'Internet facing'
                        : 'Internal asset')}
            </div>

            <Handle
                type="source"
                position={Position.Right}
                className="!w-2 !h-2 !bg-[#444] !border-none"
            />

            <Handle
                type="source"
                position={Position.Bottom}
                className="!w-2 !h-2 !bg-[#444] !border-none"
            />

            {isReachable && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#e5a040]" />
            )}
        </div>
    );
};

const BoundaryNode = (props: any) => (
    <div className={`p-10 rounded-xl border-2 border-dashed transition-all duration-300 min-w-[400px] min-h-[300px] relative ${props.selected ? 'border-red-500 bg-red-900/5' : 'border-gray-800 bg-gray-900/5'} cursor-grab active:cursor-grabbing`}>
        <div className="absolute -top-3 left-4 px-3 py-1 bg-[#020617] border border-gray-700 rounded text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2 z-10 shadow-lg">
            <BoxSelect size={12}/> {props.data.label}
        </div>
        <div className="flex items-center justify-center h-full opacity-5 pointer-events-none absolute inset-0">
            <Shield size={150} className="text-gray-500"/>
        </div>
    </div>
);

const nodeTypes = {
    standard: (props: any) => <NetworkNode {...props} icon={Box} colorClass="bg-blue-500" typeLabel="Component" />,
    gateway: (props: any) => <NetworkNode {...props} icon={Shield} colorClass="bg-indigo-500" typeLabel="Security" />,
    server: (props: any) => <NetworkNode {...props} icon={Server} colorClass="bg-blue-600" typeLabel="Compute" />,
    storage: (props: any) => <NetworkNode {...props} icon={Database} colorClass="bg-pink-500" typeLabel="Storage" />,
    endpoint: (props: any) => <NetworkNode {...props} icon={Laptop} colorClass="bg-emerald-500" typeLabel="Endpoint" />,
    boundary: BoundaryNode
};

const STENCIL_CATEGORIES = [
    {
        title: 'Network & Perimeter',
        items: [
            { type: 'gateway', label: 'Firewall', iconName: 'Shield', criticality: 'HIGH', internet: true },
            { type: 'gateway', label: 'WAF / Proxy', iconName: 'ShieldCheck', criticality: 'HIGH', internet: true },
            { type: 'gateway', label: 'Load Balancer', iconName: 'ArrowDownUp', criticality: 'MEDIUM', internet: true },
            { type: 'standard', label: 'Router', iconName: 'Router', criticality: 'HIGH', internet: false },
            { type: 'standard', label: 'VPN Gateway', iconName: 'LockKeyhole', criticality: 'HIGH', internet: true },
            { type: 'standard', label: 'API Gateway', iconName: 'Network', criticality: 'HIGH', internet: true },
        ]
    },
    {
        title: 'Compute & Logic',
        items: [
            { type: 'server', label: 'Web Server', iconName: 'Globe', criticality: 'MEDIUM', internet: true },
            { type: 'server', label: 'App Server', iconName: 'Cpu', criticality: 'MEDIUM', internet: false },
            { type: 'server', label: 'Active Directory', iconName: 'Landmark', criticality: 'MISSION_CRITICAL', internet: false },
            { type: 'server', label: 'K8s Cluster', iconName: 'Layers', criticality: 'HIGH', internet: false },
            { type: 'server', label: 'Lambda / Function', iconName: 'Zap', criticality: 'LOW', internet: false },
        ]
    },
    {
        title: 'Data Stores',
        items: [
            { type: 'storage', label: 'SQL Database', iconName: 'Database', criticality: 'HIGH', internet: false, sensitivity: 'PII' },
            { type: 'storage', label: 'S3 / Object Store', iconName: 'Box', criticality: 'HIGH', internet: false, sensitivity: 'Protected' },
            { type: 'storage', label: 'NoSQL Cache', iconName: 'DatabaseZap', criticality: 'MEDIUM', internet: false },
            { type: 'storage', label: 'Archive / Tape', iconName: 'Archive', criticality: 'LOW', internet: false },
        ]
    },
    {
        title: 'Users & IoT',
        items: [
            { type: 'endpoint', label: 'Workstation', iconName: 'Monitor', criticality: 'LOW', internet: false },
            { type: 'endpoint', label: 'Admin Terminal', iconName: 'Terminal', criticality: 'HIGH', internet: false },
            { type: 'endpoint', label: 'Mobile Device', iconName: 'Smartphone', criticality: 'LOW', internet: true },
            { type: 'endpoint', label: 'Radio', iconName: 'Radio', criticality: 'LOW', internet: false },
            { type: 'endpoint', label: 'Smart Camera', iconName: 'Camera', criticality: 'MEDIUM', internet: false },
        ]
    },
    {
        title: 'Trust Boundaries',
        items: [
            { type: 'boundary', label: 'Public Internet', iconName: 'Globe', isBoundary: true },
            { type: 'boundary', label: 'DMZ Segment', iconName: 'Shield', isBoundary: true },
            { type: 'boundary', label: 'Internal VLAN', iconName: 'Lock', isBoundary: true },
            { type: 'boundary', label: 'Management Plane', iconName: 'Settings', isBoundary: true },
        ]
    }
];

export const NetworkTopologyView: React.FC = () => {
    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [isSimulating, setIsSimulating] = useState(false);
    const [simulation, setSimulation] = useState<AttackSimulationResult | null>(null);
    // Fix: Added missing highlightedPath state
    const [highlightedPath, setHighlightedPath] = useState<string[]>([]);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [isConfigParsing, setIsConfigParsing] = useState(false);
    const [parsingStatus, setParsingStatus] = useState('');
    
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
    const [paletteSearch, setPaletteSearch] = useState('');
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'info' | 'error' } | null>(null);

    const [customStencils, setCustomStencils] = useState<any[]>([]);
    const [savedDiagrams, setSavedDiagrams] = useState<any[]>([]);
    const [showStencilCreator, setShowStencilCreator] = useState(false);
    const [showLayoutMenu, setShowLayoutMenu] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [sidebarMode, setSidebarMode] = useState<'STENCILS' | 'LIBRARY'>('STENCILS');
    const configInputRef = useRef<HTMLInputElement>(null);

    // Clarification State
    const [showClarificationModal, setShowClarificationModal] = useState(false);
    const [clarificationQuestions, setClarificationQuestions] = useState<string[]>([]);
    const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
    const [originalConfigText, setOriginalConfigText] = useState<string>('');

    const [newStencil, setNewStencil] = useState({
        label: '',
        type: 'standard',
        iconName: 'Box',
        color: 'bg-blue-500',
        internet: false,
        sensitivity: 'None',
        criticality: 'MEDIUM',
        ipAddress: '',
        interface: '',
        vlan: ''
    });

    const [nodeIntel, setNodeIntel] = useState<{ text: string, sources?: any[] } | null>(null);
    const [isIntelLoading, setIsIntelLoading] = useState(false);
    const [newCve, setNewCve] = useState('');
    const [newIoc, setNewIoc] = useState('');

    useEffect(() => {
        const loadCustomData = async () => {
            const stencils = await loadFromStorage(STORES.CUSTOM_STENCILS, 'network_topology_list');
            if (stencils && Array.isArray(stencils)) setCustomStencils(stencils);
            
            const diagrams = await loadFromStorage(STORES.NETWORK_TOPOLOGY_LIBRARY, 'diagram_list');
            if (diagrams && Array.isArray(diagrams)) setSavedDiagrams(diagrams);
        };
        loadCustomData();
    }, []);

    const onConnect = useCallback((params: Connection) => {
        setEdges((eds) => addEdge({
            ...params,
            animated: true,
            label: 'DATA FLOW',
            data: { 
                protocol: 'HTTPS', 
                portRange: '443', 
                isPermissive: true, 
                encryption: 'TLS 1.3',
                authentication: 'None',
                mitreIds: []
            },
            style: { stroke: '#4361ee', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#4361ee' }
        }, eds));
    }, [setEdges]);

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        if (!reactFlowInstance) return;
        
        const type = event.dataTransfer.getData('application/reactflow/type');
        const label = event.dataTransfer.getData('application/reactflow/label');
        const criticality = event.dataTransfer.getData('application/reactflow/criticality');
        const internet = event.dataTransfer.getData('application/reactflow/internet') === 'true';
        const iconName = event.dataTransfer.getData('application/reactflow/iconName');
        const sensitivity = event.dataTransfer.getData('application/reactflow/sensitivity') || 'None';
        const colorClass = event.dataTransfer.getData('application/reactflow/colorClass');
        const ipAddress = event.dataTransfer.getData('application/reactflow/ipAddress');
        const interface_val = event.dataTransfer.getData('application/reactflow/interface');
        const vlan_val = event.dataTransfer.getData('application/reactflow/vlan');

        const position = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
        const id = `${type}-${Date.now()}`;
        
        const newNode: Node = {
            id, type, position,
            data: { 
                label, 
                criticality, 
                isInternetFacing: internet, 
                vulnerabilities: [], 
                iocs: [],
                status: 'SECURE',
                iconName,
                sensitivity,
                colorClass: colorClass || undefined,
                ipAddress: ipAddress || undefined,
                interface: interface_val || undefined,
                vlan: vlan_val || undefined
            }
        };
        setNodes((nds) => nds.concat(newNode));
    }, [reactFlowInstance, setNodes]);

    const applyAutomaticLayout = useCallback((layoutType: 'force' | 'tiered' | 'criticality', nodesToLayout?: Node[], edgesToLayout?: Edge[]) => {
        const targetNodes = nodesToLayout || nodes;
        const targetEdges = edgesToLayout || edges;
        
        if (targetNodes.length === 0) return;
        
        let updatedNodes = [...targetNodes];
        const width = 1200;
        const height = 800;

        if (layoutType === 'force') {
            const simulation = d3.forceSimulation(updatedNodes as any)
                .force("charge", d3.forceManyBody().strength(-800))
                .force("center", d3.forceCenter(width / 2, height / 2))
                .force("collision", d3.forceCollide().radius(120))
                .force("link", d3.forceLink(targetEdges as any).id((d: any) => d.id).distance(200))
                .stop();

            for (let i = 0; i < 150; ++i) simulation.tick();
            
            updatedNodes = updatedNodes.map((n: any) => ({
                ...n,
                position: { x: n.x, y: n.y }
            }));
        } 
        else if (layoutType === 'tiered') {
            const getTier = (n: Node) => {
                if (n.data?.isInternetFacing) return 0;
                if (n.type === 'gateway') return 1;
                if (n.type === 'server') return 2;
                if (n.type === 'storage') return 3;
                if (n.type === 'endpoint') return 4;
                return 2;
            };

            const tiers: Record<number, Node[]> = {};
            updatedNodes.forEach(n => {
                const t = getTier(n);
                if (!tiers[t]) tiers[t] = [];
                tiers[t].push(n);
            });

            const NODE_SPACING = 250;
            const TIER_SPACING = 250;

            updatedNodes = updatedNodes.map(n => {
                const t = getTier(n);
                const tierNodes = tiers[t];
                const index = tierNodes.indexOf(n);
                const startX = (width / 2) - ((tierNodes.length - 1) * NODE_SPACING / 2);
                return {
                    ...n,
                    position: {
                        x: startX + (index * NODE_SPACING),
                        y: 100 + (t * TIER_SPACING)
                    }
                };
            });
        } 
        else if (layoutType === 'criticality') {
            const lanes = { 'MISSION_CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
            const laneCounts: Record<number, number> = {};
            const LANE_WIDTH = 300;
            const NODE_Y_SPACING = 150;

            updatedNodes = updatedNodes.map(n => {
                const lane = lanes[n.data?.criticality as keyof typeof lanes] ?? 2;
                const count = laneCounts[lane] ?? 0;
                laneCounts[lane] = count + 1;
                return { ...n, position: { x: 100 + (lane * LANE_WIDTH), y: 100 + (count * NODE_Y_SPACING) } };
            });
        }

        setNodes(updatedNodes);
        setShowLayoutMenu(false);
        if (reactFlowInstance) {
            setTimeout(() => reactFlowInstance.fitView({ duration: 800 }), 50);
        }
    }, [nodes, edges, reactFlowInstance, setNodes]);

    const processParsingResults = (parsed: ParsedTopology) => {
        if (parsed.questions && parsed.questions.length > 0) {
            setClarificationQuestions(parsed.questions);
            setUserAnswers({});
            setShowClarificationModal(true);
            return;
        }

        if (parsed.nodes) {
            const newNodes: Node[] = parsed.nodes.map(n => ({
                id: n.id,
                type: n.type,
                position: { x: Math.random() * 800, y: Math.random() * 600 },
                data: {
                    label: n.label,
                    criticality: n.criticality,
                    isInternetFacing: n.isInternetFacing,
                    iconName: n.iconName,
                    description: n.description,
                    vulnerabilities: [],
                    iocs: [],
                    status: 'SECURE',
                    interface: (n as any).interface,
                    ipAddress: (n as any).ipAddress
                }
            }));

            const newEdges: Edge[] = (parsed.edges || []).map(e => ({
                id: `e-${e.source}-${e.target}`,
                source: e.source,
                target: e.target,
                label: e.label,
                animated: true,
                data: {
                    protocol: e.protocol,
                    portRange: e.portRange,
                    isPermissive: true
                },
                style: { stroke: '#4361ee', strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed, color: '#4361ee' }
            }));

            setNodes(newNodes);
            setEdges(newEdges);
            
            setParsingStatus("Optimizing visualization layout...");
            setTimeout(() => applyAutomaticLayout('tiered', newNodes, newEdges), 100);
        }
    };

    const handleConfigUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        setIsConfigParsing(true);
        setParsingStatus(`Reading ${files.length} configuration file(s)...`);
        
        try {
            const textPromises = files.map(async (f: any) => {
                const content = await f.text();
                // Fix: Cast to any for name property access on potentially unknown file objects in some environments
                return `--- SOURCE DEVICE: ${f.name} ---\n${content}\n`;
            });
            
            const allTextParts = await Promise.all(textPromises);
            const combinedText = allTextParts.join('\n\n');
            setOriginalConfigText(combinedText);
            
            setParsingStatus("Analyzing unified network architecture...");
            const parsed = await parseNetworkConfig(combinedText);
            processParsingResults(parsed);

        } catch (err: any) {
            console.error("Config Ingestion Error", err);
            alert("Enterprise analysis failure: " + err.message);
        } finally {
            setIsConfigParsing(false);
            setParsingStatus('');
            if (configInputRef.current) configInputRef.current.value = '';
        }
    };

    const handleSubmitClarifications = async () => {
        setIsConfigParsing(true);
        setParsingStatus("Processing manual input...");
        setShowClarificationModal(false);

        const answersString = Object.entries(userAnswers)
            .map(([idx, ans]) => `Q: ${clarificationQuestions[parseInt(idx)]}\nA: ${ans}`)
            .join('\n\n');

        try {
            const parsed = await parseNetworkConfig(originalConfigText, answersString);
            processParsingResults(parsed);
        } catch (err: any) {
            console.error("Re-parsing Error", err);
            alert("Clarification processing failed: " + err.message);
        } finally {
            setIsConfigParsing(false);
            setParsingStatus('');
        }
    };

    const handleFetchNodeIntel = async () => {
        if (!selectedNode) return;
        setIsIntelLoading(true);
        setNodeIntel(null);
        try {
            const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
            const nodeData: any = selectedNode.data;
            const nodeType = selectedNode.type || 'standard';
            
            const prompt = `Research technical security context for a network asset labeled "${nodeData.label}". 
            This asset is identified as a ${nodeType} in a network topology.
            Current vulnerabilities mapped: ${nodeData.vulnerabilities?.join(', ') || 'None'}.
            
            Provide a technical briefing on:
            1. Common exploit vectors for this type of component.
            2. Real-world threat actors or malware known to target this.
            3. Recommended hardening steps (CIS controls, firewall rules).
            
            Keep the output technical, focused, and formatted in clear Markdown.`;

            // Fix: response: any cast to avoid property access issues on unknown type if GenerateContentResponse is not fully resolved
            const response: any = await ai.models.generateContent({
                model: 'gemini-3-pro-preview', 
                contents: prompt,
                config: {
                    tools: [{ googleSearch: {} }],
                    temperature: 0.2
                }
            });

            const sources: any[] = [];
            const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
            if (Array.isArray(chunks)) {
                chunks.forEach((chunk: any) => {
                    // Fix: Property 'text' and 'name' access was mentioned in error report; using title and uri as per guidelines
                    if (chunk.web) {
                        sources.push({
                            title: chunk.web.title || "Source",
                            uri: chunk.web.uri || "#"
                        });
                    }
                });
            }

            setNodeIntel({ text: response.text || "No specific intel found.", sources });
        } catch (e) {
            console.error("Intel fetch failed", e);
            setNodeIntel({ text: "Failed to establish secure link to intelligence grounding service." });
        } finally {
            setIsIntelLoading(false);
        }
    };

    const handleNodeTechnicalAudit = async () => {
        if (!selectedNode) return;
        setIsIntelLoading(true);
        setNodeIntel(null);
        try {
            const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
            const nodeData: any = selectedNode.data;
            const nodeType = selectedNode.type || 'standard';

            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `Perform a technical security audit for this specific network unit:
                Label: ${nodeData.label}
                Type: ${nodeType}
                Exposure: ${nodeData.isInternetFacing ? 'Internet-Facing (HIGH RISK)' : 'Internal LAN'}
                Criticality: ${nodeData.criticality}
                Data Sensitivity: ${nodeData.sensitivity}
                Mapped CVEs: ${nodeData.vulnerabilities?.join(', ') || 'None'}
                Mapped IOCs: ${nodeData.iocs?.join(', ') || 'None'}
                
                Assess the risk profile and provide a one-paragraph technical summary of the primary attack path concerns and a checklist of 3 high-impact mitigations.`,
                config: { temperature: 0.1 }
            });

            setNodeIntel({ text: response.text || "Audit failed to generate." });
        } catch (e) {
            console.error("Audit failed", e);
        } finally {
            setIsIntelLoading(false);
        }
    };

    const runSimulation = async (originNodeId: string) => {
        setIsSimulating(true);
        // Fix: setHighlightedPath usage corrected by ensuring state exists
        setHighlightedPath([]);
        const result = runBlastRadiusSimulation(nodes, edges, originNodeId);
        
        setNodes(nds => nds.map(n => ({
            ...n,
            data: {
                ...n.data,
                status: n.id === originNodeId ? 'COMPROMISED' : n.data.status,
                isReachable: result.reachableNodes.includes(n.id)
            }
        })));

        setEdges(eds => eds.map(e => ({
            ...e,
            animated: result.reachableNodes.includes(e.source) && result.reachableNodes.includes(e.target),
            style: { 
                ...e.style, 
                stroke: (result.reachableNodes.includes(e.source) && result.reachableNodes.includes(e.target)) ? '#ef4444' : '#4361ee',
                strokeWidth: (result.reachableNodes.includes(e.source) && result.reachableNodes.includes(e.target)) ? 3 : 2
            }
        })));

        setSimulation(result);

        setIsAiLoading(true);
        try {
            const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
            const originNode: any = nodes.find(n => n.id === originNodeId);
            const criticalAssetNames = result.criticalPaths.map(path => {
                const targetNode: any = nodes.find(n => n.id === path[path.length - 1]);
                return targetNode?.data?.label || 'Unknown Asset';
            }).join(', ');

            const prompt = `Analyze this simulated cyber attack path in a network topology.
            Origin of Compromise: ${originNode?.data?.label || 'Unknown Origin'}
            Critical Assets at Risk: ${criticalAssetNames}
            Blast Radius Score: ${result.blastRadiusScore}/100
            
            Based on the graph structure, provide:
            1. Tactical narrative of the lateral movement.
            2. Top 3 urgent network security recommendations.
            
            Keep the response technical and concise.`;

            const aiRes: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: { temperature: 0.2 }
            });
            setSimulation({ ...result, aiInsights: aiRes.text });
        } catch(e) {
            console.error("AI Insights failed", e);
        } finally {
            setIsAiLoading(false);
            setIsSimulating(false);
        }
    };

    const clearSimulation = () => {
        setSimulation(null);
        setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, status: 'SECURE', isReachable: false } })));
        setEdges(eds => eds.map(e => ({ ...e, animated: true, style: { stroke: '#4361ee', strokeWidth: 2 } })));
    };

    const handleNodePropertyChange = (id: string, key: string, value: any) => {
        setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [key]: value } } : n));
        if (selectedNode?.id === id) setSelectedNode(prev => prev ? { ...prev, data: { ...prev.data, [key]: value } } : null);
    };

    // Fix: Added missing handleSaveDiagram implementation
    const handleSaveDiagram = async () => {
        if (nodes.length === 0) return;
        const name = prompt("Enter a name for this design:", "Network Topology " + new Date().toLocaleDateString());
        if (!name) return;
        
        const serializableNodes = nodes.map(node => ({
            ...node,
            data: Object.fromEntries(Object.entries(node.data).filter(([_, value]) => typeof value !== 'function'))
        }));

        const newDiagram = {
            id: crypto.randomUUID(),
            name,
            timestamp: Date.now(),
            nodes: serializableNodes,
            edges,
            nodeCount: nodes.length
        };

        const updated = [newDiagram, ...savedDiagrams];
        setSavedDiagrams(updated);
        await saveToStorage(STORES.NETWORK_TOPOLOGY_LIBRARY, updated, 'diagram_list');
        showToast("Design saved to library", "success");
    };

    // Fix: Added missing handleLoadDiagram implementation
    const handleLoadDiagram = (diagram: any) => {
        if (nodes.length > 0 && !window.confirm("Replace current canvas with saved design?")) return;
        
        const onLabelChange = (id: string, label: string) => {
            setNodes((nds) => nds.map((node) => {
                if (node.id === id) return { ...node, data: { ...node.data, label } };
                return node;
            }));
        };

        setNodes(diagram.nodes.map((n: any) => ({
            ...n,
            data: { ...n.data, onLabelChange }
        })));
        setEdges(diagram.edges);
        setSimulation(null);
        showToast(`Loaded: ${diagram.name}`, "info");
        if (reactFlowInstance) {
            setTimeout(() => reactFlowInstance.fitView({ duration: 800 }), 100);
        }
    };

    // Fix: Added missing handleDeleteSavedDiagram implementation
    const handleDeleteSavedDiagram = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (window.confirm("Delete this saved design?")) {
            const updated = savedDiagrams.filter(d => d.id !== id);
            setSavedDiagrams(updated);
            await saveToStorage(STORES.NETWORK_TOPOLOGY_LIBRARY, updated, 'diagram_list');
            showToast("Design deleted", "info");
        }
    };

    const handleCreateStencil = async () => {
        if (!newStencil.label) return;
        const stencil = { ...newStencil, id: `net-st-${Date.now()}` };
        const updated = [...customStencils, stencil];
        setCustomStencils(updated);
        await saveToStorage(STORES.CUSTOM_STENCILS, updated, 'network_topology_list');
        setShowStencilCreator(false);
        setNewStencil({ label: '', type: 'standard', iconName: 'Box', color: 'bg-blue-500', internet: false, sensitivity: 'None', criticality: 'MEDIUM', ipAddress: '', interface: '', vlan: '' });
    };

    const filteredStencils = useMemo(() => {
        let combined = [...STENCIL_CATEGORIES];
        if (customStencils.length > 0) combined = [{ title: 'Custom Assets', items: customStencils }, ...combined];
        if (!paletteSearch) return combined;
        const lower = paletteSearch.toLowerCase();
        return combined.map(cat => ({ ...cat, items: cat.items.filter(i => i.label.toLowerCase().includes(lower)) })).filter(cat => cat.items.length > 0);
    }, [paletteSearch, customStencils]);

    return (
        <div className="flex w-full h-full bg-[#0a0a0a] text-[#ededed] font-sans overflow-hidden">
            {/* Sidebar: Palette & Library */}
            <div className="w-64 flex flex-col bg-[#0d0e10] border-r border-[#ffffff10] z-20 flex-shrink-0">
                <div className="flex bg-[#0a0b0d] border-b border-[#ffffff10]">
                    <button onClick={() => setSidebarMode('STENCILS')} className={`flex-1 py-3 text-[10px] font-bold uppercase transition-colors border-b-2 ${sidebarMode === 'STENCILS' ? 'border-[#d62828] text-[#ededed] bg-[#ffffff05]' : 'border-transparent text-[#777] hover:text-[#999]'}`}>Stencils</button>
                    <button onClick={() => setSidebarMode('LIBRARY')} className={`flex-1 py-3 text-[10px] font-bold uppercase transition-colors border-b-2 ${sidebarMode === 'LIBRARY' ? 'border-[#555] text-[#ededed] bg-[#ffffff05]' : 'border-transparent text-[#777] hover:text-[#999]'}`}>Library</button>
                </div>

                {sidebarMode === 'STENCILS' ? (
                    <>
                        <div className="p-4 border-b border-[#222328] bg-[#111216]">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-[10px] font-bold text-[#888] uppercase tracking-[0.10em] flex items-center gap-2">
                                    <Layers size={14}/> STENCILS
                                </h3>
                                <button onClick={() => setShowStencilCreator(true)} className="p-1.5 hover:bg-[#ffffff10] rounded text-[#888] hover:text-[#fff]" title="New Stencil">
                                    <Plus size={16}/>
                                </button>
                            </div>
                            <div className="relative group">
                                <Search className="absolute left-3 top-2 text-[#555] w-3.5 h-3.5" />
                                <input 
                                    type="text" 
                                    placeholder="Find stencil..." 
                                    className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg py-2 pl-10 pr-4 text-xs text-[#ececec] focus:border-[#555] focus:outline-none transition-colors"
                                    value={paletteSearch}
                                    onChange={(e) => setPaletteSearch(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-6">
                            {filteredStencils.map(cat => (
                                <div key={cat.title}>
                                    <h4 className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <div className="w-1 h-1 rounded-full bg-gray-600"></div> {cat.title}
                                    </h4>
                                    <div className="grid grid-cols-1 gap-2">
                                        {cat.items.map(s => {
                                            const Icon = STENCIL_ICONS[s.iconName] || Box;
                                            return (
                                                <div 
                                                    key={s.id || s.label}
                                                    draggable
                                                    onDragStart={(e) => {
                                                        e.dataTransfer.setData('application/reactflow/type', s.type);
                                                        e.dataTransfer.setData('application/reactflow/label', s.label);
                                                        e.dataTransfer.setData('application/reactflow/criticality', s.criticality || 'MEDIUM');
                                                        e.dataTransfer.setData('application/reactflow/internet', String(s.internet || false));
                                                        e.dataTransfer.setData('application/reactflow/iconName', s.iconName || '');
                                                        e.dataTransfer.setData('application/reactflow/sensitivity', s.sensitivity || 'None');
                                                        e.dataTransfer.setData('application/reactflow/colorClass', s.color || '');
                                                        e.dataTransfer.setData('application/reactflow/ipAddress', (s as any).ipAddress || '');
                                                        e.dataTransfer.setData('application/reactflow/interface', (s as any).interface || '');
                                                        e.dataTransfer.setData('application/reactflow/vlan', (s as any).vlan || '');
                                                    }}
                                                    className="p-2.5 bg-[#121316] border border-[#222328] rounded-lg cursor-grab hover:border-[#555] hover:bg-[#1a1c21] transition-all group flex items-center gap-3"
                                                >
                                                    <div className={`p-1.5 rounded-md bg-opacity-10 ${s.color || 'bg-blue-500'} ${s.color ? s.color.replace('bg-', 'text-') : 'text-blue-400'} group-hover:text-white`}>
                                                        <Icon size={14} />
                                                    </div>
                                                    <span className="text-[11px] font-bold text-[#888] group-hover:text-[#ececec]">{s.label}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col min-h-0">
                        <div className="p-4 border-b border-[#222328] bg-[#111216] flex justify-between items-center">
                            <h3 className="text-xs font-bold text-[#888] uppercase tracking-widest flex items-center gap-2">
                                <BookOpen size={14}/> SAVED DESIGNS
                            </h3>
                            <button onClick={handleSaveDiagram} className="p-1.5 hover:bg-[#ffffff10] rounded text-[#888] hover:text-[#fff]" title="Save Current Design">
                                <Save size={16}/>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                            {savedDiagrams.map((diag) => (
                                <div 
                                    key={diag.id} 
                                    onClick={() => handleLoadDiagram(diag)}
                                    className="p-3 bg-[#121316] border border-[#222328] rounded-lg cursor-pointer hover:border-[#555] hover:bg-[#1a1c21] transition-all group relative"
                                >
                                    <button onClick={(e) => handleDeleteSavedDiagram(e, diag.id)} className="absolute top-2 right-2 p-1 text-[#555] hover:text-[#ea4a4a] transition-colors opacity-0 group-hover:opacity-100">
                                        <Trash2 size={12}/>
                                    </button>
                                    <div className="text-xs font-bold text-[#ececec] mb-1 truncate pr-5">{diag.name}</div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[9px] text-[#666] font-mono">{new Date(diag.timestamp).toLocaleDateString()}</span>
                                        <span className="text-[9px] text-[#888] bg-[#222328] px-1.5 rounded border border-[#333]">{diag.nodeCount} nodes</span>
                                    </div>
                                </div>
                            ))}
                            {savedDiagrams.length === 0 && (
                                <div className="text-center py-10 text-[#666] text-xs italic">
                                    No saved designs in library.
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Canvas */}
            <div className="flex-1 relative z-10 bg-[#0a0a0a]">
                <ReactFlow 
                    nodes={nodes} 
                    edges={edges} 
                    nodeTypes={nodeTypes} 
                    onNodesChange={onNodesChange} 
                    onEdgesChange={onEdgesChange} 
                    onConnect={onConnect} 
                    onInit={reactFlowInstance => setReactFlowInstance(reactFlowInstance)}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    onNodeClick={(_, n) => { setSelectedNode(n); setSelectedEdge(null); setNodeIntel(null); }}
                    onEdgeClick={(_, e) => { setSelectedEdge(e); setSelectedNode(null); setNodeIntel(null); }}
                    onPaneClick={() => { setSelectedNode(null); setSelectedEdge(null); setNodeIntel(null); }}
                    fitView
                    proOptions={{ hideAttribution: true }}
                >
                    <Background color="#ffffff" gap={24} size={1} style={{ opacity: 0.05 }} />
                    <Controls className="!bg-[#111216] !border !border-[#222328] !fill-[#999] shadow-md [&>button]:!border-b-[#222328] hover:[&>button]:!bg-[#1a1b20]" />
                    <Panel position="top-left" className="!m-4 !left-0 !top-0">
                        <div className="flex flex-wrap items-center gap-2 p-2 bg-[#111216] border border-[#222328] rounded-lg shadow-lg">
                        {isConfigParsing && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-900/40 text-indigo-400 border border-indigo-500/30 rounded text-[10px] font-bold animate-pulse">
                                <Loader2 className="animate-spin" size={12}/> {parsingStatus}
                            </div>
                        )}
                        
                        {simulation ? (
                            <button onClick={clearSimulation} className="px-3 py-1.5 bg-red-600 text-white rounded text-xs font-bold flex items-center gap-2 shadow-lg shadow-red-900/20">
                                <RefreshCw size={14}/> CLEAR SIMULATION
                            </button>
                        ) : (
                            <div className="text-[10px] text-gray-500 font-bold uppercase flex items-center gap-2 px-2">
                                <Siren size={14} className="text-orange-500 animate-pulse"/> SELECT NODE FOR INTEL & PROPERTIES
                            </div>
                        )}
                        
                        <div className="h-6 w-px bg-gray-700 mx-1"></div>
                        
                        <div className="at-topology-toolbar-group">
                            <label title="Build Topology from Multiple Configs">
                                <FileUp size={16}/> LOAD CONFIGS
                                <input type="file" className="hidden" accept=".txt,.cfg,.conf" multiple onChange={handleConfigUpload} ref={configInputRef} />
                            </label>

                            <div className="relative">
                                <button 
                                    onClick={() => { setShowLayoutMenu(!showLayoutMenu); setShowExportMenu(false); }}
                                    title="Automatic Layout"
                                >
                                    <Layout size={16}/> LAYOUT
                                </button>
                                
                                {showLayoutMenu && (
                                    <div className="absolute top-full right-0 mt-2 w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-[100] animate-fade-in">
                                        <div className="p-2 text-[10px] font-bold text-gray-500 uppercase border-b border-gray-800">Select Algorithm</div>
                                        <button onClick={() => applyAutomaticLayout('force')} className="w-full text-left px-4 py-2.5 text-xs text-gray-300 hover:bg-white/5 flex items-center gap-3 transition-colors">
                                            <Move size={14} className="text-blue-400"/> Force-Directed
                                        </button>
                                        <button onClick={() => applyAutomaticLayout('tiered')} className="w-full text-left px-4 py-2.5 text-xs text-gray-300 hover:bg-white/5 flex items-center gap-3 transition-colors">
                                            <AlignJustify size={14} className="text-green-400"/> Tiered Architecture
                                        </button>
                                        <button onClick={() => applyAutomaticLayout('criticality')} className="w-full text-left px-4 py-2.5 text-xs text-gray-300 hover:bg-white/5 flex items-center gap-3 transition-colors">
                                            <Shield size={14} className="text-red-400"/> Risk-Based Lanes
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="relative">
                                <button 
                                    onClick={() => { setShowExportMenu(!showExportMenu); setShowLayoutMenu(false); }}
                                    title="Export Diagram"
                                >
                                    <Download size={16}/> EXPORT
                                </button>
                                
                                {showExportMenu && (
                                    <div className="absolute top-full right-0 mt-2 w-56 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-[100] animate-fade-in">
                                        <div className="p-2 text-[10px] font-bold text-gray-500 uppercase border-b border-gray-800">Choose Format</div>
                                        <button onClick={() => { setShowExportMenu(false); exportTopologyImage('png'); }} className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-white/5 flex items-center gap-3 transition-colors">
                                            <ImageIcon size={14} className="text-blue-400"/> High-Res PNG
                                        </button>
                                        <button onClick={() => { setShowExportMenu(false); exportTopologyImage('jpeg'); }} className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-white/5 flex items-center gap-3 transition-colors">
                                            <ImageIcon size={14} className="text-orange-400"/> Legacy JPEG
                                        </button>
                                        <button onClick={() => { setShowExportMenu(false); exportToVisio(nodes, edges); }} className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-white/5 flex items-center gap-3 transition-colors">
                                            <FileWarning size={14} className="text-indigo-400"/> Microsoft Visio (.vdx)
                                        </button>
                                        <button onClick={() => {
                                            setShowExportMenu(false);
                                            const data = JSON.stringify({ nodes, edges }, null, 2);
                                            downloadFile(data, `topology_model_${Date.now()}.json`, 'application/json');
                                        }} className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-white/5 flex items-center gap-3 transition-colors">
                                            <FileCode size={14} className="text-green-400"/> Logic Model (JSON)
                                        </button>
                                    </div>
                                )}
                            </div>

                            <button onClick={() => { setNodes([]); setEdges([]); setSimulation(null); }} className="danger" title="Reset Canvas">
                                <Trash2 size={16}/> RESET
                            </button>
                        </div>
                        </div>
                    </Panel>

                    {/* HUD / Risk Meter */}
                    <Panel position="bottom-left" className="!m-4 !left-0 !bottom-0">
                        <div className="w-64 p-4 bg-[#111216] border border-[#222328] rounded-lg shadow-lg">
                            <div className="flex items-center gap-2 text-xs font-bold text-[#888] uppercase mb-3">
                                <span>Topology Risk Profile</span>
                                <Activity size={14} />
                            </div>
                            {simulation ? (
                                <div className="space-y-4 mt-3">
                                    <div>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-red-400 font-bold">BLAST RADIUS</span>
                                            <span className="text-white font-mono">{simulation.blastRadiusScore}%</span>
                                        </div>
                                        <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-red-500 animate-pulse" style={{ width: `${simulation.blastRadiusScore}%` }}></div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                                        <div className="p-2 bg-gray-900 rounded border border-gray-800">
                                            <div className="text-gray-500 uppercase">Reached</div>
                                            <div className="text-white font-bold">{simulation.reachableNodes.length} Units</div>
                                        </div>
                                        <div className="p-2 bg-gray-900 rounded border border-gray-800">
                                            <div className="text-gray-500 uppercase">Crit Paths</div>
                                            <div className="text-white font-bold">{simulation.criticalPaths.length} Active</div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center p-6 text-center text-[#555]">
                                    <Shield size={24} className="mb-2 opacity-50"/>
                                    <p className="text-[10px] uppercase font-bold tracking-wider">Network analysis engine standing by</p>
                                </div>
                            )}
                        </div>
                    </Panel>
                </ReactFlow>
            </div>

            {/* Right Panel: Context & Simulation Output */}
            <div className={`flex flex-col bg-[#0d0e10] border-[#ffffff10] transition-all duration-300 overflow-hidden flex-shrink-0 ${selectedNode || selectedEdge ? 'w-80 border-l z-20' : 'w-0 border-none'}`}>
                <div className="p-4 border-b border-[#222328] bg-[#0a0b0d] flex items-center justify-between">
                    <h3 className="text-xs font-bold text-[#888] uppercase tracking-[0.2em] flex items-center gap-2">
                        <Terminal size={14}/> {selectedNode ? 'ASSET INTEL' : selectedEdge ? 'FLOW' : 'ANALYTICS'}
                    </h3>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
                    {selectedNode ? (
                        <div className="space-y-6 animate-fade-in pb-10">
                            {/* Asset Identity Card */}
                            <div className="bg-[#111216] border border-[#222328] rounded-lg p-4 space-y-4 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-md ${selectedNode.data.colorClass || 'bg-[#1d1e22] text-[#888]'}`}>
                                        {React.createElement(STENCIL_ICONS[selectedNode.data.iconName] || Box, { size: 20 })}
                                    </div>
                                    <input 
                                        className="bg-transparent font-bold text-[#ececec] text-sm border-b border-transparent focus:border-[#555] outline-none w-full"
                                        value={selectedNode.data.label}
                                        onChange={(e) => handleNodePropertyChange(selectedNode.id, 'label', e.target.value)}
                                    />
                                </div>
                                
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-2 bg-[#0a0a0a] border border-[#222328] rounded">
                                            <label className="text-[8px] font-bold text-[#666] uppercase block mb-1">Interface</label>
                                            <input 
                                                className="bg-transparent w-full text-xs font-mono text-[#ececec] focus:outline-none"
                                                value={selectedNode.data.interface || ''}
                                                onChange={(e) => handleNodePropertyChange(selectedNode.id, 'interface', e.target.value)}
                                                placeholder="eth0, vlan10..."
                                            />
                                        </div>
                                        <div className="p-2 bg-[#0a0a0a] border border-[#222328] rounded">
                                            <label className="text-[8px] font-bold text-[#666] uppercase block mb-1">VLAN Tag</label>
                                            <input 
                                                className="bg-transparent w-full text-xs font-mono text-[#ececec] focus:outline-none"
                                                value={selectedNode.data.vlan || ''}
                                                onChange={(e) => handleNodePropertyChange(selectedNode.id, 'vlan', e.target.value)}
                                                placeholder="10, 20, 100..."
                                            />
                                        </div>
                                    </div>
                                    <div className="p-2 bg-[#0a0a0a] border border-[#222328] rounded">
                                        <label className="text-[8px] font-bold text-[#666] uppercase block mb-1">IP Connectivity</label>
                                        <input 
                                            className="bg-transparent w-full text-xs font-mono text-[#ececec] focus:outline-none"
                                            value={selectedNode.data.ipAddress || ''}
                                            onChange={(e) => handleNodePropertyChange(selectedNode.id, 'ipAddress', e.target.value)}
                                            placeholder="10.0.0.1, 192.168.1.1..."
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-bold text-[#666] uppercase block mb-1">Exposure Posture</label>
                                        <button 
                                            onClick={() => handleNodePropertyChange(selectedNode.id, 'isInternetFacing', !selectedNode.data.isInternetFacing)}
                                            className={`w-full py-2 rounded-md text-[10px] font-bold border transition-all ${selectedNode.data.isInternetFacing ? 'bg-[#3b2a2a] border-[#ea4a4a] text-[#ea4a4a]' : 'bg-[#1a2e20] text-[#4fae63] border-[#294d35]'}`}
                                        >
                                            {selectedNode.data.isInternetFacing ? 'PUBLIC INTERNET FACING' : 'ISOLATED INTERNAL'}
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[9px] font-bold text-[#666] uppercase block mb-1">Criticality</label>
                                            <select 
                                                className="w-full bg-[#0a0a0a] border border-[#333] rounded p-2 text-xs text-[#ececec] outline-none"
                                                value={selectedNode.data.criticality}
                                                onChange={(e) => handleNodePropertyChange(selectedNode.id, 'criticality', e.target.value)}
                                            >
                                                {CRITICALITY_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold text-[#666] uppercase block mb-1">Sensitivity</label>
                                            <select 
                                                className="w-full bg-[#0a0a0a] border border-[#333] rounded p-2 text-xs text-[#888] outline-none font-bold"
                                                value={selectedNode.data.sensitivity}
                                                onChange={(e) => handleNodePropertyChange(selectedNode.id, 'sensitivity', e.target.value)}
                                            >
                                                {SENSITIVITY_LEVELS.map(lvl => (
                                                    <option key={lvl} value={lvl}>{lvl.toUpperCase()}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Threat Context Mapper */}
                            <div className="bg-[#111216] border border-[#222328] rounded-lg p-4 space-y-4 shadow-sm">
                                <h4 className="text-[10px] font-bold text-[#d62828] uppercase flex items-center gap-2 border-b border-[#222328] pb-2">
                                    <ShieldAlert size={12}/> Threat Context Mapping
                                </h4>
                                
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-[9px] font-bold text-[#666] uppercase block mb-1">Mapped CVEs</label>
                                        <div className="flex gap-2 mb-2">
                                            <input 
                                                type="text" 
                                                className="flex-1 bg-[#0a0a0a] border border-[#333] rounded p-1.5 text-[10px] text-[#ececec] font-mono focus:border-[#555] outline-none"
                                                placeholder="CVE-2024-..."
                                                value={newCve}
                                                onChange={e => setNewCve(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && (setNewCve(''), handleNodePropertyChange(selectedNode.id, 'vulnerabilities', [...(selectedNode.data.vulnerabilities || []), newCve]))}
                                            />
                                            <button onClick={() => { if(newCve) { handleNodePropertyChange(selectedNode.id, 'vulnerabilities', [...(selectedNode.data.vulnerabilities || []), newCve]); setNewCve(''); } }} className="px-2 bg-[#222328] hover:bg-[#333] rounded text-xs text-[#ececec] transition-colors">+</button>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {selectedNode.data.vulnerabilities?.map((v: string, i: number) => (
                                                <span key={i} className="px-2 py-0.5 bg-[#2a1a1a] text-[#ea4a4a] border border-[#ea4a4a40] rounded text-[9px] font-mono flex items-center gap-1">
                                                    {v} <X size={8} className="cursor-pointer hover:text-white" onClick={() => handleNodePropertyChange(selectedNode.id, 'vulnerabilities', selectedNode.data.vulnerabilities.filter((_:any,idx:number) => idx !== i))}/>
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[9px] font-bold text-[#666] uppercase block mb-1">Indicators (IP/Domain/Hash)</label>
                                        <div className="flex gap-2 mb-2">
                                            <input 
                                                type="text" 
                                                className="flex-1 bg-[#0a0a0a] border border-[#333] rounded p-1.5 text-[10px] text-[#ececec] font-mono focus:border-[#555] outline-none"
                                                placeholder="1.2.3.4, malware.com..."
                                                value={newIoc}
                                                onChange={e => setNewIoc(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && (setNewIoc(''), handleNodePropertyChange(selectedNode.id, 'iocs', [...(selectedNode.data.iocs || []), newIoc]))}
                                            />
                                            <button onClick={() => { if(newIoc) { handleNodePropertyChange(selectedNode.id, 'iocs', [...(selectedNode.data.iocs || []), newIoc]); setNewIoc(''); } }} className="px-2 bg-[#222328] hover:bg-[#333] rounded text-xs text-[#ececec] transition-colors">+</button>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {selectedNode.data.iocs?.map((ioc: string, i: number) => (
                                                <span key={i} className="px-2 py-0.5 bg-[#2a1a1a] text-[#ea4a4a] border border-[#ea4a4a40] rounded text-[9px] font-mono flex items-center gap-1">
                                                    {ioc} <X size={8} className="cursor-pointer hover:text-white" onClick={() => handleNodePropertyChange(selectedNode.id, 'iocs', selectedNode.data.iocs.filter((_:any,idx:number) => idx !== i))}/>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={handleNodeTechnicalAudit}
                                    disabled={isIntelLoading}
                                    className="w-full py-2.5 bg-[#1d1e22] hover:bg-[#2a2c30] text-[#ececec] border border-[#333] rounded font-bold text-[10px] flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                                >
                                    <ShieldAlert size={14}/> TECH AUDIT
                                </button>
                                <button 
                                    onClick={handleFetchNodeIntel}
                                    disabled={isIntelLoading}
                                    className="w-full py-2.5 bg-[#1d1e22] hover:bg-[#2a2c30] text-[#ececec] border border-[#333] rounded font-bold text-[10px] flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                                >
                                    <Sparkles size={14}/> GLOBAL INTEL
                                </button>
                                <button 
                                    onClick={() => runSimulation(selectedNode.id)}
                                    disabled={isSimulating}
                                    className="col-span-2 w-full py-3 bg-[#d62828] hover:bg-[#b52222] text-white rounded font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                                >
                                    <Target size={14}/> SIMULATE COMPROMISE
                                </button>
                            </div>

                            {(isIntelLoading || nodeIntel) && (
                                <div className="bg-[#0a0a0a] border border-[#222328] rounded-lg p-4 shadow-inner relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-[#555] to-transparent animate-scan"></div>
                                    
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="text-[10px] font-bold text-[#888] uppercase tracking-widest flex items-center gap-2">
                                            <Bot size={12}/> Analysis Output
                                        </h4>
                                        {isIntelLoading && <Loader2 className="animate-spin text-[#d62828]" size={12}/>}
                                    </div>

                                    {isIntelLoading ? (
                                        <div className="py-8 flex flex-col items-center justify-center gap-3 text-[#555]">
                                            <Activity className="animate-pulse" size={32}/>
                                            <span className="text-[9px] font-mono uppercase tracking-[0.2em]">Syncing Intelligence Hub...</span>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="text-xs text-[#a0a0a0] leading-relaxed font-sans whitespace-pre-line border-l-2 border-[#d62828] pl-3 py-1">
                                                {nodeIntel?.text}
                                            </div>
                                            
                                            {nodeIntel?.sources && nodeIntel.sources.length > 0 && (
                                                <div className="pt-3 border-t border-[#222328]">
                                                    <div className="text-[9px] text-[#666] font-bold uppercase mb-2">Technical References</div>
                                                    <div className="space-y-1.5">
                                                        {nodeIntel.sources.map((s, i) => (
                                                            <a key={i} href={s.uri} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-2 bg-[#121316] rounded border border-[#222328] hover:border-[#444] group transition-all">
                                                                <span className="text-[10px] text-[#a0a0a0] truncate max-w-[200px]">{s.title || s.uri}</span>
                                                                <ExternalLink size={10} className="text-[#666] group-hover:text-[#fff]"/>
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : selectedEdge ? (
                        <div className="bg-[#111216] border border-[#222328] rounded-lg p-4 space-y-4 animate-fade-in shadow-sm">
                            <h4 className="text-xs font-bold text-[#888] uppercase flex items-center gap-2 border-b border-[#222328] pb-2">
                                <Cable size={14}/> Logic Flow Configuration
                            </h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[9px] font-bold text-[#666] uppercase block mb-1">Traffic Identity</label>
                                    <input className="w-full bg-[#0a0a0a] border border-[#333] rounded p-2 text-sm text-[#ececec] focus:border-[#555] outline-none font-mono" value={selectedEdge.label as string} onChange={e => handleNodePropertyChange(selectedEdge.id, 'label', e.target.value)} />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[9px] font-bold text-[#666] uppercase block mb-1">Protocol</label>
                                        <select 
                                            className="w-full bg-[#0a0a0a] border border-[#333] rounded p-2 text-[10px] text-[#ececec] outline-none font-mono"
                                            value={selectedEdge.data?.protocol}
                                            onChange={e => handleNodePropertyChange(selectedEdge.id, 'protocol', e.target.value)}
                                        >
                                            {PROTOCOLS.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-bold text-[#666] uppercase block mb-1">Port Range</label>
                                        <input 
                                            type="text" 
                                            className="w-full bg-[#0a0a0a] border border-[#333] rounded p-2 text-[10px] text-[#ececec] font-mono outline-none"
                                            value={selectedEdge.data?.portRange}
                                            onChange={(e) => handleNodePropertyChange(selectedEdge.id, 'portRange', e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-[#666] uppercase block mb-1">Firewall Status</label>
                                    <button 
                                        onClick={() => {
                                            const newVal = !(selectedEdge.data?.isPermissive ?? true);
                                            setEdges(eds => eds.map(e => e.id === selectedEdge.id ? { 
                                                ...e, 
                                                data: { ...e.data, isPermissive: newVal }, 
                                                style: { ...e.style, stroke: newVal ? '#444' : '#333', opacity: newVal ? 1 : 0.4 } 
                                            } : e));
                                            setSelectedEdge(null);
                                        }}
                                        className={`w-full py-2 rounded text-[10px] font-bold border transition-all ${selectedEdge.data?.isPermissive !== false ? 'bg-[#1a2e20] border-[#294d35] text-[#4fae63]' : 'bg-[#3b2a2a] border-[#ea4a4a] text-[#ea4a4a]'}`}
                                    >
                                        {selectedEdge.data?.isPermissive !== false ? 'ACTIVE FLOW (ALLOWED)' : 'DENIED (HARD DROP)'}
                                    </button>
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-[#666] uppercase block mb-1">Encryption</label>
                                    <select 
                                        className="w-full bg-[#0a0a0a] border border-[#333] rounded p-2 text-xs text-[#ececec] outline-none"
                                        value={selectedEdge.data?.encryption || 'TLS 1.3'}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setEdges(eds => eds.map(edge => edge.id === selectedEdge.id ? { ...edge, data: { ...edge.data, encryption: val } } : edge));
                                        }}
                                    >
                                        {ENCRYPTION_LEVELS.map(lvl => (
                                            <option key={lvl} value={lvl}>{lvl}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center p-10 text-center text-[#666] h-full">
                            <Network size={28} className="mb-3 opacity-50" />

                            <strong className="text-xs font-bold uppercase tracking-wider mb-2 block">
                                Select an asset to inspect
                            </strong>

                            <span className="text-[11px] leading-relaxed">
                                Choose a node or connection on the topology
                                canvas to view configuration, security posture,
                                relationships and available actions.
                            </span>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-[#222328] bg-[#0a0b0d]">
                    <button
                        onClick={handleSaveDiagram}
                        className="w-full py-2.5 flex items-center justify-center gap-2 rounded border border-[#2a2c30] bg-[#1a1c21] text-[#b0b0b0] text-[11px] font-bold uppercase tracking-wider hover:bg-[#22242a] hover:text-[#fff] transition-colors"
                    >
                        <Save size={14} />
                        Save to library
                    </button>
                </div>
            </div>

            {/* Modal: Stencil Creator */}
            {showStencilCreator && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setShowStencilCreator(false)}>
                    <div className="bg-[#111216] border border-[#222328] rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-[#222328] flex justify-between items-center bg-[#0a0b0d]">
                            <h3 className="text-lg font-bold text-[#ececec] flex items-center gap-2 uppercase tracking-tight"><Palette size={20} className="text-[#888]"/> DEFINE CUSTOM ASSET</h3>
                            <button onClick={() => setShowStencilCreator(false)} className="text-[#666] hover:text-white transition-colors p-1.5 rounded-full hover:bg-[#ffffff10]"><X size={20}/></button>
                        </div>
                        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold text-[#666] uppercase block mb-1">Asset Label</label>
                                    <input 
                                        type="text" 
                                        className="w-full bg-[#0a0a0a] border border-[#333] rounded p-2.5 text-sm text-[#ececec] font-mono focus:border-[#555] outline-none" 
                                        placeholder="e.g. Core Auth Server" 
                                        value={newStencil.label} 
                                        onChange={e => setNewStencil({...newStencil, label: e.target.value})}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-[#666] uppercase block mb-1">Node Type</label>
                                        <select 
                                            className="w-full bg-[#0a0a0a] border border-[#333] rounded p-2.5 text-xs text-[#ececec] outline-none focus:border-[#555]" 
                                            value={newStencil.type} 
                                            onChange={e => setNewStencil({...newStencil, type: e.target.value as any})}
                                        >
                                            <option value="standard">Component</option>
                                            <option value="gateway">Security Gateway</option>
                                            <option value="server">Compute / Server</option>
                                            <option value="storage">Storage / Data</option>
                                            <option value="endpoint">End-User Device</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-[#666] uppercase block mb-1">Icon Representation</label>
                                        <select 
                                            className="w-full bg-[#0a0a0a] border border-[#333] rounded p-2.5 text-xs text-[#ececec] outline-none focus:border-[#555]" 
                                            value={newStencil.iconName} 
                                            onChange={e => setNewStencil({...newStencil, iconName: e.target.value})}
                                        >
                                            {Object.keys(STENCIL_ICONS).sort().map(icon => <option key={icon} value={icon}>{icon}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-[#666] uppercase block mb-1">IP Address</label>
                                        <input 
                                            type="text" 
                                            className="w-full bg-[#0a0a0a] border border-[#333] rounded p-2.5 text-sm text-[#ececec] font-mono focus:border-[#555] outline-none" 
                                            placeholder="e.g. 10.0.0.1" 
                                            value={newStencil.ipAddress} 
                                            onChange={e => setNewStencil({...newStencil, ipAddress: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-[#666] uppercase block mb-1">VLAN Tag</label>
                                        <input 
                                            type="text" 
                                            className="w-full bg-[#0a0a0a] border border-[#333] rounded p-2.5 text-xs text-[#ececec] font-mono focus:border-[#555] outline-none" 
                                            placeholder="e.g. 10" 
                                            value={newStencil.vlan} 
                                            onChange={e => setNewStencil({...newStencil, vlan: e.target.value})}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-[#666] uppercase block mb-1">Default Criticality</label>
                                        <select 
                                            className="w-full bg-[#0a0a0a] border border-[#333] rounded p-2.5 text-xs text-[#ececec] outline-none focus:border-[#555]" 
                                            value={newStencil.criticality} 
                                            onChange={e => setNewStencil({...newStencil, criticality: e.target.value})}
                                        >
                                            {CRITICALITY_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-[#666] uppercase block mb-1">Theme Color</label>
                                        <select 
                                            className="w-full bg-[#0a0a0a] border border-[#333] rounded p-2.5 text-xs text-[#ececec] outline-none focus:border-[#555]" 
                                            value={newStencil.color} 
                                            onChange={e => setNewStencil({...newStencil, color: e.target.value})}
                                        >
                                            <option value="bg-blue-500">Blue</option>
                                            <option value="bg-red-500">Red</option>
                                            <option value="bg-green-500">Green</option>
                                            <option value="bg-purple-500">Purple</option>
                                            <option value="bg-pink-500">Pink</option>
                                            <option value="bg-orange-500">Orange</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-[#666] uppercase block mb-1">Data Sensitivity</label>
                                        <select 
                                            className="w-full bg-[#0a0a0a] border border-[#333] rounded p-2.5 text-xs text-[#ececec] outline-none focus:border-[#555]" 
                                            value={newStencil.sensitivity} 
                                            onChange={e => setNewStencil({...newStencil, sensitivity: e.target.value})}
                                        >
                                            {SENSITIVITY_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-[#666] uppercase block mb-1">Interface</label>
                                        <input 
                                            type="text" 
                                            className="w-full bg-[#0a0a0a] border border-[#333] rounded p-2.5 text-xs text-[#ececec] font-mono focus:border-[#555] outline-none" 
                                            placeholder="e.g. eth0" 
                                            value={newStencil.interface} 
                                            onChange={e => setNewStencil({...newStencil, interface: e.target.value})}
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col justify-end mt-4">
                                    <button 
                                        onClick={() => setNewStencil({...newStencil, internet: !newStencil.internet})}
                                        className={`w-full py-2.5 rounded text-[10px] font-bold border transition-all ${newStencil.internet ? 'bg-[#3b2a2a] border-[#ea4a4a] text-[#ea4a4a]' : 'bg-[#1a2e20] border-[#294d35] text-[#4fae63]'}`}
                                    >
                                        {newStencil.internet ? 'INTERNET EXPOSED' : 'INTERNAL ASSET'}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-[#0a0b0d] border-t border-[#222328] flex justify-end gap-3 shrink-0">
                            <button onClick={() => setShowStencilCreator(false)} className="px-4 py-2 text-xs font-bold text-[#888] hover:text-[#fff] uppercase transition-colors">Discard</button>
                            <button 
                                onClick={handleCreateStencil} 
                                disabled={!newStencil.label} 
                                className="px-8 py-2.5 bg-[#ececec] text-[#0a0a0a] hover:bg-[#fff] font-bold rounded-lg text-xs flex items-center gap-2 disabled:opacity-50 transition-all"
                            >
                                <Save size={16}/> SAVE TO PALETTE
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: AI Clarification */}
            {showClarificationModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in">
                    <div className="bg-[#111216] border border-[#222328] rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="p-4 border-b border-[#222328] flex justify-between items-center bg-[#0a0b0d]">
                            <h3 className="text-lg font-bold text-[#ececec] flex items-center gap-2 uppercase tracking-tight">
                                <MessageCircleQuestion size={20} className="text-[#ea4a4a]"/> ARCHITECTURAL CLARIFICATION
                            </h3>
                        </div>
                        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1 bg-[#121316]">
                            <div className="bg-[#2a1a1a] border border-[#ea4a4a40] p-4 rounded text-sm text-[#ea4a4a]">
                                <div className="font-bold flex items-center gap-2 mb-1"><Info size={16}/> ENGINE UNCERTAINTY</div>
                                The AI engine requires additional context to accurately map your network topology. Please provide answers to the technical questions below.
                            </div>
                            
                            <div className="space-y-6">
                                {clarificationQuestions.map((q, idx) => (
                                    <div key={idx} className="space-y-2">
                                        <div className="text-xs font-bold text-[#888] uppercase tracking-wider flex items-center gap-2">
                                            <span className="bg-[#222328] text-[#aaa] px-1.5 rounded font-mono text-[10px]">{idx + 1}</span>
                                            {q}
                                        </div>
                                        <textarea 
                                            className="w-full bg-[#0a0a0a] border border-[#333] rounded p-3 text-xs text-[#ececec] font-mono focus:border-[#555] outline-none resize-none"
                                            rows={2}
                                            placeholder="Provide technical detail..."
                                            value={userAnswers[idx] || ''}
                                            onChange={e => setUserAnswers(prev => ({ ...prev, [idx]: e.target.value }))}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="p-4 bg-[#0a0b0d] border-t border-[#222328] flex justify-end gap-3 shrink-0">
                            <button onClick={() => setShowClarificationModal(false)} className="px-4 py-2 text-xs font-bold text-[#888] hover:text-[#fff] uppercase transition-colors">Discard</button>
                            <button 
                                onClick={handleSubmitClarifications}
                                className="px-8 py-2.5 bg-[#ececec] text-[#0a0a0a] hover:bg-[#fff] font-bold rounded-lg text-xs flex items-center gap-2 transition-all"
                            >
                                <Check size={16}/> SUBMIT ANSWERS
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Toast System */}
            {toast && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] animate-fade-in-up">
                    <div className={`px-6 py-3 rounded-full border shadow-2xl flex items-center gap-3 backdrop-blur-md ${
                        toast.type === 'success' ? 'bg-green-900/40 border-green-500/50 text-green-300' :
                        toast.type === 'error' ? 'bg-red-900/40 border-red-500/50 text-red-300' :
                        'bg-blue-900/40 border-blue-500/50 text-blue-300'
                    }`}>
                        {toast.type === 'success' ? <CheckCircle size={18}/> : <Info size={18}/>}
                        <span className="text-sm font-bold uppercase tracking-widest">{toast.message}</span>
                    </div>
                </div>
            )}
        </div>
    );
};