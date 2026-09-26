import React, { useState, useRef, useEffect } from 'react';
import { Mail, Upload, FileText, Globe, Search, Shield, AlertTriangle, ArrowDown, MapPin, Clock, Server, CheckCircle, XCircle, ChevronDown, ChevronUp, AlertCircle, FileDigit, Zap, Layers, FileCode, RefreshCw, Network, Database, List, Lock, FileWarning, Hash, Download, Copy, Sparkles, X, Send, Bot, User, Loader2, Plus } from 'lucide-react';
import { EmailAnalysisResult, EmailHop, IpDataResponse } from '../../types';
import { analyzeEmailContent } from '../../services/emailForensics';
import { enrichIP, checkRBL, checkDomainSecurity, queryDoH, SecurityCheckResult } from '../../services/dns';
import { performRdapLookup, WhoisResult } from '../../services/netTools';
import { downloadFile } from '../../services/exporter';
import { formatEmailContext, createThreatChat } from '../../services/aiConverter';
import { Chat } from "@google/genai";

interface Message {
    id: string;
    role: 'user' | 'model';
    text: string;
    timestamp: Date;
}

interface EmailForensicViewProps {
    savedResult?: EmailAnalysisResult | null;
    onUpdateResult?: (result: EmailAnalysisResult | null) => void;
}

export const EmailForensicView: React.FC<EmailForensicViewProps> = ({ savedResult, onUpdateResult }) => {
    const [activeTab, setActiveTab] = useState<'UPLOAD' | 'PASTE'>('UPLOAD');
    const [viewMode, setViewMode] = useState<'DASHBOARD' | 'HEADERS' | 'BODY' | 'ARTIFACTS'>('DASHBOARD');
    const [isLoading, setIsLoading] = useState(false);
    
    // Initialize state from props for persistence
    const [result, setResult] = useState<EmailAnalysisResult | null>(savedResult || null);

    // Sync local state if parent prop updates
    useEffect(() => {
        setResult(savedResult || null);
    }, [savedResult]);

    // Wrapper to update both local and parent state
    const updateResult = (data: EmailAnalysisResult | null) => {
        setResult(data);
        if (onUpdateResult) onUpdateResult(data);
    };

    const [rawInput, setRawInput] = useState('');
    const [error, setError] = useState<string | null>(null);
    
    // IOC Enrichment Cache
    const [enrichedIocs, setEnrichedIocs] = useState<Record<string, any>>({});
    const [isEnriching, setIsEnriching] = useState(false);

    // AI Chat State
    const [showAiModal, setShowAiModal] = useState(false);
    const [chatSession, setChatSession] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const handleAnalysis = async (content: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await analyzeEmailContent(content);
            updateResult(data);
            setViewMode('DASHBOARD');
        } catch (e) {
            setError("Analysis failed. Check file format.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const text = await file.text();
            handleAnalysis(text);
        }
    };

    const handleAiAnalysis = async () => {
        if (!result) return;
        setShowAiModal(true);
        setIsAiLoading(true);
        setMessages([]);

        try {
            const contextStr = formatEmailContext(result);
            const chat = createThreatChat(contextStr);
            if (chat) {
                setChatSession(chat);
                // Trigger initial analysis
                const resultStream = await chat.sendMessageStream({ message: "Analyze this email for threats." });
                let fullText = '';
                for await (const chunk of resultStream) {
                    if (chunk.text) fullText += chunk.text;
                }
                setMessages([{ id: 'init', role: 'model', text: fullText, timestamp: new Date() }]);
            } else {
                 setMessages([{ id: 'err', role: 'model', text: "Error: AI Service not initialized. Check API Key.", timestamp: new Date() }]);
            }
        } catch (e) {
            setMessages([{ id: 'err', role: 'model', text: "Analysis failed to generate.", timestamp: new Date() }]);
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleSendMessage = async () => {
        if (!chatSession || !chatInput.trim() || isAiLoading) return;
        const userMsg = chatInput.trim();
        setChatInput('');
        setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', text: userMsg, timestamp: new Date() }]);
        setIsAiLoading(true);

        try {
            const result = await chatSession.sendMessageStream({ message: userMsg });
            let responseText = '';
            for await (const chunk of result) {
                if (chunk.text) responseText += chunk.text;
            }
            setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'model', text: responseText, timestamp: new Date() }]);
        } catch (error) {
            setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'model', text: "Error generating response.", timestamp: new Date() }]);
        } finally {
            setIsAiLoading(false);
        }
    };
    
    // Markdown Formatting Helper
    const parseInline = (text: string) => {
        // Handle Bold **text** and Code `text`
        const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
        return parts.map((p, k) => {
            if (p.startsWith('**')) return <strong key={k} className="text-neutral-200 font-bold">{p.replace(/\*\*/g, '')}</strong>;
            if (p.startsWith('`')) return <span key={k} className="bg-[#151515] text-white px-1 rounded font-mono text-xs border border-[#333]">{p.replace(/`/g, '')}</span>;
            return p;
        });
    };

    const formatMessage = (text: string) => {
        // Primitive Markdown Parser for React
        const parts = text.split(/(```[\s\S]*?```)/g); // Split code blocks first
        
        return parts.map((part, i) => {
            if (part.startsWith('```')) {
                 const content = part.replace(/^```\w*\n?|```$/g, '');
                 return (
                     <div key={i} className="bg-black/50 border border-[#333] rounded p-3 my-2 font-mono text-xs text-white overflow-x-auto whitespace-pre scrollbar-thin">
                         {content}
                     </div>
                 );
            }
            
            // Split by lines to handle headers/lists
            return (
                <div key={i} className="whitespace-pre-wrap">
                    {part.split('\n').map((line, j) => {
                        // Header
                        if (line.startsWith('### ')) {
                            return <div key={j} className="text-sm font-bold text-red-500 mt-4 mb-2 uppercase tracking-wider">{line.replace('### ', '')}</div>;
                        }
                        if (line.startsWith('## ')) {
                            return <div key={j} className="text-base font-bold text-red-400 mt-5 mb-2 border-b border-[#333] pb-1">{line.replace('## ', '')}</div>;
                        }
                        // List
                        if (line.trim().startsWith('- ')) {
                             return (
                                 <div key={j} className="flex gap-2 ml-2 mb-1">
                                     <span className="text-[#888] mt-1.5">•</span>
                                     <span className="flex-1">{parseInline(line.replace(/^\s*-\s+/, ''))}</span>
                                 </div>
                             );
                        }
                        // Numbered List (Basic)
                        if (/^\d+\.\s/.test(line.trim())) {
                            return (
                                <div key={j} className="flex gap-2 ml-2 mb-1">
                                    <span className="text-[#888] mt-0.5 font-mono text-xs">{line.trim().split('.')[0]}.</span>
                                    <span className="flex-1">{parseInline(line.replace(/^\s*\d+\.\s+/, ''))}</span>
                                 </div>
                            );
                        }
                        
                        if (line.trim() === '') return <div key={j} className="h-2"></div>;

                        return <div key={j} className="min-h-[1.5em] mb-1">{parseInline(line)}</div>;
                    })}
                </div>
            );
        });
    };

    const enrichIndicator = async (ioc: string, type: string) => {
        if (enrichedIocs[ioc]) return;
        setEnrichedIocs(prev => ({ ...prev, [ioc]: { loading: true } }));
        
        try {
            let info = {};
            let target = ioc.trim();

            // Improved Normalization
            if (type === 'URL' || type === 'DOMAIN') {
                try { 
                    // Handle URLs without protocol or with paths
                    const urlStr = target.startsWith('http') ? target : `http://${target}`;
                    const urlObj = new URL(urlStr);
                    target = urlObj.hostname; 
                } catch { 
                    // Fallback: split by slash to get domain part if URL parsing fails
                    target = target.split('/')[0];
                }
            } else if (type === 'EMAIL') {
                target = ioc.split('@')[1] || ioc;
            }

            const isIp = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(target);

            if (isIp) {
                const [geo, rbl] = await Promise.all([enrichIP(target), checkRBL(target)]);
                info = { 
                    dataType: 'IP_DATA',
                    country: geo?.country_code || 'XX', 
                    asn: geo?.asn?.name || 'Unknown', 
                    rbl: rbl.status 
                };
            } else {
                const sec = await checkDomainSecurity(target);
                const blocked = sec.some(s => s.status === 'BLOCKED');
                info = { 
                    dataType: 'DOMAIN_DATA',
                    malicious: blocked, 
                    providers: sec.length,
                    details: sec.filter(s => s.status === 'BLOCKED').map(s => s.provider).join(', ')
                };
            }
            
            setEnrichedIocs(prev => ({ ...prev, [ioc]: { loading: false, ...info } }));
        } catch (e) {
            setEnrichedIocs(prev => ({ ...prev, [ioc]: { loading: false, error: true } }));
        }
    };

    const exportIocs = () => {
        if (!result) return;
        const csv = result.iocs.map(i => `${i.type},${i.value}`).join('\n');
        downloadFile(`Type,Value\n${csv}`, `email_iocs_${Date.now()}.csv`, 'text/csv');
    };

    // Render Helpers
    const getRiskColor = (score: number) => {
        if (score >= 80) return 'text-red-500 border-red-500 bg-red-900/20';
        if (score >= 50) return 'text-white border-neutral-500 bg-neutral-900/20';
        if (score >= 20) return 'text-white border-neutral-500 bg-neutral-900/20';
        return 'text-white border-neutral-500 bg-neutral-900/20';
    };

    return (
        <div className="h-[calc(100vh-70px)] bg-cyber-grid flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-black/40 border-b border-[#222] p-4 shrink-0 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#111] rounded-lg border border-neutral-500/30 text-red-400">
                        <Mail size={20}/>
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white font-cyber flex items-center gap-2">
                            EMAIL <span className="text-red-500">FORENSICS</span>
                        </h2>
                        <p className="text-xs text-[#888] font-mono">Header Analysis & Artifact Extraction</p>
                    </div>
                </div>

                {result && (
                    <div className="flex bg-[#0A0A0A] rounded-lg p-1 border border-[#222] gap-1">
                        {[
                            { id: 'DASHBOARD', icon: Layers, label: 'Overview' },
                            { id: 'HEADERS', icon: FileCode, label: 'Headers' },
                            { id: 'BODY', icon: FileText, label: 'Content' },
                            { id: 'ARTIFACTS', icon: Database, label: 'Artifacts' }
                        ].map(tab => (
                            <button 
                                key={tab.id}
                                onClick={() => setViewMode(tab.id as any)}
                                className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition-all ${viewMode === tab.id ? 'bg-[#1C1C1C] text-white shadow' : 'text-[#888] hover:text-neutral-300'}`}
                            >
                                <tab.icon size={12}/> {tab.label}
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex gap-2">
                    {!result ? (
                         <div className="flex bg-[#0A0A0A] rounded-lg p-1 border border-[#222]">
                            <button onClick={() => setActiveTab('UPLOAD')} className={`px-3 py-1.5 rounded text-xs font-bold ${activeTab === 'UPLOAD' ? 'bg-[#1C1C1C] text-white' : 'text-[#888]'}`}>Upload</button>
                            <button onClick={() => setActiveTab('PASTE')} className={`px-3 py-1.5 rounded text-xs font-bold ${activeTab === 'PASTE' ? 'bg-[#1C1C1C] text-white' : 'text-[#888]'}`}>Paste</button>
                         </div>
                    ) : (
                        <>
                            <button 
                                onClick={handleAiAnalysis}
                                className="px-4 py-1.5 bg-neutral-600 hover:bg-neutral-500 text-white rounded text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-900/20"
                            >
                                <Sparkles size={14}/> Ask Xyber AI
                            </button>
                            <button onClick={() => updateResult(null)} className="px-3 py-1.5 bg-red-900/20 hover:bg-red-900/30 text-red-400 border border-red-500/30 rounded text-xs font-bold transition-colors">
                                New Analysis
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                {!result ? (
                    /* INPUT VIEW */
                    <div className="max-w-2xl mx-auto mt-10">
                        {activeTab === 'UPLOAD' && (
                            <div className="border-2 border-dashed border-[#333] rounded-xl p-16 flex flex-col items-center justify-center text-center hover:border-red-500/50 hover:bg-red-500/5 transition-all group cursor-pointer relative bg-black/20">
                                <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileUpload} accept=".eml,.msg,.txt"/>
                                <Upload size={48} className="text-neutral-600 group-hover:text-red-500 mb-4 transition-colors"/>
                                <h3 className="text-xl font-bold text-white mb-2">Drop .EML File Here</h3>
                                <p className="text-[#888] text-sm font-mono">Analyzes headers, body structure, and attachments client-side.</p>
                            </div>
                        )}
                        {activeTab === 'PASTE' && (
                            <div className="flex flex-col gap-4">
                                <textarea 
                                    className="w-full h-96 bg-black/50 border border-[#333] rounded-lg p-4 font-mono text-xs text-neutral-300 focus:border-red-500 focus:outline-none resize-none custom-scrollbar"
                                    placeholder="Paste raw email source here..."
                                    value={rawInput}
                                    onChange={(e) => setRawInput(e.target.value)}
                                />
                                <button 
                                    onClick={() => handleAnalysis(rawInput)}
                                    disabled={!rawInput || isLoading}
                                    className="bg-[#1C1C1C] hover:bg-[#151515] text-white py-3 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isLoading ? <RefreshCw className="animate-spin" size={16}/> : <Search size={16}/>} ANALYZE HEADERS
                                </button>
                            </div>
                        )}
                        {error && <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 text-red-300 text-xs rounded flex items-center gap-2"><AlertCircle size={14}/> {error}</div>}
                    </div>
                ) : (
                    /* RESULTS VIEW */
                    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
                        
                        {/* DASHBOARD MODE */}
                        {viewMode === 'DASHBOARD' && (
                            <>
                                {/* Top Stats Row */}
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className={`p-4 rounded-lg border flex flex-col items-center justify-center text-center ${getRiskColor(result.riskScore)}`}>
                                        <div className="text-[10px] font-bold uppercase opacity-70">Suspicion Score</div>
                                        <div className="text-4xl font-cyber font-bold mt-1">{result.riskScore}</div>
                                    </div>
                                    <div className="p-4 rounded-lg border bg-[#111] border-[#222]">
                                        <div className="text-[10px] text-[#888] font-bold uppercase mb-1">Authentication</div>
                                        <div className="flex gap-2 mt-2">
                                            {['SPF', 'DKIM', 'DMARC'].map(type => {
                                                const status = result.auth[type.toLowerCase() as keyof typeof result.auth]?.status || 'NONE';
                                                return (
                                                    <div key={type} className={`px-2 py-1 rounded text-[10px] font-bold border ${status === 'PASS' ? 'text-white border-neutral-500/30 bg-neutral-900/20' : status === 'FAIL' ? 'text-red-400 border-red-500/30 bg-red-900/20' : 'text-[#AAA] border-[#333] bg-[#151515]'}`}>
                                                        {type}: {status}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-lg border bg-[#111] border-[#222]">
                                        <div className="text-[10px] text-[#888] font-bold uppercase mb-1">Origin Info</div>
                                        <div className="text-xs text-white font-mono truncate" title={result.returnPath}>{result.returnPath}</div>
                                        <div className="text-[10px] text-red-400 mt-1">{result.client.originatingIp || 'IP Hidden'}</div>
                                    </div>
                                    <div className="p-4 rounded-lg border bg-[#111] border-[#222]">
                                        <div className="text-[10px] text-[#888] font-bold uppercase mb-1">Artifacts</div>
                                        <div className="flex gap-4 text-lg font-mono font-bold text-white mt-1">
                                            <span className="flex items-center gap-1"><Globe size={14} className="text-red-400"/> {result.iocs.length}</span>
                                            <span className="flex items-center gap-1"><FileDigit size={14} className="text-white"/> {result.attachments.length}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    {/* Metadata Card */}
                                    <div className="lg:col-span-2 bg-black/40 border border-[#222] rounded-lg p-5 min-w-0">
                                        <h3 className="text-sm font-bold text-white uppercase mb-4 flex items-center gap-2"><Mail size={16} className="text-red-400"/> Header Summary</h3>
                                        <div className="space-y-3 text-xs font-mono text-neutral-300">
                                            <div className="grid grid-cols-[80px_1fr] gap-2 border-b border-[#222] pb-2">
                                                <span className="text-[#888]">Subject:</span>
                                                <span className="text-white font-bold break-words">{result.subject}</span>
                                            </div>
                                            <div className="grid grid-cols-[80px_1fr] gap-2 border-b border-[#222] pb-2">
                                                <span className="text-[#888]">From:</span>
                                                <span className="text-red-500 break-all">{result.from}</span>
                                            </div>
                                            <div className="grid grid-cols-[80px_1fr] gap-2 border-b border-[#222] pb-2">
                                                <span className="text-[#888]">To:</span>
                                                <span className="break-all">{result.to}</span>
                                            </div>
                                            <div className="grid grid-cols-[80px_1fr] gap-2 border-b border-[#222] pb-2">
                                                <span className="text-[#888]">Date:</span>
                                                <span className="break-words">{result.date}</span>
                                            </div>
                                            <div className="grid grid-cols-[80px_1fr] gap-2">
                                                <span className="text-[#888]">Mailer:</span>
                                                <span className="break-words">{result.client.mailer}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Risk Factors */}
                                    <div className="bg-black/40 border border-[#222] rounded-lg p-5">
                                        <h3 className="text-sm font-bold text-white uppercase mb-4 flex items-center gap-2"><AlertTriangle size={16} className="text-white"/> Risk Indicators</h3>
                                        {result.riskFactors.length > 0 ? (
                                            <ul className="space-y-2">
                                                {result.riskFactors.map((f, i) => (
                                                    <li key={i} className="text-xs text-red-300 bg-red-900/10 p-2 rounded border border-red-500/20 flex items-start gap-2">
                                                        <Zap size={12} className="mt-0.5 shrink-0"/> {f}
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <div className="text-center text-[#888] text-xs italic py-8">No specific risk factors identified.</div>
                                        )}
                                    </div>
                                </div>

                                {/* Visual Hop Timeline */}
                                <div className="bg-black/40 border border-[#222] rounded-lg p-6">
                                    <h3 className="text-sm font-bold text-white uppercase mb-6 flex items-center gap-2"><Network size={16} className="text-red-400"/> Route Visualization</h3>
                                    <div className="space-y-1">
                                        {result.hops.map((hop, i) => {
                                            const delayPercent = Math.min(100, (hop.delaySeconds / 60) * 100); // 60s = 100% width
                                            return (
                                                <div key={i} className="relative pl-4 border-l border-[#333] pb-6 last:pb-0 group">
                                                    <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 bg-[#0A0A0A] border border-neutral-500 rounded-full group-hover:border-red-500 transition-colors"></div>
                                                    <div className="flex justify-between items-start text-xs mb-1 pl-2">
                                                        <div className="font-mono text-white">
                                                            <span className="text-[#888] mr-2">Hop {result.hops.length - i}</span>
                                                            {hop.from}
                                                        </div>
                                                        <div className="text-[#888] font-mono">{new Date(hop.timestamp).toLocaleTimeString()}</div>
                                                    </div>
                                                    <div className="pl-2 text-[10px] text-[#AAA] font-mono flex gap-4">
                                                        <span className="text-red-400">{hop.ip || 'IP Hidden'}</span>
                                                        <span className="truncate max-w-md opacity-70">By: {hop.by}</span>
                                                    </div>
                                                    {/* Visual Delay Bar */}
                                                    {i > 0 && hop.delaySeconds > 0 && (
                                                        <div className="ml-2 mt-2 h-1 bg-[#151515] rounded overflow-hidden w-64" title={`${hop.delaySeconds.toFixed(1)}s Delay`}>
                                                            <div className={`h-full ${hop.delaySeconds > 10 ? 'bg-neutral-500' : 'bg-neutral-500'}`} style={{width: `${Math.max(5, delayPercent)}%`}}></div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ARTIFACTS MODE */}
                        {viewMode === 'ARTIFACTS' && (
                            <div className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-bold text-white">Extracted Indicators</h3>
                                    <button onClick={exportIocs} className="text-xs flex items-center gap-2 bg-[#151515] px-3 py-1.5 rounded hover:bg-[#1C1C1C] transition-colors"><Download size={14}/> Export CSV</button>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div className="bg-black/40 border border-[#222] rounded-lg p-5">
                                        <h4 className="text-xs font-bold text-red-400 uppercase mb-3 flex items-center gap-2"><Globe size={14}/> Network IOCs</h4>
                                        <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                                            {result.iocs.map((ioc, i) => (
                                                <div key={i} className="bg-[#111] p-2 rounded border border-[#222] text-xs">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-white font-mono break-all">{ioc.value}</span>
                                                        <div className="flex gap-2 items-center shrink-0">
                                                            <span className="text-[9px] text-[#888] uppercase bg-black px-1.5 rounded">{ioc.type}</span>
                                                            <button 
                                                                onClick={() => enrichIndicator(ioc.value, ioc.type)}
                                                                className="p-1 hover:bg-[#1C1C1C] rounded text-[#AAA] hover:text-white"
                                                                title="Enrich Indicator"
                                                            >
                                                                {enrichedIocs[ioc.value]?.loading ? <RefreshCw className="animate-spin" size={12}/> : <Search size={12}/>}
                                                            </button>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Enrichment Results Block */}
                                                    {enrichedIocs[ioc.value] && !enrichedIocs[ioc.value].loading && !enrichedIocs[ioc.value].error && (
                                                        <div className="w-full mt-2 pt-2 border-t border-[#222] text-[10px] text-[#AAA] font-mono grid grid-cols-2 gap-2">
                                                            {enrichedIocs[ioc.value].dataType === 'IP_DATA' ? (
                                                                <>
                                                                    <div><span className="text-neutral-600">Loc:</span> {enrichedIocs[ioc.value].country}</div>
                                                                    <div><span className="text-neutral-600">ASN:</span> {enrichedIocs[ioc.value].asn}</div>
                                                                    <div className="col-span-2">
                                                                        <span className="text-neutral-600">RBL:</span> 
                                                                        <span className={enrichedIocs[ioc.value].rbl === 'LISTED' ? 'text-red-400 font-bold ml-1' : 'text-white ml-1'}>
                                                                            {enrichedIocs[ioc.value].rbl}
                                                                        </span>
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <div><span className="text-neutral-600">Scanned:</span> {enrichedIocs[ioc.value].providers} Sources</div>
                                                                    <div>
                                                                        <span className="text-neutral-600">Verdict:</span> 
                                                                        <span className={enrichedIocs[ioc.value].malicious ? 'text-red-400 font-bold ml-1' : 'text-white ml-1'}>
                                                                            {enrichedIocs[ioc.value].malicious ? 'MALICIOUS' : 'CLEAN'}
                                                                        </span>
                                                                    </div>
                                                                    {enrichedIocs[ioc.value].details && (
                                                                        <div className="col-span-2 text-red-400 truncate" title={enrichedIocs[ioc.value].details}>
                                                                            Flagged by: {enrichedIocs[ioc.value].details}
                                                                        </div>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                    
                                                    {enrichedIocs[ioc.value]?.error && (
                                                        <div className="w-full mt-2 pt-2 border-t border-[#222] text-[10px] text-red-400 italic">
                                                            Enrichment failed.
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                            {result.iocs.length === 0 && <div className="text-[#888] italic text-xs">No IOCs found.</div>}
                                        </div>
                                    </div>

                                    <div className="bg-black/40 border border-[#222] rounded-lg p-5">
                                        <h4 className="text-xs font-bold text-white uppercase mb-3 flex items-center gap-2"><FileWarning size={14}/> Attachments</h4>
                                        <div className="space-y-2">
                                            {result.attachments.map((att: any, i: number) => (
                                                <div key={i} className="bg-[#111] p-3 rounded border border-[#222] text-xs font-mono group">
                                                    <div className="flex justify-between mb-1">
                                                        <span className="text-white font-bold">{att.filename}</span>
                                                        <span className="text-[#888]">{att.size}</span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2 text-[10px] text-[#AAA] mb-2">
                                                        <div>Type: {att.magic}</div>
                                                        <div>Entropy: {att.entropy?.toFixed(2)}</div>
                                                    </div>
                                                    <div className="bg-black p-1.5 rounded border border-[#333] text-[9px] break-all text-[#888] flex justify-between items-center">
                                                        <span>SHA256: {att.hash}</span>
                                                        <button onClick={() => navigator.clipboard.writeText(att.hash)} className="hover:text-white"><Copy size={10}/></button>
                                                    </div>
                                                </div>
                                            ))}
                                            {result.attachments.length === 0 && <div className="text-[#888] italic text-xs">No attachments found.</div>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* HEADERS MODE */}
                        {viewMode === 'HEADERS' && (
                            <div className="bg-black border border-[#222] rounded-lg p-4 overflow-auto h-[600px] font-mono text-xs text-[#AAA] custom-scrollbar">
                                <pre className="whitespace-pre-wrap">{result.rawHeaders}</pre>
                            </div>
                        )}

                        {/* BODY MODE */}
                        {viewMode === 'BODY' && (
                            <div className="bg-black/40 border border-[#222] rounded-lg p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-sm font-bold text-white uppercase">Decoded Content Preview</h3>
                                    <span className="text-xs text-red-400 bg-red-900/20 px-2 py-1 rounded border border-red-500/30">DEFANGED VIEW</span>
                                </div>
                                <div className="bg-white text-black p-4 rounded h-[600px] overflow-auto font-mono text-xs whitespace-pre-wrap">
                                    {result.bodyPreview || "No body content extracted."}
                                </div>
                            </div>
                        )}

                    </div>
                )}
            </div>

            {/* AI Chat Modal */}
            {showAiModal && (
                <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
                    <div className="bg-[#0A0A0A] border border-[#333] rounded-xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="p-4 border-b border-[#222] flex justify-between items-center bg-black/40">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2 font-cyber">
                                <Sparkles className="text-red-400" size={18}/> XYBER AI FORENSIC ASSISTANT
                            </h3>
                            <button onClick={() => setShowAiModal(false)} className="text-[#888] hover:text-white"><X size={20}/></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-black/20 space-y-6">
                            {isAiLoading && messages.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-48 gap-4 text-[#888]">
                                    <Sparkles className="animate-spin text-red-500" size={48}/>
                                    <p className="font-mono text-sm animate-pulse">Analyzing email artifacts...</p>
                                </div>
                            )}
                            
                            {messages.map((msg) => (
                                <div 
                                    key={msg.id} 
                                    className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    {msg.role === 'model' && (
                                        <div className="w-8 h-8 rounded-full bg-neutral-900/20 border border-neutral-500/30 flex items-center justify-center shrink-0 mt-1">
                                            <Bot size={16} className="text-red-400"/>
                                        </div>
                                    )}
                                    
                                    <div className={`max-w-[85%] md:max-w-[75%] rounded-lg p-4 text-sm leading-relaxed shadow-lg ${
                                        msg.role === 'user' 
                                            ? 'bg-red-500/10 border border-red-500/30 text-red-500 rounded-tr-none' 
                                            : 'bg-[#111] border border-[#222] text-neutral-300 rounded-tl-none font-mono'
                                    }`}>
                                        {msg.role === 'user' ? (
                                            <div className="whitespace-pre-wrap">{msg.text}</div>
                                        ) : (
                                            <div>{formatMessage(msg.text)}</div>
                                        )}
                                        <div className={`text-[9px] mt-2 opacity-50 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                                            {msg.timestamp.toLocaleTimeString()}
                                        </div>
                                    </div>

                                    {msg.role === 'user' && (
                                        <div className="w-8 h-8 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0 mt-1">
                                            <User size={16} className="text-red-500"/>
                                        </div>
                                    )}
                                </div>
                            ))}
                            
                            {/* Streaming/Loading Indicator for Chat */}
                            {isAiLoading && messages.length > 0 && (
                                 <div className="flex gap-4 justify-start">
                                    <div className="w-8 h-8 rounded-full bg-neutral-900/20 border border-neutral-500/30 flex items-center justify-center shrink-0 mt-1 animate-pulse">
                                        <Bot size={16} className="text-red-400"/>
                                    </div>
                                    <div className="p-4 rounded-lg rounded-tl-none bg-[#111] border border-[#222] text-red-400 text-xs font-mono">
                                        <Loader2 size={14} className="animate-spin inline mr-2"/> Thinking...
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="bg-black/40 border-t border-[#222] p-4">
                            <div className="relative">
                                <textarea
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendMessage();
                                        }
                                    }}
                                    placeholder="Ask further questions about this email..."
                                    className="w-full bg-[#111] border border-[#333] rounded-xl pl-4 pr-14 py-3 text-sm text-neutral-200 focus:outline-none focus:border-neutral-500 focus:ring-1 focus:ring-purple-500/50 transition-all resize-none h-14 custom-scrollbar font-mono shadow-inner"
                                />
                                <button 
                                    onClick={handleSendMessage} 
                                    disabled={isAiLoading || !chatInput.trim()}
                                    className={`absolute right-2 top-2 bottom-2 aspect-square flex items-center justify-center rounded-lg transition-all ${
                                        chatInput.trim() && !isAiLoading 
                                            ? 'bg-neutral-600 hover:bg-neutral-500 text-white shadow-lg shadow-purple-900/20' 
                                            : 'bg-[#151515] text-[#888] cursor-not-allowed'
                                    }`}
                                >
                                    {isAiLoading ? <Loader2 className="animate-spin" size={18}/> : <Send size={18}/>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};