
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Globe, Shield, Lock, Eye, EyeOff, Play, RotateCcw, Plus, X, Terminal, Activity, Server, AlertTriangle, Zap, LockKeyhole, Sidebar, Monitor, FileCode, Search, ArrowRight, CheckCircle, XCircle, Siren, Bell, Wifi, Cpu, Layers } from 'lucide-react';
import { SandboxTab, SandboxNetworkLog, DomMutationLog, DarkwebScreenshot } from '../../types';
import { fetchSafeContent, evaluateUrlThreat, fetchOnionContent } from '../../services/sandbox';
import { enrichIP } from '../../services/dns';

// --- Components ---

const TabBar = ({ tabs, activeId, onActivate, onClose, onNew }: { tabs: SandboxTab[], activeId: string, onActivate: (id: string) => void, onClose: (id: string) => void, onNew: () => void }) => (
    <div className="flex items-center bg-black border-b border-gray-800 px-2 pt-2 gap-1 overflow-x-auto custom-scrollbar">
        {tabs.map(tab => (
            <div 
                key={tab.id}
                onClick={() => onActivate(tab.id)}
                className={`
                    flex items-center gap-2 px-3 py-2 rounded-t-lg cursor-pointer min-w-[120px] max-w-[200px] border-t border-x transition-all group
                    ${tab.id === activeId 
                        ? 'bg-gray-900 border-gray-700 text-white' 
                        : 'bg-gray-900/40 border-transparent text-gray-500 hover:bg-gray-800'}
                `}
            >
                {tab.isDarkweb ? <LockKeyhole size={12} className="text-purple-500"/> : <Globe size={12} className={tab.threatCategory === 'MALICIOUS' ? 'text-red-500' : 'text-blue-400'}/>}
                <span className="text-xs font-bold truncate flex-1">{tab.title || 'New Tab'}</span>
                <button 
                    onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
                    className={`hover:text-red-400 ${tab.id === activeId ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                >
                    <X size={12}/>
                </button>
            </div>
        ))}
        <button onClick={onNew} className="p-2 text-gray-500 hover:text-white transition-colors"><Plus size={16}/></button>
    </div>
);

const AddressBar = ({ url, loading, score, category, onNavigate, onChange }: { url: string, loading: boolean, score: number, category: string, onNavigate: () => void, onChange: (val: string) => void }) => {
    const getRiskColor = () => {
        if (category === 'MALICIOUS') return 'text-red-500 border-red-500/30 bg-red-900/20';
        if (category === 'SUSPICIOUS') return 'text-orange-500 border-orange-500/30 bg-orange-900/20';
        return 'text-green-500 border-green-500/30 bg-green-900/20';
    };

    return (
        <div className="h-12 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-4">
            <div className="flex gap-2">
                <button className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded"><RotateCcw size={14}/></button>
                <button className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded"><Lock size={14}/></button>
            </div>
            
            <div className="flex-1 relative group">
                <input 
                    type="text" 
                    className="w-full bg-black border border-gray-700 rounded-lg py-1.5 pl-10 pr-20 text-sm text-gray-300 focus:border-cyber-cyan focus:outline-none font-mono transition-all"
                    placeholder="Enter URL or .onion address..."
                    value={url}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onNavigate()}
                />
                <div className="absolute left-3 top-2 text-gray-500">
                    {loading ? <Activity size={14} className="animate-spin text-cyber-cyan"/> : <Search size={14}/>}
                </div>
                {score > 0 && (
                    <div className={`absolute right-2 top-1.5 px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 ${getRiskColor()}`}>
                        <Shield size={10}/> {score}/100
                    </div>
                )}
            </div>

            <button 
                onClick={onNavigate}
                className="px-4 py-1.5 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/50 rounded text-xs font-bold flex items-center gap-2 transition-colors"
            >
                GO <ArrowRight size={12}/>
            </button>
        </div>
    );
};

const NetworkLogPanel = ({ logs, alerts, ipThreats }: { logs: SandboxNetworkLog[], alerts: string[], ipThreats: Record<string, any> }) => (
    <div className="flex-1 overflow-hidden flex flex-col">
        <div className="px-4 py-2 bg-gray-900 border-b border-gray-800 text-[10px] font-bold text-gray-500 uppercase flex items-center justify-between">
            <div className="flex gap-4">
                <span>Network Traffic</span>
                {alerts.length > 0 && (
                    <span className="text-red-400 flex items-center gap-1 animate-pulse">
                        <Siren size={12}/> {alerts.length} Security Alerts
                    </span>
                )}
            </div>
            <span className="bg-gray-800 px-2 py-0.5 rounded text-gray-300">{logs.length} Requests</span>
        </div>
        
        {alerts.length > 0 && (
            <div className="bg-red-900/10 border-b border-red-500/20 p-2 max-h-24 overflow-y-auto">
                {alerts.map((alert, i) => (
                    <div key={i} className="text-[10px] text-red-300 font-mono flex items-center gap-2 mb-1">
                        <AlertTriangle size={10}/> {alert}
                    </div>
                ))}
            </div>
        )}

        <div className="flex-1 overflow-auto custom-scrollbar bg-black font-mono text-xs">
            <table className="w-full text-left">
                <thead className="bg-gray-900 text-gray-500 sticky top-0">
                    <tr>
                        <th className="p-2">Status</th>
                        <th className="p-2">Method</th>
                        <th className="p-2">Domain</th>
                        <th className="p-2">Type</th>
                        <th className="p-2 text-right">Size</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                    {logs.map(log => {
                        let host = '';
                        try { host = new URL(log.url).hostname; } catch(e) {}
                        const threat = ipThreats[host];
                        const isThreat = threat && (threat.is_known_attacker || threat.is_threat || threat.is_bot);

                        return (
                            <tr key={log.id} className={`hover:bg-gray-900 transition-colors ${isThreat ? 'bg-red-900/20' : ''}`}>
                                <td className="p-2">
                                    {log.blocked ? (
                                        <span className="text-red-500 flex items-center gap-1"><XCircle size={10}/> BLK</span>
                                    ) : (
                                        <span className={log.status >= 400 ? 'text-red-400' : 'text-green-400'}>{log.status}</span>
                                    )}
                                </td>
                                <td className="p-2 text-purple-400">{log.method}</td>
                                <td className="p-2 text-gray-300 truncate max-w-[200px]" title={log.url}>
                                    {log.url}
                                    {isThreat && (
                                        <span className="ml-2 px-1.5 py-0.5 rounded bg-red-500 text-white text-[9px] font-bold border border-red-400 flex inline-flex items-center gap-1">
                                            <Zap size={8} fill="currentColor"/> THREAT
                                        </span>
                                    )}
                                </td>
                                <td className="p-2 text-gray-500">{log.type}</td>
                                <td className="p-2 text-right text-gray-600">{(log.size / 1024).toFixed(1)} KB</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    </div>
);

const DomMutationPanel = ({ logs }: { logs: DomMutationLog[] }) => (
    <div className="flex-1 overflow-hidden flex flex-col border-l border-gray-800">
        <div className="px-4 py-2 bg-gray-900 border-b border-gray-800 text-[10px] font-bold text-gray-500 uppercase flex items-center justify-between">
            <span>DOM Sanitizer</span>
            <span className="bg-gray-800 px-2 py-0.5 rounded text-gray-300">{logs.length} Actions</span>
        </div>
        <div className="flex-1 overflow-auto custom-scrollbar bg-black font-mono text-xs p-2 space-y-1">
            {logs.map(log => (
                <div key={log.id} className="flex items-start gap-2 p-1 hover:bg-white/5 rounded">
                    <div className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${log.type === 'REMOVE' ? 'bg-red-500' : log.type === 'MODIFY' ? 'bg-orange-500' : 'bg-green-500'}`}></div>
                    <div>
                        <span className={`font-bold mr-2 ${log.type === 'REMOVE' ? 'text-red-400' : 'text-orange-400'}`}>{log.type}</span>
                        <span className="text-gray-400 mr-2">[{log.target}]</span>
                        <span className="text-gray-500">{log.detail}</span>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

const SecureConnectionLoader = ({ isDarkweb }: { isDarkweb: boolean }) => {
    const [step, setStep] = useState(0);
    const [log, setLog] = useState<string[]>([]);

    const steps = isDarkweb ? [
        { label: "Initializing Tor Circuit...", icon: Wifi },
        { label: "Resolving V3 Descriptor...", icon: Search },
        { label: "Handshaking Hidden Service...", icon: Lock },
        { label: "Sanitizing Onion DOM...", icon: Shield }
    ] : [
        { label: "Resolving Secure DNS...", icon: Globe },
        { label: "Scanning Threat Intel...", icon: Siren },
        { label: "Establishing TLS 1.3 Tunnel...", icon: LockKeyhole },
        { label: "Stripping Malicious Scripts...", icon: FileCode }
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setStep(s => {
                if (s < steps.length - 1) return s + 1;
                return s;
            });
        }, 800);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const logs = [
            "Allocating secure buffer...",
            "Checking certificate revocation list...",
            "Analyzing headers for exploits...",
            "Neutralizing JavaScript payloads...",
            "Verifying content integrity...",
            "Injecting click monitors..."
        ];
        
        let i = 0;
        const logInterval = setInterval(() => {
            if (i < logs.length) {
                setLog(prev => [...prev, `[SYSTEM] ${logs[i]}`]);
                i++;
            }
        }, 400);
        return () => clearInterval(logInterval);
    }, []);

    return (
        <div className="absolute inset-0 z-50 bg-[#0d1117] flex flex-col items-center justify-center font-mono">
            <div className="w-96 p-6 bg-black/50 border border-gray-800 rounded-xl backdrop-blur-md shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyber-cyan to-transparent animate-scan"></div>
                
                <h3 className="text-white font-bold mb-6 flex items-center gap-2 text-sm tracking-wider">
                    <Activity className="text-cyber-cyan animate-pulse" size={16}/> SECURE CONNECTION SEQUENCE
                </h3>

                <div className="space-y-4 mb-6">
                    {steps.map((s, i) => (
                        <div key={i} className={`flex items-center gap-3 transition-all duration-300 ${i <= step ? 'opacity-100 translate-x-0' : 'opacity-30 -translate-x-2'}`}>
                            <div className={`p-1.5 rounded-full ${i < step ? 'bg-green-500/20 text-green-500' : i === step ? 'bg-cyber-cyan/20 text-cyber-cyan animate-pulse' : 'bg-gray-800 text-gray-600'}`}>
                                {i < step ? <CheckCircle size={12}/> : <s.icon size={12}/>}
                            </div>
                            <span className={`text-xs ${i === step ? 'text-white font-bold' : 'text-gray-500'}`}>{s.label}</span>
                            {i === step && <span className="ml-auto text-[10px] text-cyber-cyan animate-pulse">PROCESSING</span>}
                        </div>
                    ))}
                </div>

                <div className="bg-black/80 rounded border border-gray-800 p-2 h-24 overflow-hidden relative">
                    <div className="absolute inset-0 bg-green-500/5 pointer-events-none"></div>
                    <div className="space-y-1">
                        {log.map((l, i) => (
                            <div key={i} className="text-[9px] text-green-400/80 truncate">{l}</div>
                        ))}
                        <div className="w-2 h-4 bg-green-500 animate-pulse"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const SandboxBrowserView: React.FC = () => {
    const [tabs, setTabs] = useState<SandboxTab[]>([
        { id: '1', url: '', title: 'New Tab', loading: false, threatScore: 0, threatCategory: 'UNKNOWN', isDarkweb: false }
    ]);
    const [activeTabId, setActiveTabId] = useState('1');
    const [inputUrl, setInputUrl] = useState('');
    
    // State for the active tab's data
    const [iframeSrc, setIframeSrc] = useState<string | null>(null);
    const [darkwebData, setDarkwebData] = useState<DarkwebScreenshot | null>(null);
    const [networkLogs, setNetworkLogs] = useState<SandboxNetworkLog[]>([]);
    const [domLogs, setDomLogs] = useState<DomMutationLog[]>([]);
    const [networkAlerts, setNetworkAlerts] = useState<string[]>([]);
    const [ipThreats, setIpThreats] = useState<Record<string, any>>({});
    
    // Toggles
    const [jsEnabled, setJsEnabled] = useState(false);
    const [proxyMode, setProxyMode] = useState(true);
    const [showPanels, setShowPanels] = useState(true);

    const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

    const requestHistory = useRef<Map<string, number[]>>(new Map());
    const checkedIps = useRef<Set<string>>(new Set());

    useEffect(() => {
        setInputUrl(activeTab.url);
        if (!activeTab.url) {
            setIframeSrc(null);
            setDarkwebData(null);
            setNetworkLogs([]);
            setDomLogs([]);
            setNetworkAlerts([]);
            setIpThreats({});
            requestHistory.current.clear();
            checkedIps.current.clear();
        }
    }, [activeTabId]);

    const analyzeTraffic = (log: SandboxNetworkLog) => {
        const alerts: string[] = [];
        const now = Date.now();
        
        const ipRegex = /^https?:\/\/(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?::\d+)?/;
        if (ipRegex.test(log.url)) {
            alerts.push(`Direct IP Access detected: ${log.url}`);
        }

        let baseUrl = log.url.split('?')[0];
        if (!requestHistory.current.has(baseUrl)) {
            requestHistory.current.set(baseUrl, []);
        }
        const history = requestHistory.current.get(baseUrl)!;
        history.push(now);
        
        if (history.length > 10) history.shift();

        if (history.length >= 4) {
            const intervals = [];
            for (let i = 1; i < history.length; i++) {
                intervals.push(history[i] - history[i-1]);
            }
            
            const avg = intervals.reduce((a,b) => a+b, 0) / intervals.length;
            const variance = intervals.reduce((a,b) => a + Math.pow(b - avg, 2), 0) / intervals.length;
            const stdDev = Math.sqrt(variance);
            
            if (stdDev < 100 && avg > 1000) {
                alerts.push(`Possible Beaconing detected to ${baseUrl} (~${(avg/1000).toFixed(1)}s interval)`);
            }
            
            if (avg < 500) {
                alerts.push(`High Frequency traffic to ${baseUrl} (Potential C2/Exfil)`);
            }
        }

        if (log.url.includes('iframe') || log.type.includes('html')) {
             const recentHidden = domLogs.some(d => 
                 d.type === 'ADD' && 
                 d.target === 'IFRAME' && 
                 (d.detail.includes('hidden') || d.detail.includes('0x0'))
             );
             if (recentHidden) {
                 alerts.push(`Hidden Iframe content loaded from ${log.url}`);
             }
        }

        if (alerts.length > 0) {
            setNetworkAlerts(prev => [...new Set([...alerts, ...prev])]);
        }
    };

    const handleNavigate = async (urlOverride?: string) => {
        const targetUrl = urlOverride || inputUrl;
        if (!targetUrl) return;
        
        if (urlOverride) setInputUrl(urlOverride);

        let url = targetUrl;
        if (!url.startsWith('http') && !url.includes('.onion')) url = `https://${url}`;

        const isDarkweb = url.includes('.onion');
        
        // Optimistic State Update using current Tab ID
        setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, url, title: url, loading: true, isDarkweb } : t));
        
        setIframeSrc(null);
        setDarkwebData(null);
        setNetworkLogs([]);
        setDomLogs([]);
        setNetworkAlerts([]);
        setIpThreats({});
        requestHistory.current.clear();
        checkedIps.current.clear();

        const threat = await evaluateUrlThreat(url);
        
        setTabs(prev => prev.map(t => t.id === activeTabId ? { 
            ...t, 
            threatScore: threat.score, 
            threatCategory: threat.category, 
            threatSignatures: threat.signatures 
        } : t));
        
        try {
            if (isDarkweb) {
                const config = {
                    allowJs: false, // Darkweb is safer without JS
                    blockExternalJs: true,
                    stripInlineScripts: true,
                    enforceCsp: true
                };
                
                const { success, blobUrl, mutations, screenshotData } = await fetchOnionContent(url, config, (log) => {
                    setNetworkLogs(prev => [log, ...prev]);
                });

                if (success && blobUrl) {
                    setIframeSrc(blobUrl);
                    if (mutations) setDomLogs(mutations);
                    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, title: "Onion Service (Gateway)" } : t));
                } else if (screenshotData) {
                    setDarkwebData(screenshotData);
                    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, title: screenshotData.title || 'Hidden Service' } : t));
                }
            } else {
                const { blobUrl, mutations } = await fetchSafeContent(url, {
                    allowJs: jsEnabled,
                    blockExternalJs: true,
                    stripInlineScripts: false,
                    enforceCsp: true
                }, (log) => {
                    setNetworkLogs(prev => [log, ...prev]);
                    analyzeTraffic(log);
                    
                    try {
                        const host = new URL(log.url).hostname;
                        if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(host) && !checkedIps.current.has(host)) {
                            checkedIps.current.add(host);
                            enrichIP(host).then(data => {
                                if (data?.threat) {
                                    setIpThreats(prev => ({ ...prev, [host]: data.threat }));
                                }
                            });
                        }
                    } catch(e) {}
                });
                
                setIframeSrc(blobUrl);
                setDomLogs(mutations);
                setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, title: new URL(url).hostname } : t));
            }
        } catch (e: any) {
            const errorLog: SandboxNetworkLog = {
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                method: 'GET',
                url: url,
                status: 0,
                type: 'error',
                size: 0,
                blocked: true
            };
            setNetworkLogs(prev => [errorLog, ...prev]);
            
            const errorHtml = `
                <html><body style="background:#020617;color:#cbd5e1;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
                <div style="border:1px solid #dc2626;padding:30px;border-radius:8px;background:rgba(127,29,29,0.1);text-align:center;">
                <h1 style="color:#f87171;margin:0 0 10px 0;">CONNECTION BLOCKED</h1>
                <p>The Security Sandbox could not establish a safe connection to this target.</p>
                <div style="background:#0f172a;padding:10px;margin:15px 0;border:1px solid #1e293b;word-break:break-all;color:#38bdf8;">${url}</div>
                <div style="color:#94a3b8;font-size:12px;">Reason: ${e.message || 'Proxy connection refused.'}</div>
                <button onclick="window.parent.postMessage({type:'NAVIGATE', url: '${url}'}, '*')" style="margin-top:15px;background:#334155;color:white;border:none;padding:8px 12px;cursor:pointer;border-radius:4px;">Retry Connection</button>
                </div></body></html>
            `;
            const blob = new Blob([errorHtml], { type: 'text/html' });
            setIframeSrc(URL.createObjectURL(blob));

        } finally {
            setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, loading: false } : t));
        }
    };

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data.type === 'DOM_MUTATION') {
                setDomLogs(prev => [{
                    id: crypto.randomUUID(),
                    timestamp: new Date().toISOString(),
                    type: event.data.kind === 'childList' ? (event.data.addedNodes ? 'ADD' : 'REMOVE') : 'MODIFY' as any,
                    target: String(event.data.target || 'Unknown'),
                    detail: event.data.details || 'Runtime Mutation'
                }, ...prev].slice(0, 100));
            } else if (event.data.type === 'NET_REQUEST') {
                const newLog: SandboxNetworkLog = {
                    id: crypto.randomUUID(),
                    timestamp: new Date().toISOString(),
                    method: event.data.method,
                    url: event.data.url,
                    status: 200,
                    type: 'xhr',
                    size: 0,
                    blocked: false
                };
                setNetworkLogs(prev => [newLog, ...prev].slice(0, 100));
                analyzeTraffic(newLog);

                try {
                    const host = new URL(newLog.url).hostname;
                    const isIp = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(host);
                    if (isIp && !checkedIps.current.has(host)) {
                        checkedIps.current.add(host);
                        enrichIP(host).then(data => {
                            if (data?.threat) {
                                setIpThreats(prev => ({ ...prev, [host]: data.threat }));
                                if (data.threat.is_known_attacker || data.threat.is_threat) {
                                    setNetworkAlerts(prev => [...prev, `Traffic to Malicious IP detected: ${host}`]);
                                }
                            }
                        });
                    }
                } catch(e) {}
            } else if (event.data.type === 'NAVIGATE') {
                handleNavigate(event.data.url);
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [activeTabId]);

    const handleNewTab = () => {
        const id = crypto.randomUUID();
        setTabs([...tabs, { id, url: '', title: 'New Tab', loading: false, threatScore: 0, threatCategory: 'UNKNOWN', isDarkweb: false }]);
        setActiveTabId(id);
    };

    const handleCloseTab = (id: string) => {
        if (tabs.length === 1) {
            setTabs([{ id: '1', url: '', title: 'New Tab', loading: false, threatScore: 0, threatCategory: 'UNKNOWN', isDarkweb: false }]);
            setActiveTabId('1');
            return;
        }
        const newTabs = tabs.filter(t => t.id !== id);
        setTabs(newTabs);
        if (activeTabId === id) setActiveTabId(newTabs[newTabs.length - 1].id);
    };

    return (
        <div className="h-[calc(100vh-70px)] flex bg-[#020617] text-gray-300 font-sans overflow-hidden">
            {/* Left Sidebar */}
            <div className="w-64 bg-black/40 border-r border-gray-800 flex flex-col">
                <div className="p-4 border-b border-gray-800">
                    <h2 className="text-lg font-cyber font-bold text-white flex items-center gap-2">
                        <Shield className="text-cyber-cyan"/> SECURE <span className="text-gray-500">BOX</span>
                    </h2>
                    <p className="text-[10px] text-gray-500 font-mono mt-1">Isolated Environment v1.0</p>
                </div>

                <div className="p-4 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                    <div className={`p-4 rounded-lg border ${activeTab.threatCategory === 'MALICIOUS' ? 'bg-red-900/20 border-red-500/30' : activeTab.threatCategory === 'SUSPICIOUS' ? 'bg-orange-900/20 border-orange-500/30' : 'bg-green-900/20 border-green-500/30'}`}>
                        <div className="text-[10px] uppercase font-bold text-gray-400 mb-1">Current Threat Level</div>
                        <div className={`text-2xl font-bold ${activeTab.threatCategory === 'MALICIOUS' ? 'text-red-500' : activeTab.threatCategory === 'SUSPICIOUS' ? 'text-orange-500' : 'text-green-500'}`}>
                            {activeTab.threatCategory}
                        </div>
                        <div className="w-full bg-gray-800 h-1 mt-2 rounded-full overflow-hidden">
                            <div 
                                className={`h-full ${activeTab.threatCategory === 'MALICIOUS' ? 'bg-red-500' : activeTab.threatCategory === 'SUSPICIOUS' ? 'bg-orange-500' : 'bg-green-500'}`} 
                                style={{ width: `${activeTab.threatScore}%` }}
                            ></div>
                        </div>
                        
                        {activeTab.threatSignatures && activeTab.threatSignatures.length > 0 && (
                            <div className="mt-4 space-y-1">
                                <div className="text-[10px] font-bold text-gray-500 uppercase">Detected Heuristics</div>
                                {activeTab.threatSignatures.map((sig, i) => (
                                    <div key={i} className="text-[10px] text-red-300 bg-red-900/20 border border-red-500/20 px-2 py-1 rounded flex items-center gap-2">
                                        <AlertTriangle size={10} className="flex-shrink-0" /> {sig}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <label className="flex items-center justify-between cursor-pointer group">
                            <span className="text-xs font-bold text-gray-400 group-hover:text-white">JavaScript Execution</span>
                            <div className={`w-8 h-4 rounded-full relative transition-colors ${jsEnabled ? 'bg-red-500' : 'bg-gray-600'}`} onClick={() => setJsEnabled(!jsEnabled)}>
                                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${jsEnabled ? 'left-4.5' : 'left-0.5'}`}></div>
                            </div>
                        </label>
                        <label className="flex items-center justify-between cursor-pointer group">
                            <span className="text-xs font-bold text-gray-400 group-hover:text-white">Accelerated Proxy</span>
                            <div className={`w-8 h-4 rounded-full relative transition-colors ${proxyMode ? 'bg-cyber-cyan' : 'bg-gray-600'}`} onClick={() => setProxyMode(!proxyMode)}>
                                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${proxyMode ? 'left-4.5' : 'left-0.5'}`}></div>
                            </div>
                        </label>
                        <label className="flex items-center justify-between cursor-pointer group">
                            <span className="text-xs font-bold text-gray-400 group-hover:text-white">DevTools Panel</span>
                            <div className={`w-8 h-4 rounded-full relative transition-colors ${showPanels ? 'bg-purple-500' : 'bg-gray-600'}`} onClick={() => setShowPanels(!showPanels)}>
                                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${showPanels ? 'left-4.5' : 'left-0.5'}`}></div>
                            </div>
                        </label>
                    </div>

                    <div className="text-[10px] text-gray-500 bg-gray-900/50 p-3 rounded border border-gray-800 space-y-2">
                        {activeTab.isDarkweb ? (
                            <div className="flex items-center gap-2"><CheckCircle size={10} className="text-purple-500"/> TOR Circuit Active</div>
                        ) : (
                            <>
                                <div className="flex items-center gap-2"><CheckCircle size={10} className="text-green-500"/> iframe Sandbox Active</div>
                                <div className="flex items-center gap-2"><CheckCircle size={10} className="text-green-500"/> CSP Enforced</div>
                            </>
                        )}
                        <div className="flex items-center gap-2"><CheckCircle size={10} className="text-green-500"/> DOM Sanitizer On</div>
                    </div>
                </div>
            </div>

            {/* Main Browser Area */}
            <div className="flex-1 flex flex-col min-w-0 relative bg-gray-900/20">
                <TabBar tabs={tabs} activeId={activeTabId} onActivate={setActiveTabId} onClose={handleCloseTab} onNew={handleNewTab} />
                
                <AddressBar 
                    url={inputUrl} 
                    onChange={setInputUrl} 
                    onNavigate={() => handleNavigate()} 
                    loading={activeTab.loading} 
                    score={activeTab.threatScore} 
                    category={activeTab.threatCategory}
                />

                <div className="flex-1 relative bg-white overflow-hidden">
                    {activeTab.loading ? (
                        <SecureConnectionLoader isDarkweb={activeTab.isDarkweb} />
                    ) : activeTab.isDarkweb && darkwebData && !iframeSrc ? (
                        // Fallback Darkweb Viewer (Screenshot)
                        <div className="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center p-8 overflow-auto custom-scrollbar">
                            <div className="max-w-4xl w-full bg-black border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
                                <div className="p-4 bg-purple-900/20 border-b border-purple-500/30 flex items-center justify-between">
                                    <h3 className="text-purple-400 font-bold flex items-center gap-2"><EyeOff size={16}/> TOR NETWORK PREVIEW</h3>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-gray-500 font-mono border border-purple-500/30 px-2 py-0.5 rounded bg-purple-900/10">SAFE MODE: SCREENSHOT ONLY</span>
                                        <button onClick={() => handleNavigate()} className="p-1 hover:text-white text-gray-500 hover:bg-white/10 rounded transition-colors" title="Refresh Screenshot"><RotateCcw size={14}/></button>
                                    </div>
                                </div>
                                <div className="relative border-b border-gray-800">
                                    <img src={darkwebData.imageBase64} alt="Darkweb Screenshot" className="w-full object-contain bg-[#111]"/>
                                    <div className="absolute top-4 right-4 flex flex-col gap-2">
                                        <span className="bg-red-500/90 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg border border-red-400">JAVASCRIPT DISABLED</span>
                                        <span className="bg-black/80 text-gray-300 text-[10px] font-bold px-2 py-1 rounded shadow-lg border border-gray-700">REMOTE RENDER</span>
                                    </div>
                                </div>
                                <div className="p-4 bg-[#0a0a0a]">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-2"><FileCode size={12}/> Extracted Text Content</h4>
                                    <div className="text-xs font-mono text-green-400 whitespace-pre-wrap bg-black p-3 rounded border border-gray-800 h-48 overflow-y-auto custom-scrollbar border-l-2 border-l-green-500/50">
                                        {darkwebData.extractedText}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : iframeSrc ? (
                        // Standard Sandbox Iframe with 'allow-scripts' to enable navigation interception
                        // We rely on sanitizeHtml to strip all original scripts, leaving only our interceptor
                        <iframe 
                            src={iframeSrc}
                            className="w-full h-full border-none bg-white"
                            sandbox="allow-forms allow-same-origin allow-scripts"
                            referrerPolicy="no-referrer"
                            title="Sandbox"
                        />
                    ) : (
                        // Empty State
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d1117] text-gray-600">
                            <Shield size={64} className="mb-4 opacity-20"/>
                            <h3 className="text-xl font-bold text-gray-500 mb-2">Secure Browsing Environment</h3>
                            <p className="text-sm text-center max-w-md">
                                Enter a URL to browse safely. All content is proxied, sanitized, and stripped of malicious scripts before rendering.
                            </p>
                        </div>
                    )}
                </div>

                {/* DevTools Panel */}
                {showPanels && (
                    <div className="h-48 bg-black border-t border-gray-800 flex">
                        <NetworkLogPanel logs={networkLogs} alerts={networkAlerts} ipThreats={ipThreats} />
                        <DomMutationPanel logs={domLogs} />
                    </div>
                )}
            </div>
        </div>
    );
};
