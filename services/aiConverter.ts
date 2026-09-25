
import { GoogleGenAI, Chat } from "@google/genai";
import { GEMINI_API_KEY } from "../config/config";
import { RuleType, Playbook, CaseFile, OtxSandboxReport, ThreatRecord } from "../types";

const SYSTEM_PROMPT = `You are an expert SOC Analyst and Detection Engineer. 
Your task is to convert, generate, and explain security rules (SIGMA, YARA, Suricata, Splunk SPL, KQL, etc.).
Output ONLY the requested rule code block unless asked for an explanation.
Do not include markdown code fences like \`\`\`yaml in the final output if possible, or keep them minimal.`;

export interface SimulationResult {
    match: boolean;
    confidence: string;
    reason: string;
    extracted: Record<string, string>;
}

export const analyzeArchitecture = async (graphJson: string, framework: 'STRIDE' | 'PASTA' | 'LINDDUN' | 'NIST_AI' = 'STRIDE'): Promise<ThreatRecord[]> => {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    
    let frameworkPrompt = "";
    switch(framework) {
        case 'PASTA':
            frameworkPrompt = "Apply the PASTA (Process for Attack Simulation and Threat Analysis) framework. Focus on threat identification (Stage 4), vulnerability analysis (Stage 5), and impact analysis (Stage 6).";
            break;
        case 'LINDDUN':
            frameworkPrompt = "Apply the LINDDUN framework to identify Privacy threats. Categories: Linkability, Identifiability, Non-repudiation, Detectability, Disclosure of information, Unawareness, Non-compliance.";
            break;
        case 'NIST_AI':
            frameworkPrompt = "Apply the NIST AI Risk Management Framework (AI RMF). Focus on trustworthiness characteristics: Valid and Reliable, Safe, Secure and Resilient, Explainable and Interpretable, Privacy-enhanced, Fair with Harmful Bias Managed.";
            break;
        default:
            frameworkPrompt = "Apply the STRIDE framework (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege). Analyze the Data Flow Diagram (DFD) logic provided.";
    }

    const prompt = `You are a world-class Cybersecurity Architect and Threat Modeler.
    ${frameworkPrompt}
    
    Analyze the following system architecture provided in JSON format. 
    For each identified threat, provide a structured response including:
    1. ID: Unique string
    2. model: The string "${framework}"
    3. category: Framework-specific category name
    4. description: Detailed explanation of the threat
    5. recommendation: Technical remediation steps
    6. riskLevel: One of [LOW, MEDIUM, HIGH, CRITICAL]
    7. riskScores: { 
        cvss: Estimated Base Score (0.0-10.0), 
        dread: { damage: 1-10, reproducibility: 1-10, exploitability: 1-10, affectedUsers: 1-10, discoverability: 1-10, total: Sum of DREAD components / 5 } 
    }
    8. mappings: { 
        mitre: Array of relevant MITRE ATT&CK technique IDs (e.g., ["T1059", "T1071"]),
        nist: Relevant NIST 800-53 or AI RMF controls,
        linddun: Relevant LINDDUN privacy strategy (if LINDDUN)
    }
    9. targetNodeId: The ID of the node this threat applies to
    10. targetEdgeId: The ID of the connection this threat applies to (if applicable)

    Return the response ONLY as a valid JSON array of objects. Do not include markdown formatting or backticks.
    
    Architecture Data:
    ${graphJson}`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                temperature: 0.1
            }
        });

        const text = response.text;
        if (!text) return [];
        const cleaned = text.replace(/```json|```/g, "").trim();
        return JSON.parse(cleaned) as ThreatRecord[];
    } catch (error) {
        console.error("Architecture analysis failed", error);
        return [];
    }
};

export const searchThreatIntelligence = async (query: string) => {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Research the following cybersecurity topic and provide a detailed technical briefing. 
            Include malware signatures, IOCs, and MITRE ATT&CK techniques where relevant.
            
            FORMATTING RULES:
            1. Use standard Markdown headers (## for sections, ### for sub-sections, #### for specific items).
            2. Use standard Markdown tables for technical data lists (IPs, Hashes, Domains).
            3. Use code blocks for raw technical artifacts.
            4. Ensure clear hierarchical numbering for lists.
            
            Query: ${query}`,
            config: {
                tools: [{ googleSearch: {} }],
                temperature: 0.2
            },
        });

        const text = response.text;
        const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
            ?.filter(chunk => chunk.web)
            .map(chunk => ({
                title: chunk.web?.title || "Unknown Source",
                uri: chunk.web?.uri || "#"
            })) || [];

        return { text, sources };
    } catch (error: any) {
        console.error("Grounding Search Error", error);
        throw error;
    }
};

export const createThreatChat = (context: string): Chat => {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    
    return ai.chats.create({
        model: 'gemini-3-flash-preview',
        config: {
            systemInstruction: `You are Xyberah AI, an elite cybersecurity threat intelligence assistant. 
            You are embedded within the Xyberah Threat Processor application.
            
            CURRENT SESSION CONTEXT:
            ${context}
            
            ROLE & BEHAVIOR:
            - Act as a senior SOC analyst and forensic investigator.
            - Provide concise, actionable, and technical responses.
            - ALWAYS show your thinking process or reasoning briefly before the final conclusion when analyzing threats.
            - Use Markdown for formatting lists, code blocks, and headers.
            - If asked about specific IPs or IOCs present in the context, provide details.
            - Maintain a professional, vigilant tone suitable for a security operations center.
            `
        }
    });
};

export const convertRule = async (content: string, fromType: RuleType, toFormat: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    try {
        const prompt = `Convert the following ${fromType} rule to ${toFormat}. 
        Ensure strict syntax compliance. 
        If a field cannot be mapped, comment it out.
        
        Input Rule:
        ${content}`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                systemInstruction: SYSTEM_PROMPT,
                temperature: 0.2
            }
        });

        return response.text || "// No output generated";
    } catch (error: any) {
        console.error("AI Conversion Error", error);
        return `// Conversion failed: ${error.message}`;
    }
};

export const generateRuleFromLog = async (logSnippet: string, targetFormat: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    try {
        const prompt = `Generate a ${targetFormat} detection rule for the following log snippet or description. 
        Identify the malicious indicator or behavior.
        
        Input:
        ${logSnippet}`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                systemInstruction: SYSTEM_PROMPT,
                temperature: 0.4
            }
        });

        return response.text || "// No rule generated";
    } catch (error: any) {
        return `// Generation failed: ${error.message}`;
    }
};

export const generateLogFromRule = async (ruleContent: string, ruleType: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    try {
        const prompt = `Act as a Security Data Generator.
        Analyze the following ${ruleType} detection rule.
        Generate a realistic, high-fidelity log sample (JSON, Syslog, or Windows Event Log format) that would POSITIVELY TRIGGER this rule.
        Ensure all conditions in the rule are met by the log.
        Return ONLY the raw log string.
        
        Rule:
        ${ruleContent}`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                temperature: 0.5
            }
        });

        return response.text || "No log generated.";
    } catch (error: any) {
        return `Generation failed: ${error.message}`;
    }
};

export const explainRule = async (content: string, type: RuleType): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    try {
        const prompt = `Explain what this ${type} rule does in simple terms. 
        Highlight the key conditions and the potential threat it detects.
        
        Rule:
        ${content}`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                systemInstruction: "You are a helpful SOC mentor. Explain clearly and concisely."
            }
        });

        return response.text || "No explanation generated.";
    } catch (error: any) {
        return `Explanation failed: ${error.message}`;
    }
};

export const suggestMitreTags = async (content: string): Promise<string[]> => {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    try {
        const prompt = `Analyze the following security detection rule content. 
        Identify the most relevant MITRE ATT&CK Technique IDs (e.g. T1059.001, T1003, T1190) based on the logic and description.
        Return ONLY a JSON array of strings containing the Technique IDs. Do not add markdown formatting.
        
        Rule Content:
        ${content}`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                temperature: 0.1
            }
        });

        const text = response.text;
        if (!text) return [];
        
        try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) {
                return parsed.map(String).filter(s => s.startsWith('T'));
            }
        } catch (e) {
            console.error("Failed to parse MITRE suggestion JSON", e);
        }
        return [];
    } catch (error) {
        console.error("MITRE Suggestion Error", error);
        return [];
    }
};

export const evaluateRuleMatch = async (ruleContent: string, ruleType: string, logSample: string): Promise<SimulationResult> => {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const prompt = `Act as a Detection Engine Simulator for ${ruleType} rules.
    Analyze the provided Rule and the Log Sample.
    Determine if the log matches the rule's logic.
    
    Rule:
    ${ruleContent}
    
    Log Sample:
    ${logSample}
    
    Return a JSON object with the following structure:
    {
      "match": boolean, // true if the log triggers the rule
      "confidence": string, // "High", "Medium", or "Low"
      "reason": string, // Explanation of why it matched or failed
      "extracted": object // Key-value pairs of interesting fields extracted from the log (e.g. ip, url, user)
    }`;

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            temperature: 0.1
        }
    });

    try {
        if (!response.text) throw new Error("No response from AI");
        return JSON.parse(response.text) as SimulationResult;
    } catch (e) {
        return {
            match: false,
            confidence: "Low",
            reason: "Failed to parse simulation result.",
            extracted: {}
        };
    }
};

export const generatePlaybookFromPrompt = async (userPrompt: string): Promise<Partial<Playbook> | null> => {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const prompt = `You are a SOAR (Security Orchestration, Automation and Response) Architect.
    Create a detailed Incident Response Playbook based on this request: "${userPrompt}".
    
    Return strict JSON matching this structure:
    {
      "name": "Title of Playbook",
      "description": "Short description",
      "severity": "Medium" | "High" | "Critical",
      "tags": ["Tag1", "Tag2"],
      "startStepId": "step-1",
      "steps": {
         "step-1": {
            "id": "step-1",
            "title": "Initial Step",
            "description": "What to do first...",
            "type": "ACTION" | "DECISION" | "AUTOMATION" | "INPUT",
            "nextStepId": "step-2",
            "options": [ // Only if type is DECISION
                { "label": "Yes", "nextStepId": "step-3", "style": "negative" },
                { "label": "No", "nextStepId": "step-close", "style": "positive" }
            ],
            "automationId": "enrich_ip" // Only if type is AUTOMATION (use enrich_ip or enrich_all)
         }
      }
    }
    
    Ensure logical flow. Use 'step-1' as the starting ID. Connect steps via 'nextStepId'. End workflows with a closing step.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                temperature: 0.4
            }
        });

        if (response.text) {
            return JSON.parse(response.text);
        }
    } catch (e) {
        console.error("Playbook Generation Error", e);
    }
    return null;
};

export const summarizeCaseFile = async (caseData: CaseFile): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const minimalHistory = caseData.history.map(h => `[${h.timestamp}] ${h.action} (Step: ${h.stepId})`).join('\n');
    const minimalArtifacts = caseData.artifacts.map(a => `${a.type}: ${a.value} (${a.note || ''})`).join('\n');

    const prompt = `Act as an Incident Commander. Write a professional Executive Summary for this closed investigation.
    
    Case Title: ${caseData.title}
    Priority: ${caseData.priority}
    Created: ${caseData.created}
    Closed: ${caseData.updated}
    
    Timeline:
    ${minimalHistory}
    
    Evidence / Artifacts:
    ${minimalArtifacts}
    
    Format the output in clean plain text suitable for a formal report. Do not use markdown (bolding/headers).
    Sections:
    EXECUTIVE SUMMARY
    TIMELINE OF EVENTS
    KEY FINDINGS
    RECOMMENDATIONS`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                temperature: 0.3
            }
        });

        return response.text || "No summary generated.";
    } catch (e: any) {
        return `Summarization failed: ${e.message}`;
    }
};

export const generateForensicSummary = async (contextType: 'NETWORK' | 'EMAIL', data: any): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    let prompt = "";
    
    const FORMAT_INSTRUCTIONS = `
    FORMATTING RULES:
    1. Use Markdown syntax for structuring the report.
    2. Use **Bold** for field names and key indicators.
    3. Use ## Headers for main sections.
    4. Use bullet lists (-) for findings.
    5. Use \`code blocks\` for technical artifacts (IPs, Hashes, Payloads).
    `;

    if (contextType === 'NETWORK') {
        prompt = `Act as a Senior Network Forensic Investigator. Analyze the following traffic summary. ${FORMAT_INSTRUCTIONS} DATA: ${JSON.stringify(data.stats)}`;
    } else {
        prompt = `Act as a Senior Email Security Analyst. Analyze the following email data. ${FORMAT_INSTRUCTIONS} DATA: ${JSON.stringify(data.auth)}`;
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                temperature: 0.2
            }
        });
        return response.text || "No analysis generated.";
    } catch (e: any) {
        return `AI Analysis Failed: ${e.message}`;
    }
};

export const formatNetworkContext = (data: any): string => {
    const stats = data.stats;
    const anomalies = data.anomalies.map((a:any) => `${a.severity}: ${a.description}`).join('\n');
    const threats = data.actorMatches.map((m:any) => `${m.actor.value} (${m.type})`).join(', ');

    return `
    NETWORK TRAFFIC ANALYSIS CONTEXT:
    - Total Packets: ${stats.totalPackets}
    - Volume: ${(stats.totalBytes / 1024).toFixed(2)} KB
    - Duration: ${(stats.duration / 1000).toFixed(2)} sec
    - Top Talkers: ${JSON.stringify(stats.topTalkers.slice(0, 5))}
    - Detected Anomalies: ${anomalies || 'None detected.'}
    - Threat Intelligence Matches: ${threats || 'None detected.'}
    `;
};

export const formatEmailContext = (data: any): string => {
    const auth = data.auth;
    const risk = data.riskFactors.join(', ');
    const hops = data.hops.map((h:any) => `Hop ${h.hopNum}: ${h.ip} (${h.country || 'Unknown'}) - Delay: ${h.delaySeconds.toFixed(1)}s`).join('\n');

    return `
    EMAIL FORENSIC ANALYSIS CONTEXT:
    - Subject: "${data.subject}"
    - From: ${data.from}
    - Risk Assessment: ${data.riskScore}/100
    - Flags: ${risk || 'None'}
    - Routing Chain: ${hops}
    - SPF/DKIM/DMARC: ${JSON.stringify(auth)}
    `;
};

export const formatSandboxContext = (report: OtxSandboxReport): string => {
    const info = report.analysis.info.results;
    const yara = report.analysis.plugins.yarad?.results.detection.map(d => d.rule_name).join(', ') || 'None';
    const av = report.analysis.plugins.clamav?.results.detection || 'Clean';

    return `
    MALWARE SANDBOX ANALYSIS CONTEXT:
    - SHA256: ${info.sha256}
    - Type: ${info.file_type}
    - AV Verdict: ${av}
    - YARA Rules: ${yara}
    `;
};

