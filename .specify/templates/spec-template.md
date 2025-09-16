# Feature Specification: [FEATURE NAME]

**Feature Branch**: `[###-feature-name]`  
**Created**: [DATE]  
**Status**: Draft  
**Input**: User description: "$ARGUMENTS"

## Execution Flow (main)
```
1. Parse user description from Input
   → If empty: ERROR "No feature description provided"
2. Extract key concepts from description
   → Identify: actors, actions, data, constraints
3. For each unclear aspect:
   → Mark with [NEEDS CLARIFICATION: specific question]
4. Fill User Scenarios & Testing section
   → If no clear user flow: ERROR "Cannot determine user scenarios"
5. Generate Functional Requirements
   → Each requirement must be testable
   → Mark ambiguous requirements
6. Identify Key Entities (if data involved)
7. Run Review Checklist
   → If any [NEEDS CLARIFICATION]: WARN "Spec has uncertainties"
   → If implementation details found: ERROR "Remove tech details"
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines for TQL Features
- ✅ Focus on WHAT data patterns and query needs users have and WHY
- ❌ Avoid HOW to implement (no EAV internals, AI model specifics, query optimization details)  
- � Written for domain experts and data analysts, not TQL developers
- 📊 Think in terms of entity-attribute-value relationships and cross-domain patterns

### Section Requirements  
- **Mandatory sections**: Must be completed for every TQL feature
- **Optional sections**: Include only when relevant to the data processing or query feature
- When a section doesn't apply, remove it entirely (don't leave as "N/A")

### For AI Generation of TQL Specs
When creating this spec from a user prompt:
1. **Mark all ambiguities**: Use [NEEDS CLARIFICATION: specific question] for any assumption about data structure, query patterns, or user intent
2. **Don't guess data schemas**: If the prompt doesn't specify entity relationships, attribute types, or query requirements, mark it
3. **Think like a query tester**: Every vague requirement should fail the "testable and unambiguous" checklist item
4. **Common TQL underspecified areas**:
   - Entity naming conventions and ID strategies
   - Attribute cardinality (one vs many values)
   - Cross-domain query requirements  
   - Natural language query patterns
   - Performance targets for data scale
   - External predicate requirements (regex, comparisons, etc.)
   - AI orchestration complexity needs

---

## User Scenarios & Testing *(mandatory)*

### Primary Data Processing Story
[Describe the main data ingestion and query journey - what data sources, what questions users want to answer]

### Acceptance Scenarios
1. **Given** [data source/format], **When** [user performs query/analysis], **Then** [expected query results and performance]
2. **Given** [entity relationships], **When** [cross-domain query executed], **Then** [expected fact traversal and results]

### Edge Cases for TQL
- What happens when [data format/schema changes]?
- How does system handle [query complexity limits]?
- What about [natural language ambiguity in queries]?
- How are [entity ID conflicts] resolved across data sources?

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: System MUST [data ingestion capability, e.g., "ingest nested JSON structures as EAV facts"]
- **FR-002**: System MUST [query capability, e.g., "support regex pattern matching in attribute values"]  
- **FR-003**: Users MUST be able to [query interaction, e.g., "query across multiple entity types using natural language"]
- **FR-004**: System MUST [cross-domain requirement, e.g., "apply same query patterns to different data schemas"]
- **FR-005**: System MUST [AI integration, e.g., "convert natural language to structured EQL-S queries"]

*Example of marking unclear TQL requirements:*
- **FR-006**: System MUST handle entity relationships via [NEEDS CLARIFICATION: direct references, nested objects, or separate link facts?]
- **FR-007**: System MUST support external predicates for [NEEDS CLARIFICATION: what domain-specific operations beyond regex/gt/lt?]

### Key Entities *(include if feature involves data)*
- **[Entity 1]**: [What it represents, key attributes without implementation]
- **[Entity 2]**: [What it represents, relationships to other entities]

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [ ] No implementation details (languages, frameworks, APIs)
- [ ] Focused on user value and business needs
- [ ] Written for non-technical stakeholders
- [ ] All mandatory sections completed

### Requirement Completeness
- [ ] No [NEEDS CLARIFICATION] markers remain
- [ ] Requirements are testable and unambiguous  
- [ ] Success criteria are measurable
- [ ] Scope is clearly bounded
- [ ] Dependencies and assumptions identified

---

## Execution Status
*Updated by main() during processing*

- [ ] User description parsed
- [ ] Key concepts extracted
- [ ] Ambiguities marked
- [ ] User scenarios defined
- [ ] Requirements generated
- [ ] Entities identified
- [ ] Review checklist passed

---
