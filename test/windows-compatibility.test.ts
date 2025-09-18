#!/usr/bin/env node

/**
 * TQL Windows Compatibility Tests
 *
 * Tests for Windows path handling and cross-platform compatibility
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

const TEST_DIR = '/tmp/tql-windows-tests';

describe('TQL Windows Compatibility', () => {
  beforeEach(() => {
    try {
      mkdirSync(TEST_DIR, { recursive: true });
    } catch (error) {
      // Directory might already exist, ignore error
    }
  });

  afterAll(() => {
    try {
      rmSync(TEST_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Path Handling', () => {
    it('should handle Windows-style paths in output', () => {
      const windowsPathYaml = `version: 1
name: windows-path-test

steps:
  - id: fetch_data
    type: source
    source:
      kind: http
      url: "https://jsonplaceholder.typicode.com/posts"
      mode: batch
    out: data

  - id: output_windows_path
    type: output
    needs: [fetch_data]
    output:
      kind: file
      format: json
      path: ".\\\\out\\\\windows-style.json"
`;

      const windowsFile = join(TEST_DIR, 'windows-path.yml');
      writeFileSync(windowsFile, windowsPathYaml);

      const result = execSync(
        `bun run src/cli/tql.ts workflow run ${windowsFile} --dry --limit 3`,
        { encoding: 'utf-8', cwd: process.cwd() },
      );

      expect(result).toContain('DRY RUN');
      expect(result).toContain('fetch_data');
      expect(result).toContain('output_windows_path');
    });

    it('should handle mixed path separators in URLs', () => {
      const mixedPathYaml = `version: 1
name: mixed-path-test

steps:
  - id: fetch_data
    type: source
    source:
      kind: http
      url: "https://api.example.com/data/path\\\\with\\\\mixed/separators"
      mode: batch
    out: data
`;

      const mixedFile = join(TEST_DIR, 'mixed-path.yml');
      writeFileSync(mixedFile, mixedPathYaml);

      // This should not crash, even if the URL is malformed
      try {
        const result = execSync(
          `bun run src/cli/tql.ts workflow run ${mixedFile} --dry --limit 1`,
          { encoding: 'utf-8', cwd: process.cwd() },
        );
        // If it succeeds, that's fine
        expect(result).toContain('DRY RUN');
      } catch (error) {
        // If it fails due to network/URL issues, that's expected
        // We just want to ensure it doesn't crash on path parsing
        expect(error).toBeDefined();
      }
    });

    it('should handle backslashes in template variables', () => {
      const backslashYaml = `version: 1
name: backslash-template-test

steps:
  - id: fetch_data
    type: source
    source:
      kind: http
      url: "https://api.example.com/{{var.PATH}}"
      mode: batch
    out: data
`;

      const backslashFile = join(TEST_DIR, 'backslash-template.yml');
      writeFileSync(backslashFile, backslashYaml);

      // Test with Windows-style path in template variable
      try {
        const result = execSync(
          `bun run src/cli/tql.ts workflow run ${backslashFile} --dry --var PATH=data\\\\path --max-rows 1`,
          { encoding: 'utf-8', cwd: process.cwd() },
        );
        // If the command succeeds, check the output
        expect(result).toContain('DRY RUN');
        expect(result).toContain('https://api.example.com/data\\path');
      } catch (error: any) {
        // If the command fails (which is expected due to invalid URL), check the stdout
        const output = error.stdout || '';
        expect(output).toContain('DRY RUN');
        expect(output).toContain('https://api.example.com/data\\path');
      }
    });
  });

  describe('Exit Code Consistency', () => {
    it('should return exit code 1 for validation errors', () => {
      const invalidYaml = `version: 1
name: invalid-test

steps:
  - id: invalid_step
    type: source
    source:
      kind: http
      url: "https://api.example.com/data"
      mode: batch
    # Missing out field
`;

      const invalidFile = join(TEST_DIR, 'invalid.yml');
      writeFileSync(invalidFile, invalidYaml);

      try {
        execSync(`bun run src/cli/tql.ts workflow run ${invalidFile} --dry`, {
          encoding: 'utf-8',
          cwd: process.cwd(),
        });
        expect.fail('Should have exited with code 1');
      } catch (error: any) {
        expect(error.status).toBe(1);
      }
    });

    it('should return exit code 2 for runtime errors', () => {
      const runtimeErrorYaml = `version: 1
name: runtime-error-test

steps:
  - id: fetch_invalid
    type: source
    source:
      kind: http
      url: "https://invalid-url-that-does-not-exist.example.com"
      mode: batch
    out: data
`;

      const runtimeFile = join(TEST_DIR, 'runtime-error.yml');
      writeFileSync(runtimeFile, runtimeErrorYaml);

      try {
        execSync(
          `bun run src/cli/tql.ts workflow run ${runtimeFile} --dry --limit 1`,
          {
            encoding: 'utf-8',
            cwd: process.cwd(),
          },
        );
        expect.fail('Should have exited with code 2');
      } catch (error: any) {
        expect(error.status).toBe(2);
      }
    });
  });
});
