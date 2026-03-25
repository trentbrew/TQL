# Query Module

The query module owns parsing, compilation, evaluation, and query-facing utilities for Trellis.

## Public Entry Points

- `q/query`
- Root package re-exports via `src/index.ts`

## Authoritative Files

- `index.ts`
- `eqls-parser.ts`
- `datalog-evaluator.ts`
- `attribute-resolver.ts`

## Invariants

- Parsing and compilation should be deterministic.
- Evaluator behavior should remain independent from CLI or workflow concerns.
- Query-layer utilities should not silently create new kernel responsibilities.
- Public query exports should stay focused on stable query behavior rather than demos or incidental helpers.

## Verify Changes

- `bun run typecheck`
- `bun run test`
