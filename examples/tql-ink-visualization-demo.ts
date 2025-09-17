import { Graph } from '../src/graph/graph.js';
import { Engine } from '../src/graph/engine.js';
import { makeDefaultExecutors } from '../src/graph/executors.js';
import { createLogger } from '../src/graph/logger-index.js';
import { EAVStore, jsonEntityFacts } from '../src/eav-engine.js';

/**
 * This example demonstrates using Ink Logger with TQL for visualizing
 * a complex query workflow including data loading, query planning, and execution
 */
async function runTQLInkDemo() {
    console.log('Running TQL Ink Visualization Demo...');

    // Build a graph for TQL workflow
    const g = new Graph();

    // Add nodes to represent TQL workflow
    g.addNode({ id: 'start', kind: 'Router' });
    g.addNode({ id: 'loadData', kind: 'Tool' });
    g.addNode({ id: 'parseQuery', kind: 'Tool' });
    g.addNode({ id: 'planQuery', kind: 'Tool' });
    g.addNode({ id: 'executeQuery', kind: 'Tool' });
    g.addNode({ id: 'formatResults', kind: 'Tool' });
    g.addNode({ id: 'renderOutput', kind: 'Tool' });
    g.addNode({ id: 'end', kind: 'End' });

    // Add edges
    g.addEdge({ id: 'e1', from: 'start', to: 'loadData', label: 'default' });
    g.addEdge({ id: 'e2', from: 'loadData', to: 'parseQuery', label: 'default' });
    g.addEdge({ id: 'e3', from: 'parseQuery', to: 'planQuery', label: 'default' });
    g.addEdge({ id: 'e4', from: 'planQuery', to: 'executeQuery', label: 'default' });
    g.addEdge({ id: 'e5', from: 'executeQuery', to: 'formatResults', label: 'default' });
    g.addEdge({ id: 'e6', from: 'formatResults', to: 'renderOutput', label: 'default' });
    g.addEdge({ id: 'e7', from: 'renderOutput', to: 'end', label: 'default' });

    // Sample data for our TQL engine demo
    const sampleData = [
        { id: 1, type: 'post', title: 'First post', content: 'Hello world', userId: 1, views: 120 },
        { id: 2, type: 'post', title: 'Second post', content: 'Learning TQL', userId: 2, views: 430 },
        { id: 3, type: 'post', title: 'Datalog intro', content: 'Datalog is great', userId: 1, views: 980 },
        { id: 1, type: 'user', name: 'Alice', email: 'alice@example.com' },
        { id: 2, type: 'user', name: 'Bob', email: 'bob@example.com' }
    ];

    // Sample query
    const sampleQuery = "FIND post AS ?p, user AS ?u WHERE ?p.userId = ?u.id RETURN ?u.name, ?p.title, ?p.views ORDER BY ?p.views DESC";

    // Custom executors for TQL workflow visualization
    const customExecutors = {
        Tool: async (node: any, state: any) => {
            const { id: nodeId } = node;
            const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

            // Simulate each step of the TQL workflow
            if (nodeId === 'loadData') {
                await sleep(800);

                // Create a new EAV store and ingest data
                const store = new EAVStore();

                // Generate facts from each sample data item
                for (const item of sampleData) {
                    const entityId = `${item.type}:${item.id}`;
                    const facts = jsonEntityFacts(entityId, item, item.type);
                    store.addFacts(facts);
                }

                return {
                    output: {
                        store,
                        dataStats: {
                            entities: sampleData.length,
                            types: [...new Set(sampleData.map(item => item.type))],
                            attributes: new Set(sampleData.flatMap(item => Object.keys(item))).size
                        }
                    },
                    next: 'default'
                };
            }

            if (nodeId === 'parseQuery') {
                await sleep(1200);

                return {
                    output: {
                        ...state.output,
                        query: sampleQuery,
                        parsedQuery: {
                            entityBindings: [
                                { variable: '?p', type: 'post' },
                                { variable: '?u', type: 'user' }
                            ],
                            whereConditions: [
                                { leftVar: '?p', leftAttr: 'userId', operator: '=', rightVar: '?u', rightAttr: 'id' }
                            ],
                            projections: ['?u.name', '?p.title', '?p.views'],
                            orderBy: { variable: '?p', attribute: 'views', direction: 'DESC' }
                        }
                    },
                    next: 'default'
                };
            }

            if (nodeId === 'planQuery') {
                await sleep(1500);

                return {
                    output: {
                        ...state.output,
                        queryPlan: {
                            steps: [
                                { operation: 'SCAN', entity: 'user', variable: '?u' },
                                { operation: 'SCAN', entity: 'post', variable: '?p' },
                                { operation: 'JOIN', left: '?p.userId', right: '?u.id' },
                                { operation: 'PROJECT', attributes: ['?u.name', '?p.title', '?p.views'] },
                                { operation: 'SORT', attribute: '?p.views', direction: 'DESC' }
                            ],
                            estimatedComplexity: 'O(n²)'
                        }
                    },
                    next: 'default'
                };
            }

            if (nodeId === 'executeQuery') {
                await sleep(2000);

                // Simulate query execution result
                const results = [
                    { name: 'Alice', title: 'Datalog intro', views: 980 },
                    { name: 'Bob', title: 'Second post', views: 430 },
                    { name: 'Alice', title: 'First post', views: 120 }
                ];

                return {
                    output: {
                        ...state.output,
                        results,
                        executionStats: {
                            entitiesScanned: 5,
                            rowsProduced: 3,
                            executionTimeMs: 42
                        }
                    },
                    next: 'default'
                };
            }

            if (nodeId === 'formatResults') {
                await sleep(800);

                // Format results as a table
                const results = state.output.results;
                const formattedTable = [
                    '┌───────┬───────────────┬───────┐',
                    '│ name  │ title         │ views │',
                    '├───────┼───────────────┼───────┤',
                    ...results.map((r: any) =>
                        `│ ${r.name.padEnd(5)} │ ${r.title.padEnd(13)} │ ${String(r.views).padEnd(5)} │`
                    ),
                    '└───────┴───────────────┴───────┘'
                ].join('\n');

                return {
                    output: {
                        ...state.output,
                        formattedResults: formattedTable
                    },
                    next: 'default'
                };
            }

            if (nodeId === 'renderOutput') {
                await sleep(1000);

                return {
                    output: {
                        ...state.output,
                        displayMode: 'table',
                        renderedAt: new Date().toISOString()
                    },
                    next: 'default'
                };
            }

            return { output: { status: 'unknown tool' }, next: 'default' };
        }
    };

    // Create executors
    const executors = {
        ...makeDefaultExecutors({
            llm: async () => ({ text: 'Simulated response' }),
            tools: {}
        }),
        ...customExecutors
    };

    // Create engine with Ink logger
    const engine = new Engine(g, {
        executors,
        maxSteps: 10,
        logLevel: 'debug'
    });

    // Replace logger with Ink logger
    // @ts-ignore - accessing internal property
    engine.logger = createLogger({
        level: 'debug',
        useInk: true
    });

    console.log("Starting TQL workflow visualization with Ink logger...");
    console.log("(Press 'h' to see keyboard controls, numbers to expand nodes, 'q' to quit)");

    // Define initial input - a request to run a TQL query
    const initialInput = {
        dataSource: 'sample-data',
        query: sampleQuery
    };

    // Run the workflow
    for await (const step of engine.run('start', initialInput)) {
        // The Ink logger automatically updates the UI
    }
}

// Run the demo
runTQLInkDemo().catch(console.error);