
import { EmailAnalysisResult, EmailHop, EmailAuthResult, EmailAttachment } from '../types';
import { enrichIP } from './dns';
import { Buffer } from 'buffer';

const IP_REGEX = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;
const PRIVATE_IP_REGEX = /^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|127\.)/;
const URL_REGEX = /https?:\/\/[^\s<>"'{}|\\^`]+|ftp:\/\/[^\s<>"'{}|\\^`]+/gi;

// --- Advanced Forensic Helpers ---

const calculateEntropy = (str: string): number => {
    const len = str.length;
    if (len === 0) return 0;
    const frequencies = new Map<string, number>();
    for (let i = 0; i < len; i++) {
        const char = str[i];
        frequencies.set(char, (frequencies.get(char) || 0) + 1);
    }
    let entropy = 0;
    frequencies.forEach(count => {
        const p = count / len;
        entropy -= p * Math.log2(p);
    });
    return entropy;
};

const calculateHash = async (content: string): Promise<string> => {
    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(content);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
        return 'hashing-failed';
    }
};

// Heuristic to detect file type based on magic numbers (simulated with base64 lookups here for text content)
const detectMagicType = (content: string): string => {
    if (content.startsWith('TVqQ')) return 'executable/windows (PE)'; // MZ
    if (content.startsWith('JVBERi0')) return 'document/pdf';
    if (content.startsWith('UEsDB')) return 'archive/zip';
    if (content.startsWith('R0lGOD')) return 'image/gif';
    if (content.startsWith('iVBORw')) return 'image/png';
    if (content.startsWith('/9j/')) return 'image/jpeg';
    return 'unknown';
};

// Unwrap "Safe Links" from security vendors
const unwrapUrl = (url: string): string => {
    try {
        // Microsoft ATP / Safelinks
        if (url.includes('safelinks.protection.outlook.com')) {
            const params = new URL(url).searchParams;
            if (params.has('url')) return params.get('url') || url;
        }
        // Proofpoint
        if (url.includes('urldefense.proofpoint.com')) {
            // Proofpoint V2
            const match = url.match(/u=(.+?)&/);
            if (match) return decodeURIComponent(match[1].replace(/_/g, '/'));
        }
        // Mimecast
        if (url.includes('mimecast.com/protection')) {
             const params = new URL(url).searchParams;
             if (params.has('url')) return params.get('url') || url;
        }
        return url;
    } catch (e) {
        return url;
    }
};

const extractEmail = (str: string): string => {
    const match = str.match(/<([^>]+)>/);
    return match ? match[1] : str.trim();
};

const extractDomain = (email: string): string => {
    const parts = email.split('@');
    return parts.length > 1 ? parts[1] : email;
};

const parseReceivedHeader = (header: string, index: number): Partial<EmailHop> => {
    const fromMatch = header.match(/from\s+([^\s]+)/i);
    const byMatch = header.match(/by\s+([^\s]+)/i);
    const withMatch = header.match(/with\s+([^\s]+)/i);
    const ipMatch = header.match(IP_REGEX);
    
    // Improved date parsing handling various Received formats
    const dateParts = header.split(';');
    let dateStr = '';
    if (dateParts.length > 1) {
        dateStr = dateParts[dateParts.length - 1].trim();
    } else {
        // Fallback: look for date-like pattern at end
        const dateMatch = header.match(/(\w{3},\s+\d{1,2}\s+\w{3}\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+[-+]\d{4})/);
        if (dateMatch) dateStr = dateMatch[1];
    }

    return {
        hopNum: index,
        from: fromMatch ? fromMatch[1] : 'unknown',
        by: byMatch ? byMatch[1] : 'unknown',
        with: withMatch ? withMatch[1] : undefined,
        ip: ipMatch ? ipMatch[0] : undefined,
        date: dateStr,
        timestamp: dateStr ? new Date(dateStr).getTime() : 0,
        isPrivate: ipMatch ? PRIVATE_IP_REGEX.test(ipMatch[0]) : false
    };
};

export const analyzeEmailContent = async (rawContent: string): Promise<EmailAnalysisResult> => {
    // 1. Robust Header Parsing
    const parts = rawContent.split(/\r?\n\r?\n/);
    const rawHeaders = parts[0];
    const rawBody = parts.slice(1).join('\n\n');
    
    const lines = rawHeaders.split(/\r?\n/);
    const headers: Record<string, string> = {};
    let currentKey = '';

    lines.forEach(line => {
        if (line.match(/^\s+/)) {
            if (currentKey) headers[currentKey] += ' ' + line.trim();
        } else {
            const match = line.match(/^([^:]+):(.+)$/);
            if (match) {
                currentKey = match[1].toLowerCase();
                headers[currentKey] = match[2].trim();
            }
        }
    });

    // 2. Metadata Extraction
    const subject = headers['subject'] || 'No Subject';
    const from = headers['from'] || 'Unknown';
    const to = headers['to'] || 'Unknown';
    const date = headers['date'] || 'Unknown Date';
    const messageId = headers['message-id'] || 'Missing';
    const returnPath = headers['return-path'] || 'Missing';
    const replyTo = headers['reply-to'];

    // 3. Client Attribution
    const client = {
        userAgent: headers['user-agent'] || headers['x-mailer'] || 'Unknown',
        mailer: headers['x-mailer'] || 'Unknown',
        mimeVersion: headers['mime-version'] || '1.0',
        originatingIp: headers['x-originating-ip'] || headers['x-sender-ip']
    };
    if (client.originatingIp) {
        const match = client.originatingIp.match(IP_REGEX);
        if (match) client.originatingIp = match[0];
    }

    // 4. Hop Analysis & Time Travel Detection
    const receivedHeaders: string[] = [];
    let currentHeader = '';
    // Parse raw lines again to keep order
    const rawHeaderLines = rawHeaders.split(/\r?\n/);
    rawHeaderLines.forEach(line => {
        if (line.toLowerCase().startsWith('received:')) {
            if (currentHeader) receivedHeaders.push(currentHeader);
            currentHeader = line.substring(9).trim();
        } else if (line.match(/^\s+/) && currentHeader) {
            currentHeader += ' ' + line.trim();
        } else if (currentHeader) {
            receivedHeaders.push(currentHeader);
            currentHeader = '';
        }
    });
    if (currentHeader) receivedHeaders.push(currentHeader);

    let hops: EmailHop[] = receivedHeaders.map((h, i) => parseReceivedHeader(h, i) as EmailHop);
    
    // Filter out invalid timestamps
    hops = hops.filter(h => !isNaN(h.timestamp) && h.timestamp > 0);
    hops.sort((a, b) => a.timestamp - b.timestamp);
    
    // Calculate delays
    hops = hops.map((hop, i) => {
        const prevTime = i > 0 ? hops[i-1].timestamp : hop.timestamp;
        const delay = (hop.timestamp - prevTime) / 1000;
        return { ...hop, hopNum: i + 1, delaySeconds: delay }; // Allow negative for time travel detection
    });

    // Enrich Hops (Async)
    const enrichmentPromises = hops.map(async (hop) => {
        if (hop.ip && !hop.isPrivate) {
            try {
                const data = await enrichIP(hop.ip);
                if (data) hop.enrichment = data;
                hop.country = data?.country_code;
                hop.asn = data?.asn?.name;
            } catch(e) {}
        }
        return hop;
    });
    await Promise.all(enrichmentPromises);

    // 5. Advanced Auth Analysis
    const authHeader = headers['authentication-results'] || headers['arc-authentication-results'] || '';
    const auth: EmailAuthResult = {
        spf: { status: 'NONE', detail: 'No SPF found' },
        dkim: { status: 'NONE', detail: 'No DKIM found' },
        dmarc: { status: 'NONE', detail: 'No DMARC found' },
        arc: { status: 'NONE', detail: 'No ARC found' }
    };

    if (authHeader) {
        if (authHeader.includes('spf=pass')) { auth.spf.status = 'PASS'; auth.spf.detail = 'Sender Authorized'; }
        else if (authHeader.includes('spf=fail')) { auth.spf.status = 'FAIL'; auth.spf.detail = 'Sender IP not in record'; }
        else if (authHeader.includes('spf=softfail')) { auth.spf.status = 'NEUTRAL'; auth.spf.detail = 'SoftFail (Allowed but flagged)'; }

        if (authHeader.includes('dkim=pass')) { auth.dkim.status = 'PASS'; auth.dkim.detail = 'Signature Verified'; }
        else if (authHeader.includes('dkim=fail')) { auth.dkim.status = 'FAIL'; auth.dkim.detail = 'Signature Invalid/Altered'; }

        if (authHeader.includes('dmarc=pass')) { auth.dmarc.status = 'PASS'; auth.dmarc.detail = 'Alignment Check Passed'; }
        else if (authHeader.includes('dmarc=fail')) { auth.dmarc.status = 'FAIL'; auth.dmarc.detail = 'Alignment Failed'; }
        
        if (authHeader.includes('arc=pass')) { auth.arc.status = 'PASS'; auth.arc.detail = 'Chain Valid'; }
    }

    // 6. Risk Scoring & Anomaly Detection
    let riskScore = 0;
    const riskFactors: string[] = [];

    // Auth Failures
    if (auth.spf.status === 'FAIL') { riskScore += 25; riskFactors.push("SPF Auth Failed (Spoofing)"); }
    if (auth.dkim.status === 'FAIL') { riskScore += 25; riskFactors.push("DKIM Auth Failed (Tampering)"); }
    if (auth.dmarc.status === 'FAIL') { riskScore += 30; riskFactors.push("DMARC Policy Failure"); }

    // Message-ID Anomalies
    if (!messageId || messageId === 'Missing') {
        riskScore += 10;
        riskFactors.push("Missing Message-ID Header");
    } else if (!messageId.includes('@')) {
         riskScore += 20;
         riskFactors.push("Malformed Message-ID (No domain)");
    }

    // Time Travel
    const timeTravelHop = hops.find(h => h.delaySeconds < -5); // Allow 5s clock skew
    if (timeTravelHop) {
        riskScore += 15;
        riskFactors.push(`Impossible Timestamp (Clock Skew) at Hop ${timeTravelHop.hopNum}`);
    }

    // Mismatches
    const fromAddr = extractEmail(from);
    const returnAddr = extractEmail(returnPath);
    if (returnAddr !== 'Missing' && fromAddr !== returnAddr) {
        if (extractDomain(fromAddr) !== extractDomain(returnAddr)) {
            riskScore += 15;
            riskFactors.push(`Return-Path Domain Mismatch (${extractDomain(returnAddr)})`);
        }
    }

    // Hop Threats
    hops.forEach(hop => {
        if (hop.delaySeconds > 600) { 
            riskScore += 5;
            riskFactors.push(`Mail Routing Delay (>10m) at Hop ${hop.hopNum}`);
        }
        if (hop.enrichment?.threat?.is_known_attacker) {
            riskScore += 60;
            riskFactors.push(`Known Attacker IP in route: ${hop.ip}`);
        }
    });

    // 7. Attachment Forensics
    const attachments: EmailAttachment[] = [];
    const mainContentType = headers['content-type'] || '';
    const boundaryMatch = mainContentType.match(/boundary="?([^";\s]+)"?/i);
    
    if (boundaryMatch) {
        const boundary = boundaryMatch[1];
        const bodyParts = rawContent.split(`--${boundary}`);
        
        // Limit analysis to prevent browser freeze on massive emails
        for (const part of bodyParts.slice(0, 20)) {
            if (part.includes('Content-Disposition') && part.includes('filename=')) {
                const filenameMatch = part.match(/filename="?([^";\r\n]+)"?/i);
                const typeMatch = part.match(/Content-Type:\s*([^;\r\n]+)/i);
                if (filenameMatch) {
                    const bodyStart = part.indexOf('\r\n\r\n');
                    let sizeStr = 'Unknown';
                    let sha256 = 'N/A';
                    let entropy = 0;
                    let magicType = 'unknown';
                    
                    if (bodyStart !== -1) {
                        const partBody = part.substring(bodyStart).trim();
                        const approxBytes = partBody.length * 0.75; // Base64 approx
                        sizeStr = approxBytes > 1024 * 1024 ? `${(approxBytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(approxBytes / 1024)} KB`;
                        
                        // Calculate forensic data
                        if (approxBytes < 5 * 1024 * 1024) { // Only hash small files in browser
                             sha256 = await calculateHash(partBody);
                             entropy = calculateEntropy(partBody);
                             magicType = detectMagicType(atob(partBody.substring(0, 64))); // Peek first bytes
                        }
                    }
                    
                    const ext = filenameMatch[1].split('.').pop()?.toLowerCase();
                    // Risk check: Executable disguised as doc
                    if (magicType.includes('executable') && !['exe','dll','bat'].includes(ext || '')) {
                         riskScore += 50;
                         riskFactors.push(`Extension Mismatch: ${filenameMatch[1]} detected as Executable`);
                    }
                    if (entropy > 7.8) {
                         riskFactors.push(`High Entropy Attachment (Possible Encryption/Packing): ${filenameMatch[1]}`);
                    }

                    attachments.push({
                        filename: filenameMatch[1],
                        fileType: typeMatch ? typeMatch[1].trim() : 'application/octet-stream',
                        size: sizeStr,
                        // Extended fields for internal use
                        hash: sha256,
                        entropy: entropy,
                        magic: magicType
                    } as any);
                }
            }
        }
    }

    // 8. Body & URL Forensics
    const iocSet = new Set<string>();
    const iocs: { value: string; type: 'IP' | 'DOMAIN' | 'EMAIL' | 'URL' }[] = [];
    
    const rawUrls = rawBody.match(URL_REGEX) || [];
    rawUrls.slice(0, 100).forEach(u => {
        const unwrapped = unwrapUrl(u);
        if (!iocSet.has(unwrapped)) {
             iocSet.add(unwrapped);
             iocs.push({ value: unwrapped, type: 'URL' });
             // Extract Domain
             try {
                 const domain = new URL(unwrapped).hostname;
                 if (!iocSet.has(domain) && !domain.match(IP_REGEX)) {
                     iocSet.add(domain);
                     iocs.push({ value: domain, type: 'DOMAIN' });
                 }
             } catch(e) {}
        }
    });
    
    if (iocs.length > 10) riskFactors.push(`High URL Density (${iocs.length} links)`);
    
    // Extract IPs/Emails from Headers
    const allIps: string[] = rawHeaders.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || [];
    allIps.forEach(ip => {
        if (!iocSet.has(ip) && !ip.startsWith('127.') && !ip.startsWith('10.') && !ip.startsWith('192.168')) {
            iocSet.add(ip);
            iocs.push({ value: ip, type: 'IP' });
        }
    });
    
    // Check for PGP
    const pgpInfo = { hasPgp: false, method: '', keyData: '' };
    if (headers['autocrypt'] || rawContent.includes('BEGIN PGP')) {
        pgpInfo.hasPgp = true;
        pgpInfo.method = 'Detected';
    }

    return {
        subject,
        from,
        to,
        date,
        messageId,
        returnPath,
        replyTo,
        hops,
        auth,
        securityHeaders: headers,
        client,
        riskScore: Math.min(100, riskScore),
        riskFactors,
        bodyPreview: rawBody.substring(0, 2000), // Larger preview
        attachments,
        rawHeaders,
        iocs,
        pgpInfo
    };
};
