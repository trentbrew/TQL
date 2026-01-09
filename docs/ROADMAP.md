# Trellis Kernel Roadmap

> **Status as of January 2026**: Trellis Kernel v2.0.0 is foundational. The core semantic engine has been aligned with the Trellis OS vision, featuring durable persistence, content-addressed event sourcing, and a robust middleware system.

---

## 🎯 Vision

Transform TQL into the **core Trellis Kernel**: a high-performance, durable, and extensible semantic engine that serves as the backbone for the Trellis OS monorepo.

---

## 📊 Current State

### ✅ Completed (Kernel Alignment)

- **Unified Kernel API** (`TrellisKernel`) composing store, evaluator, and processor.
- **Durable SQLite Backend** with append-only operation log and replay hooks.
- **Content-Addressed Event Sourcing** with SHA-256 hashing and causality tracking.
- **Time-Travel Queries** via ephemeral snapshots at operation hash or timestamp.
- **Async-Aware Middleware System** for extensibility.
- **Capability-Based Security** middleware for granular access control.
- **Schema Enforcement** middleware for ontology validation.
- **Logic Layer** supporting virtual attributes via Formulas and Rollups.
- **AI Interop Surface** for natural language translation and AI-generated properties.
- **Declarative Workspace Boot** from `.trellis` files.
- **Workspace Export** for snapshotting current state.
- **Refactored CLI** built entirely on the Kernel API.

---

## 🗺️ Roadmap by Priority

## 1. Monorepo Integration 🎯 HIGH IMPACT

- [ ] Extract kernel into `packages/kernel` for the Trellis monorepo.
- [ ] Define stable IPC/RPC boundaries for Tauri integration.
- [ ] Implement Iroh-based P2P sync adapter for remote operations.
- [ ] Standardize JSON-LD context for Trellis core ontologies.

## 2. Performance & Scale 💪 MEDIUM-HIGH IMPACT

- [ ] **Query Optimizer**: Implement join reordering and filter pushdown.
- [ ] **Streaming Ingestion**: Process massive JSON files without loading entirely into RAM.
- [ ] **Index Snapshots**: Periodically save in-memory index state to speed up boot/replay.
- [ ] **WASM Target**: Compile kernel for use in browser-only environments.

## 3. Developer Experience 🚀 MEDIUM IMPACT

- [ ] **Interactive REPL**: A dedicated `tql repl` for exploring workspaces.
- [ ] **Query Debugger**: Visual execution plans and trace information.
- [ ] **VSCode Extension**: Syntax highlighting for EQL-S and .trellis schema validation.
- [ ] **Logic Layer expansion**: Add support for complex Rollup aggregations and advanced formula functions.

## 4. AI & Reasoning 🤖 STRATEGIC

- [ ] **Semantic Search Adapter**: Integrate vector embeddings for hybrid retrieval.
- [ ] **Multi-Model Support**: Standard providers for Claude, Gemini, and local LLMs.
- [ ] **Agent Tools Library**: Standardized tool definitions for the agent graph runtime.
- [ ] **Recursive Evaluator Hardening**: Optimize deep transitive closure performance.

---

## 📅 Timeline

### Phase 1: Stability & Integration (Q1 2026)

**Focus**: Monorepo readiness and P2P sync.

- [ ] Monorepo extraction.
- [ ] Iroh sync implementation.
- [ ] IPC interface definition.

### Phase 2: Optimization (Q2 2026)

**Focus**: Performance at scale.

- [ ] Query optimization pass.
- [ ] Streaming ingestion.
- [ ] Index snapshotting.

---

## 🎬 Getting Started

### Pick Your Adventure

- **Want to use it?** → Start with the `TrellisKernel` API in [README.md](../README.md).
- **Want to extend it?** → Check out [Middleware](../src/kernel/middleware.ts).
- **Want to query it?** → See [EQL-S Guide](QUERY_LANGUAGE.md) (TBD).

---

## 🤝 Contributing

Trellis Kernel is the heart of a next-generation OS. We welcome contributions to the core engine, specifically in performance optimization and integration adapters.

---

**Last Updated**: January 5, 2026
**Version**: 2.0.0
**Status**: Foundational & Aligned
