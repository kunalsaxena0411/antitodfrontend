import { GoogleGenAI } from "@google/genai";
import { GEMINI_API_KEY } from "../config/config";

export interface ParsedTopology {
    nodes?: Array<{
        id: string;
        label: string;
        type: 'gateway' | 'server' | 'storage' | 'endpoint' | 'boundary' | 'standard';
        iconName: string;
        criticality: 'LOW' | 'MEDIUM' | 'HIGH' | 'MISSION_CRITICAL';
        isInternetFacing: boolean;
        description: string;
        interface?: string;
        ipAddress?: string;
    }>;
    edges?: Array<{
        source: string;
        target: string;
        label: string;
        protocol: string;
        portRange: string;
    }>;
    questions?: string[]; // AI can ask for clarification
}

/**
 * Uses Gemini to transform complex, multi-device enterprise network configuration dumps 
 * into a structured topology graph. Leverages high-context reasoning to correlate links 
 * between devices.
 */
export const parseNetworkConfig = async (configText: string, previousAnswers?: string): Promise<ParsedTopology> => {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const model = 'gemini-3-flash-preview';

    let prompt = `
    Act as a Principal Network Architect and Enterprise Security Engineer. 
    Analyze the provided technical configuration data which may contain dumps from multiple devices (Firewalls, Routers, Switches, Proxies).

    TASK:
    1. Identify each distinct device and its role.
    2. Extract all interfaces, IP addresses, and subnets.
    3. RECONSTRUCT CONNECTIONS: Identify how these devices link to each other. 
    4. Assess exposure: Identify internet-facing perimeter devices.

    CRITICAL INSTRUCTION:
    If the configuration is ambiguous, missing critical link information, or if you cannot confidently determine the relationship between specific devices, DO NOT GUESS. Instead, return a list of targeted, technical questions in the "questions" field of the JSON.

    OUTPUT RULES:
    - Return ONLY a valid JSON object.
    - If the topology is clear, structure:
       {
         "nodes": [ { "id": "unique_slug", "label": "Device Name", ... } ],
         "edges": [ { "source": "nodeId", "target": "nodeId", ... } ]
       }
    - If you need more info, structure:
       {
         "questions": [ "How is VLAN 10 routed between Core-Switch-01 and the Edge Firewall?", ... ]
       }
    - Use 'gateway' for routers/firewalls, 'standard' for switches/L2-devices.

    ENTERPRISE CONFIG DATA BLOCK:
    ${configText.substring(0, 180000)}
    `;

    if (previousAnswers) {
        prompt += `\n\nUSER CLARIFICATION ANSWERS:\n${previousAnswers}\n\nPlease use these answers to finalize the topology mapping.`;
    }

    try {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                temperature: 0.1,
            }
        });

        const text = response.text;
        if (!text) throw new Error("AI engine failed to produce architectural mapping.");
        
        const jsonStr = text.replace(/```json|```/gi, '').trim();
        const result = JSON.parse(jsonStr) as ParsedTopology;

        // Validation: Ensure we either have questions or a valid topology
        if (!result.questions && (!result.nodes || result.nodes.length === 0)) {
            throw new Error("AI returned empty result without clarification questions.");
        }

        return result;
    } catch (e) {
        console.error("Enterprise topology parsing failed:", e);
        throw new Error("Architecture reconstruction failed. The data may be too unstructured or corrupted.");
    }
};
