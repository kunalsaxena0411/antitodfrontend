import React, { useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bug,
  ChevronRight,
  Download,
  FileText,
  Flame,
  Globe,
  LayoutDashboard,
  ListFilter,
  RefreshCw,
  Server,
  ShieldAlert,
  Share2,
  Target,
  TrendingUp,
  Database,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AnalyzedHost,
  CveEntry,
  CveFeedItem,
  ExploitEntry,
  FeodoTrackerEntry,
  Ja3FingerprintEntry,
  MalwareBazaarEntry,
  SslBlEntry,
  ThreatFoxEntry,
  ThreatNewsItem,
  UrlHausEntry,
} from '../../types';
import { ActiveFilter, FilterType } from '../../hooks/useAnalysisData';
import { generateAnalysisPDF, generateCSV, generateSTIX, downloadFile } from '../../services/exporter';

interface DashboardViewProps {
  clusters: any;
  results: AnalyzedHost[];
  activeFilter: ActiveFilter | null;
  onFilterClick: (type: FilterType, value: string) => void;
  onClearFilter: () => void;
  onNavigate: (view: string) => void;
  newsItems: ThreatNewsItem[];
  cveFeedItems: CveFeedItem[];
  exploitStats?: { total: number; recent: number; withCveContext: number };
  cveStats?: { total: number; critical: number; high: number; recent: number };
  urlHausItems?: UrlHausEntry[];
  feodoItems?: FeodoTrackerEntry[];
  malwareBazaarItems?: MalwareBazaarEntry[];
  threatFoxItems?: ThreatFoxEntry[];
  sslBlItems?: SslBlEntry[];
  ja3Items?: Ja3FingerprintEntry[];
  cveData?: CveEntry[];
  exploitData?: ExploitEntry[];
  logoUrl?: string;
}

const severityMeta = [
  { key: 'CRITICAL' as const, label: 'Critical', className: 'critical' },
  { key: 'HIGH' as const, label: 'High', className: 'high' },
  { key: 'MEDIUM' as const, label: 'Medium', className: 'medium' },
  { key: 'LOW' as const, label: 'Low', className: 'low' },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function buildActivitySeries(results: AnalyzedHost[]) {
  const now = Date.now();
  const buckets = Array.from({ length: 12 }, (_, index) => ({
    hour: new Date(now - (11 - index) * 2 * 60 * 60 * 1000),
    threats: 0,
    hosts: 0,
  }));

  results.forEach((host) => {
    const timestamp = new Date(host.lastSeen).getTime();
    const distance = now - timestamp;
    const bucketIndex = Math.floor((distance / (2 * 60 * 60 * 1000)));
    const index = 11 - bucketIndex;
    if (index >= 0 && index < buckets.length) {
      buckets[index].hosts += 1;
      buckets[index].threats += host.riskLevel === 'CRITICAL' || host.riskLevel === 'HIGH' ? 1 : 0;
    }
  });

  return buckets.map((bucket) => ({
    time: bucket.hour.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    threats: bucket.threats,
    hosts: bucket.hosts,
  }));
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  results,
  activeFilter,
  onFilterClick,
  onClearFilter,
  onNavigate,
  newsItems,
  cveFeedItems,
  exploitStats,
  cveStats,
  urlHausItems = [],
  feodoItems = [],
  malwareBazaarItems = [],
  threatFoxItems = [],
  sslBlItems = [],
  ja3Items = [],
  cveData = [],
  exploitData = [],
  logoUrl,
}) => {
  const counts = useMemo(() => ({
    critical: results.filter((item) => item.riskLevel === 'CRITICAL').length,
    high: results.filter((item) => item.riskLevel === 'HIGH').length,
    medium: results.filter((item) => item.riskLevel === 'MEDIUM').length,
    low: results.filter((item) => item.riskLevel === 'LOW').length,
    blacklisted: results.filter((item) => item.rblStatus === 'LISTED').length,
  }), [results]);

  const feedCount = urlHausItems.length + feodoItems.length + malwareBazaarItems.length + threatFoxItems.length + sslBlItems.length + ja3Items.length;
  const activitySeries = useMemo(() => buildActivitySeries(results), [results]);

  const topOrigins = useMemo(() => {
    const grouped = new Map<string, number>();
    results.forEach((host) => grouped.set(host.country || 'Unknown', (grouped.get(host.country || 'Unknown') || 0) + 1));
    return [...grouped.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [results]);

  const topThreats = useMemo(() => {
    const grouped = new Map<string, number>();
    results.forEach((host) => {
      host.signatures.forEach((signature) => {
        const name = signature.name || 'Detected activity';
        grouped.set(name, (grouped.get(name) || 0) + 1);
      });
    });
    return [...grouped.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [results]);

  const recentHosts = useMemo(() => {
    return [...results].sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()).slice(0, 7);
  }, [results]);

  const exportReport = (format: 'PDF' | 'CSV' | 'STIX') => {
    if (format === 'PDF') generateAnalysisPDF(results, logoUrl);
    if (format === 'CSV') downloadFile(generateCSV(results), `analysis_report_${Date.now()}.csv`, 'text/csv');
    if (format === 'STIX') downloadFile(generateSTIX(results), `analysis_report_${Date.now()}.json`, 'application/json');
  };

  return (
    <div className="at-dashboard">
      <header className="at-dashboard-hero">
        <div>
          <div className="at-eyebrow"><LayoutDashboard size={14} /> Operations</div>
          <h1>Security operations overview</h1>
          <p>Monitor analyzed hosts, active detections, intelligence feeds and recent threat activity from one workspace.</p>
        </div>
        <div className="at-dashboard-actions">
          <button type="button" className="at-button at-button-secondary" onClick={() => onNavigate('analysis')}><ListFilter size={14} /> View analysis</button>
          <button type="button" className="at-button at-button-secondary" onClick={() => onNavigate('honeypot_logs')}><Activity size={14} /> Honeypot logs</button>
          <button type="button" className="at-button at-button-primary" onClick={() => exportReport('PDF')}><Download size={14} /> Export report</button>
        </div>
      </header>

      {activeFilter && (
        <div className="at-dashboard-filterbar">
          <span><span className="at-filter-dot" /> Filtered view: <strong>{activeFilter.type}</strong> = {activeFilter.value}</span>
          <button type="button" onClick={onClearFilter}>Clear filter</button>
        </div>
      )}

      <section className="at-dashboard-kpis">
        <button type="button" className="at-kpi-card" onClick={() => onNavigate('analysis')}>
          <span className="at-kpi-icon neutral"><Server size={17} /></span>
          <span className="at-kpi-copy"><small>Analyzed hosts</small><strong>{formatNumber(results.length)}</strong><em>Processed telemetry</em></span>
          <ArrowUpRight size={15} className="at-kpi-arrow" />
        </button>
        <button type="button" className="at-kpi-card is-alert" onClick={() => onFilterClick('risk', 'CRITICAL')}>
          <span className="at-kpi-icon critical"><ShieldAlert size={17} /></span>
          <span className="at-kpi-copy"><small>Critical threats</small><strong>{formatNumber(counts.critical)}</strong><em>Requires immediate attention</em></span>
          <ArrowUpRight size={15} className="at-kpi-arrow" />
        </button>
        <button type="button" className="at-kpi-card" onClick={() => onFilterClick('risk', 'HIGH')}>
          <span className="at-kpi-icon high"><AlertTriangle size={17} /></span>
          <span className="at-kpi-copy"><small>High-risk hosts</small><strong>{formatNumber(counts.high)}</strong><em>{formatNumber(counts.blacklisted)} listed on RBLs</em></span>
          <ArrowUpRight size={15} className="at-kpi-arrow" />
        </button>
        <button type="button" className="at-kpi-card" onClick={() => onNavigate('iocs')}>
          <span className="at-kpi-icon intel"><Database size={17} /></span>
          <span className="at-kpi-copy"><small>Intel indicators</small><strong>{formatNumber(feedCount)}</strong><em>{newsItems.length} articles in feed</em></span>
          <ArrowUpRight size={15} className="at-kpi-arrow" />
        </button>
      </section>

      <section className="at-dashboard-grid at-dashboard-grid-main">
        <div className="at-saas-panel at-activity-panel">
          <div className="at-panel-head">
            <div><h2>Threat activity</h2><p>Observed high-severity activity across the latest telemetry window.</p></div>
            <span className="at-live-chip"><span />Live</span>
          </div>
          <div className="at-chart-wrap">
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={activitySeries} margin={{ left: -12, right: 8, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="threatFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d62828" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="#d62828" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#20252d" vertical={false} />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#7b8490', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#7b8490', fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#101317', border: '1px solid #282e36', borderRadius: 8, color: '#f3f4f6' }} />
                <Area type="monotone" dataKey="threats" stroke="#d62828" fill="url(#threatFill)" strokeWidth={2} name="High + Critical" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="at-chart-legend">
            <span><i className="critical" /> High + Critical</span>
            <span><i className="neutral" /> Hosts</span>
            <span className="mono">2h buckets</span>
          </div>
        </div>

        <div className="at-saas-panel at-exposure-panel">
          <div className="at-panel-head">
            <div><h2>Risk posture</h2><p>Current distribution by scored risk level.</p></div>
            <TrendingUp size={16} className="at-muted-icon" />
          </div>
          <div className="at-risk-total"><strong>{formatNumber(results.length)}</strong><span>hosts in scope</span></div>
          <div className="at-risk-bars">
            {severityMeta.map((severity) => {
              const count = counts[severity.key.toLowerCase() as keyof typeof counts];
              const percent = results.length ? Math.round((count / results.length) * 100) : 0;
              return (
                <button key={severity.key} type="button" className="at-risk-row" onClick={() => onFilterClick('risk', severity.key)}>
                  <span className={`at-severity-dot ${severity.className}`} />
                  <span className="at-risk-label">{severity.label}</span>
                  <span className="at-risk-track"><i className={severity.className} style={{ width: `${percent}%` }} /></span>
                  <strong>{count}</strong>
                  <small>{percent}%</small>
                </button>
              );
            })}
          </div>
          <div className="at-risk-summary"><span><Flame size={13} /> {formatNumber(counts.critical + counts.high)} elevated</span><span><Target size={13} /> {formatNumber(counts.blacklisted)} RBL listed</span></div>
        </div>
      </section>

      <section className="at-dashboard-grid at-dashboard-grid-three">
        <div className="at-saas-panel">
          <div className="at-panel-head">
            <div><h2>Latest observations</h2><p>Most recently seen hosts in the workspace.</p></div>
            <button type="button" className="at-link-button" onClick={() => onNavigate('analysis')}>Open analysis <ChevronRight size={13} /></button>
          </div>
          <div className="at-host-table">
            {recentHosts.map((host) => (
              <button type="button" className="at-host-row" key={`${host.ip}-${host.lastSeen}`} onClick={() => onNavigate('analysis')}>
                <span className={`at-severity-dot ${host.riskLevel.toLowerCase()}`} />
                <span className="at-host-main"><strong>{host.ip}</strong><small>{host.dnsHostname || host.country || 'Unknown origin'}</small></span>
                <span className="at-host-score">{Math.round(host.totalScore)}<small>score</small></span>
                <ArrowUpRight size={14} />
              </button>
            ))}
            {recentHosts.length === 0 && <div className="at-empty-state">No analyzed hosts available.</div>}
          </div>
        </div>

        <div className="at-saas-panel">
          <div className="at-panel-head"><div><h2>Top threat signals</h2><p>Most frequent detected signatures.</p></div><Bug size={16} className="at-muted-icon" /></div>
          <div className="at-ranked-list">
            {topThreats.map(([label, count], index) => (
              <div className="at-ranked-row" key={label}>
                <span className="at-rank">0{index + 1}</span>
                <span className="at-rank-label">{label}</span>
                <strong>{count}</strong>
              </div>
            ))}
            {topThreats.length === 0 && <div className="at-empty-state">No signatures available.</div>}
          </div>
        </div>

        <div className="at-saas-panel">
          <div className="at-panel-head"><div><h2>Origin profile</h2><p>Source countries in current host set.</p></div><Globe size={16} className="at-muted-icon" /></div>
          <div className="at-ranked-list">
            {topOrigins.map(([country, count], index) => (
              <button type="button" className="at-ranked-row at-ranked-button" key={country} onClick={() => onFilterClick('country', country)}>
                <span className="at-rank">0{index + 1}</span>
                <span className="at-rank-label">{country}</span>
                <strong>{count}</strong>
              </button>
            ))}
            {topOrigins.length === 0 && <div className="at-empty-state">No origin data available.</div>}
          </div>
        </div>
      </section>

      <section className="at-dashboard-grid at-dashboard-grid-four">
        <button type="button" className="at-metric-tile" onClick={() => onNavigate('exploits')}><span><Bug size={15} /> Known exploits</span><strong>{formatNumber(exploitStats?.total || exploitData.length)}</strong><small>{formatNumber(exploitStats?.recent || 0)} recent</small></button>
        <button type="button" className="at-metric-tile" onClick={() => onNavigate('cve')}><span><Flame size={15} /> Vulnerabilities</span><strong>{formatNumber(cveStats?.total || cveData.length || cveFeedItems.length)}</strong><small>{formatNumber(cveStats?.critical || 0)} critical</small></button>
        <button type="button" className="at-metric-tile" onClick={() => onNavigate('news')}><span><Globe size={15} /> Intel articles</span><strong>{formatNumber(newsItems.length)}</strong><small>Threat news feed</small></button>
        <button type="button" className="at-metric-tile" onClick={() => onNavigate('iocs')}><span><Database size={15} /> Feed indicators</span><strong>{formatNumber(feedCount)}</strong><small>Across configured sources</small></button>
      </section>

      <section className="at-dashboard-footer-actions">
        <div><strong>Reporting</strong><span>Export the current analyzed host set without leaving the workspace.</span></div>
        <div className="at-dashboard-actions">
          <button type="button" className="at-button at-button-secondary" onClick={() => exportReport('CSV')}><FileText size={14} /> CSV</button>
          <button type="button" className="at-button at-button-secondary" onClick={() => exportReport('STIX')}><Share2 size={14} /> STIX</button>
          <button type="button" className="at-button at-button-secondary" onClick={() => onNavigate('honeypot_logs')}><RefreshCw size={14} /> Refresh telemetry</button>
        </div>
      </section>
    </div>
  );
};
