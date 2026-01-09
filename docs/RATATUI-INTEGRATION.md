# Ratatui Integration for TQL

## Overview

This document outlines the integration of [Ratatui](https://github.com/ratatui/ratatui) (Rust TUI framework) into the TQL project to provide rich, interactive terminal user interfaces for graph visualization, query building, and workflow monitoring.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ TypeScript/Bun Layer (TQL Core)                             │
│ ├─ TrellisKernel                                            │
│ ├─ Graph Engine                                             │
│ ├─ Query Engine (EQL-S)                                     │
│ └─ Workflow Engine                                          │
└──────────────────┬──────────────────────────────────────────┘
                   │ IPC (stdin/stdout JSON-RPC or Unix Socket)
┌──────────────────▼──────────────────────────────────────────┐
│ Rust Layer (Ratatui TUI)                                    │
│ ├─ tql-tui (main binary)                                    │
│ ├─ Graph Visualizer Widget                                  │
│ ├─ Interactive Query Builder                                │
│ ├─ Workflow Monitor                                         │
│ └─ Real-time Results Viewer                                 │
└─────────────────────────────────────────────────────────────┘
```

## Components to Build

### 1. **Graph Visualizer** (`tql-graph-viewer`)

Interactive visualization of TQL graph workflows using Ratatui's Canvas widget.

**Features:**
- Node rendering with state colors (pending, running, success, error)
- Edge rendering with labels
- Pan and zoom controls
- Real-time state updates during workflow execution
- Node inspection on selection
- Minimap overview

**Controls:**
- Arrow keys: Navigate graph
- Space: Center view on selected node
- Enter: Inspect node details
- Tab: Switch between graph and node detail view
- `q`: Quit

**Example:**
```
┌─ TQL Graph Viewer ─────────────────────────────────────────┐
│                                                             │
│         ┌──────┐                                            │
│         │ init │  ✓                                         │
│         └───┬──┘                                            │
│             │ NEXT                                          │
│         ┌───▼────┐                                          │
│         │ query  │  ▶ Running...                            │
│         └───┬────┘                                          │
│             │ result                                        │
│         ┌───▼─────┐                                         │
│         │ analyze │  ⏸ Pending                              │
│         └─────────┘                                         │
│                                                             │
│  [Graph] [Details] [Logs]                    Step: 2/5     │
└─────────────────────────────────────────────────────────────┘
┌─ Node Details: query ──────────────────────────────────────┐
│ Type: llm                                                   │
│ State: running                                              │
│ Input: { query: "Find all users..." }                      │
│ Output: {...}                                               │
│ Duration: 1.2s                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2. **Interactive Query Builder** (`tql-query-builder`)

A guided TUI for building EQL-S queries with autocomplete and validation.

**Features:**
- Schema-aware entity type suggestions
- Attribute autocomplete
- Syntax highlighting
- Live query validation
- Query history with recall (arrow up/down)
- Result preview
- Export to file

**Example:**
```
┌─ TQL Query Builder ────────────────────────────────────────┐
│                                                             │
│ Query:                                                      │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ FIND user AS ?u                                         │ │
│ │ WHERE ?u.age > 18                                       │ │
│ │ RETURN ?u.name, ?u.email                                │ │
│ │ ORDER BY ?u.name ASC                                    │ │
│ │ LIMIT 10_                                               │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Suggestions: type, user, post, comment                     │
│ ✓ Valid syntax                                             │
│                                                             │
├─ Results (10 rows, 15.3ms) ────────────────────────────────┤
│ ┌─────────────────┬──────────────────────────────────────┐ │
│ │ name            │ email                                │ │
│ ├─────────────────┼──────────────────────────────────────┤ │
│ │ Alice Smith     │ alice@example.com                    │ │
│ │ Bob Johnson     │ bob@example.com                      │ │
│ └─────────────────┴──────────────────────────────────────┘ │
│                                                             │
│ [F1] Help [F2] History [F5] Execute [Ctrl+S] Save [q] Quit │
└─────────────────────────────────────────────────────────────┘
```

### 3. **Workflow Monitor** (`tql-workflow-monitor`)

Real-time monitoring of workflow execution with logs and metrics.

**Features:**
- Live workflow progress bar
- Step-by-step execution trace
- Node state transitions
- Error display with stack traces
- Performance metrics (duration per node)
- Pause/resume controls
- Log streaming

**Example:**
```
┌─ Workflow Monitor: data-analysis ──────────────────────────┐
│ Progress: ████████████░░░░░░░░░░░ 60% (3/5 steps)          │
│ Duration: 3.2s                                              │
│                                                             │
├─ Execution Timeline ───────────────────────────────────────┤
│ ✓ init          (500ms)  │▓▓▓▓░░░░░░│                      │
│ ✓ query         (1.2s)   │▓▓▓▓▓▓▓▓▓▓▓▓░░░│                 │
│ ▶ analyze       (1.5s)   │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓...               │
│ ⏸ format        (-)      │░░░░░░░░░░│                      │
│ ⏸ output        (-)      │░░░░░░░░░░│                      │
│                                                             │
├─ Logs ─────────────────────────────────────────────────────┤
│ [12:34:56] INFO  Starting workflow                         │
│ [12:34:56] DEBUG Loaded 1,234 entities                     │
│ [12:34:57] INFO  Query returned 45 results                 │
│ [12:34:58] DEBUG Processing analysis...                    │
│ [12:34:59] WARN  Large dataset, this may take a moment     │
│                                                             │
│ [Space] Pause [r] Restart [l] Logs [g] Graph [q] Quit     │
└─────────────────────────────────────────────────────────────┘
```

### 4. **Data Explorer** (`tql-explorer`)

Interactive data browser for exploring entities and relationships.

**Features:**
- Entity list with filtering
- Relationship graph visualization
- Attribute value inspection
- Search and filter
- Navigation breadcrumbs
- Quick actions (query this entity, show relationships)

**Example:**
```
┌─ TQL Data Explorer ────────────────────────────────────────┐
│ Path: / > users > user:123                                 │
│                                                             │
├─ Entity: user:123 ─────────────────────────────────────────┤
│ Type: user                                                  │
│ ┌───────────────┬───────────────────────────────────────┐  │
│ │ Attribute     │ Value                                 │  │
│ ├───────────────┼───────────────────────────────────────┤  │
│ │ name          │ Alice Smith                           │  │
│ │ email         │ alice@example.com                     │  │
│ │ age           │ 28                                    │  │
│ │ active        │ true                                  │  │
│ └───────────────┴───────────────────────────────────────┘  │
│                                                             │
├─ Relationships ────────────────────────────────────────────┤
│ AUTHORED → 12 posts                                        │
│ FOLLOWS  → 45 users                                        │
│ MEMBER_OF → 3 groups                                       │
│                                                             │
│ [↑/↓] Navigate [→] Expand [←] Back [/] Search [q] Quit    │
└─────────────────────────────────────────────────────────────┘
```

### 5. **Dashboard** (`tql-dashboard`)

Unified dashboard combining multiple views with tabs.

**Features:**
- Tabbed interface (Graph, Query, Data, Workflows, Insights)
- Global search
- Quick stats
- Recent queries
- Active workflows

## Implementation Plan

### Phase 1: Foundation (Week 1)

- [x] Create Rust workspace structure
- [ ] Setup basic Ratatui app scaffold
- [ ] Implement IPC bridge (JSON-RPC over stdin/stdout)
- [ ] Create TypeScript client for spawning Rust TUI
- [ ] Basic graph visualization widget

### Phase 2: Core Features (Week 2-3)

- [ ] Interactive query builder
- [ ] Workflow monitor with real-time updates
- [ ] Data explorer
- [ ] Enhanced graph visualizer with zoom/pan

### Phase 3: Polish & Integration (Week 4)

- [ ] Dashboard with tabs
- [ ] Color themes (match TQL brand)
- [ ] Configuration file support
- [ ] Keyboard shortcut customization
- [ ] Performance optimization

### Phase 4: Advanced Features (Week 5+)

- [ ] Mouse support for clickable nodes
- [ ] Graph export (SVG, PNG)
- [ ] Query suggestions with AI
- [ ] Diff view for comparing query results
- [ ] Plugin system for custom widgets

## Project Structure

```
tql-tui/
├── Cargo.toml
├── src/
│   ├── main.rs                    # Entry point
│   ├── app.rs                     # Main app state & loop
│   ├── ipc/
│   │   ├── mod.rs
│   │   ├── client.rs              # IPC client for TQL core
│   │   └── protocol.rs            # JSON-RPC protocol definitions
│   ├── widgets/
│   │   ├── mod.rs
│   │   ├── graph_viewer.rs        # Graph visualization
│   │   ├── query_builder.rs      # Interactive query builder
│   │   ├── workflow_monitor.rs   # Workflow execution monitor
│   │   ├── data_explorer.rs      # Data browser
│   │   └── results_table.rs      # Results display
│   ├── screens/
│   │   ├── mod.rs
│   │   ├── dashboard.rs           # Main dashboard
│   │   ├── graph.rs               # Graph view
│   │   ├── query.rs               # Query view
│   │   └── data.rs                # Data view
│   ├── state/
│   │   ├── mod.rs
│   │   └── app_state.rs           # Global application state
│   └── theme.rs                   # Color schemes and styling
├── examples/
│   ├── graph_demo.rs
│   ├── query_demo.rs
│   └── workflow_demo.rs
└── README.md
```

## TypeScript Integration

### Usage from TQL CLI

```typescript
// src/cli/tql-tui.ts
import { spawn } from 'child_process';

export class TQLTUIBridge {
  private tuiProcess: ChildProcess | null = null;

  async launchGraphViewer(graphData: any) {
    this.tuiProcess = spawn('tql-tui', ['graph'], {
      stdio: ['pipe', 'inherit', 'inherit'],
    });

    // Send graph data via JSON-RPC
    this.send({
      jsonrpc: '2.0',
      method: 'loadGraph',
      params: { graph: graphData },
      id: 1,
    });
  }

  async launchQueryBuilder() {
    this.tuiProcess = spawn('tql-tui', ['query'], {
      stdio: ['pipe', 'pipe', 'inherit'],
    });

    // Setup bidirectional communication
    this.setupIPC();
  }

  private send(message: any) {
    if (this.tuiProcess?.stdin) {
      this.tuiProcess.stdin.write(JSON.stringify(message) + '\n');
    }
  }

  private setupIPC() {
    this.tuiProcess?.stdout?.on('data', (data) => {
      const message = JSON.parse(data.toString());
      this.handleMessage(message);
    });
  }

  private async handleMessage(message: any) {
    // Handle JSON-RPC requests from Rust TUI
    if (message.method === 'executeQuery') {
      const result = await this.kernel.query(message.params.query);
      this.send({
        jsonrpc: '2.0',
        result: result,
        id: message.id,
      });
    }
  }
}
```

### CLI Commands

```bash
# Launch graph visualizer
tql graph ./my-workflow.yaml --watch

# Launch interactive query builder
tql query --interactive data/posts.json

# Monitor workflow execution
tql workflow run ./analysis.yaml --monitor

# Launch full dashboard
tql dashboard ./workspace.db

# Explore data
tql explore data/users.json
```

## IPC Protocol

### Messages from TypeScript → Rust

```json
// Load graph data
{
  "jsonrpc": "2.0",
  "method": "loadGraph",
  "params": {
    "graph": {
      "nodes": [...],
      "edges": [...]
    }
  },
  "id": 1
}

// Update node state
{
  "jsonrpc": "2.0",
  "method": "updateNode",
  "params": {
    "nodeId": "query-1",
    "state": "running",
    "output": {...}
  },
  "id": 2
}

// Schema information
{
  "jsonrpc": "2.0",
  "method": "loadSchema",
  "params": {
    "entities": ["user", "post", "comment"],
    "attributes": {...}
  },
  "id": 3
}
```

### Messages from Rust → TypeScript

```json
// Execute query
{
  "jsonrpc": "2.0",
  "method": "executeQuery",
  "params": {
    "query": "FIND user AS ?u WHERE ?u.age > 18"
  },
  "id": 1
}

// Get entity details
{
  "jsonrpc": "2.0",
  "method": "getEntity",
  "params": {
    "entityId": "user:123"
  },
  "id": 2
}

// Workflow control
{
  "jsonrpc": "2.0",
  "method": "pauseWorkflow",
  "params": {},
  "id": 3
}
```

## Benefits

1. **Enhanced Developer Experience**: Rich, interactive TUIs for debugging and exploring
2. **Performance**: Ratatui is highly performant for terminal rendering
3. **Visual Debugging**: See graph execution in real-time
4. **Accessibility**: Works over SSH and in any terminal
5. **Professionalism**: Modern, polished CLI experience
6. **Extensibility**: Easy to add new views and widgets

## Next Steps

1. Review and approve this proposal
2. Set up Rust workspace in TQL project
3. Implement basic graph viewer as POC
4. Iterate based on feedback
5. Expand to other components

## References

- [Ratatui Documentation](https://docs.rs/ratatui)
- [Ratatui Examples](https://github.com/ratatui/ratatui/tree/main/examples)
- [TUI Design Patterns](https://ratatui.rs/concepts/application-patterns/)
