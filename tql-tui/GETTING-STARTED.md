# TQL + Ratatui Integration 🦀 + 📊

This directory contains a complete Ratatui-based Terminal User Interface for TQL.

## Quick Start

### 1. Build the Rust TUI

```bash
# From the TQL root directory
just tui-build

# Or build release version
just tui-build-release
```

### 2. Run Standalone

```bash
# Graph visualizer
just tui-graph

# Query builder
just tui-query

# Full dashboard
just tui-dashboard
```

### 3. Run from TypeScript

```bash
# Graph viewer demo
bun run examples/tql-tui-demo.ts graph

# Query builder demo
bun run examples/tql-tui-demo.ts query

# Dashboard demo
bun run examples/tql-tui-demo.ts dashboard
```

## Features

### 🎨 Graph Visualizer
- Interactive workflow graph visualization
- Real-time state updates
- Pan and zoom controls
- Node inspection

### 📝 Query Builder
- Schema-aware autocomplete
- Live query validation
- Result preview
- Query history

### 📊 Workflow Monitor
- Real-time execution tracking
- Performance metrics
- Error reporting
- Log streaming

### 🔍 Data Explorer
- Entity browsing
- Relationship visualization
- Search and filter
- Quick actions

### 📈 Dashboard
- Unified interface with tabs
- Global search
- Quick stats
- Recent activity

## Architecture

```
TypeScript (TQL Core)
        ↕
    JSON-RPC
        ↕
Rust (Ratatui TUI)
```

Communication happens via stdin/stdout using JSON-RPC protocol.

## Development

### Project Structure

```
tql-tui/
├── src/
│   ├── main.rs           # CLI entry point
│   ├── app.rs            # Application loop
│   ├── screens/          # Main views
│   ├── widgets/          # Reusable components
│   ├── ipc/              # IPC bridge
│   └── theme.rs          # Styling
├── Cargo.toml
└── README.md
```

### Adding New Screens

1. Create screen in `src/screens/`
2. Implement `Screen` trait
3. Add to `screens/mod.rs`
4. Add CLI command in `main.rs`

### Testing

```bash
cd tql-tui
cargo test
```

### Formatting & Linting

```bash
cd tql-tui
cargo fmt
cargo clippy
```

## Examples

See `examples/tql-tui-demo.ts` for integration examples.

## Documentation

- [Full Integration Guide](../docs/RATATUI-INTEGRATION.md)
- [IPC Protocol](../docs/RATATUI-INTEGRATION.md#ipc-protocol)
- [Keyboard Shortcuts](./README.md#keyboard-shortcuts)

## Requirements

- Rust 1.70+
- Terminal with 256 color or true color support
- Works over SSH!

## License

MIT
