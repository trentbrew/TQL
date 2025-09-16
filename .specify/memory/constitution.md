# TQL Constitution
<!-- Schema-Agnostic EAV Datalog Engine with AI Orchestration -->

## Core Principles

### I. Schema-Agnostic Foundation
Every data source becomes queryable EAV facts regardless of original structure; All JSON ingestion uses `jsonEntityFacts()` with consistent entity naming (`{type}:{id}`); Path-aware flattening with dot notation preserves nested relationships; No predefined schemas - dynamic catalog generation from actual data patterns

### II. Query-First Architecture  
Datalog evaluation with external predicates as the universal query interface; EQL-S (Entity Query Language Structured) for human-readable queries; Natural language queries converted to EQL-S via AI orchestration; Cross-domain query patterns work identically across all data types

### III. AI-Human Collaboration (NON-NEGOTIABLE)
AI orchestrator required for natural language processing; Intent analysis categorizes user input (conversation, query, task, command); Tree-of-Thought planning for complex queries when `useToT: true`; Always preserve human agency - AI suggests, humans decide

### IV. CLI-First Interaction
Every feature accessible via `tql` command-line interface; Text in/out protocol: JSON/files → structured results; Support multiple output formats (JSON, CSV, table); Local files and remote URLs as data sources

### V. Component Modularity
EAV engine (`src/eav-engine.ts`) independent of query evaluation; Query engine (`src/query/`) supports pluggable external predicates; AI orchestrator (`src/ai/`) decoupled from data processing; Graph capabilities (`src/graph/`) as optional enhancement

## Technical Standards

### TypeScript Configuration
Bundler mode with `.js` extensions in imports (`import { } from './file.js'`); JSON imports use `assert { type: 'json' }` syntax; Strict TypeScript with `noUncheckedIndexedAccess` enabled; Export explicit named exports from index files

### Performance Requirements  
In-memory EAV store with multi-index optimization (EAV, AEV, AVE); Query execution time tracking mandatory in all `QueryResult` objects; Semi-naive Datalog evaluation for recursive queries; Background process support for long-running operations

### Development Workflow
Demo-driven development - every feature gets an `examples/` demo; Bun as primary runtime and package manager; Type checking with `bun run typecheck` before commits; CLI testing via `bun run tql` commands

## Integration Requirements

### Data Flow Architecture
JSON → `jsonEntityFacts()` → EAV Store → Query Engine → Results; External predicates extend Datalog with regex, comparisons, string operations; AI orchestrator bridges natural language and structured queries; Cross-component communication via typed interfaces

### Testing Strategy
Each component independently testable through its public interface; Integration tests for AI orchestrator query processing; Demo scripts serve as integration validation; CLI contract tests for user-facing functionality

## Governance
Constitution supersedes implementation preferences; All features must demonstrate cross-domain applicability; Complexity requires justification against schema-agnostic principles; Use `.github/copilot-instructions.md` for AI development guidance

**Version**: 1.0.0 | **Ratified**: 2025-09-16 | **Last Amended**: 2025-09-16