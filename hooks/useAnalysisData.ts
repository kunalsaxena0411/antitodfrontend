

import { useMemo, useState, useEffect } from 'react';
import { AnalyzedHost, ClusterGroup, MalpediaActor, CveEntry, ExploitEntry, UrlHausEntry } from '../types';
import { parseQueryString, filterHost } from '../services/search';

export type FilterType = 'asn' | 'country' | 'mitre' | 'signature' | 'risk' | 'score_dist' | 'news' | 'rbl' | 'date';

export interface ActiveFilter {
    type: FilterType;
    value: string;
}

export const useAnalysisData = (
    results: AnalyzedHost[], 
    malpediaActors: MalpediaActor[], 
    cveData: CveEntry[],
    exploitData: ExploitEntry[] = [],
    urlHausItems: UrlHausEntry[] = []
) => {
    // Initialize state from LocalStorage for persistence
    const [activeFilter, setActiveFilter] = useState<ActiveFilter | null>(() => {
        try {
            const saved = localStorage.getItem('xyberah_analysis_filter');
            return saved ? JSON.parse(saved) : null;
        } catch { return null; }
    });
    
    const [searchQuery, setSearchQuery] = useState(() => {
        return localStorage.getItem('xyberah_analysis_query') || '';
    });

    // Auto-save effects
    useEffect(() => {
        if (activeFilter) {
            localStorage.setItem('xyberah_analysis_filter', JSON.stringify(activeFilter));
        } else {
            localStorage.removeItem('xyberah_analysis_filter');
        }
    }, [activeFilter]);

    useEffect(() => {
        localStorage.setItem('xyberah_analysis_query', searchQuery);
    }, [searchQuery]);

    // Pre-process results to enrich with URLhaus data
    const enrichedResults = useMemo(() => {
        if (!urlHausItems || urlHausItems.length === 0) return results;
        
        const urlHausSet = new Set<string>();
        urlHausItems.forEach(u => {
             // Extract hostname if possible, otherwise use raw URL
             try { 
                 const url = new URL(u.url);
                 urlHausSet.add(url.hostname); 
             } catch(e) { 
                 urlHausSet.add(u.url); 
             }
        });
        
        return results.map(h => ({
            ...h,
            isUrlHaus: urlHausSet.has(h.ip) || (h.dnsHostname && urlHausSet.has(h.dnsHostname))
        }));
    }, [results, urlHausItems]);

    // --- Cluster Analysis Logic ---
    const clusters = useMemo(() => {
        const asnMap = new Map<string, ClusterGroup>();
        const tacticMap = new Map<string, ClusterGroup>();
        const countryMap = new Map<string, ClusterGroup>();
        const riskMap = new Map<string, ClusterGroup>();
        const sigMap = new Map<string, ClusterGroup>();
        const rblMap = new Map<string, ClusterGroup>();
        const timelineMap = new Map<string, number>();
  
        rblMap.set('LISTED', { id: 'LISTED', label: 'Listed', count: 0, riskScore: 0, items: [] });
        rblMap.set('CLEAN', { id: 'CLEAN', label: 'Clean', count: 0, riskScore: 0, items: [] });
        rblMap.set('CHECKING', { id: 'CHECKING', label: 'Checking/Failed', count: 0, riskScore: 0, items: [] });
  
        const scoreBuckets: ClusterGroup[] = [
            { id: '0-0', label: 'Clean', count: 0, riskScore: 0, items: [] },
            { id: '1-39', label: 'Low', count: 0, riskScore: 0, items: [] },
            { id: '40-69', label: 'Med', count: 0, riskScore: 0, items: [] },
            { id: '70-89', label: 'High', count: 0, riskScore: 0, items: [] },
            { id: '90-100', label: 'Crit', count: 0, riskScore: 0, items: [] }
        ];
  
        enrichedResults.forEach(host => {
            const asnName = host.enrichmentData?.asn?.name || 'Unknown ASN';
            if (!asnMap.has(asnName)) asnMap.set(asnName, { id: asnName, label: asnName, count: 0, riskScore: 0, items: [] });
            const asnCluster = asnMap.get(asnName)!;
            asnCluster.count++;
            asnCluster.riskScore += host.totalScore;
            asnCluster.items.push(host);
  
            const tactics = new Set<string>((host.signatures || []).map(s => s.mitreTactic));
            if (tactics.size === 0) {
                const label = "Clean";
                 if (!tacticMap.has(label)) tacticMap.set(label, { id: label, label, count: 0, riskScore: 0, items: [] });
                 tacticMap.get(label)!.count++;
                 tacticMap.get(label)!.items.push(host);
            } else {
                tactics.forEach(tactic => {
                    if (!tacticMap.has(tactic)) tacticMap.set(tactic, { id: tactic, label: tactic, count: 0, riskScore: 0, items: [] });
                    const tacticCluster = tacticMap.get(tactic)!;
                    tacticCluster.count++;
                    tacticCluster.riskScore += host.totalScore; 
                    tacticCluster.items.push(host);
                });
            }
  
            const country = host.country || 'Unknown';
            if (!countryMap.has(country)) countryMap.set(country, { id: country, label: country, count: 0, riskScore: 0, items: [] });
            const countryCluster = countryMap.get(country)!;
            countryCluster.count++;
            countryCluster.riskScore += host.totalScore;
            countryCluster.items.push(host);
  
            const risk = host.riskLevel;
            if (!riskMap.has(risk)) riskMap.set(risk, { id: risk, label: risk, count: 0, riskScore: 0, items: [] });
            const riskCluster = riskMap.get(risk)!;
            riskCluster.count++;
            riskCluster.riskScore += host.totalScore;
            riskCluster.items.push(host);
  
            (host.signatures || []).forEach(sig => {
               if (!sigMap.has(sig.name)) sigMap.set(sig.name, { id: sig.name, label: sig.name, count: 0, riskScore: 0, items: [] });
               const sigCluster = sigMap.get(sig.name)!;
               sigCluster.count++;
               sigCluster.riskScore += sig.score;
               sigCluster.items.push(host);
            });
  
            const score = host.totalScore;
            if (score === 0) scoreBuckets[0].count++;
            else if (score < 40) scoreBuckets[1].count++;
            else if (score < 70) scoreBuckets[2].count++;
            else if (score < 90) scoreBuckets[3].count++;
            else scoreBuckets[4].count++;
            
            if (score === 0) scoreBuckets[0].items.push(host);
            else if (score < 40) scoreBuckets[1].items.push(host);
            else if (score < 70) scoreBuckets[2].items.push(host);
            else if (score < 90) scoreBuckets[3].items.push(host);
            else scoreBuckets[4].items.push(host);
  
            if (host.rblStatus === 'LISTED') {
                const grp = rblMap.get('LISTED')!;
                grp.count++;
                grp.items.push(host);
            } else if (host.rblStatus === 'CLEAN') {
                const grp = rblMap.get('CLEAN')!;
                grp.count++;
                grp.items.push(host);
            } else {
                const grp = rblMap.get('CHECKING')!;
                grp.count++;
                grp.items.push(host);
            }
            
            if (host.timeline) {
                Object.entries(host.timeline).forEach(([date, count]) => {
                    timelineMap.set(date, (timelineMap.get(date) || 0) + (count as number));
                });
            }
        });
  
        const sortByRisk = (a: ClusterGroup, b: ClusterGroup) => (b.riskScore / (b.count || 1)) - (a.riskScore / (a.count || 1));
        const sortByCount = (a: ClusterGroup, b: ClusterGroup) => b.count - a.count;
        
        const sortedDates = Array.from(timelineMap.keys()).sort();
        const timelineData = sortedDates.map(date => ({ date, count: timelineMap.get(date)! }));
  
        return {
            byAsn: Array.from(asnMap.values()).sort(sortByRisk).slice(0, 6),
            byTactic: Array.from(tacticMap.values()).sort(sortByRisk).slice(0, 6),
            byCountry: Array.from(countryMap.values()).sort(sortByRisk).slice(0, 6),
            byRisk: Array.from(riskMap.values()).sort((a: ClusterGroup, b: ClusterGroup) => {
                const order: Record<string, number> = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
                return (order[b.id] || 0) - (order[a.id] || 0);
            }),
            bySignature: Array.from(sigMap.values()).sort(sortByCount).slice(0, 6),
            byScoreDist: scoreBuckets,
            byRbl: Array.from(rblMap.values()),
            byTimeline: timelineData
        };
    }, [enrichedResults]);
  
    const stats = useMemo(() => {
      return {
        total: enrichedResults.length,
        critical: enrichedResults.filter(r => r.riskLevel === 'CRITICAL').length,
        high: enrichedResults.filter(r => r.riskLevel === 'HIGH').length,
        medium: enrichedResults.filter(r => r.riskLevel === 'MEDIUM').length,
        low: enrichedResults.filter(r => r.riskLevel === 'LOW').length,
        clean: enrichedResults.filter(r => r.totalScore === 0).length
      };
    }, [enrichedResults]);
  
    const actorStats = useMemo(() => {
        const countryCounts = new Map<string, number>();
        const mitreCount = malpediaActors.filter(a => a.source === 'MITRE').length;
        const malpediaCount = malpediaActors.filter(a => !a.source || a.source === 'Malpedia').length;
  
        malpediaActors.forEach(actor => {
            if (actor.meta?.country && actor.meta.country !== 'Unknown') {
                const c = actor.meta.country;
                countryCounts.set(c, (countryCounts.get(c) || 0) + 1);
            }
        });
        const sortedCountries = Array.from(countryCounts.entries())
          .map(([label, count]) => ({ label, count }))
          .sort((a, b) => b.count - a.count);
  
        return {
            total: malpediaActors.length,
            mitreCount,
            malpediaCount,
            topCountries: sortedCountries.slice(0, 5),
            highRiskCount: malpediaActors.filter(a => a.sophistication === 'Critical' || a.sophistication === 'High').length
        };
    }, [malpediaActors]);
  
    const cveStats = useMemo(() => {
        const critical = cveData.filter(c => c.severity === 'CRITICAL').length;
        const high = cveData.filter(c => c.severity === 'HIGH').length;
        const medium = cveData.filter(c => c.severity === 'MEDIUM').length;
        const low = cveData.filter(c => c.severity === 'LOW').length;
        
        return {
            total: cveData.length,
            critical,
            high,
            medium,
            low,
            recent: cveData.filter(c => new Date(c.published) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)).length
        };
    }, [cveData]);

    const exploitStats = useMemo(() => {
        const total = exploitData.length;
        // Filter for exploits in the last 7 days
        const recent = exploitData.filter(e => {
            const date = new Date(e.timestamp);
            const now = new Date();
            const diffTime = Math.abs(now.getTime() - date.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            return diffDays <= 7;
        }).length;
        
        // Filter for exploits that have matching local CVE data
        const withCveContext = exploitData.filter(e => cveData.some(c => c.id === e.cveId)).length;
        
        return { total, recent, withCveContext };
    }, [exploitData, cveData]);
  
    const filteredResults = useMemo(() => {
      let data = enrichedResults;
  
      // 1. Apply Active Widget Filter
      if (activeFilter) {
          data = data.filter(host => {
              if (activeFilter.type === 'asn') return (host.enrichmentData?.asn?.name || 'Unknown ASN') === activeFilter.value;
              if (activeFilter.type === 'country') return (host.country || 'Unknown') === activeFilter.value;
              if (activeFilter.type === 'mitre') return host.signatures.some(s => s.mitreTactic === activeFilter.value) || (activeFilter.value === 'Clean' && host.signatures.length === 0);
              if (activeFilter.type === 'signature') return host.signatures.some(s => s.name === activeFilter.value);
              if (activeFilter.type === 'risk') return host.riskLevel === activeFilter.value;
              if (activeFilter.type === 'rbl') {
                  if (activeFilter.value === 'LISTED') return host.rblStatus === 'LISTED';
                  if (activeFilter.value === 'CLEAN') return host.rblStatus === 'CLEAN';
                  return !host.rblStatus || host.rblStatus === 'CHECKING' || host.rblStatus === 'FAILED';
              }
              if (activeFilter.type === 'score_dist') {
                  const [min, max] = activeFilter.value.split('-').map(Number);
                  return host.totalScore >= min && host.totalScore <= max;
              }
              if (activeFilter.type === 'date') {
                  return host.timeline && host.timeline[activeFilter.value] > 0;
              }
              return true;
          });
      }
  
      // 2. Apply Lucene Search Filter
      if (searchQuery) {
          const { filters, freeText } = parseQueryString(searchQuery);
          data = data.filter(host => filterHost(host, filters, freeText));
      }

      return data;
    }, [enrichedResults, searchQuery, activeFilter]);

    return {
        clusters,
        stats,
        actorStats,
        cveStats,
        exploitStats,
        filteredResults,
        activeFilter,
        setActiveFilter,
        searchQuery,
        setSearchQuery
    };
};
