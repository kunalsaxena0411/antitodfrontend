
import { Node, Edge } from 'reactflow';
import { AttackSimulationResult } from '../types';

/**
 * Protocol-based lateral movement weights.
 * Higher values indicate protocols more commonly used for pivoting/tunnelling.
 */
const PIVOT_VECTOR_STRENGTH: Record<string, number> = {
    'SSH': 0.9,
    'RDP': 0.85,
    'SMB': 0.8,
    'WINRM': 0.8,
    'RPC': 0.75,
    'SQL': 0.6,
    'HTTP': 0.5,
    'HTTPS': 0.4,
    'DNS': 0.9, // High for tunnelling
    'ICMP': 0.3
};

/**
 * OS Hardening Factors (Heuristic).
 * Affects the 'cost' or difficulty of lateral movement into a node.
 */
const OS_HARDENING_COEFF: Record<string, number> = {
    'Linux': 1.0,
    'Windows': 0.8, // Historically higher vector surface
    'Unix': 1.1,
    'Cisco IOS': 1.2,
    'macOS': 0.9,
    'Unknown': 0.7
};

/**
 * Enhanced Logic-based Attack Simulation Engine
 * Calculates reachability based on node metadata, edge properties, and vulnerabilities.
 */
export const runBlastRadiusSimulation = (
    nodes: Node[],
    edges: Edge[],
    originId: string
): AttackSimulationResult => {
    const reachableSet = new Set<string>();
    const paths: string[][] = [];
    
    // Breadth-First Search for logical reachability
    // We track the path taken and the cumulative 'Exploit Probability'
    const queue: { id: string; path: string[]; probability: number }[] = [
        { id: originId, path: [originId], probability: 1.0 }
    ];
    reachableSet.add(originId);

    while (queue.length > 0) {
        const { id: currentId, path, probability } = queue.shift()!;
        
        // Find all edges starting from this node
        const outgoingEdges = edges.filter(e => e.source === currentId);

        outgoingEdges.forEach(edge => {
            const edgeData = edge.data || {};
            const targetNode = nodes.find(n => n.id === edge.target);
            const sourceNode = nodes.find(n => n.id === currentId);
            
            if (!targetNode || !sourceNode) return;

            // --- LATERAL MOVEMENT LOGIC ---

            // 1. Policy/Firewall Check
            // A hard 'Denied' rule prevents traversal unless the attacker has an RCE 
            // on the source node allowing them to bypass logic (tunnelling).
            const isHardBlocked = edgeData.isPermissive === false;
            
            // 2. Protocol Vector Assessment
            const protocol = (edgeData.protocol || 'TCP').toUpperCase();
            const vectorStrength = PIVOT_VECTOR_STRENGTH[protocol] || 0.4;
            
            // 3. Vulnerability Context
            const targetVulnerabilities = targetNode.data?.vulnerabilities?.length || 0;
            const targetHasIocs = targetNode.data?.iocs?.length > 0;
            
            // 4. Hardening Factor
            const osHardening = OS_HARDENING_COEFF[targetNode.data?.os || 'Unknown'] || 0.7;

            // Traversal Condition:
            // An attacker can traverse if:
            // a) The connection is permissive (Standard Flow)
            // b) The target is highly vulnerable (Bypass via exploit)
            // c) The protocol allows for pivoting/lateral tools (SSH/SMB/RDP)
            
            let canTraverse = false;
            if (!isHardBlocked && edgeData.isPermissive) {
                canTraverse = true;
            } else if (targetVulnerabilities > 0 || targetHasIocs) {
                // Attacker exploits a service to jump even if not "officially" permissive
                canTraverse = true;
            } else if (vectorStrength > 0.7 && probability > 0.5) {
                // Skilled attacker using high-pivot protocols
                canTraverse = true;
            }

            // Attacker path selection logic: 
            // Attackers prioritize 'Critical' assets but find them harder to breach if properly hardened.
            const isTargetMissionCritical = targetNode.data?.criticality === 'MISSION_CRITICAL';
            
            if (canTraverse && !reachableSet.has(edge.target)) {
                reachableSet.add(edge.target);
                const newPath = [...path, edge.target];
                
                // Track if the attacker reached a critical or sensitive target
                const isCriticalTarget = 
                    isTargetMissionCritical || 
                    targetNode.data?.criticality === 'HIGH' ||
                    ['Secret', 'PII', 'Financial'].includes(targetNode.data?.sensitivity);

                if (isCriticalTarget) {
                    paths.push(newPath);
                }

                // Decay the probability based on node hardening and complexity
                const newProbability = probability * vectorStrength * osHardening;

                queue.push({ 
                    id: edge.target, 
                    path: newPath, 
                    probability: newProbability 
                });
            }
        });
    }

    // --- Blast Radius Scoring ---
    // Calculates a weighted risk score based on the "Depth" and "Impact" of the reach
    let weightedScore = 0;
    reachableSet.forEach(id => {
        const node = nodes.find(n => n.id === id);
        if (node) {
            let nodeImpact = 5; // Base impact for any reached node
            
            switch (node.data?.criticality) {
                case 'MISSION_CRITICAL': nodeImpact = 70; break;
                case 'HIGH': nodeImpact = 45; break;
                case 'MEDIUM': nodeImpact = 20; break;
                case 'LOW': nodeImpact = 5; break;
            }
            
            // Sensitivity Multiplier (Data value)
            if (['Secret', 'PII', 'Financial'].includes(node.data?.sensitivity)) {
                nodeImpact *= 1.8;
            }

            // Vulnerability penalty (reached a vulnerable node = higher potential for further damage)
            if (node.data?.vulnerabilities?.length > 0) nodeImpact *= 1.25;
            if (node.data?.iocs?.length > 0) nodeImpact *= 1.5; // Active breach already underway
            
            weightedScore += nodeImpact;
        }
    });

    // Normalize score (0-100) relative to total potential impact of the ENTIRE network
    const totalPotentialImpact = nodes.reduce((acc, n) => {
        let val = 10;
        if (n.data?.criticality === 'MISSION_CRITICAL') val = 70;
        else if (n.data?.criticality === 'HIGH') val = 45;
        
        if (['Secret', 'PII', 'Financial'].includes(n.data?.sensitivity)) val *= 1.8;
        return acc + val;
    }, 0);

    const blastRadiusScore = Math.min(100, Math.round((weightedScore / (totalPotentialImpact || 1)) * 100));

    return {
        originId,
        reachableNodes: Array.from(reachableSet),
        criticalPaths: paths.sort((a, b) => b.length - a.length).slice(0, 10),
        blastRadiusScore
    };
};

/**
 * Individual Node Security Index
 * Measures the hardening and exposure of a single node.
 */
export const calculateNodeSecurityIndex = (node: Node, neighborEdges: Edge[]): number => {
    let score = 100;

    // 1. Exposure & Architecture
    if (node.data?.isInternetFacing) score -= 35;
    if (node.type === 'gateway') score += 10; // Security specialized nodes are assumed better monitored

    // 2. Vulnerabilities & Threat Intelligence
    if (node.data?.vulnerabilities && node.data.vulnerabilities.length > 0) {
        score -= Math.min(45, node.data.vulnerabilities.length * 15);
    }
    if (node.data?.iocs && node.data.iocs.length > 0) {
        score -= 60; // Active IOC presence is a critical hardening failure
    }

    // 3. Data Sensitivity
    if (['Secret', 'PII', 'PHI', 'Financial'].includes(node.data?.sensitivity)) {
        score -= 10; // "High stakes" assets require higher hardening to achieve same index
    }

    // 4. Inbound Hygiene
    // Analyze the security of incoming data flows
    const incomingInsecure = neighborEdges.filter(e => 
        e.target === node.id && (
            e.data?.encryption === 'None' || 
            e.data?.authentication === 'None'
        )
    ).length;
    
    score -= (incomingInsecure * 8);

    // 5. OS Hardening
    const os = node.data?.os || 'Unknown';
    if (os === 'Linux' || os === 'Unix') score += 5;

    return Math.max(0, score);
};
