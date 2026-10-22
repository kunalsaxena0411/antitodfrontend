import React, { useEffect, useMemo, useRef, useState } from 'react';
import ViewRouter from './components/ViewRouter';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DEMO_HOSTS, DEMO_ACTORS, DEMO_CVES, DEMO_CVE_FEEDS, DEMO_NEWS, DEMO_EXPLOITS, DEMO_URLHAUS, DEMO_FEODO, DEMO_THREATFOX, DEMO_MALWAREBAZAAR, DEMO_SSLBL, DEMO_JA3, DEMO_RANSOMWARE_POSTS, DEMO_RANSOMWARE_GROUPS } from './data/demo';
import { DEMO_MODE, dataProvider } from './services/dataProvider';
import { isPublicDemo, enterDemoMode, DEMO_GUEST_TOKEN } from './utils/demoMode';
import { AUTH_CONFIG } from '../config/config';

// A visitor arriving with ?demo=true must see the pure demo, never a mix with a real session.
try {
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === 'true' && localStorage.getItem(AUTH_CONFIG.TOKEN_KEY) !== DEMO_GUEST_TOKEN) {
    enterDemoMode();
  }
} catch { /* storage blocked */ }
import { PlanNoticeModal } from './components/modals/PlanNoticeModal';
import { ApiEventToast } from './components/common/ApiEventToast';
import {
    AppState,
    LogEntry,
    AnalyzedHost,
    MalpediaEntry,
    MalpediaActor,
    CveEntry,
    CveFeedItem,
    ThreatNewsItem,
    ExploitEntry,
    AppSettings,
    AppTheme,
    UrlHausEntry,
    MalwareBazaarEntry,
    FeodoTrackerEntry,
    SslBlEntry,
    Ja3FingerprintEntry,
    ThreatFoxEntry,
    SystemLogEntry,
    RansomWatchPost,
    RansomWatchGroup,
    IpsumEntry,
    BlocklistDeEntry,
    WhitelistEntry,
    C2IntelFeedEntry,
    MaliciousHashEntry,
} from '../types';

import {
    analyzeLogs,
    recalculateHostScore,
    convertFeedToHosts,
} from '../services/analyzer';

import {
    enrichIP,
    checkRBL,
    resolveHostname,
} from '../services/dns';

import { fetchOtxIndicator } from '../services/otx';
import { mmdbService } from '../services/mmdb';
import {
    parseMalpediaBib,
    fetchRemoteMalpedia,
} from '../services/malpedia';
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
import {
    fetchRansomwarePosts,
    fetchRansomwareGroups,
} from '../services/ransomwatch';
import { fetchIpsum } from '../services/ipsum';
import { fetchBlocklistDe } from '../services/blocklistDe';
import { fetchC2IntelFeed } from '../services/c2intelfeed';
import { fetchMaliciousHashes } from '../services/maliciousHash';

import {
    saveToStorage,
    loadFromStorage,
    clearStorage,
    clearExternalFeedStorage,
    STORES,
} from '../services/storage';

import {
    AlertCircle,
    CheckCircle,
    XCircle,
    Info,
} from 'lucide-react';

import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import CommandPalette from './components/layout/CommandPalette';
import { canonicalViewId } from './data/navigation';
import { routeForView, viewForPath } from './data/routes';

interface Toast {
    id: string;
    message: string;
    type: 'info' | 'success' | 'error';
}

const SETTINGS_STORAGE_KEY = 'antitode_settings';
const LEGACY_SETTINGS_STORAGE_KEY = 'xyberah_settings';
const SIDEBAR_STORAGE_KEY = 'antitode_sidebar_collapsed';
const ACTIVE_VIEW_STORAGE_KEY = 'antitode_active_view';

const DEFAULT_SETTINGS: AppSettings = {
    theme: 'DARK',
    animationsEnabled: true,
    retentionMinutes: 60,
    showMap: true,
    productName: 'ANTITODE',
    logoUrl: '',
};

const safeParseSettings = (): AppSettings => {
    try {
        const current = localStorage.getItem(SETTINGS_STORAGE_KEY);
        const legacy = localStorage.getItem(LEGACY_SETTINGS_STORAGE_KEY);
        const raw = current ?? legacy;

        if (!raw) {
            return DEFAULT_SETTINGS;
        }

        const parsed = JSON.parse(raw) as Partial<AppSettings>;

        return {
            ...DEFAULT_SETTINGS,
            ...parsed,
        };
    } catch {
        return DEFAULT_SETTINGS;
    }
};

const uniqueActors = (
    existing: MalpediaActor[],
    ...sources: MalpediaActor[][]
): MalpediaActor[] => {
    const result: MalpediaActor[] = [];
    const seen = new Set<string>();

    for (const actor of [...existing, ...sources.flat()]) {
        const key = JSON.stringify(actor);

        if (seen.has(key)) {
            continue;
        }

        seen.add(key);
        result.push(actor);
    }

    return result;
};

export const App: React.FC = () => {
    const [appState, setAppState] = useState<AppState>(
        AppState.RESULTS,
    );

    const [settings, setSettings] = useState<AppSettings>(
        safeParseSettings,
    );

    const [analysisResults, setAnalysisResults] = useState<
        AnalyzedHost[]
    >([]);

    const [c2Hosts, setC2Hosts] = useState<AnalyzedHost[]>([]);

    const [malpediaData, setMalpediaData] = useState<
        MalpediaEntry[]
    >([]);

    const [malpediaActors, setMalpediaActors] = useState<
        MalpediaActor[]
    >([]);

    const [cveData, setCveData] = useState<CveEntry[]>([]);
    const [cveFeedItems, setCveFeedItems] = useState<CveFeedItem[]>(
        [],
    );

    const [urlHausItems, setUrlHausItems] = useState<
        UrlHausEntry[]
    >([]);

    const [malwareBazaarItems, setMalwareBazaarItems] = useState<
        MalwareBazaarEntry[]
    >([]);

    const [feodoItems, setFeodoItems] = useState<
        FeodoTrackerEntry[]
    >([]);

    const [sslBlItems, setSslBlItems] = useState<SslBlEntry[]>([]);
    const [ja3Items, setJa3Items] = useState<Ja3FingerprintEntry[]>(
        [],
    );

    const [threatFoxItems, setThreatFoxItems] = useState<
        ThreatFoxEntry[]
    >([]);

    const [ipsumItems, setIpsumItems] = useState<IpsumEntry[]>([]);

    const [blocklistDeItems, setBlocklistDeItems] = useState<
        BlocklistDeEntry[]
    >([]);

    const [c2IntelItems, setC2IntelItems] = useState<
        C2IntelFeedEntry[]
    >([]);

    const [maliciousHashItems, setMaliciousHashItems] = useState<
        MaliciousHashEntry[]
    >([]);

    const [ransomwarePosts, setRansomwarePosts] = useState<
        RansomWatchPost[]
    >([]);

    const [ransomwareGroups, setRansomwareGroups] = useState<
        RansomWatchGroup[]
    >([]);

    const [exploitData, setExploitData] = useState<ExploitEntry[]>([]);

    const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);

    const [isFeedLoading, setIsFeedLoading] = useState(false);

    const [isStorageLoaded, setIsStorageLoaded] = useState(false);

    const [newsItems, setNewsItems] = useState<ThreatNewsItem[]>([]);

    const [newsLastUpdated, setNewsLastUpdated] =
        useState<Date | null>(null);

    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [toasts, setToasts] = useState<Toast[]>([]);

    const [systemLogs, setSystemLogs] = useState<SystemLogEntry[]>(
        [],
    );

    const enrichmentQueue = useRef<AnalyzedHost[]>([]);
    const isProcessingQueue = useRef(false);

    const rblQueue = useRef<AnalyzedHost[]>([]);
    const isProcessingRbl = useRef(false);

    const dnsQueue = useRef<AnalyzedHost[]>([]);
    const isProcessingDns = useRef(false);

    const otxQueue = useRef<AnalyzedHost[]>([]);
    const isProcessingOtx = useRef(false);

    const restoreStarted = useRef(false);
    const baselineLoadStarted = useRef(false);
    const initialFeedRefreshStarted = useRef(false);

    const addSystemLog = (
        message: string,
        level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS',
        source: string,
    ) => {
        const entry: SystemLogEntry = {
            id: crypto.randomUUID(),
            timestamp: new Date(),
            level,
            message,
            source,
        };

        setSystemLogs((prev) =>
            [entry, ...prev].slice(0, 200),
        );
    };

    const addToast = (
        message: string,
        type: 'info' | 'success' | 'error' = 'info',
    ) => {
        const id = crypto.randomUUID();

        setToasts((prev) => [
            ...prev,
            {
                id,
                message,
                type,
            },
        ]);

        window.setTimeout(() => {
            setToasts((prev) =>
                prev.filter((toast) => toast.id !== id),
            );
        }, 5000);
    };

    const processEnrichmentQueue = async () => {
        if (isProcessingQueue.current) {
            return;
        }

        isProcessingQueue.current = true;

        try {
            while (enrichmentQueue.current.length > 0) {
                const host = enrichmentQueue.current.shift();

                if (!host || host.enrichmentData) {
                    continue;
                }

                try {
                    const data = await enrichIP(host.ip);

                    if (data) {
                        setAnalysisResults((prev) =>
                            prev.map((item) =>
                                item.ip === host.ip
                                    ? recalculateHostScore({
                                        ...item,
                                        enrichmentData: data,
                                        country:
                                            data.country_name,
                                    })
                                    : item,
                            ),
                        );
                    }
                } catch {
                    // Individual enrichment failure should not stop the queue.
                }

                await new Promise((resolve) =>
                    setTimeout(resolve, 200),
                );
            }
        } finally {
            isProcessingQueue.current = false;
        }
    };

    const processRblQueue = async () => {
        if (isProcessingRbl.current) {
            return;
        }

        isProcessingRbl.current = true;

        try {
            while (rblQueue.current.length > 0) {
                const host = rblQueue.current.shift();

                if (
                    !host ||
                    (host.rblStatus &&
                        host.rblStatus !== 'CHECKING')
                ) {
                    continue;
                }

                try {
                    const result = await checkRBL(host.ip);

                    setAnalysisResults((prev) =>
                        prev.map((item) =>
                            item.ip === host.ip
                                ? recalculateHostScore({
                                    ...item,
                                    rblStatus: result.status,
                                    rblListedIn:
                                        result.listedIn,
                                })
                                : item,
                        ),
                    );
                } catch {
                    // Individual RBL failure should not stop the queue.
                }

                await new Promise((resolve) =>
                    setTimeout(resolve, 100),
                );
            }
        } finally {
            isProcessingRbl.current = false;
        }
    };

    const processDnsQueue = async () => {
        if (isProcessingDns.current) {
            return;
        }

        isProcessingDns.current = true;

        try {
            while (dnsQueue.current.length > 0) {
                const host = dnsQueue.current.shift();

                if (!host || host.dnsHostname) {
                    continue;
                }

                try {
                    const hostname = await resolveHostname(host.ip);

                    if (hostname) {
                        setAnalysisResults((prev) =>
                            prev.map((item) =>
                                item.ip === host.ip
                                    ? {
                                        ...item,
                                        dnsHostname:
                                            hostname,
                                    }
                                    : item,
                            ),
                        );
                    }
                } catch {
                    // Individual DNS failure should not stop the queue.
                }

                await new Promise((resolve) =>
                    setTimeout(resolve, 50),
                );
            }
        } finally {
            isProcessingDns.current = false;
        }
    };

    const processOtxQueue = async () => {
        if (isProcessingOtx.current) {
            return;
        }

        isProcessingOtx.current = true;

        try {
            while (otxQueue.current.length > 0) {
                const host = otxQueue.current.shift();

                if (!host || host.otxData) {
                    continue;
                }

                try {
                    const otx = await fetchOtxIndicator(host.ip);

                    if (otx) {
                        setAnalysisResults((prev) =>
                            prev.map((item) =>
                                item.ip === host.ip
                                    ? {
                                        ...item,
                                        otxData: otx,
                                    }
                                    : item,
                            ),
                        );
                    }
                } catch {
                    // Individual OTX failure should not stop the queue.
                }

                await new Promise((resolve) =>
                    setTimeout(resolve, 1000),
                );
            }
        } finally {
            isProcessingOtx.current = false;
        }
    };

    const enrichData = (hosts: AnalyzedHost[]) => {
        for (const host of hosts) {
            if (!host.enrichmentData) {
                enrichmentQueue.current.push(host);
            }

            if (
                !host.rblStatus ||
                host.rblStatus === 'CHECKING'
            ) {
                rblQueue.current.push(host);
            }

            if (!host.dnsHostname) {
                dnsQueue.current.push(host);
            }
        }

        void processEnrichmentQueue();
        void processRblQueue();
        void processDnsQueue();
    };

    const handleDataLoaded = async (data: LogEntry[]) => {
        setErrorMsg(null);
        setAppState(AppState.ANALYZING);

        addSystemLog(
            `Processing log batch of ${data.length} entries.`,
            'INFO',
            'Analyzer',
        );

        try {
            let results = await analyzeLogs(
                data,
                urlHausSet,
                bazaarSet,
                feodoSet,
                threatFoxSet,
                ipsumSet,
                whitelist,
                c2IntelMap,
            );

            const mmdbStatus = mmdbService.getStatus();

            if (mmdbStatus.city || mmdbStatus.asn) {
                results = results.map((host) => {
                    const mmdbData = mmdbService.lookup(host.ip);

                    if (!mmdbData) {
                        return host;
                    }

                    return {
                        ...host,
                        country: mmdbData.country_name,
                        enrichmentData: mmdbData,
                    };
                });
            }

            setAnalysisResults(results);
            setAppState(AppState.RESULTS);

            addToast(
                `Analysis complete: ${results.length} hosts processed`,
                'success',
            );

            addSystemLog(
                `Analysis completed for ${results.length} hosts.`,
                'SUCCESS',
                'Analyzer',
            );

            enrichData(results);
        } catch {
            setErrorMsg(
                'Critical error during the analysis routine.',
            );

            setAppState(AppState.RESULTS);

            addToast(
                'Analysis failed due to a critical error.',
                'error',
            );

            addSystemLog(
                'Analysis failed during processing.',
                'ERROR',
                'Analyzer',
            );
        }
    };

    const handleAddLogs = (data: LogEntry[]) => {
        void handleDataLoaded(data);
    };

    const urlHausSet = useMemo(() => {
        const set = new Set<string>();

        for (const item of urlHausItems) {
            try {
                const url = new URL(item.url);
                set.add(url.hostname.toLowerCase());
            } catch {
                const parts = item.url.split('/');

                if (parts[0]) {
                    set.add(parts[0].toLowerCase());
                }
            }
        }

        return set;
    }, [urlHausItems]);

    const bazaarSet = useMemo(() => {
        const set = new Set<string>();

        for (const item of malwareBazaarItems) {
            if (item.sha256_hash) {
                set.add(item.sha256_hash.toLowerCase());
            }

            if (item.md5_hash) {
                set.add(item.md5_hash.toLowerCase());
            }

            if (item.sha1_hash) {
                set.add(item.sha1_hash.toLowerCase());
            }
        }

        for (const item of sslBlItems) {
            if (item.sha1) {
                set.add(item.sha1.toLowerCase());
            }
        }

        for (const item of ja3Items) {
            if (item.ja3_md5) {
                set.add(item.ja3_md5.toLowerCase());
            }
        }

        for (const item of maliciousHashItems) {
            if (item.hash) {
                set.add(item.hash.toLowerCase());
            }
        }

        return set;
    }, [
        malwareBazaarItems,
        sslBlItems,
        ja3Items,
        maliciousHashItems,
    ]);

    const feodoSet = useMemo(() => {
        const set = new Set<string>();

        for (const item of feodoItems) {
            if (item.ip_address) {
                set.add(item.ip_address);
            }
        }

        return set;
    }, [feodoItems]);

    const threatFoxSet = useMemo(() => {
        const set = new Set<string>();

        for (const item of threatFoxItems) {
            if (item.ioc_value) {
                set.add(item.ioc_value.toLowerCase());
            }

            if (item.ioc_type === 'ip:port') {
                const ip = item.ioc_value.split(':')[0];

                if (ip) {
                    set.add(ip.toLowerCase());
                }
            }

            if (item.ioc_type === 'url') {
                try {
                    const url = new URL(item.ioc_value);
                    set.add(url.hostname.toLowerCase());
                } catch {
                    // Ignore malformed URL indicators.
                }
            }
        }

        return set;
    }, [threatFoxItems]);

    const ipsumSet = useMemo(() => {
        const set = new Set<string>();

        for (const item of ipsumItems) {
            if (item.ip) {
                set.add(item.ip);
            }
        }

        return set;
    }, [ipsumItems]);

    const c2IntelMap = useMemo(() => {
        const map = new Map<string, C2IntelFeedEntry>();

        for (const item of c2IntelItems) {
            if (item.ip) {
                map.set(item.ip, item);
            }
        }

        return map;
    }, [c2IntelItems]);

    useEffect(() => {
        if (c2IntelItems.length === 0) {
            setC2Hosts([]);
            return;
        }

        const timer = window.setTimeout(() => {
            const converted = convertFeedToHosts(c2IntelItems);
            setC2Hosts(converted);
        }, 300);

        return () => window.clearTimeout(timer);
    }, [c2IntelItems]);

    const combinedResults = useMemo(() => {
        const logIps = new Set(
            analysisResults.map((host) => host.ip),
        );

        const uniqueC2 = c2Hosts.filter(
            (host) => !logIps.has(host.ip),
        );

        return [...analysisResults, ...uniqueC2].sort(
            (a, b) => b.totalScore - a.totalScore,
        );
    }, [analysisResults, c2Hosts]);

    useEffect(() => {
        if (restoreStarted.current) {
            return;
        }

        restoreStarted.current = true;

        addSystemLog(
            'System initialized. Loading storage persistence...',
            'INFO',
            'System',
        );

        const restoreSession = async () => {
            try {
                const [
                    savedAnalysis,
                    savedActors,
                    savedCves,
                    savedRefs,
                    savedUrlHaus,
                    savedBazaar,
                    savedFeodo,
                    savedSslBl,
                    savedJa3,
                    savedThreatFox,
                    savedIpsum,
                    savedBlocklistDe,
                    savedC2Intel,
                    savedRansomPosts,
                    savedRansomGroups,
                    savedWhitelist,
                ] = await Promise.all([
                    loadFromStorage(STORES.ANALYSIS),
                    loadFromStorage(STORES.ACTORS),
                    loadFromStorage(STORES.CVES),
                    loadFromStorage(STORES.REFS),
                    loadFromStorage(STORES.URLHAUS),
                    loadFromStorage(STORES.BAZAAR),
                    loadFromStorage(STORES.FEODO),
                    loadFromStorage(STORES.SSLBL_SHA1),
                    loadFromStorage(STORES.SSLBL_JA3),
                    loadFromStorage(STORES.THREATFOX),
                    loadFromStorage(STORES.IPSUM),
                    loadFromStorage(STORES.BLOCKLIST_DE),
                    loadFromStorage(STORES.C2_INTEL),
                    loadFromStorage(
                        STORES.RANSOMWARE_POSTS,
                    ),
                    loadFromStorage(
                        STORES.RANSOMWARE_GROUPS,
                    ),
                    loadFromStorage(STORES.WHITELIST),
                ]);

                if (
                    savedAnalysis &&
                    Array.isArray(savedAnalysis) &&
                    savedAnalysis.length > 0
                ) {
                    setAnalysisResults(savedAnalysis);
                    setAppState(AppState.RESULTS);

                    addToast(
                        `Session restored: ${savedAnalysis.length} hosts loaded`,
                        'info',
                    );

                    addSystemLog(
                        `Session restored with ${savedAnalysis.length} hosts.`,
                        'INFO',
                        'Storage',
                    );
                }

                if (savedActors) {
                    setMalpediaActors(savedActors);
                }

                if (savedCves) {
                    setCveData(savedCves);
                }

                if (savedRefs) {
                    setMalpediaData(savedRefs);
                }

                if (isPublicDemo()) {
                    if (savedUrlHaus) {
                        setUrlHausItems(savedUrlHaus);
                    }

                    if (savedBazaar) {
                        setMalwareBazaarItems(savedBazaar);
                    }

                    if (savedFeodo) {
                        setFeodoItems(savedFeodo);
                    }

                    if (savedSslBl) {
                        setSslBlItems(savedSslBl);
                    }

                    if (savedJa3) {
                        setJa3Items(savedJa3);
                    }

                    if (savedThreatFox) {
                        setThreatFoxItems(savedThreatFox);
                    }

                    if (savedIpsum) {
                        setIpsumItems(savedIpsum);
                    }

                    if (savedBlocklistDe) {
                        setBlocklistDeItems(savedBlocklistDe);
                    }

                    if (savedC2Intel) {
                        setC2IntelItems(savedC2Intel);
                    }

                    if (savedRansomPosts) {
                        setRansomwarePosts(savedRansomPosts);
                    }

                    if (savedRansomGroups) {
                        setRansomwareGroups(savedRansomGroups);
                    }
                } else {
                    void clearExternalFeedStorage();
                    setUrlHausItems([]);
                    setMalwareBazaarItems([]);
                    setFeodoItems([]);
                    setSslBlItems([]);
                    setJa3Items([]);
                    setThreatFoxItems([]);
                    setIpsumItems([]);
                    setBlocklistDeItems([]);
                    setC2IntelItems([]);
                    setRansomwarePosts([]);
                    setRansomwareGroups([]);
                }

                if (savedWhitelist) {
                    setWhitelist(savedWhitelist);
                }
            } catch (error) {
                console.warn(
                    'Failed to restore session data',
                    error,
                );

                addSystemLog(
                    'Failed to restore session data from IndexedDB.',
                    'WARN',
                    'Storage',
                );
            } finally {
                setIsStorageLoaded(true);
            }
        };

        void restoreSession();
    }, []);

    const handleMmdbLoaded = async (files: File[]) => {
        if (files.length === 0) {
            return;
        }

        try {
            const typesLoaded: string[] = [];

            for (const file of files) {
                const type = await mmdbService.loadDatabase(file);
                typesLoaded.push(type);
            }

            addToast(
                `MMDB loaded: ${typesLoaded.join(', ')}`,
                'success',
            );

            addSystemLog(
                `Loaded ${typesLoaded.length} MMDB database(s).`,
                'SUCCESS',
                'MMDB',
            );
        } catch {
            addToast(
                'Failed to parse the MMDB file.',
                'error',
            );

            addSystemLog(
                'MMDB database loading failed.',
                'ERROR',
                'MMDB',
            );
        }
    };

    const handleMalpediaLoaded = async (files: File[]) => {
        const file = files[0];

        if (!file) {
            return;
        }

        try {
            const data = await parseMalpediaBib(file);

            setMalpediaData(data);

            addToast(
                `Loaded ${data.length} Malpedia references`,
                'success',
            );
        } catch {
            addToast(
                'Failed to parse the Malpedia Bib file.',
                'error',
            );
        }
    };

    const handleMalpediaActorsLoaded = (
        actors: MalpediaActor[],
    ) => {
        setMalpediaActors(actors);

        addToast(
            `Loaded ${actors.length} threat actors`,
            'success',
        );
    };

    const handleCveLoaded = (cves: CveEntry[]) => {
        setCveData(cves);

        addToast(
            `Loaded ${cves.length} CVEs`,
            'success',
        );
    };

    useEffect(() => {
        if (
            !isStorageLoaded ||
            baselineLoadStarted.current
        ) {
            return;
        }

        baselineLoadStarted.current = true;

        const loadBaselineData = async () => {
            const status = mmdbService.getStatus();
            const filesToLoad: File[] = [];

            if (!status.city) {
                try {
                    let response = await fetch(
                        '/data/GeoLite2-City.mmdb',
                    );

                    if (
                        !response.ok ||
                        response.headers
                            .get('content-type')
                            ?.includes('text/html')
                    ) {
                        response = await fetch(
                            '/data/GeoLite2-Country.mmdb',
                        );
                    }

                    if (
                        response.ok &&
                        !response.headers
                            .get('content-type')
                            ?.includes('text/html')
                    ) {
                        const blob = await response.blob();

                        const filename =
                            response.url.split('/').pop() ||
                            'GeoLite2.mmdb';

                        filesToLoad.push(
                            new File(
                                [blob],
                                filename,
                                {
                                    type: 'application/octet-stream',
                                },
                            ),
                        );
                    }
                } catch {
                    // Optional baseline database.
                }
            }

            if (!status.asn) {
                try {
                    const response = await fetch(
                        '/data/GeoLite2-ASN.mmdb',
                    );

                    if (
                        response.ok &&
                        !response.headers
                            .get('content-type')
                            ?.includes('text/html')
                    ) {
                        const blob = await response.blob();

                        filesToLoad.push(
                            new File(
                                [blob],
                                'GeoLite2-ASN.mmdb',
                                {
                                    type: 'application/octet-stream',
                                },
                            ),
                        );
                    }
                } catch {
                    // Optional baseline database.
                }
            }

            if (filesToLoad.length > 0) {
                await handleMmdbLoaded(filesToLoad);

                addSystemLog(
                    `Auto-loaded ${filesToLoad.length} MMDB file(s).`,
                    'INFO',
                    'System',
                );
            }

            if (malpediaData.length === 0) {
                try {
                    const response = await fetch(
                        '/data/malpedia.bib',
                    );

                    if (
                        response.ok &&
                        !response.headers
                            .get('content-type')
                            ?.includes('text/html')
                    ) {
                        const blob = await response.blob();

                        const file = new File(
                            [blob],
                            'malpedia.bib',
                        );

                        await handleMalpediaLoaded([file]);
                    }
                } catch {
                    // Optional baseline data.
                }
            }

            if (analysisResults.length === 0 && isPublicDemo()) {
                try {
                    const response = await fetch(
                        '/data/base_logs.json',
                    );

                    if (response.ok) {
                        const json = await response.json();

                        if (Array.isArray(json)) {
                            await handleDataLoaded(json);

                            addSystemLog(
                                'Loaded default base logs.',
                                'INFO',
                                'System',
                            );
                        }
                    }
                } catch {
                    // Optional baseline data.
                }
            }
        };

        void loadBaselineData();
    }, [
        isStorageLoaded,
        analysisResults.length,
        malpediaData.length,
    ]);

    useEffect(() => {
        if (!isStorageLoaded) {
            return;
        }

        const timeout = window.setTimeout(() => {
            void saveToStorage(
                STORES.ANALYSIS,
                analysisResults,
            );
        }, 2000);

        return () => window.clearTimeout(timeout);
    }, [analysisResults, isStorageLoaded]);

    useEffect(() => {
        if (isStorageLoaded) {
            void saveToStorage(
                STORES.ACTORS,
                malpediaActors,
            );
        }
    }, [malpediaActors, isStorageLoaded]);

    useEffect(() => {
        if (isStorageLoaded) {
            void saveToStorage(
                STORES.CVES,
                cveData,
            );
        }
    }, [cveData, isStorageLoaded]);

    useEffect(() => {
        if (isStorageLoaded) {
            void saveToStorage(
                STORES.REFS,
                malpediaData,
            );
        }
    }, [malpediaData, isStorageLoaded]);

    useEffect(() => {
        if (isStorageLoaded && isPublicDemo()) {
            void saveToStorage(
                STORES.URLHAUS,
                urlHausItems,
            );
        }
    }, [urlHausItems, isStorageLoaded]);

    useEffect(() => {
        if (isStorageLoaded && isPublicDemo()) {
            void saveToStorage(
                STORES.BAZAAR,
                malwareBazaarItems,
            );
        }
    }, [malwareBazaarItems, isStorageLoaded]);

    useEffect(() => {
        if (isStorageLoaded && isPublicDemo()) {
            void saveToStorage(
                STORES.FEODO,
                feodoItems,
            );
        }
    }, [feodoItems, isStorageLoaded]);

    useEffect(() => {
        if (isStorageLoaded && isPublicDemo()) {
            void saveToStorage(
                STORES.SSLBL_SHA1,
                sslBlItems,
            );
        }
    }, [sslBlItems, isStorageLoaded]);

    useEffect(() => {
        if (isStorageLoaded && isPublicDemo()) {
            void saveToStorage(
                STORES.SSLBL_JA3,
                ja3Items,
            );
        }
    }, [ja3Items, isStorageLoaded]);

    useEffect(() => {
        if (isStorageLoaded && isPublicDemo()) {
            void saveToStorage(
                STORES.THREATFOX,
                threatFoxItems,
            );
        }
    }, [threatFoxItems, isStorageLoaded]);

    useEffect(() => {
        if (isStorageLoaded && isPublicDemo()) {
            void saveToStorage(
                STORES.IPSUM,
                ipsumItems,
            );
        }
    }, [ipsumItems, isStorageLoaded]);

    useEffect(() => {
        if (isStorageLoaded && isPublicDemo()) {
            void saveToStorage(
                STORES.BLOCKLIST_DE,
                blocklistDeItems,
            );
        }
    }, [blocklistDeItems, isStorageLoaded]);

    useEffect(() => {
        if (isStorageLoaded && isPublicDemo()) {
            void saveToStorage(
                STORES.C2_INTEL,
                c2IntelItems,
            );
        }
    }, [c2IntelItems, isStorageLoaded]);

    useEffect(() => {
        if (isStorageLoaded && isPublicDemo()) {
            void saveToStorage(
                STORES.RANSOMWARE_POSTS,
                ransomwarePosts,
            );
        }
    }, [ransomwarePosts, isStorageLoaded]);

    useEffect(() => {
        if (isStorageLoaded && isPublicDemo()) {
            void saveToStorage(
                STORES.RANSOMWARE_GROUPS,
                ransomwareGroups,
            );
        }
    }, [ransomwareGroups, isStorageLoaded]);

    useEffect(() => {
        if (isStorageLoaded) {
            void saveToStorage(
                STORES.WHITELIST,
                whitelist,
            );
        }
    }, [whitelist, isStorageLoaded]);

const THEME_PALETTES: Record<
    AppTheme,
    {
        accent: string;
        accentHover: string;
        accentMuted: string;
        accentGlow: string;
    }
> = {
    CYBER: {
        accent: '#f72585',
        accentHover: '#b5179e',
        accentMuted: 'rgba(247, 37, 133, 0.15)',
        accentGlow: 'rgba(247, 37, 133, 0.4)',
    },
    NORDIC: {
        accent: '#38bdf8',
        accentHover: '#0ea5e9',
        accentMuted: 'rgba(56, 189, 248, 0.15)',
        accentGlow: 'rgba(56, 189, 248, 0.4)',
    },
    EMBER: {
        accent: '#f97316',
        accentHover: '#ea580c',
        accentMuted: 'rgba(249, 115, 22, 0.15)',
        accentGlow: 'rgba(249, 115, 22, 0.4)',
    },
    SENTINEL: {
        accent: '#00f5d4',
        accentHover: '#00bbf9',
        accentMuted: 'rgba(0, 245, 212, 0.15)',
        accentGlow: 'rgba(0, 245, 212, 0.4)',
    },
    FORTRESS: {
        accent: '#a855f7',
        accentHover: '#9333ea',
        accentMuted: 'rgba(168, 85, 247, 0.15)',
        accentGlow: 'rgba(168, 85, 247, 0.4)',
    },
    DARK: {
        accent: '#ef4444',
        accentHover: '#dc2626',
        accentMuted: 'rgba(239, 68, 68, 0.15)',
        accentGlow: 'rgba(239, 68, 68, 0.4)',
    },
    LIGHT: {
        accent: '#2563eb',
        accentHover: '#1d4ed8',
        accentMuted: 'rgba(37, 99, 235, 0.15)',
        accentGlow: 'rgba(37, 99, 235, 0.4)',
    },
    TERMINAL: {
        accent: '#22c55e',
        accentHover: '#16a34a',
        accentMuted: 'rgba(34, 197, 94, 0.15)',
        accentGlow: 'rgba(34, 197, 94, 0.4)',
    },
};

    useEffect(() => {
        const root = document.documentElement;
        const body = document.body;

        body.classList.remove(
            'theme-light',
            'theme-sentinel',
            'theme-fortress',
            'theme-cyber',
            'theme-dark',
            'theme-terminal',
            'theme-nordic',
            'theme-ember',
        );

        body.classList.add(
            `theme-${settings.theme.toLowerCase()}`,
        );

        const palette =
            THEME_PALETTES[settings.theme] ||
            THEME_PALETTES.DARK;

        root.style.setProperty('--theme-accent', palette.accent);
        root.style.setProperty(
            '--theme-accent-hover',
            palette.accentHover,
        );
        root.style.setProperty(
            '--theme-accent-muted',
            palette.accentMuted,
        );
        root.style.setProperty(
            '--theme-accent-glow',
            palette.accentGlow,
        );

        root.style.setProperty(
            '--color-bg-primary',
            '#090a0c',
        );

        root.style.setProperty(
            '--color-bg-secondary',
            '#101216',
        );

        root.style.setProperty(
            '--color-bg-glass',
            'rgba(16,18,22,0.92)',
        );

        root.style.setProperty(
            '--color-accent-primary',
            palette.accent,
        );

        root.style.setProperty(
            '--color-accent-secondary',
            '#98a2b3',
        );

        root.style.setProperty(
            '--color-bg-grid',
            'transparent',
        );
    }, [settings.theme]);

    useEffect(() => {
        try {
            localStorage.setItem(
                SETTINGS_STORAGE_KEY,
                JSON.stringify(settings),
            );

            localStorage.removeItem(
                LEGACY_SETTINGS_STORAGE_KEY,
            );
        } catch {
            // Storage may be unavailable in restricted environments.
        }
    }, [settings]);

    const handleRefreshAll = async () => {
        if (isFeedLoading) {
            return;
        }

        if (isPublicDemo()) {
            setNewsLastUpdated(new Date());
            return;
        }

        setIsFeedLoading(true);

        addSystemLog(
            'Initiating live telemetry refresh...',
            'INFO',
            'System',
        );

        try {
            // Real authenticated account: strictly query backend APIs and authenticated proxies
            const results = await Promise.allSettled([
                dataProvider.getHosts(),
                dataProvider.getAttackEvents(),
                dataProvider.getIocs(),
                fetchRansomwarePosts(),
                fetchRansomwareGroups(),
                fetchThreatNews(),
                fetchCveUpdates(),
                fetchExploits(),
            ]);

            const [
                hostsResult,
                eventsResult,
                iocsResult,
                ransomwarePostsResult,
                ransomwareGroupsResult,
                newsResult,
                cveResult,
                exploitResult,
            ] = results;

            if (hostsResult.status === 'fulfilled' && hostsResult.value.length > 0) {
                setAnalysisResults(hostsResult.value);
            }

            if (ransomwarePostsResult.status === 'fulfilled') {
                setRansomwarePosts(ransomwarePostsResult.value);
            }

            if (ransomwareGroupsResult.status === 'fulfilled') {
                setRansomwareGroups(ransomwareGroupsResult.value);
            }

            if (newsResult.status === 'fulfilled') {
                setNewsItems(newsResult.value);
                setNewsLastUpdated(new Date());
            }

            if (cveResult.status === 'fulfilled') {
                setCveData(cveResult.value);
            }

            if (exploitResult.status === 'fulfilled' && exploitResult.value.length > 0) {
                setExploitData(exploitResult.value);
            }

            addSystemLog(
                'Intelligence and telemetry refresh completed.',
                'SUCCESS',
                'System',
            );

            addToast(
                'Telemetry data refreshed from backend.',
                'success',
            );
        } catch {
            addSystemLog(
                'Telemetry refresh encountered an issue.',
                'WARN',
                'System',
            );
        } finally {
            setIsFeedLoading(false);
        }
    };

    useEffect(() => {
        if (
            !isStorageLoaded ||
            initialFeedRefreshStarted.current
        ) {
            return;
        }

        initialFeedRefreshStarted.current = true;

        void handleRefreshAll();
    }, [isStorageLoaded]);

    const handleClearData = async () => {
        await clearStorage();

        try {
            const ownedKeys = Object.keys(
                localStorage,
            ).filter(
                (key) =>
                    key.startsWith('antitode_') ||
                    key.startsWith('xyberah_'),
            );

            for (const key of ownedKeys) {
                localStorage.removeItem(key);
            }
        } catch {
            // Ignore localStorage failures during reset.
        }

        window.location.reload();
    };

    const handleEnrichHost = (host: AnalyzedHost) => {
        if (
            host.otxData ||
            otxQueue.current.some(
                (item) => item.ip === host.ip,
            )
        ) {
            return;
        }

        otxQueue.current.push(host);

        void processOtxQueue();

        addToast(
            `Queued OTX enrichment for ${host.ip}`,
            'info',
        );
    };

    const [activeView, setActiveView] = useState(() =>
        canonicalViewId(
            viewForPath(
                window.location.pathname,
            ),
        ),
    );

    const [sidebarCollapsed, setSidebarCollapsed] =
        useState(
            () =>
                localStorage.getItem(
                    SIDEBAR_STORAGE_KEY,
                ) !== 'false',
        );

    const [searchOpen, setSearchOpen] =
        useState(false);

    const navigate = (viewId: string) => {
        const next = canonicalViewId(viewId);

        const currentPath =
            window.location.pathname;

        const nextPath = routeForView(next);

        setSearchOpen(false);

        if (
            next === activeView &&
            currentPath === nextPath
        ) {
            return;
        }

        setActiveView(next);

        window.history.pushState(
            { view: next },
            '',
            nextPath,
        );

        try {
            localStorage.setItem(
                ACTIVE_VIEW_STORAGE_KEY,
                next,
            );
        } catch {
            // Ignore unavailable localStorage.
        }
    };

    useEffect(() => {
        const onPopState = () => {
            const next = canonicalViewId(
                viewForPath(
                    window.location.pathname,
                ),
            );

            setActiveView(next);
            setSearchOpen(false);

            try {
                localStorage.setItem(
                    ACTIVE_VIEW_STORAGE_KEY,
                    next,
                );
            } catch {
                // Ignore unavailable localStorage.
            }
        };

        window.addEventListener(
            'popstate',
            onPopState,
        );

        return () => {
            window.removeEventListener(
                'popstate',
                onPopState,
            );
        };
    }, []);

    useEffect(() => {
        const desiredPath =
            routeForView(activeView);

        if (
            window.location.pathname === '/' ||
            window.location.pathname !== desiredPath
        ) {
            window.history.replaceState(
                { view: activeView },
                '',
                desiredPath,
            );
        }
    }, [activeView]);

    useEffect(() => {
        const handler = (
            event: KeyboardEvent,
        ) => {
            const modifier =
                event.metaKey ||
                event.ctrlKey;

            if (
                modifier &&
                event.key.toLowerCase() === 'k'
            ) {
                event.preventDefault();

                setSearchOpen(
                    (open) => !open,
                );

                return;
            }

            if (
                modifier &&
                event.key.toLowerCase() === 'b'
            ) {
                event.preventDefault();

                setSidebarCollapsed(
                    (collapsed) => {
                        const next =
                            !collapsed;

                        try {
                            localStorage.setItem(
                                SIDEBAR_STORAGE_KEY,
                                String(next),
                            );
                        } catch {
                            // Ignore storage failure.
                        }

                        return next;
                    },
                );

                return;
            }

            if (event.key === 'Escape') {
                setSearchOpen(false);
            }
        };

        window.addEventListener(
            'keydown',
            handler,
        );

        return () => {
            window.removeEventListener(
                'keydown',
                handler,
            );
        };
    }, []);

    if (!isStorageLoaded) {
        return (
            <div className="at-boot-screen">
                <div className="at-boot-mark">
                    A
                </div>

                <div className="at-boot-title">
                    ANTITODE
                </div>

                <div className="at-boot-status">
                    Loading security workspace
                </div>

                <div className="at-boot-bar">
                    <span />
                </div>
            </div>
        );
    }

    return (
        <div className="at-app-shell">
            <Sidebar
                activeView={activeView}
                collapsed={sidebarCollapsed}
                onToggle={() => {
                    setSidebarCollapsed(
                        (collapsed) => {
                            const next =
                                !collapsed;

                            try {
                                localStorage.setItem(
                                    SIDEBAR_STORAGE_KEY,
                                    String(next),
                                );
                            } catch {
                                // Ignore storage failure.
                            }

                            return next;
                        },
                    );
                }}
                onNavigate={(viewId) => {
                    navigate(viewId);
                    if (window.innerWidth <= 900) {
                        setSidebarCollapsed(true);
                        try {
                            localStorage.setItem(SIDEBAR_STORAGE_KEY, 'true');
                        } catch {}
                    }
                }}
                onOpenSearch={() =>
                    setSearchOpen(true)
                }
            />

            {!sidebarCollapsed && (
                <div 
                    className="at-sidebar-mobile-overlay"
                    onClick={() => {
                        setSidebarCollapsed(true);
                        try {
                            localStorage.setItem(SIDEBAR_STORAGE_KEY, 'true');
                        } catch {}
                    }}
                />
            )}

            <div className="at-shell-main">
                <Header
                    activeView={activeView}
                    sidebarCollapsed={
                        sidebarCollapsed
                    }
                    onToggleSidebar={() => {
                        setSidebarCollapsed(
                            (collapsed) => {
                                const next =
                                    !collapsed;

                                try {
                                    localStorage.setItem(
                                        SIDEBAR_STORAGE_KEY,
                                        String(next),
                                    );
                                } catch {
                                    // Ignore storage failure.
                                }

                                return next;
                            },
                        );
                    }}
                    onOpenSearch={() =>
                        setSearchOpen(true)
                    }
                    onOpenSettings={() =>
                        navigate('settings')
                    }
                    onNavigate={(viewId) => {
                        navigate(viewId);
                        if (window.innerWidth <= 900) {
                            setSidebarCollapsed(true);
                            try {
                                localStorage.setItem(SIDEBAR_STORAGE_KEY, 'true');
                            } catch {}
                        }
                    }}
                />

                <main className="at-app-main">
                    {errorMsg && (
                        <div className="at-global-error">
                            <AlertCircle size={17} />

                            <span>
                                {errorMsg}
                            </span>

                            <button
                                type="button"
                                onClick={() =>
                                    setErrorMsg(
                                        null,
                                    )
                                }
                            >
                                Dismiss
                            </button>
                        </div>
                    )}

                    {appState ===
                        AppState.ANALYZING ? (
                        <div className="at-analysis-loading">
                            <div className="at-loading-spinner" />

                            <h2>
                                Processing security
                                telemetry
                            </h2>

                            <p>
                                Normalizing logs,
                                enriching indicators,
                                and recalculating
                                risk.
                            </p>
                        </div>
                    ) : (
                        <ErrorBoundary>
                            <ViewRouter
                                activeView={
                                activeView
                            }
                            onNavigate={
                                navigate
                            }
                            results={combinedResults.length > 0 ? combinedResults : (isPublicDemo() ? DEMO_HOSTS : [])}
                            malpediaActors={malpediaActors.length > 0 ? malpediaActors : (isPublicDemo() ? DEMO_ACTORS : [])}
                            cveData={cveData.length > 0 ? cveData : (isPublicDemo() ? DEMO_CVES : [])}
                            cveFeedItems={cveFeedItems.length > 0 ? cveFeedItems : (isPublicDemo() ? DEMO_CVE_FEEDS : [])}
                            exploitData={exploitData.length > 0 ? exploitData : (isPublicDemo() ? DEMO_EXPLOITS : [])}
                            isFeedLoading={
                                isFeedLoading
                            }
                            newsItems={newsItems.length > 0 ? newsItems : (isPublicDemo() ? DEMO_NEWS : [])}
                            newsLastUpdated={
                                newsLastUpdated
                            }
                            onRefreshNews={
                                handleRefreshAll
                            }
                            onRefreshAll={
                                handleRefreshAll
                            }
                            urlHausItems={urlHausItems.length > 0 ? urlHausItems : (isPublicDemo() ? DEMO_URLHAUS : [])}
                            malwareBazaarItems={malwareBazaarItems.length > 0 ? malwareBazaarItems : (isPublicDemo() ? DEMO_MALWAREBAZAAR : [])}
                            feodoItems={feodoItems.length > 0 ? feodoItems : (isPublicDemo() ? DEMO_FEODO : [])}
                            sslBlItems={sslBlItems.length > 0 ? sslBlItems : (isPublicDemo() ? DEMO_SSLBL : [])}
                            ja3Items={ja3Items.length > 0 ? ja3Items : (isPublicDemo() ? DEMO_JA3 : [])}
                            threatFoxItems={threatFoxItems.length > 0 ? threatFoxItems : (isPublicDemo() ? DEMO_THREATFOX : [])}
                            ipsumItems={
                                ipsumItems
                            }
                            blocklistDeItems={
                                blocklistDeItems
                            }
                            c2IntelItems={
                                c2IntelItems
                            }
                            maliciousHashItems={
                                maliciousHashItems
                            }
                            ransomwarePosts={isPublicDemo() ? DEMO_RANSOMWARE_POSTS : ransomwarePosts}
                            ransomwareGroups={isPublicDemo() ? DEMO_RANSOMWARE_GROUPS : ransomwareGroups}
                            onAddLogs={
                                handleAddLogs
                            }
                            productName={
                                settings.productName
                            }
                            logoUrl={
                                settings.logoUrl
                            }
                            settings={settings}
                            onUpdateSettings={setSettings}
                            onEnrichHost={
                                handleEnrichHost
                            }
                        />
                        </ErrorBoundary>
                    )}
                </main>
            </div>



            {toasts.length > 0 && (
                <div className="at-toast-stack">
                    {toasts.map((toast) => (
                        <div
                            key={toast.id}
                            className={`at-toast at-toast-${toast.type}`}
                        >
                            {toast.type ===
                                'success' ? (
                                <CheckCircle
                                    size={16}
                                />
                            ) : toast.type ===
                                'error' ? (
                                <XCircle
                                    size={16}
                                />
                            ) : (
                                <Info
                                    size={16}
                                />
                            )}

                            <span>
                                {
                                    toast.message
                                }
                            </span>
                        </div>
                    ))}
                </div>
            )}

            <PlanNoticeModal />
            <ApiEventToast onNavigate={navigate} />
            <CommandPalette
                isOpen={searchOpen}
                onClose={() =>
                    setSearchOpen(false)
                }
                onNavigate={navigate}
            />
        </div>
    );
};

