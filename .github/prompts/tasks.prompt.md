---
description: Generate actionable, dependency-ordered tasks.md for TQL features based on EAV engine architecture and AI orchestration patterns.
---

Given the TQL feature context provided as an argument, do this:

1. Run `.specify/scripts/bash/check-task-prerequisites.sh --json` from repo root and parse FEATURE_DIR and AVAILABLE_DOCS list. All paths must be absolute.
2. Load and analyze available design documents with TQL context:
   - Always read plan.md for EAV patterns, query engine integration, and AI orchestrator usage
   - IF EXISTS: Read data-model.md for entity schemas and fact generation patterns
   - IF EXISTS: Read contracts/ for API endpoints and external predicate definitions
   - IF EXISTS: Read research.md for Datalog evaluation and performance decisions
   - IF EXISTS: Read quickstart.md for cross-domain query scenarios

   Note: TQL features may focus on different components:
   - EAV engine features might not need contracts/
   - Query engine features focus on datalog-evaluator.ts patterns
   - AI features emphasize orchestrator.ts integration
   - CLI features extend src/cli/tql.ts patterns

3. Generate TQL-specific tasks following the template:
   - Use `.specify/templates/tasks-template.md` as the base
   - Replace example tasks with TQL-appropriate tasks:
     * **Setup tasks**: Bun dependencies, TypeScript configuration, TQL build setup
     * **Test tasks [P]**: EAV fact ingestion tests, query evaluation tests, orchestrator tests
     * **Core tasks**: Entity fact generation, query pattern implementation, external predicates
     * **Integration tasks**: AI model integration, CLI command integration, cross-component data flow
     * **Polish tasks [P]**: Demo creation (examples/), performance benchmarks, documentation

4. TQL task generation rules:
   - Each EAV ingestion pattern → fact generation test task marked [P]
   - Each query pattern in data-model → query implementation task marked [P]
   - Each external predicate → predicate test and implementation (not parallel if shared evaluator)
   - Each AI orchestration scenario → integration test marked [P]
   - Each CLI command → command test and implementation
   - Different TQL components = can be parallel [P] (eav-engine.ts, query/, ai/)
   - Same file = sequential (no [P])

5. Order tasks by TQL architecture dependencies:
   - Setup before everything (Bun, TypeScript, dependencies)
   - EAV engine tests before query engine (fact generation foundation)
   - Query engine tests before AI orchestrator (query patterns foundation)
   - Core implementation before CLI integration
   - Component tests before cross-component integration
   - Everything before demos and polish

6. Include TQL-specific parallel execution examples:
   - Group [P] tasks for independent TQL components
   - Show examples using TQL demo patterns (bun run demo:eav, etc.)
   - Reference TQL CLI workflows (bun run tql commands)

7. Create FEATURE_DIR/tasks.md with:
   - Correct TQL feature name from implementation plan
   - TQL-specific task patterns and dependencies
   - Integration with existing TQL architecture (src/eav-engine.ts, src/query/, src/ai/, src/cli/)
   - Numbered tasks (T001, T002, etc.)
   - Clear file paths for each task
   - Dependency notes
   - Parallel execution guidance

Context for task generation: $ARGUMENTS

The tasks.md should be immediately executable - each task must be specific enough that an LLM can complete it without additional context.
