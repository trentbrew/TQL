/**
 * Q - Main Entry Point
 *
 * Schema-agnostic Entity-Attribute-Value based Datalog engine
 * with AI orchestration, query processing, and graph capabilities.
 */

// Core EAV Engine
export { EAVStore, jsonEntityFacts, flatten } from './store/eav-store.js';

// Kernel API
export * from './persist/backend.js';
export * from './persist/sqlite-backend.js';
export * from './kernel/middleware.js';
export * from './kernel/security-middleware.js';
export * from './kernel/schema-middleware.js';
export * from './kernel/logic-middleware.js';
export * from './kernel/ai-interop.js';
export * from './kernel/operations.js';
export * from './kernel/sync.js';
export * from './kernel/workspace.js';
export * from './kernel/trellis-kernel.js';

// Query Engine
export * from './query/index.js';

// Re-export types
export type {
  Fact,
  Link,
  Atom,
  EntityRef,
  CatalogEntry,
  QueryResult,
} from './store/eav-store.js';
