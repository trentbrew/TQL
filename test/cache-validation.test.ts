import { describe, test, expect } from 'vitest';
import { createCacheKey } from '../src/workflows/cache.js';

describe('Cache Key Validation', () => {
  test('should create valid cache keys', () => {
    const stepSpec = { type: 'query', eqls: 'FIND user AS ?u RETURN ?u.id' };
    const inputHash = 'abc123def456'; // valid hex
    const secretsHash = '789abc'; // valid hex

    const cacheKey = createCacheKey(stepSpec, inputHash, secretsHash);
    expect(cacheKey).toMatch(/^[a-f0-9_]+$/);
    expect(cacheKey.length).toBeGreaterThan(10);
  });

  test('should reject invalid input datasets hash', () => {
    const stepSpec = { type: 'query', eqls: 'FIND user AS ?u RETURN ?u.id' };
    const invalidHash = 'invalid-hash!@#';

    expect(() => createCacheKey(stepSpec, invalidHash)).toThrow(/Invalid input datasets hash/);
  });

  test('should reject invalid secrets hash', () => {
    const stepSpec = { type: 'query', eqls: 'FIND user AS ?u RETURN ?u.id' };
    const inputHash = 'abc123def456';
    const invalidSecretsHash = 'invalid-secrets!@#';

    expect(() => createCacheKey(stepSpec, inputHash, invalidSecretsHash)).toThrow(/Invalid secrets hash/);
  });

  test('should reject invalid step specification', () => {
    const invalidStepSpec: any = null;
    const inputHash = 'abc123def456';

    expect(() => createCacheKey(invalidStepSpec, inputHash)).toThrow(/Invalid step specification/);
  });
});