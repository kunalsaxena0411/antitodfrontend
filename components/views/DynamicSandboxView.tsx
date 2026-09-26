

import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileCode, Activity, Server, AlertTriangle, Shield, CheckCircle, Clock, File as FileIcon, Search, Box, Zap, Cpu, Network, Lock, Layers, ShieldAlert, Hash, Bot, Sparkles, X, Send, User, Loader2, Terminal, Image, Info, Globe, Siren } from 'lucide-react';
import { OtxSandboxReport } from '../../types';
import { submitFileToSandbox, getSandboxAnalysis, calculateFileHash } from '../../services/otxSandbox';
import { Chat } from "@google/genai";
import { formatSandboxContext, createThreatChat } from '../../services/aiConverter';

interface Message {
    id: string;
    role: 'user' | 'model';
    text: string;
    timestamp: Date;
}

export const DynamicSandboxView: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [analysisStatus, setAnalysisStatus] = useState<'IDLE' | 'CALCULATING_HASH' | 'CHECKING_CACHE' | 'UPLOADING' | 'ANALYZING' | 'READY' | 'ERROR'>('IDLE');
    const [report, setReport] = useState<OtxSandboxReport | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [hash, setHash] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Tab State
    const [activeTab, setActiveTab] = useState<'SUMMARY' | 'THREATS' | 'STATIC' | 'NETWORK' | 'METADATA'>('SUMMARY');

    // AI Chat State
    const [showAiModal, setShowAiModal] = useState(false);
    const [chatSession, setChatSession] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
            setAnalysisStatus('IDLE');
            setReport(null);
            setHash(null);
            setActiveTab('SUMMARY');
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        
        setError(null);

        try {
            // 1. Calculate Hash
            setAnalysisStatus('CALCULATING_HASH');
            const fileHash = await calculateFileHash(file);
            setHash(fileHash);

            // 2. Check if analysis already exists
            setAnalysisStatus('CHECKING_CACHE');
            const existingReport = await getSandboxAnalysis(fileHash);
            
            if (existingReport && existingReport.analysis && existingReport.analysis.info) {
                setReport(existingReport);
                setAnalysisStatus('READY');
                return;
            }

            // 3. If not found, Upload
            setIsUploading(true);
            setAnalysisStatus('UPLOADING');
            
            // Re-use the already calculated hash to verify response later, but upload the file
            const submission = await submitFileToSandbox(file);
            
            if (submission.sha256 !== fileHash) {
                console.warn("Returned hash differs from local calculation", submission.sha256, fileHash);
                setHash(submission.sha256);
            }

            setAnalysisStatus('ANALYZING');
            pollAnalysis(submission.sha256);

        } catch (e: any) {
            setError(e.message || "Operation failed");
            setAnalysisStatus('ERROR');
            setIsUploading(false);
        }
    };

    const pollAnalysis = async (sha256: string) => {
        let attempts = 0;
        const maxAttempts = 40; // Increased to ~200 seconds for fresh analysis

        const check = async () => {
            try {
                const result = await getSandboxAnalysis(sha256);
                if (result && result.analysis && result.analysis.info) {
                    setReport(result);
                    setAnalysisStatus('READY');
                    setIsUploading(false);
                } else {
                    if (attempts < maxAttempts) {
                        attempts++;
                        setRetryCount(attempts);
                        setTimeout(check, 5000); // Poll every 5s
                    } else {
                        setError("Analysis timed out. The sample is queued but processing is delayed.");
                        setAnalysisStatus('ERROR');
                        setIsUploading(false);
                    }
                }
            } catch (e) {
                // If error, keep polling a few times before giving up
                if (attempts < maxAttempts) {
                    attempts++;
                    setRetryCount(attempts);
                    setTimeout(check, 5000);
                } else {
                    setError("Failed to retrieve analysis.");
                    setAnalysisStatus('ERROR');
                    setIsUploading(false);
                }
            }
        };

        check();
    };

    // AI Functions
    const handleAiAnalysis = async () => {
        if (!report) return;
        setShowAiModal(true);
        setIsAiLoading(true);
        setMessages([]);

        try {
            const contextStr = formatSandboxContext(report);
            const chat = createThreatChat(contextStr);
            if (chat) {
                setChatSession(chat);
                // Trigger initial analysis
                const resultStream = await chat.sendMessageStream({ message: "Analyze this malware report." });
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

    const formatMessage = (text: string) => {
        // Reuse markdown formatter
        const parts = text.split(/(```[\s\S]*?```|`[^`]+`|\*\*[^*]+\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('```')) {
                 const content = part.replace(/^```\w*\n?|```$/g, '');
                 return (
                     <div key={i} className="bg-black/50 border border-[#333] rounded p-3 my-2 font-mono text-xs text-white overflow-x-auto whitespace-pre scrollbar-thin">
                         {content}
                     </div>
                 );
            } else if (part.startsWith('`')) {
                return <span key={i} className="bg-black/50 border border-[#333] px-1.5 py-0.5 rounded font-mono text-xs text-white mx-1">{part.replace(/`/g, '')}</span>;
            } else if (part.startsWith('**')) {
                return <strong key={i} className="text-white">{part.replace(/\*\*/g, '')}</strong>;
            }
            return <span key={i} className="whitespace-pre-wrap">{part}</span>;
        });
    };


    // Render Helpers
    const renderVerdict = () => {
        if (!report) return null;
        
        const suricataAlerts = report.analysis.plugins.suricata?.results.alerts || [];
        const yaraMatches = report.analysis.plugins.yarad?.results.detection || [];
        const clamAv = report.analysis.plugins.clamav?.results.detection;
        const msDefender = report.analysis.plugins.msdefender?.results.detection;

        const score = (suricataAlerts.length * 10) + (yaraMatches.length * 20) + (clamAv ? 40 : 0) + (msDefender ? 40 : 0);
        const verdict = score > 0 ? (score > 50 ? 'MALICIOUS' : 'SUSPICIOUS') : 'CLEAN';
        const color = verdict === 'MALICIOUS' ? 'text-red-500' : verdict === 'SUSPICIOUS' ? 'text-white' : 'text-white';
        const border = verdict === 'MALICIOUS' ? 'border-red-500/50' : verdict === 'SUSPICIOUS' ? 'border-neutral-500/50' : 'border-neutral-500/50';

        return (
            <div className={`bg-black/40 border ${border} rounded-lg p-6 flex flex-col items-center justify-center text-center h-full`}>
                <div className="text-xs font-bold text-[#888] uppercase tracking-widest mb-2">Automated Verdict</div>
                <div className={`text-4xl font-cyber font-bold ${color} mb-2`}>{verdict}</div>
                <div className="text-xs text-[#AAA] font-mono">Threat Score: {Math.min(100, score)}/100</div>
                <div className="mt-4 flex gap-2 flex-wrap justify-center">
                    {clamAv && <span className="text-[10px] bg-red-900/40 text-red-300 px-2 py-1 rounded border border-red-500/30">CLAMAV: {clamAv}</span>}
                    {msDefender && <span className="text-[10px] bg-[#111] text-white px-2 py-1 rounded border border-neutral-500/30">DEFENDER: {msDefender}</span>}
                    {yaraMatches.length > 0 && <span className="text-[10px] bg-neutral-900/40 text-white px-2 py-1 rounded border border-neutral-500/30">{yaraMatches.length} YARA RULES</span>}
                </div>
            </div>
        );
    };

    const renderSummary = () => (
        <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* File Info */}
                <div className="bg-black/40 border border-[#222] rounded-lg p-6">
                    <h3 className="text-sm font-bold text-red-400 uppercase mb-4 flex items-center gap-2"><FileCode size={16}/> File Metadata</h3>
                    <div className="space-y-2 text-xs font-mono text-neutral-300">
                        <div className="flex justify-between border-b border-[#222] pb-1">
                            <span className="text-[#888]">SHA256</span>
                            <span className="break-all select-all text-white" title={report!.analysis.info.results.sha256}>{report!.analysis.info.results.sha256}</span>
                        </div>
                        <div className="flex justify-between border-b border-[#222] pb-1">
                            <span className="text-[#888]">MD5</span>
                            <span className="break-all select-all" title={report!.analysis.info.results.md5}>{report!.analysis.info.results.md5}</span>
                        </div>
                        <div className="flex justify-between border-b border-[#222] pb-1">
                            <span className="text-[#888]">Type</span>
                            <span>{report!.analysis.info.results.file_type}</span>
                        </div>
                        <div className="flex justify-between border-b border-[#222] pb-1">
                            <span className="text-[#888]">Size</span>
                            <span>{report?.analysis?.info?.results?.filesize ? report.analysis.info.results.filesize.toLocaleString() : 'Unknown'} bytes</span>
                        </div>
                    </div>
                </div>

                {/* Verdict */}
                <div>{renderVerdict()}</div>

                {/* Analysis Overview Stats */}
                <div className="bg-black/40 border border-[#222] rounded-lg p-6">
                     <h3 className="text-sm font-bold text-red-400 uppercase mb-4 flex items-center gap-2"><Activity size={16}/> Analysis Overview</h3>
                     <div className="space-y-3 text-xs text-neutral-300">
                        <div className="flex justify-between items-center p-2 rounded bg-[#111] border border-[#222]">
                            <span>PE Sections</span>
                            <span className="font-bold font-mono">{report!.analysis.plugins.pe32info?.results.sections.length || 0}</span>
                        </div>
                        <div className="flex justify-between items-center p-2 rounded bg-[#111] border border-[#222]">
                            <span>Imported DLLs</span>
                            <span className="font-bold font-mono">{report!.analysis.plugins.pe32info?.results.imports.length || 0}</span>
                        </div>
                        <div className="flex justify-between items-center p-2 rounded bg-[#111] border border-[#222]">
                            <span>IDS Alerts</span>
                            <span className="font-bold font-mono text-white">{report!.analysis.plugins.suricata?.results.alerts.length || 0}</span>
                        </div>
                        <div className="flex justify-between items-center p-2 rounded bg-[#111] border border-[#222]">
                            <span>PE Anomalies</span>
                            <span className="font-bold font-mono text-red-400">{report!.analysis.plugins.peanomal?.results.anomalies || 0}</span>
                        </div>
                     </div>
                </div>
            </div>
        </div>
    );

    const renderThreats = () => (
        <div className="space-y-6 animate-fade-in">
             {/* YARA */}
             <div className="bg-black/40 border border-[#222] rounded-lg p-6">
                 <h3 className="text-sm font-bold text-red-400 uppercase mb-4 flex items-center gap-2"><ShieldAlert size={16}/> YARA Detections</h3>
                 {report!.analysis.plugins.yarad?.results.detection.length ? (
                     <div className="grid grid-cols-1 gap-3">
                         {report!.analysis.plugins.yarad!.results.detection.map((y, i) => (
                             <div key={i} className="bg-red-900/10 border border-red-500/20 p-3 rounded text-xs">
                                 <div className="font-bold text-red-300 mb-1">{y.rule_name}</div>
                                 {y.description && <div className="text-[#888] text-[10px] mb-2">{y.description}</div>}
                                 {y.strings && (
                                     <div className="bg-black/50 p-2 rounded font-mono text-[10px] text-[#AAA] break-all border border-red-500/10">
                                         {y.strings.map((s, idx) => (
                                             <span key={idx} className="block">{JSON.stringify(s)}</span>
                                         ))}
                                     </div>
                                 )}
                             </div>
                         ))}
                     </div>
                 ) : <div className="text-[#888] italic text-xs">No YARA rules matched.</div>}
             </div>

             {/* Suricata / IDS */}
             <div className="bg-black/40 border border-[#222] rounded-lg p-6">
                 <h3 className="text-sm font-bold text-white uppercase mb-4 flex items-center gap-2"><Siren size={16}/> IDS Detections (Suricata)</h3>
                 {report!.analysis.plugins.suricata?.results.alerts.length ? (
                     <div className="space-y-2">
                         {report!.analysis.plugins.suricata!.results.alerts.map((s, i) => (
                             <div key={i} className="bg-neutral-900/10 border border-neutral-500/20 p-3 rounded text-xs flex justify-between items-center">
                                 <span className="text-white font-mono">{s.signature}</span>
                                 <div className="flex gap-2">
                                     <span className="bg-black/40 px-2 py-1 rounded text-[10px] text-[#AAA]">{s.category}</span>
                                     <span className="bg-red-900/30 text-red-400 px-2 py-1 rounded text-[10px] font-bold">Sev: {s.severity}</span>
                                 </div>
                             </div>
                         ))}
                     </div>
                 ) : <div className="text-[#888] italic text-xs">No IDS alerts generated.</div>}
             </div>
        </div>
    );

    const renderStatic = () => (
        <div className="space-y-6 animate-fade-in">
             {/* DISA Entrypoint */}
             {report!.analysis.plugins.disa_entrypoint?.results.instructions && (
                <div className="bg-black/40 border border-[#222] rounded-lg p-6">
                    <h3 className="text-sm font-bold text-white uppercase mb-4 flex items-center gap-2"><Terminal size={16}/> DISA Entrypoint Disassembly</h3>
                    <div className="bg-black p-4 rounded border border-[#333] font-mono text-xs text-white space-y-1">
                        {report!.analysis.plugins.disa_entrypoint!.results.instructions.map((inst, i) => (
                            <div key={i} className="flex gap-4">
                                <span className="text-neutral-600 select-none">{String(i).padStart(2, '0')}</span>
                                <span>{inst}</span>
                            </div>
                        ))}
                    </div>
                </div>
             )}

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 {/* PE Sections */}
                 <div className="bg-black/40 border border-[#222] rounded-lg p-6">
                     <h3 className="text-sm font-bold text-red-400 uppercase mb-4 flex items-center gap-2"><Layers size={16}/> PE Sections</h3>
                     <div className="overflow-x-auto">
                         <table className="w-full text-left text-xs font-mono text-neutral-300">
                             <thead className="text-[#888] border-b border-[#333]">
                                 <tr><th className="pb-2">Name</th><th className="pb-2">Size</th><th className="pb-2">Entropy</th></tr>
                             </thead>
                             <tbody className="divide-y divide-neutral-800">
                                {report!.analysis.plugins.pe32info?.results.sections.map((sec, i) => (
                                    <tr key={i}>
                                        <td className="py-2 text-white">{sec.Name}</td>
                                        <td className="py-2">{sec.SizeOfRawData}</td>
                                        <td className="py-2">
                                            <span className={`px-1.5 py-0.5 rounded ${Number(sec.entropy) > 7 ? 'bg-red-900/30 text-red-400' : 'text-white'}`}>
                                                {Number(sec.entropy).toFixed(3)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                             </tbody>
                         </table>
                     </div>
                 </div>

                 {/* PE Version Info & Anomalies */}
                 <div className="space-y-6">
                     <div className="bg-black/40 border border-[#222] rounded-lg p-6">
                         <h3 className="text-sm font-bold text-red-400 uppercase mb-4 flex items-center gap-2"><Info size={16}/> Version Information</h3>
                         <div className="space-y-2 text-xs font-mono text-neutral-300">
                            {report!.analysis.plugins.pe32info?.results.version_information?.map((v, i) => (
                                <div key={i} className="flex justify-between border-b border-[#222] pb-1 last:border-0">
                                    <span className="text-[#888]">{v.name}</span>
                                    <span className="text-white text-right truncate max-w-[200px]">{v.value}</span>
                                </div>
                            ))}
                            {!report!.analysis.plugins.pe32info?.results.version_information?.length && <span className="text-[#888] italic">No version info.</span>}
                         </div>
                     </div>

                     {report!.analysis.plugins.peanomal && (
                         <div className="bg-black/40 border border-[#222] rounded-lg p-6">
                             <h3 className="text-sm font-bold text-white uppercase mb-4 flex items-center gap-2"><AlertTriangle size={16}/> PE Anomalies</h3>
                             <div className="space-y-2 text-xs font-mono">
                                 {report!.analysis.plugins.peanomal!.results.detection.map((d, i) => (
                                     <div key={i} className="bg-neutral-900/10 border border-neutral-500/20 p-2 rounded text-white">
                                         {d.name}
                                     </div>
                                 ))}
                                 {!report!.analysis.plugins.peanomal!.results.detection.length && <span className="text-white">No anomalies detected.</span>}
                             </div>
                         </div>
                     )}
                 </div>
             </div>

             {/* PE Imports */}
             <div className="bg-black/40 border border-[#222] rounded-lg p-6">
                 <h3 className="text-sm font-bold text-neutral-300 uppercase mb-4 flex items-center gap-2"><Box size={16}/> PE Imports</h3>
                 <div className="max-h-64 overflow-y-auto custom-scrollbar grid grid-cols-2 md:grid-cols-3 gap-2">
                     {report!.analysis.plugins.pe32info?.results.imports.map((imp, i) => (
                         <div key={i} className="bg-[#111] p-2 rounded border border-[#222] text-[10px] font-mono text-[#AAA] truncate" title={`${imp.dll} - ${imp.name}`}>
                             <span className="text-red-400 font-bold">{imp.dll}</span> :: {imp.name}
                         </div>
                     ))}
                 </div>
             </div>
        </div>
    );

    const renderNetwork = () => {
        const network = report!.analysis.plugins.cuckoo?.result?.network;
        if (!network) return <div className="text-[#888] text-center p-10">No network activity recorded.</div>;
        
        return (
            <div className="space-y-6 animate-fade-in">
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                     <div className="bg-black/40 border border-[#222] rounded-lg p-6">
                         <h3 className="text-sm font-bold text-red-400 uppercase mb-4 flex items-center gap-2"><Globe size={16}/> DNS Queries</h3>
                         <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar">
                             {network.dns?.map((d, i) => (
                                 <div key={i} className="bg-[#111] p-2 rounded border border-[#222] text-xs font-mono text-neutral-300 flex justify-between">
                                     <span className="text-white">{d.request}</span>
                                     <span className="text-[#888]">{d.type}</span>
                                 </div>
                             )) || <div className="text-[#888] text-xs italic">None</div>}
                         </div>
                     </div>

                     <div className="bg-black/40 border border-[#222] rounded-lg p-6">
                         <h3 className="text-sm font-bold text-white uppercase mb-4 flex items-center gap-2"><Network size={16}/> HTTP Requests</h3>
                         <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar">
                             {network.http?.map((h, i) => (
                                 <div key={i} className="bg-[#111] p-2 rounded border border-[#222] text-xs font-mono text-neutral-300 break-all">
                                     <span className="text-red-400 mr-2 font-bold">{h.method}</span>
                                     <span className="text-[#AAA]">http://{h.host}</span>{h.uri}
                                 </div>
                             )) || <div className="text-[#888] text-xs italic">None</div>}
                         </div>
                     </div>
                 </div>
            </div>
        );
    };

    const renderMetadata = () => (
        <div className="space-y-6 animate-fade-in">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 {/* EXIF Data */}
                 <div className="bg-black/40 border border-[#222] rounded-lg p-6">
                     <h3 className="text-sm font-bold text-red-400 uppercase mb-4 flex items-center gap-2"><Image size={16}/> EXIF Metadata</h3>
                     <div className="space-y-1 max-h-80 overflow-y-auto custom-scrollbar text-xs font-mono text-neutral-300">
                        {report!.analysis.plugins.exiftool?.results ? (
                            Object.entries(report!.analysis.plugins.exiftool!.results).map(([k, v], i) => (
                                <div key={i} className="flex justify-between border-b border-[#222] pb-1">
                                    <span className="text-[#888] truncate pr-4" title={k}>{k}</span>
                                    <span className="text-white text-right truncate pl-4" title={String(v)}>{String(v)}</span>
                                </div>
                            ))
                        ) : <div className="text-[#888] italic">No EXIF data.</div>}
                     </div>
                 </div>

                 {/* Resource Strings */}
                 <div className="bg-black/40 border border-[#222] rounded-lg p-6">
                     <h3 className="text-sm font-bold text-neutral-300 uppercase mb-4 flex items-center gap-2"><FileCode size={16}/> Resource Strings</h3>
                     <div className="max-h-80 overflow-y-auto custom-scrollbar bg-black p-2 rounded border border-[#222] text-[10px] font-mono text-[#AAA] space-y-1">
                        {report!.analysis.plugins.pe32info?.results.resource_strings?.map((s, i) => (
                            <div key={i} className="break-all border-b border-neutral-900 pb-1">{s}</div>
                        )) || <div className="text-[#888] italic">No resource strings found.</div>}
                     </div>
                 </div>
             </div>

             {/* Interesting Strings */}
             <div className="bg-black/40 border border-[#222] rounded-lg p-6">
                 <h3 className="text-sm font-bold text-white uppercase mb-4 flex items-center gap-2"><Terminal size={16}/> Interesting Strings</h3>
                 <div className="max-h-64 overflow-y-auto custom-scrollbar bg-black p-4 rounded border border-[#222] text-[10px] font-mono text-white/80 columns-1 md:columns-2 lg:columns-3 gap-4">
                    {report!.analysis.plugins.strings?.results?.slice(0, 300).map((s, i) => (
                        <div key={i} className="break-all mb-1">{s}</div>
                    )) || <div className="text-[#888] italic">No strings extracted.</div>}
                 </div>
             </div>
        </div>
    );

    return (
        <div className="h-[calc(100vh-70px)] bg-cyber-grid flex flex-col overflow-hidden relative">
            {/* Header */}
            <div className="p-6 border-b border-[#222] bg-black/40 shrink-0 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-neutral-900/20 rounded-lg border border-neutral-500/30 text-red-400">
                        <Box size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white font-cyber flex items-center gap-2">
                            DYNAMIC <span className="text-red-400">SANDBOX</span>
                        </h2>
                        <p className="text-sm text-[#888] font-mono">AlienVault OTX Integration</p>
                    </div>
                </div>
                
                {report && (
                     <button 
                        onClick={handleAiAnalysis}
                        className="px-4 py-2 bg-neutral-600 hover:bg-neutral-500 text-white rounded text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-900/20 transition-colors"
                    >
                        <Sparkles size={14}/> Ask Xyber AI
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                {analysisStatus === 'IDLE' && (
                    <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-[#222] rounded-xl bg-black/20 relative group h-full min-h-[400px]">
                        <input 
                            type="file" 
                            className="absolute inset-0 opacity-0 cursor-pointer" 
                            onChange={handleFileSelect}
                            ref={fileInputRef}
                        />
                        <div className="text-center p-10 transition-all group-hover:scale-105">
                            <div className="w-20 h-20 bg-neutral-900/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-neutral-500/30 group-hover:bg-neutral-900/40">
                                <Upload size={32} className="text-red-400"/>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">{file ? file.name : "Drop File to Detonate"}</h3>
                            <p className="text-[#888] text-sm font-mono mb-6">
                                {file ? `${(file.size / 1024).toFixed(2)} KB selected` : "Supports PE, PDF, Office, Archive formats"}
                            </p>
                            {file && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleUpload(); }}
                                    className="px-8 py-3 bg-neutral-600 hover:bg-[#151515] text-white rounded font-bold text-sm shadow-lg shadow-indigo-900/20 flex items-center gap-2 mx-auto"
                                >
                                    <Activity size={16}/> INITIATE ANALYSIS
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {(analysisStatus === 'UPLOADING' || analysisStatus === 'ANALYZING' || analysisStatus === 'CALCULATING_HASH' || analysisStatus === 'CHECKING_CACHE') && (
                    <div className="flex-1 flex flex-col items-center justify-center h-full min-h-[400px]">
                        <div className="w-24 h-24 border-4 border-neutral-500 border-t-transparent rounded-full animate-spin mb-8"></div>
                        <h3 className="text-2xl font-bold text-white animate-pulse">
                            {analysisStatus === 'CALCULATING_HASH' && 'CALCULATING SHA256...'}
                            {analysisStatus === 'CHECKING_CACHE' && 'CHECKING OTX DB...'}
                            {analysisStatus === 'UPLOADING' && 'UPLOADING SAMPLE...'}
                            {analysisStatus === 'ANALYZING' && 'RUNNING SANDBOX...'}
                        </h3>
                        <p className="text-[#888] font-mono mt-2">
                            {analysisStatus === 'ANALYZING' && `Polling Results (Attempt ${retryCount})...`}
                            {analysisStatus === 'UPLOADING' && `Sending file to AlienVault...`}
                            {analysisStatus === 'CHECKING_CACHE' && `Looking for existing analysis...`}
                        </p>
                        {hash && <div className="mt-4 p-2 bg-black/40 rounded border border-[#222] font-mono text-xs text-red-400 flex items-center gap-2"><Hash size={12}/> {hash}</div>}
                    </div>
                )}

                {analysisStatus === 'ERROR' && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center h-full min-h-[400px]">
                        <AlertTriangle size={64} className="text-red-500 mb-4 opacity-50"/>
                        <h3 className="text-xl font-bold text-white mb-2">Analysis Failed</h3>
                        <p className="text-red-400 font-mono mb-6">{error}</p>
                        <button 
                            onClick={() => { setFile(null); setAnalysisStatus('IDLE'); }}
                            className="px-6 py-2 bg-[#151515] hover:bg-[#1C1C1C] text-white rounded font-bold text-sm"
                        >
                            TRY AGAIN
                        </button>
                    </div>
                )}

                {analysisStatus === 'READY' && report && (
                    <div className="flex flex-col gap-6 pb-10">
                        {/* Tabs */}
                        <div className="flex bg-black/40 border-b border-[#222] px-2 overflow-x-auto custom-scrollbar">
                             {[
                                 { id: 'SUMMARY', label: 'Summary', icon: Activity },
                                 { id: 'STATIC', label: 'Static Analysis', icon: Cpu },
                                 { id: 'THREATS', label: 'Threats & Rules', icon: ShieldAlert },
                                 { id: 'NETWORK', label: 'Network Traffic', icon: Network },
                                 { id: 'METADATA', label: 'Strings & Metadata', icon: Terminal },
                             ].map(tab => (
                                 <button
                                     key={tab.id}
                                     onClick={() => setActiveTab(tab.id as any)}
                                     className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id ? 'border-neutral-500 text-white bg-white/5' : 'border-transparent text-[#888] hover:text-neutral-300'}`}
                                 >
                                     <tab.icon size={14}/> {tab.label}
                                 </button>
                             ))}
                        </div>

                        {/* Content */}
                        <div className="min-h-[500px]">
                            {activeTab === 'SUMMARY' && renderSummary()}
                            {activeTab === 'STATIC' && renderStatic()}
                            {activeTab === 'THREATS' && renderThreats()}
                            {activeTab === 'NETWORK' && renderNetwork()}
                            {activeTab === 'METADATA' && renderMetadata()}
                        </div>
                        
                        <div className="flex justify-end pt-4 border-t border-[#222]">
                            <button onClick={() => { setFile(null); setAnalysisStatus('IDLE'); }} className="px-6 py-2 bg-[#151515] hover:bg-[#1C1C1C] text-white rounded font-bold text-xs border border-[#333]">
                                NEW ANALYSIS
                            </button>
                        </div>
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
                                    <p className="font-mono text-sm animate-pulse">Analyzing malware report...</p>
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
                                    placeholder="Ask about the malware analysis..."
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
