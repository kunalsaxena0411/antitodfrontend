
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

export const CyberChefView: React.FC<CyberChefViewProps> = ({ onNavigateToIntel }) => {
    // Persist recipe and input across unmounts/mounts
    const [input, setInput] = useState(() => localStorage.getItem('cyberchef_input') || '');
    const [recipe, setRecipe] = useState<RecipeStep[]>(() => {
        try {
            const saved = localStorage.getItem('cyberchef_recipe');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });

    const [output, setOutput] = useState('');
    const [isBaking, setIsBaking] = useState(false);
    const [isCookingAi, setIsCookingAi] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [copied, setCopied] = useState(false);
    const [autoBake, setAutoBake] = useState(true);
    const [forEachLine, setForEachLine] = useState(false);

    useEffect(() => {
        localStorage.setItem('cyberchef_input', input);
        localStorage.setItem('cyberchef_recipe', JSON.stringify(recipe));
    }, [input, recipe]);

    const bake = async () => {
        if (!input && recipe.length === 0) {
            setOutput('');
            return;
        }
        setIsBaking(true);
        
        try {
            const processData = async (data: string) => {
                let currentData = data;
                const registers: Record<string, string> = {};
                for (const step of recipe) {
                    if (step.disabled) continue;
                    const op = OPERATIONS.find(o => o.id === step.opId);
                    if (op) {
                        if (currentData.startsWith('IMAGE_DATA:')) {
                            if (op.id !== 'ai-ocr') {
                                currentData = "[Piping images to text-based operations is not supported. Use OCR first.]";
                                break;
                            }
                            currentData = currentData.replace('IMAGE_DATA:data:image/png;base64,', '');
                            const binary = atob(currentData);
                            currentData = Array.from(binary).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
                        }
                        currentData = await op.run(currentData, step.args, registers);
                    }
                }
                return currentData;
            };

            if (forEachLine) {
                const lines = input.split(/\r?\n/);
                const results = await Promise.all(lines.map(line => processData(line)));
                setOutput(results.join('\n'));
            } else {
                setOutput(await processData(input));
            }
        } catch (err) {
            setOutput(`[CRITICAL ERROR IN RECIPE CHAIN]`);
        } finally {
            setIsBaking(false);
        }
    };

    /**
     * Uses Gemini to suggest a recipe based on input patterns.
     * Fixed: Guideline adherence - removing invalid empty Type.OBJECT from responseSchema.
     * Relying on responseMimeType: 'application/json' for flexible argument structure.
     */
    const handleMagicWand = async () => {
        if (!input || isCookingAi) return;
        setIsCookingAi(true);

        try {
            const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `Analyze the following data for common cybersecurity obfuscation, encoding, or compression patterns (e.g. Base64, Hex, URL encoding, ROT13, etc.).
                
                Suggest a multi-step CyberChef recipe to decode/analyze it.
                Return ONLY a JSON array of operations.
                Valid operation IDs are: ${OPERATIONS.map(o => `'${o.id}'`).join(', ')}.
                
                Each object in the array must have:
                - "opId": The exact ID string from the list above.
                - "args": An object mapping argument names (if any) to values.
                
                Data to analyze (first 4KB):
                ${input.substring(0, 4000)}`,
                config: {
                    responseMimeType: "application/json",
                }
            });

            const suggestedSteps = JSON.parse(response.text);
            if (Array.isArray(suggestedSteps)) {
                const newSteps: RecipeStep[] = suggestedSteps.map(s => ({
                    id: crypto.randomUUID(),
                    opId: s.opId,
                    args: s.args || {}
                }));
                setRecipe(newSteps);
            }
        } catch (err) {
            console.error("Chef de Cuisine failed:", err);
        } finally {
            setIsCookingAi(false);
        }
    };

    useEffect(() => {
        if (autoBake) {
            const timer = setTimeout(bake, 400);
            return () => clearTimeout(timer);
        }
    }, [input, recipe, autoBake, forEachLine]);

    const addOp = (opId: string) => {
        const op = OPERATIONS.find(o => o.id === opId);
        const initialArgs: Record<string, any> = {};
        op?.args?.forEach(a => initialArgs[a.name] = a.default);
        setRecipe([...recipe, { id: crypto.randomUUID(), opId, args: initialArgs }]);
    };

    const updateArg = (stepId: string, argName: string, value: any) => {
        setRecipe(recipe.map(s => s.id === stepId ? { ...s, args: { ...s.args, [argName]: value } } : s));
    };

    const toggleStep = (id: string) => {
        setRecipe(recipe.map(s => s.id === id ? { ...s, disabled: !s.disabled } : s));
    };

    const removeStep = (id: string) => setRecipe(recipe.filter(s => s.id !== id));
    const clearRecipe = () => setRecipe([]);

    const handleCopy = () => {
        const textToCopy = output.startsWith('IMAGE_DATA:') ? output.split(',')[1] : output;
        navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const renderInteractiveOutput = (text: string) => {
        if (!text) return null;
        
        // Comprehensive IOC Regex: IPs, SHA256/MD5 Hashes, and valid Domains
        const iocRegex = /(\b(?:\d{1,3}\.){3}\d{1,3}\b|\b[a-f0-9]{64}\b|\b[a-f0-9]{32}\b|\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b)/gi;
        const parts = text.split(iocRegex);
        
        return parts.map((part, i) => {
            if (part && part.match(iocRegex)) {
                // Heuristic: check if this is likely a real domain or just an extension/random word
                const isDomain = part.includes('.');
                if (isDomain && part.length < 4) return part; // Ignore .js, .py, etc.

                return (
                    <button 
                        key={i}
                        onClick={() => onNavigateToIntel?.(part)}
                        className="text-blue-400 font-bold hover:text-cyber-cyan transition-colors px-0.5 rounded hover:bg-white/5 inline-flex items-center gap-1 group/ioc"
                        title={`Search Intelligence for: ${part}`}
                    >
                        {part}
                        <ExternalLink size={10} className="opacity-0 group-hover/ioc:opacity-100 transition-opacity"/>
                    </button>
                );
            }
            return part;
        });
    };

    const filteredOps = useMemo(() => {
        const lower = searchTerm.toLowerCase();
        return OPERATIONS.filter(op => 
            op.name.toLowerCase().includes(lower) || 
            op.category.toLowerCase().includes(lower) ||
            op.description.toLowerCase().includes(lower)
        );
    }, [searchTerm]);

    const categories: OpCategory[] = Array.from(new Set(OPERATIONS.map(o => o.category)));

    return (
        <div className="h-full flex bg-[#020617] text-gray-300 font-sans overflow-hidden">
            <div className="w-80 bg-black/40 border-r border-gray-800 flex flex-col shrink-0">
                <div className="p-4 border-b border-gray-800 bg-gray-900/10">
                    <h2 className="text-xs font-bold text-cyber-cyan uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Settings2 size={14}/> Operation Library
                    </h2>
                    <div className="relative group">
                        <Search className="absolute left-3 top-2.5 text-gray-500 group-focus-within:text-cyber-cyan transition-colors" size={16}/>
                        <input 
                            type="text" 
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg py-2 pl-10 pr-4 text-sm focus:border-cyber-cyan focus:outline-none focus:ring-1 focus:ring-cyber-cyan/30 transition-all font-mono"
                            placeholder="Search operations..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-4">
                    {categories.map(cat => {
                        const opsInCat = filteredOps.filter(o => o.category === cat);
                        if (opsInCat.length === 0) return null;
                        return (
                            <div key={cat}>
                                <div className="px-3 py-1 text-[10px] font-bold text-gray-600 uppercase tracking-tighter mb-1 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-700"></div> {cat}
                                </div>
                                <div className="space-y-1">
                                    {opsInCat.map(op => (
                                        <button 
                                            key={op.id}
                                            onClick={() => addOp(op.id)}
                                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors group text-left"
                                        >
                                            <div className="p-1.5 bg-gray-800 rounded border border-gray-700 group-hover:border-cyber-cyan/50 text-gray-500 group-hover:text-cyber-cyan transition-all">
                                                <op.icon size={14}/>
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-xs font-bold text-gray-300 group-hover:text-white truncate">{op.name}</div>
                                                <div className="text-[10px] text-gray-600 line-clamp-1">{op.description}</div>
                                            </div>
                                            <Plus size={14} className="ml-auto text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"/>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="w-96 bg-[#050b1a] border-r border-gray-800 flex flex-col shrink-0">
                <div className="p-4 border-b border-gray-800 bg-gray-900/20 flex items-center justify-between">
                    <h2 className="text-xs font-bold text-purple-400 uppercase tracking-widest flex items-center gap-2">
                        <Wand size={14}/> Tactical Recipe
                    </h2>
                    <div className="flex gap-3">
                        <button 
                            onClick={handleMagicWand}
                            disabled={!input || isCookingAi}
                            className={`p-1.5 rounded bg-purple-600/20 border border-purple-500/30 text-purple-400 hover:bg-purple-600/40 transition-all flex items-center gap-2 text-[10px] font-bold uppercase shadow-[0_0_10px_rgba(168,85,247,0.2)] ${isCookingAi ? 'animate-pulse cursor-wait' : ''}`}
                            title="Chef de Cuisine: AI Recipe Suggestion"
                        >
                            {isCookingAi ? <Loader2 className="animate-spin" size={12}/> : <Sparkles size={12}/>}
                            Magic Wand
                        </button>
                        <button 
                            onClick={clearRecipe}
                            className="text-[10px] font-bold text-red-400 hover:text-red-300 transition-colors uppercase"
                        >
                            Clear
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                    {recipe.map((step, index) => {
                        const op = OPERATIONS.find(o => o.id === step.opId);
                        if (!op) return null;
                        return (
                            <div key={step.id} className={`relative animate-fade-in ${step.disabled ? 'opacity-50 grayscale' : ''}`}>
                                {index < recipe.length - 1 && (
                                    <div className="absolute left-6 top-12 bottom-[-16px] w-0.5 bg-gray-800 z-0"></div>
                                )}
                                <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 relative z-10 hover:border-purple-500/50 transition-all group shadow-lg">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-6 h-6 flex items-center justify-center bg-gray-800 border border-gray-700 rounded-full text-[10px] font-bold text-gray-500 font-mono">
                                            {index + 1}
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-xs font-bold text-white uppercase tracking-wider">{op.name}</div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button 
                                                onClick={() => toggleStep(step.id)}
                                                className={`p-1 rounded hover:bg-white/5 transition-all ${step.disabled ? 'text-gray-600' : 'text-green-500'}`}
                                                title={step.disabled ? 'Enable Step' : 'Disable Step'}
                                            >
                                                {step.disabled ? <Play size={14}/> : <Pause size={14}/>}
                                            </button>
                                            <button 
                                                onClick={() => removeStep(step.id)}
                                                className="p-1 text-gray-600 hover:text-red-400 transition-all"
                                            >
                                                <X size={14}/>
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {op.args && op.args.length > 0 && !step.disabled && (
                                        <div className="space-y-3 pt-3 border-t border-gray-800">
                                            {op.args.map(arg => (
                                                <div key={arg.name}>
                                                    <label className="text-[10px] font-bold text-gray-600 uppercase mb-1 block">{arg.name}</label>
                                                    {arg.type === 'select' ? (
                                                        <select
                                                            className="w-full bg-black border border-gray-800 rounded px-2 py-1.5 text-xs text-cyber-cyan font-mono focus:border-cyber-cyan/50 outline-none"
                                                            value={step.args[arg.name]}
                                                            onChange={(e) => updateArg(step.id, arg.name, e.target.value)}
                                                        >
                                                            {arg.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                        </select>
                                                    ) : arg.type === 'toggle' ? (
                                                        <button 
                                                            onClick={() => updateArg(step.id, arg.name, !step.args[arg.name])}
                                                            className={`flex items-center gap-2 text-[10px] font-bold py-1 px-2 rounded border transition-colors ${step.args[arg.name] ? 'bg-cyber-cyan/20 border-cyber-cyan text-cyber-cyan' : 'bg-gray-800 border-gray-700 text-gray-500'}`}
                                                        >
                                                            {step.args[arg.name] ? 'ON' : 'OFF'}
                                                        </button>
                                                    ) : (
                                                        <input 
                                                            type={arg.type === 'number' ? 'number' : 'text'}
                                                            className="w-full bg-black border border-gray-800 rounded px-2 py-1.5 text-xs text-cyber-cyan font-mono focus:border-cyber-cyan/50 outline-none"
                                                            value={step.args[arg.name]}
                                                            onChange={(e) => updateArg(step.id, arg.name, e.target.value)}
                                                        />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {recipe.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-20 mt-10">
                            <Brackets size={48} className="mb-4 text-gray-500"/>
                            <p className="text-sm font-mono uppercase tracking-widest">Recipe Empty</p>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-800 bg-gray-900/40">
                    <button 
                        onClick={bake}
                        disabled={isBaking}
                        className={`w-full py-4 rounded-lg font-bold text-xs flex items-center justify-center gap-3 transition-all shadow-xl group ${isBaking ? 'bg-gray-800 text-gray-500' : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:scale-[1.02]'}`}
                    >
                        {isBaking ? <Loader2 className="animate-spin" size={16}/> : <Zap size={16} className="group-hover:animate-pulse" fill="currentColor"/>}
                        BAKE OUTPUT
                    </button>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                         <label className="flex items-center justify-center gap-2 px-2 py-1.5 rounded border border-gray-800 bg-black/40 cursor-pointer hover:border-gray-600 transition-colors">
                            <input type="checkbox" checked={autoBake} onChange={(e) => setAutoBake(e.target.checked)} className="w-3 h-3 accent-cyber-cyan"/>
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Auto-Bake</span>
                         </label>
                         <label className="flex items-center justify-center gap-2 px-2 py-1.5 rounded border border-gray-800 bg-black/40 cursor-pointer hover:border-gray-600 transition-colors">
                            <input type="checkbox" checked={forEachLine} onChange={(e) => setForEachLine(e.target.checked)} className="w-3 h-3 accent-purple-500"/>
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Line By Line</span>
                         </label>
                    </div>
                </div>
            </div>

            {/* COLUMN 3: INPUT / OUTPUT */}
            <div className="flex-1 flex flex-col bg-black/20">
                <div className="flex-1 flex flex-col min-h-0 border-b border-gray-800">
                    <div className="px-4 py-2 bg-gray-900/50 border-b border-gray-800 flex items-center justify-between shrink-0">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
                            <ArrowRight size={12}/> SOURCE BUFFER
                        </span>
                        <span className="text-[10px] text-gray-600 font-mono">LEN: {input.length.toLocaleString()}</span>
                    </div>
                    <textarea 
                        className="flex-1 w-full bg-transparent p-6 text-sm font-mono text-gray-300 focus:outline-none resize-none custom-scrollbar placeholder-gray-800"
                        placeholder="Paste data, hex bytes, or raw logs..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                    />
                </div>

                <div className="flex-1 flex flex-col min-h-0 relative">
                    <div className="px-4 py-2 bg-gray-900/50 border-b border-gray-800 flex items-center justify-between shrink-0">
                        <span className="text-[10px] font-bold text-cyber-cyan uppercase tracking-[0.2em] flex items-center gap-2">
                            <CheckCircle size={12}/> PROCESSED OUTPUT
                        </span>
                        <div className="flex gap-4">
                            <button onClick={handleCopy} className="text-[10px] font-bold text-gray-500 hover:text-white flex items-center gap-1.5 transition-colors uppercase">
                                {copied ? <Check size={12} className="text-green-500"/> : <Copy size={12}/>} {copied ? 'Copied' : 'Copy'}
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 relative overflow-auto custom-scrollbar p-6 bg-black/40">
                        {output.startsWith('IMAGE_DATA:') ? (
                            <div className="flex flex-col items-center justify-center gap-4 h-full">
                                <img src={output.split('IMAGE_DATA:')[1]} className="max-w-full max-h-[300px] rounded border border-gray-700 shadow-2xl" alt="Chef Render" />
                                <span className="text-[10px] text-gray-500 font-mono bg-gray-900 px-3 py-1 rounded border border-gray-800 uppercase tracking-widest">Rendered Image</span>
                            </div>
                        ) : (
                            <div 
                                className={`w-full h-full bg-transparent p-0 text-sm font-mono whitespace-pre-wrap break-all ${isBaking ? 'text-gray-700' : 'text-cyber-cyan'}`}
                            >
                                {renderInteractiveOutput(output)}
                                {!output && !isBaking && <span className="text-gray-700 italic">Awaiting recipe execution...</span>}
                            </div>
                        )}
                        {(isBaking || isCookingAi) && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px] pointer-events-none">
                                <div className="bg-gray-900/80 px-4 py-2 rounded border border-gray-700 text-xs font-bold text-cyber-cyan flex items-center gap-2 shadow-2xl animate-pulse">
                                    <RefreshCw size={14} className="animate-spin"/> {isCookingAi ? 'AI IS COOKING...' : 'BAKING...'}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const Loader2 = ({ className, size }: { className?: string, size?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>
);
