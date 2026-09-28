import React, { useEffect, useMemo, useState } from 'react';
import {
  AnalyzedHost,
  LogEntry,
  MalpediaEntry,
  MalpediaActor,
  CveEntry,
  CveFeedItem,
  ThreatNewsItem,
  ExploitEntry,
  UrlHausEntry,
  MalwareBazaarEntry,
  FeodoTrackerEntry,
  SslBlEntry,
  Ja3FingerprintEntry,
  ThreatFoxEntry,
  IpsumEntry,
  BlocklistDeEntry,
  CaseFile,
  C2IntelFeedEntry,
  MaliciousHashEntry,
  NetworkAnalysisResult,
  EmailAnalysisResult,
  RansomWatchPost,
  RansomWatchGroup,
} from '../types';
import { useAnalysisData } from '../hooks/useAnalysisData';
import { DashboardView } from './views/DashboardView';
import { HoneypotLogsView } from './views/HoneypotLogsView';
import { AnalysisView } from './views/AnalysisView';
import { ActorsView } from './views/ActorsView';
import { CveView } from './views/CveView';
import { NewsView } from './views/NewsView';
import { InvestigationView } from './views/InvestigationView';
import { WebCheckView } from './views/WebCheckView';
import { ExploitView } from './views/ExploitView';
import { NetworkView } from './views/NetworkView';
import { EmailForensicView } from './views/EmailForensicView';
import { AttackMapView } from './views/AttackMapView';
import { NetworkToolsView } from './views/NetworkToolsView';
import { MitreNavigatorView } from './views/MitreNavigatorView';
import { RulesView } from './views/RulesView';
import { SandboxBrowserView } from './views/SandboxBrowserView';
import { BigScreenView } from './views/BigScreenView';
import { ChatView } from './views/ChatView';
import { IocView } from './views/IocView';
import { HelpView } from './views/HelpView';
import { RansomwareView } from './views/RansomwareView';
import { BrandMonitorView } from './views/BrandMonitorView';
import { PlaybookView } from './views/PlaybookView';
import { DynamicSandboxView } from './views/DynamicSandboxView';
import { InvestigationBenchView } from './views/InvestigationBenchView';
import { IntelSearchView } from './views/IntelSearchView';
import { CyberChefView } from './views/CyberChefView';
import { ThreatCanvasView } from './views/ThreatCanvasView';
import { NetworkTopologyView } from './views/NetworkTopologyView';
import { InfrastructureView } from './views/InfrastructureView';
import { XyberahReconView } from './views/XyberahReconView';
import { PLAYBOOKS } from '../services/playbooks';
import ModuleChrome from '../src/components/layout/ModuleChrome';

export interface ResultsTableProps {
  results: AnalyzedHost[];
  malpediaData: MalpediaEntry[];
  malpediaActors: MalpediaActor[];
  cveData: CveEntry[];
  cveFeedItems?: CveFeedItem[];
  exploitData?: ExploitEntry[];
  isFeedLoading?: boolean;
  newsItems: ThreatNewsItem[];
  newsLastUpdated: Date | null;
  onRefreshNews: () => void;
  onRefreshAll: () => void;
  urlHausItems?: UrlHausEntry[];
  malwareBazaarItems?: MalwareBazaarEntry[];
  feodoItems?: FeodoTrackerEntry[];
  sslBlItems?: SslBlEntry[];
  ja3Items?: Ja3FingerprintEntry[];
  threatFoxItems?: ThreatFoxEntry[];
  ipsumItems?: IpsumEntry[];
  blocklistDeItems?: BlocklistDeEntry[];
  c2IntelItems?: C2IntelFeedEntry[];
  maliciousHashItems?: MaliciousHashEntry[];
  ransomwarePosts?: RansomWatchPost[];
  ransomwareGroups?: RansomWatchGroup[];
  onReset: () => void;
  onAddLogs: (data: LogEntry[]) => void;
  productName?: string;
  logoUrl?: string;
  onEnrichHost?: (host: AnalyzedHost) => void;
  networkAnalysis: NetworkAnalysisResult | null;
  setNetworkAnalysis: (data: NetworkAnalysisResult | null) => void;
  emailAnalysis: EmailAnalysisResult | null;
  setEmailAnalysis: (data: EmailAnalysisResult | null) => void;
  /** Controlled module selected by the ANTITODE shell. */
  activeView?: string;
  /** Called whenever a child workflow asks to move to another module. */
  onNavigate?: (viewId: string) => void;
}

const VALID_VIEWS = new Set([
  'dashboard',
  'honeypot_logs',
  'analysis',
  'actors',
  'cve',
  'news',
  'investigate',
  'webcheck',
  'exploits',
  'network',
  'email_forensic',
  'attackmap',
  'nettools',
  'navigator',
  'rules',
  'sandbox',
  'soc_wall',
  'chat',
  'iocs',
  'ransomware',
  'help',
  'brand_intel',
  'playbooks',
  'dynamic_sandbox',
  'investigation_bench',
  'intel_search',
  'cyberchef',
  'threat_canvas',
  'topology',
  'infrastructure',
  'recon',
]);

function normalizeView(id: string | undefined): string {
  const aliases: Record<string, string> = {
    attack_map: 'attackmap',
    investigation: 'investigate',
    playbook: 'playbooks',
    mitre: 'navigator',
    ioc: 'iocs',
    exploit: 'exploits',
    brand_monitor: 'brand_intel',
    sandbox_browser: 'sandbox',
  };
  const candidate = aliases[id ?? ''] ?? id ?? 'dashboard';
  return VALID_VIEWS.has(candidate) ? candidate : 'dashboard';
}

export const ResultsTable: React.FC<ResultsTableProps> = ({
  results,
  malpediaActors,
  cveData,
  cveFeedItems = [],
  exploitData = [],
  isFeedLoading,
  newsItems,
  newsLastUpdated,
  onRefreshNews,
  onRefreshAll,
  urlHausItems = [],
  malwareBazaarItems = [],
  feodoItems = [],
  sslBlItems = [],
  ja3Items = [],
  threatFoxItems = [],
  ipsumItems = [],
  blocklistDeItems = [],
  c2IntelItems = [],
  maliciousHashItems = [],
  ransomwarePosts = [],
  ransomwareGroups = [],
  productName,
  logoUrl,
  onEnrichHost,
  networkAnalysis,
  setNetworkAnalysis,
  emailAnalysis,
  setEmailAnalysis,
  activeView,
  onNavigate,
}) => {
  const [localView, setLocalView] = useState('dashboard');
  const [activeCase, setActiveCase] = useState<CaseFile | null>(null);
  const [initialIntelQuery, setInitialIntelQuery] = useState<string | null>(null);
  const [favorite, setFavorite] = useState(false);

  const currentView = normalizeView(activeView ?? localView);

  useEffect(() => {
    if (activeView) setLocalView(normalizeView(activeView));
  }, [activeView]);

  useEffect(() => {
    const sync = () => {
      try {
        const favorites = JSON.parse(localStorage.getItem('antitode_favorites') || '[]') as string[];
        setFavorite(favorites.includes(currentView));
      } catch {
        setFavorite(false);
      }
    };
    sync();
    window.addEventListener('antitode-favorites-changed', sync);
    return () => window.removeEventListener('antitode-favorites-changed', sync);
  }, [activeView, currentView]);

  const toggleFavorite = () => {
    try {
      const current = JSON.parse(localStorage.getItem('antitode_favorites') || '[]') as string[];
      const next = current.includes(currentView)
        ? current.filter((id) => id !== currentView)
        : [...current, currentView];
      localStorage.setItem('antitode_favorites', JSON.stringify(next));
      setFavorite(next.includes(currentView));
      window.dispatchEvent(new Event('antitode-favorites-changed'));
    } catch {
      // Local storage is optional; module navigation remains functional without it.
    }
  };

  const navigate = (viewId: string) => {
    const next = normalizeView(viewId);
    setLocalView(next);
    onNavigate?.(next);
  };

  const {
    clusters,
    actorStats,
    cveStats,
    exploitStats,
    filteredResults,
    activeFilter,
    setActiveFilter,
  } = useAnalysisData(results, malpediaActors, cveData, exploitData, urlHausItems);

  const handleNavigateToIntel = (query: string) => {
    setInitialIntelQuery(query);
    navigate('intel_search');
  };

  const handleInvestigate = (host: AnalyzedHost) => {
    let playbookId = 'pb-phishing';
    if (host.riskLevel === 'CRITICAL' || host.isFeodo || host.isC2Intel) playbookId = 'pb-c2';

    const playbook = PLAYBOOKS.find((candidate) => candidate.id === playbookId);
    if (!playbook) return;

    const newCase: CaseFile = {
      id: crypto.randomUUID(),
      title: `Investigation: ${host.ip}`,
      playbookId: playbook.id,
      status: 'OPEN',
      priority: host.riskLevel === 'CRITICAL' ? 'Critical' : 'High',
      currentStepId: playbook.startStepId,
      artifacts: [
        { id: crypto.randomUUID(), type: 'IP', value: host.ip, note: 'Suspect Host', addedAt: new Date().toISOString() },
        { id: crypto.randomUUID(), type: 'TEXT', value: `Risk Level: ${host.riskLevel}`, addedAt: new Date().toISOString() },
      ],
      history: [{ stepId: playbook.startStepId, action: 'Case Created from Analysis', timestamp: new Date().toISOString(), user: 'Analyst' }],
      context: { ip: host.ip, country: host.country, asn: host.enrichmentData?.asn?.name },
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    };

    setActiveCase(newCase);
    navigate('playbooks');
  };

  if (currentView === 'soc_wall') {
    return (
      <div className="antitode-view-root h-full min-h-0 overflow-hidden">
        <BigScreenView
          results={results}
          newsItems={newsItems}
          cveItems={cveFeedItems}
          cveData={cveData}
          actors={malpediaActors}
          exploitData={exploitData}
          urlHausItems={urlHausItems}
          feodoItems={feodoItems}
          malwareBazaarItems={malwareBazaarItems}
          threatFoxItems={threatFoxItems}
          ja3Items={ja3Items}
          ransomwarePosts={ransomwarePosts}
          ransomwareGroups={ransomwareGroups}
          onExit={() => navigate('dashboard')}
          onRefresh={onRefreshAll}
          productName={productName}
          logoUrl={logoUrl}
        />
      </div>
    );
  }

  return (
    <div className="antitode-view-root h-full min-h-0 min-w-0 overflow-hidden bg-[#0A0A0A]">
      <div className="h-full min-h-0 min-w-0 overflow-auto antitode-module-scroll">
        <ModuleChrome activeView={currentView} favorite={favorite} onToggleFavorite={toggleFavorite} />
        <div className="at-module-view-body">
        {currentView === 'dashboard' && (
          <DashboardView
            clusters={clusters}
            results={results}
            activeFilter={activeFilter}
            onFilterClick={(type, value) => setActiveFilter({ type, value })}
            onClearFilter={() => setActiveFilter(null)}
            onNavigate={navigate}
            newsItems={newsItems}
            cveFeedItems={cveFeedItems}
            exploitStats={exploitStats}
            cveStats={cveStats}
            urlHausItems={urlHausItems}
            feodoItems={feodoItems}
            malwareBazaarItems={malwareBazaarItems}
            threatFoxItems={threatFoxItems}
            sslBlItems={sslBlItems}
            ja3Items={ja3Items}
            cveData={cveData}
            exploitData={exploitData}
            logoUrl={logoUrl}
          />
        )}
        {currentView === 'honeypot_logs' && <HoneypotLogsView logoUrl={logoUrl} />}
        {currentView === 'analysis' && (
          <AnalysisView
            results={filteredResults}
            onInvestigate={handleInvestigate}
            logoUrl={logoUrl}
            onEnrichHost={onEnrichHost}
          />
        )}
        {currentView === 'investigate' && <InvestigationView results={results} />}
        {currentView === 'playbooks' && <PlaybookView initialCase={activeCase} />}
        {currentView === 'investigation_bench' && (
          <InvestigationBenchView
            threatFoxItems={threatFoxItems}
            urlHausItems={urlHausItems}
            malwareBazaarItems={malwareBazaarItems}
            feodoItems={feodoItems}
            maliciousHashItems={maliciousHashItems}
          />
        )}
        {currentView === 'intel_search' && <IntelSearchView initialQuery={initialIntelQuery} />}
        {currentView === 'cyberchef' && <CyberChefView onNavigateToIntel={handleNavigateToIntel} />}
        {currentView === 'actors' && (
          <ActorsView
            actors={malpediaActors}
            stats={actorStats}
            urlHausItems={urlHausItems}
            feodoItems={feodoItems}
            malwareBazaarItems={malwareBazaarItems}
            threatFoxItems={threatFoxItems}
          />
        )}
        {currentView === 'cve' && (
          <CveView
            cveData={cveData}
            feedItems={cveFeedItems}
            isLoading={isFeedLoading}
            stats={cveStats}
            exploits={exploitData}
          />
        )}
        {currentView === 'exploits' && (
          <ExploitView exploits={exploitData} cveData={cveData} stats={exploitStats} />
        )}
        {currentView === 'news' && (
          <NewsView
            newsItems={newsItems}
            cveItems={cveFeedItems}
            lastUpdated={newsLastUpdated}
            onRefresh={onRefreshNews}
            urlHausItems={urlHausItems}
          />
        )}
        {currentView === 'webcheck' && <WebCheckView logoUrl={logoUrl} />}
        {currentView === 'network' && (
          <NetworkView actors={malpediaActors} savedResult={networkAnalysis} onUpdateResult={setNetworkAnalysis} />
        )}
        {currentView === 'attackmap' && <AttackMapView results={results} />}
        {currentView === 'nettools' && <NetworkToolsView />}
        {currentView === 'email_forensic' && (
          <EmailForensicView savedResult={emailAnalysis} onUpdateResult={setEmailAnalysis} />
        )}
        {currentView === 'navigator' && (
          <MitreNavigatorView actors={malpediaActors} onNavigateToRule={() => navigate('rules')} />
        )}
        {currentView === 'rules' && <RulesView />}
        {currentView === 'sandbox' && <SandboxBrowserView />}
        {currentView === 'chat' && <ChatView results={results} actors={malpediaActors} cveData={cveData} />}
        {currentView === 'iocs' && <IocView />}
        {currentView === 'ransomware' && <RansomwareView posts={ransomwarePosts} groups={ransomwareGroups} />}
        {currentView === 'brand_intel' && <BrandMonitorView />}
        {currentView === 'dynamic_sandbox' && <DynamicSandboxView />}
        {currentView === 'help' && <HelpView />}
        {currentView === 'threat_canvas' && <ThreatCanvasView />}
        {currentView === 'topology' && <NetworkTopologyView />}
        {currentView === 'infrastructure' && <InfrastructureView />}
        {currentView === 'recon' && <XyberahReconView />}
        </div>
      </div>
    </div>
  );
};
