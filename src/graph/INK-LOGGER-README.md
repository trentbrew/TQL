# Ink Logger for TQL Graph Engine

This directory contains an interactive, React-based logger for the TQL Graph Engine built with [Ink](https://github.com/vadimdemedes/ink).

## Features

- **Interactive Terminal UI**:
  - Keyboard controls for navigation and filtering
  - Real-time updates with animated status indicators
  - Expandable node details with input/output data

- **Enhanced Graph Visualization**:
  - Color-coded node types and status indicators
  - Edge visualization with labels showing flow paths
  - Node execution timing and duration tracking
  - Visual hierarchical structure of workflow execution

- **Advanced Logging Capabilities**:
  - Structured log display with expandable data
  - Support for filtering logs by level
  - Customizable log retention and display options
  - Compatible with the existing Logger API

- **LLM Streaming Support**:
  - Real-time visualization of LLM text generation
  - Streaming output with animated cursor
  - Progress indicators for long-running operations
  - Detailed timing information for each step

## Usage

To use the Ink Logger in your Graph Engine:

```typescript
import { createLogger } from './graph/logger-index.js';
import { Engine } from './graph/engine.js';
import { Graph } from './graph/graph.js';

// Create a graph
const g = new Graph();
// Add nodes and edges...

// Create engine with Ink logger enabled
const engine = new Engine(g, { 
  // other options...
  logLevel: 'debug',
  useInk: true // Enable Ink logger
});

// Run your workflow
for await (const step of engine.run('startNodeId', initialInput)) {
  // The Ink logger automatically updates the UI
}
```

## Keyboard Controls

When the Ink logger is running, you can use these keyboard shortcuts:

### General Controls
- `q` - Quit the application
- `h` - Show/hide help menu
- `p` - Pause/resume log updates

### Log Navigation
- `m` - Show more logs (increase visible log count)
- `l` - Show fewer logs (decrease visible log count)

### Log Filtering
- `e` - Filter to show only errors
- `w` - Filter to show only warnings
- `i` - Filter to show only info logs
- `d` - Filter to show only debug logs
- `t` - Filter to show only trace logs
- `a` - Show all log levels

### Node Visualization
- `[1-9]` - Expand/collapse details for the corresponding node
  - Shows input/output data
  - Shows execution timing
  - Shows edge connections
  - Displays error details (if any)
  - Displays streaming output when available

## Available Demo Examples

The project includes several examples demonstrating the Ink logger capabilities:

1. **Basic Ink Logger Demo** (`demo:ink-logger`)
   - Basic workflow visualization
   - Node execution tracking with status indicators

2. **Orchestrator with Streaming** (`demo:ink-orchestrator`)
   - LLM-based workflow with streaming output
   - Decision routing based on LLM responses
   - Interactive streaming visualization

3. **TQL Query Visualization** (`demo:tql-ink`)
   - Complete TQL query execution visualization
   - Data loading, parsing, planning, and execution visualization
   - Results formatting and rendering
- `i` - Filter to show only info logs
- `d` - Filter to show only debug logs
- `t` - Filter to show only trace logs
- `a` - Show all logs (clear filter)

## Demo

Run the demo to see the Ink logger in action:

```bash
bun run demo:ink-logger
```

This will run a sample workflow with various node types and demonstrate the interactive logger capabilities.

## Implementation

The Ink logger implementation consists of:

- `InkLogger.tsx` - React components for the UI
- `logger-index.ts` - Factory function to create either standard or Ink loggers

The logger maintains compatibility with the original logger API, so it can be used as a drop-in replacement.