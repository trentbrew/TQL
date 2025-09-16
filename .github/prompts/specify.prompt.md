---
description: Create or update the TQL feature specification from a natural language feature description, focusing on EAV engine capabilities.
---

Given the TQL feature description provided as an argument, do this:

1. Run the script `.specify/scripts/bash/create-new-feature.sh --json "$ARGUMENTS"` from repo root and parse its JSON output for BRANCH_NAME and SPEC_FILE. All file paths must be absolute.
2. Load `.specify/templates/spec-template.md` to understand required sections for TQL features.
3. Write the specification to SPEC_FILE using the template structure, focusing on TQL-specific aspects:
   - EAV data ingestion patterns and entity modeling
   - Query requirements (Datalog patterns, external predicates)
   - AI orchestration needs (natural language processing, intent analysis)
   - CLI integration and cross-domain compatibility
   - Performance considerations for in-memory triple store operations
   Replace placeholders with concrete details derived from the feature description while preserving section order and headings.
4. Report completion with branch name, spec file path, and readiness for the TQL planning phase.

Note: The script creates and checks out the new branch and initializes the spec file before writing.
