# Graph Module

The graph module provides the agent-graph runtime and related execution helpers as an explicit secondary surface.

## Public Entry Points

- `q/graph`

## Authoritative Files

- `types.ts`
- `graph.ts`
- `engine.ts`
- `executors.ts`
- `tools.ts`

## Invariants

- Graph execution behavior should remain explicit and opt-in.
- Graph runtime utilities should not become hidden kernel dependencies.
- Shared graph contracts belong in `types.ts` and `validators.ts`.
- Logging and visualization helpers should remain separate from execution contracts.

## Verify Changes

- `bun run typecheck`
- `bun run test`
