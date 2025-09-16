# EAV Datalog Engine

A schema-agnostic Entity-Attribute-Value (EAV) based Datalog engine with path-aware JSON ingestion.

## Overview

This engine implements a truly schema-agnostic approach to data processing where:

- **Any JSON** becomes "facts" through path-aware flattening
- **No schema baking** - only hints through auto-discovery
- **Cross-domain reuse** - same queries work across different data types
- **Dynamic evolution** - new fields appear automatically in queries

## Architecture

### Core Components

1. **EAV Store** (`eav-engine.ts`)

   - In-memory triple store with EAV, AEV, AVE indexes
   - Auto-discovery catalog for attributes
   - Path-aware JSON flattening

2. **Datalog Evaluator** (`datalog-evaluator.ts`)

   - Semi-naive evaluation for recursive queries
   - External predicates (regex, gt, between, contains)
   - Variable binding and join optimization

3. **Query Examples** (`query-examples.ts`)

   - Pre-built queries for common patterns
   - Aggregation support
   - Cross-domain query builders

4. **Demo Integration** (`eav-demo.ts`)
   - Complete working example with posts.json
   - Schema-agnostic demonstration
   - Performance metrics

## Key Features

### Schema-Agnostic Design

```typescript
// Same query patterns work across domains
popular_by_tag(Tag, Score) :-
  attr(E, "type", "post"),     // or "email", "ticket", etc.
  attr(E, "tags", Tag),
  attr(E, "reactions.likes", Score),
  gt(Score, 1000).
```

### Path-Aware Ingestion

```typescript
// JSON automatically flattened to EAV facts
{
  "id": 1,
  "title": "Hello World",
  "reactions": { "likes": 100 },
  "tags": ["tech", "ai"]
}

// Becomes:
// attr(post:1, "id", 1)
// attr(post:1, "title", "Hello World")
// attr(post:1, "reactions.likes", 100)
// attr(post:1, "tags", "tech")
// attr(post:1, "tags", "ai")
```

### External Predicates

```typescript
// Built-in predicates for common operations
regex(Text, 'pattern|with|alternatives');
gt(Number, 1000);
between(Number, 1000, 5000);
contains(Text, 'substring');
```

## Usage

### Basic Setup

```typescript
import { EAVStore, jsonEntityFacts } from './eav-engine.js';
import { QueryRunner } from './query-examples.js';

// Initialize store
const store = new EAVStore();

// Ingest JSON data
const facts = jsonEntityFacts('entity:1', jsonData, 'type');
store.addFacts(facts);

// Create query runner
const runner = new QueryRunner(store);

// Run queries
const results = await runner.getPopularCrimePosts();
```

### Example Queries

#### Popular Crime Posts (>1000 likes)

```prolog
popular_crime(P, Likes) :-
  attr(P, "type", "post"),
  attr(P, "tags", "crime"),
  attr(P, "reactions.likes", Likes),
  gt(Likes, 1000).
```

#### Posts with Keywords and View Range

```prolog
stormy_midviews(P) :-
  attr(P, "type", "post"),
  attr(P, "body", Body),
  regex(Body, "(storm|forest)"),
  attr(P, "views", Views),
  between(Views, 1000, 5000).
```

#### Cross-Domain Email Queries

```prolog
awaiting_reply(M) :-
  attr(M, "type", "email"),
  attr(M, "is_last_in_thread", true),
  attr(M, "to", "user@example.com"),
  not attr(M, "label", "SENT").
```

## Performance

The engine includes several optimizations:

- **Indexes**: EAV, AEV, AVE for fast lookups
- **Join Optimization**: Conflict detection in variable bindings
- **Duplicate Removal**: JSON-based deduplication
- **Lazy Evaluation**: Indexes built on first query

## Demo Results

Running on 30 posts with 322 facts:

- ✅ Popular crime posts: 8 results (3ms)
- ✅ Storm/forest posts: 2 results (1ms)
- ✅ Posts by user: 30 results (1ms)
- ✅ Posts with tag: 30 results (2ms)
- ✅ Title keyword search: 1 result (1ms)

## Schema Evolution

The engine automatically adapts to new data:

```typescript
// Add email data - no schema changes needed
const emailFacts = jsonEntityFacts('email:1', emailData, 'email');
store.addFacts(emailFacts);

// Same query patterns work immediately
const invoiceEmails = store.getFactsByValue('subject', 'Invoice #12345');
```

## Future Enhancements

- **Aggregation**: Group by, sum, count, average
- **Links**: Typed relationships between entities
- **Persistence**: Database backend options
- **Query Optimization**: Cost-based planning
- **Natural Language**: NL to Datalog translation

## Files

- `eav-engine.ts` - Core EAV store and ingestion
- `datalog-evaluator.ts` - Query evaluation engine
- `query-examples.ts` - Pre-built queries and runners
- `eav-demo.ts` - Complete working demonstration

## Running the Demo

```bash
bun run eav-demo.ts
```

This demonstrates the full EAV Datalog engine with real posts data, showing schema-agnostic queries, cross-domain capabilities, and performance metrics.
