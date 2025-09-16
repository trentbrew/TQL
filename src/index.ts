/**
 * Q - Main Entry Point
 *
 * Schema-agnostic Entity-Attribute-Value based Datalog engine
 * with AI orchestration, query processing, and graph capabilities.
 */

// Core EAV Engine
export { EAVStore, jsonEntityFacts, flatten } from './eav-engine.js';

// Query Engine
export * from './query/index.js';

// AI Orchestrator
export * from './ai/index.js';

// Graph Engine (placeholder)
export * from './graph/index.js';

// Re-export types
export type {
  Fact,
  Link,
  Atom,
  EntityRef,
  CatalogEntry,
  QueryResult,
} from './eav-engine.js';
