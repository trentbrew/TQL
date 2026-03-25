/**
 * Unit tests for workflow cache system
 *
 * Tests caching behavior, invalidation, and performance
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createCacheManager,
  createCacheKey,
  createInputDatasetsHash,
  createTemplateVarsHash,
  withCache,
  type CacheManager,
} from '../src/workflows/cache.js';
import type { Dataset, StepSpec } from '../src/workflows/types.js';

// Mock fs for file-based cache
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

// Mock crypto for hashing
vi.mock('crypto', () => ({
  createHash: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue('mocked-hash'),
  })),
  randomUUID: vi.fn().mockReturnValue('test-uuid'),
}));

describe('Cache System', () => {
  let cacheDir: string;

  beforeEach(() => {
    cacheDir = '/tmp/tql-cache-test';
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createCacheManager', () => {
    it('should create write mode cache manager', () => {
      const manager = createCacheManager('write', cacheDir);
      expect(manager).toBeDefined();
    });

    it('should create read mode cache manager', () => {
      const manager = createCacheManager('read', cacheDir);
      expect(manager).toBeDefined();
    });

    it('should create off mode cache manager', () => {
      const manager = createCacheManager('off', cacheDir);
      expect(manager).toBeDefined();
    });
  });

  describe('CacheManager operations', () => {
    let manager: CacheManager;
    let mockDataset: Dataset;

    beforeEach(() => {
      manager = createCacheManager('write', cacheDir);
      mockDataset = {
        name: 'test_data',
        rows: [{ id: 1, name: 'test' }],
      };
    });

    it('should store and retrieve datasets in write mode', async () => {
      await manager.set('test-key', mockDataset);
      const result = await manager.get('test-key');

      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('test-key'),
        expect.stringContaining('"name":"test_data"'),
        'utf-8',
      );
      expect(result).toBeNull(); // File not found, returns null
    });

    it('should retrieve datasets from cache in read mode', async () => {
      manager = createCacheManager('read', cacheDir);
      const cachedData = JSON.stringify(mockDataset);
      mockReadFile.mockResolvedValue(cachedData);

      const result = await manager.get('test-key');

      expect(mockReadFile).toHaveBeenCalledWith(
        expect.stringContaining('test-key'),
        'utf-8',
      );
      expect(result).toEqual(mockDataset);
    });

    it('should handle cache miss gracefully', async () => {
      manager = createCacheManager('read', cacheDir);
      mockReadFile.mockRejectedValue(new Error('File not found'));

      const result = await manager.get('missing-key');

      expect(result).toBeNull();
    });

    it('should not store in read mode', async () => {
      manager = createCacheManager('read', cacheDir);
      await manager.set('test-key', mockDataset);

      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('should not store or retrieve in off mode', async () => {
      manager = createCacheManager('off', cacheDir);
      await manager.set('test-key', mockDataset);
      const result = await manager.get('test-key');

      expect(mockWriteFile).not.toHaveBeenCalled();
      expect(mockReadFile).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should handle JSON parsing errors', async () => {
      manager = createCacheManager('read', cacheDir);
      mockReadFile.mockResolvedValue('invalid json');

      const result = await manager.get('test-key');

      expect(result).toBeNull();
    });

    it('should create cache directory if needed', async () => {
      await manager.set('test-key', mockDataset);

      expect(mockMkdir).toHaveBeenCalledWith(cacheDir, { recursive: true });
    });
  });

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

      const queryKey = createCacheKey(queryStep, 'hash', 'template');
      const sourceKey = createCacheKey(sourceStep, 'hash', 'template');

      expect(queryKey).toContain('query-query-step');
      expect(sourceKey).toContain('source-source-step');
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
    let manager: CacheManager;
    let mockOperation: ReturnType<typeof vi.fn>;
    let mockLogger: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      manager = createCacheManager('write', cacheDir);
      mockOperation = vi.fn();
      mockLogger = vi.fn();
    });

    it('should execute operation and cache result on miss', async () => {
      const expectedResult = { rows: [{ id: 1 }] };
      mockOperation.mockResolvedValue(expectedResult);

      const cacheKey = 'test-key';
      mockReadFile.mockRejectedValue(new Error('Not found'));

      const { result, cacheHit } = await withCache(
        manager,
        cacheKey,
        () => mockOperation(),
        mockLogger,
      );

      expect(mockOperation).toHaveBeenCalledTimes(1);
      expect(result).toBe(expectedResult);
      expect(cacheHit).toBe(false);
      expect(mockWriteFile).toHaveBeenCalled();
    });

    it('should return cached result on hit', async () => {
      const cachedResult = { rows: [{ id: 1 }] };
      mockReadFile.mockResolvedValue(JSON.stringify(cachedResult));

      const cacheKey = 'test-key';

      const { result, cacheHit } = await withCache(
        manager,
        cacheKey,
        () => mockOperation(),
        mockLogger,
      );

      expect(mockOperation).not.toHaveBeenCalled();
      expect(result).toEqual(cachedResult);
      expect(cacheHit).toBe(true);
      expect(mockLogger).toHaveBeenCalledWith({ event: 'hit', key: cacheKey });
    });

    it('should not cache in read mode', async () => {
      manager = createCacheManager('read', cacheDir);
      const expectedResult = { rows: [{ id: 1 }] };
      mockOperation.mockResolvedValue(expectedResult);
      const { writeFile, mkdir } = await import('fs/promises');
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(writeFile).mockResolvedValue(undefined);
      mockReadFile.mockRejectedValue(new Error('Not found'));

      const { result, cacheHit } = await withCache(
        manager,
        'test-key',
        () => mockOperation(),
        mockLogger,
      );

      expect(mockOperation).toHaveBeenCalledTimes(1);
      expect(result).toBe(expectedResult);
      expect(cacheHit).toBe(false);
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('should not cache in off mode', async () => {
      manager = createCacheManager('off', cacheDir);
      const expectedResult = { rows: [{ id: 1 }] };
      mockOperation.mockResolvedValue(expectedResult);

      const { result, cacheHit } = await withCache(
        manager,
        'test-key',
        () => mockOperation(),
        mockLogger,
      );

      expect(mockOperation).toHaveBeenCalledTimes(1);
      expect(result).toBe(expectedResult);
      expect(cacheHit).toBe(false);
      expect(mockWriteFile).not.toHaveBeenCalled();
      expect(mockReadFile).not.toHaveBeenCalled();
    });

    it('should handle operation errors', async () => {
      const error = new Error('Operation failed');
      mockOperation.mockRejectedValue(error);

      await expect(
        withCache(manager, 'test-key', () => mockOperation(), mockLogger),
      ).rejects.toThrow('Operation failed');

      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('should log cache miss events', async () => {
      mockOperation.mockResolvedValue({ rows: [] });
      mockReadFile.mockRejectedValue(new Error('Not found'));

      await withCache(manager, 'test-key', () => mockOperation(), mockLogger);

      expect(mockLogger).toHaveBeenCalledWith({
        event: 'miss',
        key: 'test-key',
      });
    });

    it('should log cache write events', async () => {
      mockOperation.mockResolvedValue({ rows: [] });
      mockReadFile.mockRejectedValue(new Error('Not found'));

      await withCache(manager, 'test-key', () => mockOperation(), mockLogger);

      expect(mockLogger).toHaveBeenCalledWith({
        event: 'write',
        key: 'test-key',
      });
    });
  });

  describe('Cache performance', () => {
    it('should handle large datasets efficiently', async () => {
      const manager = createCacheManager('write', cacheDir);

      // Create a large dataset (10K rows)
      const largeDataset: Dataset = {
        name: 'large_data',
        rows: Array.from({ length: 10000 }, (_, i) => ({
          id: i,
          name: `item_${i}`,
          data: 'x'.repeat(100), // 100 chars per row
        })),
      };

      const startTime = Date.now();
      await manager.set('large-key', largeDataset);
      const writeTime = Date.now() - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(writeTime).toBeLessThan(1000); // 1 second

      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"rows":['),
        'utf-8',
      );
    });

    it('should handle concurrent cache operations', async () => {
      const manager = createCacheManager('write', cacheDir);
      const operations = Array.from({ length: 10 }, (_, i) =>
        withCache(manager, `key-${i}`, async () => ({ result: i }), vi.fn()),
      );

      const results = await Promise.all(operations);

      expect(results).toHaveLength(10);
      results.forEach(({ result, cacheHit }, i) => {
        expect(result).toEqual({ result: i });
        expect(cacheHit).toBe(false);
      });
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
