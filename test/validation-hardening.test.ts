import { describe, test, expect } from 'vitest';
import { parseWorkflow, validateWorkflowSemantics } from '../src/workflows/parser.js';
import { WorkflowValidationError } from '../src/workflows/types.js';

describe('Workflow Validation Hardening', () => {
  test('should reject output names that conflict with step IDs', () => {
    const workflowYaml = `
version: 1
name: "conflict-test"
steps:
  - id: "users"
    type: "source"
    source:
      kind: "http"
      url: "https://example.com/users"
      mode: "batch"
    out: "users_data"
  
  - id: "posts"
    type: "source"
    source:
      kind: "http"
      url: "https://example.com/posts"
      mode: "batch"
    out: "users"  # This conflicts with step ID "users"
`;

    const spec = parseWorkflow(workflowYaml);
    expect(() => validateWorkflowSemantics(spec)).toThrow(WorkflowValidationError);
    expect(() => validateWorkflowSemantics(spec)).toThrow(/conflicts with step ID/);
  });

  test('should allow non-conflicting output names', () => {
    const workflowYaml = `
version: 1
name: "valid-test"
steps:
  - id: "load_users"
    type: "source"
    source:
      kind: "http"
      url: "https://example.com/users"
      mode: "batch"
    out: "users_data"
  
  - id: "load_posts"
    type: "source"
    source:
      kind: "http"
      url: "https://example.com/posts"
      mode: "batch"
    out: "posts_data"
`;

    const spec = parseWorkflow(workflowYaml);
    expect(() => validateWorkflowSemantics(spec)).not.toThrow();
  });
});