# Persist Module

The persist module owns durable storage of kernel operations and snapshots.

## Public Entry Points

- `q/kernel/backend`
- `q/kernel/sqlite`

## Authoritative Files

- `backend.ts`
- `sqlite-backend.ts`

## Invariants

- `backend.ts` defines the persistence contract used by the kernel.
- Concrete backends must preserve operation ordering and replay semantics.
- Snapshot behavior should accelerate restore without changing logical state.
- Persistence concerns should stay independent from CLI, workflow, and UI concerns.

## Verify Changes

- `bun run typecheck`
- `bun run test`
