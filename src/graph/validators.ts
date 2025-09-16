import type { Graph } from './graph.js';

export function validateGraph(g: Graph): void {
    // no dangling edges already checked in addEdge
    // enforce unique labels per source node for determinism
    for (const n of g.allNodes()) {
        const byLabel = new Map<string, string[]>();
        for (const e of g.out(n.id)) {
            if (!e.label) continue;
            const list = byLabel.get(e.label) || [];
            list.push(e.id);
            byLabel.set(e.label, list);
        }
        for (const [label, ids] of byLabel) {
            if (ids.length > 1) {
                throw new Error(`node ${n.id} has duplicate label "${label}" on edges ${ids.join(',')}`);
            }
        }
    }
}