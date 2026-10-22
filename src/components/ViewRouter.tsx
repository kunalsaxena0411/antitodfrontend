/**
 * ViewRouter — Canonical view dispatch for ANTITODE.
 *
 * Architecture:
 *   App
 *    └── AppShell
 *         └── ViewRouter
 *              ├── migrated pages in src/pages/*
 *              └── legacy compatibility views in components/views/*
 *
 * IMPORTANT:
 * - This is the only place where legacy view imports should exist.
 * - Migrated pages render directly.
 * - Legacy modules are isolated inside LegacyWrapper.
 * - No legacy component is allowed to introduce its own application shell.
 * - When a legacy module is fully migrated, remove its import and case here.
 */

import React, { useState, Suspense } from 'react';
import type { ReactNode } from 'react';
import { Lock, ShieldAlert } from 'lucide-react';

import type {
  AnalyzedHost,
  LogEntry,
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
  C2IntelFeedEntry,
  RansomWatchPost,
  RansomWatchGroup,
  MaliciousHashEntry,
} from '../../types';

import { useAnalysisData } from '../../hooks/useAnalysisData';

import { AppDataProvider } from '../contexts/AppDataContext';
import { findNavItem, isPreview as isNavPreview, canonicalViewId } from '../data/navigation';

/* -------------------------------------------------------------------------- */
/*                                New Pages                                   */
/* -------------------------------------------------------------------------- */

import DashboardPage from '../pages/DashboardPage';
import HoneypotLogsPage from '../pages/HoneypotLogsPage';
import ActorsPage from '../pages/ActorsPage';
import CvePage from '../pages/CvePage';
import NewsPage from '../pages/NewsPage';
import AttackMapPage from '../pages/AttackMapPage';
import IocPage from '../pages/IocPage';
import AnalysisPage from '../pages/AnalysisPage';
import PlaceholderPage from '../pages/PlaceholderPage';

/* -------------------------------------------------------------------------- */
/*                          Legacy Compatibility Layer                        */
/* -------------------------------------------------------------------------- */

import { BigScreenView } from '../../components/views/BigScreenView';
import { WebCheckView } from '../../components/views/WebCheckView';
import { NetworkToolsView } from '../../components/views/NetworkToolsView';
import { RansomwareView } from '../../components/views/RansomwareView';
import { HelpView } from '../../components/views/HelpView';
import { IntelSearchView } from '../../components/views/IntelSearchView';
import { InfrastructureView } from '../../components/views/InfrastructureView';
import { XyberahReconView } from '../../components/views/XyberahReconView';
import { IntegrationsView } from '../../components/views/IntegrationsView';
import { ExploitView } from '../../components/views/ExploitView';
import { AccessControlView } from '../../components/views/AccessControlView';
import { BillingView } from '../../components/views/BillingView';
import { SettingsView } from '../../components/views/SettingsView';
import { useAuth } from '../../contexts/AuthContext';

/* -------------------------------------------------------------------------- */
/*                                  Types                                     */
/* -------------------------------------------------------------------------- */

export interface ViewRouterProps {
  activeView: string;
  onNavigate: (viewId: string) => void;

  /* ------------------------------- Core data ------------------------------ */

  results: AnalyzedHost[];

  malpediaActors: MalpediaActor[];

  cveData: CveEntry[];
  cveFeedItems: CveFeedItem[];

  exploitData: ExploitEntry[];

  isFeedLoading: boolean;

  newsItems: ThreatNewsItem[];
  newsLastUpdated: Date | null;
  onRefreshNews: () => void;

  onRefreshAll: () => void;

  /* ---------------------------- Intelligence data ------------------------- */

  urlHausItems: UrlHausEntry[];
  malwareBazaarItems: MalwareBazaarEntry[];
  feodoItems: FeodoTrackerEntry[];
  sslBlItems: SslBlEntry[];
  ja3Items: Ja3FingerprintEntry[];
  threatFoxItems: ThreatFoxEntry[];
  ipsumItems: IpsumEntry[];
  blocklistDeItems: BlocklistDeEntry[];
  c2IntelItems: C2IntelFeedEntry[];
  maliciousHashItems: MaliciousHashEntry[];

  /* ---------------------------- Ransomware data --------------------------- */

  ransomwarePosts: RansomWatchPost[];
  ransomwareGroups: RansomWatchGroup[];

  /* ------------------------------- Actions -------------------------------- */

  onAddLogs: (data: LogEntry[]) => void;

  onEnrichHost?: (host: AnalyzedHost) => void;

  /* ------------------------------- Branding ------------------------------- */

  productName: string;
  logoUrl: string;
  settings?: import('../../types').AppSettings;
  onUpdateSettings?: (s: import('../../types').AppSettings) => void;
}

/* -------------------------------------------------------------------------- */
/*                             Compatibility UI                               */
/* -------------------------------------------------------------------------- */

/**
 * Isolates legacy content from the new SaaS shell.
 *
 * Legacy pages are intentionally kept visually contained here. They must not
 * provide another application-level sidebar/header/navigation system.
 */
function LegacyWrapper({ children }: { children: ReactNode }) {
  return (
    <section
      className="at-legacy-view-wrap"
      data-view-generation="legacy"
      aria-label="Legacy module workspace"
    >
      {children}
    </section>
  );
}

/**
 * Renders a dismissable preview banner above a module's content
 * when the active view is marked as `status: 'preview'`.
 */
function PreviewBanner({ children }: { viewId?: string; children: ReactNode }) {
  return <>{children}</>;
}

/* -------------------------------------------------------------------------- */
/*                                Component                                   */
/* -------------------------------------------------------------------------- */

export default function ViewRouter({
  activeView,
  onNavigate,

  results,

  malpediaActors,

  cveData,
  cveFeedItems,

  exploitData,

  isFeedLoading,

  newsItems,
  newsLastUpdated,
  onRefreshNews,

  onRefreshAll,

  urlHausItems,
  malwareBazaarItems,
  feodoItems,
  sslBlItems,
  ja3Items,
  threatFoxItems,
  ipsumItems,
  blocklistDeItems,
  c2IntelItems,
  maliciousHashItems,

  ransomwarePosts,
  ransomwareGroups,

  onAddLogs,

  productName,
  logoUrl,
  settings,
  onUpdateSettings,

  onEnrichHost,
}: ViewRouterProps) {
  const [initialIntelQuery, setInitialIntelQuery] = useState<string | null>(
    null,
  );
  const { permissions, permissionsLoaded } = useAuth();
  const hasOsmAccess = permissions.some((p) => p.startsWith('osm.'));
  const hasIntegrationsAccess = permissions.some((p) => p.startsWith('integrations.'));

  /*
   * The analysis hook remains centralized here because both migrated and
   * legacy analysis-driven modules consume the derived intelligence data.
   *
   * Only exploitStats is currently required directly by this router.
   */
  const { exploitStats } = useAnalysisData(
    results,
    malpediaActors,
    cveData,
    exploitData,
    urlHausItems,
  );


  /* ------------------------------------------------------------------------ */
  /*                              View dispatch                               */
  /* ------------------------------------------------------------------------ */

  let renderedView: ReactNode;

  switch (activeView) {
    /* ====================================================================== */
    /*                              MIGRATED PAGES                            */
    /* ====================================================================== */

    case 'soc_wall':
      renderedView = (
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
          onExit={() => onNavigate('dashboard')}
          onRefresh={onRefreshAll}
          productName={productName}
          logoUrl={logoUrl}
        />
      );
      break;

    case 'dashboard':
      renderedView = (
        <DashboardPage
          onNavigate={onNavigate}
        />
      );
      break;

    case 'honeypot_logs':
      renderedView = <HoneypotLogsPage onNavigate={onNavigate} />;
      break;

    case 'actors':
      renderedView = <ActorsPage />;
      break;

    case 'cve':
      renderedView = <CvePage />;
      break;

    case 'news':
      renderedView = <NewsPage />;
      break;

    case 'attackmap':
      renderedView = <AttackMapPage onNavigate={onNavigate} />;
      break;

    case 'iocs':
      renderedView = <IocPage />;
      break;

    case 'analysis':
      renderedView = <AnalysisPage onNavigate={onNavigate} />;
      break;

    /* ====================================================================== */
    /*                          LEGACY COMPATIBILITY                           */
    /* ====================================================================== */

    case 'webcheck':
      renderedView = (
        <LegacyWrapper>
          <WebCheckView logoUrl={logoUrl} />
        </LegacyWrapper>
      );
      break;

    case 'exploits':
      renderedView = (
        <LegacyWrapper>
          <ExploitView
            exploits={exploitData}
            cveData={cveData}
            stats={exploitStats}
          />
        </LegacyWrapper>
      );
      break;

    case 'nettools':
      renderedView = (
        <LegacyWrapper>
          <NetworkToolsView />
        </LegacyWrapper>
      );
      break;

    case 'ransomware':
      renderedView = (
        <LegacyWrapper>
          <RansomwareView
            posts={ransomwarePosts}
            groups={ransomwareGroups}
          />
        </LegacyWrapper>
      );
      break;

    case 'help':
      renderedView = (
        <LegacyWrapper>
          <HelpView />
        </LegacyWrapper>
      );
      break;

    case 'intel_search':
      renderedView = (
        <LegacyWrapper>
          <IntelSearchView initialQuery={initialIntelQuery} />
        </LegacyWrapper>
      );
      break;

    case 'infrastructure':
      renderedView = (
        <LegacyWrapper>
          <InfrastructureView />
        </LegacyWrapper>
      );
      break;

    case 'settings':
      renderedView = (
        <LegacyWrapper>
          <SettingsView settings={settings} onUpdateSettings={onUpdateSettings} />
        </LegacyWrapper>
      );
      break;

    case 'access_control':
      renderedView = (
        <LegacyWrapper>
          <AccessControlView />
        </LegacyWrapper>
      );
      break;

    case 'billing':
      renderedView = (
        <LegacyWrapper>
          <BillingView />
        </LegacyWrapper>
      );
      break;

    case 'recon':
      renderedView = (
        <LegacyWrapper>
          {!permissionsLoaded ? (
            <div className="min-h-[500px] flex items-center justify-center p-6 text-neutral-400">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
                <span className="text-xs font-mono">Verifying permissions…</span>
              </div>
            </div>
          ) : !hasOsmAccess ? (
            <div className="min-h-[500px] flex items-center justify-center p-6">
              <div className="max-w-md w-full p-8 rounded-2xl border border-neutral-800 bg-[#0c0d10] text-center shadow-2xl">
                <div className="w-12 h-12 mx-auto rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
                  <ShieldAlert size={22} />
                </div>
                <h2 className="text-lg font-bold text-white mb-2">Access Restricted</h2>
                <p className="text-xs text-neutral-400 mb-6">
                  You do not have the required permissions (<code className="text-neutral-300 font-mono">osm.*</code>) to view Attack Surface Management and Reconnaissance.
                </p>
                <div className="p-3 rounded-lg bg-neutral-900 border border-neutral-800 text-[11px] text-neutral-400 font-mono">
                  Required: osm.module.access or osm.targets.view
                </div>
              </div>
            </div>
          ) : (
            <XyberahReconView />
          )}
        </LegacyWrapper>
      );
      break;

    case 'integrations':
      renderedView = (
        <LegacyWrapper>
          {!permissionsLoaded ? (
            <div className="min-h-[500px] flex items-center justify-center p-6 text-neutral-400">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
                <span className="text-xs font-mono">Verifying permissions…</span>
              </div>
            </div>
          ) : !hasIntegrationsAccess ? (
            <div className="min-h-[500px] flex items-center justify-center p-6">
              <div className="max-w-md w-full p-8 rounded-2xl border border-neutral-800 bg-[#0c0d10] text-center shadow-2xl">
                <div className="w-12 h-12 mx-auto rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
                  <Lock size={22} />
                </div>
                <h2 className="text-lg font-bold text-white mb-2">Access Restricted</h2>
                <p className="text-xs text-neutral-400 mb-6">
                  You do not have the required permissions (<code className="text-neutral-300 font-mono">integrations.*</code>) to view SIEM and SOAR Connectors.
                </p>
                <div className="p-3 rounded-lg bg-neutral-900 border border-neutral-800 text-[11px] text-neutral-400 font-mono">
                  Required: integrations.module.access or integrations.connectors.view
                </div>
              </div>
            </div>
          ) : (
            <IntegrationsView />
          )}
        </LegacyWrapper>
      );
      break;

    /* ====================================================================== */
    /*                                FALLBACK                                */
    /* ====================================================================== */

    default:
      renderedView = (
        <PlaceholderPage
          title="Module unavailable"
          description="This workspace is not currently connected to a page implementation."
        />
      );
      break;
  }

  /* ------------------------------------------------------------------------ */
  /*                               Data context                               */
  /* ------------------------------------------------------------------------ */

  return (
    <AppDataProvider
      value={{
        results,
        malpediaActors,
        cveData,
        cveFeedItems,
        exploitData,
        newsItems,
        urlHausItems,
        malwareBazaarItems,
        feodoItems,
        sslBlItems,
        ja3Items,
        threatFoxItems,
        onNavigate,
      }}
    >
      <PreviewBanner viewId={activeView}>
        {renderedView}
      </PreviewBanner>
    </AppDataProvider>
  );
}