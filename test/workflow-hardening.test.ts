#!/usr/bin/env node

/**
 * TQL Workflow Hardening Tests
 *
 * Comprehensive test suite for the hardened workflow system
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

const TEST_DIR = '/tmp/tql-workflow-tests';
const SIMPLE_DEMO = join(TEST_DIR, 'simple-demo.yml');
const BAD_NEEDS = join(TEST_DIR, 'bad-needs.yml');
const CYCLE_DEMO = join(TEST_DIR, 'cycle-demo.yml');

describe('TQL Workflow Hardening', () => {
  beforeAll(() => {
    // Create test directory
    execSync(`mkdir -p ${TEST_DIR}`);

    // Create test workflow files
    writeFileSync(
      SIMPLE_DEMO,
      `version: 1
name: simple-demo

steps:
  - id: fetch_posts
    type: source
    source:
      kind: http
      url: "https://jsonplaceholder.typicode.com/posts"
      mode: batch
    out: posts

  - id: filter_popular
    type: query
    needs: [fetch_posts]
    from: posts
    eqls: |
      FIND item AS ?p WHERE ?p.id <= 10
      RETURN ?p.id, ?p.title, ?p.userId
    out: popular_posts

  - id: save_results
    type: output
    needs: [filter_popular]
    output:
      kind: file
      format: json
      path: "./out/popular-posts.json"
`,
    );

    writeFileSync(
      BAD_NEEDS,
      `version: 1
name: bad-needs

steps:
  - id: fetch_posts
    type: source
    source:
      kind: http
      url: "https://jsonplaceholder.typicode.com/posts"
      mode: batch
    out: posts

  - id: filter_popular
    type: query
    needs: [posts]  # This should be fetch_posts
    eqls: |
      FIND item AS ?p WHERE ?p.id <= 10
      RETURN ?p.id, ?p.title
    out: popular_posts
`,
    );

    writeFileSync(
      CYCLE_DEMO,
      `version: 1
name: cycle-demo

steps:
  - id: step_a
    type: query
    needs: [step_c]
    eqls: "FIND item AS ?x RETURN ?x"
    out: result_a

  - id: step_b
    type: query
    needs: [step_a]
    eqls: "FIND item AS ?x RETURN ?x"
    out: result_b

  - id: step_c
    type: query
    needs: [step_b]
    eqls: "FIND item AS ?x RETURN ?x"
    out: result_c
`,
    );
  });

  afterAll(() => {
    // Clean up test files
    execSync(`rm -rf ${TEST_DIR}`);
  });

  describe('CLI E2E Tests', () => {
    it('should run simple demo workflow in dry mode', () => {
      const result = execSync(
        `bun run src/cli/tql.ts workflow run ${SIMPLE_DEMO} --dry --limit 3`,
        { encoding: 'utf-8', cwd: process.cwd() },
      );

      expect(result).toContain('DRY RUN');
      expect(result).toContain('fetch_posts');
      expect(result).toContain('filter_popular');
      expect(result).toContain('save_results');
    });

    it('should respect limit parameter', () => {
      const result = execSync(
        `bun run src/cli/tql.ts workflow run ${SIMPLE_DEMO} --dry --max-rows 1`,
        { encoding: 'utf-8', cwd: process.cwd() },
      );

      expect(result).toContain('limit=1');
    });

    it('should show helpful error for bad needs reference', () => {
      try {
        execSync(`bun run src/cli/tql.ts workflow run ${BAD_NEEDS} --dry`, {
          encoding: 'utf-8',
          cwd: process.cwd(),
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.stdout || error.stderr).toContain(
          'Did you mean step id "fetch_posts"?',
        );
      }
    });

    it('should detect circular dependencies', () => {
      try {
        execSync(`bun run src/cli/tql.ts workflow run ${CYCLE_DEMO} --dry`, {
          encoding: 'utf-8',
          cwd: process.cwd(),
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.stdout || error.stderr).toContain('Circular dependency');
      }
    });
  });

  describe('Plan Command Tests', () => {
    it('should show execution plan', () => {
      const result = execSync(
        `bun run src/cli/tql.ts workflow plan ${SIMPLE_DEMO}`,
        { encoding: 'utf-8', cwd: process.cwd() },
      );

      expect(result).toContain('Workflow Execution Plan');
      expect(result).toContain('simple-demo');
      expect(result).toContain('Execution Order:');
      expect(result).toContain('1. fetch_posts [source]');
      expect(result).toContain(
        '2. filter_popular [query] (needs: fetch_posts) (from: posts) → popular_posts',
      );
      expect(result).toContain(
        '3. save_results [output] (needs: filter_popular)',
      );
    });

    it('should generate DOT format', () => {
      const result = execSync(
        `bun run src/cli/tql.ts workflow plan ${SIMPLE_DEMO} --dot`,
        { encoding: 'utf-8', cwd: process.cwd() },
      );

      expect(result).toContain('digraph Workflow');
      expect(result).toContain('fetch_posts');
      expect(result).toContain('filter_popular');
      expect(result).toContain('save_results');
    });

    it('should generate Mermaid format', () => {
      const result = execSync(
        `bun run src/cli/tql.ts workflow plan ${SIMPLE_DEMO} --mermaid`,
        { encoding: 'utf-8', cwd: process.cwd() },
      );

      expect(result).toContain('graph TD');
      expect(result).toContain('fetch_posts');
      expect(result).toContain('filter_popular');
      expect(result).toContain('save_results');
    });
  });

  describe('Validation Tests', () => {
    it('should validate workflow schema', () => {
      const invalidYaml = `version: 1
name: invalid
steps:
  - id: test
    type: invalid_type
    source:
      kind: http
      url: "https://example.com"
      mode: batch
    out: test_output
`;

      const invalidFile = join(TEST_DIR, 'invalid.yml');
      writeFileSync(invalidFile, invalidYaml);

      try {
        execSync(`bun run src/cli/tql.ts workflow run ${invalidFile} --dry`, {
          encoding: 'utf-8',
          cwd: process.cwd(),
        });
        expect.fail('Should have thrown a validation error');
      } catch (error: any) {
        expect(error.stdout || error.stderr).toContain('validation failed');
      }
    });

    it('should require step IDs to be unique', () => {
      const duplicateIdYaml = `version: 1
name: duplicate-ids
steps:
  - id: duplicate
    type: source
    source:
      kind: http
      url: "https://example.com"
      mode: batch
    out: output1
  - id: duplicate
    type: query
    needs: [duplicate]
    eqls: "FIND item AS ?x RETURN ?x"
    out: output2
`;

      const duplicateFile = join(TEST_DIR, 'duplicate.yml');
      writeFileSync(duplicateFile, duplicateIdYaml);

      try {
        execSync(`bun run src/cli/tql.ts workflow run ${duplicateFile} --dry`, {
          encoding: 'utf-8',
          cwd: process.cwd(),
        });
        expect.fail('Should have thrown a validation error');
      } catch (error: any) {
        expect(error.stdout || error.stderr).toContain('duplicate');
      }
    });
  });

  describe('CLI Shape Tests', () => {
    it('should reject unknown options', () => {
      try {
        execSync(
          `bun run src/cli/tql.ts workflow run ${SIMPLE_DEMO} --unknown-option`,
          { encoding: 'utf-8', cwd: process.cwd() },
        );
        expect.fail('Should have rejected unknown option');
      } catch (error: any) {
        expect(error.stdout || error.stderr).toContain('unknown option');
      }
    });

    it('should show help after error', () => {
      try {
        execSync(`bun run src/cli/tql.ts workflow run`, {
          encoding: 'utf-8',
          cwd: process.cwd(),
        });
        expect.fail('Should have shown help');
      } catch (error: any) {
        expect(error.stdout || error.stderr).toContain('Usage:');
      }
    });
  });
});
