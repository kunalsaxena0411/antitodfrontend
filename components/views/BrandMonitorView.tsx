
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CertStreamObserver, generateTyposquats, checkDomainStatus, loadModel, scoreSimilarity } from '../../services/brandMonitor';
import { performRdapLookup, performCrtLookup, WhoisResult } from '../../services/netTools';
import { fetchOtxWhois } from '../../services/otx';
import { checkRBL, checkDomainSecurity, queryDoH } from '../../services/dns';
import { getCertContact, CertContact } from '../../services/certContacts';
import { SuspiciousCert, TyposquatResult, CrtShEntry } from '../../types';
import { Shield, Radio, Search, AlertTriangle, Eye, Globe, ExternalLink, Pause, Play, RefreshCw, Layers, CheckCircle, XCircle, Image, Upload, Trash2, Camera, Settings, ArrowDown, FileText, Mail, Copy, Loader2, X, Gavel, Server, Lock, ShieldAlert, Flag, Siren, Plus } from 'lucide-react';

interface MonitoredAsset {
    id: string;
    value: string;
    type: 'IP' | 'DOMAIN' | 'EMAIL';
    status: 'CLEAN' | 'ALERT' | 'CHECKING' | 'UNKNOWN';
    detections: string[];
    lastChecked: number | null;
}

const MOCK_CERTS: SuspiciousCert[] = [
    {
        id: 'cert-1',
        timestamp: Date.now() - 1000 * 60 * 5,
        domain: 'secure-paypal-login.com',
        issuer: 'Let\'s Encrypt',
        score: 95,
        keywordMatched: 'paypal',
        isTypo: false,
    },
    {
        id: 'cert-2',
        timestamp: Date.now() - 1000 * 60 * 15,
        domain: 'appIe-support.com',
        issuer: 'Cloudflare',
        score: 88,
        keywordMatched: 'apple',
        isTypo: true,
    },
    {
        id: 'cert-3',
        timestamp: Date.now() - 1000 * 60 * 45,
        domain: 'mircosoft-update.net',
        issuer: 'ZeroSSL',
        score: 92,
        keywordMatched: 'microsoft',
        isTypo: true,
    },
    {
        id: 'cert-4',
        timestamp: Date.now() - 1000 * 60 * 60 * 2,
        domain: 'google-docs-share.com',
        issuer: 'Let\'s Encrypt',
        score: 75,
        keywordMatched: 'google',
        isTypo: false,
    },
    {
        id: 'cert-5',
        timestamp: Date.now() - 1000 * 60 * 60 * 5,
        domain: 'binance-auth.info',
        issuer: 'Sectigo',
        score: 98,
        keywordMatched: 'binance',
        isTypo: false,
    }
];

export const BrandMonitorView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'LIVE' | 'SCANNER' | 'REPUTATION' | 'CONFIG'>('LIVE');

    // Config State
    const [keywords, setKeywords] = useState<string[]>(['paypal', 'apple', 'microsoft', 'google', 'binance', 'coinbase']);
    const [officialDomains, setOfficialDomains] = useState<string[]>(['paypal.com', 'apple.com', 'microsoft.com', 'google.com', 'binance.com', 'coinbase.com']);
    const [newKeyword, setNewKeyword] = useState('');
    const [newDomain, setNewDomain] = useState('');
    const [officialLogo, setOfficialLogo] = useState<string | null>(null);
    const [fuzzyThreshold, setFuzzyThreshold] = useState(80);

    // Live Feed State
    const [certStream, setCertStream] = useState<SuspiciousCert[]>(MOCK_CERTS);
    const [isStreamPaused, setIsStreamPaused] = useState(false);
    const observerRef = useRef<CertStreamObserver | null>(null);

    // Scanner State
    const [scanTarget, setScanTarget] = useState('');
    const [scanResults, setScanResults] = useState<TyposquatResult[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [resultLimit, setResultLimit] = useState(20);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Reputation Monitor State
    const [monitoredAssets, setMonitoredAssets] = useState<MonitoredAsset[]>(() => {
        try {
            const saved = localStorage.getItem('xyberah_brand_assets');
            return saved ? JSON.parse(saved) : [];
        } catch (e) { return []; }
    });
    const [newAssetValue, setNewAssetValue] = useState('');
    const [newAssetType, setNewAssetType] = useState<'IP' | 'DOMAIN' | 'EMAIL'>('DOMAIN');
    const [isCheckingReputation, setIsCheckingReputation] = useState(false);

    // Investigation Modal State
    const [selectedTyposquat, setSelectedTyposquat] = useState<TyposquatResult | null>(null);
    const [enrichmentLoading, setEnrichmentLoading] = useState(false);
    const [whoisData, setWhoisData] = useState<WhoisResult | null>(null);
    const [crtData, setCrtData] = useState<CrtShEntry[]>([]);
    const [certContact, setCertContact] = useState<CertContact | null>(null);
    const [investigationTab, setInvestigationTab] = useState<'INTEL' | 'TAKEDOWN'>('INTEL');

    // Initial Load of TF Model
    useEffect(() => {
        loadModel(); // Preload model silently
    }, []);

    // Save Assets
    useEffect(() => {
        localStorage.setItem('xyberah_brand_assets', JSON.stringify(monitoredAssets));
    }, [monitoredAssets]);

    // --- Live Stream Logic ---
    useEffect(() => {
        // Initialize Observer
        observerRef.current = new CertStreamObserver(keywords, (cert) => {
            setCertStream(prev => {
                if (isStreamPaused) return prev;
                // Keep buffer of 50
                const updated = [cert, ...prev].slice(0, 50);
                return updated;
            });
        });
        observerRef.current.setFuzzyThreshold(fuzzyThreshold);
        observerRef.current.connect();

        return () => {
            observerRef.current?.disconnect();
        };
    }, []); // Run once on mount

    useEffect(() => {
        // Update keywords when they change
        if (observerRef.current) {
            observerRef.current.updateKeywords(keywords);
            observerRef.current.setFuzzyThreshold(fuzzyThreshold);
        }
    }, [keywords, fuzzyThreshold]);

    const handleAddKeyword = () => {
        if (newKeyword && !keywords.includes(newKeyword)) {
            setKeywords([...keywords, newKeyword]);
            setNewKeyword('');
        }
    };

    const handleRemoveKeyword = (k: string) => {
        setKeywords(keywords.filter(key => key !== k));
    };

    const handleAddDomain = () => {
        if (newDomain && !officialDomains.includes(newDomain)) {
            setOfficialDomains([...officialDomains, newDomain]);
            setNewDomain('');
        }
    };

    const handleRemoveDomain = (d: string) => {
        setOfficialDomains(officialDomains.filter(dom => dom !== d));
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setOfficialLogo(ev.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    // --- Scanner Logic ---
    const handleScan = async () => {
        if (!scanTarget) return;
        setIsScanning(true);
        setScanResults([]);
        setScanProgress(0);
        setResultLimit(20); // Reset pagination

        // 1. Generate Mutations
        const mutations = generateTyposquats(scanTarget);

        // 2. Resolve in Batches
        const BATCH_SIZE = 5;

        for (let i = 0; i < mutations.length; i += BATCH_SIZE) {
            const batch = mutations.slice(i, i + BATCH_SIZE);
            // Pass official logo for visual analysis
            const promises = batch.map(m => checkDomainStatus(m, officialLogo || undefined));
            const checked = await Promise.all(promises);

            // Only keep registered domains to reduce noise
            const registered = checked.filter(c => c.isRegistered);
            if (registered.length > 0) {
                setScanResults(prev => [...prev, ...registered]);
            }

            setScanProgress(Math.round(((i + BATCH_SIZE) / mutations.length) * 100));
            await new Promise(r => setTimeout(r, 50));
        }

        setIsScanning(false);
        setScanProgress(100);
    };

    const handleInspect = async (result: TyposquatResult) => {
        setSelectedTyposquat(result);
        setInvestigationTab('INTEL');
        setEnrichmentLoading(true);
        setWhoisData(null);
        setCrtData([]);
        setCertContact(null);

        // Identify CERT based on country code
        if (result.country && result.country !== 'Unknown') {
            const cert = getCertContact(result.country);
            setCertContact(cert);
        }

        try {
            // Fetch Standard RDAP
            let whois = await performRdapLookup(result.variation, 'DOMAIN');

            // Fallback/Enrichment with OTX if standard RDAP is missing critical info
            if (!whois || whois.org === 'Unknown' || whois.registrationDate === 'Unknown') {
                const otxWhois = await fetchOtxWhois(result.variation);
                if (otxWhois) {
                    // If whois existed but was incomplete, merge. Otherwise replace.
                    whois = whois ? { ...whois, ...otxWhois, raw: { ...whois.raw, otx: otxWhois.raw } } : otxWhois;
                }
            }

            const certs = await performCrtLookup(result.variation);

            setWhoisData(whois);
            setCrtData(certs);
        } catch (e) {
            console.error("Investigation failed", e);
        } finally {
            setEnrichmentLoading(false);
        }
    };

    // --- Reputation Monitor Logic ---
    const addAsset = (value: string, type: 'IP' | 'DOMAIN' | 'EMAIL') => {
        setMonitoredAssets(prev => {
            if (prev.some(a => a.value === value)) return prev;
            const id = crypto.randomUUID();
            const newAsset: MonitoredAsset = {
                id,
                value,
                type,
                status: 'UNKNOWN',
                detections: [],
                lastChecked: null
            };
            // Trigger check
            setTimeout(() => handleCheckAsset(id, newAsset), 50);
            return [...prev, newAsset];
        });
    };

    const handleAddAsset = async () => {
        if (!newAssetValue) return;
        const val = newAssetValue.trim();
        const type = newAssetType;

        // Add the primary asset
        addAsset(val, type);
        setNewAssetValue('');

        // Auto-discovery: Resolve IP and MX to monitor them automatically
        if (type === 'DOMAIN') {
            try {
                // A Records -> IPs
                const dns = await queryDoH(val, 'A');
                if (dns?.Answer) {
                    dns.Answer.forEach((ans: any) => {
                        if (ans.type === 1) addAsset(ans.data, 'IP');
                    });
                }

                // MX Records -> Mail Domains/IPs
                const mx = await queryDoH(val, 'MX');
                if (mx?.Answer) {
                    mx.Answer.forEach((rec: any) => {
                        const parts = rec.data.split(' ');
                        const mxHost = parts[parts.length - 1].replace(/"/g, '').replace(/\.$/, '');
                        // Add the MX hostname
                        addAsset(mxHost, 'DOMAIN');

                        // Resolve MX IP
                        queryDoH(mxHost, 'A').then(mxIpRes => {
                            if (mxIpRes?.Answer) {
                                mxIpRes.Answer.forEach((a: any) => {
                                    if (a.type === 1) addAsset(a.data, 'IP');
                                });
                            }
                        });
                    });
                }
            } catch (e) {
                console.error("Auto-discovery failed", e);
            }
        }
    };

    const handleRemoveAsset = (id: string) => {
        setMonitoredAssets(monitoredAssets.filter(a => a.id !== id));
    };

    const handleCheckAsset = async (id: string, assetObj?: MonitoredAsset) => {
        setMonitoredAssets(prev => prev.map(a => a.id === id ? { ...a, status: 'CHECKING', detections: [] } : a));

        const asset = assetObj || monitoredAssets.find(a => a.id === id);
        if (!asset) return;

        const detections: string[] = [];

        try {
            if (asset.type === 'IP') {
                const rbl = await checkRBL(asset.value);
                if (rbl.status === 'LISTED') detections.push(...rbl.listedIn);
            } else if (asset.type === 'DOMAIN') {
                const sec = await checkDomainSecurity(asset.value);
                sec.filter(s => s.status === 'BLOCKED').forEach(s => detections.push(`${s.provider} (DoT/DoH)`));

                // SSL Expiry Check
                try {
                    const certs = await performCrtLookup(asset.value);
                    if (certs && certs.length > 0) {
                        // Sort by not_after descending to get latest
                        const sorted = certs.sort((a, b) => new Date(b.not_after).getTime() - new Date(a.not_after).getTime());
                        const latest = sorted[0];
                        const expiry = new Date(latest.not_after);
                        const now = new Date();
                        const diffTime = expiry.getTime() - now.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                        if (diffDays <= 30 && diffDays >= 0) {
                            detections.push(`SSL RENEWAL DUE: Expires in ${diffDays} days (${latest.not_after.split('T')[0]})`);
                        } else if (diffDays < 0) {
                            detections.push(`SSL EXPIRED: ${Math.abs(diffDays)} days ago (${latest.not_after.split('T')[0]})`);
                        }
                    }
                } catch (e) { }

                // Resolve IPs (A Records) and check RBL (Recursive Check)
                try {
                    const dns = await queryDoH(asset.value, 'A');
                    if (dns?.Answer) {
                        const ips = new Set<string>();
                        dns.Answer.forEach((ans: any) => {
                            if (ans.type === 1) ips.add(ans.data);
                        });

                        for (const ip of Array.from(ips)) {
                            const rbl = await checkRBL(ip);
                            if (rbl.status === 'LISTED') detections.push(`Linked IP ${ip} Listed in: ${rbl.listedIn.join(', ')}`);
                        }
                    }
                } catch (e) { }

                // Resolve MX Records (Mail Servers) and check RBL
                try {
                    const mx = await queryDoH(asset.value, 'MX');
                    if (mx?.Answer) {
                        const processedMxIps = new Set<string>();
                        for (const rec of mx.Answer) {
                            const parts = rec.data.split(' ');
                            const mxHost = parts[parts.length - 1].replace(/"/g, '').replace(/\.$/, '');

                            const ipRes = await queryDoH(mxHost, 'A');
                            if (ipRes?.Answer) {
                                for (const ans of ipRes.Answer) {
                                    if (ans.type === 1) {
                                        const ip = ans.data;
                                        if (processedMxIps.has(ip)) continue;
                                        processedMxIps.add(ip);

                                        const rbl = await checkRBL(ip);
                                        if (rbl.status === 'LISTED') {
                                            detections.push(`MX ${mxHost} (${ip}) Listed`);
                                        }
                                    }
                                }
                            }
                        }
                    }
                } catch (e) { }
            } else if (asset.type === 'EMAIL') {
                const domain = asset.value.includes('@') ? asset.value.split('@')[1] : asset.value;
                const sec = await checkDomainSecurity(domain);
                sec.filter(s => s.status === 'BLOCKED').forEach(s => detections.push(`Email Domain Blocked: ${s.provider}`));

                const mx = await queryDoH(domain, 'MX');
                if (mx?.Answer) {
                    for (const rec of mx.Answer) {
                        const parts = rec.data.split(' ');
                        const mxHost = parts[parts.length - 1].replace(/"/g, '').replace(/\.$/, '');

                        const ipRes = await queryDoH(mxHost, 'A');
                        if (ipRes?.Answer?.[0]?.data) {
                            const ip = ipRes.Answer[0].data;
                            const rbl = await checkRBL(ip);
                            if (rbl.status === 'LISTED') {
                                detections.push(`Email MX ${mxHost} (${ip}) Listed`);
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.error("Asset check failed", e);
        }

        setMonitoredAssets(prev => prev.map(a => a.id === id ? {
            ...a,
            status: detections.length > 0 ? 'ALERT' : 'CLEAN',
            detections,
            lastChecked: Date.now()
        } : a));
    };

    const handleCheckAllAssets = async () => {
        setIsCheckingReputation(true);
        for (const asset of monitoredAssets) {
            await handleCheckAsset(asset.id);
            await new Promise(r => setTimeout(r, 200)); // Rate limit
        }
        setIsCheckingReputation(false);
    };

    const filteredScanResults = useMemo(() => {
        let results = scanResults;
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            results = results.filter(r =>
                r.variation.toLowerCase().includes(query) ||
                r.type.toLowerCase().includes(query) ||
                (typeof r.country === 'string' && r.country.toLowerCase().includes(query))
            );
        }
        return results;
    }, [scanResults, searchQuery]);

    const suggestions = useMemo(() => {
        if (!searchQuery) return [];
        const types: string[] = Array.from(new Set(scanResults.map(r => r.type)));
        const countries: string[] = Array.from(new Set(scanResults.map(r => r.country).filter((c): c is string => typeof c === 'string')));

        const allSuggestions = [
            ...types.map(t => ({ label: t, type: 'Type' })),
            ...countries.map(c => ({ label: c, type: 'Country' }))
        ];

        return allSuggestions.filter(s => s.label.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 5);
    }, [scanResults, searchQuery]);

    // --- Template Helpers ---
    const getAbuseEmail = () => {
        const findEmail = (entities: any[]): string | null => {
            if (!entities) return null;
            for (const e of entities) {
                if (e.vcardArray) {
                    const emailEntry = e.vcardArray[1].find((i: any) => i[0] === 'email');
                    if (emailEntry) return emailEntry[3];
                }
                if (e.entities) {
                    const found = findEmail(e.entities);
                    if (found) return found;
                }
            }
            return null;
        };

        if (!whoisData) return 'abuse@registrar.com';

        // Try RDAP entities
        const rdapEmail = findEmail(whoisData.entities);
        if (rdapEmail) return rdapEmail;

        // Try OTX Data extraction
        const checkOtxData = (dataArray: any[]) => {
            const emailItem = dataArray.find((i: any) => i.key === 'emails' || i.key === 'registrant_email' || i.key === 'admin_email' || i.key === 'tech_email');
            return emailItem ? emailItem.value : null;
        };

        if (whoisData.raw) {
            // Direct OTX raw
            if (whoisData.raw.data && Array.isArray(whoisData.raw.data)) {
                const email = checkOtxData(whoisData.raw.data);
                if (email) return email;
            }
            // Enriched RDAP raw
            if (whoisData.raw.otx && whoisData.raw.otx.raw && whoisData.raw.otx.raw.data && Array.isArray(whoisData.raw.otx.raw.data)) {
                const email = checkOtxData(whoisData.raw.otx.raw.data);
                if (email) return email;
            }
        }

        return 'abuse@registrar-unknown.com';
    };

    const getDomainAge = () => {
        if (!whoisData || whoisData.registrationDate === 'Unknown') return 'Unknown';
        const created = new Date(whoisData.registrationDate);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - created.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return `${diffDays} days`;
    };

    const getTakedownTemplate = () => {
        if (!selectedTyposquat) return '';
        const registrar = whoisData?.org || 'Unknown Registrar';
        const abuseEmail = getAbuseEmail();
        const originalDomain = selectedTyposquat.original;
        const infringingDomain = selectedTyposquat.variation;
        const certEmail = certContact ? certContact.email : 'N/A';

        return `To: ${abuseEmail}
Cc: ${certEmail}
Subject: [URGENT] Trademark Infringement & Phishing Report: ${infringingDomain}

Dear Abuse Team at ${registrar},

I am writing on behalf of the security team for ${originalDomain}. We have identified a domain registered through your services that is being used for typosquatting and potential phishing activities targeting our brand.

Infringing Domain: ${infringingDomain}
IP Address: ${selectedTyposquat.ip || 'N/A'}
Creation Date: ${whoisData?.registrationDate || 'Unknown'}
Location: ${selectedTyposquat.country || 'Unknown'}

This domain is visually similar to our protected trademark "${originalDomain}" and is likely being used to deceive users.

Evidence:
1. The domain uses a variation of our trademark (Type: ${selectedTyposquat.type}).
2. It resolves to a hosting provider inconsistent with our infrastructure.
3. The domain mimics our visual identity${selectedTyposquat.logoMatchScore && selectedTyposquat.logoMatchScore > 70 ? ' (High visual similarity detected)' : ''}.
${selectedTyposquat.hasMx ? '4. The domain has active Mail Exchange (MX) records, indicating potential for phishing campaigns.' : ''}

We request that you investigate this domain immediately for violation of your Terms of Service regarding trademark abuse and phishing.

${certContact ? `We have also notified the National CERT (${certContact.name}) regarding this incident.` : ''}

Please confirm receipt of this notice and inform us of the actions taken.

Sincerely,
Security Operations
${originalDomain}`;
    };

    return (
        <div className="h-[calc(100vh-70px)] bg-transparent flex flex-col relative font-mono selection:bg-red-500/30 overflow-hidden">
            {/* Header */}
            <div className="bg-[#111]/95 border-b border-[#1A1A1A] px-5 py-3 shrink-0 flex items-center justify-between z-20 shadow-[0_6px_24px_rgba(0,0,0,0.18)] backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-red-500/[0.06] border border-red-500/20 text-red-400 rounded-sm">
                        <Shield size={18} />
                    </div>
                    <div>
                        <h2 className="text-[16px] font-bold text-white uppercase tracking-[0.18em] flex items-center gap-2 font-sans">
                            <div className="w-1.5 h-4 bg-red-500/80 mr-1" />
                            Brand <span className="text-red-500">Intel</span>
                        </h2>
                        <p className="text-[9px] text-[#666] font-mono mt-0.5 uppercase tracking-[0.18em]">Impersonation & Reputation Monitor</p>
                    </div>
                </div>

                <div className="flex items-center bg-[#111] p-1 border border-[#1A1A1A] gap-0.5 rounded-sm">
                    <button
                        onClick={() => setActiveTab('LIVE')}
                        className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 transition-all rounded-sm ${activeTab === 'LIVE' ? 'bg-red-500/[0.08] text-red-300 border border-red-500/20 shadow-[inset_0_1px_0_rgba(239,68,68,0.08)]' : 'text-[#666] hover:text-neutral-300 border border-transparent'}`}
                    >
                        <Radio size={12} className={activeTab === 'LIVE' ? 'animate-pulse' : ''} /> LIVE FEED
                    </button>
                    <button
                        onClick={() => setActiveTab('SCANNER')}
                        className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 transition-all rounded-sm ${activeTab === 'SCANNER' ? 'bg-[#141414] text-white border border-[#2C2C2C]' : 'text-[#666] hover:text-neutral-300 border border-transparent'}`}
                    >
                        <Search size={12} /> ADVANCED SCAN
                    </button>
                    <button
                        onClick={() => setActiveTab('REPUTATION')}
                        className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 transition-all rounded-sm ${activeTab === 'REPUTATION' ? 'bg-red-500/[0.08] text-red-300 border border-red-500/20' : 'text-[#666] hover:text-neutral-300 border border-transparent'}`}
                    >
                        <Siren size={12} /> REPUTATION
                    </button>
                    <button
                        onClick={() => setActiveTab('CONFIG')}
                        className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 transition-all rounded-sm ${activeTab === 'CONFIG' ? 'bg-[#141414] text-white border border-[#2C2C2C]' : 'text-[#666] hover:text-neutral-300 border border-transparent'}`}
                    >
                        <Settings size={12} /> CONFIG
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden relative bg-transparent">

                {/* LIVE FEED TAB */}
                {activeTab === 'LIVE' && (
                    <div className="h-full flex flex-col gap-4 p-5 md:p-6">
                        <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2 text-[11px] text-[#9A9A9A]">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(74,222,128,0.45)]" /> Monitoring <span className="text-white font-semibold">{keywords.length}</span> brand keywords in the global SSL stream.
                                <span className="ml-1 bg-[#111] border border-[#262626] px-2 py-0.5 rounded-sm text-[9px] uppercase tracking-wider text-[#777]">Phonetic matching active</span>
                            </div>
                            <div className="flex gap-2">
                                <button title={isStreamPaused ? "Resume stream" : "Pause stream"} onClick={() => setIsStreamPaused(!isStreamPaused)} className="h-7 w-7 bg-[#111] hover:bg-[#151515] border border-[#242424] rounded-sm text-neutral-300 transition-colors flex items-center justify-center">
                                    {isStreamPaused ? <Play size={14} /> : <Pause size={14} />}
                                </button>
                                <button title="Clear feed" onClick={() => setCertStream([])} className="h-7 w-7 bg-[#111] hover:bg-[#151515] border border-[#242424] rounded-sm text-neutral-300 transition-colors flex items-center justify-center">
                                    <RefreshCw size={14} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-transparent border border-[#1B1B1B] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] relative">
                            {/* Removed Grid overlay */}
                            {certStream.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-neutral-600 gap-4">
                                    <Radio size={48} className="opacity-20 animate-pulse" />
                                    <p className="text-xs font-mono">Listening to Certificate Transparency Logs...</p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2 relative z-10">
                                    {certStream.map((cert, i) => (
                                        <div key={cert.id} className="group overflow-hidden bg-[#111] border border-[#1A1A1A] p-3 transition-all hover:border-[#303030] hover:bg-[#111] border-l-[2px] border-l-transparent hover:border-l-red-500/70 shadow-[0_1px_0_rgba(255,255,255,0.02)]" style={{ animationDelay: `${i * 0.05}s` }}>

                                            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">

                                                {/* Left Section: Icon & Identity */}
                                                <div className="flex items-center gap-4">
                                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-red-500/20 bg-red-500/[0.07] text-red-400">
                                                        <AlertTriangle size={18} />
                                                    </div>

                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[13px] font-semibold tracking-wide text-white">{cert.domain}</span>
                                                            {cert.isTypo && (
                                                                <span className="rounded bg-orange-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-orange-400 border border-orange-500/20">Typosquat</span>
                                                            )}
                                                        </div>
                                                        <div className="mt-1 flex items-center gap-3 text-[11px] text-neutral-500">
                                                            <div className="flex items-center gap-1">
                                                                <span className="uppercase tracking-wider">Target:</span>
                                                                <span className="font-mono text-red-400 font-medium">{cert.keywordMatched}</span>
                                                            </div>
                                                            <span className="h-3 w-px bg-neutral-800" />
                                                            <div className="flex items-center gap-1">
                                                                <span className="uppercase tracking-wider">Issuer:</span>
                                                                <span className="text-neutral-400">{cert.issuer}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right Section: Score & Action */}
                                                <div className="flex items-center gap-5">

                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[9px] uppercase tracking-wider text-neutral-500 mb-1">Threat Score</span>
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-1 w-20 overflow-hidden rounded-full bg-neutral-800/80 border border-white/[0.03]">
                                                                <div className="h-full rounded-full bg-red-400 transition-all duration-500" style={{ width: `${cert.score}%` }} />
                                                            </div>
                                                            <span className="font-mono text-xs font-bold text-red-500">{cert.score}</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col items-end gap-1 border-l border-neutral-800 pl-5">
                                                        <span className="font-mono text-[10px] text-neutral-500">{new Date(cert.timestamp).toLocaleTimeString()}</span>
                                                        <a
                                                            href={`https://${cert.domain}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="mt-1 flex items-center gap-1.5 rounded-sm bg-[#111] px-3 py-1.5 text-[9px] font-medium uppercase tracking-wider text-neutral-400 transition-colors hover:bg-red-500/[0.07] hover:text-red-300 border border-[#242424] hover:border-red-500/25"
                                                        >
                                                            <ExternalLink size={12} /> Inspect
                                                        </a>
                                                    </div>
                                                </div>

                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* SCANNER TAB */}
                {activeTab === 'SCANNER' && (
                    <div className="h-full flex flex-col gap-5 p-5 md:p-6 relative">
                        <div className="bg-[#111] border border-[#1C1C1C] rounded-sm p-5 flex flex-col gap-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                            <div className="flex justify-between items-center">
                                <h3 className="text-sm font-bold text-white uppercase flex items-center gap-2">
                                    <Search size={16} className="text-[#AAA]" /> Domain Typosquatting Scanner
                                </h3>

                                {/* Result Search & Filter */}
                                {scanResults.length > 0 && (
                                    <div className="relative group w-64">
                                        <Search className="absolute left-3 top-2 text-[#888] w-3.5 h-3.5" />
                                        <input
                                            type="text"
                                            placeholder="Filter results..."
                                            className="w-full bg-[#111] border border-[#333] text-xs rounded-full pl-9 pr-4 py-1.5 focus:outline-none focus:border-neutral-500 text-white transition-colors"
                                            value={searchQuery}
                                            onChange={(e) => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
                                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                        />
                                        {showSuggestions && suggestions.length > 0 && (
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-[#111] border border-[#333] rounded-lg shadow-xl overflow-hidden z-20">
                                                {suggestions.map((s, i) => (
                                                    <button
                                                        key={i}
                                                        className="w-full text-left px-4 py-2 text-xs text-neutral-300 hover:bg-[#111] hover:text-[#AAA] flex justify-between items-center"
                                                        onClick={() => setSearchQuery(s.label || '')}
                                                    >
                                                        <span>{s.label}</span>
                                                        <span className="text-[9px] text-[#888] uppercase">{s.type}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    className="flex-1 bg-[#111] border border-[#222] rounded-none px-4 py-2.5 text-xs text-white focus:border-red-500/50 focus:outline-none font-mono transition-colors shadow-inner"
                                    placeholder="Enter official domain (e.g. facebook.com)..."
                                    value={scanTarget}
                                    onChange={(e) => setScanTarget(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                                />
                                <button
                                    onClick={handleScan}
                                    disabled={!scanTarget || isScanning}
                                    className="px-5 py-2.5 bg-red-500/[0.08] border border-red-500/25 hover:bg-red-500/[0.14] text-red-300 font-bold rounded-sm text-[9px] uppercase tracking-[0.12em] flex items-center gap-2 disabled:opacity-50 transition-colors shadow-[0_0_18px_rgba(239,68,68,0.05)]"
                                >
                                    {isScanning ? <RefreshCw className="animate-spin" size={14} /> : <Search size={14} />}
                                    {isScanning ? 'SCANNING...' : 'SCAN'}
                                </button>
                            </div>
                            {isScanning && (
                                <div className="w-full bg-[#151515] h-1 rounded-full overflow-hidden">
                                    <div className="h-full bg-neutral-500 transition-all duration-300" style={{ width: `${scanProgress}%` }}></div>
                                </div>
                            )}
                        </div>

                        {/* Updated Grid Layout */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-transparent border border-[#1B1B1B] p-4 md:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] relative">
                            {/* Removed Grid overlay */}
                            {scanResults.length === 0 && !isScanning ? (
                                <div className="flex flex-col items-center justify-center text-neutral-600 h-full gap-4 relative z-10">
                                    <Globe size={48} className="opacity-20" />
                                    <p className="text-xs font-mono">No active typosquats detected yet. Run a scan to generate permutations.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 content-start pb-4 relative z-10">
                                        {filteredScanResults.slice(0, resultLimit).map((res, i) => {
                                            const riskScore = scoreSimilarity(res.variation, officialDomains);
                                            return (
                                                <div
                                                    key={i}
                                                    className="bg-[#111] border border-[#1A1A1A] rounded-sm overflow-hidden group hover:border-[#333] transition-colors animate-fade-in flex flex-col h-auto cursor-pointer border-t-[3px] border-t-transparent hover:border-t-red-500/50 shadow-sm"
                                                    onClick={() => handleInspect(res)}
                                                >
                                                    <div className="h-28 bg-[#111] relative overflow-hidden shrink-0">
                                                        {res.screenshotUrl ? (
                                                            <img src={res.screenshotUrl} alt="Preview" className="w-full h-full object-cover opacity-55 group-hover:opacity-90 transition-opacity duration-300" />
                                                        ) : (
                                                            <div className="flex items-center justify-center h-full text-neutral-700 bg-[#111]"><Eye size={24} /></div>
                                                        )}
                                                        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                                                            <span className="bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-lg">ACTIVE</span>
                                                            {res.logoMatchScore !== undefined && res.logoMatchScore > 70 && (
                                                                <span className="bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-lg flex items-center gap-1 animate-pulse">
                                                                    <Camera size={8} /> {res.logoMatchScore}% LOGO
                                                                </span>
                                                            )}
                                                            {res.hasMx && (
                                                                <span className="bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-lg flex items-center gap-1" title="Active Mail Server">
                                                                    <Mail size={8} /> MX
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="p-3.5 flex-1 flex flex-col bg-[#111]">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className="font-mono font-bold text-[12px] text-neutral-300 group-hover:text-red-300 transition-colors truncate w-2/3" title={res.variation}>{res.variation}</div>
                                                            <span className="text-[9px] text-[#888] bg-[#111] px-1.5 py-0.5 rounded-sm border border-[#222]">{res.type}</span>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2 text-[10px] text-neutral-500 mb-3 font-mono">
                                                            <div className="flex items-center gap-1.5 truncate" title={res.country || 'Unknown'}>
                                                                <Globe size={10} /> {res.country || 'Unknown'}
                                                            </div>
                                                            <div className="flex items-center gap-1.5 truncate" title={res.ip || 'No IP'}>
                                                                <Layers size={10} /> {res.ip || 'No IP'}
                                                            </div>
                                                        </div>

                                                        <div className="mt-auto pt-2 border-t border-[#1A1A1A] flex justify-between items-center">
                                                            <div className="flex items-center gap-1.5" title="Similarity Risk Score">
                                                                <AlertTriangle size={10} className={riskScore > 80 ? 'text-red-500' : 'text-red-500'} />
                                                                <span className={`text-[10px] font-bold ${riskScore > 80 ? 'text-red-400' : 'text-red-400'}`}>{riskScore}% Risk</span>
                                                            </div>
                                                            <span className="text-[9px] text-[#666] group-hover:text-neutral-300 flex items-center gap-1 font-mono uppercase tracking-widest transition-colors">
                                                                Inspect <ExternalLink size={10} />
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {filteredScanResults.length > resultLimit && (
                                        <div className="flex justify-center py-4">
                                            <button
                                                onClick={() => setResultLimit(prev => prev + 20)}
                                                className="px-6 py-2 bg-[#151515] hover:bg-[#1C1C1C] text-neutral-300 rounded-full text-xs font-bold flex items-center gap-2 transition-colors border border-[#333]"
                                            >
                                                <ArrowDown size={14} /> LOAD MORE ({filteredScanResults.length - resultLimit} remaining)
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Investigation Modal */}
                        {selectedTyposquat && (
                            <div className="fixed inset-0 z-50 bg-[#111]/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedTyposquat(null)}>
                                <div className="bg-[#111] border border-[#2A2A2A] w-full max-w-4xl rounded-sm overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.55)] flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                                    <div className="p-4 bg-[#111]/40 border-b border-[#222] flex justify-between items-start">
                                        <div className="flex items-start gap-4">
                                            <div className="p-3 bg-red-900/20 border border-red-500/30 rounded text-red-500">
                                                <ShieldAlert size={32} />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-bold text-white font-mono">{selectedTyposquat.variation}</h3>
                                                <div className="flex gap-2 mt-1">
                                                    <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded font-bold uppercase">Active Threat</span>
                                                    <span className="text-xs bg-[#151515] text-neutral-300 px-2 py-0.5 rounded border border-[#333]">Type: {selectedTyposquat.type}</span>
                                                    {selectedTyposquat.hasMx && <span className="text-xs bg-red-900/40 text-red-400 px-2 py-0.5 rounded border border-red-500/30 flex items-center gap-1"><Mail size={10} /> Mail Server Active</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <button onClick={() => setSelectedTyposquat(null)} className="text-[#888] hover:text-white"><X size={20} /></button>
                                    </div>

                                    <div className="flex bg-[#111] border-b border-[#222] px-4">
                                        <button
                                            onClick={() => setInvestigationTab('INTEL')}
                                            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${investigationTab === 'INTEL' ? 'border-neutral-500 text-white' : 'border-transparent text-[#888] hover:text-neutral-300'}`}
                                        >
                                            <FileText size={14} /> INTELLIGENCE
                                        </button>
                                        <button
                                            onClick={() => setInvestigationTab('TAKEDOWN')}
                                            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${investigationTab === 'TAKEDOWN' ? 'border-red-500 text-white' : 'border-transparent text-[#888] hover:text-neutral-300'}`}
                                        >
                                            <Gavel size={14} /> TAKEDOWN
                                        </button>
                                    </div>

                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-[#111]/20">
                                        {enrichmentLoading ? (
                                            <div className="flex flex-col items-center justify-center h-48 text-[#888] gap-2">
                                                <Loader2 className="animate-spin text-[#888]" size={32} />
                                                <span className="text-xs font-mono">Gathering WHOIS, Certificate & CERT Data...</span>
                                            </div>
                                        ) : (
                                            investigationTab === 'INTEL' ? (
                                                <div className="space-y-6">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {/* Registrar Info */}
                                                        <div className="bg-[#111] border border-[#222] rounded-lg p-4">
                                                            <h4 className="text-sm font-bold text-red-400 uppercase mb-3 flex items-center gap-2">
                                                                <FileText size={16} /> Registrar Information
                                                            </h4>
                                                            <div className="space-y-2 text-xs font-mono text-neutral-300">
                                                                <div className="flex justify-between border-b border-[#222] pb-1">
                                                                    <span className="text-[#888]">Registrar</span>
                                                                    <span className="text-white">{whoisData?.org || 'Unknown'}</span>
                                                                </div>
                                                                <div className="flex justify-between border-b border-[#222] pb-1">
                                                                    <span className="text-[#888]">Abuse Email</span>
                                                                    <span className="text-[#AAA]">{getAbuseEmail()}</span>
                                                                </div>
                                                                <div className="flex justify-between border-b border-[#222] pb-1">
                                                                    <span className="text-[#888]">Created On</span>
                                                                    <span className="text-white">{whoisData?.registrationDate || 'Unknown'}</span>
                                                                </div>
                                                                <div className="flex justify-between border-b border-[#222] pb-1">
                                                                    <span className="text-[#888]">Expires</span>
                                                                    <span className="text-white">
                                                                        {whoisData?.events?.find((e: any) => e.eventAction === 'expiration')?.eventDate ?
                                                                            new Date(whoisData.events.find((e: any) => e.eventAction === 'expiration').eventDate).toLocaleDateString() :
                                                                            'Unknown'}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between border-b border-[#222] pb-1">
                                                                    <span className="text-[#888]">Domain Age</span>
                                                                    <span className="text-red-400">{getDomainAge()}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Technical Info */}
                                                        <div className="bg-[#111] border border-[#222] rounded-lg p-4">
                                                            <h4 className="text-sm font-bold text-[#AAA] uppercase mb-3 flex items-center gap-2">
                                                                <Server size={16} /> Technical Details
                                                            </h4>
                                                            <div className="space-y-2 text-xs font-mono text-neutral-300">
                                                                <div className="flex justify-between border-b border-[#222] pb-1">
                                                                    <span className="text-[#888]">IP Address</span>
                                                                    <span className="text-white">{selectedTyposquat.ip || 'N/A'}</span>
                                                                </div>
                                                                <div className="flex justify-between border-b border-[#222] pb-1">
                                                                    <span className="text-[#888]">Location</span>
                                                                    <span className="text-white">{selectedTyposquat.country || 'Unknown'}</span>
                                                                </div>
                                                                <div className="flex justify-between border-b border-[#222] pb-1">
                                                                    <span className="text-[#888]">Visual Risk</span>
                                                                    <span className={selectedTyposquat.logoMatchScore && selectedTyposquat.logoMatchScore > 50 ? 'text-red-400' : 'text-red-400'}>
                                                                        {selectedTyposquat.logoMatchScore || 0}% Match
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between border-b border-[#222] pb-1">
                                                                    <span className="text-[#888]">Phonetic Similarity</span>
                                                                    <span className={selectedTyposquat.phoneticMatch ? 'text-red-400 font-bold' : 'text-[#888]'}>
                                                                        {selectedTyposquat.phoneticMatch ? 'DETECTED' : 'NONE'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {/* Certificate Info */}
                                                        <div className="bg-[#111] border border-[#222] rounded-lg p-4">
                                                            <h4 className="text-sm font-bold text-red-400 uppercase mb-3 flex items-center gap-2">
                                                                <Lock size={16} /> SSL Certificate History
                                                            </h4>
                                                            {crtData.length > 0 ? (
                                                                <div className="overflow-x-auto">
                                                                    <table className="w-full text-left text-xs font-mono">
                                                                        <thead className="text-[#888]">
                                                                            <tr>
                                                                                <th className="pb-2">Date</th>
                                                                                <th className="pb-2">Issuer</th>
                                                                                <th className="pb-2">CN</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="text-neutral-300 divide-y divide-neutral-800">
                                                                            {crtData.slice(0, 5).map((crt, i) => (
                                                                                <tr key={i}>
                                                                                    <td className="py-1">{new Date(crt.entry_timestamp).toLocaleDateString()}</td>
                                                                                    <td className="py-1 text-red-300">{crt.issuer_name.split(',')[0]}</td>
                                                                                    <td className="py-1">{crt.common_name}</td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            ) : <div className="text-[#888] text-xs italic">No certificate history found.</div>}
                                                        </div>

                                                        {/* CERT Info */}
                                                        <div className="bg-[#111] border border-[#222] rounded-lg p-4">
                                                            <h4 className="text-sm font-bold text-red-400 uppercase mb-3 flex items-center gap-2">
                                                                <Flag size={16} /> National CERT / CSIRT
                                                            </h4>
                                                            {certContact ? (
                                                                <div className="space-y-3 text-xs font-mono text-neutral-300">
                                                                    <div className="bg-red-900/20 p-2 rounded border border-red-500/30 text-center">
                                                                        <div className="font-bold text-red-400 text-lg mb-1">{certContact.name}</div>
                                                                        <div className="text-[10px] text-[#AAA]">{certContact.country}</div>
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <div className="flex justify-between border-b border-[#222] pb-1">
                                                                            <span className="text-[#888]">Email</span>
                                                                            <span className="text-[#AAA] select-all">{certContact.email}</span>
                                                                        </div>
                                                                        <div className="flex justify-between border-b border-[#222] pb-1">
                                                                            <span className="text-[#888]">Website</span>
                                                                            <a href={certContact.website} target="_blank" rel="noopener noreferrer" className="text-[#AAA] hover:text-white truncate max-w-[150px] block">{certContact.website}</a>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="text-[#888] text-xs italic flex flex-col items-center justify-center h-24">
                                                                    <p>No specific CERT found for {selectedTyposquat.country || 'this region'}.</p>
                                                                    <p className="mt-1">Try FIRST.org for global teams.</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="h-full flex flex-col gap-4">
                                                    <div className="bg-red-900/10 border border-red-500/20 p-4 rounded text-sm text-red-200">
                                                        <div className="font-bold flex items-center gap-2 mb-1"><AlertTriangle size={16} /> LEGAL NOTICE</div>
                                                        This template is generated automatically based on WHOIS data. Verify all details before sending.
                                                        {certContact && <div className="mt-2 text-xs text-red-400 border-t border-red-500/30 pt-2 font-mono">✓ National CERT ({certContact.name}) added to CC.</div>}
                                                    </div>

                                                    <div className="flex-1 flex flex-col gap-2">
                                                        <div className="flex justify-between items-center">
                                                            <label className="text-xs font-bold text-[#888] uppercase">Generated Email Template</label>
                                                            <button
                                                                onClick={() => navigator.clipboard.writeText(getTakedownTemplate())}
                                                                className="text-xs flex items-center gap-1 text-[#AAA] hover:text-white"
                                                            >
                                                                <Copy size={12} /> Copy to Clipboard
                                                            </button>
                                                        </div>
                                                        <textarea
                                                            className="flex-1 bg-[#111] border border-[#333] rounded p-4 text-xs font-mono text-neutral-300 resize-none focus:outline-none focus:border-red-500"
                                                            value={getTakedownTemplate()}
                                                            readOnly
                                                        />
                                                    </div>

                                                    <div className="flex justify-end gap-2">
                                                        <a
                                                            href={`mailto:${getAbuseEmail()}?cc=${certContact?.email || ''}&subject=${encodeURIComponent(`[URGENT] Trademark Infringement: ${selectedTyposquat.variation}`)}&body=${encodeURIComponent(getTakedownTemplate())}`}
                                                            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded text-xs flex items-center gap-2 transition-colors"
                                                        >
                                                            <Mail size={14} /> OPEN MAIL CLIENT
                                                        </a>
                                                    </div>
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* REPUTATION MONITOR TAB */}
                {activeTab === 'REPUTATION' && (
                    <div className="h-full p-5 md:p-6 flex flex-col gap-5">
                        {/* Input Area */}
                        <div className="bg-[#111] border border-[#1C1C1C] rounded-sm p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-white uppercase flex items-center gap-2">
                                    <Siren size={16} className="text-red-400" /> Reputation Monitor
                                </h3>
                                <button
                                    onClick={handleCheckAllAssets}
                                    disabled={isCheckingReputation || monitoredAssets.length === 0}
                                    className="px-4 py-2 bg-red-900/20 text-red-400 border border-red-500/30 rounded text-xs font-bold hover:bg-red-900/40 transition-colors flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isCheckingReputation ? <RefreshCw className="animate-spin" size={14} /> : <RefreshCw size={14} />} CHECK ALL
                                </button>
                            </div>

                            <div className="flex gap-2 items-center">
                                <select
                                    className="bg-[#111] border border-[#333] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                                    value={newAssetType}
                                    onChange={(e) => setNewAssetType(e.target.value as any)}
                                >
                                    <option value="DOMAIN">Domain</option>
                                    <option value="IP">IP Address</option>
                                    <option value="EMAIL">Email</option>
                                </select>
                                <input
                                    type="text"
                                    className="flex-1 bg-[#111] border border-[#333] rounded px-4 py-2 text-sm text-white focus:border-red-500 focus:outline-none font-mono"
                                    placeholder={newAssetType === 'DOMAIN' ? 'example.com' : newAssetType === 'IP' ? '1.2.3.4' : 'admin@example.com'}
                                    value={newAssetValue}
                                    onChange={(e) => setNewAssetValue(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddAsset()}
                                />
                                <button
                                    onClick={handleAddAsset}
                                    disabled={!newAssetValue}
                                    className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded text-xs flex items-center gap-2 disabled:opacity-50"
                                >
                                    <Plus size={14} /> ADD ASSET
                                </button>
                            </div>
                        </div>

                        {/* Assets List */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {monitoredAssets.length === 0 ? (
                                <div className="text-center text-[#888] text-xs italic mt-10">
                                    No assets monitored. Add a domain, IP, or email to check reputation.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-4">
                                    {monitoredAssets.map(asset => (
                                        <div key={asset.id} className="bg-[#111] border border-[#1D1D1D] rounded-sm p-4 hover:border-red-500/25 transition-all group shadow-[0_1px_0_rgba(255,255,255,0.015)]">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2">
                                                    {asset.type === 'DOMAIN' ? <Globe size={14} className="text-[#AAA]" /> : asset.type === 'IP' ? <Layers size={14} className="text-red-400" /> : <Mail size={14} className="text-red-400" />}
                                                    <span className="text-xs font-bold text-[#888] bg-[#111]/40 px-1.5 rounded border border-[#333]">{asset.type}</span>
                                                </div>
                                                <button onClick={() => handleRemoveAsset(asset.id)} className="text-neutral-600 hover:text-red-400"><Trash2 size={14} /></button>
                                            </div>

                                            <div className="text-[13px] font-bold text-white font-mono truncate mb-3" title={asset.value}>{asset.value}</div>

                                            <div className="flex justify-between items-center mb-3">
                                                <div className={`px-2 py-0.5 rounded text-[10px] font-bold border ${asset.status === 'CLEAN' ? 'bg-red-900/20 text-red-400 border-red-500/30' :
                                                        asset.status === 'ALERT' ? 'bg-red-900/20 text-red-400 border-red-500/30' :
                                                            asset.status === 'CHECKING' ? 'bg-[#111] text-[#AAA] border-neutral-500/30' :
                                                                'bg-[#151515] text-[#AAA] border-[#333]'
                                                    }`}>
                                                    {asset.status === 'CHECKING' ? <span className="flex items-center gap-1"><RefreshCw size={8} className="animate-spin" /> CHECKING</span> : asset.status}
                                                </div>
                                                <span className="text-[9px] text-neutral-600">
                                                    {asset.lastChecked ? new Date(asset.lastChecked).toLocaleTimeString() : 'Never Checked'}
                                                </span>
                                            </div>

                                            {asset.status === 'ALERT' && asset.detections.length > 0 && (
                                                <div className="bg-red-900/10 border border-red-500/20 rounded p-2 text-[10px] text-red-300 font-mono max-h-24 overflow-y-auto custom-scrollbar">
                                                    {asset.detections.map((d, i) => <div key={i} className="truncate" title={d}>• {d}</div>)}
                                                </div>
                                            )}

                                            <button
                                                onClick={() => handleCheckAsset(asset.id)}
                                                disabled={asset.status === 'CHECKING'}
                                                className="w-full mt-3 py-1.5 bg-[#151515] hover:bg-[#1C1C1C] text-neutral-300 rounded text-[10px] font-bold transition-colors"
                                            >
                                                RE-CHECK
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* CONFIG TAB */}
                {activeTab === 'CONFIG' && (
                    <div className="h-full overflow-y-auto custom-scrollbar p-6">
                        <div className="max-w-5xl mx-auto space-y-4 animate-fade-in pb-10">
                            {/* Keyword Management */}
                            <div className="bg-[#111] border border-[#1C1C1C] rounded-sm p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                                <h3 className="text-sm font-bold text-white mb-4 uppercase flex items-center gap-2">
                                    <Layers size={16} className="text-[#AAA]" /> Monitored Keywords
                                </h3>
                                <div className="flex gap-2 mb-4">
                                    <input
                                        type="text"
                                        className="flex-1 bg-[#111] border border-[#333] rounded px-3 py-2 text-sm text-white focus:border-red-500 focus:outline-none"
                                        placeholder="Add brand keyword (e.g. brandname)..."
                                        value={newKeyword}
                                        onChange={(e) => setNewKeyword(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                                    />
                                    <button onClick={handleAddKeyword} className="px-4 bg-[#111] hover:bg-[#151515] text-neutral-200 rounded-sm font-bold text-[10px] uppercase tracking-wider border border-[#2E2E2E]">
                                        ADD
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {keywords.map(k => (
                                        <div key={k} className="px-2.5 py-1 bg-[#111] border border-[#282828] rounded-sm flex items-center gap-2 text-[11px] text-neutral-300">
                                            {k}
                                            <button onClick={() => handleRemoveKeyword(k)} className="hover:text-red-400"><XCircle size={14} /></button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Official Domains */}
                            <div className="bg-[#111] border border-[#1C1C1C] rounded-sm p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                                <h3 className="text-sm font-bold text-white mb-4 uppercase flex items-center gap-2">
                                    <Globe size={16} className="text-[#AAA]" /> Official Domains (Whitelist)
                                </h3>
                                <div className="flex gap-2 mb-4">
                                    <input
                                        type="text"
                                        className="flex-1 bg-[#111] border border-[#333] rounded px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
                                        placeholder="Add official domain (e.g. example.com)..."
                                        value={newDomain}
                                        onChange={(e) => setNewDomain(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
                                    />
                                    <button onClick={handleAddDomain} className="px-4 bg-[#111] hover:bg-[#151515] text-neutral-200 rounded-sm font-bold text-[10px] uppercase tracking-wider border border-[#2E2E2E]">
                                        ADD
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {officialDomains.map(d => (
                                        <div key={d} className="px-2.5 py-1 bg-[#111] border border-neutral-500/20 rounded-sm flex items-center gap-2 text-[11px] text-neutral-300">
                                            {d}
                                            <button onClick={() => handleRemoveDomain(d)} className="hover:text-white"><XCircle size={14} /></button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Visual Identity & Thresholds */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-[#111] border border-[#1C1C1C] rounded-sm p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                                    <h3 className="text-sm font-bold text-white mb-4 uppercase flex items-center gap-2">
                                        <Image size={16} className="text-red-400" /> Brand Logo
                                    </h3>
                                    <div className="flex items-center gap-4">
                                        <div className="w-20 h-20 bg-[#111]/60 border border-[#333] rounded-lg flex items-center justify-center overflow-hidden">
                                            {officialLogo ? (
                                                <img src={officialLogo} alt="Logo" className="max-w-full max-h-full object-contain" />
                                            ) : (
                                                <Image size={32} className="text-neutral-600 opacity-50" />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-xs text-[#888] mb-2">Upload official logo for visual similarity detection using TensorFlow.js</p>
                                            <div className="flex gap-2">
                                                <label className="px-3 py-2 bg-[#151515] hover:bg-[#1C1C1C] border border-neutral-600 rounded text-xs text-white cursor-pointer flex items-center gap-2">
                                                    <Upload size={12} /> Upload
                                                    <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                                                </label>
                                                {officialLogo && (
                                                    <button onClick={() => setOfficialLogo(null)} className="p-2 text-red-400 hover:bg-red-900/20 rounded border border-transparent hover:border-red-500/30">
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-[#111] border border-[#1C1C1C] rounded-sm p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                                    <h3 className="text-sm font-bold text-white mb-4 uppercase flex items-center gap-2">
                                        <Settings size={16} className="text-red-400" /> Sensitivity Config
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="text-[#AAA]">Fuzzy Match Threshold</span>
                                                <span className="text-white font-mono">{fuzzyThreshold}%</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                value={fuzzyThreshold}
                                                onChange={(e) => setFuzzyThreshold(parseInt(e.target.value))}
                                                className="w-full h-1 bg-[#1C1C1C] rounded-lg appearance-none cursor-pointer accent-red-500"
                                            />
                                            <p className="text-[10px] text-[#888] mt-1">
                                                Lower values detect more variations but increase false positives.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};




