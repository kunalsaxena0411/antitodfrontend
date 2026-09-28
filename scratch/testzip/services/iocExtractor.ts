import { GoogleGenAI } from "@google/genai";
import { GEMINI_API_KEY } from "../config/config";
import { fetchWithCors } from './http';

// Robust Regex Definitions
const IP_REGEX = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;
const DOMAIN_REGEX = /\b([a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}\b/gi;
const URL_REGEX = /(?:https?|ftp|sftp|ws|wss|hxxp|h\*\*p):\/\/[^\s"']+/gi;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const MD5_REGEX = /\b[a-fA-F0-9]{32}\b/g;
const SHA1_REGEX = /\b[a-fA-F0-9]{40}\b/g;
const SHA256_REGEX = /\b[a-fA-F0-9]{64}\b/g;

// Extended exclusion list to filter out code artifacts (Go/Java/Python structs/methods)
const IGNORE_EXTENSIONS = new Set([
    // Images/Media
    'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp', 'bmp', 'tiff', 'mp3', 'mp4', 'wav', 'avi', 'mov',
    // Web
    'css', 'js', 'json', 'xml', 'html', 'htm', 'map', 'woff', 'woff2', 'ttf', 'eot',
    // Executables/Scripts
    'php', 'asp', 'aspx', 'exe', 'dll', 'bin', 'dat', 'txt', 'log', 'csv', 'sh', 'bat', 'ps1', 'vbs', 'cmd', 'msi', 'jar',
    // Source Code
    'py', 'rb', 'java', 'c', 'cpp', 'h', 'hpp', 'go', 'rs', 'ts', 'tsx', 'jsx', 'cs', 'vb', 'kt', 'swift', 'pl',
    // Archives
    'zip', 'tar', 'gz', 'rar', '7z', 'bz2', 'xz',
    // Configs
    'ini', 'cfg', 'conf', 'yaml', 'yml', 'toml', 'env',
    // Common Code Identifiers / False Positive "TLDs"
    'local', 'internal', 'test', 'example', 'localhost',
    'config', 'context', 'request', 'response', 'client', 'server', 'certificate', 'cert',
    'socks', 'task', 'command', 'obfuscated', 'packed', 'handle', 'addr', 'address',
    'error', 'info', 'warn', 'debug', 'trace', 'fatal', 'exception',
    'string', 'int', 'bool', 'boolean', 'float', 'double', 'void', 'class', 'struct', 'interface', 'object', 'module', 'func', 'function',
    'null', 'undefined', 'true', 'false'
]);

export interface ExtractedArtifact {
    type: 'IP' | 'DOMAIN' | 'URL' | 'EMAIL' | 'HASH';
    value: string;
}

// Helper to "refang" IOCs (e.g. "example[.]com" -> "example.com")
const refang = (text: string): string => {
    let clean = text;
    // [.] (.) {.} <.>
    clean = clean.replace(/[\[\(\{<]\s*\.\s*[\]\)\}>]/g, '.');
    // [dot] (dot)
    clean = clean.replace(/[\[\(\{<]\s*dot\s*[\]\)\}>]/gi, '.');
    // hxxp h**p
    clean = clean.replace(/h[x\*^]{2}p/gi, 'http');
    // [:] (:)
    clean = clean.replace(/[\[\(\{<]\s*:\s*[\]\)\}>]/g, ':');
    // [at] (at)
    clean = clean.replace(/[\[\(\{<]\s*at\s*[\]\)\}>]/gi, '@');
    // "example . com" -> "example.com"
    clean = clean.replace(/([a-zA-Z0-9])\s+\.\s+([a-zA-Z]{2,})/g, '$1.$2');
    // [@]
    clean = clean.replace(/\[@\]/g, '@');
    // Escaped dots
    clean = clean.replace(/\\\./g, '.');
    return clean;
};

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

export const extractIocsFromText = (text: string): ExtractedArtifact[] => {
    const artifacts = new Map<string, ExtractedArtifact>();
    const cleanText = refang(text);

    const add = (type: ExtractedArtifact['type'], value: string) => {
        let val = value.trim();
        // Remove trailing punctuation often captured
        val = val.replace(/[.,;:)\]>]+$/, '');
        
        if (!artifacts.has(val) && val.length > 0) {
            // Filter obvious false positives
            if (type === 'IP' && (val.startsWith('127.0') || val === '0.0.0.0')) return;
            
            // Advanced Domain Filtering
            if (type === 'DOMAIN') {
                const parts = val.split('.');
                const tld = parts[parts.length - 1]; // Keep case for check
                const tldLower = tld.toLowerCase();
                
                // 1. Ignore List Check
                if (IGNORE_EXTENSIONS.has(tldLower)) return;
                
                // 2. Numeric TLD / Version check (e.g. 1.2.3)
                if (/^\d+$/.test(tld)) return;

                // 3. Mixed Case TLD Check (Strong indicator of Code Identifiers e.g. "Socks", "DoTask")
                // Valid domains are typically normalized to lowercase or all uppercase.
                // Mixed case like "HandleTTYRequest" is almost certainly a function/struct.
                if (/[A-Z]/.test(tld) && /[a-z]/.test(tld)) return;

                // 4. Length Heuristic for Code identifiers masquerading as TLDs
                // Most valid TLDs are short (2-4) or specific words. Code identifiers can be long.
                // Exception: Punycode (xn--)
                if (tld.length > 18 && !tld.startsWith('xn--')) return;

                // 5. Exclude domains starting with special chars or invalid formatting
                if (val.startsWith('-') || val.endsWith('-')) return;
            }
            
            artifacts.set(val, { type, value: val });
        }
    };

    (cleanText.match(URL_REGEX) || []).forEach(m => add('URL', m));
    (cleanText.match(EMAIL_REGEX) || []).forEach(m => add('EMAIL', m));
    (cleanText.match(IP_REGEX) || []).forEach(m => add('IP', m));
    (cleanText.match(SHA256_REGEX) || []).forEach(m => add('HASH', m));
    (cleanText.match(SHA1_REGEX) || []).forEach(m => add('HASH', m));
    (cleanText.match(MD5_REGEX) || []).forEach(m => add('HASH', m));
    
    // Domain regex is noisy, so we run it last and check overlap
    (cleanText.match(DOMAIN_REGEX) || []).forEach(m => {
        // Only add if not part of an existing URL/Email match
        const isCaptured = Array.from(artifacts.values()).some(a => 
            (a.type === 'URL' || a.type === 'EMAIL') && a.value.includes(m)
        );
        if (!artifacts.has(m) && !isCaptured) {
             add('DOMAIN', m);
        }
    });

    return Array.from(artifacts.values());
};

// Fixed: Using recommended model and formatting contents as a single object for multi-part requests.
const extractIocsWithAi = async (file: File): Promise<ExtractedArtifact[]> => {
     const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
     const base64 = await fileToBase64(file);
     const data = base64.split(',')[1]; 
     const mimeType = file.type || 'application/pdf';

     // Fixed: Using gemini-3-flash-preview as recommended for text extraction tasks.
     const model = 'gemini-3-flash-preview';
     const prompt = `Analyze this document and extract technical Indicators of Compromise (IOCs).
     Look for: IP Addresses, Domains, URLs, File Hashes (MD5, SHA1, SHA256), and Email Addresses.
     Handle defanged indicators (e.g. example[.]com).
     
     Return ONLY a JSON Array of objects:
     [ { "type": "IP", "value": "1.2.3.4" }, { "type": "DOMAIN", "value": "evil.com" } ]
     
     Valid types: IP, DOMAIN, URL, EMAIL, HASH.
     Exclude benign vendor domains (microsoft.com, google.com) unless explicitly malicious.`;

     try {
         const response = await ai.models.generateContent({
             model,
             // Fixed: Guideline adherence - passing a single object with parts for multi-part content.
             contents: {
                 parts: [
                     { text: prompt },
                     { inlineData: { mimeType, data } }
                 ]
             },
             config: { responseMimeType: 'application/json' }
         });
         
         const text = response.text;
         if (text) {
             const json = JSON.parse(text);
             return Array.isArray(json) ? json : [];
         }
     } catch(e) {
         console.error("AI Extraction failed", e);
     }
     return [];
};

export const extractIocsFromFile = async (file: File): Promise<ExtractedArtifact[]> => {
    // Fixed: Guideline adherence - removing manual API key management via localStorage.
    
    // Use AI for PDF/Images if environment key exists (assumed pre-configured per guidelines)
    if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
         const aiResults = await extractIocsWithAi(file);
         if (aiResults.length > 0) return aiResults;
    }
    
    // Text-based fallback
    try {
        const text = await file.text();
        return extractIocsFromText(text);
    } catch {
        return [];
    }
};

export const extractIocsFromUrl = async (url: string): Promise<ExtractedArtifact[]> => {
    try {
        const text = await fetchWithCors(url);
        return extractIocsFromText(text);
    } catch (e) {
        console.error("Failed to extract from URL", e);
        return [];
    }
};
