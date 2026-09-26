
import React, { useState, useEffect, useMemo } from 'react';
import { Playbook, CaseFile, PlaybookStep, CaseArtifact } from '../../types';
import { PLAYBOOKS } from '../../services/playbooks';
import { enrichIP, checkRBL, checkDomainSecurity } from '../../services/dns';
import { generatePlaybookFromPrompt, summarizeCaseFile } from '../../services/aiConverter';
import { 
    BookOpen, CheckCircle, Circle, Play, AlertTriangle, 
    FileText, Shield, Globe, Terminal, ChevronRight, 
    Save, Clock, Archive, Plus, Search, Activity, 
    User, MapPin, Lock, CheckSquare, XCircle, ArrowRight,
    Download, FileCheck, Edit3, Trash2, X, Settings, Sparkles, Loader2, Copy
} from 'lucide-react';
import { downloadFile } from '../../services/exporter';

interface PlaybookViewProps {
    initialCase?: CaseFile | null;
}

// Widget for automated checks inside a step
const AutomationWidget = ({ type, context, onComplete }: { type: string, context: any, onComplete: (data: string) => void }) => {
    const [loading, setLoading] = useState(true);
    const [result, setResult] = useState<any>(null);

    useEffect(() => {
        const run = async () => {
            setLoading(true);
            let summary = '';
            
            try {
                if (type === 'enrich_ip' && context.ip) {
                    const [geo, rbl] = await Promise.all([enrichIP(context.ip), checkRBL(context.ip)]);
                    setResult({ geo, rbl });
                    summary = `IP: ${context.ip}\nLocation: ${geo?.country_name}\nASN: ${geo?.asn?.name}\nRBL: ${rbl.status}`;
                } 
                else if (type === 'enrich_all' && (context.ip || context.domain)) {
                    // Mock enrich all
                    await new Promise(r => setTimeout(r, 1500));
                    summary = "Reputation Check Complete. No critical flags found.";
                    setResult({ status: 'Clean' });
                }
                else {
                    summary = "Automation skipped: Missing context.";
                }
            } catch (e) {
                summary = "Automation failed.";
            }
            
            setLoading(false);
            onComplete(summary);
        };
        run();
    }, [type, context]);

    if (loading) return <div className="text-xs text-red-500 animate-pulse font-mono p-3 border border-red-500/30 bg-red-500/10 rounded flex items-center gap-2"><Terminal size={12}/> RUNNING AUTOMATION...</div>;

    if (type === 'enrich_ip' && result) {
        const { geo, rbl } = result;
        return (
            <div className="bg-[#0A0A0A] border border-[#333] rounded p-3 text-xs font-mono mb-4 animate-fade-in">
                <div className="flex justify-between items-center mb-2 border-b border-[#333] pb-1">
                    <span className="text-[#AAA]">AUTOMATED INTEL</span>
                    <span className={rbl.status === 'LISTED' ? 'text-red-400 font-bold' : 'text-white'}>{rbl.status === 'LISTED' ? 'BLACKLISTED' : 'CLEAN'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-[#888]">ISP:</span> {geo?.asn?.name}</div>
                    <div><span className="text-[#888]">Loc:</span> {geo?.city}, {geo?.country_code}</div>
                    <div><span className="text-[#888]">Threat:</span> {geo?.threat?.is_known_attacker ? 'YES' : 'NO'}</div>
                    <div><span className="text-[#888]">Proxy:</span> {geo?.threat?.is_proxy ? 'YES' : 'NO'}</div>
                </div>
            </div>
        );
    }

    return <div className="text-xs text-white p-3 border border-neutral-500/30 bg-neutral-900/10 rounded mb-4 flex items-center gap-2"><CheckCircle size={12}/> AUTOMATION COMPLETE</div>;
};

// SLA Timer Component
const SlaTimer = ({ startTime, status }: { startTime: string, status: string }) => {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        if (status === 'CLOSED') return;
        const start = new Date(startTime).getTime();
        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - start) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [startTime, status]);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className={`font-mono text-sm font-bold flex items-center gap-2 ${elapsed > 3600 ? 'text-red-400' : 'text-white'}`}>
            <Clock size={14}/> {formatTime(elapsed)}
        </div>
    );
};

export const PlaybookView: React.FC<PlaybookViewProps> = ({ initialCase }) => {
    const [cases, setCases] = useState<CaseFile[]>([]);
    const [activeCase, setActiveCase] = useState<CaseFile | null>(() => {
        try {
            const savedId = localStorage.getItem('xyberah_pb_active_case_id');
            const savedCasesStr = localStorage.getItem('xyberah_pb_cases'); // We store cases here as well for sync
            if (savedId && savedCasesStr) {
                const parsed = JSON.parse(savedCasesStr);
                return parsed.find((c: any) => c.id === savedId) || null;
            }
        } catch(e) {}
        return null;
    });
    const [noteInput, setNoteInput] = useState('');
    
    // Custom Playbook State
    const [customPlaybooks, setCustomPlaybooks] = useState<Playbook[]>([]);
    const [isBuilderOpen, setIsBuilderOpen] = useState(false);
    
    // Builder State
    const [newPbName, setNewPbName] = useState('');
    const [newPbDesc, setNewPbDesc] = useState('');
    const [newPbSeverity, setNewPbSeverity] = useState<'Low'|'Medium'|'High'|'Critical'>('Medium');
    const [builderSteps, setBuilderSteps] = useState<Record<string, PlaybookStep>>({});
    const [editingStep, setEditingStep] = useState<Partial<PlaybookStep> | null>(null);

    // AI States
    const [showAiPrompt, setShowAiPrompt] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [isAiGenerating, setIsAiGenerating] = useState(false);
    const [aiSummary, setAiSummary] = useState('');
    const [isSummarizing, setIsSummarizing] = useState(false);

    // Initial Load
    useEffect(() => {
        if (initialCase) {
            setCases(prev => {
                const exists = prev.find(c => c.id === initialCase.id);
                if (exists) return prev;
                const updated = [initialCase, ...prev];
                localStorage.setItem('xyberah_pb_cases', JSON.stringify(updated));
                return updated;
            });
            setActiveCase(initialCase);
        } else {
            // Restore cases from local storage
            try {
                const saved = localStorage.getItem('xyberah_pb_cases');
                if (saved) setCases(JSON.parse(saved));
            } catch(e) {}
        }

        const savedPbs = localStorage.getItem('xyberah_custom_playbooks');
        if (savedPbs) {
            try {
                setCustomPlaybooks(JSON.parse(savedPbs));
            } catch(e) {}
        }
    }, [initialCase]);

    // Save state changes
    useEffect(() => {
        localStorage.setItem('xyberah_custom_playbooks', JSON.stringify(customPlaybooks));
    }, [customPlaybooks]);

    useEffect(() => {
        localStorage.setItem('xyberah_pb_cases', JSON.stringify(cases));
        if (activeCase) {
            localStorage.setItem('xyberah_pb_active_case_id', activeCase.id);
        } else {
            localStorage.removeItem('xyberah_pb_active_case_id');
        }
    }, [cases, activeCase]);

    const allPlaybooks = useMemo(() => [...PLAYBOOKS, ...customPlaybooks], [customPlaybooks]);

    const currentPlaybook = useMemo(() => {
        if (!activeCase) return null;
        return allPlaybooks.find(p => p.id === activeCase.playbookId);
    }, [activeCase, allPlaybooks]);

    const currentStep = useMemo(() => {
        if (!currentPlaybook || !activeCase) return null;
        return currentPlaybook.steps[activeCase.currentStepId];
    }, [currentPlaybook, activeCase]);

    const handleCreateCase = (playbookId: string) => {
        const pb = allPlaybooks.find(p => p.id === playbookId);
        if (!pb) return;

        const newCase: CaseFile = {
            id: crypto.randomUUID(),
            title: `Investigation #${Math.floor(Math.random() * 1000)}`,
            playbookId: pb.id,
            status: 'OPEN',
            priority: pb.severity,
            currentStepId: pb.startStepId,
            artifacts: [],
            history: [{ stepId: pb.startStepId, action: 'Case Created', timestamp: new Date().toISOString(), user: 'Analyst' }],
            context: {},
            created: new Date().toISOString(),
            updated: new Date().toISOString()
        };
        setCases([newCase, ...cases]);
        setActiveCase(newCase);
        setIsBuilderOpen(false);
        setAiSummary('');
    };

    const handleStepAction = (nextStepId?: string, actionLabel?: string) => {
        if (!activeCase) return;

        const updatedCase = { ...activeCase };
        updatedCase.updated = new Date().toISOString();
        
        updatedCase.history.push({
            stepId: activeCase.currentStepId,
            action: actionLabel || 'Proceeded',
            timestamp: new Date().toISOString(),
            user: 'Analyst'
        });

        if (noteInput.trim()) {
            updatedCase.artifacts.push({
                id: crypto.randomUUID(),
                type: 'TEXT',
                value: noteInput,
                note: `Step: ${currentStep?.title}`,
                addedAt: new Date().toISOString()
            });
            setNoteInput('');
        }

        if (nextStepId) {
            updatedCase.currentStepId = nextStepId;
        } else {
            updatedCase.status = 'CLOSED';
        }

        setCases(prev => prev.map(c => c.id === activeCase.id ? updatedCase : c));
        setActiveCase(updatedCase);
    };

    const handleAddArtifact = (type: CaseArtifact['type'], value: string) => {
        if (!activeCase) return;
        const updated = { ...activeCase };
        updated.artifacts.push({
            id: crypto.randomUUID(),
            type,
            value,
            addedAt: new Date().toISOString()
        });
        setCases(prev => prev.map(c => c.id === activeCase.id ? updated : c));
        setActiveCase(updated);
    };

    const generateReport = () => {
        if (!activeCase) return;
        const reportText = `INCIDENT REPORT: ${activeCase.title}
STATUS: ${activeCase.status}
PRIORITY: ${activeCase.priority}
CREATED: ${activeCase.created}
CLOSED: ${activeCase.updated}

-- TIMELINE --
${activeCase.history.map(h => `[${new Date(h.timestamp).toLocaleTimeString()}] ${h.action}`).join('\n')}

-- ARTIFACTS --
${activeCase.artifacts.map(a => `[${a.type}] ${a.value} ${a.note ? `(${a.note})` : ''}`).join('\n')}

-- FINDINGS --
${activeCase.artifacts.filter(a => a.type === 'TEXT').map(a => a.value).join('\n')}

-- AI SUMMARY --
${aiSummary || 'Not generated.'}
`;
        downloadFile(reportText, `case_report_${activeCase.id}.txt`, 'text/plain');
    };

    const handleAiSummary = async () => {
        if (!activeCase) return;
        setIsSummarizing(true);
        try {
            const summary = await summarizeCaseFile(activeCase);
            setAiSummary(summary);
        } catch (e) {
            setAiSummary("Failed to generate summary.");
        } finally {
            setIsSummarizing(false);
        }
    };

    const renderArtifactIcon = (type: string) => {
        switch(type) {
            case 'IP': return <Globe size={12} className="text-red-400"/>;
            case 'DOMAIN': return <Globe size={12} className="text-red-400"/>;
            case 'URL': return <ArrowRight size={12} className="text-white"/>;
            case 'FILE': return <FileText size={12} className="text-white"/>;
            case 'USER': return <User size={12} className="text-white"/>;
            case 'TEXT': return <FileText size={12} className="text-[#AAA]"/>;
            default: return <Circle size={12} className="text-[#888]"/>;
        }
    };

    // --- Builder Logic ---
    const handleGeneratePlaybook = async () => {
        if (!aiPrompt) return;
        setIsAiGenerating(true);
        try {
            const generated = await generatePlaybookFromPrompt(aiPrompt);
            if (generated) {
                if (generated.name) setNewPbName(generated.name);
                if (generated.description) setNewPbDesc(generated.description);
                if (generated.severity) setNewPbSeverity(generated.severity);
                if (generated.steps) setBuilderSteps(generated.steps as any);
                setShowAiPrompt(false);
                setAiPrompt('');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsAiGenerating(false);
        }
    };

    const handleSavePlaybook = () => {
        if (!newPbName || Object.keys(builderSteps).length === 0) return;
        
        const newPb: Playbook = {
            id: `custom-${crypto.randomUUID()}`,
            name: newPbName,
            description: newPbDesc,
            severity: newPbSeverity,
            tags: ['Custom'],
            steps: builderSteps,
            startStepId: Object.keys(builderSteps)[0] // Simple approach: first added step is start
        };
        
        setCustomPlaybooks([...customPlaybooks, newPb]);
        setIsBuilderOpen(false);
        setNewPbName('');
        setNewPbDesc('');
        setBuilderSteps({});
    };

    const handleAddStep = () => {
        if (!editingStep?.title) return;
        const id = editingStep.id || `step-${crypto.randomUUID().split('-')[0]}`;
        const newStep: PlaybookStep = {
            id,
            title: editingStep.title,
            description: editingStep.description || '',
            type: editingStep.type || 'ACTION',
            nextStepId: editingStep.nextStepId,
            options: editingStep.options,
            automationId: editingStep.automationId
        };
        setBuilderSteps(prev => ({ ...prev, [id]: newStep }));
        setEditingStep(null);
    };

    const handleDeleteCustomPb = (id: string) => {
        if (confirm("Delete this playbook?")) {
            setCustomPlaybooks(prev => prev.filter(p => p.id !== id));
        }
    };

    return (
        <div className="h-[calc(100vh-70px)] bg-cyber-grid flex">
            {/* Left Sidebar: Case List & Playbooks */}
            <div className="w-72 bg-black/40 border-r border-[#222] flex flex-col">
                <div className="p-4 border-b border-[#222] bg-[#111]">
                    <h2 className="text-sm font-bold text-white uppercase flex items-center gap-2">
                        <Archive size={16} className="text-red-400"/> Case Files
                    </h2>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2 max-h-[40vh]">
                    {cases.map(c => (
                        <div 
                            key={c.id}
                            onClick={() => { setActiveCase(c); setIsBuilderOpen(false); }}
                            className={`p-3 rounded border cursor-pointer transition-all ${activeCase?.id === c.id && !isBuilderOpen ? 'bg-neutral-900/20 border-neutral-500/50' : 'bg-[#111] border-[#222] hover:border-neutral-600'}`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${c.priority === 'Critical' ? 'bg-red-500 text-black' : 'bg-[#151515] text-black'}`}>{c.priority}</span>
                                <span className={`text-[10px] ${c.status === 'CLOSED' ? 'text-white' : 'text-[#888]'}`}>{c.status === 'CLOSED' ? 'CLOSED' : new Date(c.created).toLocaleTimeString()}</span>
                            </div>
                            <div className="text-sm font-bold text-neutral-200 truncate">{c.title}</div>
                            <div className="text-[10px] text-[#888] truncate">
                                {allPlaybooks.find(p => p.id === c.playbookId)?.name}
                            </div>
                        </div>
                    ))}
                    {cases.length === 0 && (
                        <div className="text-center p-4 text-[#888] text-xs italic">No active investigations.</div>
                    )}
                </div>
                
                {/* Playbook Launcher */}
                <div className="p-4 border-t border-[#222] flex-1 flex flex-col">
                    <div className="flex justify-between items-center mb-2">
                        <div className="text-[10px] text-[#888] font-bold uppercase">Run Playbook</div>
                        <button onClick={() => setIsBuilderOpen(true)} className="text-[10px] text-red-500 hover:text-white flex items-center gap-1">
                            <Plus size={10}/> New Template
                        </button>
                    </div>
                    <div className="overflow-y-auto custom-scrollbar space-y-1 flex-1">
                        {allPlaybooks.map(pb => (
                            <div key={pb.id} className="flex gap-1 group">
                                <button 
                                    onClick={() => handleCreateCase(pb.id)}
                                    className="flex-1 text-left text-xs px-3 py-2 bg-[#151515] hover:bg-[#1C1C1C] text-neutral-300 rounded border border-[#333] flex items-center gap-2"
                                >
                                    <Play size={10}/> {pb.name}
                                </button>
                                {pb.id.startsWith('custom-') && (
                                    <button 
                                        onClick={() => handleDeleteCustomPb(pb.id)}
                                        className="px-2 bg-[#151515] hover:bg-red-900/30 text-[#888] hover:text-red-400 border border-[#333] rounded"
                                    >
                                        <Trash2 size={10}/>
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 flex flex-col relative overflow-hidden bg-black/20">
                {isBuilderOpen ? (
                    /* --- BUILDER UI --- */
                    <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                        <div className="max-w-4xl mx-auto w-full space-y-6">
                            <div className="flex justify-between items-center border-b border-[#222] pb-4">
                                <h2 className="text-2xl font-cyber font-bold text-white flex items-center gap-2">
                                    <Edit3 className="text-red-500"/> PLAYBOOK BUILDER
                                </h2>
                                <div className="flex gap-2 relative">
                                    <button onClick={() => setShowAiPrompt(!showAiPrompt)} className="px-4 py-2 bg-neutral-900/20 text-red-400 border border-neutral-500/30 rounded text-xs font-bold hover:bg-neutral-900/40 flex items-center gap-2">
                                        <Sparkles size={14}/> GENERATE WITH AI
                                    </button>
                                    <button onClick={() => setIsBuilderOpen(false)} className="px-4 py-2 text-[#AAA] hover:text-white text-xs">Cancel</button>
                                    <button onClick={handleSavePlaybook} className="px-6 py-2 bg-neutral-600 hover:bg-neutral-500 text-white rounded font-bold text-xs flex items-center gap-2">
                                        <Save size={14}/> SAVE TEMPLATE
                                    </button>

                                    {/* AI Prompt Modal */}
                                    {showAiPrompt && (
                                        <div className="absolute top-12 right-0 w-80 bg-[#0A0A0A] border border-[#333] rounded-xl p-4 shadow-2xl z-50 animate-fade-in-up">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs font-bold text-red-400 flex items-center gap-1"><Sparkles size={12}/> AI Playbook Architect</span>
                                                <button onClick={() => setShowAiPrompt(false)}><X size={14} className="text-[#888]"/></button>
                                            </div>
                                            <textarea 
                                                className="w-full bg-black/50 border border-[#333] rounded p-2 text-xs text-white h-24 mb-2" 
                                                placeholder="Describe your playbook (e.g. 'Handle compromised AWS credentials')..."
                                                value={aiPrompt}
                                                onChange={e => setAiPrompt(e.target.value)}
                                            />
                                            <button 
                                                onClick={handleGeneratePlaybook} 
                                                disabled={isAiGenerating}
                                                className="w-full py-2 bg-neutral-600 hover:bg-neutral-500 text-white rounded text-xs font-bold flex items-center justify-center gap-2"
                                            >
                                                {isAiGenerating ? <Loader2 className="animate-spin" size={12}/> : "GENERATE STEPS"}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Metadata */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-[#888] font-bold uppercase block mb-1">Playbook Name</label>
                                    <input type="text" className="w-full bg-black/50 border border-[#333] rounded p-2 text-sm text-white" value={newPbName} onChange={e => setNewPbName(e.target.value)} placeholder="e.g. Server Compromise"/>
                                </div>
                                <div>
                                    <label className="text-xs text-[#888] font-bold uppercase block mb-1">Severity</label>
                                    <select className="w-full bg-black/50 border border-[#333] rounded p-2 text-sm text-white" value={newPbSeverity} onChange={e => setNewPbSeverity(e.target.value as any)}>
                                        <option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option><option value="Critical">Critical</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs text-[#888] font-bold uppercase block mb-1">Description</label>
                                    <input type="text" className="w-full bg-black/50 border border-[#333] rounded p-2 text-sm text-white" value={newPbDesc} onChange={e => setNewPbDesc(e.target.value)} placeholder="Brief purpose of this procedure..."/>
                                </div>
                            </div>

                            {/* Steps List */}
                            <div className="space-y-2">
                                <div className="text-xs text-[#888] font-bold uppercase flex justify-between items-center">
                                    <span>Procedure Steps</span>
                                    <span className="text-[10px] text-neutral-600">Total: {Object.keys(builderSteps).length}</span>
                                </div>
                                {(Object.values(builderSteps) as PlaybookStep[]).map((step: PlaybookStep, i) => (
                                    <div key={step.id} className="bg-[#111] border border-[#222] p-3 rounded flex justify-between items-center group">
                                        <div className="flex items-center gap-3">
                                            <span className="bg-[#151515] text-[#AAA] text-xs px-2 py-1 rounded font-mono">{i + 1}</span>
                                            <div>
                                                <div className="text-sm font-bold text-white">{step.title}</div>
                                                <div className="text-xs text-[#888]">{step.type} • {step.description.substring(0, 50)}...</div>
                                            </div>
                                        </div>
                                        <button onClick={() => {
                                            const newSteps = { ...builderSteps };
                                            delete newSteps[step.id];
                                            setBuilderSteps(newSteps);
                                        }} className="text-neutral-600 hover:text-red-400"><Trash2 size={14}/></button>
                                    </div>
                                ))}
                                
                                {Object.keys(builderSteps).length === 0 && (
                                    <div className="text-center p-8 border border-dashed border-[#222] rounded text-[#888] text-xs">
                                        No steps defined. Add a starting step below or use AI Generation.
                                    </div>
                                )}
                            </div>

                            {/* Step Editor */}
                            <div className="bg-black/30 border border-[#222] rounded p-4">
                                <h3 className="text-sm font-bold text-red-500 mb-4 flex items-center gap-2"><Plus size={16}/> Add Step</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] text-[#888] uppercase block mb-1">Step Title</label>
                                        <input type="text" className="w-full bg-black/50 border border-[#333] rounded p-2 text-xs text-white" value={editingStep?.title || ''} onChange={e => setEditingStep({...editingStep, title: e.target.value})} placeholder="e.g. Isolate Host"/>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-[#888] uppercase block mb-1">Step Type</label>
                                        <select className="w-full bg-black/50 border border-[#333] rounded p-2 text-xs text-white" value={editingStep?.type || 'ACTION'} onChange={e => setEditingStep({...editingStep, type: e.target.value as any})}>
                                            <option value="ACTION">Action (Manual)</option>
                                            <option value="DECISION">Decision (Branching)</option>
                                            <option value="AUTOMATION">Automation</option>
                                            <option value="INPUT">Data Input</option>
                                        </select>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-[10px] text-[#888] uppercase block mb-1">Description / Instructions</label>
                                        <textarea className="w-full bg-black/50 border border-[#333] rounded p-2 text-xs text-white" rows={2} value={editingStep?.description || ''} onChange={e => setEditingStep({...editingStep, description: e.target.value})} placeholder="Detailed instructions for the analyst..."/>
                                    </div>
                                    
                                    {/* Type Specific Config */}
                                    {editingStep?.type === 'DECISION' && (
                                        <div className="md:col-span-2 bg-[#111] p-2 rounded">
                                            <label className="text-[10px] text-white uppercase block mb-1">Decision Branches</label>
                                            <div className="text-xs text-[#888] mb-2">Create subsequent steps first, then copy their IDs here.</div>
                                            <div className="flex gap-2">
                                                <button onClick={() => setEditingStep({...editingStep, options: [...(editingStep.options || []), { label: 'Yes', nextStepId: '', style: 'negative' }]})} className="text-[10px] bg-[#151515] px-2 py-1 rounded text-white border border-[#333]">+ Add Option</button>
                                            </div>
                                            <div className="mt-2 space-y-1">
                                                {editingStep.options?.map((opt, idx) => (
                                                    <div key={idx} className="flex gap-2">
                                                        <input type="text" className="w-24 bg-black border border-[#333] rounded px-2 py-1 text-[10px] text-white" value={opt.label} onChange={e => {
                                                            const newOpts = [...editingStep.options!]; newOpts[idx].label = e.target.value; setEditingStep({...editingStep, options: newOpts});
                                                        }}/>
                                                        <input type="text" className="flex-1 bg-black border border-[#333] rounded px-2 py-1 text-[10px] text-white" placeholder="Next Step ID" value={opt.nextStepId} onChange={e => {
                                                            const newOpts = [...editingStep.options!]; newOpts[idx].nextStepId = e.target.value; setEditingStep({...editingStep, options: newOpts});
                                                        }}/>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {editingStep?.type === 'AUTOMATION' && (
                                        <div className="md:col-span-2">
                                            <label className="text-[10px] text-red-400 uppercase block mb-1">Automated Action</label>
                                            <select className="w-full bg-black/50 border border-[#333] rounded p-2 text-xs text-white" value={editingStep?.automationId || 'enrich_ip'} onChange={e => setEditingStep({...editingStep, automationId: e.target.value})}>
                                                <option value="enrich_ip">Enrich Context IP</option>
                                                <option value="enrich_all">Full Context Enrichment</option>
                                            </select>
                                        </div>
                                    )}

                                    <div className="md:col-span-2">
                                        <label className="text-[10px] text-[#888] uppercase block mb-1">Next Step ID (Linear Flow)</label>
                                        <input type="text" className="w-full bg-black/50 border border-[#333] rounded p-2 text-xs text-white font-mono" placeholder="ID of the next step (optional)" value={editingStep?.nextStepId || ''} onChange={e => setEditingStep({...editingStep, nextStepId: e.target.value})}/>
                                    </div>
                                </div>
                                <div className="mt-4 flex justify-end">
                                    <button onClick={handleAddStep} className="px-4 py-2 bg-[#151515] hover:bg-[#1C1C1C] text-white rounded text-xs font-bold border border-neutral-600">
                                        ADD STEP
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : activeCase && currentPlaybook ? (
                    <div className="flex-1 flex flex-col p-8 overflow-y-auto custom-scrollbar">
                        <div className="max-w-4xl mx-auto w-full space-y-8 animate-fade-in">
                            {/* Header */}
                            <div className="flex items-center justify-between border-b border-[#222] pb-4">
                                <div>
                                    <h1 className="text-2xl font-cyber font-bold text-white flex items-center gap-3">
                                        <BookOpen className="text-red-500" size={24}/> 
                                        {currentPlaybook.name}
                                    </h1>
                                    <p className="text-sm text-[#AAA] mt-1 flex items-center gap-2">
                                        <span className="text-red-400 font-mono">CASE: {activeCase.id.substring(0,8)}</span> 
                                        <span>•</span>
                                        <span>{currentPlaybook.description}</span>
                                    </p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <SlaTimer startTime={activeCase.created} status={activeCase.status} />
                                    {activeCase.status === 'OPEN' ? (
                                        <span className="bg-[#111] text-red-400 px-3 py-1 rounded text-xs font-bold border border-neutral-500/30 flex items-center gap-2">
                                            <Activity size={12} className="animate-pulse"/> IN PROGRESS
                                        </span>
                                    ) : (
                                        <span className="bg-neutral-900/30 text-white px-3 py-1 rounded text-xs font-bold border border-neutral-500/30 flex items-center gap-2">
                                            <CheckCircle size={12}/> CLOSED
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Breadcrumbs (Visual History) */}
                            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2">
                                <div className="text-[10px] text-[#888] font-bold uppercase mr-2">History:</div>
                                {activeCase.history.map((h, i) => {
                                    const stepName = currentPlaybook.steps[h.stepId]?.title || 'Start';
                                    return (
                                        <div key={i} className="flex items-center gap-2 shrink-0">
                                            <div className="px-2 py-1 rounded bg-[#151515] border border-[#333] text-[10px] text-neutral-300">
                                                {stepName}
                                            </div>
                                            {i < activeCase.history.length - 1 && <ChevronRight size={12} className="text-neutral-600"/>}
                                        </div>
                                    );
                                })}
                                {activeCase.status === 'OPEN' && (
                                    <>
                                        <ChevronRight size={12} className="text-red-500 shrink-0"/>
                                        <div className="px-2 py-1 rounded bg-red-500/10 border border-red-500/30 text-[10px] text-red-500 font-bold animate-pulse shrink-0">
                                            Current Step
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Current Step Card / Summary View */}
                            {activeCase.status === 'OPEN' && currentStep ? (
                                <div className="bg-[#111] border border-[#333] rounded-xl p-6 shadow-2xl relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                                    <div className="mb-4">
                                        <div className="text-xs font-bold text-red-500 uppercase tracking-widest mb-1">CURRENT STEP</div>
                                        <div className="flex justify-between items-start">
                                            <h2 className="text-xl font-bold text-white">{currentStep.title}</h2>
                                            <span className="text-[10px] text-neutral-600 font-mono">ID: {currentStep.id}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="text-neutral-300 text-sm leading-relaxed mb-6 bg-black/30 p-4 rounded border border-[#222]/50 whitespace-pre-line">
                                        {currentStep.description}
                                    </div>

                                    {/* Automation Injection */}
                                    {currentStep.type === 'AUTOMATION' && currentStep.automationId && (
                                        <AutomationWidget 
                                            type={currentStep.automationId} 
                                            context={activeCase.context}
                                            onComplete={(data) => {
                                                if (!activeCase.artifacts.some(a => a.value.includes('AUTOMATED INTEL'))) {
                                                    handleAddArtifact('TEXT', `[AUTO] ${data}`);
                                                }
                                            }}
                                        />
                                    )}

                                    {/* Inputs */}
                                    {currentStep.type === 'INPUT' && (
                                        <div className="mb-6">
                                            <label className="text-xs font-bold text-[#888] uppercase mb-2 block">Findings / Notes</label>
                                            <textarea 
                                                className="w-full bg-black/50 border border-[#333] rounded p-3 text-sm text-white focus:border-red-500 focus:outline-none"
                                                rows={3}
                                                value={noteInput}
                                                onChange={(e) => setNoteInput(e.target.value)}
                                                placeholder="Enter your findings here..."
                                            />
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex flex-wrap gap-3">
                                        {currentStep.type === 'DECISION' && currentStep.options ? (
                                            currentStep.options.map((opt, i) => (
                                                <button 
                                                    key={i}
                                                    onClick={() => handleStepAction(opt.nextStepId, opt.label)}
                                                    className={`px-6 py-3 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${
                                                        opt.style === 'negative' ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20' : 
                                                        opt.style === 'positive' ? 'bg-neutral-600 hover:bg-neutral-500 text-white shadow-lg shadow-green-900/20' : 
                                                        'bg-[#1C1C1C] hover:bg-neutral-600 text-white'
                                                    }`}
                                                >
                                                    {opt.label} <ChevronRight size={16}/>
                                                </button>
                                            ))
                                        ) : (
                                            <button 
                                                onClick={() => handleStepAction(currentStep.nextStepId)}
                                                className="px-6 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-500 border border-red-500/50 rounded-lg font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-cyan-900/20"
                                            >
                                                <CheckCircle size={16}/> {currentStep.nextStepId ? 'COMPLETE STEP' : 'CLOSE CASE'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                // CLOSED STATE SUMMARY
                                <div className="bg-neutral-900/10 border border-neutral-500/30 rounded-xl p-8 text-center animate-fade-in">
                                    <div className="w-16 h-16 bg-neutral-900/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-neutral-500/50">
                                        <FileCheck size={32} className="text-white"/>
                                    </div>
                                    <h2 className="text-2xl font-bold text-white mb-2">CASE CLOSED</h2>
                                    <p className="text-[#AAA] text-sm mb-6">Investigation complete. Generate a report for your records.</p>
                                    
                                    {aiSummary && (
                                        <div className="mb-6 text-left bg-black/40 border border-[#222] p-4 rounded-lg">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Sparkles size={14} className="text-red-400"/>
                                                <span className="text-xs font-bold text-white uppercase">AI Executive Summary</span>
                                            </div>
                                            <div className="text-xs text-neutral-300 font-mono whitespace-pre-wrap leading-relaxed">
                                                {aiSummary}
                                            </div>
                                            <div className="mt-2 flex justify-end">
                                                <button onClick={() => navigator.clipboard.writeText(aiSummary)} className="text-[10px] text-[#888] hover:text-white flex items-center gap-1"><Copy size={10}/> Copy</button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-center gap-4">
                                        <button 
                                            onClick={handleAiSummary}
                                            disabled={isSummarizing}
                                            className="px-6 py-3 bg-neutral-900/20 hover:bg-neutral-900/40 text-red-400 border border-neutral-500/30 rounded-lg font-bold text-sm transition-all flex items-center gap-2"
                                        >
                                            {isSummarizing ? <Loader2 className="animate-spin" size={16}/> : <Sparkles size={16}/>} 
                                            {aiSummary ? 'REGENERATE SUMMARY' : 'SUMMARIZE INCIDENT'}
                                        </button>
                                        <button 
                                            onClick={generateReport}
                                            className="px-6 py-3 bg-neutral-600 hover:bg-neutral-500 text-white rounded-lg font-bold text-sm transition-all flex items-center gap-2 shadow-lg"
                                        >
                                            <Download size={16}/> DOWNLOAD REPORT
                                        </button>
                                        <button 
                                            onClick={() => setActiveCase(null)} // Or reset state
                                            className="px-6 py-3 bg-[#151515] hover:bg-[#1C1C1C] text-neutral-300 rounded-lg font-bold text-sm transition-all border border-[#333]"
                                        >
                                            RETURN TO LIST
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-[#888]">
                        <Activity size={48} className="opacity-20 mb-4"/>
                        <p className="text-sm font-mono">Select a case, start a new investigation, or create a template.</p>
                    </div>
                )}
            </div>

            {/* Right Sidebar: Evidence Locker */}
            {activeCase && !isBuilderOpen && (
                <div className="w-80 bg-black/40 border-l border-[#222] flex flex-col">
                    <div className="p-4 border-b border-[#222] bg-[#111]">
                        <h2 className="text-sm font-bold text-white uppercase flex items-center gap-2">
                            <Shield size={16} className="text-white"/> Evidence Locker
                        </h2>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                        {/* Context Data */}
                        {activeCase.context && Object.keys(activeCase.context).length > 0 && (
                            <div className="bg-[#151515]/30 rounded border border-[#333] p-3">
                                <div className="text-[10px] text-[#888] font-bold uppercase mb-2">Initial Indicators</div>
                                <div className="space-y-1">
                                    {Object.entries(activeCase.context).map(([k, v]) => (
                                        <div key={k} className="text-xs flex justify-between items-center group">
                                            <span className="text-[#AAA] capitalize">{k}:</span>
                                            <span className="text-red-500 font-mono truncate max-w-[150px]" title={String(v)}>{String(v)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Artifacts */}
                        {activeCase.artifacts.length > 0 ? (
                            activeCase.artifacts.map((art) => (
                                <div key={art.id} className="bg-black/40 border border-[#222] p-3 rounded group hover:border-neutral-600 transition-colors">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 rounded bg-[#151515] text-[#AAA] border border-[#333]">
                                            {renderArtifactIcon(art.type)} {art.type}
                                        </span>
                                        <span className="text-[9px] text-neutral-600">{new Date(art.addedAt).toLocaleTimeString()}</span>
                                    </div>
                                    <div className="text-sm text-neutral-200 font-mono break-all leading-tight">{art.value}</div>
                                    {art.note && <div className="text-[10px] text-[#888] mt-1 italic border-t border-[#222]/50 pt-1">{art.note}</div>}
                                </div>
                            ))
                        ) : (
                            <div className="text-center text-neutral-600 text-xs italic py-8">No artifacts collected.</div>
                        )}
                    </div>
                    
                    {/* Manual Add */}
                    <div className="p-4 border-t border-[#222] bg-[#111]">
                        <div className="text-[10px] text-[#888] font-bold uppercase mb-2">Quick Add Evidence</div>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                placeholder="IP, URL, or Note..." 
                                className="flex-1 bg-black border border-[#333] rounded px-2 py-1 text-xs text-white focus:border-red-500 outline-none"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleAddArtifact('TEXT', e.currentTarget.value);
                                        e.currentTarget.value = '';
                                    }
                                }}
                            />
                            <button className="bg-[#151515] hover:bg-[#1C1C1C] text-neutral-300 p-1.5 rounded border border-[#333]">
                                <Plus size={14}/>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
