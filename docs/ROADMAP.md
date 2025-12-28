# TQL Roadmap

> **Status as of October 2025**: TQL v1.1.0 is production-ready with comprehensive hardening, professional CLI ergonomics, and enterprise-grade error handling.

---

## 🎯 Vision

Transform TQL from a powerful query engine into a complete data orchestration platform with best-in-class developer experience, scalability, and extensibility.

---

## 📊 Current State

### ✅ Completed
- EAV engine with path-aware JSON ingestion
- Datalog evaluator with EQL-S DSL
- TQL CLI with local/remote data support
- Natural language orchestrator
- Agent graph runtime for LLM workflows
- Production-hardened workflow engine
- Comprehensive test suite (26/26 passing)
- Updated documentation reflecting all capabilities

### 🚧 In Progress
- None currently

---

## 🗺️ Roadmap by Priority

## 1. Documentation Depth 🎯 HIGH IMPACT

### 1.1 API Reference Documentation
- [ ] Set up TypeDoc or similar tool
- [ ] Generate API docs from TypeScript source
- [ ] Host docs on GitHub Pages or similar
- [ ] Add code examples for all public APIs
- [ ] Include JSDoc comments in source files
- **Impact**: Lower barrier to adoption, reduce support burden
- **Effort**: 2-3 days
- **Dependencies**: None

### 1.2 Tutorial Series
- [ ] **Tutorial 1**: Building a product search with TQL
  - [ ] Draft outline
  - [ ] Create sample dataset
  - [ ] Write step-by-step guide
  - [ ] Add to docs/tutorials/
- [ ] **Tutorial 2**: Analyzing social media data with agent graphs
  - [ ] Draft outline
  - [ ] Create sample dataset
  - [ ] Write step-by-step guide
  - [ ] Add to docs/tutorials/
- [ ] **Tutorial 3**: Creating custom workflows with YAML
  - [ ] Draft outline
  - [ ] Create sample workflows
  - [ ] Write step-by-step guide
  - [ ] Add to docs/tutorials/
- **Impact**: Drive adoption through practical examples
- **Effort**: 1-2 days per tutorial
- **Dependencies**: None

### 1.3 Architecture Visualization
- [ ] Create system architecture diagram (Mermaid/Excalidraw)
- [ ] Document data flow: JSON → EAV → Datalog → Results
- [ ] Visualize component relationships
- [ ] Add performance characteristics per component
- [ ] Include in main README and docs/
- **Impact**: Help users understand system design
- **Effort**: 1 day
- **Dependencies**: None

---

## 2. Developer Experience 🚀 MEDIUM-HIGH IMPACT

### 2.1 Interactive REPL Mode
- [ ] Design REPL command structure
- [ ] Implement `tql repl` command
- [ ] Add readline/history support
- [ ] Support multi-line queries
- [ ] Add REPL-specific commands (.schema, .tables, .help)
- [ ] Write REPL documentation
- [ ] Add REPL demo to examples/
- **Impact**: Dramatically improve exploratory workflow
- **Effort**: 3-4 days
- **Dependencies**: None

### 2.2 Query Debugger & Explain
- [ ] Design execution plan format
- [ ] Implement query explain mode (`--explain`)
- [ ] Add step-by-step trace visualization
- [ ] Show index usage statistics
- [ ] Display cardinality estimates
- [ ] Create debug UI (CLI or web-based)
- [ ] Add debugging examples
- **Impact**: Help users optimize queries
- **Effort**: 5-7 days
- **Dependencies**: None

### 2.3 VSCode Extension
- [ ] Set up extension scaffold (yo code)
- [ ] Add EQL-S syntax highlighting
- [ ] Implement YAML workflow schema validation
- [ ] Add code completion for TQL queries
- [ ] Create extension documentation
- [ ] Publish to VS Code Marketplace
- [ ] Add installation guide to README
- **Impact**: Improve in-editor experience
- **Effort**: 5-7 days
- **Dependencies**: None

### 2.4 Interactive Playground Website
- [ ] Design playground UI (Monaco editor + results pane)
- [ ] Build web frontend (React/Svelte/vanilla)
- [ ] Bundle TQL for browser (WASM or pure JS)
- [ ] Add sample datasets selector
- [ ] Implement shareable query links
- [ ] Deploy to Vercel/Netlify
- [ ] Add playground link to README
- **Impact**: Lower barrier to trying TQL
- **Effort**: 7-10 days
- **Dependencies**: None

---

## 3. Performance & Scale 💪 MEDIUM-HIGH IMPACT

### 3.1 Benchmark Suite
- [ ] Define benchmark scenarios (small/medium/large datasets)
- [ ] Implement benchmark harness
- [ ] Add query performance tests
- [ ] Create ingestion performance tests
- [ ] Set up CI benchmark tracking
- [ ] Document performance characteristics
- [ ] Create baseline for v1.1.0
- **Impact**: Track performance regressions, guide optimization
- **Effort**: 2-3 days
- **Dependencies**: None

### 3.2 Persistent Store Option
- [ ] Research backend options (SQLite, DuckDB, DataFusion)
- [ ] Design storage abstraction interface
- [ ] Implement SQLite backend
- [ ] Add configuration option for backend selection
- [ ] Migrate indexes to persistent store
- [ ] Add migration tests
- [ ] Document storage options
- **Impact**: Handle larger-than-RAM datasets
- **Effort**: 10-14 days
- **Dependencies**: 3.1 (benchmarks)

### 3.3 Streaming Ingestion
- [ ] Design streaming API
- [ ] Implement chunked JSON parser
- [ ] Add streaming file reader
- [ ] Support streaming HTTP responses
- [ ] Create streaming examples
- [ ] Add streaming tests
- [ ] Document streaming capabilities
- **Impact**: Process large files without loading entirely into memory
- **Effort**: 5-7 days
- **Dependencies**: None

### 3.4 Query Optimizer
- [ ] Implement cost model for operations
- [ ] Add cardinality estimation
- [ ] Create query plan optimization pass
- [ ] Implement join reordering
- [ ] Add filter pushdown
- [ ] Benchmark optimizer improvements
- [ ] Document optimization strategies
- **Impact**: Automatically improve query performance
- **Effort**: 14-21 days
- **Dependencies**: 3.1 (benchmarks)

---

## 4. Integration Ecosystem 🔌 MEDIUM IMPACT

### 4.1 Data Source Adapters
- [ ] **PostgreSQL Adapter**
  - [ ] Design adapter interface
  - [ ] Implement connection pooling
  - [ ] Add query translation
  - [ ] Create PostgreSQL examples
  - [ ] Write adapter tests
- [ ] **MongoDB Adapter**
  - [ ] Implement MongoDB connector
  - [ ] Add document-to-EAV mapping
  - [ ] Create MongoDB examples
- [ ] **REST API Adapter**
  - [ ] Support pagination patterns
  - [ ] Add authentication methods
  - [ ] Create REST examples
- [ ] **GraphQL Adapter**
  - [ ] Implement GraphQL client
  - [ ] Add schema introspection
  - [ ] Create GraphQL examples
- **Impact**: Connect to real-world data sources
- **Effort**: 3-5 days per adapter
- **Dependencies**: None

### 4.2 Output Formats
- [ ] **Parquet Export**
  - [ ] Add parquet-wasm dependency
  - [ ] Implement Parquet writer
  - [ ] Add export tests
- [ ] **Apache Arrow Export**
  - [ ] Add arrow dependency
  - [ ] Implement Arrow table builder
  - [ ] Add export tests
- [ ] **SQLite Export**
  - [ ] Implement SQLite database writer
  - [ ] Add schema inference
  - [ ] Create export examples
- **Impact**: Interop with analytics tools
- **Effort**: 2-3 days per format
- **Dependencies**: None

### 4.3 Observability Integration
- [ ] Add OpenTelemetry SDK
- [ ] Instrument query execution
- [ ] Add trace context propagation
- [ ] Create metrics exporters
- [ ] Add observability examples
- [ ] Document observability setup
- **Impact**: Production monitoring and debugging
- **Effort**: 5-7 days
- **Dependencies**: None

### 4.4 CI/CD Templates
- [ ] **GitHub Actions**
  - [ ] Create reusable workflow
  - [ ] Add caching strategy
  - [ ] Include test examples
- [ ] **GitLab CI**
  - [ ] Create .gitlab-ci.yml template
  - [ ] Add example pipelines
- [ ] **Docker Support**
  - [ ] Create Dockerfile
  - [ ] Publish to Docker Hub
  - [ ] Add docker-compose examples
- **Impact**: Easy adoption in existing pipelines
- **Effort**: 2-3 days
- **Dependencies**: None

---

## 5. AI/Agent Enhancements 🤖 HIGH IMPACT

### 5.1 Multi-Model Support
- [ ] Abstract LLM provider interface
- [ ] Add Anthropic Claude support
- [ ] Add Google Gemini support
- [ ] Add Ollama support (local models)
- [ ] Implement provider fallback logic
- [ ] Add model selection configuration
- [ ] Create multi-model examples
- [ ] Document provider setup
- **Impact**: Reduce vendor lock-in, enable local deployment
- **Effort**: 5-7 days
- **Dependencies**: None

### 5.2 Agent Tools Library
- [ ] **Built-in Tools**
  - [ ] File system operations
  - [ ] HTTP requests
  - [ ] Data transformations
  - [ ] Math/statistics
  - [ ] Date/time utilities
- [ ] Create tool registry system
- [ ] Add tool discovery mechanism
- [ ] Implement tool validation
- [ ] Write tool development guide
- [ ] Add tool examples
- **Impact**: Accelerate agent workflow development
- **Effort**: 7-10 days
- **Dependencies**: None

### 5.3 Graph Visualization UI
- [ ] Design visualization format
- [ ] Build real-time graph viewer (web-based)
- [ ] Add execution state display
- [ ] Show data flow between nodes
- [ ] Implement playback controls
- [ ] Add export to image/video
- [ ] Create visualization examples
- **Impact**: Debug and understand agent workflows
- **Effort**: 10-14 days
- **Dependencies**: None

### 5.4 Memory Persistence
- [ ] Design memory storage schema
- [ ] Implement conversation history store
- [ ] Add entity memory system
- [ ] Create memory retrieval API
- [ ] Add memory compression/summarization
- [ ] Write memory examples
- [ ] Document memory patterns
- **Impact**: Enable stateful multi-session agents
- **Effort**: 7-10 days
- **Dependencies**: 3.2 (persistent store)

---

## 6. Community & Growth 🌱 STRATEGIC

### 6.1 Example Gallery
- [ ] Create examples/ subdirectory structure
- [ ] **Real-world Examples**
  - [ ] E-commerce product search
  - [ ] Log analysis pipeline
  - [ ] Social media analytics
  - [ ] Content recommendation engine
  - [ ] Data quality monitoring
- [ ] Add README per example with setup instructions
- [ ] Create gallery webpage
- [ ] Link gallery from main README
- **Impact**: Showcase capabilities, inspire usage
- **Effort**: 2-3 days per example
- **Dependencies**: None

### 6.2 Plugin System
- [ ] Design plugin API
- [ ] Implement plugin loader
- [ ] Create plugin registry
- [ ] Add plugin discovery mechanism
- [ ] Write plugin development guide
- [ ] Create example plugins
- [ ] Document plugin publishing process
- **Impact**: Enable ecosystem contributions
- **Effort**: 10-14 days
- **Dependencies**: None

### 6.3 Public Roadmap
- [ ] ~~Create ROADMAP.md~~ ✅ Done
- [ ] Set up GitHub Projects board
- [ ] Add issue templates for feature requests
- [ ] Create contribution guidelines
- [ ] Set up community discussions
- [ ] Add roadmap link to README
- **Impact**: Transparent development, community engagement
- **Effort**: 1 day
- **Dependencies**: None

### 6.4 Contributing Guide
- [ ] Write CONTRIBUTING.md
- [ ] Document development setup
- [ ] Add code style guidelines
- [ ] Create PR template
- [ ] Label good first issues
- [ ] Write commit message conventions
- [ ] Add contributor recognition system
- **Impact**: Lower barrier for external contributions
- **Effort**: 1-2 days
- **Dependencies**: None

---

## 📅 Suggested Timeline

### Phase 1: Foundation (Weeks 1-2)
**Focus**: Quick wins and essential documentation
- [x] API Reference Documentation (1.1)
- [x] Benchmark Suite (3.1)
- [x] Interactive REPL Mode (2.1)
- [x] Tutorial 1: Product Search (1.2)

### Phase 2: Developer Experience (Weeks 3-6)
**Focus**: Tools that improve daily workflow
- [ ] Query Debugger & Explain (2.2)
- [ ] VSCode Extension (2.3)
- [ ] Tutorial 2: Social Media Analysis (1.2)
- [ ] Tutorial 3: YAML Workflows (1.2)
- [ ] PostgreSQL Adapter (4.1)

### Phase 3: Scale & Performance (Weeks 7-10)
**Focus**: Handle production workloads
- [ ] Persistent Store Option (3.2)
- [ ] Streaming Ingestion (3.3)
- [ ] Multi-Model Support (5.1)
- [ ] Agent Tools Library (5.2)

### Phase 4: Ecosystem (Weeks 11-14)
**Focus**: Integration and extensibility
- [ ] Interactive Playground (2.4)
- [ ] Additional Data Adapters (4.1)
- [ ] Output Formats (4.2)
- [ ] Example Gallery (6.1)
- [ ] Plugin System (6.2)

### Phase 5: Advanced Features (Weeks 15-20)
**Focus**: Advanced capabilities
- [ ] Query Optimizer (3.4)
- [ ] Graph Visualization UI (5.3)
- [ ] Memory Persistence (5.4)
- [ ] Observability Integration (4.3)

### Ongoing
**Focus**: Community and growth
- [ ] Contributing Guide (6.4)
- [ ] CI/CD Templates (4.4)
- [ ] Example Gallery expansion (6.1)
- [ ] Documentation updates

---

## 🎬 Getting Started

### Pick Your Adventure

**Want to improve documentation?** → Start with 1.1 or 1.2  
**Love building tools?** → Jump to 2.1 or 2.2  
**Performance enthusiast?** → Begin with 3.1 or 3.2  
**Integration focused?** → Tackle 4.1 or 4.2  
**AI/Agent expert?** → Dive into 5.1 or 5.2  
**Community builder?** → Launch 6.1 or 6.4  

### How to Track Progress

1. Copy this file to your project management tool (GitHub Projects, Linear, Notion, etc.)
2. Convert checkboxes to issues/tasks
3. Add assignees, due dates, and labels
4. Update this file periodically with completed items
5. Celebrate wins! 🎉

---

## 📝 Notes

- **Effort estimates** are for a single developer and may vary based on familiarity
- **Dependencies** indicate features that should be completed first for optimal results
- **Impact ratings** reflect anticipated user/developer benefit
- This roadmap is a living document—priorities may shift based on community feedback

---

## 🤝 Contributing

Interested in contributing? Pick an item, open an issue to discuss the approach, then submit a PR! See CONTRIBUTING.md (coming soon) for details.

---

**Last Updated**: October 10, 2025  
**Version**: 1.1.0  
**Status**: Production Ready
