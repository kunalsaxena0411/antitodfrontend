
import React, { useState, useEffect, useMemo } from 'react';
import { InventoryAsset, CveEntry, VulnMatch } from '../../types';
import { generateCpe, matchVulnerabilities } from '../../services/inventoryMatcher';
import { Package, AlertOctagon, Plus, Trash2, Search, ShieldAlert, Zap, CheckCircle, Filter, Box, Server, RefreshCw, Layers, Layout, List, MoreHorizontal, MessageSquare, Clock, Check, XCircle, PauseCircle, Wrench } from 'lucide-react';

interface VulnManagerViewProps {
    cveData: CveEntry[];
}

interface AlertWorkflow {
    status: 'OPEN' | 'IN_PROGRESS' | 'ON_HOLD' | 'CLOSED';
    notes: string;
    remediation?: string;
    updatedAt: string;
}

const INITIAL_ASSETS: InventoryAsset[] = [
    { id: '1', vendor: 'Apache', product: 'Log4j', version: '2.14.1', criticality: 'Critical', tags: ['Web Server', 'Production'], addedAt: new Date().toISOString(), cpe: 'cpe:2.3:a:apache:log4j:2.14.1:*:*:*:*:*:*:*' },
    { id: '2', vendor: 'Microsoft', product: 'Exchange Server', version: '2019', criticality: 'High', tags: ['Mail', 'Internal'], addedAt: new Date().toISOString(), cpe: 'cpe:2.3:a:microsoft:exchange_server:2019:*:*:*:*:*:*:*' },
    { id: '3', vendor: 'F5', product: 'BIG-IP', version: '16.0.0', criticality: 'Critical', tags: ['Gateway'], addedAt: new Date().toISOString(), cpe: 'cpe:2.3:a:f5:big-ip:16.0.0:*:*:*:*:*:*:*' },
];

export const VulnManagerView: React.FC<VulnManagerViewProps> = ({ cveData }) => {
    const [assets, setAssets] = useState<InventoryAsset[]>(() => {
        try {
            const saved = localStorage.getItem('xyberah_inventory');
            return saved ? JSON.parse(saved) : INITIAL_ASSETS;
        } catch (e) { return INITIAL_ASSETS; }
    });

    const [workflows, setWorkflows] = useState<Record<string, AlertWorkflow>>(() => {
        try {
            const saved = localStorage.getItem('xyberah_alert_workflows');
            return saved ? JSON.parse(saved) : {};
        } catch (e) { return {}; }
    });
    
    const [matches, setMatches] = useState<VulnMatch[]>([]);
    const [activeTab, setActiveTab] = useState<'INVENTORY' | 'ALERTS'>('ALERTS');
    const [alertView, setAlertView] = useState<'LIST' | 'KANBAN'>('KANBAN');
    const [isScanning, setIsScanning] = useState(false);

    // Filter State
    const [filterVendor, setFilterVendor] = useState('');

    // Form State
    const [newVendor, setNewVendor] = useState('');
    const [newProduct, setNewProduct] = useState('');
    const [newVersion, setNewVersion] = useState('');
    const [newCriticality, setNewCriticality] = useState<'Low'|'Medium'|'High'|'Critical'>('Medium');

    // Autocomplete State
    const [showVendorSuggestions, setShowVendorSuggestions] = useState(false);
    const [showProductSuggestions, setShowProductSuggestions] = useState(false);
    const [showVersionSuggestions, setShowVersionSuggestions] = useState(false);

    // Note & Remediation Editing State
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [tempNote, setTempNote] = useState('');
    const [editingRemediationId, setEditingRemediationId] = useState<string | null>(null);
    const [tempRemediation, setTempRemediation] = useState('');

    // Persistence
    useEffect(() => {
        localStorage.setItem('xyberah_inventory', JSON.stringify(assets));
    }, [assets]);

    useEffect(() => {
        localStorage.setItem('xyberah_alert_workflows', JSON.stringify(workflows));
    }, [workflows]);

    // Auto-scan
    useEffect(() => {
        if (assets.length > 0 && cveData.length > 0) {
            setIsScanning(true);
            const timer = setTimeout(() => {
                const results = matchVulnerabilities(assets, cveData);
                setMatches(results);
                setIsScanning(false);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [assets, cveData]);

    const updateWorkflow = (assetId: string, cveId: string, status?: AlertWorkflow['status'], notes?: string, remediation?: string) => {
        const key = `${assetId}:${cveId}`;
        const current = workflows[key] || { status: 'OPEN', notes: '', remediation: '', updatedAt: new Date().toISOString() };
        
        const updated = {
            ...current,
            status: status !== undefined ? status : current.status,
            notes: notes !== undefined ? notes : current.notes,
            remediation: remediation !== undefined ? remediation : current.remediation,
            updatedAt: new Date().toISOString()
        };

        setWorkflows(prev => ({ ...prev, [key]: updated }));
    };

    // Filter Logic
    const filteredMatches = useMemo(() => {
        if (!filterVendor) return matches;
        const lower = filterVendor.toLowerCase();
        return matches.filter(m => m.cve.vendor.toLowerCase().includes(lower));
    }, [matches, filterVendor]);

    // Suggestions Logic
    const vendorSuggestions = useMemo(() => {
        if (!newVendor) return [];
        const lower = newVendor.toLowerCase();
        const unique = new Set<string>();
        for (const c of cveData) {
            if (c.vendor && c.vendor.toLowerCase().includes(lower)) {
                unique.add(c.vendor);
            }
        }
        return Array.from(unique).sort().slice(0, 10);
    }, [newVendor, cveData]);

    const productSuggestions = useMemo(() => {
        // Show suggestions if vendor is selected OR input is not empty
        if (!newProduct && !newVendor) return [];
        
        const lower = newProduct.toLowerCase();
        const vendorLower = newVendor.toLowerCase();
        const unique = new Set<string>();
        
        for (const c of cveData) {
            if (vendorLower && c.vendor && !c.vendor.toLowerCase().includes(vendorLower)) continue;
            
            if (!lower || (c.product && c.product.toLowerCase().includes(lower))) {
                unique.add(c.product);
            }
        }
        return Array.from(unique).sort().slice(0, 10);
    }, [newProduct, newVendor, cveData]);

    const versionSuggestions = useMemo(() => {
        if (!newVendor && !newProduct) return [];
        const unique = new Set<string>();
        const vendorLower = newVendor.toLowerCase();
        const productLower = newProduct.toLowerCase();
        const versionInputLower = newVersion.toLowerCase();

        cveData.forEach(c => {
            const cveVendor = c.vendor.toLowerCase();
            const cveProduct = c.product.toLowerCase();
            
            if ((!newVendor || cveVendor.includes(vendorLower)) && 
                (!newProduct || cveProduct.includes(productLower))) {
                
                c.configurations.forEach(cpe => {
                    const parts = cpe.split(':');
                    if (parts.length >= 6) {
                        const ver = parts[5];
                        if (ver && ver !== '*' && ver !== '-') {
                            if (!versionInputLower || ver.toLowerCase().includes(versionInputLower)) {
                                unique.add(ver);
                            }
                        }
                    }
                });
            }
        });
        return Array.from(unique).sort((a, b) => b.localeCompare(a, undefined, { numeric: true })).slice(0, 10);
    }, [newVendor, newProduct, newVersion, cveData]);

    const handleAddAsset = () => {
        if (!newVendor || !newProduct) return;
        const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36);
        
        const asset: InventoryAsset = {
            id,
            vendor: newVendor,
            product: newProduct,
            version: newVersion || 'Unknown',
            criticality: newCriticality,
            tags: [],
            addedAt: new Date().toISOString(),
            cpe: generateCpe(newVendor, newProduct, newVersion)
        };
        setAssets([asset, ...assets]);
        setNewVendor(''); setNewProduct(''); setNewVersion('');
    };

    const handleDeleteAsset = (id: string) => {
        setAssets(assets.filter(a => a.id !== id));
    };

    const getRiskColor = (score: number) => {
        if (score >= 90) return 'text-red-500 border-red-500/50 bg-red-900/20';
        if (score >= 70) return 'text-orange-500 border-orange-500/50 bg-orange-900/20';
        if (score >= 40) return 'text-yellow-500 border-yellow-500/50 bg-yellow-900/20';
        return 'text-blue-500 border-blue-500/50 bg-blue-900/20';
    };

    const getStatusColor = (status: string) => {
        switch(status) {
            case 'OPEN': return 'bg-red-900/30 text-red-400 border-red-500/30';
            case 'IN_PROGRESS': return 'bg-blue-900/30 text-blue-400 border-blue-500/30';
            case 'ON_HOLD': return 'bg-yellow-900/30 text-yellow-400 border-yellow-500/30';
            case 'CLOSED': return 'bg-green-900/30 text-green-400 border-green-500/30';
            default: return 'bg-gray-800 text-gray-400';
        }
    };

    const renderKanbanColumn = (title: string, status: AlertWorkflow['status'], items: VulnMatch[]) => (
        <div className="flex flex-col h-full min-w-[300px] bg-gray-900/20 border border-gray-800 rounded-lg overflow-hidden">
            <div className={`p-3 font-bold text-xs uppercase border-b border-gray-800 flex justify-between ${
                status === 'OPEN' ? 'text-red-400 bg-red-900/10' : 
                status === 'IN_PROGRESS' ? 'text-blue-400 bg-blue-900/10' : 
                status === 'ON_HOLD' ? 'text-yellow-400 bg-yellow-900/10' : 
                'text-green-400 bg-green-900/10'
            }`}>
                <span>{title}</span>
                <span className="bg-black/50 px-2 rounded">{items.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                {items.map((match) => {
                    const asset = assets.find(a => a.id === match.assetId);
                    const key = `${match.assetId}:${match.cveId}`;
                    const workflow = workflows[key] || { status: 'OPEN', notes: '', remediation: '' };
                    
                    return (
                        <div key={key} className="bg-black/40 border border-gray-800 p-3 rounded hover:border-gray-600 transition-colors group">
                            <div className="flex justify-between items-start mb-2">
                                <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getRiskColor(match.priorityScore)}`}>
                                    Score {match.priorityScore}
                                </div>
                                <div className="relative group/menu">
                                    <button className="p-1 hover:bg-gray-800 rounded text-gray-500 hover:text-white"><MoreHorizontal size={14}/></button>
                                    <div className="absolute right-0 top-full mt-1 bg-gray-900 border border-gray-700 rounded shadow-xl z-50 hidden group-hover/menu:block w-32">
                                        {['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'CLOSED'].filter(s => s !== status).map(s => (
                                            <button 
                                                key={s}
                                                onClick={() => updateWorkflow(match.assetId, match.cveId, s as any)}
                                                className="block w-full text-left px-3 py-2 text-[10px] hover:bg-gray-800 text-gray-300"
                                            >
                                                Move to {s.replace('_', ' ')}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="text-xs font-bold text-white mb-1 truncate" title={match.cveId}>{match.cveId}</div>
                            <div className="text-[10px] text-gray-400 mb-2 line-clamp-2">{match.cve.vendor} {match.cve.product}</div>
                            <div className="text-[10px] text-gray-500 mb-2">{asset?.vendor} {asset?.product} (v{asset?.version})</div>
                            
                            {/* Remediation Section */}
                            {editingRemediationId === key ? (
                                <div className="mt-2 bg-blue-900/20 p-2 rounded border border-blue-500/30">
                                    <label className="text-[10px] text-blue-300 font-bold uppercase mb-1 block">Remediation Plan</label>
                                    <textarea 
                                        className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-[10px] text-white focus:border-blue-500 outline-none"
                                        rows={3}
                                        value={tempRemediation}
                                        onChange={e => setTempRemediation(e.target.value)}
                                        autoFocus
                                        placeholder="Steps to fix..."
                                    />
                                    <div className="flex justify-end gap-1 mt-1">
                                        <button onClick={() => setEditingRemediationId(null)} className="p-1 text-gray-500 hover:text-white"><XCircle size={12}/></button>
                                        <button onClick={() => { updateWorkflow(match.assetId, match.cveId, undefined, undefined, tempRemediation); setEditingRemediationId(null); }} className="p-1 text-green-500 hover:text-green-400"><CheckCircle size={12}/></button>
                                    </div>
                                </div>
                            ) : (
                                <div 
                                    className={`mt-2 pt-2 border-t border-gray-800/50 text-[10px] cursor-pointer flex items-center gap-1 ${workflow.remediation ? 'text-blue-300' : 'text-gray-500 hover:text-blue-400'}`}
                                    onClick={() => { setEditingRemediationId(key); setTempRemediation(workflow.remediation || ''); }}
                                >
                                    <Wrench size={10}/> {workflow.remediation ? 'Edit Remediation' : 'Add Remediation'}
                                </div>
                            )}
                            {workflow.remediation && !editingRemediationId && (
                                <div className="mt-1 text-[10px] text-blue-200 bg-blue-900/20 p-1.5 rounded border border-blue-500/20 whitespace-pre-wrap">
                                    {workflow.remediation}
                                </div>
                            )}

                            {/* Notes Section */}
                            {editingNoteId === key ? (
                                <div className="mt-2">
                                    <textarea 
                                        className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-[10px] text-white focus:border-blue-500 outline-none"
                                        rows={3}
                                        value={tempNote}
                                        onChange={e => setTempNote(e.target.value)}
                                        autoFocus
                                    />
                                    <div className="flex justify-end gap-1 mt-1">
                                        <button onClick={() => setEditingNoteId(null)} className="p-1 text-gray-500 hover:text-white"><XCircle size={12}/></button>
                                        <button onClick={() => { updateWorkflow(match.assetId, match.cveId, undefined, tempNote); setEditingNoteId(null); }} className="p-1 text-green-500 hover:text-green-400"><CheckCircle size={12}/></button>
                                    </div>
                                </div>
                            ) : (
                                <div 
                                    className="mt-2 pt-2 border-t border-gray-800/50 text-[10px] text-gray-500 cursor-pointer hover:text-blue-400 flex items-center gap-1"
                                    onClick={() => { setEditingNoteId(key); setTempNote(workflow.notes || ''); }}
                                >
                                    <MessageSquare size={10}/> {workflow.notes ? 'Edit Notes' : 'Add Notes'}
                                </div>
                            )}
                            {workflow.notes && !editingNoteId && (
                                <div className="mt-1 text-[10px] text-gray-400 italic bg-gray-900/50 p-1.5 rounded border border-gray-800/50 truncate">
                                    {workflow.notes}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col">
            <div className="p-4 border-b border-gray-800 bg-black/40 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-900/20 rounded-lg border border-orange-500/30 text-orange-400">
                        <Layers size={20}/>
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white font-cyber flex items-center gap-2">
                            VULNERABILITY <span className="text-orange-500">MANAGER</span>
                        </h2>
                        <p className="text-xs text-gray-500 font-mono">Inventory Matching & Prioritization</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    {activeTab === 'ALERTS' && (
                        <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-800 gap-1">
                            <button onClick={() => setAlertView('LIST')} className={`p-1.5 rounded ${alertView === 'LIST' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}><List size={14}/></button>
                            <button onClick={() => setAlertView('KANBAN')} className={`p-1.5 rounded ${alertView === 'KANBAN' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}><Layout size={14}/></button>
                        </div>
                    )}
                    <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-800 gap-1">
                        <button 
                            onClick={() => setActiveTab('ALERTS')}
                            className={`px-4 py-2 rounded text-xs font-bold flex items-center gap-2 transition-all ${activeTab === 'ALERTS' ? 'bg-red-900/40 text-white border border-red-500/30' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            <AlertOctagon size={14}/> ALERTS <span className="bg-red-600 text-white px-1.5 rounded text-[10px]">{matches.length}</span>
                        </button>
                        <button 
                            onClick={() => setActiveTab('INVENTORY')}
                            className={`px-4 py-2 rounded text-xs font-bold flex items-center gap-2 transition-all ${activeTab === 'INVENTORY' ? 'bg-blue-900/40 text-white border border-blue-500/30' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            <Package size={14}/> INVENTORY <span className="bg-gray-700 text-gray-300 px-1.5 rounded text-[10px]">{assets.length}</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'INVENTORY' && (
                    <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-6">
                        <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-20">
                            {/* Add Asset Form */}
                            <div className="bg-black/40 border border-gray-800 rounded-lg p-5 relative z-10">
                                <h3 className="text-sm font-bold text-blue-400 uppercase mb-4 flex items-center gap-2">
                                    <Plus size={16}/> Add Product to Inventory
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                                    <div className="relative">
                                        <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Vendor</label>
                                        <input 
                                            type="text" 
                                            className="w-full bg-black border border-gray-700 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none" 
                                            placeholder="e.g. Apache" 
                                            value={newVendor} 
                                            onChange={e => setNewVendor(e.target.value)}
                                            onFocus={() => setShowVendorSuggestions(true)}
                                            onBlur={() => setTimeout(() => setShowVendorSuggestions(false), 200)}
                                            autoComplete="off"
                                        />
                                        {showVendorSuggestions && vendorSuggestions.length > 0 && (
                                            <div className="absolute top-full left-0 right-0 z-50 bg-gray-900 border border-gray-700 rounded-b-md shadow-xl max-h-48 overflow-y-auto custom-scrollbar">
                                                {vendorSuggestions.map((v, i) => (
                                                    <div key={i} className="px-3 py-2 hover:bg-blue-900/30 hover:text-blue-300 cursor-pointer text-xs text-gray-300 transition-colors" onMouseDown={() => { setNewVendor(v); setShowVendorSuggestions(false); }}>{v}</div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Product</label>
                                        <input 
                                            type="text" 
                                            className="w-full bg-black border border-gray-700 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none" 
                                            placeholder="e.g. Tomcat" 
                                            value={newProduct} 
                                            onChange={e => setNewProduct(e.target.value)}
                                            onFocus={() => setShowProductSuggestions(true)}
                                            onBlur={() => setTimeout(() => setShowProductSuggestions(false), 200)}
                                            autoComplete="off"
                                        />
                                        {showProductSuggestions && productSuggestions.length > 0 && (
                                            <div className="absolute top-full left-0 right-0 z-50 bg-gray-900 border border-gray-700 rounded-b-md shadow-xl max-h-48 overflow-y-auto custom-scrollbar">
                                                {productSuggestions.map((p, i) => (
                                                    <div key={i} className="px-3 py-2 hover:bg-blue-900/30 hover:text-blue-300 cursor-pointer text-xs text-gray-300 transition-colors" onMouseDown={() => { setNewProduct(p); setShowProductSuggestions(false); }}>{p}</div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Version</label>
                                        <input 
                                            type="text" 
                                            className="w-full bg-black border border-gray-700 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none" 
                                            placeholder="e.g. 9.0.1 (Optional)" 
                                            value={newVersion} 
                                            onChange={e => setNewVersion(e.target.value)}
                                            onFocus={() => setShowVersionSuggestions(true)}
                                            onBlur={() => setTimeout(() => setShowVersionSuggestions(false), 200)}
                                            autoComplete="off"
                                        />
                                        {showVersionSuggestions && versionSuggestions.length > 0 && (
                                            <div className="absolute top-full left-0 right-0 z-50 bg-gray-900 border border-gray-700 rounded-b-md shadow-xl max-h-48 overflow-y-auto custom-scrollbar">
                                                {versionSuggestions.map((v, i) => (
                                                    <div key={i} className="px-3 py-2 hover:bg-blue-900/30 hover:text-blue-300 cursor-pointer text-xs text-gray-300 transition-colors" onMouseDown={() => { setNewVersion(v); setShowVersionSuggestions(false); }}>{v}</div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Criticality</label>
                                        <select className="w-full bg-black border border-gray-700 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none" value={newCriticality} onChange={e => setNewCriticality(e.target.value as any)}>
                                            <option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option><option value="Critical">Critical</option>
                                        </select>
                                    </div>
                                    <button onClick={handleAddAsset} disabled={!newVendor || !newProduct} className="h-10 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                                        <Plus size={14}/> ADD ASSET
                                    </button>
                                </div>
                            </div>

                            {/* Inventory List */}
                            <div className="bg-black/40 border border-gray-800 rounded-lg overflow-hidden">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-900 text-gray-500 uppercase font-bold text-xs">
                                        <tr><th className="p-4">Product Identity</th><th className="p-4">Generated CPE</th><th className="p-4">Criticality</th><th className="p-4 text-right">Actions</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-800">
                                        {assets.map(asset => (
                                            <tr key={asset.id} className="hover:bg-white/5 transition-colors">
                                                <td className="p-4"><div className="font-bold text-white">{asset.vendor} {asset.product}</div><div className={`text-xs ${asset.version === 'Unknown' ? 'text-yellow-500' : 'text-gray-500'}`}>Version: {asset.version}</div></td>
                                                <td className="p-4 font-mono text-xs text-gray-400 break-all">{asset.cpe}</td>
                                                <td className="p-4"><span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${asset.criticality === 'Critical' ? 'text-red-400 border-red-500/30 bg-red-900/20' : 'text-blue-400 border-blue-500/30 bg-blue-900/20'}`}>{asset.criticality}</span></td>
                                                <td className="p-4 text-right"><button onClick={() => handleDeleteAsset(asset.id)} className="text-gray-500 hover:text-red-400 transition-colors"><Trash2 size={16}/></button></td>
                                            </tr>
                                        ))}
                                        {assets.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-gray-500 italic">Inventory is empty. Add products to start monitoring.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'ALERTS' && (
                    <div className="absolute inset-0 flex flex-col p-6">
                        <div className="flex items-center justify-between mb-4 px-1 shrink-0">
                            <div className="text-xs text-gray-500">Found {filteredMatches.length} alerts</div>
                            <div className="relative group">
                                <Search className="absolute left-3 top-2.5 text-gray-500 w-4 h-4" />
                                <input type="text" placeholder="Filter by Vendor..." className="bg-black/50 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:border-cyber-cyan focus:outline-none w-64 transition-all" value={filterVendor} onChange={(e) => setFilterVendor(e.target.value)} />
                            </div>
                        </div>

                        {isScanning ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-gray-500"><RefreshCw className="animate-spin text-orange-500" size={48}/><p className="font-mono text-sm">Matching inventory...</p></div>
                        ) : matches.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-gray-500 border-2 border-dashed border-gray-800 rounded-xl"><CheckCircle className="text-green-500" size={48}/><p className="font-mono text-sm">No vulnerabilities found matching your inventory.</p></div>
                        ) : (
                            <>
                                {alertView === 'KANBAN' && (
                                    <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
                                        {['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'CLOSED'].map(status => (
                                            <div key={status} className="flex-1 min-w-[300px]">
                                                {renderKanbanColumn(
                                                    status.replace('_', ' '), 
                                                    status as AlertWorkflow['status'], 
                                                    filteredMatches.filter(m => {
                                                        const key = `${m.assetId}:${m.cveId}`;
                                                        const currentStatus = workflows[key]?.status || 'OPEN';
                                                        return currentStatus === status;
                                                    })
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {alertView === 'LIST' && (
                                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-900/20 border border-gray-800 rounded-lg">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-gray-900/80 text-gray-500 uppercase font-bold text-xs sticky top-0 z-10">
                                                <tr><th className="p-4">Status</th><th className="p-4">Score</th><th className="p-4">CVE ID</th><th className="p-4">Affected Asset</th><th className="p-4">Details & Remediation</th></tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-800">
                                                {filteredMatches.map((match, i) => {
                                                    const asset = assets.find(a => a.id === match.assetId);
                                                    const key = `${match.assetId}:${match.cveId}`;
                                                    const workflow = workflows[key] || { status: 'OPEN', notes: '', remediation: '' };
                                                    return (
                                                        <tr key={key} className="hover:bg-white/5">
                                                            <td className="p-4">
                                                                <div className="relative group/status">
                                                                    <span className={`px-2 py-1 rounded text-[10px] font-bold border cursor-pointer ${getStatusColor(workflow.status)}`}>
                                                                        {workflow.status.replace('_', ' ')}
                                                                    </span>
                                                                    <div className="absolute left-0 top-full mt-1 bg-gray-900 border border-gray-700 rounded shadow-xl z-50 hidden group-hover/status:block w-32">
                                                                        {['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'CLOSED'].map(s => (
                                                                            <button key={s} onClick={() => updateWorkflow(match.assetId, match.cveId, s as any)} className="block w-full text-left px-3 py-2 text-[10px] hover:bg-gray-800 text-gray-300">{s.replace('_', ' ')}</button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="p-4"><span className={`font-bold ${getRiskColor(match.priorityScore)} px-2 py-0.5 rounded border text-xs`}>{match.priorityScore}</span></td>
                                                            <td className="p-4"><div className="font-mono text-white font-bold">{match.cveId}</div><div className="text-xs text-gray-500 truncate max-w-xs">{match.cve.description}</div></td>
                                                            <td className="p-4 text-gray-300 text-xs">{asset?.vendor} {asset?.product} (v{asset?.version})</td>
                                                            <td className="p-4 flex items-start gap-2">
                                                                <div className="flex flex-col gap-1">
                                                                    <div className="flex gap-1">
                                                                        <button onClick={() => { setEditingNoteId(key); setTempNote(workflow.notes); }} className="text-gray-500 hover:text-blue-400" title="Notes"><MessageSquare size={14}/></button>
                                                                        <button onClick={() => { setEditingRemediationId(key); setTempRemediation(workflow.remediation || ''); }} className="text-gray-500 hover:text-green-400" title="Remediation"><Wrench size={14}/></button>
                                                                    </div>
                                                                    <div className="flex flex-col gap-0.5">
                                                                       {workflow.remediation && <span className="text-[10px] text-green-400 max-w-xs truncate">Fix: {workflow.remediation}</span>}
                                                                       {workflow.notes && <span className="text-[10px] text-gray-500 italic max-w-xs truncate">Note: {workflow.notes}</span>}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Modal for Editing Note in List View */}
                        {editingNoteId && alertView === 'LIST' && (
                            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setEditingNoteId(null)}>
                                <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 w-full max-w-md" onClick={e => e.stopPropagation()}>
                                    <h3 className="text-white font-bold mb-2">Update Notes</h3>
                                    <textarea className="w-full bg-black border border-gray-700 rounded p-2 text-white text-xs" rows={5} value={tempNote} onChange={e => setTempNote(e.target.value)} autoFocus />
                                    <div className="flex justify-end gap-2 mt-4">
                                        <button onClick={() => setEditingNoteId(null)} className="px-3 py-1 text-xs text-gray-400 hover:text-white">Cancel</button>
                                        <button onClick={() => { 
                                            const [aid, cid] = editingNoteId.split(':'); 
                                            updateWorkflow(aid, cid, undefined, tempNote); 
                                            setEditingNoteId(null); 
                                        }} className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold">Save</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Modal for Editing Remediation in List View */}
                        {editingRemediationId && alertView === 'LIST' && (
                            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setEditingRemediationId(null)}>
                                <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 w-full max-w-md" onClick={e => e.stopPropagation()}>
                                    <h3 className="text-white font-bold mb-2 text-blue-400 flex items-center gap-2"><Wrench size={16}/> Update Remediation Plan</h3>
                                    <textarea className="w-full bg-black border border-gray-700 rounded p-2 text-white text-xs font-mono" rows={5} value={tempRemediation} onChange={e => setTempRemediation(e.target.value)} autoFocus placeholder="Enter remediation steps..." />
                                    <div className="flex justify-end gap-2 mt-4">
                                        <button onClick={() => setEditingRemediationId(null)} className="px-3 py-1 text-xs text-gray-400 hover:text-white">Cancel</button>
                                        <button onClick={() => { 
                                            const [aid, cid] = editingRemediationId.split(':'); 
                                            updateWorkflow(aid, cid, undefined, undefined, tempRemediation); 
                                            setEditingRemediationId(null); 
                                        }} className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-xs font-bold">Save Plan</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
