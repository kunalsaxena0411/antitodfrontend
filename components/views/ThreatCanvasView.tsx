
import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
import { 
    Shield, Server, Database, User, Zap, Download, Activity, Loader2, AlertTriangle, CheckCircle, 
    Layers, Cpu, HardDrive, Globe, Lock, Cloud, 
    ShieldAlert, Users, Terminal, Share2, Box, Radio, Search, 
    Trash2, Save, Plus, Laptop, Smartphone,
    Network, Key, DatabaseZap, HardHat, FileWarning, Bomb,
    Skull, FileJson, ChevronDown, List,
    Target, Radar, Fingerprint, Flame,
    PlusCircle, Monitor, Wifi, Tablet, 
    HardDriveDownload, LockKeyhole, Landmark, X, Palette,
    GitBranch, GitMerge, Binary, Factory, Brain, Link, Cable, Power, Unplug, ToyBrick,
    Brackets, Container, Workflow, Webhook, Router,
    UserPlus, UserCheck,
    Send, Boxes, Microchip, FileKey, FastForward, Repeat, Command,
    Watch, Briefcase, Building, Code, Construction, ShieldCheck,
    AlertCircle, Info, RotateCcw, Smartphone as MobileIcon, Monitor as DesktopIcon,
    HardDrive as DiskIcon, Key as KeyIcon, Database as DbIcon, Fingerprint as BiometricIcon,
    ArrowRightLeft, Settings2, BarChart3, Gauge, Eye, MessageCircle,
    UserMinus, Landmark as Bank, HardHat as ConstructionIcon,
    SmartphoneNfc, Bluetooth, WifiOff, FileSignature, CreditCard, Scale,
    AppWindow, Ghost, KeyRound, LockKeyholeOpen, History,
    Camera, ShoppingCart, Archive, Bot, ArrowDownUp, RefreshCcw, GitGraph, Package, CircleEllipsis,
    Component, Code2, FileSearch, MessageSquareText,
    KeySquare, PhoneCall, Bell, Contact, Gavel, FileCheck, ClipboardCheck,
    Settings, RadioReceiver, ScanFace, ScanLine, DoorOpen, ShieldQuestion,
    Mail, Siren, Layout, ArrowUpRight, ArrowUpRightFromCircle, ShieldQuestion as FirewallIcon,
    Globe2, ServerCog, DatabaseBackup, Network as SubnetIcon
} from 'lucide-react';
import { analyzeArchitecture } from '../../services/aiConverter';
import { ThreatRecord, ThreatModelData, TopologyNodeData, TopologyEdgeData } from '../../types';
import { downloadFile, generateThreatModelPDF } from '../../services/exporter';
import { saveToStorage, loadFromStorage, STORES } from '../../services/storage';

// --- INTERNAL HELPERS ---

const CheckIcon = ({ size, className }: { size: number, className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="20 6 9 17 4 12"/></svg>
);

const STENCIL_ICONS: Record<string, any> = {
    Shield, Server, Database, User, Zap, Activity, Globe, Lock, Cloud, Box, Radio, 
    Cpu, Laptop, Smartphone, Network, Key, Landmark, Monitor, Wifi, Tablet, Flame,
    Watch, HardDrive, Briefcase, Building, Code, Construction, Users, Terminal, Layers,
    GitBranch, GitMerge, Binary, Factory, Brain, Link, Cable, Power, Unplug, ToyBrick,
    Brackets, Container, Workflow, DbIcon: Database, ShieldCheck, KeyIcon: Key, UserCheck, Webhook, Router,
    MobileIcon, LaptopIcon: Laptop, DesktopIcon: Monitor, DiskIcon: HardDrive, Keyhole: LockKeyhole, UserPlus, BiometricIcon: Fingerprint,
    Send, Processor: Cpu, Boxes, Microchip, Storage: HardDrive, Vault: FileKey, FastForward, Repeat, Command,
    KeyRound, Ghost, CreditCard, Scale, FileSignature, SmartphoneNfc,
    Camera, ShoppingCart, Archive, Bot, ArrowDownUp, RefreshCcw, GitGraph, Package, CircleEllipsis,
    Component, Code2, FileSearch, MessageSquareText,
    KeySquare, TapeDrive: HardDrive, PhoneCall, Bell, Contact, Gavel, FileCheck, ClipboardCheck,
    Settings, ServerRack: HardDrive, RadioReceiver, ScanFace, ScanLine, DoorOpen, ShieldQuestion,
    Mail, Siren, HsmIcon: FileKey, PodIcon: Monitor, VpcIcon: Layers, ApiGwIcon: Share2, QueueIcon: MessageSquareText, StreamIcon: Activity, WarehouseIcon: Database,
    Firewall: ShieldAlert, Waf: ShieldCheck, LoadBalancer: ArrowDownUp, Proxy: ArrowRightLeft,
    Vpc: Cloud, Subnet: SubnetIcon, Logic: Brain, Mainframe: ServerCog, DB: Database,
    MainframeIcon: ServerCog, Loop: RefreshCcw
};

// --- CUSTOM NODES ---

const CyberNode = ({ data, selected, icon: DefaultIcon, colorClass, borderClass, typeLabel }: any) => {
    const Icon = data.iconName && STENCIL_ICONS[data.iconName] ? STENCIL_ICONS[data.iconName] : DefaultIcon;
    const dynamicColor = data.colorClass || colorClass;
    const dynamicBorder = data.borderClass || borderClass;
    
    const hasActiveThreat = data.iocs?.length > 0 || data.vulnerabilities?.length > 0;
    const isCritical = data.criticality === 'HIGH' || data.criticality === 'MISSION_CRITICAL';

    return (
        <div className={`
            p-4 rounded-lg border-2 shadow-2xl transition-all duration-300 min-w-[220px] relative 
            ${selected ? `${dynamicBorder} ring-4 ring-cyber-cyan/20 scale-[1.02]` : 'border-gray-800'} 
            ${hasActiveThreat ? 'shadow-[0_0_20px_rgba(239,68,68,0.4)] border-red-600' : ''}
            ${isCritical && !hasActiveThreat ? 'shadow-[0_0_15px_rgba(249,115,22,0.2)]' : ''}
            bg-[#0a0f1e]/95 backdrop-blur-md cursor-grab active:cursor-grabbing
        `}>
            <Handle type="target" position={Position.Top} className="!bg-cyber-cyan !w-3 !h-3 !-top-1.5" />
            
            <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-lg bg-opacity-20 ${hasActiveThreat ? 'bg-red-500 text-red-500' : dynamicColor}`}>
                    <Icon size={22} className={hasActiveThreat ? 'animate-pulse' : (dynamicColor.replace('bg-', 'text-'))} />
                </div>
                <div className="flex-1 overflow-hidden">
                    <div className="text-[9px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-0.5 opacity-70">{typeLabel}</div>
                    <input 
                        className="bg-transparent text-sm font-bold text-white font-mono truncate w-full focus:outline-none border-b border-transparent focus:border-cyber-cyan/50"
                        value={data.label}
                        onChange={(e) => { data.onLabelChange(data.id, e.target.value); }}
                    />
                </div>
            </div>
            
            <div className="mt-3 pt-3 border-t border-gray-800 flex flex-wrap gap-1.5">
                <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase border ${data.isExternal ? 'bg-red-900/30 text-red-400 border-red-500/30' : 'bg-green-900/30 text-green-400 border-green-500/30'}`}>
                    {data.isExternal ? 'External' : 'Internal'}
                </span>
                {data.sensitivity && data.sensitivity !== 'None' && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded font-bold uppercase bg-purple-900/30 text-purple-400 border border-purple-500/30">
                        {data.sensitivity}
                    </span>
                )}
                {data.vulnerabilities?.length > 0 && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded font-bold uppercase bg-orange-900/30 text-orange-400 border border-orange-500/30 flex items-center gap-1">
                        <Flame size={8}/> {data.vulnerabilities.length} CVEs
                    </span>
                )}
            </div>

            {selected && (
                <div className="absolute -top-3 -right-3 p-1.5 bg-cyber-cyan rounded-full text-black shadow-lg animate-pulse">
                    <CheckIcon size={12} />
                </div>
            )}
            <Handle type="source" position={Position.Bottom} className="!bg-cyber-cyan !w-3 !h-3 !-bottom-1.5" />
        </div>
    );
};

const ActorNode = (props: any) => <CyberNode {...props} icon={User} colorClass="bg-green-500" borderClass="border-green-500" typeLabel="Entity" />;
const ComputeNode = (props: any) => <CyberNode {...props} icon={Cpu} colorClass="bg-blue-500" borderClass="border-blue-500" typeLabel="Process" />;
const StorageNode = (props: any) => <CyberNode {...props} icon={Database} colorClass="bg-pink-500" borderClass="border-pink-500" typeLabel="Storage" />;
const NetworkNode = (props: any) => <CyberNode {...props} icon={Share2} colorClass="bg-indigo-500" borderClass="border-indigo-500" typeLabel="Interlink" />;
const TacticNode = (props: any) => <CyberNode {...props} icon={Radar} colorClass="bg-purple-500" borderClass="border-purple-500" typeLabel="Tactic" />;

const RiskNode = (props: any) => (
    <div className={`p-3 rounded-lg border-2 shadow-2xl transition-all duration-300 min-w-[160px] relative ${props.selected ? 'border-orange-500 ring-4 ring-orange-500/20' : 'border-red-900'} bg-[#1a0505]/90 backdrop-blur-md cursor-grab active:cursor-grabbing`}>
        <Handle type="target" position={Position.Top} className="!bg-red-500 !w-2 !h-2 !-top-1" />
        <div className="flex items-center gap-2">
            <div className="p-2 rounded bg-red-500/20 text-red-500">
                <Bomb size={18} />
            </div>
            <div className="flex-1 overflow-hidden">
                <div className="text-[8px] font-bold text-red-600 uppercase tracking-widest mb-0.5">Vulnerability</div>
                <input 
                    className="bg-transparent text-xs font-bold text-red-100 font-mono truncate w-full focus:outline-none border-b border-transparent focus:border-red-500/50"
                    value={props.data.label}
                    onChange={(e) => { props.data.onLabelChange(props.id, e.target.value); }}
                />
            </div>
        </div>
        <Handle type="source" position={Position.Bottom} className="!bg-red-500 !w-2 !h-2 !-bottom-1" />
    </div>
);

const BoundaryNode = (props: any) => (
    <div className={`p-8 rounded-xl border-2 border-dashed transition-all duration-300 min-w-[400px] min-h-[250px] relative ${props.selected ? 'border-red-500 bg-red-900/10' : 'border-gray-800 bg-gray-900/10'} cursor-grab active:cursor-grabbing`}>
        <div className="absolute -top-3 left-4 px-3 py-1 bg-[#020617] border border-gray-700 rounded text-[10px] font-bold text-red-500 uppercase flex items-center gap-2 z-10 shadow-lg">
            <Shield size={12}/> Trust Boundary
        </div>
        <input 
            className="absolute top-4 left-4 bg-transparent text-xs font-bold text-gray-400 uppercase tracking-widest focus:outline-none z-10 border-b border-transparent focus:border-gray-700"
            value={props.data.label}
            onChange={(e) => { props.data.onLabelChange(props.id, e.target.value); }}
        />
    </div>
);

const nodeTypes = {
    actor: ActorNode,
    compute: ComputeNode,
    storage: StorageNode,
    network: NetworkNode,
    boundary: BoundaryNode,
    risk: RiskNode,
    tactic: TacticNode
};

// --- STENCIL DEFINITIONS ---

const STENCIL_LIBRARY = [
    {
        title: 'Compute & Logic',
        items: [
            { id: 'web_server', type: 'compute', iconName: 'Globe', label: 'Web Service', color: 'bg-blue-500', description: 'Application front-end' },
            { id: 'app_srv', type: 'compute', iconName: 'Server', label: 'App Logic', color: 'bg-blue-600', description: 'Business processing' },
            { id: 'k8s_pod', type: 'compute', iconName: 'Monitor', label: 'Container/Pod', color: 'bg-cyan-500', description: 'Containerized unit' },
            { id: 'lambda_fn', type: 'compute', iconName: 'Zap', label: 'Serverless', color: 'bg-amber-500', description: 'Function-as-a-Service' },
            { id: 'mainframe', type: 'compute', iconName: 'MainframeIcon', label: 'Legacy Core', color: 'bg-slate-600', description: 'Central compute' },
            { id: 'logic', type: 'compute', iconName: 'Logic', label: 'Edge Worker', color: 'bg-indigo-400', description: 'CDNs/Edge logic' },
        ]
    },
    {
        title: 'Network & Security',
        items: [
            { id: 'firewall', type: 'network', iconName: 'Firewall', label: 'Firewall', color: 'bg-red-600', description: 'Access control' },
            { id: 'waf', type: 'network', iconName: 'Waf', label: 'WAF', color: 'bg-red-500', description: 'Web app protection' },
            { id: 'api_gateway', type: 'network', iconName: 'ApiGwIcon', label: 'API Gateway', color: 'bg-indigo-400', description: 'API orchestration' },
            { id: 'lb', type: 'network', iconName: 'LoadBalancer', label: 'Load Balancer', color: 'bg-blue-400', description: 'Traffic distribution' },
            { id: 'proxy', type: 'network', iconName: 'Proxy', label: 'Proxy / LB', color: 'bg-emerald-500', description: 'Intermediary server' },
            { id: 'vpn', type: 'network', iconName: 'Link', label: 'VPN Tunnel', color: 'bg-cyan-600', isExternal: true, description: 'Secure link' },
        ]
    },
    {
        title: 'Storage & Data',
        items: [
            { id: 'sql_db', type: 'storage', iconName: 'Database', label: 'Relational DB', color: 'bg-pink-500', sensitivity: 'PII', description: 'Structured data' },
            { id: 'nosql_db', type: 'storage', iconName: 'DatabaseZap', label: 'NoSQL Store', color: 'bg-pink-600', description: 'Unstructured data' },
            { id: 'bucket', type: 'storage', iconName: 'Box', label: 'Cloud Bucket', color: 'bg-orange-500', sensitivity: 'Protected', description: 'Object storage' },
            { id: 'hsm', type: 'storage', iconName: 'HsmIcon', label: 'HSM / Vault', color: 'bg-yellow-500', sensitivity: 'Secret', description: 'Keys & Secrets' },
            { id: 'archive', type: 'storage', iconName: 'Archive', label: 'Tape / Cold', color: 'bg-stone-500', description: 'Backup storage' },
        ]
    },
    {
        title: 'Actors & Entities',
        items: [
            { id: 'user', type: 'actor', iconName: 'User', label: 'Generic User', color: 'bg-green-500', description: 'Standard persona' },
            { id: 'admin', type: 'actor', iconName: 'UserCheck', label: 'Privileged User', color: 'bg-blue-500', description: 'Administrator' },
            { id: 'partner', type: 'actor', iconName: 'UserPlus', label: '3rd Party', color: 'bg-amber-400', isExternal: true, description: 'Partner/Vendor' },
            { id: 'iot', type: 'actor', iconName: 'Radio', label: 'IoT Sensor', color: 'bg-cyan-400', description: 'Connected hardware' },
            { id: 'bot', type: 'actor', iconName: 'Bot', label: 'Service Bot', color: 'bg-purple-400', description: 'Automated entity' },
            { id: 'attacker', type: 'actor', iconName: 'Skull', label: 'Threat Actor', color: 'bg-red-800', isExternal: true, description: 'Adversary' },
        ]
    },
    {
        title: 'Boundaries',
        items: [
            { id: 'b_region', type: 'boundary', iconName: 'Cloud', label: 'Cloud VPC', color: 'bg-blue-900' },
            { id: 'b_dmz', type: 'boundary', iconName: 'Shield', label: 'DMZ Segment', color: 'bg-orange-900' },
            { id: 'b_internet', type: 'boundary', iconName: 'Globe', label: 'Public Web', color: 'bg-red-900' },
            { id: 'b_mgmt', type: 'boundary', iconName: 'Settings', label: 'Mgmt Plane', color: 'bg-purple-900' },
        ]
    }
];

const SENSITIVITY_LEVELS = ['None', 'Public', 'Internal', 'Confidential', 'Restricted', 'Protected', 'PII', 'PHI', 'Financial', 'Secret'];
const CRITICALITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'MISSION_CRITICAL'];
const PROTOCOLS = ['HTTPS', 'HTTP', 'SQL', 'SSH', 'gRPC', 'AMQP', 'LDAP', 'DNS', 'SMB', 'FTP', 'SMTP', 'Custom'];
const ENCRYPTION_LEVELS = ['None', 'TLS 1.2', 'TLS 1.3', 'IPSec', 'SSH-Encrypted', 'VPN'];
const AUTH_METHODS = ['None', 'OAuth2', 'JWT', 'Basic', 'mTLS', 'API Key', 'Kerberos'];

export const ThreatCanvasView: React.FC = () => {
    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [paletteSearch, setPaletteSearch] = useState('');
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'info' | 'error' } | null>(null);
    
    const [framework, setFramework] = useState<'STRIDE' | 'PASTA' | 'LINDDUN' | 'NIST_AI'>('STRIDE');

    const [workspaces, setWorkspaces] = useState<ThreatModelData[]>(() => {
        return [{ id: 'ws-1', name: 'Modeling Workspace 1', nodes: [], edges: [], threats: [], activeFramework: 'STRIDE' }];
    });
    const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('ws-1');

    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [threats, setThreats] = useState<ThreatRecord[]>([]);
    
    const [customStencils, setCustomStencils] = useState<any[]>([]);
    const [showStencilCreator, setShowStencilCreator] = useState(false);
    const [newStencil, setNewStencil] = useState({
        label: '',
        description: '',
        type: 'compute',
        iconName: 'Box',
        color: 'bg-blue-500',
        isExternal: false,
        sensitivity: 'None',
        criticality: 'MEDIUM'
    });

    const [savedModels, setSavedModels] = useState<ThreatModelData[]>([]);
    const [showModelsList, setShowModelsList] = useState(false);

    // Temp inputs for Intel Mapping
    const [newCve, setNewCve] = useState('');
    const [newIoc, setNewIoc] = useState('');
    const [newMitre, setNewMitre] = useState('');

    useEffect(() => {
        const ws = workspaces.find(w => w.id === activeWorkspaceId);
        if (ws) {
            setNodes(ws.nodes.map(n => ({ ...n, data: { ...n.data, onLabelChange } })));
            setEdges(ws.edges);
            setThreats(ws.threats || []);
            setFramework(ws.activeFramework || 'STRIDE');
        }
    }, [activeWorkspaceId]);

    useEffect(() => {
        setWorkspaces(prev => prev.map(ws => 
            ws.id === activeWorkspaceId 
            ? { ...ws, nodes, edges, threats, activeFramework: framework } 
            : ws
        ));
    }, [nodes, edges, threats, activeWorkspaceId, framework]);

    useEffect(() => {
        const loadInitData = async () => {
            const models = await loadFromStorage(STORES.THREAT_MODELS, 'list');
            if (models && Array.isArray(models)) setSavedModels(models);
            const stencils = await loadFromStorage(STORES.CUSTOM_STENCILS, 'list');
            if (stencils && Array.isArray(stencils)) setCustomStencils(stencils);
        };
        loadInitData();
    }, []);

    const showToast = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const onLabelChange = useCallback((id: string, label: string) => {
        setNodes((nds) => nds.map((node) => {
            if (node.id === id) return { ...node, data: { ...node.data, label } };
            return node;
        }));
    }, [setNodes]);

    const onPropertyChange = useCallback((id: string, key: string, value: any) => {
        setNodes((nds) => nds.map((node) => {
            if (node.id === id) {
                const updatedNode = { ...node, data: { ...node.data, [key]: value } };
                if (selectedNode?.id === id) setSelectedNode(updatedNode);
                return updatedNode;
            }
            return node;
        }));
    }, [selectedNode, setNodes]);

    const onEdgePropertyChange = useCallback((id: string, key: string, value: any) => {
        setEdges((eds) => eds.map((edge) => {
            if (edge.id === id) {
                const updatedData = { ...edge.data, [key]: value };
                const updatedEdge = { 
                    ...edge, 
                    data: updatedData,
                    label: key === 'label' ? value : edge.label
                };
                if (selectedEdge?.id === id) setSelectedEdge(updatedEdge);
                return updatedEdge;
            }
            return edge;
        }));
    }, [selectedEdge, setEdges]);

    const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge({ 
        ...params, 
        animated: true, 
        label: 'TRAFFIC',
        data: {
            protocol: 'HTTPS',
            portRange: '443',
            encryption: 'TLS 1.3',
            authentication: 'None',
            mitreIds: []
        },
        labelStyle: { fill: '#4361ee', fontWeight: 700, fontSize: 8 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#4361ee' },
        style: { stroke: '#4361ee', strokeWidth: 2 }
    }, eds)), [setEdges]);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();
            if (!reactFlowInstance) return;
            const type = event.dataTransfer.getData('application/reactflow/type');
            const label = event.dataTransfer.getData('application/reactflow/label');
            const description = event.dataTransfer.getData('application/reactflow/description');
            const sensitivity = event.dataTransfer.getData('application/reactflow/sensitivity') || 'None';
            const criticality = event.dataTransfer.getData('application/reactflow/criticality') || 'MEDIUM';
            const isExternal = event.dataTransfer.getData('application/reactflow/isExternal') === 'true';
            const iconName = event.dataTransfer.getData('application/reactflow/iconName');
            const colorClass = event.dataTransfer.getData('application/reactflow/colorClass');
            if (!type) return;
            const position = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
            const id = `${type}-${Date.now()}`;
            const newNode = {
                id, type, position,
                data: { 
                    label: label || 'New Unit', 
                    description: description || '',
                    onLabelChange, id, sensitivity, isExternal, criticality,
                    vulnerabilities: [], iocs: [], mitreIds: [],
                    iconName: iconName || undefined,
                    colorClass: colorClass || undefined,
                    borderClass: colorClass ? colorClass.replace('bg-', 'border-') : undefined
                },
            };
            setNodes((nds) => nds.concat(newNode));
        },
        [reactFlowInstance, setNodes, onLabelChange]
    );

    const handleCreateStencil = async () => {
        if (!newStencil.label) return;
        const stencil = { ...newStencil, id: `custom-st-${Date.now()}` };
        const updated = [...customStencils, stencil];
        setCustomStencils(updated);
        await saveToStorage(STORES.CUSTOM_STENCILS, updated, 'list');
        setShowStencilCreator(false);
        setNewStencil({ label: '', description: '', type: 'compute', iconName: 'Box', color: 'bg-blue-500', isExternal: false, sensitivity: 'None', criticality: 'MEDIUM' });
        showToast("Custom stencil added", "success");
    };

    const handleRunAnalysis = async () => {
        setIsAnalyzing(true);
        const manualThreats = threats.filter(t => t.id.startsWith('manual-'));
        setThreats(manualThreats);
        const graphData = {
            nodes: nodes.map(n => ({ 
                id: n.id, label: n.data.label, type: n.type, 
                isExternal: n.data.isExternal, sensitivity: n.data.sensitivity,
                criticality: n.data.criticality, vulnerabilities: n.data.vulnerabilities,
                iocs: n.data.iocs, mitreIds: n.data.mitreIds
            })),
            edges: edges.map(e => ({ 
                id: e.id, source: e.source, target: e.target, label: e.label,
                protocol: e.data?.protocol, portRange: e.data?.portRange,
                encryption: e.data?.encryption, authentication: e.data?.authentication,
                mitreIds: e.data?.mitreIds
            }))
        };
        try {
            const results = await analyzeArchitecture(JSON.stringify(graphData), framework);
            setThreats(prev => [...prev, ...results]);
            showToast(`${framework} Audit Complete`, "success");
        } catch (e) {
            showToast("AI Framework Analysis Failed", "error");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleClearCanvas = () => {
        if (isAnalyzing) return;
        if (window.confirm("Clear all nodes and connections? This will reset the current workspace.")) {
            setNodes([]);
            setEdges([]);
            setThreats([]);
            setSelectedNode(null);
            setSelectedEdge(null);
            showToast("Workspace cleared", "info");
        }
    };

    const handleSaveToDB = async () => {
        const serializableNodes = nodes.map(node => ({
            ...node,
            data: Object.fromEntries(Object.entries(node.data).filter(([_, value]) => typeof value !== 'function'))
        }));
        const modelId = activeWorkspaceId.startsWith('ws-') ? crypto.randomUUID() : activeWorkspaceId;
        const activeWs = workspaces.find(w => w.id === activeWorkspaceId);
        const modelData: ThreatModelData = {
            id: modelId, name: activeWs?.name || 'Untitled', nodes: serializableNodes, edges: edges, threats: threats, lastAnalyzed: new Date().toISOString(), activeFramework: framework
        };
        const updatedModels = [modelData, ...savedModels.filter(m => m.id !== modelId)];
        setSavedModels(updatedModels);
        await saveToStorage(STORES.THREAT_MODELS, updatedModels, 'list');
        showToast("Model persisted", "success");
    };

    const filteredPalette = useMemo(() => {
        let combined = [...STENCIL_LIBRARY];
        if (customStencils.length > 0) combined = [{ title: 'Custom Stencils', items: customStencils }, ...combined];
        if (!paletteSearch) return combined;
        const lower = paletteSearch.toLowerCase();
        return combined.map(group => ({
            ...group,
            items: group.items.filter(item => item.label.toLowerCase().includes(lower))
        })).filter(group => group.items.length > 0);
    }, [paletteSearch, customStencils]);

    return (
        <div className="h-full flex bg-[#020617] text-gray-300 font-sans overflow-hidden">
            {/* Sidebar: Palette */}
            <div className="w-80 bg-[#050b1a] border-r border-gray-800 flex flex-col shrink-0 relative z-20 shadow-2xl">
                <div className="p-5 border-b border-gray-800 bg-gray-900/20">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xs font-bold text-cyber-cyan uppercase tracking-[0.2em] flex items-center gap-2">
                            <Layers size={14}/> STENCILS
                        </h2>
                        <div className="flex gap-2">
                            <button onClick={() => setShowStencilCreator(true)} className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white" title="Custom Stencil"><Plus size={16}/></button>
                            <button onClick={() => setShowModelsList(!showModelsList)} className={`p-1.5 rounded ${showModelsList ? 'bg-indigo-600 text-white' : 'hover:bg-white/10 text-gray-400'}`} title="Library"><List size={16}/></button>
                        </div>
                    </div>
                    <div className="relative group">
                        <Search className="absolute left-3 top-2.5 text-gray-500" size={16}/>
                        <input type="text" className="w-full bg-black border border-gray-800 rounded-lg py-2 pl-10 pr-4 text-sm focus:border-cyber-cyan outline-none font-mono" placeholder="Search components..." value={paletteSearch} onChange={(e) => setPaletteSearch(e.target.value)}/>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-8 animate-fade-in">
                    {filteredPalette.map(group => (
                        <div key={group.title}>
                            <h3 className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3 flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-gray-600"></div> {group.title}</h3>
                            <div className="grid grid-cols-1 gap-2">
                                {group.items.map(item => (
                                    <div key={item.id} draggable onDragStart={(e) => { 
                                        e.dataTransfer.setData('application/reactflow/type', item.type); 
                                        e.dataTransfer.setData('application/reactflow/label', item.label); 
                                        e.dataTransfer.setData('application/reactflow/iconName', item.iconName || ''); 
                                        e.dataTransfer.setData('application/reactflow/colorClass', item.color || ''); 
                                        e.dataTransfer.setData('application/reactflow/isExternal', String(item.isExternal || false)); 
                                        e.dataTransfer.setData('application/reactflow/sensitivity', item.sensitivity || 'None');
                                        e.dataTransfer.setData('application/reactflow/criticality', item.criticality || 'MEDIUM');
                                    }} className="p-3 bg-gray-900/40 border border-gray-800 rounded-lg cursor-grab hover:border-cyber-cyan/50 hover:bg-gray-800 transition-all group text-left"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded bg-opacity-10 ${item.color || 'bg-blue-500'}`}>{React.createElement(STENCIL_ICONS[item.iconName] || Box, { size: 16, className: (item.color || 'bg-blue-500').replace('bg-', 'text-') })}</div>
                                            <div className="text-[11px] font-bold text-gray-400 group-hover:text-white transition-colors">{item.label}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                
                <div className="mt-auto p-4 border-t border-gray-800 bg-gray-900/20 space-y-3">
                    <button onClick={handleRunAnalysis} disabled={isAnalyzing || nodes.length === 0} className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xl active:scale-95 disabled:opacity-50">
                        {isAnalyzing ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} fill="currentColor"/>}
                        RUN THREAT AUDIT
                    </button>
                </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 flex flex-col min-w-0 relative">
                <div className="bg-[#0a0f1e] border-b border-gray-800 flex items-center px-4 gap-1 shrink-0 h-12">
                    <div className="text-xs font-bold text-gray-500 px-4">Workspace: {workspaces.find(w => w.id === activeWorkspaceId)?.name}</div>
                    <div className="flex gap-2 ml-auto pr-4">
                        <button onClick={handleClearCanvas} className="p-1.5 hover:bg-red-900/20 rounded text-red-500" title="Clear Canvas"><RotateCcw size={16}/></button>
                        <button onClick={handleSaveToDB} className="p-1.5 hover:bg-white/10 rounded text-cyber-cyan" title="Save Model"><Save size={16}/></button>
                    </div>
                </div>

                <div className="flex-1 relative bg-[#020617] overflow-hidden">
                    <ReactFlow 
                        nodes={nodes} 
                        edges={edges} 
                        nodeTypes={nodeTypes} 
                        onNodesChange={onNodesChange} 
                        onEdgesChange={onEdgesChange} 
                        onConnect={onConnect} 
                        onInit={setReactFlowInstance} 
                        onDrop={onDrop} 
                        onDragOver={(e) => e.preventDefault()} 
                        onNodeClick={(_, n) => { setSelectedNode(n); setSelectedEdge(null); }} 
                        onEdgeClick={(_, e) => { setSelectedEdge(e); setSelectedNode(null); }} 
                        onPaneClick={() => { setSelectedNode(null); setSelectedEdge(null); }} 
                        fitView 
                        className="bg-[#020617]"
                    >
                        <Background color="#1e293b" gap={20} size={1} />
                        <Controls />
                    </ReactFlow>
                </div>
            </div>

            {/* Right Sidebar: Intel & Properties */}
            <div className="w-96 bg-[#050b1a] border-l border-gray-800 flex flex-col shrink-0 relative z-20">
                <div className="p-5 border-b border-gray-800 bg-gray-900/20">
                    <h2 className="text-xs font-bold text-orange-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        <Gauge size={14}/> {selectedNode ? 'ASSET INTEL' : selectedEdge ? 'FLOW LOGIC' : 'THREATS'}
                    </h2>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
                    {selectedNode ? (
                        <div className="space-y-6 animate-fade-in">
                            <div className="bg-gray-900/50 p-4 rounded border border-gray-800 space-y-4">
                                <div>
                                    <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Asset Identity</div>
                                    <input className="w-full bg-black border border-gray-700 rounded p-2 text-sm text-white focus:border-cyber-cyan outline-none font-mono" value={selectedNode.data.label} onChange={(e) => onLabelChange(selectedNode.id, e.target.value)} />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[9px] text-gray-500 uppercase font-bold mb-1 block">Criticality</label>
                                        <select className="w-full bg-black border border-gray-700 rounded p-2 text-[10px] text-white outline-none" value={selectedNode.data.criticality} onChange={(e) => onPropertyChange(selectedNode.id, 'criticality', e.target.value)}>{CRITICALITY_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}</select>
                                    </div>
                                    <div>
                                        <label className="text-[9px] text-gray-500 uppercase font-bold mb-1 block">Sensitivity</label>
                                        <select className="w-full bg-black border border-gray-700 rounded p-2 text-[10px] text-white outline-none" value={selectedNode.data.sensitivity} onChange={(e) => onPropertyChange(selectedNode.id, 'sensitivity', e.target.value)}>{SENSITIVITY_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}</select>
                                    </div>
                                </div>
                                <button onClick={() => onPropertyChange(selectedNode.id, 'isExternal', !selectedNode.data.isExternal)} className={`w-full py-2 rounded text-[10px] font-bold border transition-all ${selectedNode.data.isExternal ? 'bg-red-900/20 border-red-500/50 text-red-400' : 'bg-green-900/30 text-green-400 border border-green-500/30'}`}>{selectedNode.data.isExternal ? 'PUBLIC FACING' : 'INTERNAL ASSET'}</button>
                            </div>

                            {/* Threat Intelligence Mapping */}
                            <div className="bg-red-900/5 border border-red-500/20 rounded-lg p-4 space-y-4">
                                <h3 className="text-[10px] font-bold text-red-400 uppercase flex items-center gap-2"><Siren size={12}/> Intel Mapping</h3>
                                
                                <div className="space-y-3">
                                    <div className="flex gap-2">
                                        <input type="text" className="flex-1 bg-black border border-gray-700 rounded p-2 text-[10px] text-white font-mono" placeholder="CVE-2024-..." value={newCve} onChange={e => setNewCve(e.target.value)}/>
                                        <button onClick={() => { if(newCve) { onPropertyChange(selectedNode.id, 'vulnerabilities', [...selectedNode.data.vulnerabilities, newCve]); setNewCve(''); } }} className="px-3 bg-gray-800 rounded border border-gray-700 text-xs hover:bg-gray-700">+</button>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {selectedNode.data.vulnerabilities?.map((v: string) => (
                                            <span key={v} className="px-2 py-0.5 bg-orange-900/30 text-orange-400 border border-orange-500/30 rounded text-[9px] font-mono flex items-center gap-1">{v} <X size={8} className="cursor-pointer" onClick={() => onPropertyChange(selectedNode.id, 'vulnerabilities', selectedNode.data.vulnerabilities.filter((item:string)=>item!==v))}/></span>
                                        ))}
                                    </div>

                                    <div className="flex gap-2">
                                        <input type="text" className="flex-1 bg-black border border-gray-700 rounded p-2 text-[10px] text-white font-mono" placeholder="MITRE T1059..." value={newMitre} onChange={e => setNewMitre(e.target.value)}/>
                                        <button onClick={() => { if(newMitre) { onPropertyChange(selectedNode.id, 'mitreIds', [...selectedNode.data.mitreIds, newMitre]); setNewMitre(''); } }} className="px-3 bg-gray-800 rounded border border-gray-700 text-xs hover:bg-gray-700">+</button>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {selectedNode.data.mitreIds?.map((tid: string) => (
                                            <span key={tid} className="px-2 py-0.5 bg-blue-900/30 text-blue-400 border border-blue-500/30 rounded text-[9px] font-mono flex items-center gap-1">{tid} <X size={8} className="cursor-pointer" onClick={() => onPropertyChange(selectedNode.id, 'mitreIds', selectedNode.data.mitreIds.filter((item:string)=>item!==tid))}/></span>
                                        ))}
                                    </div>

                                    <div className="flex gap-2">
                                        <input type="text" className="flex-1 bg-black border border-gray-700 rounded p-2 text-[10px] text-white font-mono" placeholder="IOC (IP/Domain)..." value={newIoc} onChange={e => setNewIoc(e.target.value)}/>
                                        <button onClick={() => { if(newIoc) { onPropertyChange(selectedNode.id, 'iocs', [...selectedNode.data.iocs, newIoc]); setNewIoc(''); } }} className="px-3 bg-gray-800 rounded border border-gray-700 text-xs hover:bg-gray-700">+</button>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {selectedNode.data.iocs?.map((ioc: string) => (
                                            <span key={ioc} className="px-2 py-0.5 bg-red-900/50 text-white border border-red-500 rounded text-[9px] font-mono flex items-center gap-1">{ioc} <X size={8} className="cursor-pointer" onClick={() => onPropertyChange(selectedNode.id, 'iocs', selectedNode.data.iocs.filter((item:string)=>item!==ioc))}/></span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : selectedEdge ? (
                        <div className="space-y-6 animate-fade-in">
                            <div className="bg-gray-900/50 p-4 rounded border border-gray-800 space-y-4">
                                <div>
                                    <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Flow Name</div>
                                    <input className="w-full bg-black border border-gray-700 rounded p-2 text-sm text-white focus:border-cyber-cyan outline-none" value={selectedEdge.label as string} onChange={e => onEdgePropertyChange(selectedEdge.id, 'label', e.target.value)} />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[9px] text-gray-500 uppercase font-bold mb-1 block">Protocol</label>
                                        <select className="w-full bg-black border border-gray-700 rounded p-2 text-[10px] text-white outline-none" value={selectedEdge.data.protocol} onChange={e => onEdgePropertyChange(selectedEdge.id, 'protocol', e.target.value)}>{PROTOCOLS.map(p => <option key={p} value={p}>{p}</option>)}</select>
                                    </div>
                                    <div>
                                        <label className="text-[9px] text-gray-500 uppercase font-bold mb-1 block">Port(s)</label>
                                        <input type="text" className="w-full bg-black border border-gray-700 rounded p-2 text-[10px] text-white font-mono" value={selectedEdge.data.portRange} onChange={e => onEdgePropertyChange(selectedEdge.id, 'portRange', e.target.value)} placeholder="443, 80-8080"/>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[9px] text-gray-500 uppercase font-bold mb-1 block">Authentication</label>
                                    <select className="w-full bg-black border border-gray-700 rounded p-2 text-[10px] text-white outline-none" value={selectedEdge.data.authentication} onChange={e => onEdgePropertyChange(selectedEdge.id, 'authentication', e.target.value)}>{AUTH_METHODS.map(a => <option key={a} value={a}>{a}</option>)}</select>
                                </div>
                                <button onClick={() => onEdgePropertyChange(selectedEdge.id, 'isPermissive', !selectedEdge.data.isPermissive)} className={`w-full py-2 rounded text-[10px] font-bold border transition-all ${selectedEdge.data.isPermissive ? 'bg-orange-900/20 border-orange-500/50 text-orange-400' : 'bg-green-900/30 text-green-400 border border-green-500/30'}`}>{selectedEdge.data.isPermissive ? 'PERMISSIVE FLOW' : 'HARDENED FLOW'}</button>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-20"><Activity size={64} className="mb-6 text-gray-600"/><p className="text-xs font-mono uppercase tracking-[0.4em]">Engine Standby</p></div>
                    )}
                </div>
            </div>

            {/* Modal: Custom Stencil Creator */}
            {showStencilCreator && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => setShowStencilCreator(false)}>
                    <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-black/40">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2 uppercase tracking-tight"><Palette size={20} className="text-cyber-cyan"/> CREATE CUSTOM STENCIL</h3>
                            <button onClick={() => setShowStencilCreator(false)} className="text-gray-500 hover:text-white"><X size={20}/></button>
                        </div>
                        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                            <div className="space-y-4">
                                <div><label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Name</label><input type="text" className="w-full bg-black border border-gray-700 rounded p-2 text-sm text-white font-mono" placeholder="Component Label" value={newStencil.label} onChange={e => setNewStencil({...newStencil, label: e.target.value})}/></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Type</label><select className="w-full bg-black border border-gray-700 rounded p-2 text-xs text-white" value={newStencil.type} onChange={e => setNewStencil({...newStencil, type: e.target.value as any})}><option value="compute">Process</option><option value="storage">Storage</option><option value="network">Interface</option><option value="actor">Actor</option></select></div>
                                    <div><label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Icon</label><select className="w-full bg-black border border-gray-700 rounded p-2 text-xs text-white" value={newStencil.iconName} onChange={e => setNewStencil({...newStencil, iconName: e.target.value})}>{Object.keys(STENCIL_ICONS).map(icon => <option key={icon} value={icon}>{icon}</option>)}</select></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Default Criticality</label><select className="w-full bg-black border border-gray-700 rounded p-2 text-xs text-white" value={newStencil.criticality} onChange={e => setNewStencil({...newStencil, criticality: e.target.value})}>{CRITICALITY_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}</select></div>
                                    <div><label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Default Color</label><select className="w-full bg-black border border-gray-700 rounded p-2 text-xs text-white" value={newStencil.color} onChange={e => setNewStencil({...newStencil, color: e.target.value})}><option value="bg-blue-500">Blue</option><option value="bg-red-500">Red</option><option value="bg-green-500">Green</option><option value="bg-purple-500">Purple</option><option value="bg-pink-500">Pink</option><option value="bg-orange-500">Orange</option></select></div>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-black/40 border-t border-gray-800 flex justify-end gap-3 shrink-0">
                            <button onClick={() => setShowStencilCreator(false)} className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-white uppercase">Cancel</button>
                            <button onClick={handleCreateStencil} disabled={!newStencil.label} className="px-6 py-2 bg-cyber-cyan text-black font-bold rounded text-xs flex items-center gap-2 disabled:opacity-50">SAVE STENCIL</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
