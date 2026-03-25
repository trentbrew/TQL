# Workflows Module

The workflows module provides the declarative workflow runtime that sits beside the core kernel.

## Public Entry Points

- `q/workflows`
- CLI workflow commands in `src/cli/tql.ts`

## Authoritative Files

- `schema.ts`
- `types.ts`
- `parser.ts`
- `planner.ts`
- `engine.ts`
- `runners.ts`

## Invariants

- Workflow schema and runtime behavior should evolve together.
- Dependency resolution must remain deterministic.
- Workflow concerns should compose with the kernel rather than expand kernel contracts unnecessarily.
- Cache behavior must remain stable across equivalent workflow plans.

## Verify Changes

- `bun run typecheck`
- `bun run test`
- `bun run test:workflow`
