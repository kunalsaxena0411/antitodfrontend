import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';

import type {
  AnalyzedHost,
  CveEntry,
  CveFeedItem,
  ExploitEntry,
  ThreatNewsItem,
  MalpediaActor,
  UrlHausEntry,
  FeodoTrackerEntry,
  MalwareBazaarEntry,
  ThreatFoxEntry,
  SslBlEntry,
  Ja3FingerprintEntry,
} from '../../types';

import { PLAYBOOKS } from '../../services/playbooks';
import { DEMO_IOCS } from '../data/demo/iocs';
import { DEMO_MODE } from '../services/dataProvider';

export interface AppDataContextType {
  results: AnalyzedHost[];
  cveData: CveEntry[];
  cveFeedItems: CveFeedItem[];
  exploitData: ExploitEntry[];
  newsItems: ThreatNewsItem[];
  malpediaActors: MalpediaActor[];
  urlHausItems: UrlHausEntry[];
  feodoItems: FeodoTrackerEntry[];
  malwareBazaarItems: MalwareBazaarEntry[];
  sslBlItems: SslBlEntry[];
  ja3Items: Ja3FingerprintEntry[];
  threatFoxItems: ThreatFoxEntry[];
  playbooks: typeof PLAYBOOKS;
  onNavigate: (viewId: string) => void;

  /* Backwards-compatible aliases used by migrated/legacy views. */
  MOCK_HOSTS: AnalyzedHost[];
  MOCK_CVES: CveEntry[];
  MOCK_NEWS: ThreatNewsItem[];
  MOCK_ACTORS: MalpediaActor[];
  MOCK_PLAYBOOKS: typeof PLAYBOOKS;
  MOCK_IOCS: CombinedIoc[];
  MOCK_EVENTS: any[];
}

type AppDataProviderValue = Omit<
  AppDataContextType,
  | 'playbooks'
  | 'MOCK_HOSTS'
  | 'MOCK_CVES'
  | 'MOCK_NEWS'
  | 'MOCK_ACTORS'
  | 'MOCK_PLAYBOOKS'
  | 'MOCK_IOCS'
  | 'MOCK_EVENTS'
>;

interface CombinedIoc {
  id: string;
  type: string;
  value: string;
  source: string;
  severity: string;
  firstSeen: string | undefined;
  lastSeen: string | undefined;
  tags: string[];
}

const AppDataContext = createContext<AppDataContextType | null>(null);

function normalizeTags(tags: string[] | null | undefined): string[] {
  return Array.isArray(tags) ? tags.filter(Boolean) : [];
}

export function AppDataProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: AppDataProviderValue;
}) {
  const combinedIocs = useMemo<CombinedIoc[]>(() => {
    const iocs: CombinedIoc[] = [];

    for (const item of value.urlHausItems ?? []) {
      iocs.push({
        id: item.id,
        type: 'url',
        value: item.url,
        source: 'URLhaus',
        severity: item.threat?.toLowerCase().includes('malware')
          ? 'critical'
          : 'high',
        firstSeen: item.dateadded,
        lastSeen: item.last_online,
        tags: normalizeTags(item.tags),
      });
    }

    for (const item of value.feodoItems ?? []) {
      iocs.push({
        id: `feodo-${item.ip_address}-${item.port}`,
        type: 'ip',
        value: item.ip_address,
        source: 'FeodoTracker',
        severity: 'high',
        firstSeen: item.first_seen,
        lastSeen: item.last_online,
        tags: normalizeTags([item.malware, item.status]),
      });
    }

    for (const item of value.malwareBazaarItems ?? []) {
      const hash = item.sha256_hash || item.sha1_hash || item.md5_hash;

      if (!hash) continue;

      iocs.push({
        id: `malwarebazaar-${hash}`,
        type: 'hash',
        value: hash,
        source: 'MalwareBazaar',
        severity: item.signature ? 'critical' : 'high',
        firstSeen: item.first_seen_utc,
        lastSeen: item.first_seen_utc,
        tags: normalizeTags([
          item.signature,
          item.file_type_mime,
          item.file_name,
        ]),
      });
    }

    for (const item of value.threatFoxItems ?? []) {
      iocs.push({
        id: item.id,
        type: item.ioc_type,
        value: item.ioc_value,
        source: 'ThreatFox',
        severity:
          item.confidence_level >= 90
            ? 'critical'
            : item.confidence_level >= 60
              ? 'high'
              : 'medium',
        firstSeen: item.first_seen_utc,
        lastSeen: item.last_seen_utc ?? undefined,
        tags: normalizeTags(item.tags),
      });
    }
    if (DEMO_MODE) {
      // Add demo IOCs, mapping them to the expected CombinedIoc format
      for (const item of DEMO_IOCS) {
        iocs.push({
          id: `demo-ioc-${item.value}`,
          type: item.type as any,
          value: item.value,
          source: item.source,
          severity: item.severity as any,
          firstSeen: item.firstSeen,
          lastSeen: item.lastSeen,
          tags: item.relatedActors || [],
        });
      }
    }

    return iocs;
  }, [
    value.urlHausItems,
    value.feodoItems,
    value.malwareBazaarItems,
    value.threatFoxItems,
  ]);

  const fullValue = useMemo<AppDataContextType>(
    () => ({
      ...value,
      playbooks: PLAYBOOKS,
      MOCK_HOSTS: value.results,
      MOCK_CVES: value.cveData,
      MOCK_NEWS: value.newsItems,
      MOCK_ACTORS: value.malpediaActors,
      MOCK_PLAYBOOKS: PLAYBOOKS,
      MOCK_IOCS: combinedIocs,
      MOCK_EVENTS: [],
    }),
    [
      value.results,
      value.cveData,
      value.cveFeedItems,
      value.exploitData,
      value.newsItems,
      value.malpediaActors,
      value.urlHausItems,
      value.feodoItems,
      value.malwareBazaarItems,
      value.sslBlItems,
      value.ja3Items,
      value.threatFoxItems,
      value.onNavigate,
      combinedIocs,
    ],
  );

  return (
    <AppDataContext.Provider value={fullValue}>
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData(): AppDataContextType {
  const context = useContext(AppDataContext);

  if (!context) {
    throw new Error(
      'useAppData must be used within an AppDataProvider. Wrap the consuming workspace/page with <AppDataProvider>.',
    );
  }

  return context;
}
