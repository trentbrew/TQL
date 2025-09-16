import type { Edge, Node } from './types.js';

export class Graph {
    private nodes = new Map<string, Node>();
    private edges = new Map<string, Edge>();
    private outIdx = new Map<string, string[]>(); // preserve insertion order

    addNode(n: Node): void {
        if (this.nodes.has(n.id)) throw new Error(`node exists: ${n.id}`);
        this.nodes.set(n.id, n);
        if (!this.outIdx.has(n.id)) this.outIdx.set(n.id, []);
    }

    addEdge(e: Edge): void {
        if (!this.nodes.has(e.from) || !this.nodes.has(e.to)) {
            throw new Error(`dangling edge ${e.id}: ${e.from} -> ${e.to}`);
        }
        if (this.edges.has(e.id)) throw new Error(`edge exists: ${e.id}`);
        this.edges.set(e.id, e);
        this.outIdx.get(e.from)!.push(e.id);
    }

    getNode(id: string): Node | undefined {
        return this.nodes.get(id);
    }

    out(from: string): Edge[] {
        const ids = this.outIdx.get(from) || [];
        return ids.map((id) => this.edges.get(id)!).filter(Boolean);
    }

    allNodes(): Iterable<Node> {
        return this.nodes.values();
    }
    allEdges(): Iterable<Edge> {
        return this.edges.values();
    }
}