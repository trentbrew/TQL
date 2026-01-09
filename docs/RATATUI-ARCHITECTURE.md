# TQL + Ratatui Architecture

## High-Level Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                         User                                      │
│                           │                                       │
│                           ▼                                       │
├──────────────────────────────────────────────────────────────────┤
│                    Terminal (TUI)                                 │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              Ratatui Rendering Engine                      │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │  │
│  │  │  Graph   │ │  Query   │ │Workflow │ │Dashboard│      │  │
│  │  │ Viewer   │ │ Builder  │ │ Monitor │ │         │      │  │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬────┘      │  │
│  └───────┼────────────┼─────────────┼────────────┼───────────┘  │
│          │            │             │            │               │
│          └────────────┴─────────────┴────────────┘               │
│                           │                                       │
│                           ▼                                       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                  IPC Layer (JSON-RPC)                      │  │
│  │              stdin/stdout communication                    │  │
│  └────────────────────┬───────────────────────────────────────┘  │
└──────────────────────┼───────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                   TQL Core (TypeScript)                           │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                   TQLTUIBridge                             │  │
│  │  - Spawns Rust process                                    │  │
│  │  - Handles JSON-RPC protocol                              │  │
│  │  - Event emitter for callbacks                            │  │
│  └────────────────────┬───────────────────────────────────────┘  │
│                       │                                           │
│  ┌────────────────────▼───────────────────────────────────────┐  │
│  │               TrellisKernel                                │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │  │
│  │  │  Store   │  │  Query   │  │Workflow │                 │  │
│  │  │   EAV    │  │  Engine  │  │ Engine  │                 │  │
│  │  └──────────┘  └──────────┘  └──────────┘                 │  │
│  └────────────────────────────────────────────────────────────┘  │
│                       │                                           │
│  ┌────────────────────▼───────────────────────────────────────┐  │
│  │                SQLite Backend                              │  │
│  │  - Operation log (event sourcing)                         │  │
│  │  - EAV triples storage                                    │  │
│  │  - Time-travel queries                                    │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Graph Visualization

```
User Action (↑/↓)
    ↓
Ratatui Event Handler
    ↓
Update Local State
    ↓
Re-render Graph Canvas
```

### 2. Query Execution

```
User Types Query
    ↓
Ratatui Input Handler
    ↓
User Presses Enter
    ↓
Send JSON-RPC Request
    {
      "method": "executeQuery",
      "params": { "query": "FIND user..." }
    }
    ↓
TypeScript: TQLTUIBridge receives
    ↓
TrellisKernel.query()
    ↓
Parse EQL-S → Datalog
    ↓
Execute against EAV Store
    ↓
Return Results
    ↓
Send JSON-RPC Response
    {
      "result": { "rows": [...], "time": 15.3 }
    }
    ↓
Ratatui: Display Results Table
    ↓
User Sees Results
```

### 3. Live Workflow Monitoring

```
TypeScript: Workflow Engine starts
    ↓
TQLTUIBridge.launchWorkflowMonitor()
    ↓
Ratatui: Display initial state
    ↓
Workflow executes node
    ↓
TypeScript: Send state update
    {
      "method": "updateNode",
      "params": {
        "nodeId": "query-1",
        "state": "running"
      }
    }
    ↓
Ratatui: Update node color
    ↓
User sees real-time progress
    ↓
Node completes
    ↓
TypeScript: Send completion
    {
      "method": "updateNode",
      "params": {
        "nodeId": "query-1",
        "state": "success",
        "output": {...}
      }
    }
    ↓
Ratatui: Show ✓ and output
```

## Component Responsibilities

### Rust (Ratatui) Side

**Responsibilities:**
- Terminal rendering (60fps smooth updates)
- User input handling (keyboard, mouse)
- Layout management
- Visual state (colors, positions, zoom level)
- Local UI state (selected node, cursor position)

**Does NOT:**
- Execute queries
- Store data
- Run workflows
- Access databases

### TypeScript Side

**Responsibilities:**
- Business logic (query execution, workflow engine)
- Data storage (SQLite, EAV store)
- AI integration (LLM calls)
- Schema management
- State persistence

**Does NOT:**
- Render terminal UI
- Handle keyboard input
- Manage terminal state

## IPC Protocol

### Message Format

```typescript
// Request (Rust → TypeScript)
{
  "jsonrpc": "2.0",
  "method": "executeQuery",
  "params": { ... },
  "id": 1
}

// Response (TypeScript → Rust)
{
  "jsonrpc": "2.0",
  "result": { ... },
  "id": 1
}

// Error Response
{
  "jsonrpc": "2.0",
  "error": "Error message",
  "id": 1
}

// Notification (TypeScript → Rust)
{
  "jsonrpc": "2.0",
  "method": "updateNode",
  "params": { ... }
}
```

### Supported Methods

**Rust → TypeScript:**
- `executeQuery` - Execute EQL-S query
- `getEntity` - Fetch entity by ID
- `getSchema` - Get schema definitions
- `runWorkflow` - Execute workflow

**TypeScript → Rust:**
- `loadGraph` - Load graph data
- `updateNode` - Update node state
- `loadSchema` - Send schema data
- `queryResults` - Send query results

## Performance Characteristics

### Latency
- **Local rendering**: < 16ms (60fps)
- **IPC round-trip**: 1-5ms
- **Query execution**: Varies (10-100ms typical)
- **Total perceived latency**: 20-120ms

### Throughput
- **Terminal updates**: 60fps sustained
- **IPC messages**: 1000+ msg/sec
- **Node updates**: Unlimited (async)

## Deployment Modes

### 1. Standalone
```bash
tql-tui graph --file workflow.json
```
- Rust binary runs independently
- Loads static JSON files
- No TypeScript needed

### 2. Integrated (Subprocess)
```typescript
const tui = new TQLTUIBridge();
await tui.launchGraphViewer(graph);
```
- TypeScript spawns Rust process
- Bidirectional communication
- Full feature access

### 3. Remote (Future)
```
TQL Server (TypeScript)
    ↕ WebSocket/TCP
TUI Client (Rust)
```
- Network protocol instead of stdio
- Multiple clients possible
- Same JSON-RPC format

## File Organization

```
TQL/
├── tql-tui/              # Rust TUI
│   ├── src/
│   │   ├── main.rs       # Entry point
│   │   ├── app.rs        # App loop
│   │   ├── screens/      # UI screens
│   │   ├── widgets/      # Reusable components
│   │   ├── ipc/          # IPC client
│   │   └── theme.rs      # Styling
│   └── Cargo.toml
│
├── src/
│   └── cli/
│       └── tui-bridge.ts # TypeScript bridge
│
├── docs/
│   ├── RATATUI-INTEGRATION.md
│   ├── RATATUI-QUICKSTART.md
│   └── ARCHITECTURE.md   # This file
│
└── examples/
    └── tql-tui-demo.ts   # Integration examples
```

## Design Principles

1. **Separation of Concerns**
   - UI in Rust (fast rendering)
   - Logic in TypeScript (flexibility)

2. **Loose Coupling**
   - JSON-RPC protocol (language agnostic)
   - Can swap implementations

3. **Progressive Enhancement**
   - Works standalone
   - Better when integrated

4. **Performance First**
   - Async rendering
   - Minimal IPC overhead
   - Efficient data structures

5. **Developer Experience**
   - Simple API
   - Good defaults
   - Easy to extend
