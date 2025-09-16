import { Engine } from '../src/graph/engine.js';
import { Graph } from '../src/graph/graph.js';
import { validateGraph } from '../src/graph/validators.js';
import { builtinTools } from '../src/graph/tools.js';
import type { LLMClient } from '../src/graph/types.js';

// Mock LLM for data analysis
const llm: LLMClient = async ({ system, prompt }) => {
    if (system?.includes('data analyst')) {
        // Simulate intelligent query generation based on the prompt
        if (prompt?.includes('popular posts')) {
            return { text: 'FIND post AS ?p WHERE ?p.reactions.likes > 1000 RETURN ?p, ?p.title, ?p.reactions.likes' };
        }
        if (prompt?.includes('recent users')) {
            return { text: 'FIND user AS ?u WHERE ?u.id > 5 RETURN ?u, ?u.name, ?u.email' };
        }
        if (prompt?.includes('analyze the data')) {
            return { text: 'FIND post AS ?p RETURN ?p, ?p.title, ?p.views ORDER BY ?p.views DESC LIMIT 5' };
        }
    }
    if (system?.includes('report writer')) {
        return { text: 'Based on the query results, here is a comprehensive analysis of the data patterns and insights.' };
    }
    return { text: 'FIND post AS ?p RETURN ?p LIMIT 10' };
};

// Create graph for TQL analysis workflow
const g = new Graph();

// Nodes for a data analysis pipeline
g.addNode({
    id: 'load_data',
    kind: 'Tool',
    data: {
        name: 'tql_load_data',
        args: {
            dataUrl: 'https://jsonplaceholder.typicode.com/posts',
            key: 'posts'
        }
    }
});

g.addNode({
    id: 'load_users',
    kind: 'Tool',
    data: {
        name: 'tql_load_data',
        args: {
            dataUrl: 'https://jsonplaceholder.typicode.com/users',
            key: 'users'
        }
    }
});

g.addNode({
    id: 'analyst',
    kind: 'Agent',
    type: 'DataAnalyst',
    data: {
        system: 'You are a data analyst. Generate EQL-S queries based on user requests.',
        prompt: 'Generate an EQL-S query for: {{input}}\n\nAvailable data: {{state.output.message || "posts and users"}}'
    }
});

g.addNode({
    id: 'query_posts',
    kind: 'Tool',
    data: {
        name: 'tql_query',
        args: {
            entityType: 'post',
            limit: 10
        }
    }
});

g.addNode({
    id: 'query_users',
    kind: 'Tool',
    data: {
        name: 'tql_query',
        args: {
            entityType: 'user',
            limit: 10
        }
    }
});

g.addNode({
    id: 'router',
    kind: 'Router',
    data: {
        routes: [
            { label: 'posts', when: s => /post|title|body|content/i.test(s.output?.text || '') },
            { label: 'users', when: s => /user|name|email|address/i.test(s.output?.text || '') }
        ]
    }
});

g.addNode({
    id: 'reporter',
    kind: 'Agent',
    type: 'ReportWriter',
    data: {
        system: 'You are a report writer. Summarize query results clearly.',
        prompt: 'Summarize these query results:\n\nQuery: {{state.memory.query}}\nResults: {{state.output.results}}\nCount: {{state.output.count}}'
    }
});

g.addNode({ id: 'end', kind: 'End' });

// Edges for the workflow
g.addEdge({ id: 'e1', from: 'load_data', to: 'load_users', label: 'success' });
g.addEdge({ id: 'e2', from: 'load_users', to: 'analyst', label: 'success' });
g.addEdge({ id: 'e3', from: 'analyst', to: 'router', label: 'success' });
g.addEdge({ id: 'e4', from: 'router', to: 'query_posts', label: 'posts' });
g.addEdge({ id: 'e5', from: 'router', to: 'query_users', label: 'users' });
g.addEdge({ id: 'e6', from: 'query_posts', to: 'reporter', label: 'success' });
g.addEdge({ id: 'e7', from: 'query_users', to: 'reporter', label: 'success' });
g.addEdge({ id: 'e8', from: 'reporter', to: 'end', label: 'success' });

validateGraph(g);

const engine = new Engine(g, {
    llm,
    tools: builtinTools,
    maxSteps: 20,
    perNodeMs: 10000,
    onEvent: (event) => {
        if (event.type === 'node.end') {
            console.log(`✅ [${event.nodeId}] completed in ${event.data?.tEnd - event.data?.tStart}ms`);
        }
    }
});

console.log('🚀 TQL Query Tool Demo\n');
console.log('Building a data analysis workflow that loads data, generates queries, and produces reports...\n');

async function runAnalysis(request: string) {
    console.log(`📊 Analyzing: "${request}"\n`);

    const runner = engine.run('load_data', request);
    let finalState;

    for await (const { trace, state } of runner) {
        if (trace.error) {
            console.log(`❌ [${trace.nodeId}] ${trace.error}`);
        } else {
            // Show interesting outputs
            if (trace.nodeId === 'load_data' || trace.nodeId === 'load_users') {
                console.log(`📁 [${trace.nodeId}] ${state.output?.message || 'Data loaded'}`);
            } else if (trace.nodeId === 'analyst') {
                console.log(`🧠 [${trace.nodeId}] Generated query: ${state.output?.text}`);
                // Store query in memory for the reporter
                state.memory.query = state.output?.text;
            } else if (trace.nodeId === 'query_posts' || trace.nodeId === 'query_users') {
                console.log(`🔍 [${trace.nodeId}] Found ${state.output?.count || 0} results (${state.output?.executionTime?.toFixed(2)}ms)`);
                if (state.output?.results && state.output.results.length > 0) {
                    console.log(`   Sample: ${JSON.stringify(state.output.results[0], null, 2)}`);
                }
            } else if (trace.nodeId === 'reporter') {
                console.log(`📝 [${trace.nodeId}] ${state.output?.text}`);
            }
        }
        finalState = state;
    }

    console.log(`\n🎉 Analysis completed! Final state has ${Object.keys(finalState?.memory || {}).length} memory items.\n`);
    return finalState;
}

// Run different analysis scenarios
(async () => {
    try {
        await runAnalysis('show me popular posts with high engagement');
        console.log('─'.repeat(60));
        await runAnalysis('find recent users in the system');
        console.log('─'.repeat(60));
        await runAnalysis('analyze the data and show top content');
    } catch (error) {
        console.error('Error:', error);
    }
})();