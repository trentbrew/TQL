#!/usr/bin/env bun

import { Graph } from '../src/graph/graph.js';
import { GraphEngine } from '../src/graph/engine.js';
import { builtinTools } from '../src/graph/tools.js';

console.log('🚀 TQL Query Tool Demo (Fixed for Real Data)\n');

// Mock AI text generator that produces appropriate queries for JSONPlaceholder data
const mockGenerate = (messages: Array<{ role: string; content: string }>) => {
    const lastMessage = messages[messages.length - 1];
    const prompt = lastMessage?.content;
    const system = messages.find(m => m.role === 'system')?.content;

    if (system?.includes('query analyst')) {
        // Generate queries appropriate for JSONPlaceholder schema
        if (prompt?.includes('popular posts')) {
            return { text: 'FIND post AS ?p WHERE ?p.userId = 1 RETURN ?p, ?p.title' };
        }
        if (prompt?.includes('recent users')) {
            return { text: 'FIND user AS ?u WHERE ?u.id > 5 RETURN ?u, ?u.name, ?u.email' };
        }
        if (prompt?.includes('analyze the data')) {
            return { text: 'FIND post AS ?p RETURN ?p, ?p.title, ?p.userId LIMIT 5' };
        }
    }
    if (system?.includes('report writer')) {
        return { text: 'Based on the query results, here is a comprehensive analysis of the data patterns and insights.' };
    }
    return { text: 'FIND post AS ?p RETURN ?p LIMIT 10' };
};

// Create graph for TQL analysis workflow
const g = new Graph();

// Load data from JSONPlaceholder
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

// AI query analyst
g.addNode({
    id: 'analyst',
    kind: 'LLM',
    data: {
        system: 'You are a data query analyst. Generate EQL-S queries for JSONPlaceholder data.',
        inputKey: 'prompt',
        outputKey: 'query'
    }
});

// Router based on data type
g.addNode({
    id: 'router',
    kind: 'Conditional',
    data: {
        condition: (state: any) => {
            const query = state.query;
            if (query?.includes('post')) return 'query_posts';
            if (query?.includes('user')) return 'query_users';
            return 'query_posts'; // default
        }
    }
});

// Execute queries
g.addNode({
    id: 'query_posts',
    kind: 'Tool',
    data: {
        name: 'tql_query',
        args: {
            entityType: 'post',
            idKey: 'id',
            state: true // Use state for data source
        },
        inputKey: 'query',
        outputKey: 'results'
    }
});

g.addNode({
    id: 'query_users',
    kind: 'Tool',
    data: {
        name: 'tql_query',
        args: {
            entityType: 'user',
            idKey: 'id',
            state: true
        },
        inputKey: 'query',
        outputKey: 'results'
    }
});

// Report writer
g.addNode({
    id: 'reporter',
    kind: 'LLM',
    data: {
        system: 'You are a report writer. Analyze query results and provide insights.',
        inputKey: 'results',
        outputKey: 'report'
    }
});

g.addNode({ id: 'end', kind: 'Terminal', data: {} });

// Connect the workflow
g.addEdge('load_data', 'load_users');
g.addEdge('load_users', 'analyst');
g.addEdge('analyst', 'router');
g.addEdge('router', 'query_posts', { condition: 'post' });
g.addEdge('router', 'query_users', { condition: 'user' });
g.addEdge('query_posts', 'reporter');
g.addEdge('query_users', 'reporter');
g.addEdge('reporter', 'end');

// Set up engine
const engine = new GraphEngine();
engine.setTools(builtinTools);
engine.setLLMGenerator(mockGenerate);

// Test scenarios
const scenarios = [
    "show me popular posts from user 1",
    "find recent users in the system",
    "analyze the data and show top content"
];

for (const prompt of scenarios) {
    console.log(`📊 Analyzing: "${prompt}"`);

    const result = await engine.execute(g, { prompt });

    if (result.error) {
        console.log('❌ Error:', result.error);
    } else {
        console.log(`🎉 Analysis completed! Final state has ${Object.keys(result.state?.memory || {}).length} memory items.`);

        // Show some results if available
        if (result.state?.results) {
            const res = result.state.results;
            if (res.ok && res.count > 0) {
                console.log(`📊 Query found ${res.count} results`);
                console.log('Sample result:', res.results[0]);
            }
        }
    }

    console.log('────────────────────────────────────────────────────────────');
}