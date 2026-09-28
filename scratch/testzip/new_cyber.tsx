
import React, { useState, useEffect, useMemo } from 'react';
import { 
    Search, Plus, Trash2, ArrowRight, Play, RefreshCw, 
    Copy, Check, FileCode, Hash, Globe, Link, 
    Binary, Scissors, Zap, AlertCircle, Save, Download,
    CheckCircle, Type as TypeIcon, Terminal, Eye, Volume2, ShieldAlert,
    Lock, Unlock, Key, Settings2, Cpu, Shield, FileCheck,
    Wand2, Calculator, Regex, Mail, MapPin, FileSearch,
    ImageIcon, Archive, Clock, FileKey, Info, Camera,
    Variable, ArrowDownAZ, Filter, MoveVertical, ListTree, GitCompare, AlignLeft,
    Code2, Brackets, Wand, ListFilter, Languages, CaseLower, CaseUpper, ScissorsLineItems,
    Pause, X, Sparkles, Wand2 as WandIcon, ExternalLink
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { GEMINI_API_KEY } from '../../config/config';

// --- TYPES ---

type OpCategory = 'Encoding' | 'Encryption' | 'Public Key' | 'Hashing' | 'Classic Ciphers' | 'Data Analysis' | 'Data Format' | 'Multimedia' | 'Compression' | 'Forensics' | 'PKI' | 'Logic' | 'Formatting';

interface Operation {
    id: string;
    name: string;
    description: string;
    category: OpCategory;
    icon: any;
    args?: { name: string; type: 'text' | 'number' | 'toggle' | 'select'; options?: string[]; default: any }[];
    run: (input: string, args: any, registers: Record<string, string>) => Promise<string> | string;
}

interface RecipeStep {
    id: string;
    opId: string;
    args: Record<string, any>;
    disabled?: boolean;
}

interface CyberChefViewProps {
    onNavigateToIntel?: (query: string) => void;
}

// --- HELPERS ---

const textToBuffer = (text: string) => new TextEncoder().encode(text);
const bufferToHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
const hexToBuffer = (hex: string) => {
    const cleanHex = hex.replace(/[^0-9a-fA-F]/g, '');
    const view = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
        view[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
    }
    return view.buffer;
};

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

/**
 * Heuristic PKI Parser
 * Extracts common fields from ASN.1 DER encoded buffers without external dependencies.
 */
const heuristicParseDER = (buffer: Uint8Array): string => {
    let output = "";
    const decoder = new TextDecoder();
    
    const findPrintable = (oid: number[]): string[] => {
        const matches: string[] = [];
        const oidStr = oid.map(b => b.toString(16).padStart(2, '0')).join('');
        const hex = Array.from(buffer).map(b => b.toString(16).padStart(2, '0')).join('');
        
        let lastIdx = 0;
        while (true) {
            const idx = hex.indexOf(oidStr, lastIdx);
            if (idx === -1) break;
            
            const valTagIdx = (idx / 2) + oid.length;
            const tag = buffer[valTagIdx];
            if (tag === 0x13 || tag === 0x0c || tag === 0x16 || tag === 0x1e) {
                const len = buffer[valTagIdx + 1];
                const start = valTagIdx + 2;
                const bytes = buffer.slice(start, start + len);
                matches.push(decoder.decode(bytes).replace(/[^\x20-\x7E]/g, ''));
            }
            lastIdx = idx + 2;
        }
        return matches;
    };

    const cns = findPrintable([0x55, 0x04, 0x03]);
    const orgs = findPrintable([0x55, 0x04, 0x0a]);
    const countries = findPrintable([0x55, 0x04, 0x06]);

    output += "--- HEURISTIC PKI ANALYSIS ---\n";
    if (cns.length > 0) output += `SUBJECT/CN: ${cns[0]}\n`;
    if (orgs.length > 0) output += `ORGANIZATION: ${orgs[0]}\n`;
    if (countries.length > 0) output += `COUNTRY: ${countries[0]}\n`;
    
    const times: string[] = [];
    for (let i = 0; i < buffer.length - 15; i++) {
        if (buffer[i] === 0x17 && buffer[i+1] === 13) {
            times.push(decoder.decode(buffer.slice(i+2, i+15)));
        }
    }
    if (times.length >= 2) {
        output += `NOT BEFORE: ${times[0]}\n`;
        output += `NOT AFTER:  ${times[1]}\n`;
    }

    if (output === "--- HEURISTIC PKI ANALYSIS ---\n") {
        output += "[!] No standard X.509 fields identified.\n";
    }

    return output;
};

const FILE_SIGNATURES = [
    { name: 'Executable (EXE/DLL)', sig: '4d5a', offset: 0 },
    { name: 'ELF Executable', sig: '7f454c46', offset: 0 },
    { name: 'PNG Image', sig: '89504e47', offset: 0 },
    { name: 'JPEG Image', sig: 'ffd8ff', offset: 0 },
    { name: 'GIF Image', sig: '47494638', offset: 0 },
    { name: 'PDF Document', sig: '25504446', offset: 0 },
    { name: 'ZIP Archive', sig: '504b0304', offset: 0 },
    { name: 'GZIP Archive', sig: '1f8b', offset: 0 },
    { name: 'SQLite DB', sig: '53514c697465', offset: 0 }
];

// --- OPERATIONS REGISTRY ---

const OPERATIONS: Operation[] = [
    // --- DATA ANALYSIS & EXTRACTION ---
    {
        id: 'magic',
        name: 'Magic',
        description: 'Heuristically detect encoding type and attempt decoding.',
        category: 'Data Analysis',
        icon: Wand2,
        run: (input) => {
            const results: string[] = [];
            
            if (/^[0-9a-fA-F\s:]+$/.test(input) && input.length > 4) {
                try {
                    const hex = input.replace(/[^0-9a-fA-F]/g, '');
                    let str = '';
                    for (let i = 0; i < hex.length; i += 2) {
                        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
                    }
                    if (/^[\x20-\x7E\s]+$/.test(str)) results.push(`[Hex Detected] Decoded: ${str}`);
                } catch(e) {}
            }

            if (/^[A-Za-z0-9+/=]+$/.test(input.trim()) && input.length % 4 === 0) {
                try {
                    const decoded = atob(input.trim());
                    if (/^[\x20-\x7E\s\r\n]+$/.test(decoded)) results.push(`[Base64 Detected] Decoded: ${decoded}`);
                } catch(e) {}
            }

            if (input.includes('%')) {
                try {
                    const decoded = decodeURIComponent(input);
                    if (decoded !== input) results.push(`[URL Encoding Detected] Decoded: ${decoded}`);
                } catch(e) {}
            }

            if (/^[01\s]+$/.test(input) && input.replace(/\s/g, '').length % 8 === 0) {
                try {
                    const bin = input.replace(/\s/g, '');
                    let str = '';
                    for (let i = 0; i < bin.length; i += 8) {
                        str += String.fromCharCode(parseInt(bin.substr(i, 8), 2));
                    }
                    if (/^[\x20-\x7E\s]+$/.test(str)) results.push(`[Binary Detected] Decoded: ${str}`);
                } catch(e) {}
            }

            if (results.length === 0) return "No obvious encoding detected by heuristic engine.";
            return results.join('\n\n');
        }
    },
    {
        id: 'entropy',
        name: 'Entropy',
        description: 'Calculate Shannon Entropy (randomness) of the data.',
        category: 'Data Analysis',
        icon: Calculator,
        run: (input) => {
            const h = calculateEntropy(input);
            let verdict = "Low Randomness (Structured Data)";
            if (h > 7.5) verdict = "High Randomness (Likely Encrypted or Compressed)";
            else if (h > 4.5) verdict = "Medium Randomness (Obfuscated or High Entropy Text)";
            
            return `Shannon Entropy: ${h.toFixed(4)} bits\nVerdict: ${verdict}\n\nNote: High entropy (>7.5) is a common indicator of packed malware or encrypted payloads.`;
        }
    },
    {
        id: 'regex-search',
        name: 'Regex Search',
        description: 'Search for patterns using Regular Expressions.',
        category: 'Data Analysis',
        icon: Regex,
        args: [
            { name: 'Regex', type: 'text', default: '\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b' },
            { name: 'Flags', type: 'text', default: 'gi' }
        ],
        run: (input, args) => {
            try {
                const re = new RegExp(args.Regex, args.Flags);
                const matches = input.match(re);
                if (!matches) return "No matches found.";
                return matches.join('\n');
            } catch (e) {
                return `[Error: Invalid Regular Expression]`;
            }
        }
    },
    {
        id: 'defang-url',
        name: 'Defang URL',
        description: 'Sanitize URLs for safe report sharing (e.g. hxxp://example[.]com).',
        category: 'Data Analysis',
        icon: Shield,
        run: (input) => {
            return input
                .replace(/http/gi, 'hxxp')
                .replace(/\./g, '[.]')
                .replace(/@/g, '[at]');
        }
    },
    {
        id: 'refang-url',
        name: 'Refang URL',
        description: 'Reconstruct sanitized URLs (e.g. hxxp -> http).',
        category: 'Data Analysis',
        icon: Unlock,
        run: (input) => {
            return input
                .replace(/hxxp/gi, 'http')
                .replace(/\[\.\]/g, '.')
                .replace(/\[at\]/g, '@');
        }
    },

    // --- PKI / PUBLIC KEY ---
    {
        id: 'parse-x509',
        name: 'Parse X.509',
        description: 'Extract metadata from X.509 Certificate / CSR.',
        category: 'PKI',
        icon: Shield,
        run: (input) => {
            const body = input.replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|\s/g, '');
            try {
                const bytes = Uint8Array.from(atob(body), c => c.charCodeAt(0));
                return heuristicParseDER(bytes);
            } catch (e) {
                try {
                    const hex = input.replace(/[^0-9a-fA-F]/g, '');
                    const bytes = new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
                    return heuristicParseDER(bytes);
                } catch(e2) {
                    return "[Error: Input is not a valid PEM or Hex DER structure]";
                }
            }
        }
    },

    // --- LOGIC ---
    {
        id: 'to-register',
        name: 'To Register',
        description: 'Save the current data into a named register (variable).',
        category: 'Logic',
        icon: Variable,
        args: [{ name: 'Register Name', type: 'text', default: 'R0' }],
        run: (input, args, regs) => {
            regs[args['Register Name']] = input;
            return input;
        }
    },
    {
        id: 'from-register',
        name: 'From Register',
        description: 'Replace current data with contents of a named register.',
        category: 'Logic',
        icon: Variable,
        args: [{ name: 'Register Name', type: 'text', default: 'R0' }],
        run: (input, args, regs) => regs[args['Register Name']] || "[Error: Register Empty]"
    },

    // --- FORMATTING ---
    {
        id: 'find-replace',
        name: 'Find / Replace',
        description: 'Find strings or regex and replace them.',
        category: 'Formatting',
        icon: Regex,
        args: [
            { name: 'Find', type: 'text', default: '' },
            { name: 'Replace', type: 'text', default: '' },
            { name: 'Regex', type: 'toggle', default: false }
        ],
        run: (input, args) => {
            if (!args.Find) return input;
            try {
                if (args.Regex) {
                    const re = new RegExp(args.Find, 'g');
                    return input.replace(re, args.Replace);
                }
                return input.split(args.Find).join(args.Replace);
            } catch (e) { return "[Regex Error]"; }
        }
    },
    {
        id: 'json-beautify',
        name: 'JSON Beautify',
        description: 'Format JSON data with standard indentation.',
        category: 'Formatting',
        icon: Brackets,
        run: (input) => {
            try { return JSON.stringify(JSON.parse(input), null, 4); }
            catch(e) { return "[Error: Invalid JSON]"; }
        }
    },
    {
        id: 'to-upper',
        name: 'To Upper Case',
        description: 'Convert all text to uppercase.',
        category: 'Formatting',
        icon: CaseUpper,
        run: (input) => input.toUpperCase()
    },
    {
        id: 'to-lower',
        name: 'To Lower Case',
        description: 'Convert all text to lowercase.',
        category: 'Formatting',
        icon: CaseLower,
        run: (input) => input.toLowerCase()
    },

    // --- HASHING ---
    {
        id: 'sha256',
        name: 'SHA256',
        description: 'Secure Hash Algorithm 2 (256-bit).',
        category: 'Hashing',
        icon: Hash,
        run: async (input) => bufferToHex(await crypto.subtle.digest('SHA-256', textToBuffer(input)))
    },
    {
        id: 'md5',
        name: 'MD5',
        description: 'Message Digest 5 (128-bit). Note: Cryptographically broken, used for integrity.',
        category: 'Hashing',
        icon: Hash,
        run: async (input) => {
            return bufferToHex(await crypto.subtle.digest('SHA-1', textToBuffer(input))) + " (SHA-1 fallback for MD5)";
        }
    },

    // --- CLASSIC CIPHERS ---
    {
        id: 'caesar',
        name: 'Caesar Cipher',
        description: 'Shift letters in the alphabet by a fixed number.',
        category: 'Classic Ciphers',
        icon: RefreshCw,
        args: [{ name: 'Shift', type: 'number', default: 3 }],
        run: (input, args) => {
            const shift = Number(args.Shift) % 26;
            return input.replace(/[a-z]/gi, (c) => {
                const base = c <= 'Z' ? 65 : 97;
                return String.fromCharCode(((c.charCodeAt(0) - base + shift) % 26) + base);
            });
        }
    },
    {
        id: 'rot13',
        name: 'ROT13',
        description: 'Rotate letters by 13 places.',
        category: 'Classic Ciphers',
        icon: RefreshCw,
        run: (input) => input.replace(/[a-zA-Z]/g, (c: any) => String.fromCharCode((c <= 'Z' ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26))
    },

    // --- ENCODING ---
    {
        id: 'to-base64',
        name: 'To Base64',
        description: 'Standard Base64 encoding.',
        category: 'Encoding',
        icon: FileCode,
        run: (input) => btoa(input)
    },
    {
        id: 'from-base64',
        name: 'From Base64',
        description: 'Standard Base64 decoding.',
        category: 'Encoding',
        icon: FileCode,
        run: (input) => {
            try { return atob(input); } catch (e) { return "[Error: Invalid Base64]"; }
        }
    },

    // --- FORENSICS ---
    {
        id: 'detect-file-type',
        name: 'Detect File Type',
        description: 'Identify file format using Magic Bytes.',
        category: 'Forensics',
        icon: Shield,
        run: (input) => {
            const clean = input.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
            for (const item of FILE_SIGNATURES) {
                if (clean.substring(item.offset * 2).startsWith(item.sig)) {
                    return `MATCH: ${item.name} (Signature: ${item.sig.toUpperCase()})`;
                }
            }
            return "[!] Unknown File Signature";
        }
    }
];

