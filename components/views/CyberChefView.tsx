
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

export const CyberChefView: React.FC<CyberChefViewProps> = ({
    onNavigateToIntel,
}) => {
    const [input, setInput] = useState(
        () => localStorage.getItem('cyberchef_input') || ''
    );

    const [recipe, setRecipe] = useState<RecipeStep[]>(() => {
        try {
            const saved = localStorage.getItem('cyberchef_recipe');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    const [output, setOutput] = useState('');
    const [isBaking, setIsBaking] = useState(false);
    const [isCookingAi, setIsCookingAi] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [copied, setCopied] = useState(false);
    const [autoBake, setAutoBake] = useState(true);
    const [forEachLine, setForEachLine] = useState(false);
    const [activeCategory, setActiveCategory] = useState<OpCategory | 'All'>('All');

    useEffect(() => {
        localStorage.setItem('cyberchef_input', input);
        localStorage.setItem(
            'cyberchef_recipe',
            JSON.stringify(recipe)
        );
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

                    const op = OPERATIONS.find(
                        (operation) => operation.id === step.opId
                    );

                    if (!op) continue;

                    if (currentData.startsWith('IMAGE_DATA:')) {
                        if (op.id !== 'ai-ocr') {
                            currentData =
                                '[Piping images to text-based operations is not supported. Use OCR first.]';
                            break;
                        }

                        currentData = currentData.replace(
                            'IMAGE_DATA:data:image/png;base64,',
                            ''
                        );

                        const binary = atob(currentData);

                        currentData = Array.from(binary)
                            .map((char) =>
                                char
                                    .charCodeAt(0)
                                    .toString(16)
                                    .padStart(2, '0')
                            )
                            .join('');
                    }

                    currentData = await op.run(
                        currentData,
                        step.args,
                        registers
                    );
                }

                return currentData;
            };

            if (forEachLine) {
                const lines = input.split(/\r?\n/);

                const results = await Promise.all(
                    lines.map((line) => processData(line))
                );

                setOutput(results.join('\n'));
            } else {
                setOutput(await processData(input));
            }
        } catch (error) {
            console.error('CyberChef execution failed:', error);
            setOutput('[CRITICAL ERROR IN RECIPE CHAIN]');
        } finally {
            setIsBaking(false);
        }
    };

    const handleMagicWand = async () => {
        if (!input || isCookingAi) return;

        setIsCookingAi(true);

        try {
            const ai = new GoogleGenAI({
                apiKey: GEMINI_API_KEY,
            });

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `
Analyze the following data for common cybersecurity obfuscation,
encoding, or compression patterns.

Suggest a multi-step CyberChef recipe to decode or analyze it.

Return ONLY a JSON array of operations.

Valid operation IDs:
${OPERATIONS.map((operation) => `'${operation.id}'`).join(', ')}

Each object:
- "opId": exact operation ID
- "args": object with operation arguments

Data:
${input.substring(0, 4000)}
                `,
                config: {
                    responseMimeType: 'application/json',
                },
            });

            const suggestedSteps = JSON.parse(
                response.text
            );

            if (Array.isArray(suggestedSteps)) {
                const newSteps: RecipeStep[] =
                    suggestedSteps
                        .map((step: any) => ({
                            id: crypto.randomUUID(),
                            opId: step.opId,
                            args: step.args || {},
                        }))
                        .filter((step: RecipeStep) =>
                            OPERATIONS.some(
                                (operation) =>
                                    operation.id === step.opId
                            )
                        );

                setRecipe(newSteps);
            }
        } catch (error) {
            console.error(
                'CyberChef AI suggestion failed:',
                error
            );
        } finally {
            setIsCookingAi(false);
        }
    };

    useEffect(() => {
        if (!autoBake) return;

        const timer = window.setTimeout(() => {
            void bake();
        }, 400);

        return () => {
            window.clearTimeout(timer);
        };
    }, [
        input,
        recipe,
        autoBake,
        forEachLine,
    ]);

    const addOp = (opId: string) => {
        const op = OPERATIONS.find(
            (operation) => operation.id === opId
        );

        const initialArgs: Record<string, any> = {};

        op?.args?.forEach((argument) => {
            initialArgs[argument.name] =
                argument.default;
        });

        setRecipe((currentRecipe) => [
            ...currentRecipe,
            {
                id: crypto.randomUUID(),
                opId,
                args: initialArgs,
            },
        ]);

        setActiveCategory(
            op?.category || 'All'
        );
    };

    const updateArg = (
        stepId: string,
        argName: string,
        value: any
    ) => {
        setRecipe((currentRecipe) =>
            currentRecipe.map((step) =>
                step.id === stepId
                    ? {
                          ...step,
                          args: {
                              ...step.args,
                              [argName]: value,
                          },
                      }
                    : step
            )
        );
    };

    const toggleStep = (id: string) => {
        setRecipe((currentRecipe) =>
            currentRecipe.map((step) =>
                step.id === id
                    ? {
                          ...step,
                          disabled: !step.disabled,
                      }
                    : step
            )
        );
    };

    const removeStep = (id: string) => {
        setRecipe((currentRecipe) =>
            currentRecipe.filter(
                (step) => step.id !== id
            )
        );
    };

    const clearRecipe = () => {
        setRecipe([]);
        setOutput('');
    };

    const clearInput = () => {
        setInput('');
        setOutput('');
    };

    const handleCopy = async () => {
        if (!output) return;

        const textToCopy = output.startsWith(
            'IMAGE_DATA:'
        )
            ? output.split(',')[1]
            : output;

        try {
            await navigator.clipboard.writeText(
                textToCopy
            );

            setCopied(true);

            window.setTimeout(() => {
                setCopied(false);
            }, 2000);
        } catch (error) {
            console.error(
                'Clipboard copy failed:',
                error
            );
        }
    };

    const renderInteractiveOutput = (
        text: string
    ) => {
        if (!text) return null;

        const iocRegex =
            /(\b(?:\d{1,3}\.){3}\d{1,3}\b|\b[a-f0-9]{64}\b|\b[a-f0-9]{32}\b|\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b)/gi;

        const parts = text.split(iocRegex);

        return parts.map((part, index) => {
            if (
                part &&
                part.match(iocRegex)
            ) {
                const isDomain =
                    part.includes('.');

                if (
                    isDomain &&
                    part.length < 4
                ) {
                    return part;
                }

                return (
                    <button
                        key={index}
                        type="button"
                        onClick={() =>
                            onNavigateToIntel?.(
                                part
                            )
                        }
                        className="
                            cyberchef-ioc
                        "
                        title={`Search Intelligence for: ${part}`}
                    >
                        {part}
                        <ExternalLink size={10} />
                    </button>
                );
            }

            return part;
        });
    };

    const categories: OpCategory[] =
        Array.from(
            new Set(
                OPERATIONS.map(
                    (operation) =>
                        operation.category
                )
            )
        );

    const filteredOps = useMemo(() => {
        const lower =
            searchTerm
                .trim()
                .toLowerCase();

        return OPERATIONS.filter((operation) => {
            const matchesSearch =
                !lower ||
                operation.name
                    .toLowerCase()
                    .includes(lower) ||
                operation.category
                    .toLowerCase()
                    .includes(lower) ||
                operation.description
                    .toLowerCase()
                    .includes(lower);

            const matchesCategory =
                activeCategory === 'All' ||
                operation.category ===
                    activeCategory;

            return (
                matchesSearch &&
                matchesCategory
            );
        });
    }, [searchTerm, activeCategory]);

    const activeRecipeCount =
        recipe.filter(
            (step) => !step.disabled
        ).length;

    return (
        <div className="cyberchef-page">

            {/* =========================================================
                OPERATION LIBRARY
               ========================================================= */}

            <aside className="cyberchef-library">

                <div className="cyberchef-library-header">

                    <div className="cyberchef-section-title">
                        <span className="cyberchef-section-icon">
                            <Settings2 size={14} />
                        </span>

                        <div>
                            <span className="cyberchef-eyebrow">
                                TOOLS
                            </span>

                            <strong>
                                Operations
                            </strong>
                        </div>
                    </div>

                    <span className="cyberchef-count">
                        {OPERATIONS.length}
                    </span>
                </div>

                <div className="cyberchef-search-wrap">

                    <Search
                        size={14}
                        className="cyberchef-search-icon"
                    />

                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(event) =>
                            setSearchTerm(
                                event.target.value
                            )
                        }
                        placeholder="Search operations..."
                        className="cyberchef-search"
                    />
                </div>

                <div className="cyberchef-category-scroll">

                    <button
                        type="button"
                        className={`
                            cyberchef-category-chip
                            ${
                                activeCategory ===
                                'All'
                                    ? 'active'
                                    : ''
                            }
                        `}
                        onClick={() =>
                            setActiveCategory('All')
                        }
                    >
                        All
                    </button>

                    {categories.map(
                        (category) => (
                            <button
                                key={category}
                                type="button"
                                className={`
                                    cyberchef-category-chip
                                    ${
                                        activeCategory ===
                                        category
                                            ? 'active'
                                            : ''
                                    }
                                `}
                                onClick={() =>
                                    setActiveCategory(
                                        category
                                    )
                                }
                            >
                                {category}
                            </button>
                        )
                    )}

                </div>

                <div className="cyberchef-library-list custom-scrollbar">

                    {categories.map(
                        (category) => {
                            const opsInCategory =
                                filteredOps.filter(
                                    (operation) =>
                                        operation.category ===
                                        category
                                );

                            if (
                                opsInCategory.length ===
                                0
                            ) {
                                return null;
                            }

                            return (
                                <section
                                    key={category}
                                    className="cyberchef-operation-group"
                                >

                                    <div className="cyberchef-group-heading">
                                        <span>
                                            {category}
                                        </span>

                                        <span className="cyberchef-group-count">
                                            {opsInCategory.length}
                                        </span>
                                    </div>

                                    <div className="cyberchef-operation-list">

                                        {opsInCategory.map(
                                            (operation) => {
                                                const Icon =
                                                    operation.icon;

                                                return (
                                                    <button
                                                        key={operation.id}
                                                        type="button"
                                                        className="cyberchef-operation"
                                                        onClick={() =>
                                                            addOp(
                                                                operation.id
                                                            )
                                                        }
                                                    >
                                                        <span className="cyberchef-operation-icon">
                                                            <Icon
                                                                size={15}
                                                            />
                                                        </span>

                                                        <span className="cyberchef-operation-content">

                                                            <span className="cyberchef-operation-name">
                                                                {
                                                                    operation.name
                                                                }
                                                            </span>

                                                            <span className="cyberchef-operation-description">
                                                                {
                                                                    operation.description
                                                                }
                                                            </span>

                                                        </span>

                                                        <span className="cyberchef-operation-add">
                                                            <Plus
                                                                size={13}
                                                            />
                                                        </span>
                                                    </button>
                                                );
                                            }
                                        )}

                                    </div>
                                </section>
                            );
                        }
                    )}

                    {filteredOps.length === 0 && (
                        <div className="cyberchef-empty-library">
                            <Search size={22} />
                            <strong>
                                No operations found
                            </strong>
                            <span>
                                Try another search.
                            </span>
                        </div>
                    )}

                </div>
            </aside>

            {/* =========================================================
                RECIPE
               ========================================================= */}

            <section className="cyberchef-recipe">

                <header className="cyberchef-recipe-header">

                    <div>
                        <div className="cyberchef-section-title">

                            <span className="cyberchef-section-icon">
                                <Wand size={14} />
                            </span>

                            <div>
                                <span className="cyberchef-eyebrow">
                                    WORKFLOW
                                </span>

                                <strong>
                                    Tactical Recipe
                                </strong>
                            </div>
                        </div>

                        <div className="cyberchef-recipe-meta">
                            <span>
                                {recipe.length} STEP
                                {recipe.length !==
                                1
                                    ? 'S'
                                    : ''}
                            </span>

                            <span className="separator">
                                â€¢
                            </span>

                            <span
                                className={
                                    activeRecipeCount >
                                    0
                                        ? 'ready'
                                        : ''
                                }
                            >
                                {activeRecipeCount >
                                0
                                    ? 'READY'
                                    : 'EMPTY'}
                            </span>
                        </div>
                    </div>

                    <div className="cyberchef-recipe-actions">

                        <button
                            type="button"
                            className="cyberchef-secondary-button"
                            onClick={
                                handleMagicWand
                            }
                            disabled={
                                !input ||
                                isCookingAi
                            }
                        >
                            {isCookingAi ? (
                                <Loader2
                                    size={13}
                                    className="animate-spin"
                                />
                            ) : (
                                <Sparkles
                                    size={13}
                                />
                            )}

                            {isCookingAi
                                ? 'ANALYZING'
                                : 'AI SUGGEST'}
                        </button>

                        <button
                            type="button"
                            className="cyberchef-quiet-button"
                            onClick={
                                clearRecipe
                            }
                            disabled={
                                recipe.length ===
                                0
                            }
                        >
                            CLEAR
                        </button>
                    </div>

                </header>

                <div className="cyberchef-recipe-body custom-scrollbar">

                    {recipe.length === 0 ? (
                        <div className="cyberchef-empty-recipe">

                            <div className="cyberchef-empty-recipe-icon">
                                <Plus size={20} />
                            </div>

                            <strong>
                                Build your recipe
                            </strong>

                            <span>
                                Select operations from
                                the library to create
                                an analysis pipeline.
                            </span>

                            <small>
                                Steps execute from top
                                to bottom.
                            </small>

                        </div>
                    ) : (
                        <div className="cyberchef-steps">

                            {recipe.map(
                                (
                                    step,
                                    index
                                ) => {
                                    const operation =
                                        OPERATIONS.find(
                                            (item) =>
                                                item.id ===
                                                step.opId
                                        );

                                    if (
                                        !operation
                                    ) {
                                        return null;
                                    }

                                    const Icon =
                                        operation.icon;

                                    return (
                                        <React.Fragment
                                            key={
                                                step.id
                                            }
                                        >

                                            <article
                                                className={`
                                                    cyberchef-step
                                                    ${
                                                        step.disabled
                                                            ? 'disabled'
                                                            : ''
                                                    }
                                                `}
                                            >

                                                <div className="cyberchef-step-header">

                                                    <div className="cyberchef-step-index">
                                                        {String(
                                                            index +
                                                                1
                                                        ).padStart(
                                                            2,
                                                            '0'
                                                        )}
                                                    </div>

                                                    <div className="cyberchef-step-icon">
                                                        <Icon
                                                            size={
                                                                14
                                                            }
                                                        />
                                                    </div>

                                                    <div className="cyberchef-step-heading">

                                                        <span className="cyberchef-eyebrow">
                                                            {
                                                                operation.category
                                                            }
                                                        </span>

                                                        <strong>
                                                            {
                                                                operation.name
                                                            }
                                                        </strong>

                                                    </div>

                                                    <div className="cyberchef-step-actions">

                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                toggleStep(
                                                                    step.id
                                                                )
                                                            }
                                                            title={
                                                                step.disabled
                                                                    ? 'Enable step'
                                                                    : 'Disable step'
                                                            }
                                                            className={
                                                                step.disabled
                                                                    ? 'muted'
                                                                    : 'active'
                                                            }
                                                        >
                                                            {step.disabled ? (
                                                                <Play
                                                                    size={
                                                                        13
                                                                    }
                                                                />
                                                            ) : (
                                                                <Pause
                                                                    size={
                                                                        13
                                                                    }
                                                                />
                                                            )}
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                removeStep(
                                                                    step.id
                                                                )
                                                            }
                                                            title="Remove step"
                                                            className="danger"
                                                        >
                                                            <X
                                                                size={
                                                                    13
                                                                }
                                                            />
                                                        </button>

                                                    </div>

                                                </div>

                                                {operation.args &&
                                                    operation
                                                        .args
                                                        .length >
                                                        0 &&
                                                    !step.disabled && (
                                                        <div className="cyberchef-step-settings">

                                                            {operation.args.map(
                                                                (
                                                                    argument
                                                                ) => (
                                                                    <div
                                                                        key={
                                                                            argument.name
                                                                        }
                                                                        className="cyberchef-field"
                                                                    >

                                                                        <label>
                                                                            {
                                                                                argument.name
                                                                            }
                                                                        </label>

                                                                        {argument.type ===
                                                                        'select' ? (
                                                                            <select
                                                                                value={
                                                                                    step
                                                                                        .args[
                                                                                        argument.name
                                                                                    ]
                                                                                }
                                                                                onChange={(
                                                                                    event
                                                                                ) =>
                                                                                    updateArg(
                                                                                        step.id,
                                                                                        argument.name,
                                                                                        event
                                                                                            .target
                                                                                            .value
                                                                                    )
                                                                                }
                                                                            >
                                                                                {argument.options?.map(
                                                                                    (
                                                                                        option
                                                                                    ) => (
                                                                                        <option
                                                                                            key={
                                                                                                option
                                                                                            }
                                                                                            value={
                                                                                                option
                                                                                            }
                                                                                        >
                                                                                            {
                                                                                                option
                                                                                            }
                                                                                        </option>
                                                                                    )
                                                                                )}
                                                                            </select>
                                                                        ) : argument.type ===
                                                                          'toggle' ? (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    updateArg(
                                                                                        step.id,
                                                                                        argument.name,
                                                                                        !step
                                                                                            .args[
                                                                                            argument.name
                                                                                        ]
                                                                                    )
                                                                                }
                                                                                className={`
                                                                                    cyberchef-inline-toggle
                                                                                    ${
                                                                                        step
                                                                                            .args[
                                                                                            argument.name
                                                                                        ]
                                                                                            ? 'active'
                                                                                            : ''
                                                                                    }
                                                                                `}
                                                                            >
                                                                                {
                                                                                    step
                                                                                        .args[
                                                                                        argument.name
                                                                                    ]
                                                                                        ? 'ON'
                                                                                        : 'OFF'
                                                                                }
                                                                            </button>
                                                                        ) : (
                                                                            <input
                                                                                type={
                                                                                    argument.type ===
                                                                                    'number'
                                                                                        ? 'number'
                                                                                        : 'text'
                                                                                }
                                                                                value={
                                                                                    step
                                                                                        .args[
                                                                                        argument.name
                                                                                    ]
                                                                                }
                                                                                onChange={(
                                                                                    event
                                                                                ) =>
                                                                                    updateArg(
                                                                                        step.id,
                                                                                        argument.name,
                                                                                        argument.type ===
                                                                                        'number'
                                                                                            ? Number(
                                                                                                  event
                                                                                                      .target
                                                                                                      .value
                                                                                              )
                                                                                            : event
                                                                                                  .target
                                                                                                  .value
                                                                                    )
                                                                                }
                                                                            />
                                                                        )}

                                                                    </div>
                                                                )
                                                            )}

                                                        </div>
                                                    )}

                                            </article>

                                            {index <
                                                recipe.length -
                                                    1 && (
                                                <div className="cyberchef-step-connector">
                                                    <span>
                                                        â†“
                                                    </span>
                                                </div>
                                            )}

                                        </React.Fragment>
                                    );
                                }
                            )}

                        </div>
                    )}

                </div>

                <footer className="cyberchef-recipe-footer">

                    <button
                        type="button"
                        className={`
                            cyberchef-run-button
                            ${
                                isBaking
                                    ? 'running'
                                    : ''
                            }
                        `}
                        onClick={bake}
                        disabled={isBaking}
                    >
                        {isBaking ? (
                            <Loader2
                                size={15}
                                className="animate-spin"
                            />
                        ) : (
                            <Zap
                                size={15}
                                fill="currentColor"
                            />
                        )}

                        {isBaking
                            ? 'RUNNING RECIPE'
                            : 'RUN RECIPE'}
                    </button>

                    <div className="cyberchef-toggle-grid">

                        <label className="cyberchef-toggle-control">
                            <span>
                                AUTO-BAKE
                            </span>

                            <input
                                type="checkbox"
                                checked={
                                    autoBake
                                }
                                onChange={(
                                    event
                                ) =>
                                    setAutoBake(
                                        event.target
                                            .checked
                                    )
                                }
                            />

                            <span className="cyberchef-switch" />
                        </label>

                        <label className="cyberchef-toggle-control">
                            <span>
                                LINE BY LINE
                            </span>

                            <input
                                type="checkbox"
                                checked={
                                    forEachLine
                                }
                                onChange={(
                                    event
                                ) =>
                                    setForEachLine(
                                        event.target
                                            .checked
                                    )
                                }
                            />

                            <span className="cyberchef-switch" />
                        </label>

                    </div>

                </footer>
            </section>

            {/* =========================================================
                SOURCE / OUTPUT
               ========================================================= */}

            <section className="cyberchef-workspace">

                <article className="cyberchef-io-panel">

                    <header className="cyberchef-io-header">

                        <div className="cyberchef-io-title">
                            <span className="cyberchef-io-icon">
                                <ArrowRight
                                    size={13}
                                />
                            </span>

                            <div>
                                <span className="cyberchef-eyebrow">
                                    INPUT
                                </span>

                                <strong>
                                    Source Buffer
                                </strong>
                            </div>
                        </div>

                        <div className="cyberchef-io-actions">

                            <span>
                                {input.length.toLocaleString()}{' '}
                                BYTES
                            </span>

                            {input && (
                                <button
                                    type="button"
                                    onClick={
                                        clearInput
                                    }
                                    title="Clear input"
                                >
                                    <X size={13} />
                                </button>
                            )}

                        </div>

                    </header>

                    <textarea
                        value={input}
                        onChange={(event) =>
                            setInput(
                                event.target.value
                            )
                        }
                        placeholder="Paste data, hex bytes, encoded content, logs..."
                        className="cyberchef-source-editor custom-scrollbar"
                    />

                </article>

                <article className="cyberchef-io-panel">

                    <header className="cyberchef-io-header">

                        <div className="cyberchef-io-title">

                            <span className="cyberchef-io-icon result">
                                <CheckCircle
                                    size={13}
                                />
                            </span>

                            <div>
                                <span className="cyberchef-eyebrow">
                                    RESULT
                                </span>

                                <strong>
                                    Processed Output
                                </strong>
                            </div>

                        </div>

                        <div className="cyberchef-io-actions">

                            {output && (
                                <button
                                    type="button"
                                    onClick={
                                        handleCopy
                                    }
                                    className="cyberchef-copy-button"
                                >
                                    {copied ? (
                                        <Check
                                            size={13}
                                        />
                                    ) : (
                                        <Copy
                                            size={13}
                                        />
                                    )}

                                    {copied
                                        ? 'COPIED'
                                        : 'COPY'}
                                </button>
                            )}

                        </div>

                    </header>

                    <div className="cyberchef-output custom-scrollbar">

                        {output.startsWith(
                            'IMAGE_DATA:'
                        ) ? (
                            <div className="cyberchef-output-image">
                                <img
                                    src={
                                        output.split(
                                            'IMAGE_DATA:'
                                        )[1]
                                    }
                                    alt="Processed result"
                                />

                                <span>
                                    RENDERED IMAGE
                                </span>
                            </div>
                        ) : (
                            <>
                                {!output &&
                                    !isBaking && (
                                        <div className="cyberchef-output-empty">
                                            <FileSearch
                                                size={24}
                                            />

                                            <strong>
                                                Awaiting execution
                                            </strong>

                                            <span>
                                                Add operations
                                                to the recipe
                                                and run it to
                                                inspect the
                                                result.
                                            </span>
                                        </div>
                                    )}

                                {output && (
                                    <div
                                        className={`
                                            cyberchef-output-text
                                            ${
                                                isBaking
                                                    ? 'processing'
                                                    : ''
                                            }
                                        `}
                                    >
                                        {renderInteractiveOutput(
                                            output
                                        )}
                                    </div>
                                )}
                            </>
                        )}

                        {(isBaking ||
                            isCookingAi) && (
                            <div className="cyberchef-processing">

                                <div className="cyberchef-processing-card">
                                    <RefreshCw
                                        size={14}
                                        className="animate-spin"
                                    />

                                    <span>
                                        {isCookingAi
                                            ? 'AI IS ANALYZING THE INPUT'
                                            : 'RUNNING RECIPE'}
                                    </span>
                                </div>

                            </div>
                        )}

                    </div>

                </article>

            </section>
        </div>
    );
};

const Loader2 = ({ className, size }: { className?: string, size?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>
);
