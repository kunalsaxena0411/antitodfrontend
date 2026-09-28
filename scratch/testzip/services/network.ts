

import { NetworkPacket, TcpStream, NetworkAnalysisResult, MalpediaActor, IocCollection, ActorMatch, DnsLayer, TlsLayer, DhcpLayer, LdapLayer, HttpLayer, Ja3Info, AnomalyRecord, ExtractedFile, IpDataResponse } from '../types';
import { mmdbService } from './mmdb';

// --- Helper Functions ---
const bytesToHex = (bytes: Uint8Array): string => {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
};

const bytesToIp = (bytes: Uint8Array): string => {
    return Array.from(bytes).join('.');
};

const calculateEntropy = (data: Uint8Array): number => {
    if (data.length === 0) return 0;
    const frequencies = new Array(256).fill(0);
    for (let i = 0; i < data.length; i++) {
        frequencies[data[i]]++;
    }
    
    let entropy = 0;
    const len = data.length;
    for (let i = 0; i < 256; i++) {
        if (frequencies[i] > 0) {
            const p = frequencies[i] / len;
            entropy -= p * Math.log2(p);
        }
    }
    return entropy;
};

// --- Binary Reader Helper ---
class BinaryReader {
    view: DataView;
    offset: number;

    constructor(buffer: ArrayBuffer, offset: number = 0) {
        this.view = new DataView(buffer);
        this.offset = offset;
    }

    readUint8(): number {
        if (this.offset + 1 > this.view.byteLength) throw new Error("Buffer Overflow");
        return this.view.getUint8(this.offset++);
    }

    readUint16(littleEndian: boolean = false): number {
        if (this.offset + 2 > this.view.byteLength) throw new Error("Buffer Overflow");
        const val = this.view.getUint16(this.offset, littleEndian);
        this.offset += 2;
        return val;
    }

    readUint32(littleEndian: boolean = false): number {
        if (this.offset + 4 > this.view.byteLength) throw new Error("Buffer Overflow");
        const val = this.view.getUint32(this.offset, littleEndian);
        this.offset += 4;
        return val;
    }

    readBytes(len: number): Uint8Array {
        if (this.offset + len > this.view.byteLength) throw new Error("Buffer Overflow");
        const val = new Uint8Array(this.view.buffer.slice(this.offset, this.offset + len));
        this.offset += len;
        return val;
    }

    remaining(): number {
        return this.view.byteLength - this.offset;
    }
}

// --- Parsing Logic ---

const parseEthernet = (data: Uint8Array) => {
    if (data.length < 14) return null;
    const dstMac = bytesToHex(data.slice(0, 6));
    const srcMac = bytesToHex(data.slice(6, 12));
    const type = (data[12] << 8) | data[13];
    return { dstMac, srcMac, type, payload: data.slice(14) };
};

const parseIPv4 = (data: Uint8Array) => {
    if (data.length < 20) return null;
    const version = (data[0] >> 4) & 0x0F;
    const headerLength = (data[0] & 0x0F) * 4;
    const totalLength = (data[2] << 8) | data[3];
    
    // Extract flags and fragment offset
    const flagsAndOffset = (data[6] << 8) | data[7];
    const flags = (flagsAndOffset >> 13) & 0x07;
    
    const ttl = data[8];
    const protocol = data[9];
    const srcIp = bytesToIp(data.slice(12, 16));
    const dstIp = bytesToIp(data.slice(16, 20));
    
    return {
        version,
        headerLength,
        totalLength,
        ttl,
        protocol,
        flags,
        srcIp,
        dstIp,
        payload: data.slice(headerLength)
    };
};

const parseTCP = (data: Uint8Array) => {
    if (data.length < 20) return null;
    const srcPort = (data[0] << 8) | data[1];
    const dstPort = (data[2] << 8) | data[3];
    const seq = (data[4] << 24) | (data[5] << 16) | (data[6] << 8) | data[7];
    const ack = (data[8] << 24) | (data[9] << 16) | (data[10] << 8) | data[11];
    const headerLength = ((data[12] >> 4) & 0x0F) * 4;
    const flagsRaw = data[13];
    
    const flags = [];
    if (flagsRaw & 0x01) flags.push('FIN');
    if (flagsRaw & 0x02) flags.push('SYN');
    if (flagsRaw & 0x04) flags.push('RST');
    if (flagsRaw & 0x08) flags.push('PSH');
    if (flagsRaw & 0x10) flags.push('ACK');
    if (flagsRaw & 0x20) flags.push('URG');

    return {
        srcPort,
        dstPort,
        seq,
        ack,
        headerLength,
        flags,
        payload: data.slice(headerLength)
    };
};

const parseUDP = (data: Uint8Array) => {
    if (data.length < 8) return null;
    const srcPort = (data[0] << 8) | data[1];
    const dstPort = (data[2] << 8) | data[3];
    const length = (data[4] << 8) | data[5];
    
    return {
        srcPort,
        dstPort,
        length,
        payload: data.slice(8)
    };
};

// --- Deep Packet Parsers ---

// --- DNS Parser ---
const parseDns = (payload: Uint8Array): DnsLayer | null => {
    try {
        if (payload.length < 12) return null;
        const reader = new BinaryReader(payload.buffer, payload.byteOffset);
        
        const transactionId = reader.readUint16();
        const flags = reader.readUint16();
        const qdCount = reader.readUint16();
        const anCount = reader.readUint16();
        const nsCount = reader.readUint16(); // NS Count
        const arCount = reader.readUint16(); // AR Count (Additional)

        const readName = (): string => {
            let name = '';
            let jumped = false;
            let offset = reader.offset;
            const startOffset = offset;
            let loops = 0;

            while (true) {
                if (loops++ > 50) break; // Prevent infinite loops
                if (offset >= reader.view.byteLength) break;
                const len = reader.view.getUint8(offset);
                
                if (len === 0) {
                    offset++;
                    break;
                }

                if ((len & 0xC0) === 0xC0) {
                    // Pointer
                    if (!jumped) {
                        reader.offset = offset + 2;
                        jumped = true;
                    }
                    const ptr = ((len & 0x3F) << 8) | reader.view.getUint8(offset + 1);
                    // Assuming pointer is relative to DNS payload start (which is 0 in this view)
                    offset = ptr;
                } else {
                    offset++;
                    for (let i = 0; i < len; i++) {
                        name += String.fromCharCode(reader.view.getUint8(offset + i));
                    }
                    name += '.';
                    offset += len;
                }
            }
            if (!jumped) reader.offset = offset;
            return name.endsWith('.') ? name.slice(0, -1) : name;
        };

        const questions = [];
        for (let i = 0; i < qdCount; i++) {
            const name = readName();
            const typeVal = reader.readUint16();
            const classVal = reader.readUint16();
            const typeMap: Record<number, string> = { 1: 'A', 28: 'AAAA', 5: 'CNAME', 15: 'MX', 16: 'TXT', 12: 'PTR', 10: 'NULL' };
            questions.push({ name, type: typeMap[typeVal] || `TYPE${typeVal}`, class: classVal === 1 ? 'IN' : String(classVal) });
        }

        const answers = [];
        for (let i = 0; i < anCount; i++) {
            const name = readName();
            const typeVal = reader.readUint16();
            const cls = reader.readUint16();
            const ttl = reader.readUint32();
            const dataLen = reader.readUint16();
            
            let data = '...';
            if (typeVal === 1 && dataLen === 4) { // A
                data = `${reader.readUint8()}.${reader.readUint8()}.${reader.readUint8()}.${reader.readUint8()}`;
            } else if (typeVal === 5) { // CNAME
                data = readName(); // Handles pointers
            } else if (typeVal === 16) { // TXT
                // First byte is length
                if (dataLen > 0) {
                    const txtLen = reader.readUint8();
                    if (txtLen < dataLen) {
                         const txtBytes = reader.readBytes(txtLen);
                         data = new TextDecoder().decode(txtBytes);
                         // Skip remaining if any (padding?)
                         const remaining = dataLen - (txtLen + 1);
                         if (remaining > 0) reader.offset += remaining;
                    } else {
                        reader.offset += (dataLen - 1);
                        data = '[TXT Parse Error]';
                    }
                } else {
                     reader.offset += dataLen;
                     data = '';
                }
            } else {
                reader.offset += dataLen; // Skip other data for simplicity
                data = `[${dataLen} bytes]`;
            }
            const typeMap: Record<number, string> = { 1: 'A', 28: 'AAAA', 5: 'CNAME', 15: 'MX', 16: 'TXT', 12: 'PTR', 10: 'NULL' };
            answers.push({ name, type: typeMap[typeVal] || `TYPE${typeVal}`, ttl, data });
        }

        return { transactionId, flags, questions, answers };
    } catch (e) {
        return null;
    }
};

// --- TLS Parser (ClientHello / SNI) ---
const parseTls = (payload: Uint8Array): TlsLayer | null => {
    try {
        if (payload.length < 5) return null;
        const reader = new BinaryReader(payload.buffer, payload.byteOffset);
        
        const type = reader.readUint8();
        const versionMajor = reader.readUint8();
        const versionMinor = reader.readUint8();
        const length = reader.readUint16();
        
        if (type !== 22) return null; // Not Handshake
        
        const hsType = reader.readUint8();
        const hsLen = (reader.readUint8() << 16) | (reader.readUint8() << 8) | reader.readUint8();

        if (hsType !== 1) return null; // Not Client Hello

        const clientVersion = reader.readUint16();
        const random = reader.readBytes(32);
        
        const sessionIdLen = reader.readUint8();
        reader.offset += sessionIdLen; // Skip Session ID
        
        const cipherSuitesLen = reader.readUint16();
        const cipherSuites: number[] = [];
        for (let i=0; i<cipherSuitesLen; i+=2) {
            cipherSuites.push(reader.readUint16());
        }

        const compMethodsLen = reader.readUint8();
        reader.offset += compMethodsLen; // Skip Compression

        const extensionsLen = reader.readUint16();
        const endOffset = reader.offset + extensionsLen;
        let sni = undefined;
        const extensionIds: number[] = [];

        while (reader.offset < endOffset) {
            const extType = reader.readUint16();
            const extLen = reader.readUint16();
            extensionIds.push(extType);
            
            if (extType === 0x0000) { // Server Name
                const listLen = reader.readUint16();
                const nameType = reader.readUint8(); // Should be 0 (host_name)
                const nameLen = reader.readUint16();
                const nameBytes = reader.readBytes(nameLen);
                sni = new TextDecoder().decode(nameBytes);
            } else {
                reader.offset += extLen;
            }
        }

        // Calculate JA3 (Simplified - needs grease filtering/ordering strictly)
        const ja3String = `${clientVersion},${cipherSuites.join('-')},${extensionIds.join('-')},,`; // simplified
        
        return {
            contentType: type,
            version: `${versionMajor}.${versionMinor}`,
            sni,
            cipherSuites,
            extensions: extensionIds,
            ja3: ja3String
        };
    } catch (e) {
        return null;
    }
};

// --- DHCP Parser ---
const parseDhcp = (payload: Uint8Array): DhcpLayer | null => {
    try {
        if (payload.length < 240) return null; // Header + Cookie
        const reader = new BinaryReader(payload.buffer, payload.byteOffset);
        
        // Skip fixed header (236 bytes)
        // op(1), htype(1), hlen(1), hops(1), xid(4), secs(2), flags(2), ciaddr(4), yiaddr(4), siaddr(4), giaddr(4), chaddr(16), sname(64), file(128)
        const op = reader.readUint8(); // 1=Request, 2=Reply
        reader.offset = payload.byteOffset + 4;
        const xid = reader.readUint32();
        reader.offset = payload.byteOffset + 28;
        const macBytes = reader.readBytes(6);
        const clientMac = Array.from(macBytes).map(b => b.toString(16).padStart(2,'0')).join(':');
        
        reader.offset = payload.byteOffset + 236;
        const magic = reader.readUint32();
        if (magic !== 0x63825363) return null; // Magic Cookie

        let type = 'Unknown';
        let hostname = undefined;
        let requestedIp = undefined;
        const options: Record<number, any> = {};

        while (reader.offset < reader.view.byteLength) {
            const optCode = reader.readUint8();
            if (optCode === 255) break; // End
            if (optCode === 0) continue; // Pad
            
            const optLen = reader.readUint8();
            const optData = reader.readBytes(optLen);

            if (optCode === 53) { // DHCP Message Type
                const t = optData[0];
                if (t===1) type='DISCOVER';
                else if (t===2) type='OFFER';
                else if (t===3) type='REQUEST';
                else if (t===5) type='ACK';
            } else if (optCode === 12) { // Hostname
                hostname = new TextDecoder().decode(optData);
            } else if (optCode === 50) { // Requested IP
                requestedIp = Array.from(optData).join('.');
            }
            
            options[optCode] = bytesToHex(optData);
        }

        return { type, transactionId: xid, clientMac, hostname, requestedIp, options };

    } catch (e) {
        return null;
    }
};

// --- LDAP Parser (Heuristic) ---
const parseLdap = (payload: Uint8Array): LdapLayer | null => {
    try {
        // Basic BER check: Sequence (0x30)
        if (payload[0] !== 0x30) return null;
        
        const reader = new BinaryReader(payload.buffer, payload.byteOffset);
        reader.readUint8(); // Tag 0x30
        
        // Length (simplified BER)
        let len = reader.readUint8();
        if (len & 0x80) {
            const lenBytes = len & 0x7F;
            reader.offset += lenBytes;
        }
        
        // MessageID (Integer 0x02)
        if (reader.readUint8() !== 0x02) return null;
        const msgIdLen = reader.readUint8();
        reader.offset += msgIdLen; // Skip ID value for now
        
        // Protocol Op
        const opTag = reader.readUint8();
        let operation = 'Unknown';
        
        switch(opTag) {
            case 0x60: operation = 'BindRequest'; break;
            case 0x61: operation = 'BindResponse'; break;
            case 0x63: operation = 'SearchRequest'; break;
            case 0x64: operation = 'SearchEntry'; break;
            case 0x42: operation = 'UnbindRequest'; break;
            default: return null; // Not LDAP or unknown op
        }

        // Heuristic DN extraction (SearchRequest)
        // Structure: [Seq][Len][MsgId][Op][Len][BaseDN]...
        let dn = undefined;
        if (operation === 'SearchRequest') {
             // Length of Op payload
             let opLen = reader.readUint8();
             if (opLen & 0x80) {
                 const lb = opLen & 0x7F;
                 reader.offset += lb;
             }
             // Base Object (Octet String 0x04)
             if (reader.readUint8() === 0x04) {
                 const dnLen = reader.readUint8();
                 if (dnLen > 0) {
                    const dnBytes = reader.readBytes(dnLen);
                    dn = new TextDecoder().decode(dnBytes);
                 }
             }
        }

        return { messageId: 0, operation, dn };
    } catch (e) {
        return null;
    }
};

// --- HTTP Parser (Simple) ---
const parseHttp = (payload: Uint8Array): HttpLayer | null => {
    try {
        const text = new TextDecoder().decode(payload.slice(0, Math.min(payload.length, 2048)));
        const lines = text.split('\r\n');
        const reqLine = lines[0];
        
        if (reqLine.includes('HTTP/')) {
            const parts = reqLine.split(' ');
            if (parts.length >= 3) {
                const method = parts[0]; // GET, POST or HTTP/1.1
                const uri = parts[1];
                const responseCode = method.startsWith('HTTP') ? parseInt(parts[1]) : undefined;
                
                // Headers
                let host = undefined;
                let userAgent = undefined;
                let contentType = undefined;
                
                lines.forEach(line => {
                    if (line.toLowerCase().startsWith('host:')) host = line.substring(5).trim();
                    if (line.toLowerCase().startsWith('user-agent:')) userAgent = line.substring(11).trim();
                    if (line.toLowerCase().startsWith('content-type:')) contentType = line.substring(13).trim();
                });

                return { method, uri, host, userAgent, contentType, responseCode };
            }
        }
        return null;
    } catch (e) {
        return null;
    }
};


// --- Anomaly Detection Engine ---

const calculateStandardDeviation = (values: number[]): number => {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b) / values.length;
    return Math.sqrt(values.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / values.length);
};

export const detectNetworkAnomalies = (packets: NetworkPacket[], streams: TcpStream[]): AnomalyRecord[] => {
    const anomalies: AnomalyRecord[] = [];

    // 1. BEACONING (C2) - Regular intervals analysis
    // Group streams by SrcIP -> DstIP
    const connectionTimings = new Map<string, number[]>();
    streams.forEach(stream => {
        const key = `${stream.srcIp}->${stream.dstIp}`;
        if (!connectionTimings.has(key)) connectionTimings.set(key, []);
        connectionTimings.get(key)!.push(stream.startTime);
    });

    connectionTimings.forEach((timestamps, key) => {
        if (timestamps.length < 5) return; // Need minimum samples
        
        timestamps.sort((a, b) => a - b);
        const intervals: number[] = [];
        for (let i = 1; i < timestamps.length; i++) {
            intervals.push(timestamps[i] - timestamps[i-1]);
        }

        const stdDev = calculateStandardDeviation(intervals);
        const meanInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

        // If variance is low (< 10% of mean or < 1s) and we have enough connections
        if (stdDev < (meanInterval * 0.1) || stdDev < 1.0) {
            anomalies.push({
                id: crypto.randomUUID(),
                type: 'BURST', // Misnomer, strictly this is BEACONING/PERIODICITY
                description: `Potential C2 Beaconing to ${key.split('->')[1]}. Consistent interval ~${meanInterval.toFixed(2)}s.`,
                severity: 'HIGH',
                flowId: key,
                timestamp: timestamps[0],
                value: stdDev
            });
        }
    });

    // 2. DATA EXFILTRATION (Volume Outliers)
    // Analyze total bytes transferred per destination
    const bytesPerDst = new Map<string, number>();
    streams.forEach(s => {
        const key = `${s.srcIp}->${s.dstIp}`;
        bytesPerDst.set(key, (bytesPerDst.get(key) || 0) + s.bytes);
    });
    
    // Calculate stats for volumes
    const volumes = Array.from(bytesPerDst.values());
    const meanVol = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const stdDevVol = calculateStandardDeviation(volumes);

    bytesPerDst.forEach((bytes, key) => {
        // If volume is > Mean + 3*StdDev (Statistical Outlier)
        if (bytes > meanVol + (3 * stdDevVol) && bytes > 100000) { // Min threshold 100KB to reduce noise
             anomalies.push({
                id: crypto.randomUUID(),
                type: 'ASYMMETRY', 
                description: `Potential Data Exfiltration. Unusual volume (${(bytes/1024).toFixed(1)} KB) to ${key.split('->')[1]}.`,
                severity: 'CRITICAL',
                flowId: key,
                timestamp: Date.now(), // Rough approx
                value: bytes
            });
        }
    });

    // 3. DNS TUNNELING
    // Check for long query names, high entropy labels, and suspicious record types (TXT, NULL)
    const dnsPackets = packets.filter(p => p.protocol === 'DNS');
    dnsPackets.forEach(p => {
        const questions = p.details?.app?.dns?.questions || [];
        questions.forEach(q => {
             // 3a. Length & Depth
             if (q.name.length > 50 && q.name.split('.').length > 4) { 
                 anomalies.push({
                     id: crypto.randomUUID(),
                     type: 'PROTOCOL',
                     description: `Suspicious DNS Query Length (${q.name.length} chars). Potential Tunneling.`,
                     severity: 'MEDIUM',
                     packetId: p.id,
                     timestamp: p.timestamp,
                     value: q.name.length
                 });
             }
             
             // 3b. Entropy (DGA / Encoded Payload)
             const labels = q.name.split('.');
             let maxEntropy = 0;
             let suspiciousLabel = '';

             labels.forEach(label => {
                 if (label.length > 12) { // Analyze labels with sufficient length
                     const encoder = new TextEncoder();
                     const entropy = calculateEntropy(encoder.encode(label));
                     if (entropy > maxEntropy) {
                         maxEntropy = entropy;
                         suspiciousLabel = label;
                     }
                 }
             });

             if (maxEntropy > 4.5) {
                 anomalies.push({
                     id: crypto.randomUUID(),
                     type: 'ENTROPY',
                     description: `High Entropy DNS Label (${maxEntropy.toFixed(2)}). Potential Encoded C2: ${suspiciousLabel}`,
                     severity: 'HIGH',
                     packetId: p.id,
                     timestamp: p.timestamp,
                     value: maxEntropy
                 });
             }
        });
        
        // 3c. Suspicious Answers (TXT / NULL)
        const answers = p.details?.app?.dns?.answers || [];
        answers.forEach(a => {
            if (a.type === 'TXT' && a.data.length > 50) {
                 const encoder = new TextEncoder();
                 const txtEntropy = calculateEntropy(encoder.encode(a.data));
                 
                 // High entropy or massive size suggests data transfer
                 if (txtEntropy > 4.5 || a.data.length > 200) {
                     anomalies.push({
                         id: crypto.randomUUID(),
                         type: 'PROTOCOL',
                         description: `Suspicious DNS TXT Record (Len: ${a.data.length}, Entropy: ${txtEntropy.toFixed(2)}). Potential C2 Channel.`,
                         severity: 'HIGH',
                         packetId: p.id,
                         timestamp: p.timestamp,
                         value: a.data.length
                     });
                 }
            }
            
            if (a.type === 'NULL' || a.type === 'TYPE10') {
                 anomalies.push({
                     id: crypto.randomUUID(),
                     type: 'PROTOCOL',
                     description: `DNS NULL Record detected. Highly suspicious for tunneling.`,
                     severity: 'CRITICAL',
                     packetId: p.id,
                     timestamp: p.timestamp,
                     value: 10
                 });
            }
        });
    });

    // 4. PORT SCANNING
    // One Source -> Many Dst Ports (or Many Dst IPs on same port)
    const scanTracker = new Map<string, Set<number>>();
    packets.filter(p => p.protocol === 'TCP' || p.protocol === 'UDP').forEach(p => {
        const src = p.source;
        const port = parseInt(p.destPort);
        if (!isNaN(port)) {
            if (!scanTracker.has(src)) scanTracker.set(src, new Set());
            scanTracker.get(src)!.add(port);
        }
    });

    scanTracker.forEach((ports, src) => {
        if (ports.size > 20) {
            anomalies.push({
                id: crypto.randomUUID(),
                type: 'BURST',
                description: `Port Scan Detected from ${src}. Targeted ${ports.size} distinct ports.`,
                severity: 'MEDIUM',
                timestamp: packets[0]?.timestamp || Date.now(),
                value: ports.size
            });
        }
    });

    return anomalies;
};

// --- Main Analysis Logic ---

export const calculateAdvancedStats = (packets: NetworkPacket[], streams: TcpStream[]) => {
    const protocols: Record<string, number> = {};
    const ports: Record<number, number> = {};
    const talkersMap = new Map<string, { sent: number, recv: number }>();
    const dstMap = new Map<string, { packets: number, bytes: number }>();
    const convMap = new Map<string, { packets: number, bytes: number }>();
    const packetSizeDist: Record<string, number> = { 'Small (<128)': 0, 'Medium (128-899)': 0, 'Large (900-1499)': 0, 'Jumbo (>1500)': 0 };
    const timeSeriesMap = new Map<number, { packets: number, bytes: number }>();
    const ttlDist: Record<number, number> = {};
    const tcpFlags: Record<string, number> = {};
    const httpMethods: Record<string, number> = {};

    let bytesTotal = 0;

    packets.forEach(p => {
        protocols[p.protocol] = (protocols[p.protocol] || 0) + 1;
        bytesTotal += p.length;

        const timeBucket = Math.floor(p.timestamp);
        if (!timeSeriesMap.has(timeBucket)) timeSeriesMap.set(timeBucket, { packets: 0, bytes: 0 });
        const tb = timeSeriesMap.get(timeBucket)!;
        tb.packets++;
        tb.bytes += p.length;

        if (p.length < 128) packetSizeDist['Small (<128)']++;
        else if (p.length < 900) packetSizeDist['Medium (128-899)']++;
        else if (p.length < 1500) packetSizeDist['Large (900-1499)']++;
        else packetSizeDist['Jumbo (>1500)']++;

        if (p.details?.transport) {
            const dp = p.details.transport.dstPort;
            ports[dp] = (ports[dp] || 0) + 1;
            if (p.details.transport.flags) {
                const flagStr = p.details.transport.flags.sort().join('+') || 'None';
                tcpFlags[flagStr] = (tcpFlags[flagStr] || 0) + 1;
            }
        }

        if (p.details?.ip) {
            const ttl = p.details.ip.ttl;
            ttlDist[ttl] = (ttlDist[ttl] || 0) + 1;
        }

        if (p.details?.app?.http?.method) {
             const m = p.details.app.http.method;
             if (['GET', 'POST', 'PUT', 'DELETE'].includes(m)) {
                 httpMethods[m] = (httpMethods[m] || 0) + 1;
             }
        }

        const src = p.source;
        if (!talkersMap.has(src)) talkersMap.set(src, { sent: 0, recv: 0 });
        talkersMap.get(src)!.sent += p.length;

        const dst = p.destination;
        if (!dstMap.has(dst)) dstMap.set(dst, { packets: 0, bytes: 0 });
        const d = dstMap.get(dst)!;
        d.packets++;
        d.bytes += p.length;

        const key = [p.source, p.destination].sort().join(' <-> ');
        if (!convMap.has(key)) convMap.set(key, { packets: 0, bytes: 0 });
        const c = convMap.get(key)!;
        c.packets++;
        c.bytes += p.length;
    });

    return {
        totalPackets: packets.length,
        totalBytes: bytesTotal,
        duration: packets.length > 0 ? (packets[packets.length-1].timestamp - packets[0].timestamp) * 1000 : 0,
        protocols,
        ports,
        topTalkers: Array.from(talkersMap.entries()).map(([ip, s]) => ({ ip, count: 0, bytes: s.sent })).sort((a,b) => b.bytes - a.bytes).slice(0, 10),
        topDestinations: Array.from(dstMap.entries()).map(([ip, s]) => ({ ip, count: s.packets, bytes: s.bytes })).sort((a,b) => b.bytes - a.bytes).slice(0, 10),
        conversations: Array.from(convMap.entries()).map(([k, v]) => ({ src: k.split(' <-> ')[0], dst: k.split(' <-> ')[1], count: v.packets, bytes: v.bytes })).sort((a,b) => b.bytes - a.bytes).slice(0, 20),
        packetSizeDist,
        timeSeries: Array.from(timeSeriesMap.entries()).map(([t, v]) => ({ timestamp: t, ...v })).sort((a,b) => a.timestamp - b.timestamp),
        ttlDist,
        tcpFlags,
        httpMethods
    };
};

export const extractIocs = (packets: NetworkPacket[]): IocCollection => {
    const ips = new Set<string>();
    const domains = new Set<string>();
    const urls = new Set<string>();
    const userAgents = new Set<string>();
    const emails = new Set<string>();

    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
    const urlRegex = /https?:\/\/[^\s/$.?#].[^\s]*/g;
    const uaHeaderRegex = /User-Agent:\s*([^\r\n]+)/gi;
    const hostHeaderRegex = /Host:\s*([^\r\n]+)/gi;

    packets.forEach(pkt => {
        if (pkt.details?.ip) {
            ips.add(pkt.details.ip.srcIp);
            ips.add(pkt.details.ip.dstIp);
        }
        
        // DNS
        if (pkt.details?.app?.dns?.questions) {
            pkt.details.app.dns.questions.forEach(q => domains.add(q.name));
        }
        // TLS SNI
        if (pkt.details?.app?.tls?.sni) {
            domains.add(pkt.details.app.tls.sni);
        }
        // HTTP Host / UA
        if (pkt.details?.app?.http) {
             if (pkt.details.app.http.host) domains.add(pkt.details.app.http.host);
             if (pkt.details.app.http.userAgent) userAgents.add(pkt.details.app.http.userAgent);
        }

        if (pkt.raw && pkt.raw.length > 0) {
            // Try decoding as text for regex search (fallback)
            // Limit to first 1024 bytes for performance
            try {
                const textPayload = new TextDecoder().decode(pkt.raw.slice(0, 1024));
                
                // Emails
                const foundEmails = textPayload.match(emailRegex);
                if (foundEmails) foundEmails.forEach(e => emails.add(e));

                // URLs
                const foundUrls = textPayload.match(urlRegex);
                if (foundUrls) foundUrls.forEach(u => urls.add(u));

                // User Agents (Backup)
                let uaMatch;
                while ((uaMatch = uaHeaderRegex.exec(textPayload)) !== null) {
                    userAgents.add(uaMatch[1].trim());
                }

                // Domains (Host Header Backup)
                let hostMatch;
                while ((hostMatch = hostHeaderRegex.exec(textPayload)) !== null) {
                    domains.add(hostMatch[1].trim());
                }
            } catch (e) {}
        }
    });

    return {
        ips: Array.from(ips),
        domains: Array.from(domains),
        urls: Array.from(urls),
        userAgents: Array.from(userAgents),
        emails: Array.from(emails)
    };
};

export const correlateThreats = (iocs: IocCollection, actors: MalpediaActor[]): ActorMatch[] => {
    const matches: ActorMatch[] = [];
    const uniqueMatches = new Set<string>();

    // Simple correlation logic
    iocs.domains.forEach(domain => {
        actors.forEach(actor => {
            if (actor.description.includes(domain) || actor.meta.refs?.some(ref => ref.includes(domain))) {
                const key = `${actor.uuid}-${domain}`;
                if (!uniqueMatches.has(key)) {
                    matches.push({ actor, trigger: domain, type: 'IOC', confidence: 'HIGH' });
                    uniqueMatches.add(key);
                }
            }
        });
    });

    // Additional User Agent matching
    iocs.userAgents.forEach(ua => {
        actors.forEach(actor => {
            if (actor.malwareFamilies?.some(fam => ua.toLowerCase().includes(fam.toLowerCase()))) {
                const key = `${actor.uuid}-${ua}`;
                if (!uniqueMatches.has(key)) {
                    matches.push({ actor, trigger: ua, type: 'IOC', confidence: 'MEDIUM' });
                    uniqueMatches.add(key);
                }
            }
        });
    });

    return matches;
};

// --- File Reading & Parsing ---

const readPcap = async (file: File): Promise<NetworkPacket[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const view = new DataView(arrayBuffer);
    const packets: NetworkPacket[] = [];
    let offset = 0;

    // Global Header (24 bytes)
    const magic = view.getUint32(offset, true);
    let isLittleEndian = true;
    let isNano = false;

    // PCAP Magic Detection
    if (magic === 0xa1b2c3d4) {
        isLittleEndian = true; // Standard Microsecond LE
    } else if (magic === 0xd4c3b2a1) {
        isLittleEndian = false; // Standard Microsecond BE
    } else if (magic === 0xa1b23c4d) {
        isLittleEndian = true; // Nanosecond LE
        isNano = true;
    } else if (magic === 0x4d3cb2a1) {
        isLittleEndian = false; // Nanosecond BE
        isNano = true;
    } else if (magic === 0x0A0D0D0A) {
        // PcapNG Section Header Block Block Type
        return readPcapNg(view);
    } else {
        throw new Error("Invalid PCAP Magic Number: " + magic.toString(16));
    }

    // Read LinkType from Global Header (offset 20, 4 bytes)
    const linkType = view.getUint32(20, isLittleEndian);
    // Standard Ethernet is 1. 
    // We only fully support Ethernet parsing for now.
    if (linkType !== 1 && linkType !== 113) { // 113 is SLL (Linux Cooked), 1 is Ethernet
       console.warn("Unsupported LinkType:", linkType, "Attempting parse as Ethernet anyway.");
    }

    offset += 24; // Skip Global Header

    let packetId = 1;

    while (offset < view.byteLength) {
        try {
            // Packet Header (16 bytes)
            if (offset + 16 > view.byteLength) break;

            const tsSec = view.getUint32(offset, isLittleEndian);
            const tsUsec = view.getUint32(offset + 4, isLittleEndian); // Micro or Nano
            const inclLen = view.getUint32(offset + 8, isLittleEndian);
            const origLen = view.getUint32(offset + 12, isLittleEndian);
            
            offset += 16;

            if (offset + inclLen > view.byteLength) break;

            const packetData = new Uint8Array(arrayBuffer.slice(offset, offset + inclLen));
            offset += inclLen;

            // Parse Ethernet
            const eth = parseEthernet(packetData);
            if (eth && eth.type === 0x0800) { // IPv4
                const ip = parseIPv4(eth.payload);
                if (ip) {
                    let transport: any = null;
                    let appProto = 'TCP';
                    let info = `Length: ${origLen}`;
                    let appData: any = {};

                    if (ip.protocol === 6) { // TCP
                        transport = parseTCP(ip.payload);
                        appProto = 'TCP';
                        
                        // DPI
                        if (transport.srcPort === 80 || transport.dstPort === 80) {
                            appProto = 'HTTP';
                            appData.http = parseHttp(transport.payload);
                            if (appData.http) info = `${appData.http.method} ${appData.http.uri || ''}`;
                        }
                        if (transport.srcPort === 443 || transport.dstPort === 443) {
                            appProto = 'TLS';
                            appData.tls = parseTls(transport.payload);
                            if (appData.tls?.sni) info = `Client Hello (SNI=${appData.tls.sni})`;
                        }
                        if (transport.srcPort === 389 || transport.dstPort === 389) {
                            appProto = 'LDAP';
                            appData.ldap = parseLdap(transport.payload);
                            if (appData.ldap) info = `${appData.ldap.operation} ${appData.ldap.dn || ''}`;
                        }

                        if (!appData.tls && !appData.http && !appData.ldap) {
                            info = `${transport.srcPort} -> ${transport.dstPort} [${transport.flags.join(', ')}]`;
                        }
                    } else if (ip.protocol === 17) { // UDP
                        transport = parseUDP(ip.payload);
                        appProto = 'UDP';
                        
                        // DPI
                        if (transport.srcPort === 53 || transport.dstPort === 53) {
                            appProto = 'DNS';
                            appData.dns = parseDns(transport.payload);
                            if (appData.dns) {
                                const q = appData.dns.questions[0];
                                info = q ? `Standard Query ${q.name} ${q.type}` : `DNS Response (${appData.dns.answers.length} answers)`;
                            }
                        }
                        if (transport.srcPort === 67 || transport.dstPort === 67) {
                            appProto = 'DHCP';
                            appData.dhcp = parseDhcp(transport.payload);
                            if (appData.dhcp) info = `DHCP ${appData.dhcp.type} - ${appData.dhcp.hostname || ''}`;
                        }

                        if (!appData.dns && !appData.dhcp) {
                             info = `${transport.srcPort} -> ${transport.dstPort} Len=${transport.length}`;
                        }
                    } else if (ip.protocol === 1) {
                        appProto = 'ICMP';
                    }

                    const finalPayload = transport ? transport.payload : ip.payload;

                    packets.push({
                        id: packetId++,
                        timestamp: tsSec + (isNano ? tsUsec / 1000000000 : tsUsec / 1000000),
                        displayTime: new Date(tsSec * 1000).toLocaleTimeString(),
                        source: ip.srcIp,
                        destination: ip.dstIp,
                        protocol: appProto,
                        length: origLen,
                        info: info,
                        sourcePort: transport ? String(transport.srcPort) : '',
                        destPort: transport ? String(transport.dstPort) : '',
                        raw: finalPayload, // Store deepest payload
                        details: {
                            ip,
                            transport,
                            app: appData,
                            payload: {
                                data: '', // Lazy decode in UI
                                size: finalPayload.length,
                                hex: '',
                                raw: finalPayload
                            }
                        }
                    });
                }
            }
        } catch (e) {
            console.warn("Packet parsing error", e);
            break;
        }
    }

    return packets;
};

const readPcapNg = (view: DataView): NetworkPacket[] => {
    const packets: NetworkPacket[] = [];
    let offset = 0;
    let packetId = 1;
    let isLittleEndian = true; // Default, updated by SHB

    while (offset < view.byteLength) {
        if (offset + 8 > view.byteLength) break;
        
        const type = view.getUint32(offset, isLittleEndian);
        const length = view.getUint32(offset + 4, isLittleEndian);
        
        if (type === 0x0A0D0D0A) { // Section Header Block
            const magic = view.getUint32(offset + 8, isLittleEndian);
            if (magic === 0x1A2B3C4D) isLittleEndian = true;
            else if (magic === 0x4D3C2B1A) isLittleEndian = false;
        } else if (type === 0x00000006) { // Enhanced Packet Block
            // Interface ID (4) + Timestamp High (4) + Timestamp Low (4) + Cap Len (4) + Orig Len (4)
            const capLen = view.getUint32(offset + 20, isLittleEndian);
            // Packet Data starts at offset + 28 (Optionally aligned to 32 bits)
            const packetData = new Uint8Array(view.buffer.slice(offset + 28, offset + 28 + capLen));
            
            // Reuse Parsing Logic (Similar to PCAP)
            const eth = parseEthernet(packetData);
            if (eth && eth.type === 0x0800) { // IPv4
                const ip = parseIPv4(eth.payload);
                if (ip) {
                    let transport: any = null;
                    let appProto = 'TCP';
                    let info = `Length: ${capLen}`;
                    let appData: any = {};

                    if (ip.protocol === 6) { // TCP
                        transport = parseTCP(ip.payload);
                        appProto = 'TCP';
                        if (transport.srcPort === 80 || transport.dstPort === 80) {
                            appProto = 'HTTP';
                            appData.http = parseHttp(transport.payload);
                            if (appData.http) info = `${appData.http.method} ${appData.http.uri || ''}`;
                        }
                        if (transport.srcPort === 443 || transport.dstPort === 443) {
                            appProto = 'TLS';
                            appData.tls = parseTls(transport.payload);
                            if (appData.tls?.sni) info = `Client Hello (SNI=${appData.tls.sni})`;
                        }
                         if (transport.srcPort === 389 || transport.dstPort === 389) {
                            appProto = 'LDAP';
                            appData.ldap = parseLdap(transport.payload);
                            if (appData.ldap) info = `${appData.ldap.operation} ${appData.ldap.dn || ''}`;
                        }
                        
                        if (!appData.http && !appData.tls && !appData.ldap) info = `${transport.srcPort} -> ${transport.dstPort}`;
                    } else if (ip.protocol === 17) { // UDP
                        transport = parseUDP(ip.payload);
                        appProto = 'UDP';
                        if (transport.srcPort === 53 || transport.dstPort === 53) {
                            appProto = 'DNS';
                            appData.dns = parseDns(transport.payload);
                            if (appData.dns) {
                                const q = appData.dns.questions[0];
                                info = q ? `Standard Query ${q.name} ${q.type}` : 'DNS Response';
                            }
                        }
                        if (transport.srcPort === 67 || transport.dstPort === 67) {
                            appProto = 'DHCP';
                            appData.dhcp = parseDhcp(transport.payload);
                            if (appData.dhcp) info = `DHCP ${appData.dhcp.type}`;
                        }
                    } else if (ip.protocol === 1) {
                        appProto = 'ICMP';
                    }

                    const finalPayload = transport ? transport.payload : ip.payload;

                    packets.push({
                        id: packetId++,
                        timestamp: Date.now() / 1000, // Simplified TS for PcapNG without resolving interface scaling
                        displayTime: new Date().toLocaleTimeString(),
                        source: ip.srcIp,
                        destination: ip.dstIp,
                        protocol: appProto,
                        length: capLen,
                        info: info,
                        sourcePort: transport ? String(transport.srcPort) : '',
                        destPort: transport ? String(transport.dstPort) : '',
                        raw: finalPayload,
                        details: { ip, transport, app: appData, payload: { data: '', size: finalPayload.length, hex: '', raw: finalPayload } }
                    });
                }
            }
        }

        offset += length;
        if (length === 0) break; // Prevent infinite loop
    }
    return packets;
};

const readNetworkJson = async (file: File): Promise<NetworkPacket[]> => {
    const text = await file.text();
    let json: any;
    try {
        json = JSON.parse(text);
    } catch (e) {
        throw new Error("Invalid JSON file format.");
    }
    
    if (!Array.isArray(json)) json = [json];
    
    const packets: NetworkPacket[] = [];
    let id = 1;
    
    for (const entry of json) {
        // Supports Wireshark JSON (nested in _source) or flat list
        const source = entry._source?.layers || entry; 
        
        if (!source) continue;
        
        // Safe extraction
        const frame = source.frame || {};
        const ts = parseFloat(frame['frame.time_epoch'] || (Date.now() / 1000).toString());
        const len = parseInt(frame['frame.len'] || '0');
        
        const ip = source.ip || {};
        const srcIp = ip['ip.src'] || '0.0.0.0';
        const dstIp = ip['ip.dst'] || '0.0.0.0';
        
        let proto = 'IP';
        let srcPort = '';
        let dstPort = '';
        let info = '';
        
        if (source.tcp) {
            proto = 'TCP';
            srcPort = source.tcp['tcp.srcport'] || '';
            dstPort = source.tcp['tcp.dstport'] || '';
            if (srcPort === '80' || dstPort === '80') proto = 'HTTP';
            if (srcPort === '443' || dstPort === '443') proto = 'TLS';
            info = `${srcPort} -> ${dstPort} Seq=${source.tcp['tcp.seq'] || 0}`;
        } else if (source.udp) {
            proto = 'UDP';
            srcPort = source.udp['udp.srcport'] || '';
            dstPort = source.udp['udp.dstport'] || '';
            if (srcPort === '53' || dstPort === '53') proto = 'DNS';
            info = `${srcPort} -> ${dstPort} Len=${source.udp['udp.length'] || 0}`;
        } else if (source.icmp) {
            proto = 'ICMP';
            info = `Type ${source.icmp['icmp.type']} Code ${source.icmp['icmp.code']}`;
        } else if (source.dns) {
            proto = 'DNS';
            info = 'DNS Query';
        } else if (source.http) {
            proto = 'HTTP';
            info = source.http['http.request.method'] ? `${source.http['http.request.method']} ${source.http['http.request.uri']}` : 'HTTP Data';
        }
        
        packets.push({
            id: id++,
            timestamp: ts,
            displayTime: new Date(ts * 1000).toLocaleTimeString(),
            source: srcIp,
            destination: dstIp,
            protocol: proto,
            length: len,
            info: info || `Len: ${len}`,
            sourcePort: srcPort,
            destPort: dstPort,
            raw: new Uint8Array(), // Raw payload usually missing in JSON export unless explicitly included
            details: {
                ip: { srcIp, dstIp, ttl: parseInt(ip['ip.ttl'] || '0'), version: 4, headerLength: 20, totalLength: len, protocol: 0, flags: 0 },
                transport: { 
                    srcPort: parseInt(srcPort || '0'), 
                    dstPort: parseInt(dstPort || '0'), 
                    protocol: proto as any,
                    headerLength: 0
                },
                payload: { 
                    data: JSON.stringify(source, null, 2), 
                    size: 0, 
                    hex: '', 
                    raw: new Uint8Array() 
                }
            }
        });
    }
    
    return packets;
};

export const analyzePcap = async (file: File, actors: MalpediaActor[] = []): Promise<NetworkAnalysisResult> => {
    let packets: NetworkPacket[] = [];
    
    try {
        if (file.name.toLowerCase().endsWith('.json')) {
            packets = await readNetworkJson(file);
        } else {
            packets = await readPcap(file);
        }
    } catch (e) {
        console.error("Traffic Parsing Failed", e);
        throw new Error("Failed to parse traffic file. " + (e as Error).message);
    }

    // Collect Unique IPs for Bulk Enrichment
    const uniqueIps = new Set<string>();
    packets.forEach(p => {
        if (p.details?.ip) {
            uniqueIps.add(p.details.ip.srcIp);
            uniqueIps.add(p.details.ip.dstIp);
        }
        // Also check DNS answers for IPs
        if (p.details?.app?.dns?.answers) {
            p.details.app.dns.answers.forEach(a => {
                if (a.type === 'A') uniqueIps.add(a.data);
            });
        }
    });

    const ipEnrichment: Record<string, IpDataResponse> = {};
    uniqueIps.forEach(ip => {
        const enriched = mmdbService.lookup(ip);
        if (enriched) {
            ipEnrichment[ip] = enriched;
        }
    });

    const streams: TcpStream[] = []; 
    
    // Simple Stream Grouping based on 5-tuple
    const streamMap = new Map<string, TcpStream>();
    packets.forEach(p => {
        if (p.protocol === 'TCP' || p.protocol === 'HTTP' || p.protocol === 'TLS' || p.protocol === 'LDAP') {
            const key = [p.source, p.sourcePort, p.destination, p.destPort].sort().join('-');
            if (!streamMap.has(key)) {
                streamMap.set(key, {
                    id: key,
                    packetCount: 0,
                    bytes: 0,
                    startTime: p.timestamp,
                    endTime: p.timestamp,
                    duration: 0,
                    srcIp: p.source,
                    dstIp: p.destination,
                    srcPort: parseInt(p.sourcePort),
                    dstPort: parseInt(p.destPort),
                    protocol: 'TCP',
                    application: p.protocol,
                    state: 'ESTABLISHED',
                    retransmissions: 0,
                    payloads: [],
                    anomalyScore: 0
                });
            }
            const s = streamMap.get(key)!;
            s.packetCount++;
            s.bytes += p.length;
            s.endTime = p.timestamp;
            s.duration = (s.endTime - s.startTime) * 1000;
            // Store first few payloads
            if (s.payloads.length < 20 && p.raw && p.raw.length > 0) {
                s.payloads.push({
                    direction: p.source === s.srcIp ? 'CLIENT_TO_SERVER' : 'SERVER_TO_CLIENT',
                    data: p.raw,
                    timestamp: p.timestamp,
                    seq: s.payloads.length + 1
                });
            }
            
            // Aggregate metadata for stream
            if (p.details?.app?.tls?.sni) {
                s.metadata = { ...s.metadata, sni: p.details.app.tls.sni, ja3: p.details.app.tls.ja3 };
            }
            if (p.details?.app?.http?.host) {
                s.metadata = { ...s.metadata, httpHost: p.details.app.http.host };
            }
        }
    });
    
    streams.push(...Array.from(streamMap.values()));

    const stats = calculateAdvancedStats(packets, streams);
    const extractedIocs = extractIocs(packets);
    const actorMatches = correlateThreats(extractedIocs, actors);
    const anomalies = detectNetworkAnomalies(packets, streams);
    
    // TLS Fingerprints Aggregation
    const tlsFingerprintsMap = new Map<string, Ja3Info>();
    packets.forEach(p => {
        if (p.details?.app?.tls?.ja3) {
            const ja3 = p.details.app.tls.ja3;
            const hash = ja3.split('').reduce((a,b) => ((a << 5) - a) + b.charCodeAt(0)|0, 0).toString(16);
            
            if (!tlsFingerprintsMap.has(hash)) {
                tlsFingerprintsMap.set(hash, { hash, string: ja3, count: 0, riskScore: 0 });
            }
            tlsFingerprintsMap.get(hash)!.count++;
        }
    });
    const tlsFingerprints = Array.from(tlsFingerprintsMap.values());

    // File Extraction Heuristics (HTTP Content-Type)
    const extractedFiles: ExtractedFile[] = [];
    streams.forEach(stream => {
        // Find response payload with content-type
        // Heuristic: Look for HTTP headers in payload
        stream.payloads.forEach(payload => {
             if (payload.direction === 'SERVER_TO_CLIENT') {
                 try {
                     // Only process first chunk for headers
                     const text = new TextDecoder().decode(payload.data.slice(0, 1024));
                     if (text.includes('HTTP/1.1 200 OK') && text.includes('Content-Type:')) {
                         const typeMatch = text.match(/Content-Type:\s*([^\r\n]+)/i);
                         if (typeMatch) {
                             const mime = typeMatch[1].trim();
                             // Find double CRLF
                             const bodyStart = text.indexOf('\r\n\r\n');
                             if (bodyStart !== -1) {
                                 // Extract body (from this packet + potentially stream reassembly which we simulate here by just taking this chunk)
                                 const bodyData = payload.data.slice(bodyStart + 4);
                                 if (bodyData.length > 0) {
                                    const entropy = calculateEntropy(bodyData);
                                    const blob = new Blob([bodyData], { type: mime });
                                    extractedFiles.push({
                                        id: crypto.randomUUID(),
                                        name: `file_${extractedFiles.length + 1}.${mime.split('/')[1] || 'bin'}`,
                                        type: mime,
                                        size: bodyData.length,
                                        sourceStream: stream.id,
                                        entropy,
                                        hash: {}, // MD5/SHA could be added
                                        data: blob,
                                        isCompressed: entropy > 7.5
                                    });
                                 }
                             }
                         }
                     }
                 } catch (e) {}
             }
        });
    });

    return {
        packets,
        streams,
        files: extractedFiles,
        stats,
        dns: packets.filter(p => p.protocol === 'DNS' && p.details?.app?.dns).map(p => ({
            query: p.details!.app!.dns!.questions[0]?.name || 'Unknown',
            type: p.details!.app!.dns!.questions[0]?.type || 'A',
            count: 1,
            clientIp: p.source
        })),
        fileType: file.name.endsWith('json') ? 'JSON' : file.name.endsWith('ng') ? 'PCAPNG' : 'PCAP',
        tlsFingerprints,
        anomalies,
        dnsGraph: { nodes: [], links: [] },
        iocs: extractedIocs,
        forensicStats: {
            credentials: 0, 
            dns: packets.filter(p => p.protocol === 'DNS').length,
            httpHeaders: packets.filter(p => p.protocol === 'HTTP').length,
            connections: streams.length,
            openPorts: 0,
            sslTls: packets.filter(p => p.protocol === 'TLS').length,
            pictures: extractedFiles.filter(f => f.type.startsWith('image/')).length,
            http: packets.filter(p => p.protocol === 'HTTP').length,
            smb: 0,
            servers: 0,
            documents: extractedFiles.filter(f => f.type.includes('pdf') || f.type.includes('word')).length,
            network: packets.length,
            ftp: 0,
            telnet: 0,
            ssdp: 0,
            sip: 0,
            arp: 0,
            ethernet: packets.length,
            wifi: 0,
            hosts: new Set(packets.map(p => p.source)).size
        },
        actorMatches,
        ipEnrichment
    };
};

