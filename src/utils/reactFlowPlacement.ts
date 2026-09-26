import type { MutableRefObject } from 'react';
import type { Node, ReactFlowInstance } from 'reactflow';

type PlacementOptions = {
    nodeWidth?: number;
    nodeHeight?: number;
    horizontalGap?: number;
    verticalGap?: number;
};

const CANDIDATES = [
    [0, 0],

    [1, 0],
    [-1, 0],

    [0, 1],
    [0, -1],

    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],

    [2, 0],
    [-2, 0],

    [0, 2],
    [0, -2],

    [2, 1],
    [-2, 1],
    [2, -1],
    [-2, -1],

    [1, 2],
    [-1, 2],
    [1, -2],
    [-1, -2],
] as const;

export function getCanvasInsertPosition(
    reactFlowInstance: ReactFlowInstance | null,
    canvasRef: MutableRefObject<HTMLDivElement | null>,
    nodes: Node[],
    options: PlacementOptions = {}
) {
    const {
        nodeWidth = 260,
        nodeHeight = 150,
        horizontalGap = 80,
        verticalGap = 60,
    } = options;

    if (!reactFlowInstance || !canvasRef.current) {
        return {
            x: 120,
            y: 120,
        };
    }

    const rect = canvasRef.current.getBoundingClientRect();

    const screenCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
    };

    const flowCenter = reactFlowInstance.screenToFlowPosition(screenCenter);

    const stepX = nodeWidth + horizontalGap;
    const stepY = nodeHeight + verticalGap;

    const collides = (x: number, y: number) => {
        return nodes.some((node) => {
            const dx = Math.abs(node.position.x - x);
            const dy = Math.abs(node.position.y - y);

            return (
                dx < nodeWidth &&
                dy < nodeHeight
            );
        });
    };

    for (const [cx, cy] of CANDIDATES) {
        const candidate = {
            x: flowCenter.x - nodeWidth / 2 + cx * stepX,
            y: flowCenter.y - nodeHeight / 2 + cy * stepY,
        };

        if (!collides(candidate.x, candidate.y)) {
            return candidate;
        }
    }

    const ring = 4;

    for (let i = 0; i < 16; i++) {
        const angle = (Math.PI * 2 * i) / 16;

        const candidate = {
            x:
                flowCenter.x -
                nodeWidth / 2 +
                Math.cos(angle) * stepX * ring,
            y:
                flowCenter.y -
                nodeHeight / 2 +
                Math.sin(angle) * stepY * ring,
        };

        if (!collides(candidate.x, candidate.y)) {
            return candidate;
        }
    }

    return {
        x: flowCenter.x - nodeWidth / 2,
        y: flowCenter.y - nodeHeight / 2,
    };
}
