import crypto from 'node:crypto';
import type {
    EngineOptions,
    EngineState,
    ExecResult,
    Executor,
    ExecutorTable,
    Node,
    Trace,
    LogLevel,
    JournalEntry,
    EngineEvent,
} from './types.js';
import { Graph } from './graph.js';
import { makeDefaultExecutors } from './executors.js';

export class Engine {
    private g: Graph;
    private exec: ExecutorTable;
    private llm: any;
    private tools: Record<string, any>;
    private maxSteps: number;
    private perNodeMs: number;
    private emit?: (ev: EngineEvent) => void;
    private orchestrator?: any;

    constructor(graph: Graph, {
        executors = {},
        llm,
        tools = {},
        maxSteps = 200,
        perNodeMs = 15000,
        orchestrator,
        onEvent
    }: EngineOptions = {}) {
        this.g = graph;
        this.llm = llm ?? (async () => ({ text: '(mock LLM)' }));
        this.tools = tools;
        this.maxSteps = maxSteps;
        this.perNodeMs = perNodeMs;
        this.orchestrator = orchestrator;
        this.emit = onEvent;
        this.exec = {
            ...makeDefaultExecutors({ llm: this.llm, stream: this.llm?.stream, tools: this.tools }),
            ...(executors as ExecutorTable),
        };
    }

    /** Async generator that yields per-step traces and finally returns EngineState */
    async *run(startId: string, input: unknown, seedState: Partial<EngineState> = {}): AsyncGenerator<{ state: EngineState; trace: Trace }, EngineState, void> {
        let current = this.g.getNode(startId);
        if (!current) throw new Error('no start node');

        let steps = 0;
        const runId = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const traces: Trace[] = [];
        const journal: JournalEntry[] = [];

        let state: EngineState = {
            runId,
            step: 0,
            input,
            output: null,
            memory: {},
            meta: {},
            traces,
            journal,
            log: (level: LogLevel, msg: string, data?: any) => this.log(state, level, msg, data),
            ...seedState,
        } as EngineState;

        // Verbose logging: Run initialization
        console.log(`🚀 [ENGINE] Starting run ${runId} at node '${startId}'`);
        console.log(`📊 [ENGINE] Initial state:`, {
            step: state.step,
            inputType: typeof input,
            memoryKeys: Object.keys(state.memory || {}),
            startNode: current.id,
            nodeKind: current.kind
        });

        // Emit run start event
        this.emit?.({ type: 'run.start', ts: Date.now(), runId, data: { input, startId } });
        await this.orchestrator?.onRunStart?.(state);

        while (current) {
            if (++steps > this.maxSteps) throw new Error(`step budget exceeded (${this.maxSteps})`);
            state.step = steps;

            // Verbose logging: Node execution start
            console.log(`\n🔄 [ENGINE] Step ${steps}: Executing node '${current.id}' (${current.kind})`);
            console.log(`📋 [ENGINE] Node data:`, current.data);
            console.log(`🧠 [ENGINE] Current state memory keys:`, Object.keys(state.memory || {}));

            // Show outgoing edges for debugging routing
            const outEdges = this.g.out(current.id);
            console.log(`🔗 [ENGINE] Outgoing edges from '${current.id}': [${outEdges.map(e => `${e.to}(${e.label || 'default'})`).join(', ')}]`);

            // Emit node start event
            this.emit?.({ type: 'node.start', ts: Date.now(), runId, nodeId: current.id });
            await this.orchestrator?.beforeNode?.(current, state);

            const t0 = Date.now();
            let result: ExecResult = { output: state.output, next: null };
            let err: string | undefined;

            try {
                const exec: Executor | undefined = (this.exec as any)[current.kind];
                if (!exec) throw new Error(`no executor for kind: ${current.kind}`);

                console.log(`⚡ [ENGINE] Executing ${current.kind} executor...`);
                result = await withTimeout(exec(current, state), this.perNodeMs);

                console.log(`✅ [ENGINE] Executor completed:`, {
                    outputType: typeof result.output,
                    outputKeys: result.output && typeof result.output === 'object' ? Object.keys(result.output) : 'n/a',
                    nextNode: result.next,
                    hasOutput: !!result.output
                });

                // Call orchestrator after successful execution
                await this.orchestrator?.afterNode?.(current, state, result);
            } catch (e: any) {
                err = e?.message ?? String(e);
                console.log(`❌ [ENGINE] Executor failed:`, { error: err, node: current.id, kind: current.kind });

                // Let orchestrator handle the error
                const errorAction = await this.orchestrator?.onError?.(current, state, e);

                if (errorAction === 'retry') {
                    // Retry the current node (don't advance)
                    continue;
                } else if (errorAction === 'skip') {
                    // Skip to next node with current output
                    result = { output: state.output, next: 'success' };
                } else {
                    // Default: route to fail if present
                    result = { output: state.output, next: 'fail' };
                }

                this.emit?.({ type: 'node.error', ts: Date.now(), runId, nodeId: current.id, data: { error: err } });
            }

            state.output = result.output;

            const trace: Trace = {
                nodeId: current.id,
                kind: current.kind,
                tStart: t0,
                tEnd: Date.now(),
                next: result.next,
                error: err,
            };
            traces.push(trace);

            // Verbose logging: Node completion
            console.log(`🏁 [ENGINE] Node '${current.id}' completed in ${trace.tEnd - trace.tStart}ms`);
            console.log(`📤 [ENGINE] Output type: ${typeof state.output}`);
            console.log(`🔀 [ENGINE] Next routing label: '${result.next || 'null'}'`);

            // Emit node end event
            this.emit?.({ type: 'node.end', ts: trace.tEnd, runId, nodeId: current.id, data: trace });

            yield { state, trace };

            if (!result.next) {
                console.log(`🛑 [ENGINE] No next routing label - ending execution`);
                break;
            }

            // Let orchestrator potentially override the edge selection
            const edgeOverride = await this.orchestrator?.beforeEdgeSelect?.(current.id, result.next, state);
            const finalLabel = edgeOverride?.overrideLabel || result.next;

            console.log(`🔍 [ENGINE] Selecting edge from '${current.id}' with label '${finalLabel}'`);
            const edge = this.selectEdge(current.id, finalLabel, state);

            if (!edge) {
                console.log(`❌ [ENGINE] No matching edge found for label '${finalLabel}' from '${current.id}'`);
                const availableEdges = this.g.out(current.id);
                console.log(`🔗 [ENGINE] Available edges:`, availableEdges.map(e => ({
                    to: e.to,
                    label: e.label || 'default',
                    hasCond: !!e.cond
                })));
                if (err) throw new Error(`unhandled error at ${current.id}: ${err}`);
                break;
            }

            // Verbose logging: Edge selection
            console.log(`✅ [ENGINE] Selected edge: ${current.id} -> ${edge.to} (label: '${edge.label || 'default'}')`);

            // Emit edge selection event
            this.emit?.({ type: 'edge.select', ts: Date.now(), runId, edgeId: edge.id, data: { from: current.id, to: edge.to, label: finalLabel } });

            const nextNode = this.g.getNode(edge.to);
            if (!nextNode) {
                console.log(`❌ [ENGINE] Target node '${edge.to}' not found in graph`);
                break;
            }

            console.log(`➡️  [ENGINE] Transitioning to node '${edge.to}' (${nextNode.kind})`);
            current = nextNode;
        }

        // Verbose logging: Run completion
        console.log(`\n🏁 [ENGINE] Run ${runId} completed after ${steps} steps`);
        console.log(`📊 [ENGINE] Final state:`, {
            outputType: typeof state.output,
            memoryKeys: Object.keys(state.memory || {}),
            traceCount: traces.length,
            lastNode: traces[traces.length - 1]?.nodeId
        });

        // Emit run end event
        this.emit?.({ type: 'run.end', ts: Date.now(), runId, data: { output: state.output, steps } });
        await this.orchestrator?.onRunEnd?.(state);

        return state;
    }

    async runToEnd(...args: Parameters<Engine['run']>): Promise<EngineState> {
        const gen = this.run(...args);
        for await (const _ of gen) { /* consume */ }
        const result = await gen.next();
        return result.value as EngineState;
    }

    private selectEdge(fromId: string, label: string, state: EngineState) {
        // deterministic: labeled edges first (in insertion order), then "default"
        const outs = this.g.out(fromId);
        console.log(`🔍 [ENGINE] selectEdge: Checking ${outs.length} outgoing edges from '${fromId}' for label '${label}'`);

        const labeled = outs.filter((e) => e.label === label);
        console.log(`🏷️  [ENGINE] Found ${labeled.length} edges with exact label match`);

        const pool = labeled.length ? labeled : outs.filter((e) => e.label === 'default');
        console.log(`🎯 [ENGINE] Edge pool size: ${pool.length} (using ${labeled.length ? 'labeled' : 'default'} edges)`);

        for (const edge of pool) {
            const condResult = typeof edge.cond === 'function' ? edge.cond(state) : true;
            console.log(`🔄 [ENGINE] Testing edge ${fromId} -> ${edge.to}: condition=${condResult}`);
            if (condResult) {
                console.log(`✅ [ENGINE] Selected edge: ${edge.id} (${fromId} -> ${edge.to})`);
                return edge;
            }
        }

        console.log(`❌ [ENGINE] No suitable edge found`);
        return null;
    }

    // give executors a safe logger
    private log(state: EngineState, level: LogLevel, msg: string, data?: any) {
        const entry: JournalEntry = {
            ts: Date.now(),
            level,
            nodeId: state.traces.at(-1)?.nodeId,
            msg,
            data
        };
        state.journal.push(entry);
        this.emit?.({ type: 'run.log', ts: entry.ts, runId: state.runId, data: entry });
    }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    let to: NodeJS.Timeout;
    const timeout = new Promise<T>((_, rej) => {
        to = setTimeout(() => rej(new Error(`node timeout ${ms}ms`)), ms);
    });
    return Promise.race([p.finally(() => clearTimeout(to!)), timeout]);
}