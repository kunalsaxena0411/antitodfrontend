
import { LogEntry, AnalyzedHost, DetectedSignature, WhitelistEntry, C2IntelFeedEntry } from '../types';
import { THREAT_SIGNATURES, RISK_THRESHOLDS } from '../constants';
import { resolveHostname, fetchExtendedSecurityInfo } from './dns';
import { isWhitelisted } from './whitelist';

export const recalculateHostScore = (host: AnalyzedHost): AnalyzedHost => {
    // Calculate scores using the current state of the host (including new enrichment/RBL)
    // Ensure we have a breakdown object to start with, defaulting to 0s if missing
    const breakdown = host.scoreBreakdown || { 
        base: 0, 
        persistenceBonus: 0, 
        frequencyBonus: 0, 
        rarityBonus: 0, 
        tacticBonus: 0, 
        aptBonus: 0, 
        threatIntelBonus: 0, 
        rblPenalty: 0,
        multiSourceBonus: 0
    };
    
    // 1. Persistence Bonus (Recalculate based on activeDays)
    // 15 points per active day beyond the first, capped at 40
    let persistenceBonus = 0;
    if (host.activeDays > 1) {
        persistenceBonus = Math.min((host.activeDays - 1) * 15, 40);
    }

    // 2. Threat Intel Bonus (Enrichment)
    let threatIntelBonus = 0;
    if (host.enrichmentData?.threat) {
        if (host.enrichmentData.threat.is_known_attacker) threatIntelBonus += 30;
        else if (host.enrichmentData.threat.is_threat) threatIntelBonus += 20;
        
        if (host.enrichmentData.threat.is_tor) threatIntelBonus += 10;
        if (host.enrichmentData.threat.is_proxy) threatIntelBonus += 5;
        if (host.enrichmentData.threat.is_anonymous) threatIntelBonus += 5;
        if (host.enrichmentData.threat.is_bot) threatIntelBonus += 5;
    }
    
    // 3. RBL Penalty
    let rblPenalty = 0;
    if (host.rblStatus === 'LISTED') {
        rblPenalty = 20;
    }

    // 4. APT Bonus (Signature based)
    // We re-evaluate this to ensure consistency
    let aptBonus = 0;
    const aptKeywords = ['APT', 'Cobalt Strike', 'Metasploit', 'Empire', 'C2', 'Rat', 'Beacon'];
    host.signatures.forEach(sig => {
         if (aptKeywords.some(k => sig.name.includes(k) || sig.description.includes(k))) {
             aptBonus += 10;
         }
         if (sig.mitreTactic === 'Command and Control' || sig.mitreTactic === 'Exfiltration') aptBonus += 5;
    });
    aptBonus = Math.min(aptBonus, 40); // Cap APT bonus

    // 5. Multi-Source Bonus
    // Count distinct threat sources to reward corroboration
    let sourceCount = 0;
    if (host.isUrlHaus) sourceCount++;
    if (host.isMalwareBazaar) sourceCount++;
    if (host.isFeodo) sourceCount++;
    if (host.isThreatFox) sourceCount++;
    if (host.isIpsum) sourceCount++;
    if (host.isC2Intel) sourceCount++;
    
    let multiSourceBonus = 0;
    if (sourceCount > 1) {
        multiSourceBonus = (sourceCount - 1) * 30;
    }

    // Total Score Calculation
    // We reuse the base metrics from the initial analysis (frequency, rarity, tactic)
    // as those depend on the full dataset context.
    const totalScoreRaw = 
        breakdown.base + 
        persistenceBonus + 
        (breakdown.frequencyBonus || 0) + 
        (breakdown.rarityBonus || 0) + 
        (breakdown.tacticBonus || 0) + 
        aptBonus + 
        threatIntelBonus + 
        rblPenalty +
        multiSourceBonus;

    const totalScore = Math.min(100, totalScoreRaw);

    // Determine Risk Level
    let riskLevel: AnalyzedHost['riskLevel'] = 'LOW';
    if (totalScore >= RISK_THRESHOLDS.CRITICAL) riskLevel = 'CRITICAL';
    else if (totalScore >= RISK_THRESHOLDS.HIGH) riskLevel = 'HIGH';
    else if (totalScore >= RISK_THRESHOLDS.MEDIUM) riskLevel = 'MEDIUM';

    return {
        ...host,
        totalScore,
        riskLevel,
        scoreBreakdown: {
            ...breakdown,
            persistenceBonus,
            aptBonus,
            threatIntelBonus,
            rblPenalty,
            multiSourceBonus
        }
    };
};

// Helper to format full C2IntelFeed details
const formatC2Details = (entry: C2IntelFeedEntry) => {
    const parts = [];
    if (entry.Source) parts.push(`Source: ${entry.Source}`);
    if (entry.BeaconType) parts.push(`Type: ${entry.BeaconType}`);
    if (entry.C2Server) parts.push(`C2: ${entry.C2Server}`);
    if (entry.C2Url) parts.push(`URL: ${Array.isArray(entry.C2Url) ? entry.C2Url.join(', ') : entry.C2Url}`);
    if (entry.Port) parts.push(`Port: ${entry.Port}`);
    if (entry.ASN) parts.push(`ASN: ${entry.ASN}`);
    if (entry.ASNName) parts.push(`ISP: ${entry.ASNName}`);
    if (entry.Jitter) parts.push(`Jitter: ${entry.Jitter}`);
    if (entry.SleepTime) parts.push(`Sleep: ${entry.SleepTime}`);
    if (entry.KillDate && entry.KillDate !== '0') parts.push(`KillDate: ${entry.KillDate}`);
    if (entry.Watermark) parts.push(`Watermark: ${entry.Watermark}`);
    if (entry.UserAgent) parts.push(`UA: ${entry.UserAgent}`);
    if (entry.HostHeader) parts.push(`HostHeader: ${entry.HostHeader}`);
    if (entry.Key) {
        const keyStr = Array.isArray(entry.Key) ? entry.Key[0] : entry.Key;
        parts.push(`Key: ${keyStr.substring(0, 15)}...`);
    }
    if (entry.HttpPostUri) parts.push(`POST URI: ${entry.HttpPostUri}`);
    if (entry.PipeName && entry.PipeName !== 'Not Found') parts.push(`Pipe: ${entry.PipeName}`);
    
    return parts.join(' | ');
};

// Convert C2 Feed items directly to AnalyzedHost for display
export const convertFeedToHosts = (feed: C2IntelFeedEntry[]): AnalyzedHost[] => {
    return feed.map(entry => {
        const details = formatC2Details(entry);
        return {
            ip: entry.ip,
            country: 'XX', // Placeholder until enrichment
            totalScore: 100,
            riskLevel: 'CRITICAL',
            signatures: [{
                name: `C2 Infrastructure (${entry.Source || 'Generic'})`,
                score: 100,
                mitreTactic: "Command and Control",
                mitreId: "T1071",
                description: `Identified ${entry.Source || 'C2'} Infrastructure. ${details}`,
                matchedCommand: "Threat Feed Intelligence",
                matchedPart: entry.ip,
                matchIndex: 0,
                count: 1
            }],
            rawCommands: [`THREAT INTELLIGENCE FEED HIT`, details],
            
            // --- Temporal Analytics Initialization ---
            activeDays: 1,
            firstSeen: entry.FirstSeen,
            lastSeen: entry.LastSeen || entry.FirstSeen,
            timeline: { [entry.FirstSeen.split(' ')[0] || new Date().toISOString().split('T')[0]]: 1 },
            
            isC2Intel: true,
            isMmdbDerived: false,
            scoreBreakdown: {
                base: 100,
                persistenceBonus: 0,
                aptBonus: 0,
                threatIntelBonus: 0,
                rblPenalty: 0,
                multiSourceBonus: 0
            }
        } as AnalyzedHost;
    });
};

export const analyzeLogs = async (
    data: LogEntry[], 
    maliciousDomains: Set<string> = new Set(), 
    malwareHashes: Set<string> = new Set(), 
    maliciousIps: Set<string> = new Set(), 
    threatFoxSet: Set<string> = new Set(),
    ipsumSet: Set<string> = new Set(),
    whitelist: WhitelistEntry[] = [],
    c2IntelMap: Map<string, C2IntelFeedEntry> = new Map()
): Promise<AnalyzedHost[]> => {
  // Intermediate structure to aggregate data by IP
  const aggregatedData = new Map<string, {
    ip: string;
    country: string;
    rawCommands: string[];
    timestamps: string[];
  }>();

  // 1. Aggregation Step with Whitelist Filtering
  data.forEach(entry => {
    if (!entry.ip) return;
    
    // Check whitelist before processing
    if (whitelist.length > 0 && isWhitelisted(entry.ip, whitelist)) return;

    // Handle both 'timestamp' and 'time' fields from different JSON schemas
    const entryTime = entry.timestamp || (entry as any).time || new Date().toISOString();

    if (!aggregatedData.has(entry.ip)) {
      aggregatedData.set(entry.ip, {
        ip: entry.ip,
        country: entry.country || 'UNKNOWN',
        rawCommands: [...entry.commands],
        timestamps: [entryTime]
      });
    } else {
      const host = aggregatedData.get(entry.ip)!;
      host.rawCommands.push(...entry.commands);
      host.timestamps.push(entryTime);
      if (host.country === 'UNKNOWN' && entry.country) {
        host.country = entry.country;
      }
    }
  });

  // 1.1 Pre-process: Calculate Global Signature Frequency for Rarity Analysis
  const globalSigCounts = new Map<string, number>();
  const totalHosts = aggregatedData.size;

  aggregatedData.forEach(host => {
      const hostSigs = new Set<string>();
      host.rawCommands.forEach(cmd => {
          THREAT_SIGNATURES.forEach(sig => {
              if (cmd.match(sig.pattern)) hostSigs.add(sig.name);
          });
      });
      hostSigs.forEach(name => {
          globalSigCounts.set(name, (globalSigCounts.get(name) || 0) + 1);
      });
  });

  // Regex to extract domains from commands
  const domainRegex = /([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,6}/g;
  // Regex to extract IPs from commands
  const ipRegex = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
  // Regex for hash-like strings (md5, sha1, sha256)
  const hashRegex = /\b[a-fA-F0-9]{32,64}\b/g;

  // 2. Analysis Step
  const analysisPromises = Array.from(aggregatedData.values()).map(async (host) => {
    const detected: DetectedSignature[] = [];
    let maxSignatureScore = 0;
    const signatureCounts = new Map<string, number>();
    let isMalwareBazaar = false;
    let isFeodo = false;
    let isThreatFox = false;
    let isIpsum = false;
    let isUrlHaus = false;
    let isC2Intel = false;
    
    // Track distinct sources for multi-source bonus
    const detectedSources = new Set<string>();
    
    // --- Temporal Analytics Calculation ---
    const timeline: Record<string, number> = {};
    const dates = new Set<string>();
    
    // Sort timestamps for accurate first/last seen
    const sortedTimestamps = host.timestamps.sort();
    
    sortedTimestamps.forEach(ts => {
        const date = ts.split('T')[0]; // YYYY-MM-DD
        dates.add(date);
        timeline[date] = (timeline[date] || 0) + 1;
    });

    const firstSeen = sortedTimestamps[0] || new Date().toISOString();
    const lastSeen = sortedTimestamps[sortedTimestamps.length - 1] || new Date().toISOString();
    const activeDays = dates.size;

    // Check if the host IP itself is malicious (Feodo check)
    if (maliciousIps.has(host.ip)) {
        isFeodo = true;
        detectedSources.add('Feodo');
        const sigName = "Known C2 IP (Feodo)";
        signatureCounts.set(sigName, 1);
        detected.push({
            name: sigName,
            score: 100,
            matchedCommand: "Source IP Match",
            description: "Host IP is listed in Feodo Tracker as an active C2 botnet.",
            matchedPart: host.ip,
            matchIndex: 0,
            mitreId: "T1584",
            mitreTactic: "Resource Development",
            count: 1
        });
        maxSignatureScore = 100;
    }

    // Check if host IP is in ThreatFox (ThreatFox IP IOC)
    if (threatFoxSet.has(host.ip)) {
        isThreatFox = true;
        detectedSources.add('ThreatFox');
        const sigName = "Known Malicious IP (ThreatFox)";
        signatureCounts.set(sigName, 1);
        detected.push({
            name: sigName,
            score: 100,
            matchedCommand: "Source IP Match",
            description: "Host IP is listed in ThreatFox as a confirmed threat.",
            matchedPart: host.ip,
            matchIndex: 0,
            mitreId: "T1584",
            mitreTactic: "Resource Development",
            count: 1
        });
        maxSignatureScore = 100;
    }

    // Check IPsum
    if (ipsumSet.has(host.ip)) {
        isIpsum = true;
        detectedSources.add('IPsum');
        const sigName = "High Risk IP (IPsum)";
        signatureCounts.set(sigName, 1);
        detected.push({
            name: sigName,
            score: 90,
            matchedCommand: "Source IP Match",
            description: "Host IP is listed in IPsum threat feed (aggregated blacklists).",
            matchedPart: host.ip,
            matchIndex: 0,
            mitreId: "T1584",
            mitreTactic: "Resource Development",
            count: 1
        });
        if (90 > maxSignatureScore) maxSignatureScore = 90;
    }

    // Check C2IntelFeeds
    const c2Entry = c2IntelMap.get(host.ip);
    if (c2Entry) {
        isC2Intel = true;
        detectedSources.add('C2IntelFeeds');
        const sigName = "C2 Framework Infrastructure (C2IntelFeeds)";
        signatureCounts.set(sigName, 1);
        
        const details = formatC2Details(c2Entry);

        detected.push({
            name: sigName,
            score: 100,
            matchedCommand: "Source IP Match",
            description: `Host IP identified as a ${c2Entry.Source || 'C2'} Server. Details: ${details}`,
            matchedPart: host.ip,
            matchIndex: 0,
            mitreId: "T1071",
            mitreTactic: "Command and Control",
            count: 1
        });
        maxSignatureScore = 100;
    }
    
    // Signature Matching
    host.rawCommands.forEach(cmd => {
      // 1. Regex Signatures
      THREAT_SIGNATURES.forEach(sig => {
        const match = cmd.match(sig.pattern);
        if (match) {
          signatureCounts.set(sig.name, (signatureCounts.get(sig.name) || 0) + 1);

          detected.push({
            name: sig.name,
            score: sig.score,
            matchedCommand: cmd,
            description: sig.description,
            matchedPart: match[0],
            matchIndex: match.index !== undefined ? match.index : 0,
            mitreId: sig.mitreId,
            mitreTactic: sig.mitreTactic,
            count: 1
          });
          
          if (sig.score > maxSignatureScore) {
            maxSignatureScore = sig.score;
          }
        }
      });

      // 2. URLHaus/Feodo/ThreatFox/C2Intel IOC Matching (Domains & IPs)
      if (maliciousDomains.size > 0 || maliciousIps.size > 0 || threatFoxSet.size > 0 || ipsumSet.size > 0 || c2IntelMap.size > 0) {
          const domains = cmd.match(domainRegex) || [];
          const ips = cmd.match(ipRegex) || [];
          const candidates = [...domains, ...ips];

          if (candidates.length > 0) {
              candidates.forEach(ioc => {
                  // Check Whitelist first
                  if (whitelist.length > 0 && isWhitelisted(ioc, whitelist)) return;

                  // Check URLHaus
                  if (maliciousDomains.has(ioc)) {
                      const sigName = "URLHaus IOC Detected";
                      isUrlHaus = true;
                      detectedSources.add('URLHaus');
                      signatureCounts.set(sigName, (signatureCounts.get(sigName) || 0) + 1);
                      detected.push({
                          name: sigName,
                          score: 100,
                          matchedCommand: cmd,
                          description: `Command contains known malicious indicator from URLHaus: ${ioc}`,
                          matchedPart: ioc,
                          matchIndex: cmd.indexOf(ioc),
                          mitreId: "T1566",
                          mitreTactic: "Initial Access",
                          count: 1
                      });
                      if (100 > maxSignatureScore) maxSignatureScore = 100;
                  }
                  
                  // Check Feodo (Command payloads containing C2 IPs)
                  if (maliciousIps.has(ioc)) {
                      isFeodo = true;
                      detectedSources.add('Feodo');
                      const sigName = "Feodo C2 IOC Detected";
                      signatureCounts.set(sigName, (signatureCounts.get(sigName) || 0) + 1);
                      detected.push({
                          name: sigName,
                          score: 100,
                          matchedCommand: cmd,
                          description: `Command contains known C2 IP from Feodo Tracker: ${ioc}`,
                          matchedPart: ioc,
                          matchIndex: cmd.indexOf(ioc),
                          mitreId: "T1071",
                          mitreTactic: "Command and Control",
                          count: 1
                      });
                      if (100 > maxSignatureScore) maxSignatureScore = 100;
                  }

                  // Check ThreatFox (Command payloads containing ThreatFox IPs/Domains)
                  if (threatFoxSet.has(ioc)) {
                      isThreatFox = true;
                      detectedSources.add('ThreatFox');
                      const sigName = "ThreatFox IOC Detected";
                      signatureCounts.set(sigName, (signatureCounts.get(sigName) || 0) + 1);
                      detected.push({
                          name: sigName,
                          score: 100,
                          matchedCommand: cmd,
                          description: `Command contains known indicator from ThreatFox: ${ioc}`,
                          matchedPart: ioc,
                          matchIndex: cmd.indexOf(ioc),
                          mitreId: "T1204",
                          mitreTactic: "Execution",
                          count: 1
                      });
                      if (100 > maxSignatureScore) maxSignatureScore = 100;
                  }

                  // Check IPsum (Command payloads containing malicious IPs)
                  if (ipsumSet.has(ioc)) {
                      isIpsum = true;
                      detectedSources.add('IPsum');
                      const sigName = "IPsum Threat Detected";
                      signatureCounts.set(sigName, (signatureCounts.get(sigName) || 0) + 1);
                      detected.push({
                          name: sigName,
                          score: 90,
                          matchedCommand: cmd,
                          description: `Command contains malicious IP from IPsum feed: ${ioc}`,
                          matchedPart: ioc,
                          matchIndex: cmd.indexOf(ioc),
                          mitreId: "T1204",
                          mitreTactic: "Execution",
                          count: 1
                      });
                      if (90 > maxSignatureScore) maxSignatureScore = 90;
                  }

                  // Check C2Intel
                  const c2EntryIoc = c2IntelMap.get(ioc);
                  if (c2EntryIoc) {
                      isC2Intel = true;
                      detectedSources.add('C2IntelFeeds');
                      const sigName = "C2 Framework IOC Detected";
                      signatureCounts.set(sigName, (signatureCounts.get(sigName) || 0) + 1);
                      
                      const details = formatC2Details(c2EntryIoc);

                      detected.push({
                          name: sigName,
                          score: 100,
                          matchedCommand: cmd,
                          description: `Command contains confirmed C2 Framework IP: ${ioc}. ${details}`,
                          matchedPart: ioc,
                          matchIndex: cmd.indexOf(ioc),
                          mitreId: "T1071",
                          mitreTactic: "Command and Control",
                          count: 1
                      });
                      if (100 > maxSignatureScore) maxSignatureScore = 100;
                  }
              });
          }
      }

      // 3. MalwareBazaar/ThreatFox IOC Matching (Hashes)
      if (malwareHashes.size > 0 || threatFoxSet.size > 0) {
          const hashCandidates: string[] = cmd.match(hashRegex) || [];
          hashCandidates.forEach(hash => {
              const lowerHash = hash.toLowerCase();
              if (malwareHashes.has(lowerHash)) {
                   const sigName = "MalwareBazaar IOC Detected";
                   isMalwareBazaar = true;
                   detectedSources.add('MalwareBazaar');
                   signatureCounts.set(sigName, (signatureCounts.get(sigName) || 0) + 1);
                   detected.push({
                       name: sigName,
                       score: 100,
                       matchedCommand: cmd,
                       description: `Command contains known malicious file hash: ${hash}`,
                       matchedPart: hash,
                       matchIndex: cmd.indexOf(hash),
                       mitreId: "T1204",
                       mitreTactic: "Execution",
                       count: 1
                   });
                   if (100 > maxSignatureScore) maxSignatureScore = 100;
              }

              if (threatFoxSet.has(lowerHash)) {
                   const sigName = "ThreatFox Hash Detected";
                   isThreatFox = true;
                   detectedSources.add('ThreatFox');
                   signatureCounts.set(sigName, (signatureCounts.get(sigName) || 0) + 1);
                   detected.push({
                       name: sigName,
                       score: 100,
                       matchedCommand: cmd,
                       description: `Command contains known malicious file hash from ThreatFox: ${hash}`,
                       matchedPart: hash,
                       matchIndex: cmd.indexOf(hash),
                       mitreId: "T1204",
                       mitreTactic: "Execution",
                       count: 1
                   });
                   if (100 > maxSignatureScore) maxSignatureScore = 100;
              }
          });
      }
    });

    // Deduplication
    const uniqueDetectedMap = new Map<string, DetectedSignature>();
    detected.forEach(sig => {
        if (!uniqueDetectedMap.has(sig.name)) {
            uniqueDetectedMap.set(sig.name, { ...sig, count: signatureCounts.get(sig.name) || 1 });
        } else {
            const existing = uniqueDetectedMap.get(sig.name)!;
            if (sig.score > existing.score) {
                uniqueDetectedMap.set(sig.name, { ...sig, count: signatureCounts.get(sig.name) || 1 });
            }
        }
    });
    const uniqueDetected = Array.from(uniqueDetectedMap.values());

    // Async Enrichment (DNS & RBL)
    const dnsHostname = await resolveHostname(host.ip);
    const extendedSecurity = await fetchExtendedSecurityInfo(host.ip);

    // Extract RBL Status from Extended Security (avoiding duplicate calls)
    const rblListedIn = extendedSecurity.rblBlockStatus
        ?.filter(r => r.status === 'BLOCKED')
        .map(r => r.provider) || [];
    const rblStatus: 'LISTED' | 'CLEAN' = rblListedIn.length > 0 ? 'LISTED' : 'CLEAN';

    // --- Refined Scoring Logic ---
    
    let persistenceBonus = 0;
    let rarityBonus = 0;
    let frequencyBonus = 0;
    let tacticBonus = 0;
    let aptBonus = 0;
    let rblPenalty = 0;
    let multiSourceBonus = 0;

    if (rblStatus === 'LISTED') {
        rblPenalty = 20;
    }

    if (maxSignatureScore > 0) {
        // 1. Temporal Persistence: Score bonus for hosts active over multiple days
        if (activeDays > 1) {
            persistenceBonus = Math.min((activeDays - 1) * 15, 40);
        } 
        
        // 2. Frequency Persistence
        uniqueDetected.forEach(sig => {
            const count = signatureCounts.get(sig.name) || 1;
            if (sig.score >= 75 && count > 10) {
                frequencyBonus += 10;
            } else if (sig.score >= 50 && count > 50) {
                frequencyBonus += 5;
            }
        });
        frequencyBonus = Math.min(frequencyBonus, 20);

        // 3. Rarity (Targeted vs Commodity)
        uniqueDetected.forEach(sig => {
            const globalCount = globalSigCounts.get(sig.name) || 0;
            const prevalence = globalCount / totalHosts;
            if (totalHosts > 5 && prevalence < 0.05) {
                rarityBonus += 10; 
            }
        });
        rarityBonus = Math.min(rarityBonus, 20);

        // 4. Kill Chain Progression
        const uniqueTactics = new Set(uniqueDetected.map(s => s.mitreTactic).filter(Boolean));
        if (uniqueTactics.size > 1) {
            tacticBonus = Math.min((uniqueTactics.size - 1) * 10, 30);
        }

        // 5. APT Boost
        const aptKeywords = ['APT', 'Cobalt Strike', 'Metasploit', 'Empire', 'C2', 'Rat', 'Beacon'];
        uniqueDetected.forEach(sig => {
             if (aptKeywords.some(k => sig.name.includes(k) || sig.description.includes(k))) {
                 aptBonus += 10;
             }
             if (sig.mitreTactic === 'Command and Control' || sig.mitreTactic === 'Exfiltration') aptBonus += 5;
        });
        aptBonus = Math.min(aptBonus, 40);
        
        // 6. Multi-Source Bonus
        if (detectedSources.size > 1) {
            multiSourceBonus = (detectedSources.size - 1) * 30;
        }
    }

    const totalScore = Math.min(100, maxSignatureScore + persistenceBonus + frequencyBonus + rarityBonus + tacticBonus + aptBonus + rblPenalty + multiSourceBonus);

    // Determine Risk Level
    let riskLevel: AnalyzedHost['riskLevel'] = 'LOW';
    if (totalScore >= RISK_THRESHOLDS.CRITICAL) riskLevel = 'CRITICAL';
    else if (totalScore >= RISK_THRESHOLDS.HIGH) riskLevel = 'HIGH';
    else if (totalScore >= RISK_THRESHOLDS.MEDIUM) riskLevel = 'MEDIUM';

    return {
        ip: host.ip,
        country: host.country,
        totalScore,
        signatures: uniqueDetected,
        riskLevel,
        rawCommands: host.rawCommands,
        enrichmentData: undefined,
        
        // Populate Temporal Analytics
        activeDays,
        firstSeen,
        lastSeen,
        timeline,
        
        isMalwareBazaar,
        isFeodo,
        isThreatFox,
        isIpsum,
        isUrlHaus,
        isC2Intel,
        dnsHostname,
        extendedSecurity,
        rblStatus,
        rblListedIn,
        scoreBreakdown: {
            base: maxSignatureScore,
            persistenceBonus,
            frequencyBonus,
            rarityBonus,
            tacticBonus,
            aptBonus,
            threatIntelBonus: 0, // Default 0 until enrichment
            rblPenalty,
            multiSourceBonus
        }
    };
  });

  const results = await Promise.all(analysisPromises);
  return results.sort((a, b) => b.totalScore - a.totalScore);
};

export const parseJSONFile = async (file: File): Promise<LogEntry[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const json = JSON.parse(text);
        
        let rawData: any[] = [];
        if (Array.isArray(json)) {
          rawData = json;
        } else {
          rawData = [json];
        }

        // Normalize data structure to match LogEntry interface
        const normalized = rawData.map(item => ({
            ip: item.ip,
            country: item.country,
            // Handle array or single string command
            commands: Array.isArray(item.commands) ? item.commands : (item.command ? [item.command] : []),
            // Map 'time' or 'timestamp' to the required timestamp field
            timestamp: item.timestamp || item.time || new Date().toISOString()
        }));

        resolve(normalized as LogEntry[]);
      } catch (err) {
        reject(new Error("Invalid JSON format"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
};

