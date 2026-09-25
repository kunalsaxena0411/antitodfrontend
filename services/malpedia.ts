
import { MalpediaEntry, MalpediaActor } from '../types';

// Helper to calculate score based on description analysis
const calculateThreatScore = (description: string, refs: string[], synonyms: string[]) => {
    // ... (keep existing helper logic) ...
    const lowerDesc = description.toLowerCase();
    
    let activityScore = Math.min((refs.length * 1.5) + (synonyms.length * 2.5), 20);
    if (refs.length > 10) activityScore += 5;
    if (synonyms.length > 5) activityScore += 5;
    activityScore = Math.min(activityScore, 30);

    let capabilityScore = 0;
    const highCapKeywords = ['zero-day', '0-day', 'supply chain', 'rootkit', 'bootkit', 'firmware', 'uefi', 'air-gapped', 'custom protocol', 'bespoke malware', 'modular framework'];
    const medCapKeywords = ['living off the land', 'lotl', 'fileless', 'obfuscated', 'encrypted c2', 'steganography', 'lateral movement', 'domain controller', 'apt', 'state-sponsored', 'proprietary tool'];
    const lowCapKeywords = ['phishing', 'macro', 'commodity malware', 'brute force', 'credential stuffing'];

    highCapKeywords.forEach(k => { if(lowerDesc.includes(k)) capabilityScore += 10; });
    medCapKeywords.forEach(k => { if(lowerDesc.includes(k)) capabilityScore += 5; });
    lowCapKeywords.forEach(k => { if(lowerDesc.includes(k)) capabilityScore += 2; });
    capabilityScore = Math.min(capabilityScore, 40);
    if (capabilityScore === 0 && description.length > 50) capabilityScore = 10;

    let impactScore = 0;
    const criticalTargets = ['critical infrastructure', 'energy', 'nuclear', 'power grid', 'military', 'defense', 'national security', 'scada', 'ics'];
    const highTargets = ['government', 'ministry', 'embassy', 'finance', 'banking', 'swift', 'healthcare', 'hospital', 'telecom', 'backbone'];
    const destructiveActions = ['ransomware', 'double extortion', 'wiper', 'destruction', 'sabotage', 'espionage', 'exfiltration'];

    criticalTargets.forEach(k => { if(lowerDesc.includes(k)) impactScore += 10; });
    highTargets.forEach(k => { if(lowerDesc.includes(k)) impactScore += 5; });
    destructiveActions.forEach(k => { if(lowerDesc.includes(k)) impactScore += 5; });
    impactScore = Math.min(impactScore, 30);

    const totalScore = Math.min(activityScore + capabilityScore + impactScore, 100);
    return { totalScore, activityScore, capabilityScore, impactScore };
};

export const parseMalpediaBib = async (file: File): Promise<MalpediaEntry[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const entries: MalpediaEntry[] = [];
        const rawBlocks = text.split(/@\w+\s*{/);

        for (let i = 1; i < rawBlocks.length; i++) {
            const block = rawBlocks[i];
            const firstCommaIndex = block.indexOf(',');
            if (firstCommaIndex === -1) continue;

            const id = block.substring(0, firstCommaIndex).trim();
            const body = block.substring(firstCommaIndex + 1);

            const entry: MalpediaEntry = {
                id: id,
                title: extractField(body, 'title') || id,
                author: extractField(body, 'author'),
                date: extractField(body, 'date'),
                organization: extractField(body, 'organization'),
                url: extractField(body, 'url'),
                language: extractField(body, 'language'),
                note: extractField(body, 'note'),
                year: extractField(body, 'year')
            };
            entries.push(entry);
        }
        resolve(entries);
      } catch (err) {
        console.error("Malpedia Parse Error", err);
        reject(new Error("Invalid BibTeX format"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
};

export const parseMalpediaActors = async (file: File): Promise<MalpediaActor[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const json = JSON.parse(text);
                const actors: MalpediaActor[] = [];

                if (typeof json !== 'object' || Array.isArray(json)) {
                    throw new Error("Invalid Actor JSON format");
                }

                Object.keys(json).forEach(key => {
                    const data = json[key];
                    if (data.uuid && data.value) {
                        const description = String(data.description || '');
                        const refs = (data.meta?.refs || []) as string[];
                        const synonyms = (data.meta?.synonyms || []) as string[];
                        const scores = calculateThreatScore(description, refs, synonyms);

                        let sophistication: MalpediaActor['sophistication'] = 'Low';
                        if (scores.totalScore >= 80) sophistication = 'Critical';
                        else if (scores.totalScore >= 60) sophistication = 'High';
                        else if (scores.totalScore >= 40) sophistication = 'Medium';

                        const mitreRegex = /T\d{4}(?:\.\d{3})?/g;
                        const foundMitre = (description.match(mitreRegex) || []) as string[];
                        const uniqueMitre = Array.from(new Set(foundMitre)).sort();

                        const familyRegex = /(?:malware|trojan|backdoor|ransomware|loader|stealer|botnet|worm|rootkit|spyware|strain|variant|family)(?:\s+(?:known\s+as|called|named))?\s+([A-Z][a-zA-Z0-9\-\_]{2,})/g;
                        const foundFamilies = new Set<string>();
                        if (data.families && Array.isArray(data.families)) {
                            data.families.forEach((f: string) => foundFamilies.add(f));
                        }
                        let match;
                        const stopWords = ['The', 'A', 'An', 'This', 'Their', 'In', 'It', 'However', 'Furthermore', 'Additionally', 'Unknown', 'Custom', 'Proprietary', 'Malicious', 'Generic', 'New', 'Another', 'Some', 'Any', 'Two', 'Three', 'Multiple'];
                        while ((match = familyRegex.exec(description)) !== null) {
                            const candidate = match[1];
                            if (!stopWords.includes(candidate) && isNaN(Number(candidate))) {
                                foundFamilies.add(candidate);
                            }
                        }

                        actors.push({
                            value: data.value,
                            description: description,
                            uuid: data.uuid,
                            threatScore: scores.totalScore,
                            sophistication: sophistication,
                            scoreBreakdown: {
                                activityScore: scores.activityScore,
                                capabilityScore: scores.capabilityScore,
                                impactScore: scores.impactScore
                            },
                            meta: { country: data.meta?.country, refs: refs, synonyms: synonyms },
                            mitreIds: uniqueMitre,
                            malwareFamilies: Array.from(foundFamilies).sort(),
                            source: 'Malpedia'
                        });
                    }
                });
                resolve(actors);
            } catch (err) {
                console.error("Malpedia Actor Parse Error", err);
                reject(new Error("Invalid Malpedia Actor JSON"));
            }
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsText(file);
    });
};

export const processMalpediaMispJson = (json: any): MalpediaActor[] => {
    const actors: MalpediaActor[] = [];
    if (!json.values || !Array.isArray(json.values)) {
        console.warn("Invalid Malpedia MISP JSON format: 'values' array missing");
        return [];
    }
    json.values.forEach((data: any) => {
        if (data.uuid && data.value) {
            const description = String(data.description || '');
            const refs = (data.meta?.refs || []) as string[];
            const synonyms = (data.meta?.synonyms || []) as string[];
            const scores = calculateThreatScore(description, refs, synonyms);

            let sophistication: MalpediaActor['sophistication'] = 'Low';
            if (scores.totalScore >= 80) sophistication = 'Critical';
            else if (scores.totalScore >= 60) sophistication = 'High';
            else if (scores.totalScore >= 40) sophistication = 'Medium';

            const mitreRegex = /T\d{4}(?:\.\d{3})?/g;
            const foundMitre = (description.match(mitreRegex) || []) as string[];
            const uniqueMitre = Array.from(new Set(foundMitre)).sort();

            actors.push({
                value: data.value,
                description: description,
                uuid: data.uuid,
                threatScore: scores.totalScore,
                sophistication: sophistication,
                scoreBreakdown: {
                    activityScore: scores.activityScore,
                    capabilityScore: scores.capabilityScore,
                    impactScore: scores.impactScore
                },
                meta: { country: 'Unknown', refs: refs, synonyms: synonyms },
                mitreIds: uniqueMitre,
                malwareFamilies: [],
                source: 'Malpedia'
            });
        }
    });
    return actors;
};

export const parseMalpediaMisp = async (file: File): Promise<MalpediaActor[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const json = JSON.parse(text);
                const actors = processMalpediaMispJson(json);
                resolve(actors);
            } catch (err) {
                console.error("Malpedia MISP Parse Error", err);
                reject(new Error("Invalid Malpedia MISP JSON"));
            }
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsText(file);
    });
};

export const fetchRemoteMalpedia = async (): Promise<MalpediaActor[]> => {
    // Malpedia feed URL
    const targetUrl = 'https://malpedia.caad.fkie.fraunhofer.de/api/get/misp';
    
    // Proxy rotation to bypass CORS
    const PROXIES = [
        (url: string) => url, // Direct
        (url: string) => `/api/proxy?url=${encodeURIComponent(url)}`, // Vercel
        (url: string) => `/api/proxy?url=${encodeURIComponent(url)}`,
        (url: string) => `/api/proxy?url=${encodeURIComponent(url)}`
    ];

    for (const proxy of PROXIES) {
        try {
            const url = proxy(targetUrl);
            
            // Check Vercel marker
            if (url.startsWith('/api/proxy')) {
                // Fetch first to check headers before committing to stream read
                const checkRes = await fetch(url, { method: 'HEAD' });
                if (!checkRes.headers.get('X-Source-Proxy')) continue;
            }

            const response = await fetch(url);
            if (response.ok) {
                const json = await response.json();
                return processMalpediaMispJson(json);
            }
        } catch (e) {
            // Try next proxy
        }
    }
    
    console.warn("Failed to fetch remote Malpedia feed.");
    return [];
};

const extractField = (content: string, fieldName: string): string | undefined => {
    let regex = new RegExp(`${fieldName}\\s*=\s*{([^}]+)}`, 'i');
    let match = content.match(regex);
    if (match) return match[1].trim();

    regex = new RegExp(`${fieldName}\\s*=\s*"([^"]+)"`, 'i');
    match = content.match(regex);
    if (match) return match[1].trim();
    
    regex = new RegExp(`${fieldName}\\s*=\s*([^,}\s]+)`, 'i');
    match = content.match(regex);
    if (match) return match[1].trim();

    return undefined;
};

