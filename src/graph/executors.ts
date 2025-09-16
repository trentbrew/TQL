import type { ExecutorTable, ExecResult, EngineState, Node, ToolFn } from './types.js';
import { interpolate, pluck } from './util.js';

export function makeDefaultExecutors(opts: {
    llm: (args: any) => Promise<{ text: string }>;
    stream?: ((args: any) => Promise<AsyncIterable<string>>) | undefined;
    tools: Record<string, ToolFn>;
}): ExecutorTable {
    const { llm, stream, tools } = opts;

    const Agent = async (node: Node, state: EngineState): Promise<ExecResult> => {
        const { system = '', prompt = '', model = 'gpt-4o', vars = {}, stream: wantStream = false } =
            (node.data as any) || {};
        const rendered = interpolate(String(prompt || ''), { ...vars, input: state.input, state });

        state.log?.('info', `Agent executing: ${node.id}`, { model, system: system.slice(0, 100) });

        if (wantStream && typeof stream === 'function') {
            const iter = await stream({ model, system, prompt: rendered });
            // consumer can read state.output.stream externally if desired
            return { output: { stream: iter }, next: 'success' };
        } else {
            const { text } = await llm({ model, system, prompt: rendered });
            return { output: { text }, next: 'success' };
        }
    };

    const Tool = async (node: Node, state: EngineState): Promise<ExecResult> => {
        const { name, args = {} } = ((node.data || {}) as any);

        console.log(`🔧 [TOOL] Executing tool: ${name}`);
        console.log(`📋 [TOOL] Args:`, args);
        console.log(`📥 [TOOL] Input:`, state.output?.text ? `"${String(state.output.text).slice(0, 100)}..."` : 'none');
        console.log(`🧠 [TOOL] State memory keys:`, Object.keys(state.memory || {}));

        const fn = tools[name as string];
        if (!fn) {
            console.log(`❌ [TOOL] Tool '${name}' not found in registry`);
            console.log(`🔍 [TOOL] Available tools:`, Object.keys(tools));
            throw new Error(`tool missing: ${name}`);
        }

        state.log?.('info', `Tool executing: ${name}`, { args });

        try {
            const toolArgs = { ...args, input: state.output?.text, state };
            console.log(`⚡ [TOOL] Calling tool with:`, {
                argKeys: Object.keys(toolArgs),
                hasState: !!toolArgs.state,
                hasInput: !!toolArgs.input
            });

            const res = await fn(toolArgs);

            console.log(`✅ [TOOL] Tool '${name}' completed successfully`);
            console.log(`📤 [TOOL] Result type:`, typeof res);
            console.log(`📤 [TOOL] Result preview:`, res && typeof res === 'object' ? Object.keys(res) : String(res).slice(0, 100));

            return { output: { tool: name, result: res }, next: 'success' };
        } catch (error: any) {
            console.log(`❌ [TOOL] Tool '${name}' failed:`, error.message);
            throw error;
        }
    };

    const Router = async (node: Node, state: EngineState): Promise<ExecResult> => {
        const { routes = [] } = ((node.data || {}) as any);
        const hit = routes.find((r: any) => r?.when?.(state));
        const label = hit?.label || 'default';

        state.log?.('debug', `Router routing to: ${label}`, { nodeId: node.id });

        return { output: state.output, next: label };
    };

    const Guard = async (node: Node, state: EngineState): Promise<ExecResult> => {
        const { allow } = ((node.data || {}) as any);
        const ok = typeof allow === 'function' ? allow(state) : !!allow;

        state.log?.('debug', `Guard ${ok ? 'passed' : 'failed'}`, { nodeId: node.id });

        return { output: state.output, next: ok ? 'pass' : 'fail' };
    };

    const MemoryRead = async (node: Node, state: EngineState): Promise<ExecResult> => {
        const { key } = ((node.data || {}) as any);
        const v = state.memory?.[key];

        state.log?.('debug', `Memory read: ${key}`, { value: v });

        return { output: { ...state.output, memory: { [key]: v } }, next: 'success' };
    };

    const MemoryWrite = async (node: Node, state: EngineState): Promise<ExecResult> => {
        const { key, from = 'output.text' } = ((node.data || {}) as any);
        const val = pluck(state as any, from);
        state.memory ||= {};
        state.memory[key] = val;

        state.log?.('debug', `Memory write: ${key}`, { value: val });

        return { output: state.output, next: 'success' };
    };

    const End = async (_node: Node, state: EngineState): Promise<ExecResult> => {
        state.log?.('info', 'Execution completed');
        return { output: state.output, next: null };
    };

    return { Agent, Tool, Router, Guard, MemoryRead, MemoryWrite, End };
}