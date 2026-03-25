/**
 * Unit tests for workflow cache system
 *
 * Tests caching behavior, invalidation, and performance
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createCacheKey,
  createInputDatasetsHash,
  createTemplateVarsHash,
  withCache,
} from '../src/workflows/cache.js';
import type { Dataset, StepSpec } from '../src/workflows/types.js';

describe('Cache System', () => {
  describe('createCacheKey', () => {
    it('should create consistent cache key for same inputs', () => {
      const step: StepSpec = {
        id: 'test-step',
        type: 'query',
        needs: ['source'],
        eqls: 'FIND item AS ?x RETURN ?x',
        out: 'result',
      };

      const inputHash = 'abc123';
      const templateHash = 'def456';

      const key1 = createCacheKey(step, inputHash, templateHash);
      const key2 = createCacheKey(step, inputHash, templateHash);

      expect(key1).toBe(key2);
      expect(key1).toContain('query-test-step');
      expect(key1).toContain(inputHash);
      expect(key1).toContain(templateHash);
    });

    it('should create different keys for different inputs', () => {
      const step: StepSpec = {
        id: 'test-step',
        type: 'query',
        needs: ['source'],
        eqls: 'FIND item AS ?x RETURN ?x',
        out: 'result',
      };

      const key1 = createCacheKey(step, 'hash1', 'template1');
      const key2 = createCacheKey(step, 'hash2', 'template1');
      const key3 = createCacheKey(step, 'hash1', 'template2');

      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
      expect(key2).not.toBe(key3);
    });

    it('should handle different step types', () => {
      const queryStep: StepSpec = {
        id: 'query-step',
        type: 'query',
        needs: ['source'],
        eqls: 'FIND item AS ?x RETURN ?x',
        out: 'result',
      };

      const sourceStep: StepSpec = {
        id: 'source-step',
        type: 'source',
        source: {
          kind: 'http',
          url: 'https://api.example.com',
          mode: 'batch',
        },
        out: 'data',
      } as any;

      const key1 = createCacheKey(queryStep, 'hash', 'template');
      const sourceKey = createCacheKey(sourceStep, 'hash', 'template');

      expect(key1).toContain('query-query-step');
      expect(sourceKey).toContain('source-source-step');
    });

    it('should validate inputs', () => {
      expect(() => createCacheKey(null as any, 'hash', 'template')).toThrow(
        'Invalid step specification',
      );
      expect(() => createCacheKey({}, 'invalid-hash', 'template')).toThrow(
        'Invalid input datasets hash',
      );
      expect(() => createCacheKey({}, 'hash', 'template', 'invalid')).toThrow(
        'Invalid secrets hash',
      );
    });
  });

  describe('createInputDatasetsHash', () => {
    it('should create consistent hash for same datasets', () => {
      const datasets: Record<string, Dataset> = {
        data1: {
          name: 'data1',
          rows: [{ id: 1, name: 'test' }],
        },
        data2: {
          name: 'data2',
          rows: [{ id: 2, value: 'example' }],
        },
      };

      const hash1 = createInputDatasetsHash(datasets);
      const hash2 = createInputDatasetsHash(datasets);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]+$/); // Hex string
    });

    it('should create different hashes for different datasets', () => {
      const datasets1: Record<string, Dataset> = {
        data1: {
          name: 'data1',
          rows: [{ id: 1, name: 'test' }],
        },
      };

      const datasets2: Record<string, Dataset> = {
        data1: {
          name: 'data1',
          rows: [{ id: 1, name: 'changed' }],
        },
      };

      const hash1 = createInputDatasetsHash(datasets1);
      const hash2 = createInputDatasetsHash(datasets2);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty datasets', () => {
      const hash1 = createInputDatasetsHash({});
      const hash2 = createInputDatasetsHash({});

      expect(hash1).toBe(hash2);
    });

    it('should handle dataset order independence', () => {
      const datasets1: Record<string, Dataset> = {
        data1: { name: 'data1', rows: [{ id: 1 }] },
        data2: { name: 'data2', rows: [{ id: 2 }] },
      };

      const datasets2: Record<string, Dataset> = {
        data2: { name: 'data2', rows: [{ id: 2 }] },
        data1: { name: 'data1', rows: [{ id: 1 }] },
      };

      const hash1 = createInputDatasetsHash(datasets1);
      const hash2 = createInputDatasetsHash(datasets2);

      expect(hash1).toBe(hash2);
    });
  });

  describe('createTemplateVarsHash', () => {
    it('should create consistent hash for same variables', () => {
      const env = { API_HOST: 'api.example.com', VERSION: 'v1' };
      const vars = { LIMIT: '100', FORMAT: 'json' };

      const hash1 = createTemplateVarsHash(env, vars);
      const hash2 = createTemplateVarsHash(env, vars);

      expect(hash1).toBe(hash2);
    });

    it('should create different hashes for different variables', () => {
      const env1 = { API_HOST: 'api.example.com' };
      const env2 = { API_HOST: 'different.example.com' };

      const hash1 = createTemplateVarsHash(env1, {});
      const hash2 = createTemplateVarsHash(env2, {});

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty variables', () => {
      const hash1 = createTemplateVarsHash({}, {});
      const hash2 = createTemplateVarsHash({}, {});

      expect(hash1).toBe(hash2);
    });

    it('should be order independent', () => {
      const env1 = { A: '1', B: '2' };
      const env2 = { B: '2', A: '1' };

      const hash1 = createTemplateVarsHash(env1, {});
      const hash2 = createTemplateVarsHash(env2, {});

      expect(hash1).toBe(hash2);
    });
  });

  describe('withCache', () => {
    let mockCacheManager: any;
    let mockOperation: ReturnType<typeof vi.fn>;
    let mockLogger: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockCacheManager = {
        get: vi.fn(),
        set: vi.fn(),
      };
      mockOperation = vi.fn();
      mockLogger = vi.fn();
    });

    it('should execute operation and cache result on miss', async () => {
      const expectedResult = { rows: [{ id: 1 }] };
      mockOperation.mockResolvedValue(expectedResult);
      mockCacheManager.get.mockResolvedValue(null);

      const cacheKey = 'test-key';

      const { result, cacheHit } = await withCache(
        mockCacheManager,
        cacheKey,
        () => mockOperation(),
        mockLogger,
      );

      expect(mockOperation).toHaveBeenCalledTimes(1);
      expect(result).toBe(expectedResult);
      expect(cacheHit).toBe(false);
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        cacheKey,
        expectedResult,
      );
      expect(mockLogger).toHaveBeenCalledWith({ cache: 'miss' });
      expect(mockLogger).toHaveBeenCalledWith({ cache: 'write' });
    });

    it('should return cached result on hit', async () => {
      const cachedResult = { rows: [{ id: 1 }] };
      mockCacheManager.get.mockResolvedValue(cachedResult);

      const cacheKey = 'test-key';

      const { result, cacheHit } = await withCache(
        mockCacheManager,
        cacheKey,
        () => mockOperation(),
        mockLogger,
      );

      expect(mockOperation).not.toHaveBeenCalled();
      expect(result).toEqual(cachedResult);
      expect(cacheHit).toBe(true);
      expect(mockLogger).toHaveBeenCalledWith({ cache: 'hit' });
    });

    it('should handle operation errors', async () => {
      const error = new Error('Operation failed');
      mockOperation.mockRejectedValue(error);
      mockCacheManager.get.mockResolvedValue(null);

      await expect(
        withCache(
          mockCacheManager,
          'test-key',
          () => mockOperation(),
          mockLogger,
        ),
      ).rejects.toThrow('Operation failed');

      expect(mockCacheManager.set).not.toHaveBeenCalled();
    });

    it('should not cache non-dataset results', async () => {
      const nonDatasetResult = { status: 'ok' };
      mockOperation.mockResolvedValue(nonDatasetResult);
      mockCacheManager.get.mockResolvedValue(null);

      const { result, cacheHit } = await withCache(
        mockCacheManager,
        'test-key',
        () => mockOperation(),
        mockLogger,
      );

      expect(result).toBe(nonDatasetResult);
      expect(cacheHit).toBe(false);
      expect(mockCacheManager.set).not.toHaveBeenCalled();
    });

    it('should cache dataset results', async () => {
      const datasetResult: Dataset = {
        name: 'test_data',
        rows: [{ id: 1 }],
      };
      mockOperation.mockResolvedValue(datasetResult);
      mockCacheManager.get.mockResolvedValue(null);

      const { result, cacheHit } = await withCache(
        mockCacheManager,
        'test-key',
        () => mockOperation(),
        mockLogger,
      );

      expect(result).toBe(datasetResult);
      expect(cacheHit).toBe(false);
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'test-key',
        datasetResult,
      );
    });
  });

  describe('Cache invalidation', () => {
    it('should invalidate when input datasets change', () => {
      const datasets1: Record<string, Dataset> = {
        data: { name: 'data', rows: [{ id: 1 }] },
      };

      const datasets2: Record<string, Dataset> = {
        data: { name: 'data', rows: [{ id: 2 }] },
      };

      const step: StepSpec = {
        id: 'test',
        type: 'query',
        needs: ['source'],
        eqls: 'FIND item AS ?x RETURN ?x',
        out: 'result',
      };

      const templateHash = createTemplateVarsHash({}, {});

      const key1 = createCacheKey(
        step,
        createInputDatasetsHash(datasets1),
        templateHash,
      );
      const key2 = createCacheKey(
        step,
        createInputDatasetsHash(datasets2),
        templateHash,
      );

      expect(key1).not.toBe(key2);
    });

    it('should invalidate when template variables change', () => {
      const env1 = { API_KEY: 'key1' };
      const env2 = { API_KEY: 'key2' };

      const step: StepSpec = {
        id: 'test',
        type: 'query',
        needs: ['source'],
        eqls: 'FIND item AS ?x RETURN ?x',
        out: 'result',
      };

      const datasetHash = createInputDatasetsHash({});

      const key1 = createCacheKey(
        step,
        datasetHash,
        createTemplateVarsHash(env1, {}),
      );
      const key2 = createCacheKey(
        step,
        datasetHash,
        createTemplateVarsHash(env2, {}),
      );

      expect(key1).not.toBe(key2);
    });

    it('should maintain cache when only non-affecting properties change', () => {
      const step1: StepSpec = {
        id: 'test',
        type: 'query',
        needs: ['source'],
        eqls: 'FIND item AS ?x RETURN ?x',
        out: 'result',
      };

      const step2: StepSpec = {
        id: 'test',
        type: 'query',
        needs: ['source'],
        eqls: 'FIND item AS ?x RETURN ?x',
        out: 'result',
      };

      const datasetHash = createInputDatasetsHash({});
      const templateHash = createTemplateVarsHash({}, {});

      const key1 = createCacheKey(step1, datasetHash, templateHash);
      const key2 = createCacheKey(step2, datasetHash, templateHash);

      expect(key1).toBe(key2);
    });
  });
});
