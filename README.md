# TQL - EAV Datalog Engine

A schema-agnostic Entity-Attribute-Value (EAV) based Datalog engine with path-aware JSON ingestion capabilities.

## Quick Start

```bash
# Install dependencies
bun install

# Run the main example
bun run dev

# Run demos
bun run demo:eav        # EAV engine demo with posts data
bun run demo:graph      # Graph query capabilities
bun run demo:products   # Products analysis demo
```

## Project Structure

```
├── src/                    # Core engine source code
│   ├── eav-engine.ts      # EAV store and JSON ingestion
│   ├── datalog-evaluator.ts # Query evaluation engine
│   ├── query-examples.ts   # Pre-built queries and runners
│   ├── ai.ts              # AI integration utilities
│   └── index.ts           # Main entry point
├── examples/              # Demo applications
│   ├── eav-demo.ts        # Complete EAV demonstration
│   ├── graph-demo.ts      # Graph query examples
│   └── products-final-demo.ts # Products analysis
├── data/                  # Sample data files
│   ├── posts.json         # Blog posts data
│   ├── emails.json        # Email data
│   ├── products_webflow.json # Product catalog
│   └── graph.json         # Graph data
├── docs/                  # Documentation
│   └── EAV-README.md      # Detailed EAV engine docs
└── package.json           # Project configuration
```

## Key Features

- **Schema-Agnostic**: No predefined schemas - any JSON becomes queryable facts
- **Path-Aware Ingestion**: Nested JSON automatically flattened with dot notation
- **Cross-Domain Queries**: Same query patterns work across different data types
- **External Predicates**: Built-in support for regex, comparisons, and string operations
- **Performance Optimized**: Multiple indexes (EAV, AEV, AVE) for fast lookups

## Usage

```typescript
import { EAVStore, jsonEntityFacts } from './src/index.js';

// Initialize store
const store = new EAVStore();

// Convert JSON to EAV facts
const facts = jsonEntityFacts('entity:1', jsonData, 'type');
store.addFacts(facts);

// Query the data
const results = store.getFactsByAttribute('title');
```

## Development

```bash
# Type checking
bun run typecheck

# Build
bun run build

# Clean build artifacts
bun run clean
```

## Documentation

- [EAV Engine Documentation](docs/EAV-README.md) - Comprehensive guide to the EAV engine
- [Examples](examples/) - Working demonstrations of all features

## Architecture

The engine consists of three main components:

1. **EAV Store** - In-memory triple store with optimized indexes
2. **Datalog Evaluator** - Semi-naive evaluation for recursive queries
3. **Query Examples** - Pre-built queries and cross-domain patterns

Built with [Bun](https://bun.sh) for fast JavaScript execution.
