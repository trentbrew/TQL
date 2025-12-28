# Trellis OS: Complete Implementation Guide

**Version:** 2.0.0
**Date:** December 2024
**Status:** Design & Planning Phase

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Philosophy & Vision](#philosophy--vision)
3. [Architecture Overview](#architecture-overview)
4. [Technical Stack](#technical-stack)
5. [Data Model](#data-model)
6. [Query System](#query-system)
7. [Sync & Collaboration](#sync--collaboration)
8. [User Interface](#user-interface)
9. [NixOS Integration](#nixos-integration)
10. [Implementation Roadmap](#implementation-roadmap)
11. [API Reference](#api-reference)
12. [Security & Privacy](#security--privacy)
13. [Performance Targets](#performance-targets)
14. [Future Directions](#future-directions)

---

## Executive Summary

### What is Trellis?

Trellis is a **semantic operating system for knowledge work** that treats your workspace as a declarative configuration, similar to how NixOS treats system state. Instead of installing apps, you define schemas and projections. Instead of files scattered across folders, you have a unified semantic graph.

### Core Principles

1. **Declarative Over Imperative**
   Your workspace is a `.trellis` configuration file, not an accumulation of state mutations.

2. **Data as First-Class Citizen**
   Everything is a node in a graph. Projects, tasks, files, people—all queryable through a unified interface.

3. **User Sovereignty**
   You own your data. It lives in local SQLite, syncs P2P via Iroh, exports as portable JSON-LD.

4. **AI-Native**
   LLMs are first-class users. Natural language queries compile to Datalog. Semantic meaning over pixel rendering.

5. **Reproducibility**
   Same `.trellis` config = same workspace, anywhere. Version control your work environment like code.

### What Problem Does This Solve?

**Current reality:**

- Apps are silos (Notion, Linear, Asana, Figma)
- Data trapped in proprietary formats
- No semantic understanding (just pixels/markdown)
- Collaboration requires cloud vendors
- Context switching kills productivity

**Trellis reality:**

- One semantic graph (queryable, portable)
- Open format (JSON-LD, self-describing)
- AI understands your intent (not just keywords)
- P2P collaboration (no vendor lock-in)
- Single interface (projections adapt to context)

### Key Features

| Feature                 | Description                                       |
| ----------------------- | ------------------------------------------------- |
| **Semantic Graph**      | EAV store with content-addressed nodes            |
| **Declarative Queries** | EQL-S (SQL-like) + Datalog + Natural Language     |
| **Visual Editor**       | Svelte Flow graph with custom node types          |
| **P2P Sync**            | Iroh for offline-first collaboration              |
| **Native App**          | Tauri (3MB binary, OS integration)                |
| **NixOS Integration**   | Declarative workspace configs                     |
| **AI Orchestration**    | Claude-powered natural language interface         |
| **Projections**         | Card grids, tables, timelines, dashboards, graphs |

---

## Philosophy & Vision

### The JSON-LD OS Hypothesis

**Thesis:** Most web apps are just "making JSON look less like JSON." The fundamental operation is:

```
Data (JSON) → Transform (business logic) → View (UI)
```

**What if we made this explicit?**

Instead of:

```
React Component → fetch() → setState() → render()
```

Do:

```
.trellis file → Kernel → Projection
```

### Hypermedia as the Engine of Application State

In a traditional app, the UI controls the data flow. In Trellis, **data controls the UI flow**.

```javascript
// Traditional (imperative)
function handleClick() {
  setState({ loading: true });
  const data = await api.fetch();
  setState({ data, loading: false });
}

// Trellis (declarative)
{
  "projection": {
    "type": "card-grid",
    "query": {
      "nodeType": "Project",
      "filter": { "status": "active" }
    }
  }
}
```

The kernel evaluates the query, the projection renders the result. No `useState`, no `useEffect`, no loading spinners—just data and views.

### Everything is a Graph

Files, tasks, people, events—these aren't different "types" requiring different apps. They're all **nodes** with **edges** between them.

```
Project --contains--> Task
Task --assigned_to--> Person
Person --created--> File
File --referenced_in--> Project
```

Queries become graph traversals:

```datalog
% Find all people working on projects due this week
responsible_for(Person, Project) :-
  task(Task),
  assigned_to(Task, Person),
  part_of(Task, Project),
  due_date(Project, Date),
  within(Date, this_week).
```

### The Turtles: Convergent Evolution

We're at an inflection point where:

1. **LLMs prefer semantic data** over HTML soup
2. **Local-first** is technically feasible (CRDTs, P2P)
3. **Declarative UIs** are mainstream (React, Svelte)
4. **Content addressing** is proven (IPFS, Git)

Trellis is the **convergence** of these trends into a coherent system.

### HTML Was a Mistake (Sort Of)

HTML describes **geometry**, not **intent**. A `<div>` tells the browser to draw a box, but says nothing about _why_.

```html
<!-- What is this? -->
<div class="card">
  <h3>Website Redesign</h3>
  <span class="badge">High Priority</span>
</div>
```

Versus:

```json
{
  "@type": "Project",
  "trellis:title": "Website Redesign",
  "priority": "High"
}
```

Now an AI can understand: "This is a high-priority project." It can:

- Find similar projects
- Estimate completion time
- Suggest team members
- Identify blockers

HTML can't do this. JSON-LD can.

### The North Star: NixOS for Knowledge Work

NixOS proves that **declarative system configuration** works. Trellis extends this to **declarative workspace configuration**.

```nix
# NixOS: Declarative system
{ config, pkgs, ... }: {
  environment.systemPackages = [ pkgs.git pkgs.vim ];
  services.nginx.enable = true;
}
```

```json
// Trellis: Declarative workspace
{
  "workspace": {
    "ontologies": {
      /* schemas */
    },
    "graph": {
      /* data */
    },
    "projections": {
      /* views */
    }
  }
}
```

**Result:** Reproducible, version-controlled, auditable.

---

## Architecture Overview

### Layered Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ USER LAYER                                                  │
│ └─ Tauri App (native desktop)                              │
│    └─ Svelte Flow (graph visualization)                    │
└─────────────────────────────────────────────────────────────┘
                          ↓ IPC
┌─────────────────────────────────────────────────────────────┐
│ PROJECTION LAYER (rendering)                                │
│ ├─ Card Grid        ├─ Table          ├─ Timeline          │
│ ├─ Dashboard        ├─ Kanban         └─ Graph             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ LOGIC LAYER (transformations)                               │
│ ├─ Formulas ($sum, $currency, $if, etc.)                   │
│ ├─ Rollups (count, avg, sum across relations)              │
│ └─ AI-Generated (Claude-powered properties)                │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ KERNEL LAYER (semantic engine)                              │
│ ├─ Query Compiler (EQL-S → Datalog)                        │
│ ├─ Schema Validator (type checking)                        │
│ ├─ Capability Checker (permissions)                        │
│ ├─ Relation Resolver (graph traversal)                     │
│ └─ AI Orchestrator (natural language)                      │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STORAGE LAYER (persistence)                                 │
│ ├─ EAV Store (in-memory, fast queries)                     │
│ ├─ SQLite Backend (ACID, durable)                          │
│ ├─ Operation Log (append-only, time-travel)                │
│ └─ Catalog (schema inference, stats)                       │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ SYNC LAYER (collaboration)                                  │
│ └─ Iroh (P2P, content-addressed, CRDT)                     │
└─────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

```
User Action (click node)
  ↓
Svelte Component (emits event)
  ↓
Tauri Command (invoke IPC)
  ↓
Kernel (validates, applies)
  ↓
SQLite (persists)
  ↓
Iroh (syncs to peers)
  ↓
Event (notifies frontend)
  ↓
Svelte Store (updates)
  ↓
UI Re-renders
```

### Data Flow Diagram

```
┌──────────────┐
│  .trellis    │  Workspace Config (JSON-LD)
│  file        │
└──────┬───────┘
       │
       ↓ boot
┌──────────────┐
│   Kernel     │  Loads schemas, nodes, edges
│   (Bun)      │  Validates against ontologies
└──────┬───────┘
       │
       ↓ ingest
┌──────────────┐
│  EAV Store   │  Flattens JSON → triples
│  (In-Memory) │  Builds indexes, catalog
└──────┬───────┘
       │
       ↓ persist
┌──────────────┐
│   SQLite     │  ACID transactions
│  (Disk)      │  Operation log
└──────┬───────┘
       │
       ↓ sync
┌──────────────┐
│    Iroh      │  P2P replication
│  (Network)   │  Content addressing
└──────────────┘
```

### Monorepo Structure

```
trellis/
├── packages/
│   ├── kernel/              # Core semantic engine
│   │   ├── src/
│   │   │   ├── store/
│   │   │   │   ├── eav-store.ts
│   │   │   │   ├── sqlite-backend.ts
│   │   │   │   ├── graph-store.ts
│   │   │   │   └── catalog.ts
│   │   │   ├── query/
│   │   │   │   ├── eqls-parser.ts
│   │   │   │   ├── datalog-evaluator.ts
│   │   │   │   ├── query-compiler.ts
│   │   │   │   └── recursive-evaluator.ts
│   │   │   ├── ai/
│   │   │   │   └── orchestrator.ts
│   │   │   ├── capabilities/
│   │   │   │   └── checker.ts
│   │   │   ├── sync/
│   │   │   │   ├── crdt.ts
│   │   │   │   └── vector-clock.ts
│   │   │   └── kernel.ts
│   │   ├── test/
│   │   └── package.json
│   │
│   ├── types/               # Shared TypeScript types
│   │   ├── src/
│   │   │   ├── workspace.ts
│   │   │   ├── node.ts
│   │   │   ├── edge.ts
│   │   │   ├── query.ts
│   │   │   └── projection.ts
│   │   └── package.json
│   │
│   └── cli/                 # TQL CLI (backward compat)
│       ├── src/
│       │   └── tql.ts
│       └── package.json
│
├── src-tauri/               # Tauri backend (Rust)
│   ├── src/
│   │   ├── main.rs
│   │   ├── kernel.rs        # Kernel IPC
│   │   ├── workspace.rs     # Workspace management
│   │   └── sync/
│   │       ├── mod.rs
│   │       └── iroh_sync.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── src/                     # Svelte frontend
│   ├── lib/
│   │   ├── kernel/
│   │   │   ├── client.ts
│   │   │   ├── queries.ts
│   │   │   └── types.ts
│   │   ├── stores/
│   │   │   ├── workspace.ts
│   │   │   ├── nodes.ts
│   │   │   └── sync.ts
│   │   ├── components/
│   │   │   ├── Workspace.svelte
│   │   │   ├── QueryBar.svelte
│   │   │   ├── NodeEditor.svelte
│   │   │   └── SyncPanel.svelte
│   │   └── projections/
│   │       ├── GraphView.svelte
│   │       ├── CardGrid.svelte
│   │       ├── Table.svelte
│   │       ├── Timeline.svelte
│   │       ├── Dashboard.svelte
│   │       └── nodes/
│   │           ├── ProjectNode.svelte
│   │           ├── TaskNode.svelte
│   │           └── FileNode.svelte
│   ├── routes/
│   │   ├── +layout.svelte
│   │   └── +page.svelte
│   └── app.html
│
├── examples/
│   ├── personal-workspace/
│   │   ├── workspace.trellis
│   │   └── README.md
│   ├── team-projects/
│   │   ├── workspace.trellis
│   │   └── README.md
│   └── knowledge-base/
│       ├── workspace.trellis
│       └── README.md
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── QUERY_LANGUAGE.md
│   ├── SYNC_PROTOCOL.md
│   └── API_REFERENCE.md
│
├── nix/
│   ├── default.nix
│   ├── module.nix
│   └── home-manager.nix
│
├── bun.workspace
├── package.json
├── README.md
└── LICENSE
```

---

## Technical Stack

### Core Technologies

| Layer         | Technology         | Why                                              |
| ------------- | ------------------ | ------------------------------------------------ |
| **Runtime**   | Bun                | 3-4x faster than Node, native SQLite, TypeScript |
| **Desktop**   | Tauri              | 3MB binary vs 120MB (Electron), native OS access |
| **Frontend**  | Svelte + SvelteKit | Compiled (fast), reactive, great DX              |
| **Graph UI**  | Svelte Flow        | Visual graph editing, custom nodes, auto-layout  |
| **Database**  | SQLite             | Embedded, ACID, single file, portable            |
| **Sync**      | Iroh               | P2P, content-addressed, CRDT-friendly            |
| **AI**        | Claude (Anthropic) | Best reasoning, long context, JSON mode          |
| **Packaging** | Nix                | Reproducible builds, declarative config          |

### Language Distribution

```
TypeScript: 60%  (Kernel, Svelte frontend)
Rust:       25%  (Tauri backend, Iroh integration)
Svelte:     10%  (UI components)
Nix:         5%  (Packaging, NixOS module)
```

### Dependencies

**Kernel (`packages/kernel`):**

```json
{
  "dependencies": {
    "better-sqlite3": "^9.0.0",
    "@anthropic-ai/sdk": "^0.17.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "bun-types": "latest",
    "@types/better-sqlite3": "^7.6.0"
  }
}
```

**Tauri (`src-tauri`):**

```toml
[dependencies]
tauri = "1.5"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1", features = ["full"] }
iroh = "0.11"
iroh-sync = "0.11"
notify = "6.1"
```

**Frontend (`src`):**

```json
{
  "dependencies": {
    "svelte": "^4.2.0",
    "@sveltejs/kit": "^2.0.0",
    "@xyflow/svelte": "^0.0.34",
    "@tauri-apps/api": "^1.5.0",
    "dagre": "^0.8.5"
  }
}
```

### Build Tools

- **Bun** - Package manager, bundler, test runner
- **Cargo** - Rust build system
- **Vite** - Frontend dev server (via SvelteKit)
- **Nix** - System package management

### Development Tools

- **TypeScript** - Type safety across stack
- **ESLint** - Code quality
- **Prettier** - Code formatting
- **Bun test** - Unit testing (kernel)
- **Vitest** - Integration testing (frontend)
- **Rust Analyzer** - Rust LSP

---

## Data Model

### Core Concepts

#### 1. Nodes

Every entity is a **node** with standard properties:

```typescript
interface Node {
  '@id': string; // trellis:node/{hash}
  '@type': string; // Semantic type (Project, Task, etc.)

  // Standard properties (REQUIRED)
  'trellis:title': string;
  'trellis:description': string;
  'trellis:content': ContentDocument;
  'trellis:metadata': Metadata;

  // Custom properties (schema-defined)
  [key: string]: any;
}
```

**Example:**

```json
{
  "@id": "trellis:node/abc123",
  "@type": "Project",

  "trellis:title": "Website Redesign",
  "trellis:description": "Complete overhaul of company website",
  "trellis:content": {
    "@type": "Document",
    "blocks": [
      {
        "@type": "trellis:Paragraph",
        "text": "This project aims to modernize our web presence."
      }
    ]
  },
  "trellis:metadata": {
    "createdTime": "2024-01-15T08:00:00Z",
    "createdBy": { "@id": "user:alice" },
    "icon": "🎨",
    "tags": ["active", "frontend"]
  },

  // Custom properties
  "status": "active",
  "priority": "High",
  "budget": 50000,
  "spent": 32000,
  "owner": { "@id": "user:alice" },
  "dueDate": "2024-06-30"
}
```

#### 2. Edges

Relationships between nodes are **edges**:

```typescript
interface Edge {
  '@id': string;
  '@type': 'trellis:Relation';

  source: { '@id': string };
  target: { '@id': string };
  relationType: string;

  metadata: {
    createdTime: string;
    createdBy: { '@id': string };
  };
}
```

**Example:**

```json
{
  "@id": "trellis:edge/def456",
  "@type": "trellis:Relation",

  "source": { "@id": "trellis:node/abc123" },
  "target": { "@id": "trellis:node/task001" },
  "relationType": "contains",

  "metadata": {
    "createdTime": "2024-01-20T10:00:00Z",
    "createdBy": { "@id": "user:alice" }
  }
}
```

#### 3. Schemas (Ontologies)

Schemas define the **shape** of nodes:

```typescript
interface Schema {
  '@id': string; // trellis:schema/project
  '@type': 'trellis:Schema';
  version: string;

  fields: PropertyValueSpecification[];
}

interface PropertyValueSpecification {
  name: string;
  valueType: PropertyType;
  required?: boolean;
  description?: string;

  // Type-specific config
  selectOptions?: SelectOption[];
  relation?: RelationConfig;
  formula?: string;
  // ... etc
}
```

**Property Types (Notion-compatible):**

| Type           | Purpose                     | Example                 |
| -------------- | --------------------------- | ----------------------- |
| `title`        | Single-line text (required) | "Website Redesign"      |
| `rich_text`    | Multi-line formatted text   | "This is **bold**"      |
| `number`       | Numeric values              | 50000                   |
| `select`       | Single choice               | "High"                  |
| `multi_select` | Multiple choices            | ["frontend", "ux"]      |
| `status`       | Workflow state              | "active"                |
| `date`         | Date or datetime            | "2024-06-30"            |
| `people`       | User references             | { "@id": "user:alice" } |
| `files`        | File attachments            | File nodes              |
| `checkbox`     | Boolean                     | true/false              |
| `url`          | Web links                   | "https://example.com"   |
| `email`        | Email addresses             | "alice@example.com"     |
| `phone_number` | Phone numbers               | "+1-555-0100"           |
| `relation`     | Cross-collection refs       | Other nodes             |
| `rollup`       | Aggregations                | count, sum, avg         |
| `formula`      | Computed values             | "budget - spent"        |
| `ai_generated` | AI-powered                  | Claude-generated        |

**Example Schema:**

```json
{
  "@id": "trellis:schema/project",
  "@type": "trellis:Schema",
  "version": "1.0.0",

  "fields": [
    {
      "name": "status",
      "valueType": "status",
      "required": true,
      "statusOptions": {
        "options": [
          { "id": "planning", "name": "Planning", "color": "yellow" },
          { "id": "active", "name": "Active", "color": "blue" },
          { "id": "done", "name": "Done", "color": "green" }
        ]
      }
    },
    {
      "name": "budget",
      "valueType": "number",
      "format": "dollar"
    },
    {
      "name": "remaining",
      "valueType": "formula",
      "formula": "budget - spent",
      "returnType": "number",
      "format": "dollar"
    },
    {
      "name": "tasks",
      "valueType": "relation",
      "relation": {
        "targetSchema": "trellis:schema/task",
        "cardinality": "many",
        "syncedProperty": "project"
      }
    },
    {
      "name": "taskCount",
      "valueType": "rollup",
      "rollup": {
        "relationProperty": "tasks",
        "targetProperty": "@id",
        "aggregation": "count"
      }
    }
  ]
}
```

#### 4. EAV Triple Store

Internally, all data is stored as **Entity-Attribute-Value triples**:

```
(entity, attribute, value)
```

**Example:**

```
Node: { "@id": "project:001", "title": "Website", "budget": 50000 }

Becomes:
("project:001", "@id", "project:001")
("project:001", "title", "Website")
("project:001", "budget", 50000)
```

**Why EAV?**

- ✅ Schema-flexible (add fields without migrations)
- ✅ Query-friendly (Datalog over triples)
- ✅ Sparse data (null values don't waste space)
- ✅ Semantic web compatible (RDF/JSON-LD)

**SQLite Schema:**

```sql
CREATE TABLE facts (
  entity TEXT NOT NULL,
  attribute TEXT NOT NULL,
  value TEXT NOT NULL,
  value_type TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  PRIMARY KEY (entity, attribute, value)
);

CREATE INDEX idx_entity ON facts(entity);
CREATE INDEX idx_attribute ON facts(attribute);
CREATE INDEX idx_value ON facts(value);
```

#### 5. Content Documents

Rich content is structured as typed blocks:

```typescript
interface ContentDocument {
  '@type': 'Document';
  blocks: Block[];
}

type Block =
  | ParagraphBlock
  | HeadingBlock
  | TodoListBlock
  | ImageBlock
  | TableBlock;
// ... etc
```

**Example:**

```json
{
  "@type": "Document",
  "blocks": [
    {
      "@type": "trellis:Heading",
      "level": 1,
      "text": "Project Overview"
    },
    {
      "@type": "trellis:Paragraph",
      "text": "This project aims to modernize our web presence."
    },
    {
      "@type": "trellis:TodoList",
      "items": [
        {
          "@type": "trellis:ListItem",
          "text": "Complete design mockups",
          "checked": true
        },
        {
          "@type": "trellis:ListItem",
          "text": "Implement responsive grid",
          "checked": false
        }
      ]
    }
  ]
}
```

#### 6. Operations (Event Sourcing)

All changes are logged as **operations**:

```typescript
interface Operation {
  '@id': string; // trellis:operation/{hash}
  '@type': 'GraphOperation';

  timestamp: string;
  agent: { '@id': string };
  operation: 'create' | 'update' | 'delete' | 'link';
  target: { '@id': string };
  payload: any;
  previous: { '@id': string }; // Previous operation (linked list)
}
```

**Benefits:**

- ✅ **Audit trail** - Who changed what, when
- ✅ **Time travel** - Replay operations to any point
- ✅ **Sync** - Replicate operations to peers
- ✅ **Undo/redo** - Just apply inverse operations
- ✅ **Conflict resolution** - CRDT-friendly

**Example:**

```json
{
  "@id": "trellis:operation/op123",
  "@type": "GraphOperation",

  "timestamp": "2024-12-27T10:30:00Z",
  "agent": { "@id": "user:alice" },
  "operation": "update",
  "target": { "@id": "trellis:node/abc123" },
  "payload": {
    "status": "done",
    "spent": 48000
  },
  "previous": { "@id": "trellis:operation/op122" }
}
```

---

## Query System

### Three Query Interfaces

Trellis supports **three ways** to query the graph, optimized for different users:

| Interface            | User           | Use Case                             |
| -------------------- | -------------- | ------------------------------------ |
| **EQL-S**            | Humans         | SQL-like queries for familiar syntax |
| **Datalog**          | Advanced users | Recursive queries, complex logic     |
| **Natural Language** | Everyone       | AI converts intent → query           |

### 1. EQL-S (Entity Query Language - Simple)

**Syntax:**

```sql
FIND <scope> AS <variable>
WHERE <conditions>
RETURN <projections>
ORDER BY <fields>
LIMIT <n>
```

**Examples:**

**Basic filtering:**

```sql
FIND root AS ?r
WHERE ?r.workspace.graph.nodes.status = "active"
RETURN ?r.workspace.graph.nodes.@id,
       ?r.workspace.graph.nodes.trellis:title
```

**Numeric comparisons:**

```sql
FIND root AS ?r
WHERE ?r.workspace.graph.nodes.budget > 10000
  AND ?r.workspace.graph.nodes.spent < ?r.workspace.graph.nodes.budget * 0.9
RETURN ?r.workspace.graph.nodes.trellis:title,
       ?r.workspace.graph.nodes.budget,
       ?r.workspace.graph.nodes.spent
```

**Text search:**

```sql
FIND root AS ?r
WHERE ?r.workspace.graph.nodes.trellis:content.blocks.text CONTAINS "modernize"
RETURN ?r.workspace.graph.nodes.trellis:title
```

**Regex matching:**

```sql
FIND root AS ?r
WHERE ?r.workspace.graph.nodes.status MATCHES /(active|planning)/
RETURN ?r.workspace.graph.nodes.@id
```

**Array membership:**

```sql
FIND root AS ?r
WHERE "frontend" IN ?r.workspace.graph.nodes.trellis:metadata.tags
RETURN ?r.workspace.graph.nodes.trellis:title
```

**OR conditions:**

```sql
FIND root AS ?r
WHERE (?r.workspace.graph.nodes.priority = "High"
    OR ?r.workspace.graph.nodes.budget > 40000)
  AND ?r.workspace.graph.nodes.status = "active"
RETURN ?r.workspace.graph.nodes.@id
```

**ORDER BY + LIMIT:**

```sql
FIND root AS ?r
WHERE ?r.workspace.graph.nodes.status = "active"
RETURN ?r.workspace.graph.nodes.trellis:title,
       ?r.workspace.graph.nodes.dueDate
ORDER BY ?r.workspace.graph.nodes.dueDate ASC
LIMIT 10
```

### 2. Datalog

**Syntax:**

```prolog
predicate(args) :- conditions.
```

**Examples:**

**Transitive closure (subtasks):**

```prolog
% Base case: direct parent
subtask_of(Child, Parent) :-
  attr(Child, "parent", Parent).

% Recursive case: transitive
subtask_of(Child, Ancestor) :-
  attr(Child, "parent", Parent),
  subtask_of(Parent, Ancestor).

% Query
?- subtask_of(Task, "project:001").
```

**Team access hierarchy:**

```prolog
% Owner has access
can_access(User, Project) :-
  attr(Project, "owner", User).

% Team member has access
can_access(User, Project) :-
  attr(Project, "team", User).

% Manager has access if report does
can_access(User, Project) :-
  attr(Report, "reports_to", User),
  can_access(Report, Project).

% Query
?- can_access("user:alice", Project).
```

**Risk analysis:**

```prolog
% Budget risk
budget_risk(Project) :-
  attr(Project, "budget", Budget),
  attr(Project, "spent", Spent),
  Spent > Budget * 0.9.

% Deadline risk
deadline_risk(Project) :-
  attr(Project, "due_date", Due),
  Due < today() + 7_days,
  attr(Project, "completion_rate", Rate),
  Rate < 0.8.

% Any risk
at_risk(Project) :- budget_risk(Project).
at_risk(Project) :- deadline_risk(Project).

% Query
?- at_risk(Project), attr(Project, "owner", Owner).
```

### 3. Natural Language

**User:** "Show me overdue projects owned by Alice"

**AI generates:**

```sql
FIND root AS ?r
WHERE ?r.workspace.graph.nodes.owner.@id = "user:alice"
  AND ?r.workspace.graph.nodes.dueDate < "2024-12-26"
  AND ?r.workspace.graph.nodes.status != "Completed"
RETURN ?r.workspace.graph.nodes.@id,
       ?r.workspace.graph.nodes.trellis:title,
       ?r.workspace.graph.nodes.dueDate
```

**User:** "Which projects are at risk due to budget or deadlines?"

**AI generates:**

```prolog
budget_risk(P) :-
  budget(P, B),
  spent(P, S),
  S / B > 0.9.

deadline_risk(P) :-
  due_date(P, Due),
  Due < today() + 7_days,
  completion_rate(P, Rate),
  Rate < 0.8.

at_risk(P) :- budget_risk(P).
at_risk(P) :- deadline_risk(P).

?- at_risk(P), owner(P, Owner).
```

### Query Compilation Pipeline

```
EQL-S String
  ↓
Tokenize (lexer)
  ↓
Parse (AST)
  ↓
Validate (attribute resolver)
  ↓
Compile (Datalog goals)
  ↓
Optimize (reorder goals)
  ↓
Execute (Datalog evaluator)
  ↓
Project (select fields)
  ↓
Format (JSON/table/CSV)
```

**Example compilation:**

**Input:**

```sql
WHERE ?r.workspace.graph.nodes.budget > 10000
```

**Compiled goals:**

```typescript
[
  {
    predicate: 'attr',
    args: ['?r', 'workspace.graph.nodes.budget', '?temp'],
  },
  {
    predicate: 'gt',
    args: ['?temp', 10000],
  },
];
```

### External Predicates

Built-in predicates for common operations:

| Predicate             | Purpose      | Example                                     |
| --------------------- | ------------ | ------------------------------------------- |
| `gt(a, b)`            | Greater than | `gt(budget, 10000)`                         |
| `lt(a, b)`            | Less than    | `lt(spent, budget)`                         |
| `between(x, a, b)`    | Range check  | `between(date, "2024-01-01", "2024-12-31")` |
| `contains(str, sub)`  | Substring    | `contains(title, "design")`                 |
| `regex(str, pattern)` | Regex match  | `regex(email, /.*@example\.com/)`           |
| `in(val, array)`      | Membership   | `in("active", tags)`                        |

### Formula System

Computed properties use a formula DSL:

**Syntax:**

```javascript
<field expression>
```

**Helpers:**

**Array operations:**

```javascript
$sum(...values); // Sum array
$avg(...values); // Average
$min(...values); // Minimum
$max(...values); // Maximum
$count(array); // Count elements
$filter(array, fn); // Filter
$map(array, fn); // Map
$reduce(array, fn, init); // Reduce
```

**Formatting:**

```javascript
$currency(number, locale?)        // "$50,000"
$percent(decimal, precision?)     // "87.5%"
$date(timestamp, format?)         // "Jan 15, 2024"
$round(number, precision?)        // 3.14
```

**Logic:**

```javascript
$if(condition, trueVal, falseVal)
$switch(value, cases, default?)
```

**Graph queries:**

```javascript
$related(nodeId, relationType)    // Get related nodes
$ancestors(nodeId, depth?)        // Get ancestors
$descendants(nodeId, depth?)      // Get descendants
```

**Examples:**

```javascript
// Budget remaining
'budget - spent';

// Utilization percentage
'$percent(spent / budget)';

// Days until due
'$if(dueDate, Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24)), null)';

// Completion rate
"$if(taskCount > 0, $percent(completedTasks / taskCount), '0%')";

// Total team budget
"$sum(...$related(this, 'team').map(p => p.budget))";
```

---

## Sync & Collaboration

### Iroh P2P Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Alice's Machine                                             │
│                                                             │
│  Workspace.db                                               │
│  └─ Operations: [op1, op2, op3]                            │
│                                                             │
│  Iroh Node                                                  │
│  ├─ Document: "trellis-workspace-abc123"                   │
│  ├─ Replicate to peers                                     │
│  └─ Subscribe to remote ops                                │
└─────────────────────────────────────────────────────────────┘
                          ↓ ↑
                    QUIC (P2P)
                          ↓ ↑
┌─────────────────────────────────────────────────────────────┐
│ Bob's Machine                                               │
│                                                             │
│  Workspace.db                                               │
│  └─ Operations: [op1, op2, op3, op4_bob]                   │
│                                                             │
│  Iroh Node                                                  │
│  ├─ Subscribe to "trellis-workspace-abc123"                │
│  ├─ Receive Alice's ops                                    │
│  └─ Send Bob's ops                                         │
└─────────────────────────────────────────────────────────────┘
```

### Sync Protocol

**1. Join Workspace**

Bob receives ticket from Alice:

```
iroh://abc123def456...
```

Bob's client:

```rust
sync.join_workspace("iroh://abc123def456...")
```

**2. Initial Sync**

Bob downloads all operations:

```
GET operations/*
→ [op1, op2, op3]
```

Bob applies to local database:

```typescript
for (const op of operations) {
  kernel.apply_remote_operation(op);
}
```

**3. Real-Time Sync**

Alice creates node:

```typescript
kernel.createNode({
  '@type': 'Task',
  'trellis:title': 'New Task',
});
```

Generates operation:

```json
{
  "@id": "op4_alice",
  "timestamp": "2024-12-27T10:30:00Z",
  "agent": { "@id": "user:alice" },
  "operation": "create",
  "target": { "@id": "trellis:node/new123" },
  "payload": {
    /* node data */
  }
}
```

Operation synced via Iroh:

```rust
sync.sync_operation(op4_alice)
  → Iroh replicates to Bob
  → Bob receives event
  → Bob applies operation
  → Bob's UI updates
```

### Conflict Resolution (CRDT)

**Scenario:** Alice and Bob both edit the same node while offline.

**Alice's operation:**

```json
{
  "@id": "op5_alice",
  "timestamp": "2024-12-27T10:30:00Z",
  "operation": "update",
  "target": { "@id": "project:001" },
  "payload": { "status": "done" },
  "vectorClock": { "alice": 5, "bob": 3 }
}
```

**Bob's operation:**

```json
{
  "@id": "op5_bob",
  "timestamp": "2024-12-27T10:30:05Z",
  "operation": "update",
  "target": { "@id": "project:001" },
  "payload": { "priority": "High" },
  "vectorClock": { "alice": 3, "bob": 5 }
}
```

**Conflict detection:**

```typescript
areConcurrent(op5_alice, op5_bob)
  → alice.vectorClock.bob < bob.vectorClock.bob (3 < 5)
  → bob.vectorClock.alice < alice.vectorClock.alice (3 < 5)
  → true (concurrent)

conflictsWith(op5_alice, op5_bob)
  → Both modify project:001
  → Different fields (status vs priority)
  → false (no conflict - mergeable)
```

**Merge:**

```json
{
  "@id": "project:001",
  "status": "done", // From Alice
  "priority": "High" // From Bob
}
```

**If conflicting fields:**

```typescript
// Last Write Wins (LWW)
autoResolve(op5_alice, op5_bob)
  → op5_bob.timestamp > op5_alice.timestamp
  → Winner: op5_bob
```

**Or manual resolution:**

```typescript
// Show conflict UI
showConflictDialog({
  field: 'status',
  local: 'done',
  remote: 'active',
  onResolve: (choice) => {
    kernel.resolveConflict(op5_alice, op5_bob, choice);
  },
});
```

### Offline Support

**Scenario:** Alice works offline for 2 hours.

**Local operations:**

```
op6_alice: create Task A
op7_alice: update Project X
op8_alice: create Task B
```

**When Alice reconnects:**

1. Iroh syncs operation log
2. Bob's operations downloaded: `[op6_bob, op7_bob]`
3. Merge operations using vector clocks
4. Detect conflicts (if any)
5. Apply merged state
6. Upload Alice's operations
7. UI updates to show Bob's changes

**Key insight:** Operations, not state, are synced. This enables:

- ✅ Offline work (queue operations locally)
- ✅ Conflict resolution (merge operation logs)
- ✅ Causality tracking (vector clocks)
- ✅ Undo/redo (inverse operations)

### Permissions & Capabilities

**Scenario:** Alice shares workspace with Bob (read-only).

**Capability definition:**

```json
{
  "capabilities": {
    "bob-read-only": {
      "@type": "trellis:Capability",
      "grants": "read",
      "scope": {
        "nodeType": "*"
      },
      "agent": { "@id": "user:bob" }
    }
  }
}
```

**When Bob tries to create node:**

```typescript
kernel.createNode(...)
  → Check capability
  → bob-read-only.grants = "read"
  → Required: "create"
  → Reject: "Unauthorized"
```

**Capability sharing:**

```rust
// Alice generates capability token
let token = kernel.issueCapabilityToken({
  agent: "user:bob",
  grants: "read",
  expiresAt: "2025-01-01T00:00:00Z"
});

// Alice shares token with Bob
// Bob presents token to join
sync.join_workspace_with_token(ticket, token)
```

---

## User Interface

### Design Philosophy

**Principles:**

1. **Data-First, UI-Second**
   The graph is primary. Projections adapt to show it differently.

2. **Context-Aware**
   Same node, different views. Tasks in Kanban vs. Timeline vs. Table.

3. **Keyboard-First**
   Power users never touch the mouse. Cmd+K for everything.

4. **Collaborative by Default**
   See who's online, what they're editing, cursor presence.

5. **Zero-Latency**
   Optimistic updates. Assume success, rollback on conflict.

### Visual Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│ Top Bar (global)                                            │
│ ├─ Workspace Switcher                                      │
│ ├─ Search (Cmd+K)                                          │
│ └─ Sync Status / Peers                                     │
└─────────────────────────────────────────────────────────────┘
┌─────────┬───────────────────────────────────────────────────┐
│ Sidebar │ Main View                                         │
│         │                                                   │
│ Spaces  │ ┌───────────────────────────────────────────┐   │
│ ├─ 📦   │ │ Projection Controls                       │   │
│ ├─ 📊   │ │ ├─ View: Card Grid / Table / Graph       │   │
│ └─ 📝   │ │ ├─ Filter: status = active               │   │
│         │ │ └─ Sort: priority asc                    │   │
│ Pinned  │ └───────────────────────────────────────────┘   │
│ ├─ ⭐   │                                                   │
│ └─ 🔥   │ ┌───────────────────────────────────────────┐   │
│         │ │                                           │   │
│         │ │      Projection Render Area               │   │
│         │ │                                           │   │
│         │ │   (Cards / Table / Graph / Timeline)      │   │
│         │ │                                           │   │
│         │ └───────────────────────────────────────────┘   │
└─────────┴───────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│ Quick Add Bar (Cmd+N)                                       │
└─────────────────────────────────────────────────────────────┘
```

### Projections

#### 1. Graph View (Primary)

**Technology:** Svelte Flow

**Features:**

- Custom node types (Project, Task, File, Person)
- Drag to create edges
- Auto-layout (Dagre, force-directed)
- Minimap for navigation
- Zoom/pan
- Node clustering (by type, status, owner)

**Node Types:**

**Project Node:**

```svelte
<div class="project-node">
  <div class="header">
    <span class="icon">🎨</span>
    <h3>Website Redesign</h3>
  </div>

  <div class="status">
    <span class="badge active">Active</span>
    <span class="priority">High</span>
  </div>

  <div class="progress">
    <progress value="64" max="100"></progress>
    <span>$32K / $50K</span>
  </div>

  <div class="team">
    <Avatar user="alice" />
    <Avatar user="bob" />
  </div>
</div>
```

**Task Node:**

```svelte
<div class="task-node" class:completed={isCompleted}>
  <input type="checkbox" bind:checked={isCompleted} />
  <span>Complete design mockups</span>

  {#if assignee}
    <Avatar user={assignee} size="sm" />
  {/if}
</div>
```

**Interactions:**

| Action      | Behavior                        |
| ----------- | ------------------------------- |
| Click node  | Open editor panel               |
| Drag node   | Reposition (saves to metadata)  |
| Drag edge   | Create relation                 |
| Delete key  | Delete node (with confirmation) |
| Cmd+Click   | Multi-select                    |
| Scroll      | Zoom in/out                     |
| Right-click | Context menu                    |

#### 2. Card Grid

**Layout:**

```
┌─────────┬─────────┬─────────┐
│ Card 1  │ Card 2  │ Card 3  │
├─────────┼─────────┼─────────┤
│ Card 4  │ Card 5  │ Card 6  │
└─────────┴─────────┴─────────┘
```

**Card Structure:**

```svelte
<div class="card">
  {#if cover}
    <img src={cover} alt="" />
  {/if}

  <div class="badge">{priority}</div>

  <h3>{title}</h3>
  <p class="subtitle">{status}</p>

  <div class="fields">
    <ProgressBar value={utilization} />
    <Avatar user={owner} />
  </div>

  <div class="footer">
    <span class="date">{dueDate}</span>
    <span class="count">{taskCount} tasks</span>
  </div>
</div>
```

**Features:**

- Configurable columns (1-6)
- Drag-to-reorder
- Inline editing
- Quick actions (archive, duplicate, share)
- Grouping (by status, priority, owner)

#### 3. Table

**Layout:**

```
┌────────────┬─────────┬─────────┬─────────┬─────────┐
│ Title      │ Status  │ Owner   │ Budget  │ Due     │
├────────────┼─────────┼─────────┼─────────┼─────────┤
│ Website    │ Active  │ Alice   │ $50K    │ Jun 30  │
│ Mobile App │ Planning│ Bob     │ $30K    │ Aug 15  │
└────────────┴─────────┴─────────┴─────────┴─────────┘
```

**Features:**

- Sortable columns (click header)
- Resizable columns (drag border)
- Inline editing (double-click cell)
- Column visibility toggle
- Row selection (bulk actions)
- Export (CSV, JSON)

**Cell Types:**

| Type     | Render                    |
| -------- | ------------------------- |
| Text     | `<input type="text">`     |
| Number   | `<input type="number">`   |
| Select   | `<select>` dropdown       |
| Date     | Date picker               |
| People   | Avatar chips              |
| Checkbox | `<input type="checkbox">` |
| Progress | Progress bar              |
| Formula  | Read-only (computed)      |

#### 4. Timeline (Gantt)

**Layout:**

```
Today
  ↓
┌────────────┬────────────────────────────────────────┐
│ Project    │ Jan  Feb  Mar  Apr  May  Jun  Jul  Aug │
├────────────┼────────────────────────────────────────┤
│ Website    │ ████████████████░░░░░░                 │
│ Mobile App │           ████████████████████         │
└────────────┴────────────────────────────────────────┘
```

**Features:**

- Drag to adjust duration
- Dependencies (arrows between bars)
- Milestones (diamonds)
- Today marker
- Zoom (day/week/month view)
- Grouping (by status, owner)

#### 5. Dashboard

**Layout:**

```
┌─────────────┬─────────────┐
│  Total $    │  Total ∑    │
│  $450K      │  18 active  │
├─────────────┴─────────────┤
│                           │
│    Budget by Status       │
│    (Bar Chart)            │
│                           │
├───────────────────────────┤
│                           │
│    Timeline               │
│    (Gantt)                │
│                           │
└───────────────────────────┘
```

**Block Types:**

| Block    | Purpose                         |
| -------- | ------------------------------- |
| Metric   | Single number (sum, avg, count) |
| Chart    | Bar, line, pie, scatter         |
| Table    | Embedded table view             |
| Timeline | Embedded Gantt                  |
| Text     | Markdown content                |

**Features:**

- Drag-to-resize blocks
- Configurable grid layout
- Live updates (formulas re-compute)
- Export as PDF/image

### Command Palette (Cmd+K)

**Primary interface for power users:**

```
┌─────────────────────────────────────────────────────────┐
│ > _                                                     │
├─────────────────────────────────────────────────────────┤
│ 🔍 Search...                                            │
│ ➕ New Project                                          │
│ ➕ New Task                                             │
│ 📊 View as Table                                        │
│ 📈 View as Timeline                                     │
│ 🔗 Share Workspace                                      │
│ ⚙️  Settings                                            │
└─────────────────────────────────────────────────────────┘
```

**Features:**

- Fuzzy search (fuse.js)
- Recent actions
- Keyboard shortcuts shown
- Contextual (changes based on selection)

**Example searches:**

| Input     | Result                        |
| --------- | ----------------------------- |
| `website` | Nodes with "website" in title |
| `@alice`  | Nodes owned by Alice          |
| `#active` | Nodes with status "active"    |
| `/table`  | Switch to table view          |
| `>`       | Show commands                 |

### Node Editor (Side Panel)

**Opens when node clicked:**

```
┌─────────────────────────────────────────────────┐
│ Website Redesign                      [× Close] │
├─────────────────────────────────────────────────┤
│ 📦 Project                                      │
│                                                 │
│ Status:      [Active ▼]                        │
│ Priority:    [High ▼]                          │
│ Owner:       [@alice]                          │
│ Budget:      [$50,000]                         │
│ Spent:       [$32,000]                         │
│ Remaining:   $18,000 (auto)                    │
│                                                 │
│ ┌─────────────────────────────────────────┐   │
│ │ Description                             │   │
│ │                                         │   │
│ │ Complete overhaul of company website   │   │
│ │ with modern stack...                   │   │
│ └─────────────────────────────────────────┘   │
│                                                 │
│ Relations:                                      │
│ ├─ Contains: 12 tasks                          │
│ └─ Owned by: Alice                             │
│                                                 │
│ [Save] [Delete]                                │
└─────────────────────────────────────────────────┘
```

**Features:**

- Schema-aware fields
- Validation (required, type checking)
- Auto-save (debounced)
- Keyboard navigation (Tab, Enter)
- Relation picker (search nodes)

### Collaboration UI

**Presence:**

```
┌─────────────────────────────────────────────────┐
│ Online: 3                                       │
│ ├─ 🟢 Alice (editing Project X)                │
│ ├─ 🟢 Bob (viewing Dashboard)                  │
│ └─ 🟡 Charlie (idle)                           │
└─────────────────────────────────────────────────┘
```

**Cursors:**

```
[Graph View]

┌─────────────────────┐
│ Website Redesign    │  ← Alice's cursor here
│ Status: Active      │
└─────────────────────┘
         ↑
     Bob's cursor
```

**Sync Status:**

```
┌─────────────────────────────────────────────────┐
│ ✓ Synced (2 peers connected)                   │
│ ⟳ Syncing... (3 operations pending)            │
│ ⚠ Conflict detected (click to resolve)         │
│ ✗ Offline (changes will sync when connected)   │
└─────────────────────────────────────────────────┘
```

### Design System

**Colors:**

```css
:root {
  /* Grays */
  --gray-50: #fafafa;
  --gray-100: #f5f5f5;
  --gray-200: #eeeeee;
  --gray-300: #e0e0e0;
  --gray-400: #bdbdbd;
  --gray-500: #9e9e9e;
  --gray-600: #757575;
  --gray-700: #616161;
  --gray-800: #424242;
  --gray-900: #212121;

  /* Primary (blue) */
  --primary-50: #e3f2fd;
  --primary-500: #2196f3;
  --primary-900: #0d47a1;

  /* Success (green) */
  --success-500: #4caf50;

  /* Warning (yellow) */
  --warning-500: #ff9800;

  /* Error (red) */
  --error-500: #f44336;
}
```

**Typography:**

```css
:root {
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  --text-xs: 0.75rem; /* 12px */
  --text-sm: 0.875rem; /* 14px */
  --text-base: 1rem; /* 16px */
  --text-lg: 1.125rem; /* 18px */
  --text-xl: 1.25rem; /* 20px */
  --text-2xl: 1.5rem; /* 24px */
  --text-3xl: 1.875rem; /* 30px */
}
```

**Spacing:**

```css
:root {
  --space-0: 0;
  --space-1: 0.25rem; /* 4px */
  --space-2: 0.5rem; /* 8px */
  --space-3: 0.75rem; /* 12px */
  --space-4: 1rem; /* 16px */
  --space-6: 1.5rem; /* 24px */
  --space-8: 2rem; /* 32px */
  --space-12: 3rem; /* 48px */
}
```

**Shadows:**

```css
:root {
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.15);
  --shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.2);
}
```

---

## NixOS Integration

### System-Level Integration

**File:** `/etc/nixos/configuration.nix`

```nix
{ config, pkgs, ... }:

{
  # Install Trellis system-wide
  environment.systemPackages = with pkgs; [
    trellis
  ];

  # Trellis kernel service
  systemd.user.services.trellis-kernel = {
    description = "Trellis semantic kernel";
    wantedBy = [ "default.target" ];

    serviceConfig = {
      ExecStart = "${pkgs.trellis}/bin/trellis-kernel";
      Restart = "always";
      RestartSec = 5;
    };
  };

  # Declarative workspace (optional)
  environment.etc."trellis/workspace.trellis" = {
    source = ./trellis-workspace.trellis;
    mode = "0644";
  };
}
```

### Home Manager Integration

**File:** `~/.config/home-manager/home.nix`

```nix
{ config, pkgs, ... }:

{
  home.packages = [ pkgs.trellis ];

  # User workspace
  xdg.configFile."trellis/workspace.trellis".text = ''
    {
      "@context": {
        "@vocab": "https://schema.org/",
        "trellis": "tag:trellis.app,2024:"
      },
      "workspace": {
        "@id": "trellis:workspace/${config.home.username}",
        "ontologies": {
          "project-schema": {
            "@id": "trellis:schema/project",
            "fields": [
              {
                "name": "status",
                "valueType": "status",
                "statusOptions": {
                  "options": [
                    { "id": "todo", "name": "To Do" },
                    { "id": "active", "name": "Active" },
                    { "id": "done", "name": "Done" }
                  ]
                }
              }
            ]
          }
        },
        "graph": {
          "nodes": [],
          "edges": []
        }
      }
    }
  '';

  # Kernel service
  systemd.user.services.trellis-kernel = {
    Unit = {
      Description = "Trellis kernel";
      After = [ "graphical-session.target" ];
    };

    Service = {
      ExecStart = "${pkgs.trellis}/bin/trellis-kernel boot ${config.xdg.configHome}/trellis/workspace.trellis";
      Restart = "on-failure";
    };

    Install = {
      WantedBy = [ "default.target" ];
    };
  };

  # Desktop entry
  xdg.desktopEntries.trellis = {
    name = "Trellis";
    exec = "${pkgs.trellis}/bin/trellis";
    icon = "trellis";
    categories = [ "Utility" "Office" ];
  };
}
```

### Nix Package Definition

**File:** `nix/default.nix`

```nix
{ pkgs ? import <nixpkgs> {} }:

pkgs.rustPlatform.buildRustPackage rec {
  pname = "trellis";
  version = "2.0.0";

  src = ../.;

  cargoLock = {
    lockFile = ../Cargo.lock;
  };

  nativeBuildInputs = with pkgs; [
    pkg-config
    bun
  ];

  buildInputs = with pkgs; [
    webkitgtk
    openssl
    glib
    gtk3
    libsoup
    sqlite
  ];

  # Build kernel
  preBuild = ''
    cd packages/kernel
    bun install --frozen-lockfile
    bun build src/kernel.ts --compile --outfile trellis-kernel
    cd ../..
  '';

  # Install kernel + Tauri app
  postInstall = ''
    mkdir -p $out/bin
    cp packages/kernel/trellis-kernel $out/bin/

    # Copy desktop entry
    mkdir -p $out/share/applications
    cp assets/trellis.desktop $out/share/applications/

    # Copy icon
    mkdir -p $out/share/icons/hicolor/256x256/apps
    cp assets/trellis.png $out/share/icons/hicolor/256x256/apps/
  '';

  meta = with pkgs.lib; {
    description = "Semantic operating system for knowledge work";
    homepage = "https://github.com/trentbrew/trellis";
    license = licenses.mit;
    maintainers = [ maintainers.trentbrew ];
    platforms = platforms.linux ++ platforms.darwin;
  };
}
```

### Workspace as Flake

**File:** `workspace.nix`

```nix
{
  description = "My Trellis workspace";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    trellis.url = "github:trentbrew/trellis";
  };

  outputs = { self, nixpkgs, trellis }: {
    # Workspace configuration
    workspace = {
      "@context" = {
        "@vocab" = "https://schema.org/";
        "trellis" = "tag:trellis.app,2024:";
      };

      "workspace" = {
        "@id" = "trellis:workspace/my-projects";

        "ontologies" = {
          # Import schema from another flake
          "project-schema" = trellis.schemas.project;
        };

        "graph" = {
          "nodes" = [
            # Nodes defined declaratively
          ];
        };
      };
    };
  };
}
```

**Usage:**

```bash
# Build workspace
nix build .#workspace

# Boot workspace
trellis boot ./result/workspace.trellis

# Update workspace
nix flake update
sudo nixos-rebuild switch
```

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)

**Week 1: Core Kernel**

**Day 1-2: Project Setup**

- [ ] Create monorepo structure
- [ ] Initialize Bun workspace
- [ ] Setup TypeScript configs
- [ ] Add SQLite dependencies
- [ ] Create basic test suite

**Day 3-4: EAV Store**

- [ ] Implement `EAVStore` class
- [ ] Add fact insertion/retrieval
- [ ] Build indexes (entity, attribute, value)
- [ ] Implement catalog generation
- [ ] Write unit tests

**Day 5-7: SQLite Backend**

- [ ] Create `SQLiteBackend` class
- [ ] Implement schema initialization
- [ ] Add fact persistence
- [ ] Implement bulk operations
- [ ] Add transaction support
- [ ] Write integration tests

**Week 2: Query Engine**

**Day 1-3: EQL-S Parser**

- [ ] Port TQL tokenizer
- [ ] Port TQL parser
- [ ] Fix OR semantics (DNF expansion)
- [ ] Add ORDER BY / LIMIT support
- [ ] Implement attribute resolver
- [ ] Write parser tests

**Day 4-5: Datalog Evaluator**

- [ ] Port TQL evaluator
- [ ] Add external predicates (gt, lt, contains, etc.)
- [ ] Implement query optimizer
- [ ] Add performance benchmarks
- [ ] Write evaluator tests

**Day 6-7: Integration**

- [ ] Create `TrellisKernel` class
- [ ] Implement `boot()` method
- [ ] Add CRUD operations
- [ ] Integrate query pipeline
- [ ] End-to-end tests

**Deliverables:**

- ✅ Working kernel (boot, query, CRUD)
- ✅ 90%+ test coverage
- ✅ Performance benchmarks

### Phase 2: Desktop App (Weeks 3-4)

**Week 3: Tauri Backend**

**Day 1-2: Tauri Setup**

- [ ] Initialize Tauri project
- [ ] Configure Rust dependencies
- [ ] Setup IPC commands
- [ ] Implement kernel bridge
- [ ] Test IPC communication

**Day 3-4: File System**

- [ ] Add workspace file watcher
- [ ] Implement .trellis loading
- [ ] Add auto-save
- [ ] Implement export/import
- [ ] Test file operations

**Day 5-7: Native Features**

- [ ] System tray integration
- [ ] Global keyboard shortcuts
- [ ] Native notifications
- [ ] Clipboard integration
- [ ] Test native features

**Week 4: Svelte Frontend**

**Day 1-2: SvelteKit Setup**

- [ ] Initialize SvelteKit project
- [ ] Configure Tauri integration
- [ ] Create Svelte stores
- [ ] Implement kernel client
- [ ] Test frontend-backend communication

**Day 3-5: Core UI**

- [ ] Build Workspace component
- [ ] Implement QueryBar
- [ ] Create NodeEditor
- [ ] Build command palette (Cmd+K)
- [ ] Add keyboard navigation

**Day 6-7: First Projection**

- [ ] Implement CardGrid component
- [ ] Add drag-and-drop
- [ ] Implement inline editing
- [ ] Add filtering/sorting
- [ ] Polish UI

**Deliverables:**

- ✅ Working desktop app
- ✅ Cross-platform builds (macOS, Linux, Windows)
- ✅ Installable packages

### Phase 3: Graph UI (Week 5)

**Day 1-2: Svelte Flow Integration**

- [ ] Add @xyflow/svelte
- [ ] Create GraphView component
- [ ] Implement basic node rendering
- [ ] Add zoom/pan/minimap
- [ ] Test graph interactions

**Day 3-4: Custom Nodes**

- [ ] Build ProjectNode component
- [ ] Build TaskNode component
- [ ] Build FileNode component
- [ ] Implement node editor integration
- [ ] Add visual polish

**Day 5-6: Graph Features**

- [ ] Implement edge creation (drag)
- [ ] Add auto-layout (Dagre)
- [ ] Implement node clustering
- [ ] Add node search/filter
- [ ] Test graph performance

**Day 7: Polish**

- [ ] Add animations
- [ ] Implement keyboard shortcuts
- [ ] Add context menus
- [ ] Optimize rendering
- [ ] User testing

**Deliverables:**

- ✅ Fully functional graph editor
- ✅ Custom node types
- ✅ Auto-layout working

### Phase 4: Sync & Collaboration (Week 6)

**Day 1-3: Iroh Integration**

- [ ] Add Iroh dependencies
- [ ] Implement `IrohSync` struct
- [ ] Add workspace sharing
- [ ] Implement peer discovery
- [ ] Test P2P sync

**Day 4-5: CRDT**

- [ ] Implement vector clocks
- [ ] Add operation log
- [ ] Implement conflict detection
- [ ] Build merge strategies
- [ ] Test concurrent edits

**Day 6-7: Collaboration UI**

- [ ] Build SyncPanel component
- [ ] Add presence indicators
- [ ] Implement cursor tracking
- [ ] Add conflict resolution UI
- [ ] Test real-time collaboration

**Deliverables:**

- ✅ Working P2P sync
- ✅ Conflict resolution
- ✅ Real-time collaboration

### Phase 5: AI & Advanced Features (Week 7)

**Day 1-3: AI Orchestrator**

- [ ] Integrate Claude API
- [ ] Implement natural language → EQL-S
- [ ] Add AI-generated properties
- [ ] Implement smart suggestions
- [ ] Test AI features

**Day 4-5: Additional Projections**

- [ ] Build Table component
- [ ] Build Timeline component
- [ ] Build Dashboard component
- [ ] Add projection switcher
- [ ] Test projections

**Day 6-7: Formula System**

- [ ] Implement formula parser
- [ ] Add helper functions
- [ ] Integrate with kernel
- [ ] Add formula editor UI
- [ ] Test formulas

**Deliverables:**

- ✅ AI-powered queries
- ✅ Multiple projection types
- ✅ Working formulas

### Phase 6: NixOS & Polish (Week 8)

**Day 1-3: NixOS Packaging**

- [ ] Create `default.nix`
- [ ] Write NixOS module
- [ ] Create Home Manager integration
- [ ] Test on NixOS
- [ ] Document Nix setup

**Day 4-5: Documentation**

- [ ] Write user guide
- [ ] Document API
- [ ] Create tutorials
- [ ] Record demo videos
- [ ] Build landing page

**Day 6-7: Final Polish**

- [ ] Fix bugs
- [ ] Optimize performance
- [ ] Improve error handling
- [ ] Add telemetry (opt-in)
- [ ] Prepare for release

**Deliverables:**

- ✅ NixOS package
- ✅ Complete documentation
- ✅ Production-ready v2.0.0

---

## API Reference

### Kernel API

**Boot workspace:**

```typescript
const kernel = new TrellisKernel('./workspace.db');
kernel.boot(workspaceConfig);
```

**Query (EQL-S):**

```typescript
const results = kernel.query(`
  FIND root AS ?r
  WHERE ?r.workspace.graph.nodes.status = "active"
  RETURN ?r.workspace.graph.nodes.@id
`);
```

**Query (Natural Language):**

```typescript
const results = await kernel.queryNatural(
  'Show me overdue projects owned by Alice',
);
```

**Query (Datalog):**

```typescript
const results = kernel.queryDatalog(`
  at_risk(P) :- budget_risk(P).
  ?- at_risk(P).
`);
```

**Create node:**

```typescript
const id = kernel.createNode(
  {
    '@type': 'Project',
    'trellis:title': 'New Project',
    status: 'planning',
    budget: 10000,
  },
  'user:alice',
);
```

**Update node:**

```typescript
kernel.updateNode(
  'trellis:node/abc123',
  {
    status: 'active',
    spent: 5000,
  },
  'user:alice',
);
```

**Delete node:**

```typescript
kernel.deleteNode('trellis:node/abc123', 'user:alice');
```

**Export workspace:**

```typescript
const config = kernel.export();
await Bun.write('workspace.trellis', JSON.stringify(config, null, 2));
```

### Tauri API (IPC Commands)

**Boot workspace:**

```typescript
import { invoke } from '@tauri-apps/api/tauri';

await invoke('boot_workspace', {
  workspacePath: '~/.config/trellis/workspace.trellis',
});
```

**Query kernel:**

```typescript
const results = await invoke('query_kernel', {
  query: 'FIND root AS ?r WHERE ...',
});
```

**Create node:**

```typescript
const id = await invoke('create_node', {
  node: {
    '@type': 'Project',
    'trellis:title': 'New Project',
  },
});
```

**Enable sync:**

```typescript
const ticket = await invoke('enable_sync', {
  workspacePath: '~/.config/trellis/workspace.db',
});
// Returns: "iroh://abc123def..."
```

**Join workspace:**

```typescript
await invoke('join_workspace', {
  ticket: 'iroh://abc123def...',
});
```

**Get peers:**

```typescript
const peers = await invoke('get_peers');
// Returns: ["peer1", "peer2"]
```

### Svelte Stores API

**Boot workspace:**

```typescript
import { bootWorkspace } from '$lib/stores/workspace';

await bootWorkspace('~/.config/trellis/workspace.trellis');
```

**Query:**

```typescript
import { query } from '$lib/stores/workspace';

const results = await query('FIND root AS ?r WHERE ...');
```

**Access nodes:**

```typescript
import { nodes } from '$lib/stores/workspace';

$nodes.forEach((node, id) => {
  console.log(id, node);
});
```

**Subscribe to changes:**

```typescript
import { workspace } from '$lib/stores/workspace';

$: if ($workspace) {
  console.log('Workspace loaded:', $workspace.workspace['@id']);
}
```

---

## Security & Privacy

### Threat Model

**Trusted:**

- User's local machine
- Kernel (Bun process)
- Tauri app

**Untrusted:**

- Remote peers (Iroh network)
- AI providers (Anthropic)
- Third-party projections

### Data Protection

**At Rest:**

- SQLite database encrypted (optional)
- User chooses encryption key
- No cloud backup (user responsibility)

**In Transit:**

- Iroh uses QUIC (encrypted by default)
- TLS for AI API calls
- No plaintext over network

**AI Privacy:**

- User controls what data is sent to AI
- Prompt templates redact sensitive fields
- AI responses are local-only (not logged)

**Example:**

```typescript
// User's data
const project = {
  title: 'Secret Project',
  budget: 1000000, // SENSITIVE
  description: 'Confidential information...',
};

// Kernel redacts before sending to AI
const prompt = extractForAI(project, {
  fields: ['title', 'description'],
  redact: ['budget'], // Never sent to AI
});

// AI receives sanitized data
// { "title": "Secret Project", "description": "..." }
```

### Capability-Based Security

**Zero-Trust Model:**

- Every operation requires capability
- Capabilities are explicit (not inherited)
- User grants capabilities (not kernel)

**Example:**

```json
{
  "capabilities": {
    "ai-summarize": {
      "@type": "trellis:Capability",
      "grants": "execute",
      "scope": {
        "function": "ai-generate",
        "budget": {
          "maxCostPerMonth": 25.0
        }
      }
    }
  }
}
```

**If budget exceeded:**

```typescript
kernel.aiGenerate(...)
  → Check capability
  → Budget: $25.50 / $25.00
  → Reject: "AI budget exceeded for this month"
```

### Sync Security

**Peer Authentication:**

- Iroh uses cryptographic identities
- Peers verify via public key
- No IP-based trust

**Capability Tokens:**

- Share workspace with scoped permissions
- Tokens are time-limited
- Revocable (local blacklist)

**Example:**

```rust
// Alice shares read-only access
let token = kernel.issueCapabilityToken({
  agent: "user:bob",
  grants: "read",
  expiresAt: "2025-01-01T00:00:00Z"
});

// Bob joins with token
sync.join_workspace_with_token(ticket, token)
  → Verified by Alice's node
  → Bob can read, not write
```

---

## Performance Targets

### Kernel Benchmarks

| Operation                 | Target | Measured |
| ------------------------- | ------ | -------- |
| Boot 1K-node workspace    | <500ms | TBD      |
| Query (10 conditions)     | <50ms  | TBD      |
| Create node               | <10ms  | TBD      |
| Update node               | <10ms  | TBD      |
| Recursive query (depth 5) | <100ms | TBD      |
| Export workspace          | <200ms | TBD      |

### UI Performance

| Metric                   | Target | Measured |
| ------------------------ | ------ | -------- |
| First paint              | <200ms | TBD      |
| Time to interactive      | <1s    | TBD      |
| Graph render (100 nodes) | <100ms | TBD      |
| Graph render (1K nodes)  | <500ms | TBD      |
| Projection switch        | <50ms  | TBD      |

### Sync Performance

| Metric                | Target | Measured |
| --------------------- | ------ | -------- |
| Initial sync (1K ops) | <2s    | TBD      |
| Real-time latency     | <100ms | TBD      |
| Conflict detection    | <10ms  | TBD      |
| Merge operations      | <50ms  | TBD      |

### Memory Usage

| Context                | Target | Measured |
| ---------------------- | ------ | -------- |
| Kernel (idle)          | <50MB  | TBD      |
| Kernel (1K nodes)      | <200MB | TBD      |
| Tauri app (idle)       | <100MB | TBD      |
| Tauri app (graph view) | <300MB | TBD      |

---

## Future Directions

### Phase 7: Mobile Companion (Q1 2025)

**React Native app:**

- View-only (editing on desktop)
- Quick capture (voice notes → tasks)
- Offline sync
- Push notifications

### Phase 8: Plugin System (Q2 2025)

**User-defined projections:**

```typescript
// plugins/gantt-chart/index.ts
export default {
  type: 'gantt-chart',
  render: (nodes, config) => {
    return GanttChart({ nodes, config });
  },
};
```

**Custom schemas:**

```json
{
  "plugins": ["trellis-plugin-crm", "trellis-plugin-finance"]
}
```

### Phase 9: Federation (Q3 2025)

**Cross-workspace queries:**

```sql
FIND workspace:team/projects AS ?p
WHERE ?p.owner = @me
UNION
FIND workspace:personal/tasks AS ?t
WHERE ?t.project IN ?p
```

**Shared ontologies:**

```json
{
  "ontologies": {
    "project-schema": "https://schemas.trellis.app/project/v1"
  }
}
```

### Phase 10: AI Agents (Q4 2025)

**Autonomous agents:**

```json
{
  "agents": {
    "budget-monitor": {
      "@type": "trellis:Agent",
      "trigger": "on_update",
      "condition": "spent / budget > 0.9",
      "action": "notify_owner",
      "message": "Project {{title}} is nearing budget limit"
    }
  }
}
```

**Multi-agent workflows:**

```json
{
  "workflow": {
    "steps": [
      {
        "agent": "data-collector",
        "task": "fetch_market_data"
      },
      {
        "agent": "analyzer",
        "task": "generate_insights",
        "input": "{{data-collector.output}}"
      },
      {
        "agent": "reporter",
        "task": "create_report",
        "input": "{{analyzer.output}}"
      }
    ]
  }
}
```

---

## Conclusion

Trellis OS represents a **fundamental rethinking** of how we interact with knowledge work tools. By treating workspaces as declarative configurations, data as a semantic graph, and AI as a first-class user, we enable a future where:

- **Data is portable** (no vendor lock-in)
- **Collaboration is P2P** (no central authority)
- **Intelligence is ambient** (AI understands intent)
- **Interfaces adapt** (projections, not apps)
- **Systems are reproducible** (Nix-style declarative config)

This is not just a new app—it's a new **operating system** for how we think, work, and collaborate.

**Status:** Ready for implementation.

**Next Step:** Begin Week 1, Day 1 of the roadmap.

---

**End of Document**
