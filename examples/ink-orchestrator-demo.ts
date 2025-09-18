import { Graph } from '../src/graph/graph.js';
import { Engine } from '../src/graph/engine.js';
import { makeDefaultExecutors } from '../src/graph/executors.js';
import { createLogger } from '../src/graph/logger-index.js';
import type { Node, Edge } from '../src/graph/types.js';
import { openai } from '@ai-sdk/openai';
import { generateText, streamText } from 'ai';

/**
 * This example demonstrates using the Ink Logger with the orchestrator
 * and LLM streaming capabilities for a more interactive experience.
 */
async function runEnhancedOrchestratorDemo() {
    console.log('Running Enhanced Orchestrator Demo with Ink Logger...');

    // Create a simple LLM-based workflow graph
    const g = new Graph();

    // Add nodes for our workflow
    g.addNode({ id: 'start', kind: 'Router' });
    g.addNode({
        id: 'interpretRequest',
        kind: 'Agent',
        data: {
            system: 'You are a helpful assistant that analyzes user queries to determine the appropriate action.',
            prompt: 'User request: "{{input.query}}"\n\nAnalyze this request and determine what action to take. Is this a question, a task, or something else?\n\nProvide your analysis in JSON format.',
            stream: true // Enable streaming
        }
    });
    g.addNode({
        id: 'answerQuestion',
        kind: 'Agent',
        data: {
            system: 'You are a helpful assistant that provides accurate, concise answers to questions.',
            prompt: 'User question: "{{input.query}}"\n\nProvide a helpful answer based on your knowledge.',
            stream: true // Enable streaming
        }
    });
    g.addNode({
        id: 'performTask',
        kind: 'Agent',
        data: {
            system: 'You are a helpful assistant that performs tasks requested by the user.',
            prompt: 'User has asked: "{{input.query}}"\n\nPerform this task to the best of your ability and explain what you did.',
            stream: true // Enable streaming
        }
    });
    g.addNode({ id: 'storeResults', kind: 'MemoryWrite', data: { key: 'lastResponse', from: 'output.text' } });
    g.addNode({ id: 'end', kind: 'End' });

    // Add edges to connect the nodes
    g.addEdge({ id: 'e1', from: 'start', to: 'interpretRequest', label: 'default' });
    g.addEdge({ id: 'e2', from: 'interpretRequest', to: 'answerQuestion', label: 'question' });
    g.addEdge({ id: 'e3', from: 'interpretRequest', to: 'performTask', label: 'task' });
    g.addEdge({ id: 'e4', from: 'answerQuestion', to: 'storeResults', label: 'default' });
    g.addEdge({ id: 'e5', from: 'performTask', to: 'storeResults', label: 'default' });
    g.addEdge({ id: 'e6', from: 'storeResults', to: 'end', label: 'default' });

    // Set up AI functions for generation and streaming (mock for demo)
    const llmFn = async ({ model, system, prompt }: any) => {
        console.log(`Generating response with model ${model}...`);
        // For demo, return mock responses to avoid API calls
        return { text: `This is a simulated response to: "${prompt}"` };
    };

    // Simulate streaming for demo purposes
    const streamFn = async ({ model, system, prompt }: any) => {
        const responses = [
            "I'm ",
            "analyzing ",
            "your ",
            "request ",
            "and ",
            "generating ",
            "a ",
            "thoughtful ",
            "response. ",
            "This ",
            "demonstrates ",
            "streaming ",
            "capabilities ",
            "in ",
            "the ",
            "TQL ",
            "Graph ",
            "Engine ",
            "with ",
            "Ink ",
            "visualization."
        ];

        // Return an AsyncIterable that yields chunks with delays
        return {
            [Symbol.asyncIterator]: async function* () {
                for (const chunk of responses) {
                    yield chunk;
                    // Add a small delay to simulate streaming
                    await new Promise(resolve => setTimeout(resolve, 150));
                }
            }
        };
    };

    // Custom Router executor for our workflow
    const customRouter = async (node: any, state: any) => {
        if (node.id === 'interpretRequest') {
            try {
                // Extract the intent from LLM response
                const response = state.output?.text || '';
                const jsonMatch = response.match(/\\{.*\\}/s);

                if (jsonMatch) {
                    try {
                        const analysis = JSON.parse(jsonMatch[0]);
                        const intent = analysis.intent || analysis.type || analysis.action;

                        if (intent && typeof intent === 'string') {
                            const normalizedIntent = intent.toLowerCase();

                            if (normalizedIntent.includes('question')) {
                                return { output: state.output, next: 'question' };
                            } else if (normalizedIntent.includes('task')) {
                                return { output: state.output, next: 'task' };
                            }
                        }
                    } catch (e) {
                        console.error('Error parsing JSON:', e);
                    }
                }

                // Default fallback: treat as question if we couldn't parse
                if (state.input.query.endsWith('?')) {
                    return { output: state.output, next: 'question' };
                } else {
                    return { output: state.output, next: 'task' };
                }
            } catch (error) {
                console.error('Router error:', error);
                return { output: state.output, next: 'question' }; // Default fallback
            }
        }

        // Default router behavior
        return { output: state.output, next: 'default' };
    };

    // Create executors with LLM and streaming
    const executors = makeDefaultExecutors({
        llm: llmFn,
        stream: streamFn,
        tools: {}
    });

    // Override the Router with our custom implementation
    executors.Router = customRouter;

    // Create engine with Ink logger
    const engine = new Engine(g, {
        executors,
        maxSteps: 10,
    });

    // Replace the engine's logger with an Ink-enabled one
    // @ts-ignore - accessing internal property
    engine.logger = createLogger({
        level: 'debug',
        useInk: true
    });

    // Start the workflow
    console.log("Starting enhanced orchestrator with Ink logger...");
    console.log("(Press 'h' for help, numbers to expand nodes, 'q' to quit)");

    // Process user query
    const userQuery = process.argv[2] || "What is the distance to the moon?";

    // Run the workflow
    for await (const step of engine.run('start', { query: userQuery })) {
        // The Ink logger automatically updates the UI
        // We don't need to do anything here
    }
}

// Run the demo
runEnhancedOrchestratorDemo().catch(console.error);