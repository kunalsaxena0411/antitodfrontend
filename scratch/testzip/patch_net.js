const fs = require('fs');

let content = fs.readFileSync('components/views/NetworkTopologyView.tsx', 'utf8');

// 3A. Delete old duplicate addStencilToCanvas
content = content.replace(/const addStencilToCanvas = useCallback\(\(s: any\) => \{[\s\S]*?\}, \[reactFlowInstance, setNodes\]\);\s*/, '');

// 3B. Replace handleAddStencilToCanvas
content = content.replace(
    /const handleAddStencilToCanvas = useCallback\([\s\S]*?\}, \[reactFlowInstance, nodes\]\s*\);/,
    const handleAddStencilToCanvas = useCallback(
    (stencil: any) => {
        if (!reactFlowInstance || !canvasRef.current) {
            return;
        }

        const isBoundary = stencil.type === 'boundary';

        const newId = \\-\\;

        const position = getCanvasInsertPosition(
            reactFlowInstance,
            canvasRef,
            nodes,
            {
                nodeWidth: isBoundary ? 420 : 240,
                nodeHeight: isBoundary ? 280 : 120,
                horizontalGap: 80,
                verticalGap: 60,
            }
        );

        const newNode: Node = {
            id: newId,
            type: stencil.type,
            position,
            data: {
                label: stencil.label,
                criticality: stencil.criticality || 'MEDIUM',
                isInternetFacing: Boolean(stencil.internet),
                vulnerabilities: [],
                iocs: [],
                status: 'SECURE',
                iconName: stencil.iconName || undefined,
                sensitivity: stencil.sensitivity || 'None',
                colorClass: stencil.color || undefined,
                ipAddress: stencil.ipAddress || undefined,
                interface: stencil.interface || undefined,
                vlan: stencil.vlan || undefined,
            },
        };

        setNodes((currentNodes) => [
            ...currentNodes,
            newNode,
        ]);

        setSelectedNode(newNode);
        setSelectedEdge(null);
        setNodeIntel(null);

        requestAnimationFrame(() => {
            reactFlowInstance.fitView({
                nodes: [newNode],
                padding: 0.4,
                minZoom: 0.65,
                maxZoom: 1.15,
                duration: 250,
            });
        });
    },
    [
        reactFlowInstance,
        nodes,
        setNodes,
    ]
);
);

// 3C. Remove JSON overlay
content = content.replace(/<div className="absolute top-0 left-0 z-\[100\] bg-black text-white p-4 max-w-lg max-h-\[400px\] overflow-auto text-xs pointer-events-none opacity-80">\s*<pre>\{JSON\.stringify\(nodes, null, 2\)\}<\/pre>\s*<\/div>\s*/g, '');

// 3D. Replace Network canvas wrapper
content = content.replace(
    /<div\s*ref=\{canvasRef\}\s*className="flex-1 relative min-w-0 bg-at-bg overflow-hidden z-10"\s*>/,
    <div
    ref={canvasRef}
    className="modeling-canvas z-10"
>
);

// 3E. Replace ReactFlow opening props
content = content.replace(
    /<ReactFlow[\s\S]*?onPaneClick=\{[\s\S]*?\}\s*>/,
    <ReactFlow
    nodes={nodes}
    edges={edges}
    nodeTypes={nodeTypes}
    onNodesChange={onNodesChange}
    onEdgesChange={onEdgesChange}
    onConnect={onConnect}
    onInit={setReactFlowInstance}
    onNodeClick={(_, node) => {
        setSelectedNode(node);
        setSelectedEdge(null);
        setNodeIntel(null);
    }}
    onEdgeClick={(_, edge) => {
        setSelectedEdge(edge);
        setSelectedNode(null);
        setNodeIntel(null);
    }}
    onPaneClick={() => {
        setSelectedNode(null);
        setSelectedEdge(null);
        setNodeIntel(null);
    }}
    fitView
    fitViewOptions={{
        padding: 0.25,
        minZoom: 0.55,
        maxZoom: 1.1,
    }}
    className="!bg-at-bg"
    proOptions={{ hideAttribution: true }}
>
);

// 3F. Replace Network Background and Controls
content = content.replace(
    /<Background color="#ffffff" gap=\{24\} size=\{1\} style=\{\{ opacity: 0\.05 \}\} \/>[\s\S]*?<Controls className="!bg-\[#111216\] !border !border-\[#222328\] !fill-\[#999\] shadow-md \[\&>button\]:!border-b-\[#222328\] hover:\[\&>button\]:!bg-\[#1a1b20\]" \/>/,
    <Background
    color="rgba(255,255,255,0.055)"
    gap={24}
    size={1}
/>

<Controls />
);

// 3G. Make three main areas explicit
content = content.replace(
    /<div className="flex w-full flex-1 min-h-0 overflow-hidden relative">/,
    <div className="modeling-shell">
);

content = content.replace(
    /<div className="w-64 flex flex-col bg-at-bg border-r border-at-border z-20 flex-shrink-0 h-full">/,
    <div className="modeling-palette">
);

// Right inspector
content = content.replace(
    /<div className=\{\lex flex-col bg-\[#0A0A0A\] shrink-0 relative z-20 transition-\[width,opacity,transform\] duration-300 ease-out border-l border-\[#222328\] \$\{ selectedNode \|\| selectedEdge \? 'w-80 opacity-100 translate-x-0' : 'w-0 opacity-0 translate-x-12 border-l-0 overflow-hidden' \}\\}>/,
    <div
    className={\
        modeling-inspector
        flex
        flex-col
        shrink-0
        transition-[width]
        duration-200
        \
    \}
>
);

content = content.replace(
    /<div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">/,
    <div className="modeling-inspector-scroll custom-scrollbar p-5 space-y-6">
);

// Cleanup useState
content = content.replace(
    /const \[newStencil, setNewStencil\] = useState\(\{[\s\S]*?color: 'bg-\[#d62828\]',[\s\S]*?\}\);/,
    const [newStencil, setNewStencil] = useState({
    label: '',
    type: 'standard',
    iconName: 'Box',
    color: 'bg-at-accent',
    internet: false,
    sensitivity: 'None',
    criticality: 'MEDIUM',
    ipAddress: '',
    interface: '',
    vlan: ''
});
);

content = content.replace(
    /setNewStencil\(\{[\s\S]*?color: 'bg-\[#d62828\]',[\s\S]*?\}\);/g,
    setNewStencil({
    label: '',
    type: 'standard',
    iconName: 'Box',
    color: 'bg-at-accent',
    internet: false,
    sensitivity: 'None',
    criticality: 'MEDIUM',
    ipAddress: '',
    interface: '',
    vlan: ''
});
);

fs.writeFileSync('components/views/NetworkTopologyView.tsx', content);
console.log('Done NetworkTopologyView');
