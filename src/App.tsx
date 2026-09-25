
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ResultsTable } from '../components/ResultsTable';
import { SettingsModal } from '../components/SettingsModal';
import { AppState, LogEntry, AnalyzedHost, MmdbStatus, MalpediaEntry, MalpediaActor, CveEntry, CveFeedItem, ThreatNewsItem, ExploitEntry, AppSettings, UrlHausEntry, MalwareBazaarEntry, FeodoTrackerEntry, SslBlEntry, Ja3FingerprintEntry, ThreatFoxEntry, SystemLogEntry, RansomWatchPost, RansomWatchGroup, IpsumEntry, BlocklistDeEntry, WhitelistEntry, C2IntelFeedEntry, MaliciousHashEntry, NetworkAnalysisResult, EmailAnalysisResult } from '../types';
import { analyzeLogs, recalculateHostScore, convertFeedToHosts } from '../services/analyzer';
import { enrichIP, checkRBL, resolveHostname, fetchExtendedSecurityInfo } from '../services/dns';
import { fetchOtxIndicator } from '../services/otx';
import { mmdbService } from '../services/mmdb';
import { parseMalpediaBib, fetchRemoteMalpedia } from '../services/malpedia';
import { fetchMitreFromSource } from '../services/mitre';
import { fetchCveFeeds } from '../services/cveFeed';
import { fetchCveUpdates } from '../services/cve';
import { fetchThreatNews } from '../services/news';
import { fetchExploits } from '../services/exploit';
import { fetchUrlHaus } from '../services/urlhaus';
import { fetchMalwareBazaar } from '../services/malwarebazaar';
import { fetchFeodoTracker } from '../services/feodotracker';
import { fetchSslBl, fetchJa3Bl } from '../services/sslbl';
import { fetchThreatFox } from '../services/threatfox';
import { fetchRansomwarePosts, fetchRansomwareGroups } from '../services/ransomwatch';
import { fetchIpsum } from '../services/ipsum';
import { fetchBlocklistDe } from '../services/blocklistDe';
import { fetchC2IntelFeed } from '../services/c2intelfeed';
import { fetchMaliciousHashes } from '../services/maliciousHash';
import { saveToStorage, loadFromStorage, clearStorage, STORES } from '../services/storage';
import { AlertCircle, CheckCircle, XCircle, Info } from 'lucide-react';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import CommandPalette from './components/layout/CommandPalette';
import { canonicalViewId } from './data/navigation';

interface Toast {
    id: string;
    message: string;
    type: 'info' | 'success' | 'error';
}

const DEFAULT_SETTINGS: AppSettings = {
    theme: 'CYBER',
    animationsEnabled: true,
    retentionMinutes: 60,
    showMap: true,
    productName: 'ANTITODE',
    logoUrl: ''
};

export const App: React.FC = () => {
    const [appState, setAppState] = useState<AppState>(AppState.RESULTS);
    const [settings, setSettings] = useState<AppSettings>(() => {
        try {
            const saved = localStorage.getItem('xyberah_settings');
            return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
        } catch (e) {
            return DEFAULT_SETTINGS;
        }
    });
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const [analysisResults, setAnalysisResults] = useState<AnalyzedHost[]>([]);
    const [c2Hosts, setC2Hosts] = useState<AnalyzedHost[]>([]);

    const [networkAnalysis, setNetworkAnalysis] = useState<NetworkAnalysisResult | null>(null);
    const [emailAnalysis, setEmailAnalysis] = useState<EmailAnalysisResult | null>(null);

    const [malpediaData, setMalpediaData] = useState<MalpediaEntry[]>([]);
    const [malpediaActors, setMalpediaActors] = useState<MalpediaActor[]>([]);
    const [cveData, setCveData] = useState<CveEntry[]>([]);
    const [cveFeedItems, setCveFeedItems] = useState<CveFeedItem[]>([]);
    const [urlHausItems, setUrlHausItems] = useState<UrlHausEntry[]>([]);
    const [malwareBazaarItems, setMalwareBazaarItems] = useState<MalwareBazaarEntry[]>([]);
    const [feodoItems, setFeodoItems] = useState<FeodoTrackerEntry[]>([]);
    const [sslBlItems, setSslBlItems] = useState<SslBlEntry[]>([]);
    const [ja3Items, setJa3Items] = useState<Ja3FingerprintEntry[]>([]);
    const [threatFoxItems, setThreatFoxItems] = useState<ThreatFoxEntry[]>([]);
    const [ipsumItems, setIpsumItems] = useState<IpsumEntry[]>([]);
    const [blocklistDeItems, setBlocklistDeItems] = useState<BlocklistDeEntry[]>([]);
    const [c2IntelItems, setC2IntelItems] = useState<C2IntelFeedEntry[]>([]);
    const [maliciousHashItems, setMaliciousHashItems] = useState<MaliciousHashEntry[]>([]);
    const [ransomwarePosts, setRansomwarePosts] = useState<RansomWatchPost[]>([]);
    const [ransomwareGroups, setRansomwareGroups] = useState<RansomWatchGroup[]>([]);
    const [exploitData, setExploitData] = useState<ExploitEntry[]>([]);
    const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
    const [isFeedLoading, setIsFeedLoading] = useState(false);

    const [isStorageLoaded, setIsStorageLoaded] = useState(false);
    const [newsItems, setNewsItems] = useState<ThreatNewsItem[]>([]);
    const [newsLastUpdated, setNewsLastUpdated] = useState<Date | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [mmdbStatus, setMmdbStatus] = useState<MmdbStatus>(MmdbStatus.OFFLINE);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [systemLogs, setSystemLogs] = useState<SystemLogEntry[]>([]);

    const enrichmentQueue = useRef<AnalyzedHost[]>([]);
    const isProcessingQueue = useRef(false);
    const rblQueue = useRef<AnalyzedHost[]>([]);
    const isProcessingRbl = useRef(false);
    const dnsQueue = useRef<AnalyzedHost[]>([]);
    const isProcessingDns = useRef(false);
    const otxQueue = useRef<AnalyzedHost[]>([]);
    const isProcessingOtx = useRef(false);

    const addSystemLog = (message: string, level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS', source: string) => {
        const entry: SystemLogEntry = {
            id: crypto.randomUUID(),
            timestamp: new Date(),
            level,
            message,
            source
        };
        setSystemLogs(prev => [entry, ...prev].slice(0, 200));
    };

    const addToast = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
        const id = crypto.randomUUID();
        setToasts(prev => [...prev, { id, message: msg, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 5000);
    };

    const processEnrichmentQueue = async () => {
        if (isProcessingQueue.current) return;
        isProcessingQueue.current = true;
        while (enrichmentQueue.current.length > 0) {
            const host = enrichmentQueue.current.shift();
            if (host && !host.enrichmentData) {
                try {
                    const data = await enrichIP(host.ip);
                    if (data) {
                        setAnalysisResults(prev => prev.map(h => h.ip === host.ip ? recalculateHostScore({ ...h, enrichmentData: data, country: data.country_name }) : h));
                    }
                } catch (e) { }
                await new Promise(r => setTimeout(r, 200));
            }
        }
        isProcessingQueue.current = false;
    };

    const processRblQueue = async () => {
        if (isProcessingRbl.current) return;
        isProcessingRbl.current = true;
        while (rblQueue.current.length > 0) {
            const host = rblQueue.current.shift();
            if (host && (!host.rblStatus || host.rblStatus === 'CHECKING')) {
                try {
                    const res = await checkRBL(host.ip);
                    setAnalysisResults(prev => prev.map(h => h.ip === host.ip ? recalculateHostScore({ ...h, rblStatus: res.status, rblListedIn: res.listedIn }) : h));
                } catch (e) { }
                await new Promise(r => setTimeout(r, 100));
            }
        }
        isProcessingRbl.current = false;
    };

    const processDnsQueue = async () => {
        if (isProcessingDns.current) return;
        isProcessingDns.current = true;
        while (dnsQueue.current.length > 0) {
            const host = dnsQueue.current.shift();
            if (host && !host.dnsHostname) {
                try {
                    const hostname = await resolveHostname(host.ip);
                    if (hostname) {
                        setAnalysisResults(prev => prev.map(h => h.ip === host.ip ? { ...h, dnsHostname: hostname } : h));
                    }
                } catch (e) { }
                await new Promise(r => setTimeout(r, 50));
            }
        }
        isProcessingDns.current = false;
    };

    const processOtxQueue = async () => {
        if (isProcessingOtx.current) return;
        isProcessingOtx.current = true;
        while (otxQueue.current.length > 0) {
            const host = otxQueue.current.shift();
            if (host && !host.otxData) {
                try {
                    const otx = await fetchOtxIndicator(host.ip);
                    if (otx) {
                        setAnalysisResults(prev => prev.map(h => h.ip === host.ip ? { ...h, otxData: otx } : h));
                    }
                } catch (e) { }
                await new Promise(r => setTimeout(r, 1000));
            }
        }
        isProcessingOtx.current = false;
    };

    const enrichData = (hosts: AnalyzedHost[]) => {
        hosts.forEach(h => {
            if (!h.enrichmentData) enrichmentQueue.current.push(h);
            if (!h.rblStatus || h.rblStatus === 'CHECKING') rblQueue.current.push(h);
            if (!h.dnsHostname) dnsQueue.current.push(h);
        });
        processEnrichmentQueue();
        processRblQueue();
        processDnsQueue();
    };

    const handleDataLoaded = (data: LogEntry[]) => {
        setErrorMsg(null);
        setAppState(AppState.ANALYZING);
        addSystemLog(`Processing log batch of ${data.length} entries.`, "INFO", "Analyzer");
        setTimeout(async () => {
            try {
                let results = await analyzeLogs(data, urlHausSet, bazaarSet, feodoSet, threatFoxSet, ipsumSet, whitelist, c2IntelMap);
                const status = mmdbService.getStatus();
                if (status.city || status.asn) {
                    results = results.map(host => {
                        const mmdbData = mmdbService.lookup(host.ip);
                        if (mmdbData) return { ...host, country: mmdbData.country_name, enrichmentData: mmdbData };
                        return host;
                    });
                }
                setAnalysisResults(results);
                setAppState(AppState.RESULTS);
                addToast(`Analysis Complete: ${results.length} Hosts Processed`, 'success');
                addSystemLog(`Analysis completed for ${results.length} hosts.`, "SUCCESS", "Analyzer");
                enrichData(results);
            } catch (e) {
                setErrorMsg("Critical Error during analysis routine.");
                setAppState(AppState.RESULTS);
                addToast("Analysis failed due to a critical error.", 'error');
            }
        }, 1000);
    };

    const handleAddLogs = (data: LogEntry[]) => handleDataLoaded(data);

    const handleReset = () => {
        setAnalysisResults([]);
        setC2Hosts([]);
        setNetworkAnalysis(null);
        setEmailAnalysis(null);
        setAppState(AppState.IDLE);
        enrichmentQueue.current = [];
        rblQueue.current = [];
        dnsQueue.current = [];
        otxQueue.current = [];
        addToast('System reset.', 'info');
    };

    const urlHausSet = useMemo(() => {
        const set = new Set<string>();
        urlHausItems.forEach(item => {
            try {
                const u = new URL(item.url);
                set.add(u.hostname);
            } catch {
                const parts = item.url.split('/');
                if (parts[0]) set.add(parts[0]);
            }
        });
        return set;
    }, [urlHausItems]);

    const bazaarSet = useMemo(() => {
        const set = new Set<string>();
        malwareBazaarItems.forEach(item => {
            if (item.sha256_hash) set.add(item.sha256_hash.toLowerCase());
            if (item.md5_hash) set.add(item.md5_hash.toLowerCase());
            if (item.sha1_hash) set.add(item.sha1_hash.toLowerCase());
        });
        sslBlItems.forEach(item => { if (item.sha1) set.add(item.sha1.toLowerCase()); });
        ja3Items.forEach(item => { if (item.ja3_md5) set.add(item.ja3_md5.toLowerCase()); });
        maliciousHashItems.forEach(item => { set.add(item.hash.toLowerCase()); });
        return set;
    }, [malwareBazaarItems, sslBlItems, ja3Items, maliciousHashItems]);

    const feodoSet = useMemo(() => {
        const set = new Set<string>();
        feodoItems.forEach(item => { set.add(item.ip_address); });
        return set;
    }, [feodoItems]);

    const threatFoxSet = useMemo(() => {
        const set = new Set<string>();
        threatFoxItems.forEach(item => {
            set.add(item.ioc_value.toLowerCase());
            if (item.ioc_type === 'ip:port') {
                const ip = item.ioc_value.split(':')[0];
                if (ip) set.add(ip);
            }
            if (item.ioc_type === 'url') {
                try {
                    const u = new URL(item.ioc_value);
                    set.add(u.hostname.toLowerCase());
                } catch (e) { }
            }
        });
        return set;
    }, [threatFoxItems]);

    const ipsumSet = useMemo(() => {
        const set = new Set<string>();
        ipsumItems.forEach(item => { set.add(item.ip); });
        return set;
    }, [ipsumItems]);

    const c2IntelMap = useMemo(() => {
        const map = new Map<string, C2IntelFeedEntry>();
        c2IntelItems.forEach(item => { map.set(item.ip, item); });
        return map;
    }, [c2IntelItems]);

    useEffect(() => {
        if (c2IntelItems.length > 0) {
            const timer = setTimeout(() => {
                const converted = convertFeedToHosts(c2IntelItems);
                setC2Hosts(converted);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [c2IntelItems]);

    const combinedResults = useMemo(() => {
        const logIps = new Set(analysisResults.map(h => h.ip));
        const uniqueC2 = c2Hosts.filter(h => !logIps.has(h.ip));
        return [...analysisResults, ...uniqueC2].sort((a, b) => b.totalScore - a.totalScore);
    }, [analysisResults, c2Hosts]);

    useEffect(() => {
        addSystemLog("System initialized. Loading storage persistence...", "INFO", "System");
        const restoreSession = async () => {
            try {
                const [
                    savedAnalysis, savedActors, savedCves, savedRefs, savedUrlHaus,
                    savedBazaar, savedFeodo, savedSslBl, savedJa3, savedThreatFox,
                    savedIpsum, savedBlocklistDe, savedC2Intel, savedRansomPosts, savedRansomGroups,
                    savedWhitelist, savedNetwork, savedEmail
                ] = await Promise.all([
                    loadFromStorage(STORES.ANALYSIS), loadFromStorage(STORES.ACTORS), loadFromStorage(STORES.CVES),
                    loadFromStorage(STORES.REFS), loadFromStorage(STORES.URLHAUS), loadFromStorage(STORES.BAZAAR),
                    loadFromStorage(STORES.FEODO), loadFromStorage(STORES.SSLBL_SHA1), loadFromStorage(STORES.SSLBL_JA3),
                    loadFromStorage(STORES.THREATFOX), loadFromStorage(STORES.IPSUM), loadFromStorage(STORES.BLOCKLIST_DE),
                    loadFromStorage(STORES.C2_INTEL), loadFromStorage(STORES.RANSOMWARE_POSTS), loadFromStorage(STORES.RANSOMWARE_GROUPS),
                    loadFromStorage(STORES.WHITELIST), loadFromStorage(STORES.NETWORK_FORENSICS), loadFromStorage(STORES.EMAIL_FORENSICS)
                ]);

                if (savedAnalysis && Array.isArray(savedAnalysis) && savedAnalysis.length > 0) {
                    setAnalysisResults(savedAnalysis);
                    setAppState(AppState.RESULTS);
                    addToast(`Session Restored: ${savedAnalysis.length} hosts loaded`, 'info');
                    addSystemLog(`Session restored with ${savedAnalysis.length} hosts.`, "INFO", "Storage");
                }
                if (savedActors) setMalpediaActors(savedActors);
                if (savedCves) setCveData(savedCves);
                if (savedRefs) setMalpediaData(savedRefs);
                if (savedUrlHaus) setUrlHausItems(savedUrlHaus);
                if (savedBazaar) setMalwareBazaarItems(savedBazaar);
                if (savedFeodo) setFeodoItems(savedFeodo);
                if (savedSslBl) setSslBlItems(savedSslBl);
                if (savedJa3) setJa3Items(savedJa3);
                if (savedThreatFox) setThreatFoxItems(savedThreatFox);
                if (savedIpsum) setIpsumItems(savedIpsum);
                if (savedBlocklistDe) setBlocklistDeItems(savedBlocklistDe);
                if (savedC2Intel) setC2IntelItems(savedC2Intel);
                if (savedRansomPosts) setRansomwarePosts(savedRansomPosts);
                if (savedRansomGroups) setRansomwareGroups(savedRansomGroups);
                if (savedWhitelist) setWhitelist(savedWhitelist);
                if (savedNetwork) setNetworkAnalysis(savedNetwork);
                if (savedEmail) setEmailAnalysis(savedEmail);
            } catch (e) {
                console.warn("Failed to restore session data", e);
                addSystemLog("Failed to restore session data from IndexedDB.", "WARN", "Storage");
            } finally {
                setIsStorageLoaded(true);
            }
        };
        restoreSession();
    }, []);

    const handleMmdbLoaded = async (files: File[]) => {
        try {
            const typesLoaded: string[] = [];
            for (const file of files) {
                const type = await mmdbService.loadDatabase(file);
                typesLoaded.push(type);
            }
            const status = mmdbService.getStatus();
            setMmdbStatus((status.city || status.asn) ? MmdbStatus.ONLINE : MmdbStatus.OFFLINE);
            addToast(`MMDB Loaded: ${typesLoaded.join(', ')}`, 'success');
        } catch (e) { addToast("Failed to parse MMDB file.", 'error'); }
    };

    const handleMalpediaLoaded = async (files: File[]) => {
        try {
            const file = files[0];
            const data = await parseMalpediaBib(file);
            setMalpediaData(data);
            addToast(`Loaded ${data.length} Malpedia references`, 'success');
        } catch (e) { addToast("Failed to parse Malpedia Bib file", 'error'); }
    };

    const handleMalpediaActorsLoaded = (actors: MalpediaActor[]) => {
        setMalpediaActors(actors);
        addToast(`Loaded ${actors.length} Threat Actors`, 'success');
    };

    const handleCveLoaded = (cves: CveEntry[]) => {
        setCveData(cves);
        addToast(`Loaded ${cves.length} CVEs`, 'success');
    };

    useEffect(() => {
        if (!isStorageLoaded) return;
        const loadBaselineData = async () => {
            const status = mmdbService.getStatus();
            const filesToLoad: File[] = [];
            if (!status.city) {
                try {
                    let res = await fetch('/data/GeoLite2-City.mmdb');
                    if (!res.ok) res = await fetch('/data/GeoLite2-Country.mmdb');
                    if (res.ok) {
                        const blob = await res.blob();
                        const filename = res.url.split('/').pop() || 'GeoLite2.mmdb';
                        filesToLoad.push(new File([blob], filename, { type: 'application/octet-stream' }));
                    }
                } catch (e) { }
            }
            if (!status.asn) {
                try {
                    const res = await fetch('/data/GeoLite2-ASN.mmdb');
                    if (res.ok) {
                        const blob = await res.blob();
                        filesToLoad.push(new File([blob], "GeoLite2-ASN.mmdb", { type: 'application/octet-stream' }));
                    }
                } catch (e) { }
            }
            if (filesToLoad.length > 0) {
                await handleMmdbLoaded(filesToLoad);
                addSystemLog(`Auto-loaded ${filesToLoad.length} MMDB file(s).`, "INFO", "System");
            }
            if (malpediaData.length === 0) {
                try {
                    const res = await fetch('/data/malpedia.bib');
                    if (res.ok) {
                        const blob = await res.blob();
                        const file = new File([blob], "malpedia.bib");
                        await handleMalpediaLoaded([file]);
                    }
                } catch (e) { }
            }
            if (analysisResults.length === 0) {
                try {
                    const res = await fetch('/data/base_logs.json');
                    if (res.ok) {
                        const json = await res.json();
                        if (Array.isArray(json)) {
                            handleDataLoaded(json);
                            addSystemLog("Loaded default base logs.", "INFO", "System");
                        }
                    }
                } catch (e) { }
            }
        };
        loadBaselineData();
    }, [isStorageLoaded, analysisResults.length, malpediaData.length]);

    useEffect(() => {
        if (!isStorageLoaded) return;
        const timeout = setTimeout(() => { saveToStorage(STORES.ANALYSIS, analysisResults); }, 2000);
        return () => clearTimeout(timeout);
    }, [analysisResults, isStorageLoaded]);

    useEffect(() => { if (isStorageLoaded) saveToStorage(STORES.ACTORS, malpediaActors); }, [malpediaActors, isStorageLoaded]);
    useEffect(() => { if (isStorageLoaded) saveToStorage(STORES.CVES, cveData); }, [cveData, isStorageLoaded]);
    useEffect(() => { if (isStorageLoaded) saveToStorage(STORES.REFS, malpediaData); }, [malpediaData, isStorageLoaded]);
    useEffect(() => { if (isStorageLoaded) saveToStorage(STORES.URLHAUS, urlHausItems); }, [urlHausItems, isStorageLoaded]);
    useEffect(() => { if (isStorageLoaded) saveToStorage(STORES.BAZAAR, malwareBazaarItems); }, [malwareBazaarItems, isStorageLoaded]);
    useEffect(() => { if (isStorageLoaded) saveToStorage(STORES.FEODO, feodoItems); }, [feodoItems, isStorageLoaded]);
    useEffect(() => { if (isStorageLoaded) saveToStorage(STORES.SSLBL_SHA1, sslBlItems); }, [sslBlItems, isStorageLoaded]);
    useEffect(() => { if (isStorageLoaded) saveToStorage(STORES.SSLBL_JA3, ja3Items); }, [ja3Items, isStorageLoaded]);
    useEffect(() => { if (isStorageLoaded) saveToStorage(STORES.THREATFOX, threatFoxItems); }, [threatFoxItems, isStorageLoaded]);
    useEffect(() => { if (isStorageLoaded) saveToStorage(STORES.IPSUM, ipsumItems); }, [ipsumItems, isStorageLoaded]);
    useEffect(() => { if (isStorageLoaded) saveToStorage(STORES.BLOCKLIST_DE, blocklistDeItems); }, [blocklistDeItems, isStorageLoaded]);
    useEffect(() => { if (isStorageLoaded) saveToStorage(STORES.C2_INTEL, c2IntelItems); }, [c2IntelItems, isStorageLoaded]);
    useEffect(() => { if (isStorageLoaded) saveToStorage(STORES.RANSOMWARE_POSTS, ransomwarePosts); }, [ransomwarePosts, isStorageLoaded]);
    useEffect(() => { if (isStorageLoaded) saveToStorage(STORES.RANSOMWARE_GROUPS, ransomwareGroups); }, [ransomwareGroups, isStorageLoaded]);
    useEffect(() => { if (isStorageLoaded) saveToStorage(STORES.WHITELIST, whitelist); }, [whitelist, isStorageLoaded]);
    useEffect(() => { if (isStorageLoaded) saveToStorage(STORES.NETWORK_FORENSICS, networkAnalysis); }, [networkAnalysis, isStorageLoaded]);
    useEffect(() => { if (isStorageLoaded) saveToStorage(STORES.EMAIL_FORENSICS, emailAnalysis); }, [emailAnalysis, isStorageLoaded]);

    useEffect(() => {
        const root = document.documentElement;
        document.body.classList.remove('theme-light', 'theme-sentinel', 'theme-fortress', 'theme-cyber', 'theme-dark', 'theme-terminal', 'theme-nordic', 'theme-ember');
        document.body.classList.add(`theme-${settings.theme.toLowerCase()}`);
        switch (settings.theme) {
            case 'LIGHT':
                root.style.setProperty('--color-bg-primary', '#f0f4f8'); root.style.setProperty('--color-bg-secondary', '#ffffff');
                root.style.setProperty('--color-bg-glass', 'rgba(255, 255, 255, 0.90)'); root.style.setProperty('--color-accent-primary', '#0f172a');
                root.style.setProperty('--color-accent-secondary', '#3b82f6'); root.style.setProperty('--color-bg-grid', '#e2e8f0');
                break;
            case 'SENTINEL':
                root.style.setProperty('--color-bg-primary', 'transparent'); root.style.setProperty('--color-bg-secondary', 'rgba(5, 15, 30, 0.6)');
                root.style.setProperty('--color-bg-glass', 'rgba(2, 6, 12, 0.4)'); root.style.setProperty('--color-accent-primary', '#00f3ff');
                root.style.setProperty('--color-accent-secondary', '#0066ff'); root.style.setProperty('--color-bg-grid', '#001122');
                break;
            case 'DARK':
                root.style.setProperty('--color-bg-primary', '#0f172a'); root.style.setProperty('--color-bg-secondary', '#1e293b');
                root.style.setProperty('--color-bg-glass', 'rgba(30, 41, 59, 0.8)'); root.style.setProperty('--color-accent-primary', '#38bdf8');
                root.style.setProperty('--color-accent-secondary', '#a78bfa'); root.style.setProperty('--color-bg-grid', '#0f172a');
                break;
            default:
                root.style.setProperty('--color-bg-primary', '#020617'); root.style.setProperty('--color-bg-secondary', '#0f172a');
                root.style.setProperty('--color-bg-glass', 'rgba(15, 23, 42, 0.7)'); root.style.setProperty('--color-accent-primary', '#4361ee');
                root.style.setProperty('--color-accent-secondary', '#f72585'); root.style.setProperty('--color-bg-grid', '#020617');
                break;
        }
    }, [settings.theme]);

    useEffect(() => { localStorage.setItem('xyberah_settings', JSON.stringify(settings)); }, [settings]);

    const handleRefreshAll = async () => {
        addSystemLog("Initiating global intelligence refresh...", "INFO", "System");
        await Promise.allSettled([
            fetchThreatNews().then(items => { setNewsItems(items); setNewsLastUpdated(new Date()); }),
            fetchRemoteMalpedia().then(setMalpediaActors),
            fetchMitreFromSource().then(a => setMalpediaActors(prev => [...prev, ...a])),
            fetchUrlHaus().then(setUrlHausItems),
            fetchMalwareBazaar().then(setMalwareBazaarItems),
            fetchFeodoTracker().then(setFeodoItems),
            fetchSslBl().then(setSslBlItems),
            fetchJa3Bl().then(setJa3Items),
            fetchThreatFox().then(setThreatFoxItems),
            fetchIpsum().then(setIpsumItems),
            fetchBlocklistDe().then(setBlocklistDeItems),
            fetchC2IntelFeed().then(setC2IntelItems),
            fetchMaliciousHashes().then(setMaliciousHashItems),
            fetchRansomwarePosts().then(setRansomwarePosts),
            fetchRansomwareGroups().then(setRansomwareGroups),
            fetchCveUpdates().then(setCveData),
            fetchCveFeeds().then(setCveFeedItems),
            fetchExploits().then(setExploitData)
        ]);
        addSystemLog("Intelligence refresh completed.", "SUCCESS", "System");
        addToast("All Intelligence Feeds Refreshed", 'success');
    };

    useEffect(() => { if (isStorageLoaded) handleRefreshAll(); }, [isStorageLoaded]);

    const handleClearData = async () => {
        await clearStorage();
        localStorage.clear();
        window.location.reload();
    };

    const handleEnrichHost = (host: AnalyzedHost) => {
        if (host.otxData || otxQueue.current.some(h => h.ip === host.ip)) return;
        otxQueue.current.push(host);
        processOtxQueue();
        addToast(`Queued OTX enrichment for ${host.ip}`, 'info');
    };

    const [activeView, setActiveView] = useState(() => {
        try {
            return canonicalViewId(localStorage.getItem('antitode_active_view') || 'dashboard');
        } catch {
            return 'dashboard';
        }
    });
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('antitode_sidebar_collapsed') === 'true');
    const [searchOpen, setSearchOpen] = useState(false);

    const navigate = (viewId: string) => {
        const next = canonicalViewId(viewId);
        if (next === 'settings') {
            setIsSettingsOpen(true);
            return;
        }
        setActiveView(next);
        localStorage.setItem('antitode_active_view', next);
        setSearchOpen(false);
    };

    useEffect(() => {
        const handler = (event: KeyboardEvent) => {
            const modifier = event.metaKey || event.ctrlKey;
            if (modifier && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                setSearchOpen((open) => !open);
                return;
            }
            if (modifier && event.key.toLowerCase() === 'b') {
                event.preventDefault();
                setSidebarCollapsed((collapsed) => {
                    const next = !collapsed;
                    localStorage.setItem('antitode_sidebar_collapsed', String(next));
                    return next;
                });
                return;
            }
            if (event.key === 'Escape') setSearchOpen(false);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    useEffect(() => {
        localStorage.setItem('antitode_active_view', activeView);
    }, [activeView]);

    if (!isStorageLoaded) {
        return (
            <div className="at-boot-screen">
                <div className="at-boot-mark">A</div>
                <div className="at-boot-title">ANTITODE</div>
                <div className="at-boot-status">Loading security workspace</div>
                <div className="at-boot-bar"><span /></div>
            </div>
        );
    }

    return (
        <div className="at-app-shell">
            <div className="at-grid-bg" />

            <Sidebar
                activeView={activeView}
                collapsed={sidebarCollapsed}
                onToggle={() => {
                    setSidebarCollapsed((collapsed) => {
                        const next = !collapsed;
                        localStorage.setItem('antitode_sidebar_collapsed', String(next));
                        return next;
                    });
                }}
                onNavigate={navigate}
                onOpenSearch={() => setSearchOpen(true)}
            />

            <div className="at-shell-main">
                <Header
                    activeView={activeView}
                    sidebarCollapsed={sidebarCollapsed}
                    onToggleSidebar={() => {
                        setSidebarCollapsed((collapsed) => {
                            const next = !collapsed;
                            localStorage.setItem('antitode_sidebar_collapsed', String(next));
                            return next;
                        });
                    }}
                    onOpenSearch={() => setSearchOpen(true)}
                    onOpenSettings={() => setIsSettingsOpen(true)}
                />

                <main className="at-app-main">
                    {errorMsg && (
                        <div className="at-global-error">
                            <AlertCircle size={17} />
                            <span>{errorMsg}</span>
                            <button type="button" onClick={() => setErrorMsg(null)}>Dismiss</button>
                        </div>
                    )}

                    {appState === AppState.ANALYZING ? (
                        <div className="at-analysis-loading">
                            <div className="at-loading-spinner" />
                            <h2>Processing security telemetry</h2>
                            <p>Normalizing logs, enriching indicators, and recalculating risk.</p>
                        </div>
                    ) : (
                        <ResultsTable
                            results={combinedResults}
                            malpediaData={malpediaData}
                            malpediaActors={malpediaActors}
                            cveData={cveData}
                            cveFeedItems={cveFeedItems}
                            isFeedLoading={isFeedLoading}
                            exploitData={exploitData}
                            newsItems={newsItems}
                            newsLastUpdated={newsLastUpdated}
                            onRefreshNews={handleRefreshAll}
                            onRefreshAll={handleRefreshAll}
                            urlHausItems={urlHausItems}
                            malwareBazaarItems={malwareBazaarItems}
                            feodoItems={feodoItems}
                            sslBlItems={sslBlItems}
                            ja3Items={ja3Items}
                            threatFoxItems={threatFoxItems}
                            ipsumItems={ipsumItems}
                            blocklistDeItems={blocklistDeItems}
                            c2IntelItems={c2IntelItems}
                            maliciousHashItems={maliciousHashItems}
                            ransomwarePosts={ransomwarePosts}
                            ransomwareGroups={ransomwareGroups}
                            onReset={handleReset}
                            onAddLogs={handleAddLogs}
                            productName={settings.productName}
                            logoUrl={settings.logoUrl}
                            onEnrichHost={handleEnrichHost}
                            networkAnalysis={networkAnalysis}
                            setNetworkAnalysis={setNetworkAnalysis}
                            emailAnalysis={emailAnalysis}
                            setEmailAnalysis={setEmailAnalysis}
                            activeView={activeView}
                            onNavigate={navigate}
                        />
                    )}
                </main>
            </div>

            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                settings={settings}
                onUpdateSettings={setSettings}
                onClearData={handleClearData}
                onDataLoaded={handleDataLoaded}
                onMmdbLoaded={handleMmdbLoaded}
                onMalpediaLoaded={handleMalpediaLoaded}
                onMalpediaActorsLoaded={handleMalpediaActorsLoaded}
                onCveLoaded={handleCveLoaded}
                onNotify={addToast}
                systemLogs={systemLogs}
                whitelist={whitelist}
                onUpdateWhitelist={setWhitelist}
            />

            {toasts.length > 0 && (
                <div className="at-toast-stack">
                    {toasts.map((toast) => (
                        <div key={toast.id} className={`at-toast at-toast-${toast.type}`}>
                            {toast.type === 'success' ? <CheckCircle size={16} /> : toast.type === 'error' ? <XCircle size={16} /> : <Info size={16} />}
                            <span>{toast.message}</span>
                        </div>
                    ))}
                </div>
            )}

            <CommandPalette
                isOpen={searchOpen}
                onClose={() => setSearchOpen(false)}
                onNavigate={navigate}
            />
        </div>
    );
};
