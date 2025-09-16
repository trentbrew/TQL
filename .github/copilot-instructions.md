# TQL - AI Coding Assistant Instructions

## Project Overview

**TQL** is a schema-agnostic Entity-Attribute-Value (EAV) based Datalog engine with AI orchestration capabilities. It transforms any JSON data into queryable facts and supports both natural language and EQL-S (Entity Query Language Structured) queries.

## Key Architecture Components

### 1. EAV Engine (`src/eav-engine.ts`)
- **Core Pattern**: All data becomes `{entity, attribute, value}` triples
- **Path-Aware Ingestion**: JSON nested objects flattened with dot notation (`user.address.city`)
- **Multi-Index Storage**: EAV, AEV, AVE indexes for fast lookups
- **Entity ID Convention**: `{type}:{id}` format (e.g., `post:123`, `user:456`)

```typescript
// Always use jsonEntityFacts for data ingestion
const facts = jsonEntityFacts('post:123', jsonData, 'post');
store.addFacts(facts);
```

### 2. Query Engine (`src/query/`)
- **Datalog Evaluator**: Semi-naive evaluation with external predicates
- **EQL-S Parser**: SQL-like syntax for structured queries
- **External Predicates**: Built-in regex, gt/lt, contains, date comparisons
- **Query Pattern**: Always return `QueryResult` with bindings and execution time

### 3. AI Orchestrator (`src/ai/orchestrator.ts`)
- **Intent Analysis**: Categorizes user input (conversation, query, task)
- **Tree-of-Thought**: Multi-plan generation and voting for complex queries
- **Natural Language → EQL-S**: Converts NL queries to structured format
- **Streaming Support**: Both generate and stream responses

### 4. CLI Tool (`src/cli/tql.ts`)
- **Data Sources**: Local files or remote URLs
- **Format Options**: JSON, CSV, table output
- **Entity ID Strategy**: Uses `idKey` option or falls back to array index

## Development Conventions

### Import Patterns
```typescript
// Always use .js extensions in imports (TSconfig bundler mode)
import { EAVStore } from '../eav-engine.js';

// JSON imports use assert syntax
import data from '../data/posts.json' assert { type: 'json' };
```

### Entity Naming
- **Entities**: `{type}:{id}` format
- **Attributes**: Use dot notation for nested paths
- **Types**: Inferred from data structure or explicitly set

### Query Writing
```typescript
// External predicates for filtering
const query = {
  goals: [
    { predicate: 'triple', terms: ['?e', 'title', '?title'] },
    { predicate: 'regex', terms: ['?title', 'crime'] }
  ]
};
```

### Demo Structure
- All demos in `examples/` follow same pattern:
  1. Initialize EAVStore
  2. Ingest data with `jsonEntityFacts`
  3. Create QueryRunner
  4. Run example queries
  5. Display formatted results

## Key Commands

```bash
# Core development
bun run dev              # Run main entry point
bun run typecheck        # TypeScript validation

# Demos (use these for testing patterns)
bun run demo:eav         # EAV engine basics
bun run demo:graph       # Graph queries
bun run demo:products    # Product analysis
bun run demos            # Run all demos

# CLI usage
bun run tql -d data.json -q "query"     # Structured query
bun run tql -d data.json -q "query" -n  # Natural language
```

## AI Integration Patterns

### Orchestrator Usage
```typescript
// Quick orchestration for simple queries
const result = await quickOrchestrate(userInput, { stream: false });

// Full orchestration with Tree-of-Thought
const result = await orchestrate(userInput, { 
  useToT: true, 
  includeAnalysis: true 
});
```

### Query Processing Flow
1. **Intent Analysis**: Determine if input is query vs conversation
2. **NL→EQL-S**: Convert natural language to structured query
3. **Datalog Execution**: Run against EAV store
4. **Result Formatting**: Return structured results with metadata

## Code Quality Standards

- **Type Safety**: Strict TypeScript with `noUncheckedIndexedAccess`
- **Export Strategy**: Use explicit named exports from index files
- **Error Handling**: Always include execution time and error context
- **Documentation**: JSDoc comments for all public interfaces

## Data Flow Understanding

JSON Input → `jsonEntityFacts()` → EAV Store → Query Engine → Results

The entire system is designed around this transformation pipeline where any JSON becomes queryable through the same interface patterns.