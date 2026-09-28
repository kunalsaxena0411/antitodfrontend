import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Search, Plus, Trash2, Globe, Box, Loader2, RefreshCw, Radar, 
    FileText, Hash, Server, Link, Mail, Briefcase, Clock, 
    MessageSquare, Upload, ChevronLeft, Calendar, User,
    X, FileJson, 
    ArrowRight, CheckSquare, Zap, Activity,
    ChevronDown, Shield, FileUp, Edit2, Check, ArrowUpDown,
    Layers, MousePointer2, FileOutput, XCircle, ToggleLeft, ToggleRight
} from 'lucide-react';
import { 
    FeodoTrackerEntry, UrlHausEntry, MalwareBazaarEntry, 
    ThreatFoxEntry, MaliciousHashEntry, CaseArtifact 
} from '../../types';
import { checkRBL, checkDomainSecurity, resolveHostname } from '../../services/dns';
import { fetchOtxIndicator } from '../../services/otx';
import { enrichVtIp, enrichVtDomain, enrichVtHash } from '../../services/virustotal';
import { downloadFile } from '../../services/exporter';
import { extractIocsFromText, extractIocsFromFile, ExtractedArtifact } from '../../services/iocExtractor';
import { mmdbService } from '../../services/mmdb';
import { calculateFileHash, submitFileToSandbox } from '../../services/otxSandbox';
// Fixed Error: performRdapLookup was used but not imported
import { performRdapLookup } from '../../services/netTools';
import { IPDATA_API_KEY } from '../../config/config';
import PageHeader from '../../src/components/layout/PageHeader';

interface CaseNote {
    id: string;
    text: string;
    author: string;
    timestamp: string;
    type: 'NOTE' | 'FINDING';
}

interface InvestigationCase {
    id: string;
    title: string;
    description: string;
    status: 'OPEN' | 'IN_PROGRESS' | 'ON_HOLD' | 'CLOSED' | 'ARCHIVED';
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    created: string;
    updated: string;
    artifacts: CaseArtifact[];
    notes: CaseNote[];
}

const ARTIFACT_ICONS: Record<string, any> = {
    'IP': Server,
    'DOMAIN': Globe,
    'URL': Link,
    'FILE': FileText,
    'HASH': Hash,
    'EMAIL': Mail,
    'TEXT': FileText
};

interface InvestigationBenchViewProps {
    threatFoxItems: ThreatFoxEntry[];
    urlHausItems: UrlHausEntry[];
    malwareBazaarItems: MalwareBazaarEntry[];
    feodoItems: FeodoTrackerEntry[];
    maliciousHashItems: MaliciousHashEntry[];
}

export const InvestigationBenchView: React.FC<InvestigationBenchViewProps> = ({
    threatFoxItems,
    urlHausItems,
    malwareBazaarItems,
    feodoItems,
    maliciousHashItems
}) => {
    const [viewMode, setViewMode] = useState<'CASE_LIST' | 'WORKBENCH'>(() => {
        return (localStorage.getItem('xyberah_bench_view_mode') as any) || 'CASE_LIST';
    });
    const [activeTab, setActiveTab] = useState<'ARTIFACTS' | 'TIMELINE' | 'COLLAB'>(() => {
        return (localStorage.getItem('xyberah_bench_active_tab') as any) || 'ARTIFACTS';
    });
    
    const [cases, setCases] = useState<InvestigationCase[]>(() => {
        try {
            const saved = localStorage.getItem('xyberah_cases');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });
    
    const [activeCaseId, setActiveCaseId] = useState<string | null>(() => {
        return localStorage.getItem('xyberah_bench_active_case_id') || null;
    });
    const [enrichingArtifacts, setEnrichingArtifacts] = useState<Set<string>>(new Set());
    
    const [artifactSearch, setArtifactSearch] = useState('');
    const [newArtifactType, setNewArtifactType] = useState<'IP'|'DOMAIN'|'URL'|'FILE'|'HASH'|'EMAIL'|'TEXT'>('IP');
    const [newArtifactVal, setNewArtifactVal] = useState('');
    const [selectedArtifact, setSelectedArtifact] = useState<CaseArtifact | null>(null);
    const [newNote, setNewNote] = useState('');
    
    const [selectedArtifactIds, setSelectedArtifactIds] = useState<Set<string>>(new Set());
    const [sortConfig, setSortConfig] = useState<{ key: 'value' | 'type' | 'risk' | 'addedAt', direction: 'asc' | 'desc' }>({ key: 'addedAt', direction: 'desc' });
    
    const [showBulkImport, setShowBulkImport] = useState(false);
    const [bulkInputText, setBulkInputText] = useState('');
    const [bulkPreview, setBulkPreview] = useState<ExtractedArtifact[]>([]);
    const [isProcessingBulk, setIsProcessingBulk] = useState(false);
    const [selectedBulkIndices, setSelectedBulkIndices] = useState<Set<number>>(new Set());
    
    // Sample Upload States
    const [isUploadingSample, setIsUploadingSample] = useState(false);
    const [autoSandbox, setAutoSandbox] = useState(true);
    
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const fileInputRef = useRef<HTMLInputElement>(null);
    const sampleInputRef = useRef<HTMLInputElement>(null);
    const [newCaseTitle, setNewCaseTitle] = useState('');
    const [showNewCaseModal, setShowNewCaseModal] = useState(false);

    useEffect(() => {
        localStorage.setItem('xyberah_cases', JSON.stringify(cases));
    }, [cases]);

    useEffect(() => {
        localStorage.setItem('xyberah_bench_view_mode', viewMode);
        localStorage.setItem('xyberah_bench_active_tab', activeTab);
        if (activeCaseId) {
            localStorage.setItem('xyberah_bench_active_case_id', activeCaseId);
        } else {
            localStorage.removeItem('xyberah_bench_active_case_id');
        }
        setSelectedArtifactIds(new Set());
    }, [viewMode, activeTab, activeCaseId]);

    const activeCase = useMemo(() => cases.find(c => c.id === activeCaseId), [cases, activeCaseId]);

    const timelineGroups = useMemo(() => {
        if (!activeCase) return [];
        const allItems = [
            ...activeCase.artifacts.map(a => ({ ...a, kind: 'ARTIFACT', timestamp: a.addedAt })),
            ...activeCase.notes.map(n => ({ ...n, kind: 'NOTE', timestamp: n.timestamp }))
        ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        const groups: { id: string, type: 'SINGLE' | 'BULK' | 'NOTE', items: any[], timestamp: string }[] = [];
        let currentBatch: any[] = [];
        
        allItems.forEach((item) => {
            if (item.kind === 'NOTE') {
                if (currentBatch.length > 0) {
                    groups.push({
                        id: `batch-${groups.length}-${currentBatch[0].id}`,
                        type: currentBatch.length > 1 ? 'BULK' : 'SINGLE',
                        items: [...currentBatch],
                        timestamp: currentBatch[0].timestamp
                    });
                    currentBatch = [];
                }
                groups.push({ id: `note-${item.id}`, type: 'NOTE', items: [item], timestamp: item.timestamp });
            } else {
                const prev = currentBatch.length > 0 ? currentBatch[currentBatch.length - 1] : null;
                if (!prev || (new Date(prev.timestamp).getTime() - new Date(item.timestamp).getTime() < 60000)) {
                    currentBatch.push(item);
                } else {
                    groups.push({ id: `batch-${groups.length}-${currentBatch[0].id}`, type: currentBatch.length > 1 ? 'BULK' : 'SINGLE', items: [...currentBatch], timestamp: currentBatch[0].timestamp });
                    currentBatch = [item];
                }
            }
        });

        if (currentBatch.length > 0) {
            groups.push({ id: `batch-${groups.length}-${currentBatch[0].id}`, type: currentBatch.length > 1 ? 'BULK' : 'SINGLE', items: [...currentBatch], timestamp: currentBatch[0].timestamp });
        }
        return groups;
    }, [activeCase]);

    const toggleTimelineGroup = (groupId: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupId)) next.delete(groupId);
            else next.add(groupId);
            return next;
        });
    };

    const handleCreateCase = () => {
        if (!newCaseTitle.trim()) return;
        const newCase: InvestigationCase = {
            id: crypto.randomUUID(),
            title: newCaseTitle,
            description: 'New Investigation',
            status: 'OPEN',
            priority: 'MEDIUM',
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            artifacts: [],
            notes: []
        };
        setCases(prev => [newCase, ...prev]);
        setNewCaseTitle('');
        setShowNewCaseModal(false);
        setActiveCaseId(newCase.id);
        setViewMode('WORKBENCH');
    };

    const handleDeleteCase = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm("Are you sure you want to delete this case?")) {
            setCases(prev => prev.filter(c => c.id !== id));
            if (activeCaseId === id) {
                setActiveCaseId(null);
                setViewMode('CASE_LIST');
            }
        }
    };

    const updateActiveCase = (updater: (c: InvestigationCase) => InvestigationCase) => {
        if (!activeCaseId) return;
        setCases(prev => prev.map(c => c.id === activeCaseId ? updater(c) : c));
    };

    const fetchSpecificIpData = async (ip: string) => {
        if (!IPDATA_API_KEY) return null;
        try {
            const res = await fetch(`https://api.ipdata.co/${ip}?api-key=${IPDATA_API_KEY}`);
            if (res.ok) return await res.json();
        } catch (e) { console.error("IPData fetch error", e); }
        return null;
    };

    /**
     * Enhanced Enrichment Engine
     * Maximizes parallel execution for speed.
     */
    const handleEnrichArtifact = async (artId: string, artifactObj?: CaseArtifact, forceDeep = false) => {
        if (!activeCase) return;
        const art = artifactObj || activeCase.artifacts.find(a => a.id === artId);
        if (!art) return;

        // Skip if already in-flight
        if (enrichingArtifacts.has(artId)) return;
        setEnrichingArtifacts(prev => new Set(prev).add(artId));

        try {
            let enrichment: any = { ...art.enrichmentData };
            let riskScore = enrichment.risk?.score || 0;
            let tags = new Set<string>((enrichment.tags as string[]) || []);

            // --- PHASE 1: LOCAL SYNCHRONOUS ENRICHMENT (Instant) ---
            if (art.type === 'IP' || art.type === 'IP:PORT') {
                const ip = art.value.split(':')[0];
                const mmdb = mmdbService.lookup(ip);
                if (mmdb) {
                    enrichment.geo = {
                        country_code: mmdb.country_code,
                        country_name: mmdb.country_name,
                        city: mmdb.city,
                        asn: mmdb.asn
                    };
                }
                const feodoMatch = feodoItems.find(f => f.ip_address === ip);
                if (feodoMatch) {
                    riskScore = Math.max(riskScore, 100);
                    tags.add('Botnet (Feodo)');
                    enrichment.feodo = true;
                }
            }

            if (art.type === 'URL' || art.type === 'DOMAIN') {
                const domain = art.type === 'URL' ? new URL(art.value).hostname : art.value;
                const urlHausMatch = urlHausItems.find(u => u.url.includes(domain));
                if (urlHausMatch) {
                    riskScore = Math.max(riskScore, 100);
                    tags.add(`URLHaus (${urlHausMatch.threat})`);
                }
            }

            if (art.type === 'HASH' || art.type === 'FILE') {
                const bazaarMatch = malwareBazaarItems.find(m => m.sha256_hash === art.value || m.md5_hash === art.value);
                if (bazaarMatch) {
                    riskScore = Math.max(riskScore, 100);
                    tags.add(`MalwareBazaar: ${bazaarMatch.signature}`);
                }
                const threatFoxMatch = threatFoxItems.find(t => t.ioc_value === art.value);
                if (threatFoxMatch) {
                    riskScore = Math.max(riskScore, 100);
                    tags.add(`ThreatFox: ${threatFoxMatch.malware_printable}`);
                }
            }

            // Update UI with local findings immediately before firing off network requests
            const initialTags = Array.from(tags);
            updateActiveCase(c => ({
                ...c,
                artifacts: c.artifacts.map(a => a.id === artId ? { 
                    ...a, 
                    enrichmentData: { ...enrichment, tags: initialTags },
                    tags: initialTags
                } : a)
            }));

            // --- PHASE 2: PARALLEL REMOTE ENRICHMENT (Network Latency) ---
            const remoteTasks: Promise<any>[] = [];

            if (art.type === 'IP') {
                const ip = art.value.split(':')[0];
                remoteTasks.push(checkRBL(ip).then(r => ({ type: 'RBL', data: r })));
                remoteTasks.push(resolveHostname(ip).then(h => ({ type: 'PTR', data: h })));
                remoteTasks.push(fetchSpecificIpData(ip).then(d => ({ type: 'IPDATA', data: d })));
            } else if (art.type === 'DOMAIN' || art.type === 'URL') {
                const domain = art.type === 'URL' ? new URL(art.value).hostname : art.value;
                remoteTasks.push(checkDomainSecurity(domain).then(s => ({ type: 'DOMSEC', data: s })));
                remoteTasks.push(performRdapLookup(domain, 'DOMAIN').then(w => ({ type: 'WHOIS', data: w })));
            }

            if (forceDeep) {
                remoteTasks.push(fetchOtxIndicator(art.value).then(o => ({ type: 'OTX', data: o })));
            }

            const results = await Promise.allSettled(remoteTasks);

            // Process Parallel Results
            results.forEach(res => {
                if (res.status === 'fulfilled' && res.value) {
                    const { type, data } = res.value;
                    if (type === 'RBL' && data.status === 'LISTED') {
                        riskScore += 20;
                        tags.add('RBL Listed');
                        enrichment.rbl = true;
                    }
                    if (type === 'PTR') enrichment.ptr = data;
                    if (type === 'IPDATA' && data) {
                        enrichment.geo = data;
                        if (data.threat.is_known_attacker) { riskScore += 50; tags.add('Known Attacker'); }
                        if (data.threat.is_tor) { riskScore += 20; tags.add('TOR Node'); }
                    }
                    if (type === 'DOMSEC' && data) {
                        const blocked = data.filter((s:any) => s.status === 'BLOCKED');
                        if (blocked.length > 0) {
                            riskScore += 40;
                            tags.add('DNS Firewall Block');
                            enrichment.dnsSec = blocked;
                        }
                    }
                    if (type === 'OTX' && data) {
                        if (data.pulse_count > 0) {
                            riskScore = Math.max(riskScore, Math.min(100, data.pulse_count * 10));
                            tags.add(`OTX:${data.pulse_count}`);
                        }
                        enrichment.otx = data;
                    }
                }
            });

            // Final Update with full telemetry
            enrichment.risk = {
                score: Math.min(100, riskScore),
                level: riskScore >= 80 ? 'CRITICAL' : riskScore >= 50 ? 'HIGH' : riskScore >= 20 ? 'MEDIUM' : 'LOW'
            };
            const finalTags = Array.from(tags);
            enrichment.tags = finalTags;

            updateActiveCase(c => ({
                ...c,
                artifacts: c.artifacts.map(a => a.id === artId ? { 
                    ...a, 
                    enrichmentData: enrichment,
                    tags: finalTags
                } : a)
            }));

        } catch (e) {
            console.error("Enrichment error", e);
        } finally {
            setEnrichingArtifacts(prev => {
                const next = new Set(prev);
                next.delete(artId);
                return next;
            });
        }
    };

    const handleBulkEnrich = async () => {
        if (selectedArtifactIds.size === 0 || !activeCase) return;
        const selected = activeCase.artifacts.filter(a => selectedArtifactIds.has(a.id));
        
        // Use a batch limit to avoid browser/network congestion (limit to 5 concurrent deep scans)
        const batchSize = 5;
        for (let i = 0; i < selected.length; i += batchSize) {
            const batch = selected.slice(i, i + batchSize);
            await Promise.all(batch.map(art => handleEnrichArtifact(art.id, art, true)));
        }
        setSelectedArtifactIds(new Set());
    };
    
    const handleAlienVaultEnrich = async (art: CaseArtifact) => {
        setEnrichingArtifacts(prev => new Set(prev).add(art.id));
        try {
            const otx = await fetchOtxIndicator(art.value);
            if (otx) {
                const currentTags = new Set<string>((art.enrichmentData?.tags as string[]) || []);
                if (otx.pulse_count > 0) currentTags.add(`OTX:${otx.pulse_count}`);
                if (otx.malware_families && otx.malware_families.length > 0) {
                    otx.malware_families.forEach(f => currentTags.add(f));
                }
                const updatedTags = Array.from(currentTags);
                updateActiveCase(c => ({
                    ...c,
                    artifacts: c.artifacts.map(a => a.id === art.id ? { 
                        ...a, 
                        enrichmentData: { ...a.enrichmentData, otx, tags: updatedTags },
                        tags: updatedTags
                    } : a)
                }));
            }
        } finally {
            setEnrichingArtifacts(prev => { const n = new Set(prev); n.delete(art.id); return n; });
        }
    };

    const handleVirusTotalEnrich = async (art: CaseArtifact) => {
         setEnrichingArtifacts(prev => new Set(prev).add(art.id));
         try {
             let vt = null;
             if (art.type === 'IP') vt = await enrichVtIp(art.value);
             else if (art.type === 'DOMAIN') vt = await enrichVtDomain(art.value);
             else if (art.type === 'HASH' || art.type === 'FILE') vt = await enrichVtHash(art.value);
             
             if (vt && vt.data.attributes) {
                 const stats = vt.data.attributes.last_analysis_stats;
                 const currentTags = new Set<string>((art.enrichmentData?.tags as string[]) || []);
                 if (stats.malicious > 0) {
                     currentTags.add(`VT:${stats.malicious}/${stats.malicious+stats.undetected}`);
                 }
                 const updatedTags = Array.from(currentTags);
                 updateActiveCase(c => ({
                     ...c,
                     artifacts: c.artifacts.map(a => a.id === art.id ? { 
                         ...a, 
                         enrichmentData: { ...a.enrichmentData, vt: vt.data.attributes, tags: updatedTags },
                         tags: updatedTags
                     } : a)
                 }));
             }
         } finally {
             setEnrichingArtifacts(prev => { const n = new Set(prev); n.delete(art.id); return n; });
         }
    };

    const handleAddArtifact = () => {
        if (!newArtifactVal.trim()) return;
        let typeToUse = newArtifactType;
        const val = newArtifactVal.trim();
        
        if (activeCase?.artifacts.some(a => a.value === val)) {
            setNewArtifactVal('');
            return;
        }

        if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(val)) typeToUse = 'IP';
        else if (/^[a-fA-F0-9]{32}$/.test(val) || /^[a-fA-F0-9]{40}$/.test(val) || /^[a-fA-F0-9]{64}$/.test(val)) typeToUse = 'HASH';
        else if (val.includes('@') && !val.includes('/')) typeToUse = 'EMAIL';
        else if (val.startsWith('http') || val.includes('://')) typeToUse = 'URL';
        else if (val.includes('.') && !val.includes(' ') && val.length > 3) typeToUse = 'DOMAIN';

        const newArt: CaseArtifact = { id: crypto.randomUUID(), type: typeToUse, value: val, addedAt: new Date().toISOString(), enrichmentData: { risk: { score: 0, level: 'LOW' } } };
        updateActiveCase(c => ({ ...c, artifacts: [newArt, ...c.artifacts], updated: new Date().toISOString() }));
        setNewArtifactVal('');
        handleEnrichArtifact(newArt.id, newArt);
    };

    const handleSampleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setIsUploadingSample(true);
            try {
                const hash = await calculateFileHash(file);
                if (activeCase?.artifacts.some(a => a.value === hash)) {
                    setIsUploadingSample(false);
                    return;
                }

                const tags = ['Sample Uploaded'];
                if (autoSandbox) tags.push('Sandbox Queued');
                else tags.push('Static Analysis Only');

                const newArt: CaseArtifact = { 
                    id: crypto.randomUUID(), 
                    type: 'HASH', 
                    value: hash, 
                    note: `Sample: ${file.name} (${(file.size/1024).toFixed(1)} KB)`, 
                    addedAt: new Date().toISOString(), 
                    enrichmentData: { 
                        risk: { score: 0, level: 'UNKNOWN' }, 
                        tags: tags,
                        fileName: file.name,
                        fileSize: file.size,
                        fileType: file.type
                    },
                    tags: tags
                };

                updateActiveCase(c => ({ ...c, artifacts: [newArt, ...c.artifacts], updated: new Date().toISOString() }));
                
                if (autoSandbox) {
                    submitFileToSandbox(file)
                        .then(() => handleEnrichArtifact(newArt.id, newArt, true))
                        .catch(err => {
                            const failedTags = ['Sample Uploaded', 'Sandbox Failed'];
                            updateActiveCase(c => ({ 
                                ...c, 
                                artifacts: c.artifacts.map(a => a.id === newArt.id ? { ...a, tags: failedTags, enrichmentData: { ...a.enrichmentData, tags: failedTags } } : a) 
                            }));
                        });
                } else {
                    handleEnrichArtifact(newArt.id, newArt, false);
                }
            } catch(e) { 
                console.error("File processing failed", e); 
            } finally {
                setIsUploadingSample(false);
                if(sampleInputRef.current) sampleInputRef.current.value = '';
            }
        }
    };

    const handleBulkProcess = () => {
        if (!bulkInputText.trim()) return;
        setIsProcessingBulk(true);
        setSelectedBulkIndices(new Set()); 
        setTimeout(() => {
            const results = extractIocsFromText(bulkInputText);
            setBulkPreview(results);
            setIsProcessingBulk(false);
        }, 100);
    };

    const processFileForBulk = async (file: File) => {
        setIsProcessingBulk(true);
        setSelectedBulkIndices(new Set()); 
        try {
            const results = await extractIocsFromFile(file);
            setBulkPreview(prev => [...prev, ...results]);
        } catch (error) { console.error("Bulk file extraction failed", error); } finally {
            setIsProcessingBulk(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleBulkFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) processFileForBulk(e.target.files[0]); };

    const handleCommitImport = () => {
        if (bulkPreview.length === 0) return;
        const timestamp = new Date().toISOString();
        const existingValues = new Set(activeCase?.artifacts.map(a => a.value) || []);
        const newItems = bulkPreview.filter(item => !existingValues.has(item.value));

        if (newItems.length === 0) {
            setBulkPreview([]); setBulkInputText(''); setShowBulkImport(false);
            return;
        }

        const newArtifacts: CaseArtifact[] = newItems.map(item => ({ id: crypto.randomUUID(), type: item.type as any, value: item.value, addedAt: timestamp, enrichmentData: {} }));
        updateActiveCase(c => ({ ...c, artifacts: [...newArtifacts, ...c.artifacts], updated: timestamp }));
        newArtifacts.slice(0, 5).forEach(a => handleEnrichArtifact(a.id, a));
        setBulkPreview([]); setBulkInputText(''); setShowBulkImport(false);
    };

    const handleRemovePreviewItem = (index: number) => { 
        setBulkPreview(prev => prev.filter((_, i) => i !== index)); 
    };

    const handleDeleteArtifact = (id: string) => {
        updateActiveCase(c => ({ ...c, artifacts: c.artifacts.filter(a => a.id !== id) }));
        if (selectedArtifact?.id === id) setSelectedArtifact(null);
    };

    const handleExportCase = (format: 'JSON' | 'CSV') => {
        if (!activeCase) return;
        if (format === 'JSON') downloadFile(JSON.stringify(activeCase, null, 2), `case_${activeCase.id}.json`, 'application/json');
        else {
            const headers = "Type,Value,AddedAt,RiskLevel,RiskScore,Notes\n";
            const rows = activeCase.artifacts.map(a => `${a.type},${a.value},${a.addedAt},${a.enrichmentData?.risk?.level || 'UNKNOWN'},${a.enrichmentData?.risk?.score || 0},"${a.note || ''}"`).join('\n');
            const notes = "\n\n--- NOTES ---\n" + activeCase.notes.map(n => `[${n.timestamp}] ${n.author}: ${n.text}`).join('\n');
            downloadFile(headers + rows + notes, `case_${activeCase.id}.csv`, 'text/plain');
        }
    };

    const getRiskColor = (level: string) => {
        switch(level?.toUpperCase()) {
            case 'CRITICAL': return 'text-red-500 border-red-500/50 bg-red-900/20';
            case 'HIGH': return 'text-white border-neutral-500/50 bg-neutral-900/20';
            case 'MEDIUM': return 'text-white border-neutral-500/50 bg-neutral-900/20';
            case 'LOW': return 'text-white border-neutral-500/50 bg-neutral-900/20';
            default: return 'text-[#888] border-neutral-600 bg-[#151515]';
        }
    };

    const handleAddNote = () => {
        if (!newNote.trim()) return;
        const note: CaseNote = { id: crypto.randomUUID(), text: newNote.trim(), author: 'Analyst', timestamp: new Date().toISOString(), type: 'NOTE' };
        updateActiveCase(c => ({ ...c, notes: [...c.notes, note], updated: new Date().toISOString() }));
        setNewNote('');
    };

    const filteredArtifacts = useMemo(() => {
        if (!activeCase) return [];
        let result = activeCase.artifacts.filter(a => {
             const term = artifactSearch.toLowerCase();
             const valueMatch = a.value.toLowerCase().includes(term);
             const typeMatch = a.type.toLowerCase().includes(term);
             const topTagsMatch = a.tags?.some(t => t.toLowerCase().includes(term));
             const enrTagsMatch = a.enrichmentData?.tags?.some((t: string) => t.toLowerCase().includes(term));
             return valueMatch || typeMatch || topTagsMatch || enrTagsMatch;
        }) || [];

        return result.sort((a, b) => {
            const dir = sortConfig.direction === 'asc' ? 1 : -1;
            switch(sortConfig.key) {
                case 'value': return a.value.localeCompare(b.value) * dir;
                case 'type': return a.type.localeCompare(b.type) * dir;
                case 'risk': 
                    const scoreA = a.enrichmentData?.risk?.score || 0;
                    const scoreB = b.enrichmentData?.risk?.score || 0;
                    return (scoreA - scoreB) * dir;
                case 'addedAt': 
                default: return (new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime()) * dir;
            }
        });
    }, [activeCase, artifactSearch, sortConfig]);
    
    const handleSort = (key: 'value' | 'type' | 'risk' | 'addedAt') => { setSortConfig(current => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' })); };
    const toggleArtifactSelection = (id: string) => { setSelectedArtifactIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };
    const toggleSelectAllArtifacts = () => {
        if (filteredArtifacts.length === 0) return;
        const allIds = filteredArtifacts.map(a => a.id);
        const areAllSelected = allIds.every(id => selectedArtifactIds.has(id));
        setSelectedArtifactIds(prev => { const next = new Set(prev); if (areAllSelected) allIds.forEach(id => next.delete(id)); else allIds.forEach(id => next.add(id)); return next; });
    };

    const handleBulkDeleteArtifacts = () => {
        if (selectedArtifactIds.size === 0) return;
        if (confirm(`Are you sure you want to delete ${selectedArtifactIds.size} artifacts?`)) {
            updateActiveCase(c => ({ ...c, artifacts: c.artifacts.filter(a => !selectedArtifactIds.has(a.id)), updated: new Date().toISOString() }));
            setSelectedArtifactIds(new Set());
            if (selectedArtifact && selectedArtifactIds.has(selectedArtifact.id)) setSelectedArtifact(null);
        }
    };

    const handleBulkExportArtifacts = () => {
        if (selectedArtifactIds.size === 0) return;
        const selected = activeCase?.artifacts.filter(a => selectedArtifactIds.has(a.id)) || [];
        const content = selected.map(a => a.value).join('\n');
        downloadFile(content, `extracted_iocs_${Date.now()}.txt`, 'text/plain');
    };

    if (viewMode === 'CASE_LIST') {
        return (
            <div className="flex flex-col flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                <PageHeader
                    breadcrumbs={[{ label: 'Operations' }, { label: 'Investigation Bench' }]}
                    title="Case Management"
                    description="Active Investigations & Incident Response"
                    actions={
                        <button onClick={() => setShowNewCaseModal(true)} className="at-btn at-btn-primary">
                            <Plus size={14}/> NEW CASE
                        </button>
                    }
                />
                <div className="max-w-5xl mx-auto w-full p-6">
                    {showNewCaseModal && (
                        <div className="mb-8 bg-[#0A0A0A] border border-[#333] rounded-lg p-6 animate-fade-in">
                            <h3 className="text-white font-bold mb-4">Create New Investigation</h3>
                            <div className="flex gap-4">
                                <input type="text" placeholder="Case Title / Incident ID..." className="flex-1 bg-black border border-[#333] rounded-lg px-4 py-2 text-white focus:border-neutral-500 outline-none" value={newCaseTitle} onChange={e => setNewCaseTitle(e.target.value)} autoFocus onKeyDown={e => e.key === 'Enter' && handleCreateCase()} />
                                <button onClick={handleCreateCase} className="bg-neutral-600 px-6 py-2 rounded-lg text-white font-bold text-sm">CREATE</button>
                                <button onClick={() => setShowNewCaseModal(false)} className="bg-[#151515] px-4 py-2 rounded-lg text-neutral-300 font-bold text-sm">CANCEL</button>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {cases.map(c => (
                            <div key={c.id} onClick={() => { setActiveCaseId(c.id); setViewMode('WORKBENCH'); }} className="bg-[#111] border border-[#222] rounded-xl p-6 hover:border-neutral-500/50 hover:bg-[#111] transition-all cursor-pointer group relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={(e) => handleDeleteCase(c.id, e)} className="text-neutral-600 hover:text-red-400 p-2"><Trash2 size={16}/></button></div>
                                <div className="flex justify-between items-start mb-4"><div className="p-3 bg-neutral-900/20 rounded-lg border border-neutral-500/30 text-red-400"><Briefcase size={24}/></div><span className={`text-[10px] font-bold px-2 py-1 rounded border ${c.priority === 'CRITICAL' ? 'bg-red-900/20 text-red-400 border-red-500/30' : 'bg-[#111] text-red-400 border-neutral-500/30'}`}>{c.priority}</span></div>
                                <h3 className="text-lg font-bold text-white mb-2 truncate pr-6">{c.title}</h3>
                                <div className="flex justify-between items-center mb-4"><p className="text-xs text-[#888] font-mono">Created: {new Date(c.created).toLocaleDateString()}</p><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${c.status === 'OPEN' ? 'text-white border-neutral-500/30 bg-neutral-900/10' : c.status === 'IN_PROGRESS' ? 'text-red-400 border-neutral-500/30 bg-[#111]' : c.status === 'ON_HOLD' ? 'text-white border-neutral-500/30 bg-neutral-900/10' : c.status === 'CLOSED' ? 'text-[#AAA] border-neutral-600 bg-[#151515]' : 'text-red-400 border-neutral-500/30 bg-neutral-900/10'}`}>{c.status.replace('_', ' ')}</span></div>
                                <div className="flex items-center gap-4 text-xs text-[#AAA] border-t border-[#222] pt-4"><span className="flex items-center gap-1"><FileText size={12}/> {c.artifacts.length} Artifacts</span><span className="flex items-center gap-1"><MessageSquare size={12}/> {c.notes.length} Notes</span></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col flex-1 min-h-0 relative overflow-hidden">
             {selectedArtifact && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end animate-fade-in">
                    <div className="w-full max-w-xl bg-[#111] border-l border-[#222] h-full shadow-2xl flex flex-col animate-slide-in-right">
                        <div className="p-4 border-b border-[#222] flex justify-between items-start bg-black/40">
                             <div><div className="flex items-center gap-2 mb-1">{React.createElement(ARTIFACT_ICONS[selectedArtifact.type] || Box, { size: 16, className: 'text-red-500' })}<span className="text-xs font-bold text-[#888] uppercase">{selectedArtifact.type}</span></div><h3 className="text-xl font-mono font-bold text-white break-all">{selectedArtifact.value}</h3><div className="text-xs text-[#888] mt-1">Added: {new Date(selectedArtifact.addedAt).toLocaleString()}</div></div>
                             <button onClick={() => setSelectedArtifact(null)} className="text-[#888] hover:text-white"><X size={20}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4"><div className="bg-black/40 border border-[#222] rounded p-4 text-center"><div className="text-[10px] text-[#888] uppercase font-bold mb-1">Risk Score</div><div className={`text-3xl font-cyber font-bold ${getRiskColor(selectedArtifact.enrichmentData?.risk?.level || 'LOW').split(' ')[0]}`}>{selectedArtifact.enrichmentData?.risk?.score || 0}/100</div><div className="text-xs text-[#AAA] mt-1">{selectedArtifact.enrichmentData?.risk?.level || 'UNKNOWN'}</div></div><div className="bg-black/40 border border-[#222] rounded p-4 flex flex-col justify-center gap-2"><button onClick={() => handleAlienVaultEnrich(selectedArtifact)} className="w-full py-1.5 bg-neutral-900/20 hover:bg-neutral-900/40 text-white border border-neutral-500/30 rounded text-xs font-bold flex items-center justify-center gap-2 transition-colors"><Radar size={12}/> OTX ENRICH</button><button onClick={() => handleVirusTotalEnrich(selectedArtifact)} className="w-full py-1.5 bg-[#111] hover:bg-[#111] text-red-400 border border-neutral-500/30 rounded text-xs font-bold flex items-center justify-center gap-2 transition-colors"><Shield size={12}/> VT SCAN</button></div></div>
                            {selectedArtifact.note && (
                                <div className="bg-[#111] border border-neutral-500/30 rounded p-4">
                                    <div className="text-xs font-bold text-red-400 uppercase mb-2">Analyst Remarks</div>
                                    <p className="text-sm text-neutral-300 italic">{selectedArtifact.note}</p>
                                </div>
                            )}
                            <div className="space-y-2"><div className="text-xs font-bold text-[#888] uppercase">Raw Enrichment Data</div><div className="bg-black p-3 rounded border border-[#222] text-[10px] font-mono text-[#AAA] overflow-x-auto whitespace-pre-wrap max-h-64 custom-scrollbar">{JSON.stringify(selectedArtifact.enrichmentData, null, 2)}</div></div>
                        </div>
                    </div>
                </div>
             )}

            {showBulkImport && (
                <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-8 animate-fade-in">
                    <div className="bg-[#0A0A0A] border border-[#333] rounded-xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="p-4 border-b border-[#222] flex justify-between items-center bg-black/40">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2 uppercase tracking-tight">
                                <Upload size={20} className="text-red-400"/> BULK ARTIFACT INGESTION
                            </h3>
                            <button onClick={() => { setShowBulkImport(false); setBulkPreview([]); }} className="text-[#888] hover:text-white"><X size={20}/></button>
                        </div>
                        <div className="flex-1 overflow-hidden flex flex-col p-6 gap-6">
                            <div className="flex-1 flex flex-col gap-3 min-h-0">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold text-[#888] uppercase tracking-widest">Source Data (Paste Logs/Text)</label>
                                    <label className="text-[10px] text-red-400 hover:text-white flex items-center gap-1 cursor-pointer">
                                        <FileUp size={12}/> IMPORT FROM FILE
                                        <input type="file" className="hidden" onChange={handleBulkFileUpload} ref={fileInputRef} />
                                    </label>
                                </div>
                                <textarea 
                                    className="flex-1 bg-black border border-[#333] rounded-lg p-4 font-mono text-xs text-neutral-300 focus:border-neutral-500 outline-none resize-none custom-scrollbar"
                                    placeholder="Paste raw email headers, proxy logs, or threat intel reports..."
                                    value={bulkInputText}
                                    onChange={(e) => setBulkInputText(e.target.value)}
                                />
                                <button 
                                    onClick={handleBulkProcess}
                                    disabled={!bulkInputText.trim() || isProcessingBulk}
                                    className="bg-neutral-600 hover:bg-[#151515] text-white py-3 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isProcessingBulk ? <Loader2 className="animate-spin" size={18}/> : <RefreshCw size={18}/>} EXTRACT INDICATORS
                                </button>
                            </div>

                            {bulkPreview.length > 0 && (
                                <div className="flex-1 flex flex-col border border-[#222] rounded-lg overflow-hidden bg-black/20 min-h-0 animate-fade-in">
                                    <div className="bg-[#151515]/50 px-4 py-2 border-b border-[#222] flex justify-between items-center">
                                        <span className="text-[10px] font-bold text-[#AAA] uppercase tracking-widest">{bulkPreview.length} Candidates Identified</span>
                                    </div>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-[#111] text-[#888] font-bold sticky top-0">
                                                <tr><th className="p-2 w-20">Type</th><th className="p-2">Value</th><th className="p-2 w-10"></th></tr>
                                            </thead>
                                            <tbody className="divide-y divide-neutral-800/50">
                                                {bulkPreview.map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-white/5 transition-colors group">
                                                        <td className="p-2"><span className="bg-[#151515] text-[#AAA] px-1.5 py-0.5 rounded border border-[#333] font-mono text-[9px]">{item.type}</span></td>
                                                        <td className="p-2 font-mono text-neutral-300 break-all">{item.value}</td>
                                                        <td className="p-2 text-right"><button onClick={() => handleRemovePreviewItem(idx)} className="text-neutral-600 hover:text-red-400 opacity-0 group-hover:opacity-100"><X size={14}/></button></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="p-4 bg-[#0A0A0A] border-t border-[#222] flex justify-end gap-3">
                                        <button onClick={() => setBulkPreview([])} className="text-xs text-[#888] hover:text-white px-4">Discard All</button>
                                        <button onClick={handleCommitImport} className="bg-neutral-600 hover:bg-neutral-500 text-white px-8 py-2 rounded-lg font-bold text-sm shadow-lg shadow-green-900/20">COMMIT TO CASE</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="border-b border-[#222] bg-black/40 px-6 py-4 flex items-center justify-between shrink-0">
                 <div className="flex items-center gap-4"><button onClick={() => setViewMode('CASE_LIST')} className="p-2 hover:bg-[#151515] rounded-lg text-[#AAA] hover:text-white transition-colors"><ChevronLeft size={20}/></button><div><div className="flex items-center gap-3"><h2 className="text-lg font-bold text-white">{activeCase.title}</h2></div><div className="text-xs text-[#888] font-mono flex items-center gap-3 mt-1"><span className="flex items-center gap-1"><Clock size={10}/> Started: {new Date(activeCase.created).toLocaleString()}</span><span className="flex items-center gap-1"><User size={10}/> Lead: Analyst</span></div></div></div>
                 <div className="flex bg-[#0A0A0A] rounded-lg p-1 border border-[#222]"><button onClick={() => setActiveTab('ARTIFACTS')} className={`px-4 py-2 rounded text-xs font-bold flex items-center gap-2 transition-all ${activeTab === 'ARTIFACTS' ? 'bg-neutral-600 text-white' : 'text-[#AAA] hover:text-white'}`}><Box size={14}/> ARTIFACTS</button><button onClick={() => setActiveTab('TIMELINE')} className={`px-4 py-2 rounded text-xs font-bold flex items-center gap-2 transition-all ${activeTab === 'TIMELINE' ? 'bg-neutral-600 text-white' : 'text-[#AAA] hover:text-white'}`}><Calendar size={14}/> TIMELINE</button><button onClick={() => setActiveTab('COLLAB')} className={`px-4 py-2 rounded text-xs font-bold flex items-center gap-2 transition-all ${activeTab === 'COLLAB' ? 'bg-neutral-600 text-white' : 'text-[#AAA] hover:text-white'}`}><MessageSquare size={14}/> COLLAB</button></div>
                 <div className="flex items-center gap-2"><button onClick={() => handleExportCase('JSON')} className="p-2 hover:bg-[#151515] rounded text-[#AAA] hover:text-white" title="Export JSON"><FileJson size={16}/></button><button onClick={() => handleExportCase('CSV')} className="p-2 hover:bg-[#151515] rounded text-[#AAA] hover:text-white" title="Export CSV"><FileText size={16}/></button></div>
            </div>
            
            {activeTab === 'ARTIFACTS' && (
                <div className="flex-1 flex flex-col p-6 min-h-0">
                    <div className="flex-1 flex flex-col gap-4 min-h-0">
                        <div className="flex gap-3 items-center bg-[#111] p-3 rounded-lg border border-[#222] shrink-0 flex-wrap">
                            <div className="relative group w-48"><Search className="absolute left-2 top-2 text-[#888] w-3.5 h-3.5" /><input type="text" placeholder="Search IP, ASN, Tags..." className="bg-black border border-[#333] rounded pl-8 pr-2 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-neutral-500 w-full" value={artifactSearch} onChange={e => setArtifactSearch(e.target.value)} /></div>
                            <div className="h-6 w-px bg-[#1C1C1C] mx-1"></div>
                            <select className="bg-black border border-[#333] rounded px-2 py-1.5 text-xs text-white outline-none" value={newArtifactType} onChange={(e) => setNewArtifactType(e.target.value as any)}><option value="IP">IP</option><option value="DOMAIN">Domain</option><option value="URL">URL</option><option value="FILE">File</option><option value="HASH">Hash</option><option value="EMAIL">Email</option><option value="TEXT">Text</option></select>
                            <input type="text" className="flex-1 bg-black border border-[#333] rounded px-3 py-1.5 text-xs text-white focus:border-neutral-500 focus:outline-none min-w-[200px]" placeholder="Enter artifact value..." value={newArtifactVal} onChange={(e) => setNewArtifactVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddArtifact()} />
                            
                            <div className="flex items-center gap-2 bg-black/40 border border-[#333] rounded px-2 py-1">
                                <span className="text-[9px] text-[#888] font-bold uppercase">Sandbox</span>
                                <button onClick={() => setAutoSandbox(!autoSandbox)} className="text-red-500 hover:text-white transition-colors">
                                    {autoSandbox ? <ToggleRight size={18}/> : <ToggleLeft size={18} className="text-neutral-600"/>}
                                </button>
                            </div>

                            <label className="bg-[#151515] hover:bg-[#1C1C1C] text-neutral-300 px-3 py-1.5 rounded text-xs font-bold border border-[#333] flex items-center gap-2 cursor-pointer transition-colors">
                                {isUploadingSample ? <Loader2 className="animate-spin" size={14}/> : <FileUp size={14}/>}
                                <span className="hidden sm:inline">SAMPLE</span>
                                <input type="file" className="hidden" onChange={handleSampleUpload} ref={sampleInputRef} />
                            </label>

                            <button onClick={handleAddArtifact} className="bg-neutral-600 hover:bg-[#151515] text-white px-4 py-1.5 rounded text-xs font-bold flex items-center gap-2"><Plus size={14}/> ADD</button>
                            <button onClick={() => setShowBulkImport(true)} className={`px-4 py-1.5 rounded text-xs font-bold border flex items-center gap-2 transition-all ${showBulkImport ? 'bg-[#151515] text-white border-neutral-400' : 'bg-[#151515] hover:bg-[#1C1C1C] text-neutral-300 border-[#333]'}`}><Upload size={14}/> BULK</button>
                        </div>
                        
                        {selectedArtifactIds.size > 0 && (
                            <div className="bg-[#111] border border-neutral-500/30 p-3 rounded-lg flex justify-between items-center animate-fade-in shrink-0">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2 px-3 py-1 bg-[#1C1C1C]/20 rounded-full border border-neutral-500/50">
                                        <Layers size={14} className="text-red-400"/>
                                        <span className="text-xs text-white font-bold">{selectedArtifactIds.size} Artifacts Selected</span>
                                    </div>
                                    <button onClick={() => setSelectedArtifactIds(new Set())} className="text-[11px] text-[#AAA] hover:text-white flex items-center gap-1 transition-colors"><X size={12}/> Clear Selection</button>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button onClick={handleBulkEnrich} className="px-4 py-2 bg-neutral-600 hover:bg-[#151515] text-white rounded text-xs font-bold flex items-center gap-2 shadow-lg transition-all"><Zap size={14}/> DEEP SCAN BATCH</button>
                                    <button onClick={handleBulkExportArtifacts} className="px-4 py-2 bg-[#151515] text-neutral-200 border border-neutral-600 rounded text-xs font-bold flex items-center gap-2 hover:bg-[#1C1C1C]">Export List</button>
                                    <button onClick={handleBulkDeleteArtifacts} className="px-4 py-2 bg-red-600 text-white rounded text-xs font-bold flex items-center gap-2 hover:bg-red-500">Delete</button>
                                </div>
                            </div>
                        )}

                        <div className="flex-1 overflow-auto custom-scrollbar bg-black/30 border border-[#222] rounded-lg relative">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-[#111] text-[#888] uppercase font-bold text-xs sticky top-0 z-10 backdrop-blur-md">
                                    <tr>
                                        <th className="p-4 w-10 text-center"><input type="checkbox" className="w-3.5 h-3.5 rounded bg-black border-neutral-600 checked:bg-[#151515] cursor-pointer" checked={filteredArtifacts.length > 0 && filteredArtifacts.every(a => selectedArtifactIds.has(a.id))} onChange={toggleSelectAllArtifacts} /></th>
                                        <th className="p-4 w-32 cursor-pointer hover:text-white" onClick={() => handleSort('risk')}>Risk Level {sortConfig.key === 'risk' && (sortConfig.direction === 'asc' ? <ArrowUpDown size={10} className="inline rotate-180"/> : <ArrowUpDown size={10} className="inline"/>)}</th>
                                        <th className="p-4 w-48 cursor-pointer hover:text-white" onClick={() => handleSort('value')}>Artifact {sortConfig.key === 'value' && (sortConfig.direction === 'asc' ? <ArrowUpDown size={10} className="inline rotate-180"/> : <ArrowUpDown size={10} className="inline"/>)}</th>
                                        <th className="p-4 w-32 cursor-pointer hover:text-white" onClick={() => handleSort('type')}>Type {sortConfig.key === 'type' && (sortConfig.direction === 'asc' ? <ArrowUpDown size={10} className="inline rotate-180"/> : <ArrowUpDown size={10} className="inline"/>)}</th>
                                        <th className="p-4 w-48">Location / Network</th><th className="p-4">Detections (Tags)</th><th className="p-4 text-right w-24">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-800/50 text-neutral-300">
                                    {filteredArtifacts.length > 0 ? filteredArtifacts.map((art) => {
                                        const riskLevel = art.enrichmentData?.risk?.level || 'LOW';
                                        const isLoading = enrichingArtifacts.has(art.id);
                                        const isSelected = selectedArtifactIds.has(art.id);
                                        return (
                                        <tr key={art.id} className={`hover:bg-white/5 transition-colors group cursor-pointer ${selectedArtifact?.id === art.id ? 'bg-white/5' : ''}`} onClick={() => setSelectedArtifact(art)}>
                                            <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}><input type="checkbox" className="w-3.5 h-3.5 rounded bg-black border-neutral-600 checked:bg-[#151515] cursor-pointer" checked={isSelected} onChange={() => toggleArtifactSelection(art.id)} /></td>
                                            <td className="p-4"><div className="flex items-center gap-2"><span className={`px-2 py-1 rounded text-[10px] font-bold border ${getRiskColor(riskLevel)}`}>{riskLevel}</span>{isLoading && <Loader2 size={12} className="animate-spin text-red-500"/>}</div></td>
                                            <td className="p-4 font-mono text-neutral-300 break-all max-w-xs"><div className="font-bold text-white">{art.value}</div><div className="text-[10px] text-[#888] mt-1">{new Date(art.addedAt).toLocaleString()}</div></td>
                                            <td className="p-4 text-xs font-mono text-[#AAA]"><div className="flex items-center gap-2">{React.createElement(ARTIFACT_ICONS[art.type] || Box, { size: 14 })}{art.type}</div></td>
                                            <td className="p-4 text-xs text-[#AAA]">{art.enrichmentData?.geo ? (<div><div className="flex items-center gap-2 text-white hover:text-red-500 transition-colors w-fit"><Globe size={12}/> {art.enrichmentData.geo.country_name}</div><div className="text-[10px] text-[#888] truncate max-w-[150px]">{art.enrichmentData.geo.asn?.name}</div></div>) : <span className="text-neutral-600 italic">Pending...</span>}</td>
                                            <td className="p-4"><div className="flex flex-wrap gap-1">{art.tags?.length ? art.tags.map((t: string, i: number) => <span key={i} className="px-1.5 py-0.5 bg-[#151515] border border-[#333] rounded text-[10px] text-neutral-300 truncate max-w-[150px]" title={t}>{t}</span>) : <span className="text-neutral-600 text-xs italic">No tags</span>}</div></td>
                                            <td className="p-4 text-right"><div className="flex justify-end gap-1"><button onClick={(e) => { e.stopPropagation(); handleEnrichArtifact(art.id, art, true); }} className="p-1.5 hover:bg-[#151515] rounded text-[#AAA] hover:text-red-500 transition-colors" title="Deep Scan (API)"><Zap size={14}/></button><button onClick={(e) => { e.stopPropagation(); handleDeleteArtifact(art.id); }} className="p-1.5 hover:bg-red-900/30 rounded text-[#888] hover:text-red-400"><Trash2 size={14}/></button></div></td>
                                        </tr>
                                    )}) : (<tr><td colSpan={7} className="text-center text-[#888] text-xs italic py-12">No artifacts found.</td></tr>)}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'TIMELINE' && (
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                     <div className="max-w-4xl mx-auto pl-8">
                         <div className="relative border-l-2 border-[#222] space-y-8 py-4">
                             {timelineGroups.map((group) => {
                                 const isExpanded = expandedGroups.has(group.id);
                                 if (group.type === 'NOTE') {
                                     const item = group.items[0];
                                     return (<div key={item.id} className="relative pl-6"><div className="absolute -left-[9px] top-3 w-4 h-4 rounded-full border-2 border-[#222] bg-black flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-[#151515]"></div></div><div className="bg-[#111] border border-[#222] rounded-lg p-4 hover:border-neutral-500/30 transition-all hover:bg-[#111]"><div className="flex justify-between items-start mb-2"><div className="flex items-center gap-2"><MessageSquare size={14} className="text-red-400"/><span className="text-xs font-bold text-red-400">ANALYST NOTE</span></div><div className="text-xs text-[#888] font-mono flex items-center gap-1"><Clock size={10}/> {new Date(item.timestamp).toLocaleString()}</div></div><div className="text-sm text-neutral-300 font-mono break-all leading-relaxed bg-black/20 p-2 rounded">{item.text}</div><div className="mt-2 text-[10px] text-[#888] flex items-center gap-1"><User size={10}/> {item.author}</div></div></div>);
                                 }
                                 if (group.type === 'BULK') {
                                     const summary = Object.entries(group.items.reduce((acc: any, i: any) => { acc[i.type] = (acc[i.type] || 0) + 1; return acc; }, {})).map(([k,v]) => `${v} ${k}`).join(', ');
                                     return (<div key={group.id} className="relative pl-6"><div className="absolute -left-[9px] top-3 w-4 h-4 rounded-full border-2 border-[#222] bg-black flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-[#151515]"></div></div><div className="bg-[#111] border border-[#222] rounded-lg overflow-hidden transition-all hover:border-neutral-500/30"><div className="p-4 flex justify-between items-center cursor-pointer hover:bg-[#151515]/50" onClick={() => toggleTimelineGroup(group.id)}><div className="flex items-center gap-3"><div className="p-2 bg-neutral-900/20 rounded border border-neutral-500/30 text-red-400"><Layers size={16}/></div><div><div className="text-xs font-bold text-white flex items-center gap-2">Bulk Artifact Import <span className="bg-[#151515] text-[#AAA] px-1.5 rounded text-[10px]">{group.items.length} Items</span></div><div className="text-[10px] text-[#888]">{summary}</div></div></div><div className="flex items-center gap-4"><div className="text-xs text-[#888] font-mono flex items-center gap-1"><Clock size={10}/> {new Date(group.timestamp).toLocaleTimeString()}</div><ChevronDown size={16} className={`text-[#888] transition-transform ${isExpanded ? 'rotate-180' : ''}`}/></div></div>{isExpanded && (<div className="border-t border-[#222] bg-black/20 p-2 space-y-1">{group.items.map((item: any) => (<div key={item.id} className="flex justify-between items-center p-2 rounded hover:bg-white/5 text-xs"><div className="flex items-center gap-2 overflow-hidden"><span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border bg-[#151515] border-[#333] text-[#AAA] w-12 text-center`}>{item.type}</span><span className="text-neutral-300 font-mono truncate">{item.value}</span></div><button onClick={(e) => {e.stopPropagation(); setSelectedArtifact(item);}} className="text-red-500 hover:text-white text-[10px] flex items-center gap-1">View <ArrowRight size={10}/></button></div>))}</div>)}</div></div>);
                                 }
                                 const item = group.items[0];
                                 return (<div key={item.id} className="relative pl-6"><div className="absolute -left-[9px] top-3 w-4 h-4 rounded-full border-2 border-[#222] bg-black flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-[#151515]"></div></div><div className="bg-[#111] border border-[#222] rounded-lg p-4 hover:border-neutral-500/30 transition-all hover:bg-[#111] cursor-pointer" onClick={() => setSelectedArtifact(item)}><div className="flex justify-between items-start mb-2"><div className="flex items-center gap-2"><Zap size={14} className="text-red-400"/><span className="text-xs font-bold text-red-400">ARTIFACT: {item.type}</span></div><div className="text-xs text-[#888] font-mono flex items-center gap-1"><Clock size={10}/> {new Date(item.timestamp).toLocaleTimeString()}</div></div><div className="text-sm text-neutral-300 font-mono break-all leading-relaxed bg-black/20 p-2 rounded border border-[#222]/50">{item.value}</div><div className="mt-2 text-[10px] text-[#888] flex items-center gap-1"><Activity size={10}/> System Entry</div></div></div>);
                             })}
                         </div>
                     </div>
                </div>
            )}

            {activeTab === 'COLLAB' && (
                <div className="flex-1 flex flex-col min-h-0 bg-black/20">
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
                        {activeCase.notes.length === 0 && (<div className="text-center text-[#888] text-xs italic flex flex-col items-center justify-center h-full opacity-50"><MessageSquare size={48} className="mb-4"/><p>No discussion yet.</p></div>)}
                        {activeCase.notes.map(note => (
                            <div key={note.id} className="flex gap-4 group"><div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shrink-0 font-bold text-xs">{note.author.substring(0,2).toUpperCase()}</div><div className="flex-1 max-w-3xl"><div className="flex items-center gap-2 mb-1"><span className="text-xs font-bold text-neutral-200">{note.author}</span><span className="text-[10px] text-[#888]">{new Date(note.timestamp).toLocaleString()}</span></div><div className="bg-[#151515] p-3 rounded-lg rounded-tl-none border border-[#333] text-sm text-neutral-300 whitespace-pre-wrap">{note.text}</div></div></div>
                        ))}
                    </div>
                    <div className="p-4 bg-[#0A0A0A] border-t border-[#222] shrink-0"><div className="flex gap-2 max-w-5xl mx-auto"><textarea className="flex-1 bg-black border border-[#333] rounded-lg p-3 text-sm text-white focus:border-neutral-500 outline-none resize-none h-14" placeholder="Type notes..." value={newNote} onChange={e => setNewNote(e.target.value)} onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddNote(); }}} /><button onClick={handleAddNote} disabled={!newNote.trim()} className="px-6 bg-neutral-600 hover:bg-[#151515] text-white rounded-lg font-bold text-xs flex items-center justify-center transition-all disabled:opacity-50"><ArrowRight size={18}/></button></div></div>
                </div>
            )}
        </div>
    );
};
