# Quick Start: TQL + Ratatui

Get started with the TQL Ratatui integration in 5 minutes.

## Installation

### 1. Install Rust (if not already installed)

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### 2. Build the TUI

From the TQL root directory:

```bash
# Development build
just tui-build

# Or production build (optimized)
just tui-build-release
```

## Usage

### Standalone Mode

Run the TUI directly without TypeScript:

```bash
# View interactive graph
just tui-graph

# Build queries interactively
just tui-query

# Launch full dashboard
just tui-dashboard
```

### Integrated Mode

Use from TypeScript for full IPC integration:

```typescript
import { TQLTUIBridge } from './src/cli/tui-bridge.js';
import { Graph } from './src/graph/graph.js';

// Create graph
const graph = new Graph();
graph.addNode({ id: 'start', label: 'Start', executor: 'function' });
graph.addNode({ id: 'end', label: 'End', executor: 'function' });
graph.addEdge({ id: 'e1', from: 'start', to: 'end', label: 'next' });

// Launch visualizer
const tui = new TQLTUIBridge();
await tui.launchGraphViewer(graph);

// Update node states in real-time
await tui.updateNodeState('start', 'running');
await tui.updateNodeState('start', 'success');
await tui.updateNodeState('end', 'running');
```

### CLI Integration

Add to your TQL CLI:

```bash
# In src/cli/tql.ts, add:
.command('graph')
  .description('Launch interactive graph viewer')
  .option('--watch', 'Watch for changes')
  .action(async (options) => {
    const tui = new TQLTUIBridge();
    await tui.launchGraphViewer(undefined, options.watch);
  });
```

## Examples

### Run Demos

```bash
# Graph visualizer with live updates
bun run examples/tql-tui-demo.ts graph

# Interactive query builder
bun run examples/tql-tui-demo.ts query

# Full dashboard
bun run examples/tql-tui-demo.ts dashboard
```

### View Sample Data

```bash
# Visualize workflow from YAML
tql-tui workflow --file examples/workflows/simple-demo.yml

# Explore JSON data
tql-tui explore data/posts.json
```

## Keyboard Shortcuts

### Global
- `q`: Quit
- `?`: Help

### Graph Viewer
- `↑/↓` or `j/k`: Navigate nodes
- `+/-`: Zoom in/out
- `Space`: Center view
- `Enter`: Inspect node

### Query Builder
- Type to build query
- `Backspace`: Delete
- `Enter`: Execute
- `↑/↓`: History

## Troubleshooting

### TUI won't launch

Make sure the Rust TUI is built:
```bash
just tui-build
```

### Can't find tql-tui binary

Install it to your PATH:
```bash
just tui-install
```

### Colors look wrong

Your terminal might not support true color. Try:
```bash
export COLORTERM=truecolor
```

### Over SSH

The TUI works great over SSH! Make sure your terminal supports:
- 256 colors or true color
- UTF-8 encoding

Test with:
```bash
echo $TERM  # Should be xterm-256color or similar
```

## Next Steps

- Read the [Full Integration Guide](./RATATUI-INTEGRATION.md)
- Explore [widget examples](../tql-tui/src/widgets/)
- Check out the [IPC Protocol](./RATATUI-INTEGRATION.md#ipc-protocol)
- Customize [themes](../tql-tui/src/theme.rs)

## Resources

- [Ratatui Documentation](https://docs.rs/ratatui)
- [Ratatui Examples](https://github.com/ratatui/ratatui/tree/main/examples)
- [TQL Documentation](../README.md)

## Support

Issues? Check:
1. Rust version: `rustc --version` (need 1.70+)
2. Build succeeded: `just tui-build`
3. Binary exists: `which tql-tui`

Still stuck? Open an issue with:
- OS and terminal info
- Error messages
- Steps to reproduce
