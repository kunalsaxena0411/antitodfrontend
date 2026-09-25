
import React, { useState, useEffect, useMemo } from 'react';
import { getMitreMatrix, MitreMatrix, MitreTechnique } from '../../services/mitre';
import { MalpediaActor, SocRule } from '../../types';
import { Layers, Loader2, Search, Filter, User, Briefcase, X, ExternalLink, Info, FileCode, Shield } from 'lucide-react';

interface MitreNavigatorViewProps {
    actors: MalpediaActor[];
    onNavigateToRule?: (ruleId: string) => void;
}

const COMMON_SECTORS = [
    'Finance', 'Energy', 'Healthcare', 'Government', 'Defense', 
    'Technology', 'Telecommunications', 'Aerospace', 'Retail', 'Education'
];

export const MitreNavigatorView: React.FC<MitreNavigatorViewProps> = ({ actors, onNavigateToRule }) => {
    const [matrix, setMatrix] = useState<MitreMatrix | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // SOC Rules State
    const [socRules, setSocRules] = useState<SocRule[]>([]);
    
    // Selection State
    const [selectedActorId, setSelectedActorId] = useState<string>('');
    const [selectedSector, setSelectedSector] = useState<string>('');
    const [activeTechnique, setActiveTechnique] = useState<MitreTechnique | null>(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                const data = await getMitreMatrix();
                setMatrix(data);
            } catch (e) {
                setError("Failed to load MITRE ATT&CK Framework. Please try again later.");
            } finally {
                setLoading(false);
            }
        };
        loadData();

        // Load Rules from Local Storage
        try {
            const savedRules = localStorage.getItem('xyberah_soc_rules');
            if (savedRules) {
                setSocRules(JSON.parse(savedRules));
            }
        } catch (e) {
            console.error("Failed to load SOC rules for Navigator", e);
        }
    }, []);

    // Derive Highlighted Techniques based on filters
    const highlightedTechniqueIds = useMemo(() => {
        const ids = new Set<string>();
        
        if (!selectedActorId && !selectedSector) return ids;

        actors.forEach(actor => {
            let matches = false;
            // Actor Filter
            if (selectedActorId && actor.uuid === selectedActorId) matches = true;
            
            // Sector Filter (Regex Match in description)
            if (selectedSector && !matches) {
                if (actor.description.toLowerCase().includes(selectedSector.toLowerCase())) {
                    matches = true;
                }
            }

            // If Actor matches criteria AND we are filtering by something
            if (matches) {
                actor.mitreIds?.forEach(tid => ids.add(tid));
            }
        });

        return ids;
    }, [actors, selectedActorId, selectedSector]);

    const sortedActors = useMemo(() => {
        return [...actors].sort((a, b) => a.value.localeCompare(b.value));
    }, [actors]);

    const relatedRules = useMemo(() => {
        if (!activeTechnique) return [];
        return socRules.filter(r => r.mitreAttack?.includes(activeTechnique.id));
    }, [socRules, activeTechnique]);

    if (loading) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-[#020617] text-gray-500 gap-4">
                <Loader2 className="animate-spin w-10 h-10 text-cyber-cyan"/>
                <p className="font-mono text-sm">Loading Enterprise Matrix...</p>
            </div>
        );
    }

    if (error || !matrix) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-[#020617] text-red-400 gap-4">
                <Layers className="w-12 h-12 opacity-50"/>
                <p className="font-mono text-sm">{error}</p>
                <button onClick={() => window.location.reload()} className="px-4 py-2 bg-gray-800 rounded hover:bg-gray-700 text-white">Retry</button>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-[#020617] relative overflow-hidden">
            {/* Toolbar */}
            <div className="bg-black/40 border-b border-gray-800 p-4 flex flex-wrap gap-4 items-center justify-between backdrop-blur-sm z-20">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-500/10 rounded-lg border border-orange-500/30 text-orange-500">
                        <Layers size={20}/>
                    </div>
                    <div>
                        <h2 className="text-white font-cyber font-bold text-lg leading-none">ATT&CK NAVIGATOR</h2>
                        <span className="text-[10px] text-gray-500 font-mono">Enterprise Matrix</span>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3">
                    {/* Actor Filter */}
                    <div className="relative group">
                        <div className="flex items-center bg-gray-900 border border-gray-700 rounded px-3 py-1.5">
                            <User size={14} className="text-gray-500 mr-2"/>
                            <select 
                                value={selectedActorId} 
                                onChange={(e) => { setSelectedActorId(e.target.value); setSelectedSector(''); }}
                                className="bg-transparent text-xs text-gray-300 focus:outline-none w-48"
                            >
                                <option value="">All Actors</option>
                                {sortedActors.map(a => (
                                    <option key={a.uuid} value={a.uuid}>{a.value}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Sector Filter */}
                    <div className="relative group">
                        <div className="flex items-center bg-gray-900 border border-gray-700 rounded px-3 py-1.5">
                            <Briefcase size={14} className="text-gray-500 mr-2"/>
                            <select 
                                value={selectedSector} 
                                onChange={(e) => { setSelectedSector(e.target.value); setSelectedActorId(''); }}
                                className="bg-transparent text-xs text-gray-300 focus:outline-none w-40"
                            >
                                <option value="">All Sectors</option>
                                {COMMON_SECTORS.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Reset */}
                    {(selectedActorId || selectedSector) && (
                        <button 
                            onClick={() => { setSelectedActorId(''); setSelectedSector(''); }}
                            className="text-xs text-red-400 hover:text-white flex items-center gap-1 px-2"
                        >
                            <X size={12}/> Reset
                        </button>
                    )}
                </div>
                
                <div className="flex items-center gap-4 text-[10px] text-gray-500 font-mono">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500/40 border border-red-500 rounded-sm"></div>
                        <span>Observed Technique</span>
                    </div>
                </div>
            </div>

            {/* Matrix Grid */}
            <div className="flex-1 overflow-auto custom-scrollbar bg-cyber-grid relative">
                <div className="flex min-w-max p-6 gap-1">
                    {matrix.tactics.map(tactic => (
                        <div key={tactic.slug} className="w-48 flex flex-col gap-1">
                            {/* Column Header */}
                            <div className="bg-gray-900 border border-gray-700 p-2 text-center mb-2 sticky top-0 z-10 shadow-lg">
                                <h3 className="text-[11px] font-bold text-white uppercase">{tactic.name}</h3>
                                <span className="text-[9px] text-gray-500">{matrix.techniques[tactic.slug]?.length || 0} techniques</span>
                            </div>
                            
                            {/* Techniques */}
                            {matrix.techniques[tactic.slug]?.map(tech => {
                                const isHighlighted = highlightedTechniqueIds.has(tech.id);
                                const isSelected = activeTechnique?.id === tech.id;
                                
                                return (
                                    <div 
                                        key={tech.id}
                                        onClick={() => setActiveTechnique(tech)}
                                        className={`
                                            p-2 text-[10px] border cursor-pointer transition-all duration-200 relative group
                                            ${isHighlighted 
                                                ? 'bg-red-900/40 border-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.1)]' 
                                                : isSelected 
                                                    ? 'bg-cyber-cyan/20 border-cyber-cyan text-white'
                                                    : 'bg-gray-900/40 border-gray-800 text-gray-400 hover:bg-gray-800 hover:border-gray-600 hover:text-gray-200'
                                            }
                                        `}
                                    >
                                        <div className="font-bold mb-0.5 flex justify-between">
                                            <span className="truncate" title={tech.name}>{tech.name}</span>
                                            {isHighlighted && <div className="w-1.5 h-1.5 bg-red-500 rounded-full shadow-[0_0_5px_#ef4444]"></div>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* Detail Panel (Overlay) */}
            {activeTechnique && (
                <div className="absolute right-0 top-[65px] bottom-0 w-96 bg-black/95 border-l border-gray-800 backdrop-blur-xl shadow-2xl animate-fade-in flex flex-col z-30">
                    <div className="p-4 border-b border-gray-800 flex justify-between items-start bg-gray-900/50">
                        <div>
                            <span className="text-[10px] font-mono text-cyber-cyan bg-cyber-cyan/10 px-2 py-0.5 rounded border border-cyber-cyan/30 mb-2 inline-block">
                                {activeTechnique.id}
                            </span>
                            <h3 className="text-lg font-bold text-white">{activeTechnique.name}</h3>
                        </div>
                        <button onClick={() => setActiveTechnique(null)} className="text-gray-500 hover:text-white"><X size={20}/></button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6 text-sm">
                        <div>
                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Description</h4>
                            <p className="text-gray-300 leading-relaxed text-xs">{activeTechnique.description}</p>
                        </div>

                        {/* SOC Rules Integration - Prominently Displayed */}
                        <div className="bg-cyber-cyan/5 border border-cyber-cyan/20 rounded p-3">
                            <h4 className="text-xs font-bold text-cyber-cyan uppercase mb-3 flex items-center gap-2">
                                <FileCode size={14}/> Relevant SOC Rules
                            </h4>
                            {relatedRules.length > 0 ? (
                                <div className="flex flex-col gap-2">
                                    {relatedRules.map(rule => (
                                        <button 
                                            key={rule.id}
                                            onClick={() => onNavigateToRule?.(rule.id)}
                                            className="text-left p-2 rounded bg-black/40 border border-cyber-cyan/30 hover:bg-cyber-cyan/10 hover:border-cyber-cyan transition-all group flex items-center justify-between"
                                        >
                                            <div>
                                                <div className="text-xs font-bold text-white group-hover:text-cyber-cyan truncate">{rule.name}</div>
                                                <div className="text-[9px] text-gray-500 font-mono mt-0.5">{rule.type}</div>
                                            </div>
                                            <ExternalLink size={12} className="text-gray-600 group-hover:text-cyber-cyan"/>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-xs text-gray-500 italic text-center py-2">
                                    No internal rules found for {activeTechnique.id}.
                                </div>
                            )}
                        </div>

                        <div>
                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 pt-4 border-t border-gray-800">Metadata</h4>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-gray-900 p-2 rounded border border-gray-800">
                                    <div className="text-[9px] text-gray-500">Platforms</div>
                                    <div className="text-xs text-white">{activeTechnique.platforms.join(', ')}</div>
                                </div>
                                <div className="bg-gray-900 p-2 rounded border border-gray-800">
                                    <div className="text-[9px] text-gray-500">Tactics</div>
                                    <div className="text-xs text-white">{activeTechnique.tactics.join(', ')}</div>
                                </div>
                            </div>
                        </div>

                        {activeTechnique.url && (
                            <a 
                                href={activeTechnique.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 w-full py-2 bg-gray-800 hover:bg-gray-700 text-white rounded border border-gray-600 text-xs font-bold transition-colors"
                            >
                                View on MITRE ATT&CK <ExternalLink size={12}/>
                            </a>
                        )}

                        {/* Associated Actors from Local Data */}
                        {actors.length > 0 && (
                            <div>
                                <h4 className="text-xs font-bold text-orange-400 uppercase mb-2 pt-4 border-t border-gray-800 flex items-center gap-2">
                                    <Shield size={12}/> Observed Actors ({actors.filter(a => a.mitreIds?.includes(activeTechnique.id)).length})
                                </h4>
                                <div className="flex flex-wrap gap-1.5">
                                    {actors.filter(a => a.mitreIds?.includes(activeTechnique.id)).map(actor => (
                                        <div key={actor.uuid} className="px-2 py-1 bg-orange-900/20 border border-orange-500/30 text-orange-300 rounded text-xs">
                                            {actor.value}
                                        </div>
                                    ))}
                                    {actors.filter(a => a.mitreIds?.includes(activeTechnique.id)).length === 0 && (
                                        <span className="text-gray-600 italic text-xs">No loaded actors utilize this technique.</span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
