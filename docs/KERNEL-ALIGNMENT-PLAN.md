# Trellis Kernel Alignment Plan (TQL Repo)

## Context

This repo is being evolved into the **core Trellis kernel/query package** first, and later pulled into a larger monorepo (Tauri backend, client UI, sync, etc.). The goal is to make this repo a clean, stable kernel that can be consumed by the future monorepo without carrying UI- or provider-specific concerns.

## Current State (What Exists Today)

- **In-memory EAV store**: `src/eav-engine.ts`
- **EQL-S parser/compiler**: `src/query/eqls-parser.ts` (`EQLSProcessor` compiles to internal query goals)
- **Datalog evaluator**: `src/query/datalog-evaluator.ts`
- **CLI**: `src/cli/tql.ts` demonstrates end-to-end ingest → query
- **Additional subsystems** (valuable, but not kernel-critical):
  - AI orchestrator: `src/ai/*`
  - Agent graph runtime: `src/graph/*`
  - Workflows engine: `src/workflows/*`

## Target Kernel Shape (From VISION.md)

The kernel should own:

- **Storage (durable + fast)**
  - In-memory EAV indexes for query speed
  - SQLite backend for persistence
  - Append-only operation log for event sourcing

- **Query system**
  - EQL-S → compiled query plan (Datalog goals)
  - Datalog evaluation
  - Query post-processing (`ORDER BY`, `LIMIT`, projection)

- **Kernel API**
  - `boot()` workspace config
  - `query()` for EQL-S
  - `queryDatalog()` for direct datalog evaluation (format TBD)
  - Later: `queryNatural()` behind an interface
  - Later: CRUD + link ops that emit operations

## Non-Goals (For This Repo / This Phase)

- UI projections (graph view, tables, card grids)
- Tauri IPC integration
- P2P sync implementation (Iroh)
- Provider-specific AI SDK dependencies baked into core kernel

## Key Problems To Solve

1. **Durability**: current store is in-memory only.
2. **Kernel API**: kernel responsibilities are currently split across CLI and helper modules.
3. **Event sourcing**: kernel does not emit/apply operations.
4. **Query semantics**:
   - `OR` is currently compiled like `AND` (incorrect semantics)
   - `ORDER BY` / `LIMIT` are parsed but not enforced by the engine
   - temp variables are generated via `Math.random()` (non-deterministic)
5. **Module boundaries**: default exports include AI/graph/workflows; kernel should be lean by default.

## Proposed Phases (Self-Contained, Mergeable)

### Phase 0 — Kernel Boundary + API Scaffold (P0)

**Outcome**: this repo can be used as a kernel library, not just a CLI.

- Add `TrellisKernel` class that composes:
  - `EAVStore`
  - `DatalogEvaluator`
  - `EQLSProcessor`
- `TrellisKernel` methods (minimal):
  - `boot({ data })` or `boot(workspaceConfig)` (shape TBD; accept “root JSON” first)
  - `query(eqls: string, options?)`
  - `queryCompiled(query)` (optional internal)
- Move CLI responsibilities out of “kernel path” (CLI can remain, but kernel shouldn’t depend on it).

**Acceptance checks**:

- Programmatic example can instantiate kernel, ingest JSON, run EQL-S.
- Existing demos/CLI still run.

### Phase 1 — Correct & Deterministic Query Semantics (P1)

**Outcome**: query results are reproducible and match the EQL-S spec in VISION.md.

- Deterministic compiler temp vars (replace `Math.random()` with a counter)
- Implement real `OR` semantics
  - Compile WHERE into DNF (disjunction of conjunctions)
  - Evaluate each conjunction and union results with dedupe
- Enforce `ORDER BY` + `LIMIT` in the query pipeline
  - Implement as stable post-processing in `TrellisKernel.query()`

**Acceptance checks**:

- Add tests for `OR`, `ORDER BY`, `LIMIT`.
- `bun run test` passes.

### Phase 2 — Persistence & Operations Spine (P2)

**Outcome**: kernel can persist state and replay operations.

- Add `SQLiteBackend`
  - schema initialization (facts/links tables)
  - bulk load into `EAVStore`
  - persist facts/links from operations
- Add `OperationLog`
  - append-only operations table
  - `replay()` builds state
- Add kernel mutation API that emits operations:
  - `createNode`, `updateNode`, `deleteNode`, `link`
  - `applyOperation(op)` / `applyRemoteOperation(op)`

**Acceptance checks**:

- Integration test: apply operations → persist → reload → state matches.

### Phase 3 — Capability Hooks + AI Interop Boundary (P3)

**Outcome**: kernel can be safely extended by external systems.

- Add a minimal `CapabilityChecker` interface
  - kernel calls `assertCan(agent, action, target)` around mutations
- Define AI interop types (interfaces only, no provider deps)
  - `NaturalLanguageQueryProvider` that returns EQL-S (optional dependency)

## Proposed Repo Reshape (For Monorepo Migration)

The goal is to make the eventual extraction into `packages/kernel` trivial.

Recommended structure direction (incremental, not a big-bang rewrite):

- `src/kernel/*` — kernel API surface (`TrellisKernel`)
- `src/store/*` — EAV store + catalog
- `src/query/*` — parser/compiler/evaluator
- `src/persist/*` — SQLite backend + operation log (later)
- Keep existing `src/ai`, `src/graph`, `src/workflows` but **not exported by default**

## Export Policy (Important)

- Default entrypoint should export only:
  - kernel API
  - EAV store types
  - query engine types
- Optional subsystems should remain accessible via explicit imports:
  - `.../ai`
  - `.../graph`
  - `.../workflows`

## Verification Strategy

- Unit tests for:
  - EQL-S parsing + compilation
  - OR semantics
  - ordering/limit
- Integration tests for kernel API
- Later: integration tests for SQLite + operation replay

## code-hq Tracking (Optional but Recommended)

If you track this work with code-hq, a good initial set is:

- Milestone: `Kernel Alignment v0`
- Tasks:
  - Add `TrellisKernel` scaffold
  - Fix OR semantics
  - Enforce ORDER BY/LIMIT
  - Refactor exports (core vs optional)
  - Add tests
  - Add SQLite backend + operation log (Phase 2)

## Immediate Next Steps (What We’ll Implement Next)

1. Add `TrellisKernel` scaffold.
2. Make EQL-S compilation deterministic.
3. Implement `OR` as DNF + union.
4. Enforce `ORDER BY` + `LIMIT`.
5. Adjust exports to make kernel lean by default.
6. Add tests and run `bun run test`.
