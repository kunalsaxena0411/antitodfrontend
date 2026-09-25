
import { MalpediaActor, GraphData, NodeType, GraphNode, GraphLink } from '../types';

export interface MitreTechnique {
    id: string; // T1234
    stixId: string;
    name: string;
    description: string;
    platforms: string[];
    tactics: string[]; // slugs
    isSubTechnique: boolean;
    url?: string;
}

export interface MitreMatrix {
    tactics: { slug: string; name: string }[]; 
    techniques: Record<string, MitreTechnique[]>; 
}

// Shared Cache for the large raw JSON to prevent multiple network requests
let cachedRawBundle: any = null;
let cachedMatrix: MitreMatrix | null = null;

const fetchRawMitreData = async (): Promise<any> => {
    if (cachedRawBundle) return cachedRawBundle;
    
    const sources = [
        'https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json',
        'https://cdn.jsdelivr.net/gh/mitre/cti@master/enterprise-attack/enterprise-attack.json',
        'https://corsproxy.io/?https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json'
    ];

    for (const url of sources) {
        try {
            const response = await fetch(url);
            if (!response.ok) continue;
            cachedRawBundle = await response.json();
            return cachedRawBundle;
        } catch (error) {
            // Try next source
        }
    }
    
    throw new Error("Failed to fetch MITRE data from all available sources.");
};

export const getMitreMatrix = async (): Promise<MitreMatrix> => {
    if (cachedMatrix) return cachedMatrix;

    const bundle = await fetchRawMitreData();
    const objects = bundle.objects as any[];

    // 1. Extract Tactics
    const TACTIC_ORDER = [
        "reconnaissance", "resource-development", "initial-access", "execution", "persistence", 
        "privilege-escalation", "defense-evasion", "credential-access", "discovery", 
        "lateral-movement", "collection", "command-and-control", "exfiltration", "impact"
    ];

    const tacticsMap = new Map<string, string>();
    objects.filter(o => o.type === 'x-mitre-tactic').forEach(t => {
        tacticsMap.set(t.x_mitre_shortname, t.name);
    });

    const tactics = TACTIC_ORDER.map(slug => ({
        slug,
        name: tacticsMap.get(slug) || slug.replace(/-/g, ' ').toUpperCase() // Fallback name
    }));

    // 2. Extract Techniques
    const techniques: Record<string, MitreTechnique[]> = {};
    TACTIC_ORDER.forEach(t => techniques[t] = []);

    objects.filter(o => o.type === 'attack-pattern' && !o.revoked && !o.x_mitre_deprecated).forEach(ap => {
        const mitreRef = ap.external_references?.find((r: any) => r.source_name === 'mitre-attack');
        const id = mitreRef?.external_id;
        
        if (!id) return;

        const technique: MitreTechnique = {
            id,
            stixId: ap.id,
            name: ap.name,
            description: ap.description || '',
            platforms: ap.x_mitre_platforms || [],
            tactics: ap.kill_chain_phases?.map((p: any) => p.phase_name) || [],
            isSubTechnique: ap.x_mitre_is_subtechnique || false,
            url: mitreRef.url
        };

        technique.tactics.forEach(tSlug => {
            if (techniques[tSlug]) {
                techniques[tSlug].push(technique);
            }
        });
    });

    cachedMatrix = { tactics, techniques };
    return cachedMatrix;
};

interface StixObject {
    type: string;
    id: string;
    name?: string;
    description?: string;
    aliases?: string[];
    external_references?: {
        source_name: string;
        external_id?: string;
        url?: string;
    }[];
    x_mitre_version?: string;
    kill_chain_phases?: {
        kill_chain_name: string;
        phase_name: string;
    }[];
    // Relationships
    source_ref?: string;
    target_ref?: string;
    relationship_type?: string;
    // Sighting
    sighting_of_ref?: string;
    where_sighted_refs?: string[];
    // Generic
    value?: string;
    pattern?: string;
}

export const processMitreBundle = (bundle: any): MalpediaActor[] => {
    if (!bundle.objects || !Array.isArray(bundle.objects)) {
        throw new Error("Invalid STIX Bundle format");
    }

    if (!cachedRawBundle) cachedRawBundle = bundle;

    const objects = bundle.objects as StixObject[];
    
    const groups = objects.filter(o => o.type === 'intrusion-set');
    
    const techniqueMap = new Map<string, string>(); 
    const techniqueInfo = new Map<string, { name: string, tactic: string, description: string }>(); 

    objects.filter(o => o.type === 'attack-pattern').forEach(ap => {
        const mitreRef = ap.external_references?.find(r => r.source_name === 'mitre-attack');
        if (mitreRef?.external_id) {
            techniqueMap.set(ap.id, mitreRef.external_id);
            
            let tactic = 'General';
            if (ap.kill_chain_phases && ap.kill_chain_phases.length > 0) {
                const phase = ap.kill_chain_phases.find(p => p.kill_chain_name === 'mitre-attack') || ap.kill_chain_phases[0];
                tactic = phase.phase_name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            }

            techniqueInfo.set(mitreRef.external_id, {
                name: ap.name || 'Unknown Technique',
                tactic: tactic,
                description: ap.description || ''
            });
        }
    });

    const groupTTPs = new Map<string, Set<string>>(); 
    
    objects.filter(o => o.type === 'relationship' && o.relationship_type === 'uses').forEach(rel => {
        if (rel.source_ref && rel.target_ref) {
            const techId = techniqueMap.get(rel.target_ref);
            if (techId) {
                if (!groupTTPs.has(rel.source_ref)) {
                    groupTTPs.set(rel.source_ref, new Set());
                }
                groupTTPs.get(rel.source_ref)?.add(techId);
            }
        }
    });

    const actors: MalpediaActor[] = [];

    groups.forEach((g: StixObject) => {
        const name = g.name || 'Unknown Group';
        const description = g.description || '';
        const aliases = g.aliases || [];
        const refs = g.external_references?.map(r => r.url).filter(u => !!u) as string[] || [];
        const mitreId = g.external_references?.find(r => r.source_name === 'mitre-attack')?.external_id;

        const relatedTTPs = groupTTPs.get(g.id);
        const techniqueIds = relatedTTPs ? Array.from(relatedTTPs).sort() : [];

        if (techniqueIds.length === 0) {
            const mitreRegex = /T\d{4}(?:\.\d{3})?/g;
            const foundMitre = (description.match(mitreRegex) || []) as string[];
            foundMitre.forEach(m => techniqueIds.push(m));
        }
        const uniqueMitre = Array.from(new Set(techniqueIds)).sort();

        const ttpDetails = uniqueMitre.map(id => {
            const info = techniqueInfo.get(id);
            return {
                id,
                name: info?.name || id,
                tactic: info?.tactic || 'Uncategorized',
                description: info?.description
            };
        }).sort((a, b) => a.tactic.localeCompare(b.tactic));

        const lowerDesc = description.toLowerCase();

        let activityScore = Math.min((refs.length * 1.5) + (aliases.length * 3), 30);
        if (refs.length > 15) activityScore = 30; 

        let capabilityScore = 0;
        capabilityScore += Math.min(uniqueMitre.length * 0.5, 20);

        if (/zero-day|0-day|supply chain/.test(lowerDesc)) capabilityScore += 10;
        if (/rootkit|bootkit|uefi|firmware/.test(lowerDesc)) capabilityScore += 10;
        if (/custom malware|proprietary tool|modular/.test(lowerDesc)) capabilityScore += 5;
        if (/living off the land|fileless/.test(lowerDesc)) capabilityScore += 5;
        capabilityScore = Math.min(capabilityScore, 40);

        let impactScore = 0;
        const critKeywords = ['critical infrastructure', 'energy', 'nuclear', 'power grid', 'military', 'defense'];
        const highKeywords = ['government', 'finance', 'banking', 'telecom', 'healthcare', 'elections', 'espionage', 'exfiltration'];
        const destructiveKeywords = ['ransomware', 'wiper', 'destruction', 'sabotage'];

        critKeywords.forEach(k => { if(lowerDesc.includes(k)) impactScore += 10; });
        highKeywords.forEach(k => { if(lowerDesc.includes(k)) impactScore += 5; });
        destructiveKeywords.forEach(k => { if(lowerDesc.includes(k)) impactScore += 5; });
        impactScore = Math.min(impactScore, 30);

        const totalScore = Math.min(activityScore + capabilityScore + impactScore, 100);

        let sophistication: MalpediaActor['sophistication'] = 'Low';
        if (totalScore >= 80) sophistication = 'Critical';
        else if (totalScore >= 60) sophistication = 'High';
        else if (totalScore >= 40) sophistication = 'Medium';

        const familyRegex = /(?:malware|trojan|backdoor|ransomware|loader|stealer)(?:\s+(?:known\s+as|called|named))?\s+([A-Z][a-zA-Z0-9\-\_]{2,})/g;
        const foundFamilies = new Set<string>();
        let match;
        const stopWords = ['The', 'A', 'An', 'This', 'Unknown', 'Custom', 'Malicious', 'Generic', 'Multiple', 'Target', 'Recent'];
        while ((match = familyRegex.exec(description)) !== null) {
             if (!stopWords.includes(match[1]) && isNaN(Number(match[1]))) {
                 foundFamilies.add(match[1]);
             }
        }

        actors.push({
            value: name,
            description: description,
            uuid: g.id,
            threatScore: totalScore,
            sophistication: sophistication,
            scoreBreakdown: {
                activityScore,
                capabilityScore,
                impactScore
            },
            meta: {
                country: 'Unknown', 
                refs: refs,
                synonyms: aliases
            },
            mitreIds: uniqueMitre,
            malwareFamilies: Array.from(foundFamilies).sort(),
            source: 'MITRE',
            mitreAttackId: mitreId,
            ttpDetails: ttpDetails
        });
    });

    return actors;
};

export const parseMitreStix = async (file: File): Promise<MalpediaActor[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const bundle = JSON.parse(text);
                const actors = processMitreBundle(bundle);
                resolve(actors);
            } catch (err) {
                console.error("MITRE Parse Error", err);
                reject(new Error("Failed to parse MITRE STIX JSON"));
            }
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsText(file);
    });
};

export const fetchMitreFromSource = async (): Promise<MalpediaActor[]> => {
    try {
        const bundle = await fetchRawMitreData();
        return processMitreBundle(bundle);
    } catch (error) {
        console.error("MITRE Fetch Error", error);
        throw error;
    }
};

// --- STIX Graph Converter ---

export const convertStixToGraph = (input: any): GraphData => {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    
    let objects: any[] = [];
    
    // Robust STIX Input Handling
    if (Array.isArray(input)) {
        objects = input;
    } else if (input && input.objects && Array.isArray(input.objects)) {
        objects = input.objects;
    } else if (input && input.type === 'bundle' && Array.isArray(input.objects)) {
        objects = input.objects;
    } else if (input && input.type && input.id) {
        objects = [input];
    } else if (typeof input === 'object') {
        // Try to extract objects if keys map to arrays (some generic exports)
        Object.values(input).forEach(val => {
            if (Array.isArray(val) && val.length > 0 && (val[0].type || val[0].id)) {
                objects = objects.concat(val);
            }
        });
    }

    if (objects.length === 0) return { nodes, links };

    const nodeSet = new Set<string>();

    // Helper to map STIX type to Visual Type & Color
    const mapType = (stixType: string): { type: NodeType, color: string, val: number } => {
        const t = stixType ? stixType.toLowerCase() : 'unknown';
        switch(t) {
            case 'intrusion-set': 
            case 'threat-actor':
                return { type: 'STIX_ACTOR', color: '#fb923c', val: 15 }; // Orange
            case 'malware': 
            case 'malware-analysis':
                return { type: 'STIX_MALWARE', color: '#ef4444', val: 12 }; // Red
            case 'tool': 
            case 'attack-pattern':
            case 'course-of-action':
                return { type: 'STIX_TOOL', color: '#a855f7', val: 10 }; // Purple
            case 'campaign': 
                return { type: 'STIX_CAMPAIGN', color: '#e879f9', val: 14 }; // Pink
            case 'indicator': 
            case 'observed-data':
            case 'ipv4-addr':
            case 'domain-name':
            case 'url':
            case 'file':
            case 'x-custom':
                return { type: 'STIX_INDICATOR', color: '#22c55e', val: 8 }; // Green
            case 'vulnerability': 
                return { type: 'STIX_VULN', color: '#facc15', val: 10 }; // Yellow
            case 'identity': 
            case 'location':
                return { type: 'STIX_IDENTITY', color: '#94a3b8', val: 10 }; // Gray
            default: 
                return { type: 'ROOT', color: '#6b7280', val: 8 }; // Generic Gray (ROOT fallback)
        }
    };

    objects.forEach(obj => {
        if (!obj.type && !obj.id) return;
        
        const objType = obj.type || 'unknown';

        if (objType === 'relationship') {
            if (obj.source_ref && obj.target_ref) {
                links.push({
                    source: obj.source_ref,
                    target: obj.target_ref,
                    label: obj.relationship_type || 'related-to',
                    color: '#4b5563'
                });
            }
        } else if (objType === 'sighting') {
             if (obj.sighting_of_ref && obj.where_sighted_refs) {
                 obj.where_sighted_refs.forEach((ref: string) => {
                     links.push({
                         source: ref,
                         target: obj.sighting_of_ref,
                         label: 'sighting',
                         color: '#9ca3af'
                     });
                 });
             }
        } else {
            // It's a Node
            const config = mapType(objType);
            
            if (!nodeSet.has(obj.id)) {
                // Intelligent Labeling
                const label = obj.name || obj.value || obj.pattern || obj.id || objType;
                
                nodes.push({
                    id: obj.id,
                    label: label.length > 40 ? label.substring(0, 37) + '...' : label,
                    type: config.type,
                    color: config.color,
                    val: config.val,
                    data: obj 
                });
                nodeSet.add(obj.id);
            }
        }
    });

    // Filter links where source or target nodes don't exist
    // (STIX bundles can be partial)
    const validLinks = links.filter(l => nodeSet.has(l.source as string) && nodeSet.has(l.target as string));

    return { nodes, links: validLinks };
};
