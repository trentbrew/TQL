import { Engine } from '../src/graph/engine.js';
import { Graph } from '../src/graph/graph.js';
import { validateGraph } from '../src/graph/validators.js';
import { builtinTools } from '../src/graph/tools.js';
import type { LLMClient } from '../src/graph/types.js';

// Mock LLM (swap with real client)
const llm: LLMClient = async ({ system, prompt }) => {
    if (system?.includes('concise plans')) return { text: '- Parse\n- Generate\n- Return' };
    if (system?.includes('ONLY runnable JS')) return { text: '```js\nreturn 21*2\n```' };
    if (system?.includes('strict QA')) return { text: 'PASS' };
    if (system?.includes('final answers')) return { text: 'Here is a clean answer.' };
    return { text: '(mock)' };
};

const g = new Graph();

// Nodes
g.addNode({
    id: 'start', kind: 'Agent', type: 'Planner', data: {
        model: 'gpt-4o', system: 'You write concise plans.',
        prompt: "Plan steps to fulfill '{{input}}' as bullet points."
    }
});
g.addNode({
    id: 'router', kind: 'Router', data: {
        routes: [{ label: 'code', when: s => /code|function|script/i.test(s.output?.text || '') },
        { label: 'text', when: _ => true }]
    }
});
g.addNode({
    id: 'coder', kind: 'Agent', type: 'Coder', data: {
        system: 'Return ONLY runnable JS in triple backticks.',
        prompt: 'Write JS to accomplish: {{state.input}}.\nContext:\n{{state.output.text}}'
    }
});
g.addNode({ id: 'run', kind: 'Tool', data: { name: 'run_js' } });
g.addNode({
    id: 'eval', kind: 'Agent', type: 'Evaluator', data: {
        system: 'Be strict QA.',
        prompt: "Given plan + result:\nPlan:\n{{state.output.plan||state.output.text}}\nResult:\n{{state.output.result}}\nIs this acceptable? Reply 'PASS' or 'FAIL: <why>'."
    }
});
g.addNode({ id: 'guard', kind: 'Guard', data: { allow: (s: any) => /^PASS/.test(s.output?.text || '') } });
g.addNode({
    id: 'writer', kind: 'Agent', type: 'Writer', data: {
        system: 'You write final answers.',
        prompt: 'Write the final response to: {{state.input}} using the plan:\n{{state.output.text}}'
    }
});
g.addNode({ id: 'end', kind: 'End' });

// Edges
g.addEdge({ id: 'e1', from: 'start', to: 'router', label: 'success' });
g.addEdge({ id: 'e2', from: 'router', to: 'coder', label: 'code' });
g.addEdge({ id: 'e3', from: 'router', to: 'writer', label: 'text' });
g.addEdge({ id: 'e4', from: 'coder', to: 'run', label: 'success' });
g.addEdge({ id: 'e5', from: 'run', to: 'eval', label: 'success' });
g.addEdge({ id: 'e6', from: 'eval', to: 'guard', label: 'success' });
g.addEdge({ id: 'e7', from: 'guard', to: 'end', label: 'pass' });
g.addEdge({ id: 'e8', from: 'guard', to: 'start', label: 'fail' }); // retry loop
g.addEdge({ id: 'e9', from: 'writer', to: 'end', label: 'success' });

validateGraph(g);

const engine = new Engine(g, {
    llm,
    tools: builtinTools,
    maxSteps: 50,
    perNodeMs: 3000,
    onEvent: (event) => {
        console.log(`🔄 [${event.type}] ${event.nodeId || 'system'} @ ${new Date(event.ts).toISOString()}`);
    }
});

console.log('🚀 Agent Graph Demo\n');
console.log('Building a multi-step agentic workflow with routing, tools, and validation...\n');

(async () => {
    console.log('📊 Starting execution...\n');

    const runner = engine.run('start', 'compute 42 from 21*2');
    for await (const { trace, state } of runner) {
        const duration = trace.tEnd - trace.tStart;
        const status = trace.error ? `❌ ${trace.error}` : '✅';
        console.log(`[${trace.nodeId}] ${trace.kind} -> ${trace.next} (${duration}ms) ${status}`);

        // Show logs for this step
        const stepLogs = state.journal.filter(log => log.nodeId === trace.nodeId);
        stepLogs.forEach(log => {
            console.log(`  📝 ${log.level}: ${log.msg}`);
        });

        console.log('');
    }

    console.log('🎉 Execution completed!\n');
})().catch(console.error);