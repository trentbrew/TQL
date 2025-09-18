import { Graph } from '../src/graph/graph.js';
import { Engine } from '../src/graph/engine.js';
import { makeDefaultExecutors } from '../src/graph/executors.js';
import type { Node, Edge } from '../src/graph/types.js';

/**
 * This demo showcases the Ink-based graph visualization logger
 * which provides an interactive, colorful UI for tracking graph execution
 */
async function runInkLoggerDemo() {
    console.log('Running Ink Logger Demo...');

    // Build a simple workflow graph
    const g = new Graph();

    // Add nodes
    g.addNode({ id: 'start', kind: 'Router' });
    g.addNode({ id: 'queryData', kind: 'Tool' });
    g.addNode({ id: 'processResults', kind: 'Tool' });
    g.addNode({ id: 'decideNextStep', kind: 'Guard' });
    g.addNode({ id: 'fetchMoreDetails', kind: 'Tool' });
    g.addNode({ id: 'summarize', kind: 'Agent' });
    g.addNode({ id: 'storeResults', kind: 'MemoryWrite' });
    g.addNode({ id: 'end', kind: 'End' });

    // Add edges
    g.addEdge({ id: 'e1', from: 'start', to: 'queryData', label: 'default' });
    g.addEdge({ id: 'e2', from: 'queryData', to: 'processResults', label: 'default' });
    g.addEdge({ id: 'e3', from: 'processResults', to: 'decideNextStep', label: 'default' });
    g.addEdge({ id: 'e4', from: 'decideNextStep', to: 'fetchMoreDetails', label: 'needsMoreData' });
    g.addEdge({ id: 'e5', from: 'decideNextStep', to: 'summarize', label: 'hasEnoughData' });
    g.addEdge({ id: 'e6', from: 'fetchMoreDetails', to: 'summarize', label: 'default' });
    g.addEdge({ id: 'e7', from: 'summarize', to: 'storeResults', label: 'default' });
    g.addEdge({ id: 'e8', from: 'storeResults', to: 'end', label: 'default' });

    // Define mock tools and executors
    const mockLlm = async () => ({ text: "Simulated LLM response" });
    const mockTools = {
        echo: async (args: Record<string, unknown>) => args.text || "Echo"
    };

    // Use default executors as a base
    const defaultExecs = makeDefaultExecutors({
        llm: mockLlm,
        tools: mockTools
    });

    // Create custom executors
    const executors = {
        ...defaultExecs,

        // Override Router to always return a fixed 'default' path for the demo
        Router: async (node: any, state: any) => {
            console.log(`Router ${node.id} executing...`);
            return { output: state.input, next: 'default' };
        },
        Tool: async (node: any, state: any) => {
            const { id: nodeId } = node;
            const input = state.input;
            const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

            // Simulate tool execution with some delay
            if (nodeId === 'queryData') {
                await sleep(1000);
                return { output: { results: [1, 2, 3, 4, 5], complete: false }, next: 'default' };
            }

            if (nodeId === 'processResults') {
                await sleep(1500);
                return { output: { processed: true, needsMoreData: true }, next: 'default' };
            }

            if (nodeId === 'fetchMoreDetails') {
                await sleep(2000);
                return { output: { additionalData: { field1: 'value1', field2: 'value2' } }, next: 'default' };
            }

            return { output: { status: 'unknown tool' }, next: 'default' };
        },

        Guard: async (node: any, state: any) => {
            const { id: nodeId } = node;
            const input = state.input;

            // Simulate decision logic
            if (nodeId === 'decideNextStep') {
                const needsMoreData = input.processed && input.needsMoreData;
                return { output: input, next: needsMoreData ? 'needsMoreData' : 'hasEnoughData' };
            }

            return { output: input, next: 'default' };
        },

        Agent: async (node: any, state: any) => {
            const { id: nodeId } = node;
            const input = state.input;
            const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

            // Simulate LLM thinking
            if (nodeId === 'summarize') {
                await sleep(3000);
                return {
                    output: {
                        summary: "This is a demonstration of the interactive Ink logger for graph workflows",
                        items: input.results || [],
                        details: input.additionalData || {}
                    },
                    next: 'default'
                };
            }

            return { output: { result: 'unknown agent action' }, next: 'default' };
        },

        MemoryWrite: async (node: any, state: any) => {
            const input = state.input;
            // Simulate writing to memory
            return { output: { stored: true, data: input }, next: 'default' };
        }
    };

    // Create engine with interactive Ink logger
    const engine = new Engine(g, {
        maxSteps: 20,
        onEvent: (ev) => {
            console.log(`Event: ${ev.type} - ${ev.nodeId}`);
        }
    });

    // Start the workflow and show the interactive logger
    const initialInput = { query: "Show me the Ink logger in action" };

    console.log("Starting graph workflow with Ink logger...");
    console.log("(Press 'h' to see keyboard controls, 'q' to quit)");

    // Run the workflow
    for await (const step of engine.run('start', initialInput)) {
        // The Ink logger automatically updates the UI
        // We don't need to do anything here
    }
}

// Run the demo
runInkLoggerDemo().catch(console.error);