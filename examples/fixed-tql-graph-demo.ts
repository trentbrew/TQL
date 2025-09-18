#!/usr/bin/env node

import { Graph } from '../src/graph/graph.js';
import { Engine } from '../src/graph/engine.js';
import { builtinTools } from '../src/graph/tools.js';

console.log('🚀 TQL Query Tool Demo (Fixed for Real Data)\n');

// Mock AI text generator that produces appropriate queries for JSONPlaceholder data
const mockGenerate = async (req: { model?: string; system?: string; prompt: string }) => {
    const prompt = req.prompt;
    const system = req.system;

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
    kind: 'Agent',
    data: {
        system: 'You are a data query analyst. Generate EQL-S queries for JSONPlaceholder data.',
        inputKey: 'prompt',
        outputKey: 'query'
    }
});

// Router based on data type
g.addNode({
    id: 'router',
    kind: 'Router',
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
    kind: 'Agent',
    data: {
        system: 'You are a report writer. Analyze query results and provide insights.',
        inputKey: 'results',
        outputKey: 'report'
    }
});

g.addNode({ id: 'end', kind: 'End', data: {} });

// Connect the workflow
g.addEdge({ id: 'e1', from: 'load_data', to: 'load_users' });
g.addEdge({ id: 'e2', from: 'load_users', to: 'analyst' });
g.addEdge({ id: 'e3', from: 'analyst', to: 'router' });
g.addEdge({ id: 'e4', from: 'router', to: 'query_posts', label: 'post' });
g.addEdge({ id: 'e5', from: 'router', to: 'query_users', label: 'user' });
g.addEdge({ id: 'e6', from: 'query_posts', to: 'reporter' });
g.addEdge({ id: 'e7', from: 'query_users', to: 'reporter' });
g.addEdge({ id: 'e8', from: 'reporter', to: 'end' });

// Set up engine
const engine = new Engine(g, {
    llm: mockGenerate,
    tools: builtinTools
});

// Test scenarios
const scenarios = [
    "show me popular posts from user 1",
    "find recent users in the system",
    "analyze the data and show top content"
];

for (const prompt of scenarios) {
    console.log(`📊 Analyzing: "${prompt}"`);

    try {
        let finalState: any;
        for await (const { state } of engine.run('load_data', { prompt })) {
            finalState = state;
        }

        console.log(`🎉 Analysis completed! Final state has ${Object.keys(finalState?.memory || {}).length} memory items.`);

        // Show some results if available
        if (finalState?.results) {
            const res = finalState.results;
            if (res.ok && res.count > 0) {
                console.log(`📊 Query found ${res.count} results`);
                console.log('Sample result:', res.results[0]);
            }
        }
    } catch (error) {
        console.log('❌ Error:', error);
    }

    console.log('────────────────────────────────────────────────────────────');
}