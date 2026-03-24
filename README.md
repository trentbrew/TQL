# Trellis Kernel

Trellis is a **semantic operating system for knowledge work** that treats your workspace as a declarative configuration. This repository contains the core Trellis kernel: a high-performance, durable, and extensible semantic engine.

The kernel provides a unified interface for data ingestion, querying (EQL-S, Datalog, Natural Language), and automated reasoning, all backed by an append-only operation log for full reproducibility and sync.

## Quick Start

```bash
# Install dependencies
bun install

# Run the CLI on bundled sample data
bun run tql -d data/posts.json -q "FIND post AS ?p RETURN ?p.id, ?p.title"

# Run tests
bun run test
```

## Key Capabilities

- **Semantic Storage** – Durable EAV (Entity-Attribute-Value) store backed by SQLite with in-memory indexing for query performance.
- **Event Sourcing** – Content-addressed operation log with causality tracking (hashing, agent metadata, linked chains).
- **Multi-Modal Querying** –
  - **EQL-S**: A strict SQL-like DSL for entities and relationships.
  - **Datalog**: Direct access to the semi-naive evaluator for recursive and complex logic.
  - **Natural Language**: AI-powered translation of human intent into structured queries.
- **Declarative Workspaces** – Boot entire environments from `.trellis` files containing ontologies (schemas), projections (views), and graph data.
- **Middleware System** – Async-aware hooks for security (capability-based), schema enforcement, and logic (formulas, rollups).
- **Time-Travel** – Query the state of your graph at any specific operation hash or historical timestamp.

## Project Structure

```
├── src/
│   ├── store/           # Core EAV engine, indexing, and catalog
│   ├── persist/         # SQLite backend and operation log
│   ├── query/           # EQL-S parser/compiler and Datalog engine
│   ├── kernel/          # Kernel API, Middleware, and AI Interop
│   ├── ai/              # NL providers and orchestrator
│   ├── graph/           # Agent graph runtime (optional)
│   └── workflows/       # Workflow engine (optional)
├── docs/                # Architectural guides and plan
└── test/                # Comprehensive Vitest suites
```

## Usage

### Programmatic Example

```typescript
import { TrellisKernel } from 'trellis/kernel';
import { SqliteKernelBackend } from 'trellis/kernel/sqlite';

// Initialize with persistence
const backend = new SqliteKernelBackend({ filename: 'workspace.sqlite' });
const kernel = new TrellisKernel({ backend });

// Boot with data
await kernel.boot(
  [
    { id: 1, title: 'Build Trellis', status: 'active' },
    { id: 2, title: 'Release Kernel', status: 'planning' },
  ],
  { entityType: 'Task' },
);

// Query with EQL-S
const res = await kernel.query(
  'FIND Task AS ?t WHERE ?t.status = "active" RETURN ?t.title',
);

console.log(res.rows); // [{ "?t.title": "Build Trellis" }]
```

### Declarative Workspace (.trellis)

```json
{
  "workspace": {
    "name": "My Projects",
    "ontologies": {
      "trellis:schema/project": {
        /* schema def */
      }
    },
    "graph": {
      "nodes": [{ "@id": "p1", "@type": "Project", "name": "Web App" }]
    },
    "projections": {
      "active-view": { "name": "Active", "query": "FIND Project AS ?p ..." }
    }
  }
}
```

```typescript
await kernel.boot(trellisConfig);
const view = await kernel.executeProjection('active-view');
```

## Documentation

- [Kernel Alignment Plan](docs/KERNEL-ALIGNMENT-PLAN.md) – The roadmap followed for the current architecture.
- [EAV Engine Guide](docs/EAV-README.md) – Deep dive into the storage layer.
- [Workflows & Agent Graphs](docs/WORKFLOWS.md) – High-level automation.

## Development

```bash
bun run typecheck  # Type checking
bun run test       # Run Vitest suites
bun run clean      # Clean build artifacts
```

Built with [Bun](https://bun.sh) for fast TypeScript execution.
