#!/usr/bin/env bun

import { Graph } from '../src/graph/graph.js';
import { Engine } from '../src/graph/engine.js';
import { builtinTools } from '../src/graph/tools.js';
import { colors } from '../src/graph/logger.js';

// Enhanced demo with visual workflow showcase
console.log(`${colors.brightCyan}╔══════════════════════════════════════════════════════════════╗${colors.reset}`);
console.log(`${colors.brightCyan}║${colors.reset} ${colors.bright}🎨 Beautiful ASCII Workflow Visualization Demo${colors.reset}           ${colors.brightCyan}║${colors.reset}`);
console.log(`${colors.brightCyan}║${colors.reset} ${colors.dim}Demonstrating workflow shape, syntax highlighting & animations${colors.reset} ${colors.brightCyan}║${colors.reset}`);
console.log(`${colors.brightCyan}╚══════════════════════════════════════════════════════════════╝${colors.reset}\n`);

// Create a more complex graph to show off the visual design
const g = new Graph();

// Load data node
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

// Query node
g.addNode({
    id: 'query_posts',
    kind: 'Tool',
    data: {
        name: 'tql_query',
        args: {
            query: 'FIND post AS ?p WHERE ?p.userId = 1 RETURN ?p.id, ?p.title, ?p.body LIMIT 5',
            entityType: 'post',
            idKey: 'id',
            state: true
        }
    }
});

// Memory write node
g.addNode({
    id: 'store_results',
    kind: 'MemoryWrite',
    data: {
        key: 'query_results',
        from: 'output.result'
    }
});

// Router for different paths
g.addNode({
    id: 'check_results',
    kind: 'Router',
    data: {
        routes: [
            {
                label: 'has_data',
                when: (state: any) => state.memory?.query_results?.results?.length > 0
            },
            {
                label: 'no_data',
                when: (state: any) => !state.memory?.query_results?.results?.length
            }
        ]
    }
});

// Success end
g.addNode({
    id: 'success_end',
    kind: 'End'
});

// Error end
g.addNode({
    id: 'error_end',
    kind: 'End'
});

// Connect the nodes
g.addEdge({ id: 'e1', from: 'load_data', to: 'query_posts', label: 'success' });
g.addEdge({ id: 'e2', from: 'query_posts', to: 'store_results', label: 'success' });
g.addEdge({ id: 'e3', from: 'store_results', to: 'check_results', label: 'success' });
g.addEdge({ id: 'e4', from: 'check_results', to: 'success_end', label: 'has_data' });
g.addEdge({ id: 'e5', from: 'check_results', to: 'error_end', label: 'no_data' });
g.addEdge({ id: 'e6', from: 'check_results', to: 'error_end', label: 'default' });

// Execute with beautiful visualization
const engine = new Engine(g, {
    tools: builtinTools,
    maxSteps: 20
});

console.log(`${colors.dim}Starting workflow execution...${colors.reset}\n`);

try {
    const gen = engine.run('load_data', {});

    let stepCount = 0;
    for await (const step of gen) {
        stepCount++;

        // Show minimal progress alongside the beautiful logger output
        const lastTrace = step.state.traces?.[step.state.traces.length - 1];
        if (lastTrace?.error) {
            console.log(`${colors.brightRed}    ⚠ Error detected in step ${stepCount}${colors.reset}`);
        }
    }

    const finalResult = await gen.next();

    // Show final summary
    console.log(`${colors.brightGreen}╭─────────────────────────────────────────────────────────────╮${colors.reset}`);
    console.log(`${colors.brightGreen}│${colors.reset} ${colors.bright}📊 Execution Summary${colors.reset}                                   ${colors.brightGreen}│${colors.reset}`);
    console.log(`${colors.brightGreen}│${colors.reset} ${colors.dim}• Total steps executed: ${stepCount}${colors.reset}                          ${colors.brightGreen}│${colors.reset}`);
    console.log(`${colors.brightGreen}│${colors.reset} ${colors.dim}• Workflow completed successfully${colors.reset}                       ${colors.brightGreen}│${colors.reset}`);
    console.log(`${colors.brightGreen}│${colors.reset} ${colors.dim}• Visual logging demonstration complete${colors.reset}               ${colors.brightGreen}│${colors.reset}`);
    console.log(`${colors.brightGreen}╰─────────────────────────────────────────────────────────────╯${colors.reset}`);

} catch (error: any) {
    console.log(`${colors.brightRed}╭─────────────────────────────────────────────────────────────╮${colors.reset}`);
    console.log(`${colors.brightRed}│${colors.reset} ${colors.bright}❌ Execution Failed${colors.reset}                                   ${colors.brightRed}│${colors.reset}`);
    console.log(`${colors.brightRed}│${colors.reset} ${colors.dim}Error: ${error.message}${colors.reset}                                ${colors.brightRed}│${colors.reset}`);
    console.log(`${colors.brightRed}╰─────────────────────────────────────────────────────────────╯${colors.reset}`);
}

console.log(`\n${colors.dim}Demo completed! 🎉${colors.reset}`);