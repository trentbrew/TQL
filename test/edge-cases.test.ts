#!/usr/bin/env node

/**
 * TQL Workflow Edge Case Tests
 *
 * Tests for edge cases and error conditions
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

const TEST_DIR = '/tmp/tql-edge-tests';

describe('TQL Workflow Edge Cases', () => {
  beforeAll(() => {
    execSync(`mkdir -p ${TEST_DIR}`);
  });

  afterAll(() => {
    execSync(`rm -rf ${TEST_DIR}`);
  });

  describe('Empty Dataset Handling', () => {
    it('should handle empty source responses gracefully', () => {
      const emptySourceYaml = `version: 1
name: empty-source-test

steps:
  - id: fetch_empty
    type: source
    source:
      kind: http
      url: "https://httpbin.org/status/200"
      mode: batch
    out: empty_data

  - id: process_empty
    type: query
    needs: [fetch_empty]
    eqls: |
      FIND item AS ?x WHERE ?x.id = 1
      RETURN ?x
    out: processed_empty

  - id: output_empty
    type: output
    needs: [process_empty]
    output:
      kind: file
      format: json
      path: "./out/empty-result.json"
`;

      const emptyFile = join(TEST_DIR, 'empty-source.yml');
      writeFileSync(emptyFile, emptySourceYaml);

      const result = execSync(
        `bun run src/cli/tql.ts workflow run ${emptyFile} --dry --limit 10`,
        { encoding: 'utf-8', cwd: process.cwd() },
      );

      expect(result).toContain('out=0');
      expect(result).toContain('fetch_empty');
      expect(result).toContain('process_empty');
      expect(result).toContain('output_empty');
    });
  });

  describe('Missing Output Validation', () => {
    it('should catch missing out field with helpful error', () => {
      const missingOutYaml = `version: 1
name: missing-out-test

steps:
  - id: fetch_data
    type: source
    source:
      kind: http
      url: "https://jsonplaceholder.typicode.com/posts"
      mode: batch
    # Missing out: field

  - id: process_data
    type: query
    needs: [fetch_data]
    eqls: "FIND item AS ?x RETURN ?x"
    out: processed_data
`;

      const missingOutFile = join(TEST_DIR, 'missing-out.yml');
      writeFileSync(missingOutFile, missingOutYaml);

      try {
        execSync(
          `bun run src/cli/tql.ts workflow run ${missingOutFile} --dry`,
          {
            encoding: 'utf-8',
            cwd: process.cwd(),
          },
        );
        expect.fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.stdout || error.stderr).toContain('validation failed');
        expect(error.stdout || error.stderr).toContain('out');
      }
    });
  });

  describe('From vs Needs Validation', () => {
    it('should respect from field and not silently union needs', () => {
      const fromNeedsYaml = `version: 1
name: from-needs-test

steps:
  - id: fetch_posts
    type: source
    source:
      kind: http
      url: "https://jsonplaceholder.typicode.com/posts"
      mode: batch
    out: posts

  - id: fetch_users
    type: source
    source:
      kind: http
      url: "https://jsonplaceholder.typicode.com/users"
      mode: batch
    out: users

  - id: query_posts_only
    type: query
    needs: [fetch_posts, fetch_users]
    from: posts
    eqls: |
      FIND item AS ?p WHERE ?p.id <= 3
      RETURN ?p.id, ?p.title
    out: filtered_posts
`;

      const fromNeedsFile = join(TEST_DIR, 'from-needs.yml');
      writeFileSync(fromNeedsFile, fromNeedsYaml);

      const result = execSync(
        `bun run src/cli/tql.ts workflow run ${fromNeedsFile} --dry --limit 5 --cache off`,
        { encoding: 'utf-8', cwd: process.cwd() },
      );

      // Should only process posts data, not union with users
      expect(result).toContain('query_posts_only');
      expect(result).toContain('query_posts_only: from: posts');
    });
  });

  describe('Map Mode Validation', () => {
    it('should catch map mode without mapFrom', () => {
      const mapWithoutMapFromYaml = `version: 1
name: map-without-mapfrom

steps:
  - id: fetch_users
    type: source
    source:
      kind: http
      url: "https://jsonplaceholder.typicode.com/users"
      mode: batch
    out: users

  - id: fetch_posts
    type: source
    source:
      kind: http
      url: "https://jsonplaceholder.typicode.com/posts/{{row.id}}"
      mode: map
      # Missing mapFrom: users
    out: posts
`;

      const mapFile = join(TEST_DIR, 'map-without-mapfrom.yml');
      writeFileSync(mapFile, mapWithoutMapFromYaml);

      try {
        execSync(`bun run src/cli/tql.ts workflow run ${mapFile} --dry`, {
          encoding: 'utf-8',
          cwd: process.cwd(),
        });
        expect.fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.stdout || error.stderr).toContain('mapFrom');
        expect(error.stdout || error.stderr).toContain('required');
      }
    });
  });

  describe('Duplicate Output Names', () => {
    it('should catch duplicate out names', () => {
      const duplicateOutYaml = `version: 1
name: duplicate-out

steps:
  - id: fetch_posts
    type: source
    source:
      kind: http
      url: "https://jsonplaceholder.typicode.com/posts"
      mode: batch
    out: data

  - id: fetch_users
    type: source
    source:
      kind: http
      url: "https://jsonplaceholder.typicode.com/users"
      mode: batch
    out: data  # Duplicate output name
`;

      const duplicateFile = join(TEST_DIR, 'duplicate-out.yml');
      writeFileSync(duplicateFile, duplicateOutYaml);

      try {
        execSync(`bun run src/cli/tql.ts workflow run ${duplicateFile} --dry`, {
          encoding: 'utf-8',
          cwd: process.cwd(),
        });
        expect.fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.stdout || error.stderr).toContain('duplicate');
        expect(error.stdout || error.stderr).toContain('out');
      }
    });
  });

  describe('CLI Alias Tests', () => {
    it('should support wf alias for workflow', () => {
      const simpleYaml = `version: 1
name: alias-test

steps:
  - id: fetch_data
    type: source
    source:
      kind: http
      url: "https://jsonplaceholder.typicode.com/posts"
      mode: batch
    out: data
`;

      const aliasFile = join(TEST_DIR, 'alias-test.yml');
      writeFileSync(aliasFile, simpleYaml);

      const result = execSync(
        `bun run src/cli/tql.ts wf run ${aliasFile} --dry --limit 3`,
        { encoding: 'utf-8', cwd: process.cwd() },
      );

      expect(result).toContain('DRY RUN');
      expect(result).toContain('fetch_data');
    });
  });

  describe('Plan Command Tests', () => {
    it('should output JSON format for plan', () => {
      const planYaml = `version: 1
name: json-plan-test

steps:
  - id: fetch_data
    type: source
    source:
      kind: http
      url: "https://jsonplaceholder.typicode.com/posts"
      mode: batch
    out: data

  - id: process_data
    type: query
    needs: [fetch_data]
    eqls: "FIND item AS ?x RETURN ?x"
    out: processed
`;

      const planFile = join(TEST_DIR, 'json-plan.yml');
      writeFileSync(planFile, planYaml);

      const result = execSync(
        `bun run src/cli/tql.ts workflow plan ${planFile} --json`,
        { encoding: 'utf-8', cwd: process.cwd() },
      );

      const jsonPlan = JSON.parse(result);
      expect(jsonPlan.name).toBe('json-plan-test');
      expect(jsonPlan.version).toBe(1);
      expect(jsonPlan.steps).toHaveLength(2);
      expect(jsonPlan.steps[0].id).toBe('fetch_data');
      expect(jsonPlan.steps[1].id).toBe('process_data');
      expect(jsonPlan.steps[1].needs).toEqual(['fetch_data']);
    });
  });

  describe('No Color Option', () => {
    it('should disable colors when --no-color is used', () => {
      const noColorYaml = `version: 1
name: no-color-test

steps:
  - id: fetch_data
    type: source
    source:
      kind: http
      url: "https://jsonplaceholder.typicode.com/posts"
      mode: batch
    out: data
`;

      const noColorFile = join(TEST_DIR, 'no-color.yml');
      writeFileSync(noColorFile, noColorYaml);

      const result = execSync(
        `bun run src/cli/tql.ts workflow run ${noColorFile} --dry --no-color`,
        { encoding: 'utf-8', cwd: process.cwd() },
      );

      // Should not contain emoji characters
      expect(result).not.toContain('🚀');
      expect(result).not.toContain('✓');
      expect(result).toContain('[START]');
      expect(result).toContain('[DONE]');
    });
  });
});
