# TQL-TUI

Interactive Terminal User Interface for TQL (Tree Query Language) built with Ratatui.

## Features

- **Graph Visualizer**: Interactive visualization of workflow graphs
- **Query Builder**: Build and execute EQL-S queries with autocomplete
- **Workflow Monitor**: Real-time workflow execution monitoring
- **Data Explorer**: Browse entities and relationships
- **Dashboard**: Unified view of all TQL features

## Installation

### Prerequisites

- Rust 1.70 or later
- A terminal that supports 256 colors or true color

### Build from Source

```bash
cd tql-tui
cargo build --release
```

The binary will be available at `target/release/tql-tui`.

## Usage

### Graph Visualizer

```bash
# Launch with demo graph
tql-tui graph

# Load graph from file
tql-tui graph --file ./workflow.json

# Watch for changes
tql-tui graph --file ./workflow.json --watch
```

**Controls:**
- `↑/↓` or `j/k`: Navigate nodes
- `+/-`: Zoom in/out
- `q`: Quit

### Query Builder

```bash
# Launch query builder
tql-tui query

# With data file
tql-tui query --data ./data.json
```

**Controls:**
- Type to build query
- `Backspace`: Delete character
- `Enter`: Execute query
- `q`: Quit

### Workflow Monitor

```bash
tql-tui workflow --file ./workflow.yaml
```

### Data Explorer

```bash
tql-tui explore ./data.json
```

### Dashboard

```bash
# Launch full dashboard
tql-tui dashboard

# With workspace
tql-tui dashboard --workspace ./workspace.db
```

## Development

### Run with Cargo

```bash
# Graph viewer
cargo run -- graph

# Query builder
cargo run -- query

# All commands
cargo run -- --help
```

### Run Tests

```bash
cargo test
```

### Run Examples

```bash
cargo run --example graph_demo
cargo run --example query_demo
```

## Architecture

```
tql-tui/
├── src/
│   ├── main.rs              # Entry point & CLI
│   ├── app.rs               # Application loop & setup
│   ├── theme.rs             # Color themes & styling
│   ├── state/               # Application state management
│   ├── screens/             # Main application screens
│   │   ├── graph_viewer.rs
│   │   ├── query_builder.rs
│   │   ├── workflow_monitor.rs
│   │   ├── data_explorer.rs
│   │   └── dashboard.rs
│   ├── widgets/             # Reusable UI components
│   └── ipc/                 # IPC with TQL TypeScript core
│       ├── client.rs
│       └── protocol.rs
```

## IPC Protocol

The TUI communicates with the TQL TypeScript core via JSON-RPC over stdin/stdout.

### Example Messages

**Execute Query:**
```json
{
  "jsonrpc": "2.0",
  "method": "executeQuery",
  "params": { "query": "FIND user AS ?u" },
  "id": 1
}
```

**Load Graph:**
```json
{
  "jsonrpc": "2.0",
  "method": "loadGraph",
  "params": { "graph": { "nodes": [...], "edges": [...] } },
  "id": 2
}
```

## Themes

The default theme is cyan/blue, but you can customize colors by modifying `src/theme.rs`.

Included themes:
- Default (Cyan)
- Nord (Nordic color palette)

## Keyboard Shortcuts

Global shortcuts (available in all views):
- `q`: Quit application
- `?`: Show help

Screen-specific shortcuts are shown at the bottom of each screen.

## Contributing

Contributions are welcome! Please see the main TQL CONTRIBUTING.md for guidelines.

## License

MIT License - See main TQL LICENSE file for details.
