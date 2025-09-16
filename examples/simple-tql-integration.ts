#!/usr/bin/env bun

import { Graph } from '../src/graph/graph.js';
import { Engine } from '../src/graph/engine.js';
import { builtinTools } from '../src/graph/tools.js';

console.log('🚀 Simple TQL Integration Test\n');

// Create a simple graph: load data -> query -> end
const g = new Graph();

g.addNode({
    id: 'load',
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
    id: 'query',
    kind: 'Tool',
    data: {
        name: 'tql_query',
        args: {
            query: 'FIND post AS ?p WHERE ?p.userId = 1 RETURN ?p, ?p.title LIMIT 3',
            entityType: 'post',
            idKey: 'id',
            state: true
        }
    }
});

g.addNode({
    id: 'end',
    kind: 'End',
    data: {}
});

// Connect: load -> query -> end
g.addEdge({ id: 'e1', from: 'load', to: 'query', label: 'success' });
g.addEdge({ id: 'e2', from: 'query', to: 'end', label: 'success' });

// Execute
const engine = new Engine(g, { tools: builtinTools });

console.log('📊 Executing graph...');
try {
    console.log('Creating generator...');
    const gen = engine.run('load', {});

    console.log('Consuming generator steps...');
    let stepCount = 0;
    for await (const step of gen) {
        stepCount++;
        console.log(`  Step ${stepCount}: node ${step.state.traces?.[step.state.traces.length - 1]?.nodeId || 'unknown'}`);

        // Check for errors in this step
        const lastTrace = step.state.traces?.[step.state.traces.length - 1];
        if (lastTrace?.error) {
            console.log(`    ❌ Error: ${lastTrace.error}`);
        }

        // Show query results if available
        if (lastTrace?.nodeId === 'query' && step.state.output?.result?.results) {
            console.log(`    📋 Query returned ${step.state.output.result.count} results:`);
            step.state.output.result.results.slice(0, 2).forEach((result: any, i: number) => {
                console.log(`      ${i + 1}. Post ${result['?p'].id}: "${result['?p.title']}"`);
            });
        }
    }

    console.log('Getting final result...');
    const finalResult = await gen.next();
    console.log('Final result:', finalResult);

    const result = finalResult.value;
    console.log('Final state:', result ? 'present' : 'missing');

    if (result) {
        console.log('Memory keys:', Object.keys((result as any).memory || {}));
    }

} catch (error: any) {
    console.log('❌ Engine error:', error.message);
    console.log('Stack:', error.stack);
}