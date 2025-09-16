export type NodeKind =
    | 'Agent'
    | 'Tool'
    | 'Router'
    | 'Guard'
    | 'MemoryRead'
    | 'MemoryWrite'
    | 'End';

export type EdgeLabel = string; // e.g., "success" | "fail" | "code" | "text"

export interface NodeBase<K extends NodeKind = NodeKind> {
    id: string;
    kind: K;
    type?: string;          // free-form subtype e.g. "Planner" | "Coder"
    data?: Record<string, unknown>;
    tags?: string[];
}

export type Node =
    | (NodeBase<'Agent'> & {
        data?: {
            system?: string;
            prompt?: string;
            model?: string;
            vars?: Record<string, unknown>;
            stream?: boolean;
        };
    })
    | (NodeBase<'Tool'> & {
        data?: { name: string; args?: Record<string, unknown> };
    })
    | (NodeBase<'Router'> & {
        data?: { routes?: { label: string; when: (s: EngineState) => boolean }[] };
    })
    | (NodeBase<'Guard'> & {
        data?: { allow: boolean | ((s: EngineState) => boolean) };
    })
    | (NodeBase<'MemoryRead'> & { data?: { key: string } })
    | (NodeBase<'MemoryWrite'> & { data?: { key: string; from?: string } })
    | (NodeBase<'End'> & {});

export interface Edge {
    id: string;
    from: string;
    to: string;
    label?: EdgeLabel; // control flow label; "default" is supported
    cond?: (s: EngineState) => boolean;
    data?: Record<string, unknown>;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface JournalEntry {
    ts: number;
    level: LogLevel;
    nodeId?: string;
    msg: string;
    data?: Record<string, unknown>;
}

export interface EngineEvent {
    type:
    | 'run.start' | 'run.end'
    | 'node.start' | 'node.end' | 'node.error'
    | 'edge.select'
    | 'run.log';
    ts: number;
    runId: string;
    nodeId?: string;
    edgeId?: string;
    data?: any;
}

export interface Orchestrator {
    onRunStart?(state: EngineState): void | Promise<void>;
    beforeNode?(node: Node, state: EngineState): void | Promise<void>;
    afterNode?(node: Node, state: EngineState, result: ExecResult): void | Promise<void>;
    onError?(node: Node, state: EngineState, err: Error): 'retry' | 'skip' | 'fail' | void | Promise<any>;
    beforeEdgeSelect?(from: string, label: string, state: EngineState): { overrideLabel?: string } | void | Promise<any>;
    onRunEnd?(state: EngineState): void | Promise<void>;
}

export interface EngineOptions {
    executors?: Partial<ExecutorTable>;
    llm?: LLMClient;
    tools?: Record<string, ToolFn>;
    maxSteps?: number;      // safety budget
    perNodeMs?: number;     // node timeout
    orchestrator?: Orchestrator;
    onEvent?: (ev: EngineEvent) => void;
}

export type ToolFn = (args: Record<string, unknown>) => Promise<unknown>;

export interface LLMClient {
    // basic
    (req: { model?: string; system?: string; prompt: string }): Promise<{ text: string }>;
    // optional streaming
    stream?: (req: { model?: string; system?: string; prompt: string }) => Promise<AsyncIterable<string>>;
}

export interface EngineState {
    runId: string;
    step: number;
    input: unknown;
    output: any;                      // last node output
    memory: Record<string, unknown>;  // key-value store
    meta: Record<string, unknown>;    // free-form metadata
    traces: Trace[];
    journal: JournalEntry[];
    log?: (level: LogLevel, msg: string, data?: any) => void;
    [k: string]: unknown;
}

export interface ExecResult {
    output: any;
    next: string | null; // edge label or null to stop
}

export type Executor = (node: Node, state: EngineState) => Promise<ExecResult>;

export type ExecutorTable = Record<NodeKind, Executor>;

export interface Trace {
    nodeId: string;
    kind: NodeKind;
    tStart: number;
    tEnd: number;
    next: string | null;
    error?: string;
}