# TQL - EAV · Datalog · Orchestrated Querying

TQL is a schema-agnostic Entity-Attribute-Value (EAV) engine with a Datalog evaluator, an EQL-S query DSL, an NL-to-query orchestrator, and a deterministic agent graph runtime. It lets you ingest arbitrary JSON, query it via CLI or code, and wire those results into automated workflows.

## Quick start

```bash
# Install dependencies
bun install

# Run the CLI on bundled sample data
bun run tql -d data/posts.json -q "FIND post AS ?p RETURN ?p.id, ?p.title"

# Launch the scripted quickstart example
bun run dev
```

### Explore demos

```bash
bun run demo:eav              # Core EAV ingestion + query flow
bun run demo:graph            # Graph reasoning over links
bun run demo:products         # Products analysis walkthrough
bun run demo:tql              # CLI orchestration showcase
bun run demo:agent-graph      # Deterministic agent workflow run
bun run demos                 # Run everything sequentially
```

## Project structure

```
├── src/
│   ├── eav-engine.ts        # Facts store, flattening, index maintenance
│   ├── query/               # EQL-S parser, Datalog evaluator, generators
│   ├── cli/                 # TQL CLI entrypoint + helpers
│   ├── ai/                  # Natural language orchestrator & providers
│   ├── graph/               # Agent graph runtime, validators, executors
│   ├── analytics/           # Dataset insights, relationship mining
│   ├── adapters/            # Integrations for workflows & tools
│   ├── telemetry.ts         # Diagnostics + tracing hooks
│   └── index.ts             # Public bundler-friendly exports
├── examples/                # End-to-end demos and playground scripts
├── docs/                    # Deep-dive documentation
├── data/                    # Sample datasets for demos and tests
└── test/                    # Vitest suites (projection, workflows, etc.)
```

## Capabilities

- **Schema agnostic ingestion** – Any JSON becomes `attr(e,a,v)` facts with dot-path attributes and link support.
- **Datalog + EQL-S** – Semi-naive evaluator with projections, filters, regex, math, date ops, and ordering.
- **TQL CLI** – `bun run tql` to load local/remote data, run EQL-S, or translate natural language with `--nl`.
- **NL orchestrator** – `src/ai/` routes natural-language prompts to structured queries with optional tool calls.
- **Agent graph runtime** – Deterministic node/edge engine for complex LLM workflows with budgets and tracing.
- **Analytics toolkit** – Relationship analysis, schema inference, and dataset introspection helpers.

## Usage

### Programmatic example

```typescript
import { EAVStore, jsonEntityFacts } from './src/index.js';

const store = new EAVStore();

const jsonData = {
	id: 1,
	title: 'Hello World',
	tags: ['demo', 'example'],
	metrics: { views: 100 }
};

store.addFacts(jsonEntityFacts('post:1', jsonData, 'post'));

const titles = store.getFactsByAttribute('title');
console.log(titles);
```

### CLI example

```bash
bun run tql \
	-d https://jsonplaceholder.typicode.com/users \
	-q "FIND user AS ?u RETURN ?u.id, ?u.email"

# With natural language translation
bun run tql -d data/posts.json -q "posts with >1000 views" --nl
```

## Development

```bash
# Type checking
bun run typecheck

# Build distributable bundle
bun run build

# Run Vitest suites
bun run test

# Clean build artifacts
bun run clean
```

## Documentation & resources

- [EAV Engine Guide](docs/EAV-README.md)
- [Workflows & Agent Graphs](docs/WORKFLOWS.md)
- [Tree-of-Thought Planner](docs/TOT-PLANNER.md)
- [Analytics toolkit overview](docs/ANALYTICS-README.md)
- [Examples directory](examples/) for runnable scripts and demos

Built with [Bun](https://bun.sh) for fast TypeScript execution.
