# TQL Architecture

TQL is a Trellis-kernel-first repository: the default package surface is the semantic kernel, while AI, graph, workflow, CLI, and telemetry capabilities remain adjacent but secondary.

## Repo Shape

### Core surface

These modules define the default package identity and should stay lean, stable, and easy to reason about.

- `src/store`
- `src/query`
- `src/persist`
- `src/kernel`

### Secondary surfaces

These modules are valuable, but they should be treated as explicit opt-in surfaces rather than part of the conceptual kernel minimum.

- `src/ai`
- `src/graph`
- `src/workflows`
- `src/cli`
- `src/analytics`
- `src/telemetry.ts`

## Composition Rules

- `src/kernel` is the composition root for kernel behavior.
- `src/store` owns in-memory facts, links, cataloging, and index behavior.
- `src/query` owns parsing, compilation, evaluation, and query-specific utilities.
- `src/persist` owns durable operation storage and replay infrastructure.
- Secondary surfaces may depend on the kernel, but the kernel should not depend on provider-specific AI implementations, UI/TUI code, or workflow-specific orchestration.

## Authoritative Public Entry Points

Use these files first when navigating the repo.

- Package root: `src/index.ts`
- Kernel module surface: `src/kernel/index.ts`
- Store surface: `src/store/eav-store.ts`
- Query surface: `src/query/index.ts`
- Persistence contracts: `src/persist/backend.ts`, `src/persist/sqlite-backend.ts`

## Authoritative Contracts

These files define the boundaries an agent should read before reading deeper implementation files.

- Kernel API: `src/kernel/trellis-kernel.ts`
- Middleware contract: `src/kernel/middleware.ts`
- Workspace config schema: `src/kernel/workspace.ts`
- AI boundary interfaces: `src/kernel/ai-interop.ts`
- Persistence contract: `src/persist/backend.ts`
- Query compilation and evaluation: `src/query/eqls-parser.ts`, `src/query/datalog-evaluator.ts`

## Change Strategy

When making changes, prefer this order:

1. Read the relevant module README.
2. Read the contract file for the boundary you are touching.
3. Read the narrowest implementation file that owns the behavior.
4. Run the smallest relevant verification command before broader checks.

## Verification Map

- Store and query behavior: `bun run test`
- Kernel contracts and integration: `bun run test`
- Type-level validation across exports: `bun run typecheck`
- Workflow runtime changes: `bun run test -- workflow`

## Current Architectural Direction

This repository is already aligned toward extraction into a future Trellis monorepo kernel package. The goal here is not a rewrite. The goal is to make the kernel boundary, local conventions, and module ownership explicit enough that both humans and coding agents can modify the repo safely with minimal context.
