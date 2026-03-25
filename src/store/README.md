# Store Module

The store module owns in-memory semantic state: facts, links, indexes, cataloging, and JSON-to-EAV ingestion helpers.

## Public Entry Points

- `q/store`
- Root package re-exports via `src/index.ts`

## Authoritative Files

- `eav-store.ts`

## Invariants

- Fact and link indexing behavior must remain internally consistent.
- JSON ingestion should stay schema-agnostic and deterministic.
- Store internals should not absorb query, workflow, or UI responsibilities.
- Catalog behavior should reflect the stored semantic data rather than external assumptions.

## Verify Changes

- `bun run typecheck`
- `bun run test`
