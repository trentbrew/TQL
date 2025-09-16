# Copilot Instructions — TQL / EAV • Datalog • EQL-S • Graph

**What this is.** Schema-agnostic querying over JSON via an **EAV store**, a **Datalog evaluator**, and the **EQL-S** DSL. Exposed through a **TQL CLI**, optional **NL orchestrator**, and a **graph engine** for agentic workflows.

## Files you should know first
- Store: `src/eav-engine.ts` — JSON → `attr(e,a,v)` facts, indexes (**EAV/AEV/AVE**), optional `link(e1,rel,e2)`.
- Evaluator: `src/query/datalog-evaluator.ts` — semi-naive Datalog; attr/link/string/regex/numeric/date ops.
- DSL/Compiler: `src/query/**` — parses EQL-S to evaluator IR.
- CLI: `src/cli/tql.ts` — loads files/URLs → builds one store → runs EQL-S → prints table/json/csv.
- Orchestrator: `src/ai/orchestrator.ts` — NL → EQL-S (used by `--nl`).
- Agent graph runtime: `src/graph/**` — deterministic node/edge engine, budgets/timeouts, per-step traces, pluggable executors & tools.

## Conventions (don't fight these)
- **Entity IDs:** `type:id` (e.g., `post:123`). Namespaces are distinct (`user:1` ≠ `post:1`).
- **Attributes:** JSON dot paths (`"address.city"`, `"reactions.likes"`). Arrays → multiple facts.
- **Imports:** TypeScript bundler mode → always use **`.js`** in relative imports:
  ```ts
  import { EAVStore } from '../eav-engine.js'
  import data from './seed.json' assert { type: 'json' }
  ```
- **Planner intent:** push filters before joins; prefer **AVE/link** indexes over scans/regex.

## Daily workflows
- Type check: `bun run typecheck`
- Demos: `bun run examples/eav-demo.ts` · `bun run examples/tql-demo.ts`
- CLI help: `bun run tql --help`

## EQL-S quick patterns (copy/paste)
```eql
-- Basic
FIND post AS ?p RETURN ?p

-- Project attributes (compiler injects attr goals)
FIND post AS ?p RETURN ?p.id, ?p.title

-- Filtered
FIND post AS ?p WHERE ?p.views > 1000 RETURN ?p.id, ?p.title ORDER BY ?p.views DESC LIMIT 10

-- Attribute join
FIND post AS ?p, user AS ?u WHERE ?p.userId = ?u.id RETURN ?u.name, ?p.title

-- With links (if ingested)
FIND post AS ?p, user AS ?u WHERE LINK(?p,"BY",?u) RETURN ?u.name, ?p.title

-- Anti-join
FIND user AS ?u WHERE NOT EXISTS LINK(?p,"BY",?u) RETURN ?u.id, ?u.name
```

## CLI examples
```bash
# Local file
bun run tql -d data/posts.json -q "FIND post AS ?p WHERE ?p.title CONTAINS \"dolor\" RETURN ?p.id, ?p.title"

# Remote URL
bun run tql -d https://jsonplaceholder.typicode.com/users -q "FIND user AS ?u RETURN ?u.id, ?u.email"

# Natural language (routes through orchestrator)
bun run tql -d data/posts.json -q "show posts with >1000 views" --nl
```

## Agent graph runtime (for LLM workflows)
- Engine: `src/graph/engine.ts` yields **per-step traces** (async generator) and enforces **maxSteps/perNodeMs**.
- Node kinds: `Agent` (LLM), `Tool` (function), `Router`, `Guard`, `MemoryRead/Write`, `End`.
- Deterministic routing: edge labels unique per source node; validated in `validators.ts`.
- Streaming/logging: subscribe to step events; emit structured traces for UIs/logs.
- Handy tool: `tql_query` to run EQL-S against an in-memory store inside a graph flow.

## Project-specific gotchas
- **Case matters for data**, not for keywords: keep `type`/attribute strings exactly as in the data (e.g., `post`, not `POST`).
- Returning `?x.path` can **fan out** if multi-valued; the runner's projection policy controls this.
- Always add `.js` in local TS imports; missing suffix breaks Bun/ts-bundler.
- Arrays are not single entities: create one entity per element on ingest.

## When extending
- New data → use `jsonEntityFacts(...)`, keep `type:id`, then query.
- New predicate → register in evaluator (arity + handler) and keep recursion monotone.
- Cross-entity joins → either `?a.fk = ?b.id` or synthesize `LINK` edges at ingest (faster and cleaner).