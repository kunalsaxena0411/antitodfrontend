import React from 'react';
import {
  Briefcase,
  Clock,
  Cloud,
  Database,
  ExternalLink,
  Globe,
  Lock,
  Network,
  Settings2,
  Terminal,
} from 'lucide-react';
import type { Asset, AssetGroupTab } from '../../api/services/openasmClient';
import { cartoDarkTileUrl } from '../../utils/cartoTile';

function tlsDaysRemaining(notAfter: string | undefined): number | null {
  if (!notAfter) return null;
  const d = new Date(notAfter);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 864e5);
}

function tlsCertTone(days: number | null): { text: string; cls: string } {
  if (days === null) return { text: '—', cls: 'border-gray-600 text-gray-500' };
  if (days < 0) return { text: 'Expired', cls: 'border-red-600 text-red-300 bg-red-950/50' };
  if (days < 30) return { text: `SSL ${days}d`, cls: 'border-red-500/60 text-red-200' };
  if (days < 60) return { text: `SSL ${days}d`, cls: 'border-amber-500/60 text-amber-200' };
  return { text: `SSL ${days}d`, cls: 'border-green-600/50 text-green-300' };
}

function statusPillClass(code: string): string {
  const s = String(code).trim();
  const n = parseInt(s, 10);
  if ((n >= 200 && n < 300) || s.startsWith('2')) return 'border-green-600/50 text-green-300 bg-green-950/40';
  if ((n >= 300 && n < 400) || s.startsWith('3')) return 'border-purple-600/50 text-purple-300 bg-purple-950/40';
  if ((n >= 400 && n < 600) || s.startsWith('4') || s.startsWith('5')) return 'border-red-600/50 text-red-300 bg-red-950/40';
  return 'border-gray-600 text-gray-400 bg-black/30';
}

function formatRelativeAgo(iso: string | undefined): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return String(iso);
  const sec = Math.round((t - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const a = Math.abs(sec);
  if (a < 60) return rtf.format(sec, 'second');
  if (a < 3600) return rtf.format(Math.round(sec / 60), 'minute');
  if (a < 86400) return rtf.format(Math.round(sec / 3600), 'hour');
  if (a < 2592000) return rtf.format(Math.round(sec / 86400), 'day');
  return new Date(iso).toISOString().slice(0, 10);
}

function formatTlsYmd(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function formatInventoryServiceCount(raw: unknown): string {
  if (raw == null || raw === '') return '—';
  const n = String(raw).trim();
  if (!n || n === '—') return '—';
  return `${n} services`;
}

function safeProbeUrl(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const t = raw.trim();
  if (!t || t === 'undefined' || t === 'null') return '';
  try {
    const u = new URL(t);
    return u.protocol === 'http:' || u.protocol === 'https:' ? t : '';
  } catch {
    return '';
  }
}

type AllServicesProps = {
  items: Asset[];
  resolveAssetMediaUrl: (path: string | null) => string | null;
  onScreenshotClick: (rawPath: string) => void;
  onOpenAssetDetail?: (id: string) => void;
};

export const InventoryAllServicesTable: React.FC<AllServicesProps> = ({
  items,
  resolveAssetMediaUrl,
  onScreenshotClick,
  onOpenAssetDetail,
}) => (
  <div className="overflow-x-auto rounded-xl border border-gray-800/80 bg-[#070b12]">
    <table className="w-full text-left text-[13px]">
      <thead>
        <tr className="border-b border-gray-800 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          <th className="min-w-[220px] p-3 pl-4">Service</th>
          <th className="w-[108px] p-3">Screenshot</th>
          <th className="min-w-[200px] p-3">Technologies</th>
          <th className="min-w-[200px] p-3">Certificate</th>
          <th className="w-[104px] whitespace-nowrap p-3 pr-4">Time</th>
        </tr>
      </thead>
      <tbody>
        {items.map((asset, idx) => {
          const row = asset as Record<string, unknown>;
          const http = (row.httpResponses ?? {}) as Record<string, unknown>;
          const tls = (http.tls ?? {}) as Record<string, unknown>;
          const ips = Array.isArray(row.ipAddresses) ? (row.ipAddresses as unknown[]).map((x) => String(x)) : [];
          const techStrings = Array.isArray(http.tech) ? (http.tech as unknown[]).map((x) => String(x)) : [];
          const techList = Array.isArray(http.techList) ? (http.techList as Record<string, unknown>[]) : [];
          const chain = Array.isArray(http.chain_status_codes)
            ? (http.chain_status_codes as unknown[]).map((x) => String(x))
            : [];
          const failed = Boolean(http.failed);
          const probeUrl = safeProbeUrl(http.url);
          const faviconRaw = typeof http.favicon_url === 'string' ? http.favicon_url : '';
          const faviconSrc = resolveAssetMediaUrl(faviconRaw || null);
          const shotRaw = typeof row.screenshotPath === 'string' ? row.screenshotPath : '';
          const shotSrc = resolveAssetMediaUrl(shotRaw || null);
          const tlsDays = tlsDaysRemaining(typeof tls.not_after === 'string' ? tls.not_after : undefined);
          const certTone = tlsCertTone(tlsDays);
          const issuerOrgs = Array.isArray(tls.issuer_org) ? (tls.issuer_org as unknown[]).map((x) => String(x)) : [];
          const issuerFallback = String(tls.issuer_cn ?? '');
          const sans = Array.isArray(tls.subject_an) ? (tls.subject_an as unknown[]).map((x) => String(x)) : [];
          const rowKey = String(row.id ?? `inv-${idx}`);
          const showTech = techList.length > 0 || techStrings.length > 0;
          const techTotal = techList.length > 0 ? techList.length : techStrings.length;
          const rawTitle = http.title;
          const titleStr =
            typeof rawTitle === 'string' && rawTitle.trim() && rawTitle.trim() !== 'undefined' ? rawTitle.trim() : '';
          const assetId = String(asset.id ?? row.id ?? '');
          return (
            <tr key={rowKey} className="border-t border-gray-800/80 align-top transition-colors hover:bg-white/[0.03]">
              <td className="p-3 pl-4">
                <div className="flex gap-2.5">
                  <div className="shrink-0 pt-0.5">
                    {faviconSrc ? (
                      <img src={faviconSrc} alt="" className="h-6 w-6 rounded-md border border-gray-700/80 object-cover" />
                    ) : (
                      <Globe size={22} className="text-gray-600" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {probeUrl && !failed ? (
                        <a
                          href={probeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="break-all font-mono text-[13px] font-semibold text-sky-400 hover:text-sky-300 hover:underline"
                        >
                          {String(asset.value ?? row.value ?? '—')}
                        </a>
                      ) : (
                        <span
                          className={`break-all font-mono text-[13px] font-semibold ${failed ? 'text-gray-500 line-through' : 'text-white'}`}
                        >
                          {String(asset.value ?? row.value ?? '—')}
                        </span>
                      )}
                      {probeUrl && !failed ? <ExternalLink size={13} className="shrink-0 text-gray-500" aria-hidden /> : null}
                      {onOpenAssetDetail && assetId ? (
                        <button
                          type="button"
                          onClick={() => onOpenAssetDetail(assetId)}
                          className="shrink-0 rounded p-0.5 text-gray-500 hover:bg-white/5 hover:text-cyan-400"
                          title="Asset details"
                        >
                          <Settings2 size={14} />
                        </button>
                      ) : null}
                      <span className="rounded-full border border-gray-700/80 bg-black/25 px-2 py-0.5 font-mono text-[10px] text-gray-400">
                        {String(asset.type)}
                      </span>
                    </div>
                    {titleStr ? (
                      <p className="line-clamp-2 text-[12px] leading-snug text-gray-400" title={titleStr}>
                        {titleStr}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-1">
                      {chain.length > 0 ? (
                        chain.map((c, ci) => (
                          <span key={`${c}-${ci}`} className="inline-flex items-center gap-1">
                            {ci > 0 ? <span className="text-[10px] text-gray-600">→</span> : null}
                            <span className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-medium ${statusPillClass(c)}`}>
                              {c}
                            </span>
                          </span>
                        ))
                      ) : (
                        <span
                          className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-medium ${statusPillClass(
                            String(http.status_code ?? row.statusCode ?? '—'),
                          )}`}
                        >
                          {String(http.status_code ?? row.statusCode ?? '—')}
                        </span>
                      )}
                      <span className="font-mono text-[10px] text-gray-500">
                        {String(http.scheme ?? 'http')}:{String(http.port ?? '—')}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      {ips.slice(0, 2).map((ip) => (
                        <span
                          key={ip}
                          className="inline-flex max-w-[200px] items-center gap-1 truncate rounded-full border border-gray-700/80 bg-black/20 px-2 py-0.5 font-mono text-[10px] text-gray-300"
                        >
                          <Network size={11} className="shrink-0 text-gray-500" aria-hidden />
                          {ip}
                        </span>
                      ))}
                      {ips.length > 2 ? (
                        <span className="rounded-full border border-gray-700 px-2 py-0.5 text-[10px] text-gray-500">+{ips.length - 2}</span>
                      ) : null}
                      {!ips.length ? <span className="text-[10px] text-gray-600">—</span> : null}
                    </div>
                  </div>
                </div>
              </td>
              <td className="p-3 align-middle">
                {shotSrc ? (
                  <button
                    type="button"
                    onClick={() => onScreenshotClick(shotRaw)}
                    className="block overflow-hidden rounded-lg border border-gray-700/80 hover:border-sky-600/50"
                  >
                    <img src={shotSrc} alt="" className="h-[72px] w-[96px] bg-black object-cover object-top" />
                  </button>
                ) : (
                  <div className="flex h-[72px] w-[96px] items-center justify-center rounded-lg border border-dashed border-gray-700/90 px-1 text-center text-[10px] text-gray-500">
                    No screenshot
                  </div>
                )}
              </td>
              <td className="p-3 align-top">
                {showTech ? (
                  <div className="flex flex-wrap gap-1.5">
                    {techList.slice(0, 5).map((tv, ti) => {
                      const name = String(tv.name ?? 'tech');
                      const desc =
                        typeof tv.description === 'string' && tv.description.trim() ? tv.description.trim() : '';
                      const icon = typeof tv.iconUrl === 'string' ? tv.iconUrl : '';
                      const iconSrc = resolveAssetMediaUrl(icon || null);
                      return (
                        <span
                          key={`${name}-${ti}`}
                          title={desc || name}
                          className="inline-flex cursor-help items-center gap-1.5 rounded-full border border-gray-600/55 bg-gray-900/80 px-2.5 py-1 text-[11px] font-medium text-gray-100 shadow-sm"
                        >
                          {iconSrc ? <img src={iconSrc} alt="" className="h-4 w-4 rounded-sm object-contain" /> : null}
                          {name}
                        </span>
                      );
                    })}
                    {techList.length === 0
                      ? techStrings.slice(0, 5).map((t) => (
                          <span
                            key={t}
                            className="inline-flex items-center rounded-full border border-gray-600/55 bg-gray-900/80 px-2.5 py-1 text-[11px] text-gray-200"
                          >
                            {t}
                          </span>
                        ))
                      : null}
                    {techTotal > 5 ? (
                      <span className="inline-flex items-center rounded-full border border-gray-700 px-2.5 py-1 text-[11px] text-gray-500">
                        +{techTotal - 5}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-xs text-gray-600">—</span>
                )}
              </td>
              <td className="p-3 align-top">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Lock size={13} className="shrink-0 text-gray-500" aria-hidden />
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${certTone.cls}`}>
                      {certTone.text}
                    </span>
                  </div>
                  {(issuerOrgs.length > 0 || issuerFallback) && (
                    <div className="flex flex-wrap items-start gap-2">
                      <Globe size={13} className="mt-0.5 shrink-0 text-gray-500" aria-hidden />
                      <div className="flex flex-wrap gap-1">
                        {(issuerOrgs.length ? issuerOrgs : [issuerFallback])
                          .filter(Boolean)
                          .slice(0, 4)
                          .map((org) => (
                            <span
                              key={org}
                              className="max-w-[160px] truncate rounded-full border border-gray-700/80 bg-black/25 px-2 py-0.5 text-[10px] text-gray-300"
                              title={org}
                            >
                              {org}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
                  {(sans.length > 0 || Boolean(tls.subject_cn)) && (
                    <div className="flex flex-wrap items-start gap-2">
                      <Briefcase size={13} className="mt-0.5 shrink-0 text-gray-500" aria-hidden />
                      <div className="flex flex-wrap gap-1">
                        {[...sans, String(tls.subject_cn ?? '')]
                          .filter(Boolean)
                          .slice(0, 4)
                          .map((d) => (
                            <span
                              key={d}
                              className="max-w-[140px] truncate rounded-full border border-gray-700/70 px-2 py-0.5 text-[10px] text-gray-400"
                              title={d}
                            >
                              {d}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
                  {!tls.not_after && !issuerOrgs.length && !issuerFallback && !sans.length && !tls.subject_cn ? (
                    <span className="text-xs text-gray-600">—</span>
                  ) : null}
                </div>
              </td>
              <td className="p-3 pr-4 align-top text-[12px] text-gray-400">
                {formatRelativeAgo(typeof row.createdAt === 'string' ? row.createdAt : undefined)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

type GroupedProps = {
  group: AssetGroupTab;
  items: Asset[];
  resolveAssetMediaUrl: (path: string | null) => string | null;
};

export const InventoryGroupedTable: React.FC<GroupedProps> = ({ group, items, resolveAssetMediaUrl }) => (
  <div className="overflow-x-auto rounded-lg border border-gray-800">
    <table className="w-full text-left text-xs">
      <thead className="bg-black/40 font-mono text-[11px] uppercase tracking-wide text-gray-500">
        {group === 'ip' && (
          <tr>
            <th className="p-3 pl-4 font-medium">IP</th>
            <th className="p-3 font-medium">Location</th>
            <th className="p-3 font-medium">Country</th>
            <th className="p-3 font-medium">ASN</th>
            <th className="p-3 pr-4 text-right font-medium">Number of services</th>
          </tr>
        )}
        {group === 'port' && (
          <tr>
            <th className="p-3 pl-4 font-medium">Port</th>
            <th className="p-3 pr-4 text-right font-medium">Number of services</th>
          </tr>
        )}
        {group === 'host' && (
          <tr>
            <th className="p-3 pl-4 font-medium">Host</th>
            <th className="p-3 pr-4 text-right font-medium">Number of services</th>
          </tr>
        )}
        {group === 'tech' && (
          <tr>
            <th className="p-3 pl-4 font-medium">Technology</th>
            <th className="p-3 font-medium">Description</th>
            <th className="p-3 pr-4 text-right font-medium">Number of services</th>
          </tr>
        )}
        {group === 'status-code' && (
          <tr>
            <th className="p-3 pl-4 font-medium">Status code</th>
            <th className="p-3 pr-4 text-right font-medium">Number of services</th>
          </tr>
        )}
        {group === 'tls' && (
          <tr>
            <th className="p-3 pl-4 font-medium">Host</th>
            <th className="p-3 font-medium">SNI</th>
            <th className="p-3 font-medium">Subject DN</th>
            <th className="p-3 font-medium">TLS version</th>
            <th className="p-3 font-medium">Valid from</th>
            <th className="p-3 pr-4 font-medium">Expires</th>
          </tr>
        )}
      </thead>
      <tbody className="text-gray-200">
        {items.map((asset, idx) => {
          const row = asset as Record<string, unknown>;
          const rk = String(row.id ?? `${group}-${idx}`);
          if (group === 'ip') {
            const geo = (row.geoIp ?? row.geo_ip ?? {}) as Record<string, unknown>;
            const latN = Number(geo.lat);
            const lonN = Number(geo.lon);
            const hasMap = Number.isFinite(latN) && Number.isFinite(lonN);
            const mapThumb = hasMap ? cartoDarkTileUrl(latN, lonN, 11) : '';
            const ipStr = String(row.ip ?? row.value ?? '—');
            const city = String(geo.city ?? geo.regionName ?? '').trim();
            const country = String(geo.country ?? '').trim();
            const cc = String(geo.countryCode ?? '').trim();
            const orgLine = String(geo.asname ?? geo.org ?? geo.isp ?? '').trim();
            const asLine = String(geo.as ?? '').trim();
            return (
              <tr key={rk} className="border-t border-gray-800/90 align-middle transition-colors hover:bg-white/[0.03]">
                <td className="p-3 pl-4 align-middle">
                  <span className="inline-flex max-w-[220px] items-center gap-1.5 truncate rounded-full border border-gray-700/80 bg-black/25 px-2.5 py-1 font-mono text-[11px] text-gray-200">
                    <Network size={12} className="shrink-0 text-gray-500" aria-hidden />
                    {ipStr}
                  </span>
                </td>
                <td className="p-3 align-middle">
                  {mapThumb ? (
                    <div className="relative h-14 w-[5.5rem] overflow-hidden rounded-lg border border-gray-700/80 bg-black/40">
                      <img src={mapThumb} alt="" className="h-full w-full object-cover" />
                      {city ? (
                        <span className="absolute bottom-0.5 left-1 max-w-[calc(100%-4px)] truncate text-[9px] font-bold uppercase tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                          {city}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <span className="font-mono text-[11px] text-gray-600">—</span>
                  )}
                </td>
                <td className="p-3 align-middle">
                  <div className="text-[13px] font-medium text-white">{country || '—'}</div>
                  {cc ? <div className="font-mono text-[11px] text-gray-500">{cc}</div> : null}
                </td>
                <td className="max-w-[220px] p-3 align-middle">
                  <div className="line-clamp-2 text-[12px] text-gray-200" title={orgLine}>
                    {orgLine || '—'}
                  </div>
                  {asLine ? (
                    <div className="mt-0.5 truncate font-mono text-[10px] text-gray-500" title={asLine}>
                      {asLine}
                    </div>
                  ) : null}
                </td>
                <td className="p-3 pr-4 align-middle text-right font-mono text-[12px] text-gray-300">
                  {formatInventoryServiceCount(row.assetCount ?? row.count)}
                </td>
              </tr>
            );
          }
          if (group === 'port') {
            const portVal = String(row.port ?? row.value ?? '—');
            return (
              <tr key={rk} className="border-t border-gray-800/90 align-middle transition-colors hover:bg-white/[0.03]">
                <td className="p-3 pl-4">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-700/80 bg-black/25 px-2.5 py-1 font-mono text-[11px] text-gray-200">
                    <Terminal size={12} className="shrink-0 text-gray-500" aria-hidden />
                    {portVal}
                  </span>
                </td>
                <td className="p-3 pr-4 text-right font-mono text-[12px] text-gray-300">
                  {formatInventoryServiceCount(row.assetCount ?? row.count)}
                </td>
              </tr>
            );
          }
          if (group === 'host') {
            const hostVal = String(row.host ?? row.value ?? '—');
            return (
              <tr key={rk} className="border-t border-gray-800/90 align-middle transition-colors hover:bg-white/[0.03]">
                <td className="p-3 pl-4">
                  <span className="inline-flex max-w-[min(100%,320px)] items-center gap-1.5 truncate rounded-full border border-gray-700/80 bg-black/25 px-2.5 py-1 font-mono text-[11px] text-gray-200">
                    <Cloud size={12} className="shrink-0 text-gray-500" aria-hidden />
                    {hostVal}
                  </span>
                </td>
                <td className="p-3 pr-4 text-right font-mono text-[12px] text-gray-300">
                  {formatInventoryServiceCount(row.assetCount ?? row.count)}
                </td>
              </tr>
            );
          }
          if (group === 'tech') {
            const techObj = (row.technology ?? row) as Record<string, unknown>;
            const name = String(techObj.name ?? row.name ?? row.value ?? '—');
            const descRaw = techObj.description ?? row.description;
            const desc = typeof descRaw === 'string' && descRaw.trim() && descRaw.trim() !== 'undefined' ? descRaw.trim() : '';
            const iconRaw =
              typeof techObj.iconUrl === 'string' ? techObj.iconUrl : typeof row.iconUrl === 'string' ? row.iconUrl : '';
            const iconSrc = resolveAssetMediaUrl(iconRaw || null);
            const rawCats = techObj.categoryNames ?? row.categoryNames;
            const cats = Array.isArray(rawCats) ? rawCats.map((c) => String(c)) : [];
            return (
              <tr key={rk} className="border-t border-gray-800/90 align-top transition-colors hover:bg-white/[0.03]">
                <td className="p-3 pl-4">
                  <div className="flex items-start gap-2.5">
                    {iconSrc ? (
                      <img src={iconSrc} alt="" className="mt-0.5 h-8 w-8 shrink-0 rounded-md border border-gray-700/60 bg-black/30 object-contain p-0.5" />
                    ) : (
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-700/50 bg-black/30">
                        <Database size={16} className="text-gray-600" aria-hidden />
                      </div>
                    )}
                    <div className="min-w-0 space-y-1.5">
                      <div className="text-[13px] font-semibold text-white">{name}</div>
                      {cats.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {cats.slice(0, 6).map((c) => (
                            <span key={c} className="rounded-full border border-gray-700/70 bg-black/30 px-2 py-0.5 text-[10px] text-gray-300">
                              {c}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="max-w-md p-3">
                  <p className="line-clamp-4 text-[12px] leading-snug text-gray-400" title={desc}>
                    {desc || '—'}
                  </p>
                </td>
                <td className="p-3 pr-4 text-right font-mono text-[12px] text-gray-300 align-top">
                  {formatInventoryServiceCount(row.assetCount ?? row.count)}
                </td>
              </tr>
            );
          }
          if (group === 'status-code') {
            const sc = String(row.statusCode ?? row.status_code ?? row.value ?? '—');
            return (
              <tr key={rk} className="border-t border-gray-800/90 align-middle transition-colors hover:bg-white/[0.03]">
                <td className="p-3 pl-4">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 font-mono text-[11px] font-medium ${statusPillClass(sc)}`}>
                    {sc}
                  </span>
                </td>
                <td className="p-3 pr-4 text-right font-mono text-[12px] text-gray-300">
                  {formatInventoryServiceCount(row.assetCount ?? row.count)}
                </td>
              </tr>
            );
          }
          if (group === 'tls') {
            const na = typeof row.not_after === 'string' ? row.not_after : '';
            const nb = typeof row.not_before === 'string' ? row.not_before : '';
            const d = tlsDaysRemaining(na);
            const tv = String(row.tls_version ?? '—');
            const subj = String(row.subject_dn ?? row.subject_cn ?? '—');
            return (
              <tr key={rk} className="border-t border-gray-800/90 align-middle transition-colors hover:bg-white/[0.03]">
                <td className="p-3 pl-4 font-mono text-[12px] font-semibold text-white">{String(row.host ?? '—')}</td>
                <td className="p-3 font-mono text-[11px] text-gray-400">{String(row.sni ?? '—')}</td>
                <td className="max-w-[200px] truncate p-3 font-mono text-[11px] text-gray-300" title={subj}>
                  {subj}
                </td>
                <td className="p-3">
                  <span className="inline-flex rounded-full border border-gray-600/80 bg-black/35 px-2.5 py-1 font-mono text-[10px] text-gray-200">
                    {tv}
                  </span>
                </td>
                <td className="p-3 font-mono text-[11px] text-gray-400">{formatTlsYmd(nb)}</td>
                <td className="p-3 pr-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Clock size={13} className="shrink-0 text-gray-500" aria-hidden />
                    <span className="font-mono text-[11px] text-gray-300">{formatTlsYmd(na)}</span>
                    {d != null ? (
                      <span className="rounded-full border border-gray-600/70 bg-black/30 px-2 py-0.5 font-mono text-[10px] text-gray-300">
                        ({d}d)
                      </span>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          }
          return null;
        })}
      </tbody>
    </table>
  </div>
);
