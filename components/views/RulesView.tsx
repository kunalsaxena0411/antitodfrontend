
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { SocRule, RuleSource, RuleType, SocRuleVersion, RuleTestCase } from '../../types';
import { DEFAULT_SOURCES, syncSource, parseImport, RULE_TEMPLATES, DEFAULT_RULES } from '../../services/ruleEngine';
import { convertRule, generateRuleFromLog, explainRule, suggestMitreTags, evaluateRuleMatch, generateLogFromRule, SimulationResult } from '../../services/aiConverter';
import { getMitreMatrix, MitreTechnique } from '../../services/mitre';
import { 
    Book, Edit3, RefreshCw, Upload, Plus, Trash2, Save, 
    Play, FileCode, MessageSquare, X, Search, 
    ChevronRight, Loader2, Database, Sparkles, Layers,
    GitBranch, Clock, Tag, Shield, RotateCcw, ExternalLink, ChevronDown, ChevronUp,
    AlertTriangle, CheckCircle, Split, Layout, FlaskConical, Check, XCircle, FileText, RotateCw
} from 'lucide-react';

// --- Syntax Highlighting Logic ---
const highlightSyntax = (code: string, type: string) => {
    if (!code) return '';
    
    // Escape HTML entities first
    let html = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    if (type === 'YARA') {
        // Comments
        html = html.replace(/(\/\/.*$)/gm, '<span class="text-gray-500 italic">$1</span>');
        // Keywords
        html = html.replace(/\b(rule|meta|strings|condition)(\s+)/g, '<span class="text-purple-400 font-bold">$1</span>$2');
        // Hex Strings
        html = html.replace(/(\{[\s\da-fA-F\?\|]+\})/g, '<span class="text-yellow-400">$1</span>');
        // Regex/Strings
        html = html.replace(/(".*?")/g, '<span class="text-green-400">$1</span>');
        // Variables
        html = html.replace(/(\$[a-zA-Z0-9_]*)/g, '<span class="text-red-400">$1</span>');
        // Modifiers
        html = html.replace(/\b(ascii|wide|nocase|fullword)\b/g, '<span class="text-cyan-400">$1</span>');
    } 
    else if (type === 'SIGMA') {
        // Comments
        html = html.replace(/(#.*$)/gm, '<span class="text-gray-500 italic">$1</span>');
        // Keys (YAML)
        html = html.replace(/^(\s*[a-z0-9_]+):/gim, '<span class="text-blue-400 font-bold">$1</span>:');
        // List dashes
        html = html.replace(/^(\s*-\s+)/gm, '<span class="text-orange-400">$1</span>');
        // Strings
        html = html.replace(/('.*?')/g, '<span class="text-green-400">$1</span>');
        html = html.replace(/(".*?")/g, '<span class="text-green-400">$1</span>');
    } 
    else if (type === 'SURICATA' || type === 'SNORT') {
        // Actions
        html = html.replace(/^(alert|drop|pass|reject|sdrop|log)\b/g, '<span class="text-red-500 font-bold">$1</span>');
        // Protocols
        html = html.replace(/\b(tcp|udp|icmp|ip|http|ftp|tls|smb|dns)\b/g, '<span class="text-cyan-400 font-bold">$1</span>');
        // IP/Port directions
        html = html.replace(/(->|<>)/g, '<span class="text-yellow-500 font-bold">$1</span>');
        // Options keys
        html = html.replace(/\b([a-z_]+):/g, '<span class="text-purple-300">$1</span>:');
        // SIDs
        html = html.replace(/\b(sid):(\s*\d+);/g, '<span class="text-purple-300">$1</span>:<span class="text-orange-400 font-bold">$2</span>;');
    }
    else if (type === 'ZEEK') {
        html = html.replace(/(#.*$)/gm, '<span class="text-gray-500 italic">$1</span>');
        html = html.replace(/\b(event|hook|function|module|export|redef)\b/g, '<span class="text-blue-400 font-bold">$1</span>');
        html = html.replace(/\b(if|else|for|return|switch)\b/g, '<span class="text-purple-400">$1</span>');
        html = html.replace(/(&[a-z_]+)/g, '<span class="text-yellow-400">$1</span>');
    }
    
    return html;
};

const CodeEditor = ({ value, onChange, language, readOnly = false, label }: { value: string, onChange?: (val: string) => void, language: string, readOnly?: boolean, label?: string }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const preRef = useRef<HTMLPreElement>(null);

    const handleScroll = () => {
        if (textareaRef.current && preRef.current) {
            preRef.current.scrollTop = textareaRef.current.scrollTop;
            preRef.current.scrollLeft = textareaRef.current.scrollLeft;
        }
    };

    return (
        <div className="relative w-full h-full font-mono text-sm bg-[#0d1117] border border-gray-700 rounded-lg overflow-hidden flex flex-col group">
            <div className={`text-xs px-3 py-1.5 border-b border-gray-700 flex justify-between items-center shrink-0 z-20 ${readOnly ? 'bg-gray-900 text-gray-500' : 'bg-[#161b22] text-gray-300'}`}>
                <span className="font-bold uppercase flex items-center gap-2">
                    {language} {label && <span className="font-normal text-gray-500">| {label}</span>}
                </span>
                {readOnly && <span className="text-yellow-500 text-[9px] border border-yellow-500/50 px-1 rounded bg-yellow-900/10">READ ONLY</span>}
            </div>
            
            <div className="relative flex-1 min-h-0">
                {/* Syntax Highlight Layer */}
                <pre
                    ref={preRef}
                    className="absolute inset-0 p-4 margin-0 pointer-events-none whitespace-pre-wrap break-words overflow-hidden font-mono leading-relaxed z-0"
                    aria-hidden="true"
                    dangerouslySetInnerHTML={{ __html: highlightSyntax(value, language) + '<br>' }} // Add break to match textarea behavior
                />
                
                {/* Input Layer */}
                <textarea 
                    ref={textareaRef}
                    className={`absolute inset-0 w-full h-full bg-transparent p-4 text-transparent caret-white focus:outline-none resize-none font-mono leading-relaxed z-10 selection:bg-white/20 selection:text-transparent ${readOnly ? 'opacity-50' : ''}`}
                    value={value}
                    onChange={(e) => !readOnly && onChange && onChange(e.target.value)}
                    onScroll={handleScroll}
                    spellCheck={false}
                    readOnly={readOnly}
                />
            </div>
        </div>
    );
};

const Badge = ({ type }: { type: string }) => {
    const colors: Record<string, string> = {
        'YARA': 'bg-red-900/30 text-red-400 border-red-500/30',
        'SIGMA': 'bg-blue-900/30 text-blue-400 border-blue-500/30',
        'ZEEK': 'bg-orange-900/30 text-orange-400 border-orange-500/30',
        'SURICATA': 'bg-green-900/30 text-green-400 border-green-500/30',
        'KQL': 'bg-purple-900/30 text-purple-400 border-purple-500/30'
    };
    const def = 'bg-gray-800 text-gray-400 border-gray-600';
    return (
        <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${colors[type] || def}`}>
            {type}
        </span>
    );
};

const StatusBadge = ({ status }: { status: string }) => {
    const styles: Record<string, string> = {
        'DRAFT': 'bg-gray-800 text-gray-400 border-gray-600',
        'REVIEW': 'bg-yellow-900/30 text-yellow-400 border-yellow-500/30',
        'STAGING': 'bg-blue-900/30 text-blue-400 border-blue-500/30',
        'ACTIVE': 'bg-green-900/30 text-green-400 border-green-500/30',
        'DEPRECATED': 'bg-red-900/30 text-red-400 border-red-500/30'
    };
    return (
        <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${styles[status] || styles['DRAFT']}`}>
            {status}
        </span>
    );
};

interface RulesViewProps {
    initialRuleId?: string | null;
}

export const RulesView: React.FC<RulesViewProps> = ({ initialRuleId }) => {
    const [activeTab, setActiveTab] = useState<'LIBRARY' | 'EDITOR' | 'SOURCES'>(() => {
        return (localStorage.getItem('xyberah_rules_active_tab') as any) || 'LIBRARY';
    });
    
    // Persistent State for Rules with DEFAULT_RULES fallback
    const [rules, setRules] = useState<SocRule[]>(() => {
        try {
            const saved = localStorage.getItem('xyberah_soc_rules');
            const parsed = saved ? JSON.parse(saved) : null;
            return (parsed && parsed.length > 0) ? parsed : DEFAULT_RULES;
        } catch (e) { return DEFAULT_RULES; }
    });

    // Persistent State for Sources
    const [sources, setSources] = useState<RuleSource[]>(() => {
        try {
            const saved = localStorage.getItem('xyberah_rule_sources');
            return saved ? JSON.parse(saved) : DEFAULT_SOURCES;
        } catch (e) { return DEFAULT_SOURCES; }
    });

    const [editingRule, setEditingRule] = useState<SocRule | null>(() => {
        try {
            const savedId = localStorage.getItem('xyberah_rules_editing_id');
            const savedRules = localStorage.getItem('xyberah_soc_rules');
            if (savedId && savedRules) {
                const parsedRules = JSON.parse(savedRules);
                return parsedRules.find((r: any) => r.id === savedId) || null;
            }
            return null;
        } catch(e) { return null; }
    });
    const [syncing, setSyncing] = useState<Record<string, boolean>>({});

    // Editor State
    const [editorContent, setEditorContent] = useState(() => {
        return editingRule ? editingRule.content : '';
    });
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiOutput, setAiOutput] = useState('');
    const [isAiProcessing, setIsAiProcessing] = useState(false);
    const [showConvertModal, setShowConvertModal] = useState(false);
    const [targetFormat, setTargetFormat] = useState('Splunk SPL');
    const [sidebarTab, setSidebarTab] = useState<'SETTINGS' | 'AI' | 'HISTORY' | 'TESTING'>('SETTINGS');
    const [showTemplateMenu, setShowTemplateMenu] = useState(false);
    
    // Test Suite State
    const [simulationLog, setSimulationLog] = useState('');
    const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
    const [isSimulating, setIsSimulating] = useState(false);
    const [isGeneratingLog, setIsGeneratingLog] = useState(false);
    const [testCaseMode, setTestCaseMode] = useState<'QUICK' | 'SUITE'>('SUITE');
    const [newTestCaseName, setNewTestCaseName] = useState('');
    const [newTestCaseExpect, setNewTestCaseExpect] = useState(true);
    const [runningTests, setRunningTests] = useState(false);

    // Comparison / Diff State
    const [compareVersion, setCompareVersion] = useState<SocRuleVersion | null>(null);
    
    // Linting State
    const [lintErrors, setLintErrors] = useState<string[]>([]);

    // Metadata Input State
    const [newTag, setNewTag] = useState('');
    const [newMitre, setNewMitre] = useState('');

    // MITRE Mapping State
    const [mitreTechniques, setMitreTechniques] = useState<MitreTechnique[]>([]);
    const [showMitreSuggestions, setShowMitreSuggestions] = useState(false);

    // Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<string>('ALL');
    const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);

    // Helper to open editor for a rule
    const handleEditRule = (rule: SocRule) => {
        setEditingRule(rule);
        setEditorContent(rule.content);
        setCompareVersion(null);
        setActiveTab('EDITOR');
        setSidebarTab('SETTINGS');
        setSimulationResult(null);
        setSimulationLog('');
        setTestCaseMode('SUITE');
    };

    // Deep link handling
    useEffect(() => {
        if (initialRuleId && rules.length > 0) {
            const target = rules.find(r => r.id === initialRuleId);
            if (target) {
                handleEditRule(target);
            }
        }
    }, [initialRuleId, rules]);

    // Save effects
    useEffect(() => {
        localStorage.setItem('xyberah_soc_rules', JSON.stringify(rules));
    }, [rules]);

    useEffect(() => {
        localStorage.setItem('xyberah_rule_sources', JSON.stringify(sources));
    }, [sources]);

    // Session Persistence
    useEffect(() => {
        localStorage.setItem('xyberah_rules_active_tab', activeTab);
        if (editingRule) {
            localStorage.setItem('xyberah_rules_editing_id', editingRule.id);
        } else {
            localStorage.removeItem('xyberah_rules_editing_id');
        }
    }, [activeTab, editingRule]);

    // Load MITRE Data
    useEffect(() => {
        getMitreMatrix().then(matrix => {
            const all = Object.values(matrix.techniques).flat();
            const unique = Array.from(new Map(all.map(t => [t.id, t])).values());
            setMitreTechniques(unique.sort((a,b) => a.id.localeCompare(b.id)));
        }).catch(() => {});
    }, []);

    // --- Real-time Linting Logic ---
    useEffect(() => {
        if (!editingRule) return;
        const errors: string[] = [];
        const content = editorContent.trim();

        if (!content) {
            // No errors for empty draft yet
        } else if (editingRule.type === 'YARA') {
            if (!content.match(/rule\s+[a-zA-Z0-9_]+\s*\{/)) errors.push("Missing valid 'rule <name> {' declaration");
            if (!content.includes('condition:')) errors.push("Missing 'condition:' section");
            
            const openBraces = (content.match(/\{/g) || []).length;
            const closeBraces = (content.match(/\}/g) || []).length;
            if (openBraces !== closeBraces) errors.push(`Unbalanced braces: ${openBraces} '{' vs ${closeBraces} '}'`);
        } else if (editingRule.type === 'SIGMA') {
            if (!content.includes('title:')) errors.push("Missing 'title:' field");
            if (!content.includes('logsource:')) errors.push("Missing 'logsource:' section");
            if (!content.includes('detection:')) errors.push("Missing 'detection:' section");
            if (!content.includes('condition:')) errors.push("Missing 'condition:' field");
        } else if (editingRule.type === 'SURICATA') {
            if (!content.startsWith('alert') && !content.startsWith('drop') && !content.startsWith('pass')) errors.push("Rule must start with action (alert, drop, pass)");
            if (!content.includes('sid:')) errors.push("Missing 'sid:' (Signature ID)");
            if (!content.includes('msg:')) errors.push("Missing 'msg:' (Message)");
        }

        setLintErrors(errors);
    }, [editorContent, editingRule?.type]);

    const mitreSuggestions = useMemo(() => {
        if (!newMitre) return [];
        const lower = newMitre.toLowerCase();
        return mitreTechniques.filter(t => t.id.toLowerCase().includes(lower) || t.name.toLowerCase().includes(lower)).slice(0, 8);
    }, [newMitre, mitreTechniques]);

    const handleRestoreDefaults = () => {
        if (window.confirm("This will restore the default rules library. Any custom rules will be preserved if IDs don't conflict. Continue?")) {
            setRules(prev => {
                const existingIds = new Set(prev.map(r => r.id));
                const newDefaults = DEFAULT_RULES.filter(r => !existingIds.has(r.id));
                return [...prev, ...newDefaults];
            });
        }
    };

    const handleSync = async (sourceId: string) => {
        setSyncing(prev => ({ ...prev, [sourceId]: true }));
        try {
            const source = sources.find(s => s.id === sourceId);
            if (source) {
                const newRules = await syncSource(source);
                setRules(prev => {
                    const map = new Map(prev.map(r => [r.id, r]));
                    newRules.forEach(r => map.set(r.id, r));
                    return Array.from(map.values());
                });
                setSources(prev => prev.map(s => s.id === sourceId ? { ...s, lastSync: Date.now(), count: newRules.length } : s));
            }
        } finally {
            setSyncing(prev => ({ ...prev, [sourceId]: false }));
        }
    };

    const handleSyncAll = async () => {
        sources.forEach(s => {
            if (s.enabled) handleSync(s.id);
        });
    };

    const handleCreateRule = () => {
        const newRule: SocRule = {
            id: crypto.randomUUID(),
            name: 'New Detection Rule',
            type: 'YARA',
            content: 'rule NewRule {\n    meta:\n        author = "Analyst"\n        description = "Detects ..."\n    strings:\n        $a = "malicious_string"\n    condition:\n        $a\n}',
            source: 'Manual',
            tags: [],
            severity: 'Low',
            status: 'DRAFT',
            date: new Date().toISOString().split('T')[0],
            mitreAttack: [],
            versions: [],
            testCases: []
        };
        setEditingRule(newRule);
        setEditorContent(newRule.content);
        setCompareVersion(null);
        setActiveTab('EDITOR');
        setSidebarTab('SETTINGS');
        setSimulationResult(null);
        setSimulationLog('');
        setTestCaseMode('SUITE');
    };

    const handleSaveRule = () => {
        if (editingRule) {
            const updated = { ...editingRule, content: editorContent, date: new Date().toISOString().split('T')[0] };
            setRules(prev => {
                const exists = prev.find(r => r.id === updated.id);
                if (exists) return prev.map(r => r.id === updated.id ? updated : r);
                return [...prev, updated];
            });
            setEditingRule(updated);
        }
    };

    const handleSaveVersion = () => {
        if (editingRule) {
            const nextVersion = (editingRule.versions?.length || 0) + 1;
            const newVersion: SocRuleVersion = {
                version: nextVersion,
                content: editorContent,
                date: new Date().toISOString(),
                author: editingRule.author || 'User'
            };
            
            const updatedVersions = [...(editingRule.versions || []), newVersion];
            const updatedRule = { 
                ...editingRule, 
                content: editorContent, 
                versions: updatedVersions,
                date: new Date().toISOString().split('T')[0]
            };
            
            setRules(prev => prev.map(r => r.id === updatedRule.id ? updatedRule : r));
            setEditingRule(updatedRule);
        }
    };

    const handleRevertVersion = (version: SocRuleVersion) => {
        if (window.confirm(`Revert editor content to version ${version.version}? Unsaved changes will be lost.`)) {
            setEditorContent(version.content);
            setCompareVersion(null);
        }
    };

    const handleCompareVersion = (version: SocRuleVersion) => {
        if (compareVersion?.version === version.version) {
            setCompareVersion(null); // Toggle off
        } else {
            setCompareVersion(version);
        }
    };

    const handleDeleteRule = (id: string) => {
        if (window.confirm("Are you sure you want to delete this rule?")) {
            setRules(prev => prev.filter(r => r.id !== id));
            if (editingRule?.id === id) {
                setEditingRule(null);
                setActiveTab('LIBRARY');
            }
        }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const imported = await parseImport(e.target.files[0]);
            setRules(prev => [...prev, ...imported]);
        }
    };

    const handleAiGenerate = async () => {
        if (!aiPrompt) return;
        setIsAiProcessing(true);
        try {
            const result = await generateRuleFromLog(aiPrompt, editingRule?.type || 'YARA'); 
            setEditorContent(result);
            setAiOutput("Rule generated from input.");
        } finally {
            setIsAiProcessing(false);
        }
    };

    const handleAiExplain = async () => {
        if (!editorContent) return;
        setIsAiProcessing(true);
        try {
            const explanation = await explainRule(editorContent, editingRule?.type || 'YARA');
            setAiOutput(explanation);
        } finally {
            setIsAiProcessing(false);
        }
    };

    const handleConvert = async () => {
        if (!editorContent) return;
        setIsAiProcessing(true);
        try {
            const converted = await convertRule(editorContent, editingRule?.type || 'YARA', targetFormat);
            setAiOutput(converted);
        } finally {
            setIsAiProcessing(false);
            setShowConvertModal(false);
        }
    };

    const handleAutoMitre = async () => {
        if (!editorContent || !editingRule) return;
        setIsAiProcessing(true);
        try {
            const suggestions = await suggestMitreTags(editorContent);
            if (suggestions && suggestions.length > 0) {
                const current = new Set(editingRule.mitreAttack || []);
                suggestions.forEach(s => current.add(s));
                const updated = { ...editingRule, mitreAttack: Array.from(current) };
                setEditingRule(updated);
                setRules(prev => prev.map(r => r.id === updated.id ? updated : r));
            }
        } finally {
            setIsAiProcessing(false);
        }
    };

    const handleRunSimulation = async () => {
        if (!editorContent || !simulationLog || !editingRule) return;
        setIsSimulating(true);
        setSimulationResult(null);
        try {
            const result = await evaluateRuleMatch(editorContent, editingRule.type, simulationLog);
            setSimulationResult(result);
        } catch (error) {
            console.error("Simulation failed", error);
        } finally {
            setIsSimulating(false);
        }
    };

    const handleGenerateSample = async () => {
        if (!editorContent || !editingRule) return;
        setIsGeneratingLog(true);
        try {
            const log = await generateLogFromRule(editorContent, editingRule.type);
            setSimulationLog(log);
        } finally {
            setIsGeneratingLog(false);
        }
    };
    
    const handleApplyTemplate = (templateContent: string) => {
        if (editorContent && !window.confirm("Replace current content with template?")) return;
        setEditorContent(templateContent);
        setShowTemplateMenu(false);
    };
    
    // --- Test Case Logic ---
    
    const handleSaveTestCase = () => {
        if (!editingRule || !simulationLog || !newTestCaseName) return;
        
        const newTest: RuleTestCase = {
            id: crypto.randomUUID(),
            name: newTestCaseName,
            log: simulationLog,
            shouldMatch: newTestCaseExpect,
            lastResult: undefined
        };
        
        const updated = { 
            ...editingRule, 
            testCases: [...(editingRule.testCases || []), newTest] 
        };
        
        setEditingRule(updated);
        setRules(prev => prev.map(r => r.id === updated.id ? updated : r));
        setNewTestCaseName('');
    };
    
    const handleDeleteTestCase = (id: string) => {
        if (!editingRule) return;
        const updated = {
            ...editingRule,
            testCases: (editingRule.testCases || []).filter(t => t.id !== id)
        };
        setEditingRule(updated);
        setRules(prev => prev.map(r => r.id === updated.id ? updated : r));
    };
    
    const handleRunTest = async (testCase: RuleTestCase) => {
        if (!editingRule) return;
        
        try {
            const result = await evaluateRuleMatch(editorContent, editingRule.type, testCase.log);
            const passed = result.match === testCase.shouldMatch;
            
            const updatedTestCase: RuleTestCase = {
                ...testCase,
                lastResult: {
                    match: result.match,
                    passed,
                    timestamp: new Date().toISOString(),
                    details: result.reason
                }
            };
            
            // Update local state for immediate feedback
            const updatedCases = (editingRule.testCases || []).map(t => t.id === testCase.id ? updatedTestCase : t);
            const updatedRule = { ...editingRule, testCases: updatedCases };
            setEditingRule(updatedRule);
            setRules(prev => prev.map(r => r.id === updatedRule.id ? updatedRule : r));
            
        } catch (e) {
            console.error("Test failed", e);
        }
    };
    
    const handleRunAllTests = async () => {
        if (!editingRule || !editingRule.testCases || editingRule.testCases.length === 0) return;
        setRunningTests(true);
        
        // Run sequentially to avoid API limits
        for (const test of editingRule.testCases) {
            await handleRunTest(test);
            await new Promise(r => setTimeout(r, 500)); // Slight delay
        }
        
        setRunningTests(false);
    };

    const handleAddTag = () => {
        if (editingRule && newTag) {
            const tag = newTag.trim();
            if (tag && !editingRule.tags.includes(tag)) {
                const updated = { ...editingRule, tags: [...editingRule.tags, tag] };
                setEditingRule(updated);
                setRules(prev => prev.map(r => r.id === updated.id ? updated : r));
            }
            setNewTag('');
        }
    };

    const handleRemoveTag = (tag: string) => {
        if (editingRule) {
            const updated = { ...editingRule, tags: editingRule.tags.filter(t => t !== tag) };
            setEditingRule(updated);
            setRules(prev => prev.map(r => r.id === updated.id ? updated : r));
        }
    };

    const handleAddMitre = () => {
        if (editingRule && newMitre) {
            const mitre = newMitre.trim().toUpperCase();
            const current = editingRule.mitreAttack || [];
            if (mitre && !current.includes(mitre)) {
                const updated = { ...editingRule, mitreAttack: [...current, mitre] };
                setEditingRule(updated);
                setRules(prev => prev.map(r => r.id === updated.id ? updated : r));
            }
            setNewMitre('');
            setShowMitreSuggestions(false);
        }
    };

    const handleAddMitreSpecific = (id: string) => {
         if (editingRule) {
            const mitre = id.toUpperCase();
            const current = editingRule.mitreAttack || [];
            if (!current.includes(mitre)) {
                const updated = { ...editingRule, mitreAttack: [...current, mitre] };
                setEditingRule(updated);
                setRules(prev => prev.map(r => r.id === updated.id ? updated : r));
            }
            setNewMitre('');
            setShowMitreSuggestions(false);
        }
    };

    const handleRemoveMitre = (mitre: string) => {
        if (editingRule) {
            const current = editingRule.mitreAttack || [];
            const updated = { ...editingRule, mitreAttack: current.filter(m => m !== mitre) };
            setEditingRule(updated);
            setRules(prev => prev.map(r => r.id === updated.id ? updated : r));
        }
    };

    const renderLibrary = () => {
        const filtered = rules.filter(r => {
            const matchText = (r.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || r.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchType = filterType === 'ALL' || r.type === filterType;
            return matchText && matchType;
        });

        return (
            <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
                <div className="p-4 bg-black/40 border-b border-gray-800 flex gap-4 items-center">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-2.5 text-gray-500 w-4 h-4" />
                        <input 
                            type="text" 
                            placeholder="Search rules..." 
                            className="bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm text-gray-300 w-full focus:border-cyber-cyan focus:outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select 
                        className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:border-cyber-cyan focus:outline-none"
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                    >
                        <option value="ALL">All Types</option>
                        <option value="YARA">YARA</option>
                        <option value="SIGMA">SIGMA</option>
                        <option value="SURICATA">Suricata</option>
                        <option value="ZEEK">Zeek</option>
                    </select>
                    <div className="ml-auto flex gap-2">
                        <label className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-300 text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors">
                            <Upload size={14}/> IMPORT
                            <input type="file" className="hidden" onChange={handleImport} />
                        </label>
                        <button onClick={handleCreateRule} className="px-3 py-2 bg-cyber-cyan/20 hover:bg-cyber-cyan/40 text-cyber-cyan border border-cyber-cyan/50 rounded text-xs font-bold flex items-center gap-2 transition-colors">
                            <Plus size={14}/> CREATE NEW
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                    {filtered.length === 0 ? (
                        <div className="text-center text-gray-500 mt-20 flex flex-col items-center">
                            <Database size={48} className="opacity-20 mb-4"/>
                            <p className="mb-4">No rules found matching your criteria.</p>
                            <button 
                                onClick={handleRestoreDefaults}
                                className="px-4 py-2 bg-purple-900/20 text-purple-400 border border-purple-500/30 rounded text-sm font-bold flex items-center gap-2 hover:bg-purple-900/40 transition-colors"
                            >
                                <RotateCw size={14}/> Restore Default Library
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-2">
                            {filtered.map(rule => (
                                <div key={rule.id} className="bg-gray-900/40 border border-gray-800 rounded-lg overflow-hidden transition-all hover:border-gray-600 group">
                                    <div 
                                        className="p-3 flex items-center justify-between cursor-pointer bg-gray-900/30"
                                        onClick={() => setExpandedRuleId(expandedRuleId === rule.id ? null : rule.id)}
                                    >
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                            <div className="p-2 bg-gray-800 rounded border border-gray-700 group-hover:border-gray-500">
                                                <FileCode size={20} className="text-gray-400"/>
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-sm font-bold text-gray-200 truncate">{rule.name}</h4>
                                                    {rule.mitreAttack && rule.mitreAttack.length > 0 && (
                                                        <div className="flex gap-1">
                                                            {rule.mitreAttack.slice(0, 3).map(m => (
                                                                <span key={m} className="text-[9px] text-orange-400 bg-orange-900/20 px-1 rounded border border-orange-500/20">{m}</span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Badge type={rule.type}/>
                                                    <span className="text-[10px] text-gray-500 border-l border-gray-700 pl-2">{rule.source || 'Unknown Source'}</span>
                                                    <span className="text-[10px] text-gray-500 border-l border-gray-700 pl-2">Updated: {rule.date}</span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            <StatusBadge status={rule.status} />
                                            {expandedRuleId === rule.id ? <ChevronUp size={16} className="text-gray-500"/> : <ChevronDown size={16} className="text-gray-500"/>}
                                        </div>
                                    </div>

                                    {expandedRuleId === rule.id && (
                                        <div className="p-4 border-t border-gray-800 bg-black/20 animate-fade-in">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <div className="space-y-3">
                                                    <div className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2 border-b border-gray-800 pb-1">
                                                        <Shield size={12}/> MITRE ATT&CK Mapping
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {rule.mitreAttack && rule.mitreAttack.length > 0 ? rule.mitreAttack.map(m => {
                                                            const info = mitreTechniques.find(t => t.id === m);
                                                            return (
                                                                <a 
                                                                    key={m} 
                                                                    href={`https://attack.mitre.org/techniques/${m.replace('.', '/')}`} 
                                                                    target="_blank" 
                                                                    rel="noreferrer"
                                                                    className="px-2 py-1 bg-orange-900/20 border border-orange-500/30 text-orange-400 text-xs rounded flex items-center gap-1 hover:bg-orange-900/40 transition-colors"
                                                                    title={info?.name}
                                                                >
                                                                    {m} {info && <span className="opacity-50 text-[9px]">| {info.name}</span>} <ExternalLink size={10}/>
                                                                </a>
                                                            )
                                                        }) : <span className="text-gray-600 text-xs italic">No techniques mapped. Add in Editor.</span>}
                                                    </div>
                                                </div>

                                                <div className="space-y-3">
                                                    <div className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2 border-b border-gray-800 pb-1">
                                                        <Tag size={12}/> Tags & Metadata
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {rule.tags.map(t => (
                                                            <span key={t} className="px-2 py-1 bg-gray-800 text-gray-400 border border-gray-700 text-xs rounded">{t}</span>
                                                        ))}
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-2 space-y-1 font-mono">
                                                        <div>Severity: <span className="text-white">{rule.severity}</span></div>
                                                        <div>Author: {rule.author || 'Unknown'}</div>
                                                        <div>ID: {rule.id.substring(0,8)}...</div>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col justify-end gap-2">
                                                    <button onClick={(e) => { e.stopPropagation(); handleEditRule(rule); }} className="w-full py-2 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/30 rounded text-xs font-bold flex items-center justify-center gap-2 transition-colors">
                                                        <Edit3 size={14}/> OPEN IN EDITOR
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteRule(rule.id); }} className="w-full py-2 bg-red-900/10 hover:bg-red-900/20 text-red-400 border border-red-500/30 rounded text-xs font-bold flex items-center justify-center gap-2 transition-colors">
                                                        <Trash2 size={14}/> DELETE RULE
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderEditor = () => {
        if (!editingRule) return <div className="flex items-center justify-center h-full text-gray-500">No rule selected.</div>;

        return (
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden animate-fade-in h-full">
                <div className="flex-1 flex flex-col border-r border-gray-800 min-w-0">
                    <div className="p-2 bg-gray-900/50 border-b border-gray-800 flex items-center gap-2">
                        <input 
                            type="text" 
                            value={editingRule.name}
                            onChange={(e) => setEditingRule({...editingRule, name: e.target.value})}
                            className="bg-transparent text-sm font-bold text-white focus:outline-none border-b border-transparent focus:border-gray-600 px-2 py-1 flex-1"
                        />
                        <select 
                            value={editingRule.status} 
                            onChange={(e) => setEditingRule({...editingRule, status: e.target.value as any})}
                            className="bg-gray-800 text-xs text-gray-300 rounded px-2 py-1 border border-gray-700"
                        >
                            <option value="DRAFT">Draft</option>
                            <option value="REVIEW">Review</option>
                            <option value="STAGING">Staging</option>
                            <option value="ACTIVE">Active</option>
                            <option value="DEPRECATED">Deprecated</option>
                        </select>
                        <div className="h-4 w-px bg-gray-700 mx-2"></div>
                        
                        <div className="relative">
                             <button 
                                onClick={() => setShowTemplateMenu(!showTemplateMenu)} 
                                className="p-1.5 hover:bg-white/10 rounded text-orange-400 text-xs font-bold flex items-center gap-1" 
                                title="Insert Template"
                             >
                                <FileText size={14}/> Template
                             </button>
                             {showTemplateMenu && (
                                 <div className="absolute top-full right-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 w-48">
                                     <div className="p-2 text-[10px] text-gray-500 uppercase font-bold">Available Templates</div>
                                     {RULE_TEMPLATES[editingRule.type]?.map((t, i) => (
                                         <button 
                                            key={i} 
                                            onClick={() => handleApplyTemplate(t.content)}
                                            className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-800"
                                         >
                                             {t.name}
                                         </button>
                                     ))}
                                     {(!RULE_TEMPLATES[editingRule.type] || RULE_TEMPLATES[editingRule.type].length === 0) && (
                                         <div className="px-3 py-2 text-xs text-gray-600 italic">No templates for {editingRule.type}</div>
                                     )}
                                 </div>
                             )}
                        </div>

                        <button onClick={() => setShowConvertModal(true)} className="p-1.5 hover:bg-white/10 rounded text-purple-400" title="Convert"><RefreshCw size={16}/></button>
                        <button onClick={handleSaveRule} className="p-1.5 hover:bg-white/10 rounded text-green-400" title="Save"><Save size={16}/></button>
                    </div>
                    
                    <div className="flex-1 p-4 bg-[#0d1117] flex gap-4 relative">
                        {compareVersion ? (
                            <>
                                <div className="flex-1 flex flex-col h-full">
                                    <CodeEditor 
                                        value={compareVersion.content} 
                                        language={editingRule.type} 
                                        readOnly={true} 
                                        label={`Version ${compareVersion.version} (${new Date(compareVersion.date).toLocaleDateString()})`}
                                    />
                                </div>
                                <div className="flex-1 flex flex-col h-full">
                                    <CodeEditor 
                                        value={editorContent} 
                                        onChange={setEditorContent} 
                                        language={editingRule.type}
                                        label="Current Draft"
                                    />
                                </div>
                            </>
                        ) : (
                            <CodeEditor 
                                value={editorContent} 
                                onChange={setEditorContent} 
                                language={editingRule.type}
                            />
                        )}

                        {/* Lint Error Overlay */}
                        {lintErrors.length > 0 && (
                            <div className="absolute bottom-4 left-4 right-4 bg-red-900/90 border border-red-500 text-red-200 p-3 rounded shadow-lg text-xs font-mono backdrop-blur-md z-10 animate-fade-in-up">
                                <div className="font-bold flex items-center gap-2 mb-1 text-red-100"><AlertTriangle size={12}/> Syntax Issues Detected</div>
                                <ul className="list-disc list-inside space-y-0.5">
                                    {lintErrors.map((err, i) => <li key={i}>{err}</li>)}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>

                <div className="w-80 md:w-96 flex flex-col bg-black/20">
                    <div className="flex border-b border-gray-800 bg-gray-900/50">
                        <button 
                            onClick={() => setSidebarTab('SETTINGS')} 
                            className={`flex-1 py-3 text-[10px] font-bold uppercase border-b-2 transition-colors flex items-center justify-center gap-2 ${sidebarTab === 'SETTINGS' ? 'border-cyber-cyan text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                        >
                            <Layout size={12}/> Settings
                        </button>
                        <button 
                            onClick={() => setSidebarTab('TESTING')} 
                            className={`flex-1 py-3 text-[10px] font-bold uppercase border-b-2 transition-colors flex items-center justify-center gap-2 ${sidebarTab === 'TESTING' ? 'border-yellow-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                        >
                            <FlaskConical size={12}/> Testing
                        </button>
                        <button 
                            onClick={() => setSidebarTab('AI')} 
                            className={`flex-1 py-3 text-[10px] font-bold uppercase border-b-2 transition-colors flex items-center justify-center gap-2 ${sidebarTab === 'AI' ? 'border-purple-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                        >
                            <Sparkles size={12}/> AI Assist
                        </button>
                        <button 
                            onClick={() => setSidebarTab('HISTORY')} 
                            className={`flex-1 py-3 text-[10px] font-bold uppercase border-b-2 transition-colors flex items-center justify-center gap-2 ${sidebarTab === 'HISTORY' ? 'border-green-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                        >
                            <Clock size={12}/> History
                        </button>
                    </div>

                    <div className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-6">
                        {sidebarTab === 'SETTINGS' && (
                            <div className="space-y-6 animate-fade-in">
                                <div>
                                    <label className="text-xs text-gray-500 font-bold uppercase mb-2 block">Rule Severity</label>
                                    <select 
                                        value={editingRule.severity} 
                                        onChange={(e) => setEditingRule({...editingRule, severity: e.target.value as any})}
                                        className="w-full bg-black border border-gray-700 rounded p-2 text-xs text-white"
                                    >
                                        <option value="Critical">Critical</option>
                                        <option value="High">High</option>
                                        <option value="Medium">Medium</option>
                                        <option value="Low">Low</option>
                                        <option value="Info">Info</option>
                                    </select>
                                </div>
                                
                                <div>
                                    <label className="text-xs text-gray-500 font-bold uppercase mb-2 block">Rule Type</label>
                                    <div className="px-2 py-1 bg-black border border-gray-700 rounded text-xs text-gray-400">
                                        {editingRule.type} (Change in Editor Header)
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs text-orange-400 font-bold uppercase mb-2 flex items-center gap-2"><Shield size={12}/> MITRE ATT&CK</label>
                                    <div className="relative">
                                        <div className="flex gap-2 mb-2">
                                            <input 
                                                type="text" 
                                                className="flex-1 bg-black border border-gray-700 rounded p-2 text-xs text-white placeholder-gray-600 uppercase"
                                                placeholder="T1059..."
                                                value={newMitre}
                                                onChange={(e) => { setNewMitre(e.target.value); setShowMitreSuggestions(true); }}
                                                onBlur={() => setTimeout(() => setShowMitreSuggestions(false), 200)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleAddMitre()}
                                            />
                                            <button onClick={handleAutoMitre} disabled={isAiProcessing} className="px-3 bg-purple-900/20 border border-purple-500/30 text-purple-400 rounded hover:bg-purple-900/40" title="Auto-Suggest IDs">
                                                {isAiProcessing ? <Loader2 className="animate-spin" size={14}/> : <Sparkles size={14}/>}
                                            </button>
                                            <button onClick={handleAddMitre} className="px-3 bg-orange-900/20 border border-orange-500/30 text-orange-400 rounded hover:bg-orange-900/40"><Plus size={14}/></button>
                                        </div>
                                        {showMitreSuggestions && mitreSuggestions.length > 0 && (
                                            <div className="absolute top-full left-0 right-0 bg-gray-900 border border-gray-700 rounded z-50 max-h-40 overflow-y-auto shadow-xl">
                                                {mitreSuggestions.map(t => (
                                                    <button 
                                                        key={t.id} 
                                                        className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-orange-900/20 hover:text-orange-400 flex justify-between items-center"
                                                        onClick={() => handleAddMitreSpecific(t.id)}
                                                    >
                                                        <span className="font-bold">{t.id}</span>
                                                        <span className="truncate ml-2 opacity-70">{t.name}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {editingRule.mitreAttack?.map(m => {
                                            const info = mitreTechniques.find(t => t.id === m);
                                            return (
                                                <span key={m} className="px-2 py-1 bg-orange-900/20 border border-orange-500/30 text-orange-400 text-xs rounded flex items-center gap-1" title={info?.name}>
                                                    {m} {info && <span className="opacity-50 text-[9px] hidden md:inline">| {info.name.substring(0, 15)}..</span>}
                                                    <button onClick={() => handleRemoveMitre(m)} className="hover:text-white"><X size={10}/></button>
                                                </span>
                                            )
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs text-gray-500 font-bold uppercase mb-2 flex items-center gap-2"><Tag size={12}/> Tags</label>
                                    <div className="flex gap-2 mb-2">
                                        <input 
                                            type="text" 
                                            className="flex-1 bg-black border border-gray-700 rounded p-2 text-xs text-white placeholder-gray-600"
                                            placeholder="Add tag..."
                                            value={newTag}
                                            onChange={(e) => setNewTag(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                                        />
                                        <button onClick={handleAddTag} className="px-3 bg-gray-800 border border-gray-600 text-gray-300 rounded hover:bg-gray-700"><Plus size={14}/></button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {editingRule.tags.map(t => (
                                            <span key={t} className="px-2 py-1 bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded flex items-center gap-1">
                                                {t} <button onClick={() => handleRemoveTag(t)} className="hover:text-white"><X size={10}/></button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {sidebarTab === 'TESTING' && (
                            <div className="space-y-6 animate-fade-in">
                                <div className="flex bg-gray-900 rounded p-1 border border-gray-700">
                                    <button onClick={() => setTestCaseMode('SUITE')} className={`flex-1 py-1 text-[10px] font-bold rounded ${testCaseMode === 'SUITE' ? 'bg-gray-700 text-white' : 'text-gray-500'}`}>Test Suite</button>
                                    <button onClick={() => setTestCaseMode('QUICK')} className={`flex-1 py-1 text-[10px] font-bold rounded ${testCaseMode === 'QUICK' ? 'bg-gray-700 text-white' : 'text-gray-500'}`}>Quick Check</button>
                                </div>

                                {testCaseMode === 'QUICK' ? (
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <label className="text-xs text-gray-500 font-bold uppercase">Log Sample</label>
                                            <div className="flex gap-2">
                                                <button onClick={() => setSimulationLog('')} className="text-[10px] text-gray-500 hover:text-white underline">Clear</button>
                                                <button onClick={handleGenerateSample} disabled={isGeneratingLog} className="text-[10px] text-cyber-cyan hover:text-white flex items-center gap-1">
                                                    {isGeneratingLog ? <Loader2 size={10} className="animate-spin"/> : <Sparkles size={10}/>} Gen AI
                                                </button>
                                            </div>
                                        </div>
                                        <textarea 
                                            value={simulationLog}
                                            onChange={(e) => setSimulationLog(e.target.value)}
                                            className="w-full h-32 bg-black/50 border border-gray-700 rounded p-2 text-xs font-mono text-gray-300 focus:border-yellow-500 focus:outline-none resize-none"
                                            placeholder='{"event_id": 4688, "command_line": "powershell.exe ..."}'
                                        />
                                        <button 
                                            onClick={handleRunSimulation}
                                            disabled={isSimulating || !simulationLog}
                                            className="w-full py-2 bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-500 border border-yellow-600/50 rounded text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                                        >
                                            {isSimulating ? <Loader2 className="animate-spin" size={14}/> : <Play size={14}/>} RUN TEST
                                        </button>

                                        {simulationResult && (
                                            <div className={`p-4 rounded border animate-fade-in ${simulationResult.match ? 'bg-green-900/10 border-green-500/50' : 'bg-red-900/10 border-red-500/50'}`}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className={`text-sm font-bold flex items-center gap-2 ${simulationResult.match ? 'text-green-400' : 'text-red-400'}`}>
                                                        {simulationResult.match ? <CheckCircle size={16}/> : <XCircle size={16}/>}
                                                        {simulationResult.match ? 'MATCH' : 'NO MATCH'}
                                                    </span>
                                                    <button onClick={handleSaveTestCase} disabled={!newTestCaseName} className="text-[10px] text-blue-400 hover:text-white underline">Save as Case</button>
                                                </div>
                                                <input 
                                                    type="text" 
                                                    placeholder="Name this test case..." 
                                                    className="w-full mb-2 bg-black border border-gray-700 rounded p-1 text-xs text-white"
                                                    value={newTestCaseName}
                                                    onChange={e => setNewTestCaseName(e.target.value)}
                                                />
                                                <p className="text-xs text-gray-300 leading-relaxed mb-3">{simulationResult.reason}</p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-gray-500 font-bold uppercase">{editingRule.testCases?.length || 0} Cases</span>
                                            <button onClick={handleRunAllTests} disabled={runningTests} className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded font-bold flex items-center gap-2">
                                                {runningTests ? <Loader2 className="animate-spin" size={12}/> : <Play size={12}/>} Run All
                                            </button>
                                        </div>
                                        
                                        <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                                            {editingRule.testCases && editingRule.testCases.length > 0 ? editingRule.testCases.map((test, i) => (
                                                <div key={test.id} className="bg-gray-900 border border-gray-800 rounded p-2 hover:border-gray-600 transition-colors group">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`w-2 h-2 rounded-full ${test.lastResult?.passed ? 'bg-green-500' : test.lastResult ? 'bg-red-500' : 'bg-gray-600'}`}></span>
                                                            <span className="text-xs font-bold text-gray-200">{test.name}</span>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <span className={`text-[9px] px-1.5 rounded ${test.shouldMatch ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                                                                Expect: {test.shouldMatch ? 'True' : 'False'}
                                                            </span>
                                                            <button onClick={() => handleDeleteTestCase(test.id)} className="text-gray-600 hover:text-red-400"><Trash2 size={12}/></button>
                                                        </div>
                                                    </div>
                                                    <div className="bg-black/30 p-1 rounded text-[9px] font-mono text-gray-400 truncate mb-1">{test.log.substring(0, 50)}...</div>
                                                    {test.lastResult && (
                                                        <div className={`text-[10px] ${test.lastResult.passed ? 'text-green-400' : 'text-red-400'}`}>
                                                            Result: {test.lastResult.match ? 'Match' : 'No Match'} 
                                                            <span className="text-gray-600 ml-2">{new Date(test.lastResult.timestamp).toLocaleTimeString()}</span>
                                                        </div>
                                                    )}
                                                    <button onClick={() => handleRunTest(test)} className="w-full mt-1 text-[9px] bg-gray-800 hover:bg-gray-700 text-gray-300 py-1 rounded">Run Single</button>
                                                </div>
                                            )) : (
                                                <div className="text-center text-gray-500 text-xs italic py-4 border border-dashed border-gray-800 rounded">No test cases defined. Use Quick Check to create one.</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {sidebarTab === 'AI' && (
                            <div className="space-y-4 animate-fade-in">
                                <div className="space-y-2">
                                    <label className="text-xs text-gray-500 font-bold">Prompt / Log Snippet</label>
                                    <textarea 
                                        className="w-full bg-black/50 border border-gray-700 rounded p-2 text-xs text-gray-300 focus:border-purple-500 focus:outline-none h-24 font-mono"
                                        placeholder="Paste a log to generate a rule, or ask to explain..."
                                        value={aiPrompt}
                                        onChange={(e) => setAiPrompt(e.target.value)}
                                    />
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={handleAiGenerate} 
                                            disabled={isAiProcessing}
                                            className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            {isAiProcessing ? <Loader2 className="animate-spin" size={14}/> : <Play size={14}/>} Generate
                                        </button>
                                        <button 
                                            onClick={handleAiExplain} 
                                            disabled={isAiProcessing}
                                            className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            <MessageSquare size={14}/> Explain
                                        </button>
                                    </div>
                                </div>

                                {aiOutput && (
                                    <div className="space-y-2 pt-4 border-t border-gray-800">
                                        <label className="text-xs text-gray-500 font-bold">Output / Result</label>
                                        <div className="bg-black border border-gray-700 rounded p-3 text-xs font-mono text-green-400 whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                                            {aiOutput}
                                        </div>
                                        <button onClick={() => navigator.clipboard.writeText(aiOutput)} className="text-[10px] text-gray-500 hover:text-white underline">Copy Output</button>
                                    </div>
                                )}
                            </div>
                        )}

                        {sidebarTab === 'HISTORY' && (
                            <div className="space-y-4 animate-fade-in">
                                <button 
                                    onClick={handleSaveVersion}
                                    className="w-full py-2 bg-green-900/20 hover:bg-green-900/40 text-green-400 border border-green-500/30 rounded text-xs font-bold flex items-center justify-center gap-2"
                                >
                                    <GitBranch size={14}/> SNAPSHOT VERSION
                                </button>
                                
                                <div className="space-y-2">
                                    <div className="flex justify-between items-end">
                                        <label className="text-xs text-gray-500 font-bold uppercase">Timeline</label>
                                        <span className="text-[10px] text-gray-600">{editingRule.versions?.length || 0} versions</span>
                                    </div>
                                    
                                    <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                                        {editingRule.versions && editingRule.versions.length > 0 ? (
                                            [...editingRule.versions].reverse().map((ver) => (
                                                <div key={ver.version} className={`p-3 rounded border flex flex-col gap-2 transition-colors ${compareVersion?.version === ver.version ? 'bg-purple-900/10 border-purple-500/50' : 'bg-gray-900 border-gray-800 hover:border-gray-600'}`}>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs font-bold text-white flex items-center gap-2">
                                                            <GitBranch size={12} className="text-green-500"/> v{ver.version}.0
                                                        </span>
                                                        <span className="text-[10px] text-gray-500">{new Date(ver.date).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="text-[10px] text-gray-400">Author: {ver.author}</div>
                                                    
                                                    <div className="flex gap-2 mt-1">
                                                        <button 
                                                            onClick={() => handleCompareVersion(ver)}
                                                            className={`flex-1 py-1 text-[10px] rounded flex items-center justify-center gap-1 border ${compareVersion?.version === ver.version ? 'bg-purple-600 text-white border-purple-500' : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700'}`}
                                                        >
                                                            <Split size={10}/> {compareVersion?.version === ver.version ? 'Close Diff' : 'Compare'}
                                                        </button>
                                                        <button 
                                                            onClick={() => handleRevertVersion(ver)}
                                                            className="flex-1 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-[10px] rounded flex items-center justify-center gap-1"
                                                        >
                                                            <RotateCcw size={10}/> Revert
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-center text-gray-500 text-xs italic py-4 border border-dashed border-gray-800 rounded">No history available. Save a version to start tracking changes.</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderSources = () => (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 animate-fade-in">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-white">Rule Repositories</h2>
                        <p className="text-sm text-gray-500">Manage external rule sources and synchronization.</p>
                    </div>
                    <button onClick={handleSyncAll} className="px-4 py-2 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/50 rounded text-sm font-bold flex items-center gap-2">
                        <RefreshCw size={16}/> SYNC ALL
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {sources.map(source => (
                        <div key={source.id} className="bg-gray-900/40 border border-gray-800 rounded-lg p-4 flex items-center gap-4">
                            <div className={`p-3 rounded-lg border ${source.enabled ? 'bg-green-900/20 border-green-500/30 text-green-400' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>
                                <Layers size={24}/>
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-white">{source.name}</h3>
                                <p className="text-xs text-gray-500">{source.description}</p>
                                <div className="flex items-center gap-3 mt-2 text-[10px] font-mono text-gray-400">
                                    <span>TYPE: {source.type}</span>
                                    <span>|</span>
                                    <span>RULES: {source.count}</span>
                                    <span>|</span>
                                    <span>LAST SYNC: {source.lastSync ? new Date(source.lastSync).toLocaleTimeString() : 'NEVER'}</span>
                                </div>
                            </div>
                            <button 
                                onClick={() => handleSync(source.id)}
                                disabled={syncing[source.id]}
                                className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-cyber-cyan transition-colors"
                            >
                                {syncing[source.id] ? <Loader2 className="animate-spin" size={20}/> : <RefreshCw size={20}/>}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <div className="h-[calc(100vh-70px)] flex flex-col bg-cyber-grid relative">
            <div className="bg-black/40 border-b border-gray-800 flex px-4">
                <button onClick={() => setActiveTab('LIBRARY')} className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'LIBRARY' ? 'border-cyber-cyan text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                    <Book size={14}/> LIBRARY
                </button>
                <button onClick={() => setActiveTab('EDITOR')} className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'EDITOR' ? 'border-cyber-cyan text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                    <Edit3 size={14}/> EDITOR
                </button>
                <button onClick={() => setActiveTab('SOURCES')} className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'SOURCES' ? 'border-cyber-cyan text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                    <Database size={14}/> SOURCES
                </button>
            </div>

            {activeTab === 'LIBRARY' && renderLibrary()}
            {activeTab === 'EDITOR' && renderEditor()}
            {activeTab === 'SOURCES' && renderSources()}

            {showConvertModal && editingRule && (
                <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden">
                        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                            <h3 className="text-white font-bold flex items-center gap-2"><RefreshCw size={16}/> Convert Rule</h3>
                            <button onClick={() => setShowConvertModal(false)} className="text-gray-500 hover:text-white"><X size={20}/></button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="flex-1 p-3 bg-black/50 border border-gray-800 rounded text-center">
                                    <div className="text-xs text-gray-500 uppercase mb-1">Source</div>
                                    <div className="font-bold text-white">{editingRule.type}</div>
                                </div>
                                <ChevronRight className="text-gray-600"/>
                                <div className="flex-1">
                                    <label className="text-xs text-gray-500 uppercase mb-1 block">Target Format</label>
                                    <select 
                                        value={targetFormat} 
                                        onChange={e => setTargetFormat(e.target.value)}
                                        className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm"
                                    >
                                        <option value="Splunk SPL">Splunk SPL</option>
                                        <option value="Elastic KQL">Elastic KQL</option>
                                        <option value="OSQuery">OSQuery SQL</option>
                                        <option value="YARA">YARA</option>
                                        <option value="Snort">Snort</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setShowConvertModal(false)} className="px-4 py-2 text-gray-400 hover:text-white text-xs font-bold">CANCEL</button>
                                <button 
                                    onClick={handleConvert} 
                                    disabled={isAiProcessing}
                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-bold flex items-center gap-2"
                                >
                                    {isAiProcessing ? <Loader2 className="animate-spin" size={14}/> : <Sparkles size={14}/>} CONVERT
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
