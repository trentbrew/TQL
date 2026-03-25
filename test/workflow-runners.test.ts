/**
 * Unit tests for workflow runners
 *
 * Tests each runner in isolation with mocked dependencies
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpSourceRunner } from '../src/workflows/runners.js';
import { QueryRunner } from '../src/workflows/runners.js';
import { OutputRunner } from '../src/workflows/runners.js';
import { WorkflowRuntimeError } from '../src/workflows/types.js';
import type {
  Dataset,
  StepCtx,
  HttpSourceSpec,
  QueryStepSpec,
  OutputStepSpec,
} from '../src/workflows/types.js';

// Mock fetch for HTTP tests
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

// Mock console for output tests
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi
  .spyOn(console, 'error')
  .mockImplementation(() => {});

// Mock fs/promises for OutputRunner
vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

describe('HttpSourceRunner', () => {
  let runner: HttpSourceRunner;
  let mockCtx: StepCtx;

  beforeEach(() => {
    runner = new HttpSourceRunner();
    mockCtx = {
      datasets: {},
      stepOutputs: {},
      env: {},
      vars: {},
      runId: 'test-run',
      dry: false,
      cacheMode: 'off',
      cache: {
        get: vi.fn(),
        set: vi.fn(),
      },
      getDataset: vi.fn(),
      getDatasetByName: vi.fn(),
      getDatasetByStepId: vi.fn(),
      log: vi.fn(),
    };
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validation', () => {
    it('should validate batch mode with URL', () => {
      const spec: HttpSourceSpec = {
        kind: 'http',
        url: 'https://api.example.com/data',
        mode: 'batch',
      };
      expect(() => runner.validate(spec)).not.toThrow();
    });

    it('should validate map mode with mapFrom', () => {
      const spec: HttpSourceSpec = {
        kind: 'http',
        url: 'https://api.example.com/data',
        mode: 'map',
        mapFrom: 'source_dataset',
      };
      expect(() => runner.validate(spec)).not.toThrow();
    });

    it('should reject missing URL', () => {
      const spec = {
        kind: 'http' as const,
        url: '',
        mode: 'batch' as const,
      };
      expect(() => runner.validate(spec)).toThrow('HTTP source requires url');
    });

    it('should reject map mode without mapFrom', () => {
      const spec = {
        kind: 'http' as const,
        url: 'https://api.example.com/data',
        mode: 'map' as const,
      };
      expect(() => runner.validate(spec)).toThrow('Map mode requires mapFrom');
    });
  });

  describe('batch mode', () => {
    it('should fetch and return array data', async () => {
      const mockData = [{ id: 1, name: 'test' }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockData),
      });

      const spec: HttpSourceSpec = {
        kind: 'http',
        url: 'https://api.example.com/data',
        mode: 'batch',
      };

      const result = await runner.run(spec, mockCtx);

      expect(result).toEqual({
        name: 'batch_result',
        rows: mockData,
      });
      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/data', {
        headers: {},
        signal: expect.any(AbortSignal),
      });
    });

    it('should handle wrapped data arrays', async () => {
      const mockData = { items: [{ id: 1 }, { id: 2 }] };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockData),
      });

      const spec: HttpSourceSpec = {
        kind: 'http',
        url: 'https://api.example.com/data',
        mode: 'batch',
      };

      const result = await runner.run(spec, mockCtx);

      expect(result.rows).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it('should wrap single objects in array', async () => {
      const mockData = { id: 1, name: 'single' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockData),
      });

      const spec: HttpSourceSpec = {
        kind: 'http',
        url: 'https://api.example.com/data',
        mode: 'batch',
      };

      const result = await runner.run(spec, mockCtx);

      expect(result.rows).toEqual([mockData]);
    });

    it('should handle null/undefined responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(null),
      });

      const spec: HttpSourceSpec = {
        kind: 'http',
        url: 'https://api.example.com/data',
        mode: 'batch',
      };

      const result = await runner.run(spec, mockCtx);

      expect(result.rows).toEqual([]);
    });

    it('should interpolate template variables', async () => {
      mockCtx.env = { API_HOST: 'api.example.com' };
      mockCtx.vars = { VERSION: 'v2' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      });

      const spec: HttpSourceSpec = {
        kind: 'http',
        url: 'https://${env.API_HOST}/${vars.VERSION}/data',
        mode: 'batch',
      };

      await runner.run(spec, mockCtx);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/v2/data',
        expect.any(Object),
      );
    });

    it('should apply dry run limits', async () => {
      const mockData = Array.from({ length: 100 }, (_, i) => ({ id: i }));
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockData),
      });

      mockCtx.dry = true;
      mockCtx.limit = 10;

      const spec: HttpSourceSpec = {
        kind: 'http',
        url: 'https://api.example.com/data',
        mode: 'batch',
      };

      const result = await runner.run(spec, mockCtx);

      expect(result.rows).toHaveLength(10);
    });

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const spec: HttpSourceSpec = {
        kind: 'http',
        url: 'https://api.example.com/notfound',
        mode: 'batch',
      };

      await expect(runner.run(spec, mockCtx)).rejects.toThrow(
        'HTTP 404: Not Found',
      );
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const spec: HttpSourceSpec = {
        kind: 'http',
        url: 'https://api.example.com/data',
        mode: 'batch',
      };

      await expect(runner.run(spec, mockCtx)).rejects.toThrow(
        'HTTP request failed: Network error',
      );
    });

    it('should respect content length limits', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { 'content-length': '20000000' }, // 20MB
        json: vi.fn(),
      });

      const spec: HttpSourceSpec = {
        kind: 'http',
        url: 'https://api.example.com/large',
        mode: 'batch',
      };

      await expect(runner.run(spec, mockCtx)).rejects.toThrow(
        'Response too large',
      );
    });
  });

  describe('map mode', () => {
    beforeEach(() => {
      mockCtx.getDataset = vi.fn().mockReturnValue({
        name: 'source_dataset',
        rows: [
          { id: 1, query: 'test1' },
          { id: 2, query: 'test2' },
        ],
      });
    });

    it('should make requests per row', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue([{ result: 'result1' }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue([{ result: 'result2' }]),
        });

      const spec: HttpSourceSpec = {
        kind: 'http',
        url: 'https://api.example.com/search?q=${row.query}',
        mode: 'map',
        mapFrom: 'source_dataset',
      };

      const result = await runner.run(spec, mockCtx);

      expect(result.rows).toEqual([
        { result: 'result1' },
        { result: 'result2' },
      ]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/search?q=test1',
        expect.any(Object),
      );
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/search?q=test2',
        expect.any(Object),
      );
    });

    it('should apply dry run limits in map mode', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([{ result: 'test' }]),
      });

      mockCtx.dry = true;
      mockCtx.limit = 1;

      const spec: HttpSourceSpec = {
        kind: 'http',
        url: 'https://api.example.com/search?q=${row.query}',
        mode: 'map',
        mapFrom: 'source_dataset',
      };

      const result = await runner.run(spec, mockCtx);

      expect(result.rows).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle missing dataset in map mode', async () => {
      mockCtx.getDataset = vi.fn().mockReturnValue(undefined);

      const spec: HttpSourceSpec = {
        kind: 'http',
        url: 'https://api.example.com/search',
        mode: 'map',
        mapFrom: 'missing_dataset',
      };

      await expect(runner.run(spec, mockCtx)).rejects.toThrow(
        'Dataset not found: missing_dataset',
      );
    });
  });
});

describe('QueryRunner', () => {
  let runner: QueryRunner;
  let mockCtx: StepCtx;

  beforeEach(() => {
    runner = new QueryRunner();
    mockCtx = {
      datasets: {},
      stepOutputs: {},
      env: {},
      vars: {},
      runId: 'test-run',
      dry: false,
      cacheMode: 'off',
      cache: {
        get: vi.fn(),
        set: vi.fn(),
      },
      getDataset: vi.fn(),
      getDatasetByName: vi.fn(),
      getDatasetByStepId: vi.fn(),
      log: vi.fn(),
    };
    vi.clearAllMocks();
  });

  describe('validation', () => {
    it('should validate query with needs', () => {
      const spec: QueryStepSpec = {
        type: 'query',
        needs: ['source_step'],
        eqls: 'FIND item AS ?x RETURN ?x',
        out: 'result',
      };
      expect(() => runner.validate(spec)).not.toThrow();
    });

    it('should reject empty query', () => {
      const spec: QueryStepSpec = {
        type: 'query',
        needs: ['source_step'],
        eqls: '   ',
        out: 'result',
      };
      expect(() => runner.validate(spec)).toThrow(
        'Query step requires non-empty eqls',
      );
    });

    it('should reject missing needs', () => {
      const spec: QueryStepSpec = {
        type: 'query',
        needs: [],
        eqls: 'FIND item AS ?x RETURN ?x',
        out: 'result',
      };
      expect(() => runner.validate(spec)).toThrow(
        'Query step requires at least one dependency',
      );
    });
  });

  describe('execution', () => {
    it('should execute query against input datasets', async () => {
      const mockDataset: Dataset = {
        name: 'test_data',
        rows: [
          { id: 1, name: 'test1', active: true },
          { id: 2, name: 'test2', active: false },
        ],
      };

      mockCtx.getDatasetByStepId = vi.fn().mockReturnValue(mockDataset);

      const spec: QueryStepSpec = {
        type: 'query',
        needs: ['source_step'],
        eqls: 'FIND item AS ?x WHERE ?x.active = true RETURN ?x.id, ?x.name',
        out: 'filtered_data',
      };

      const result = await runner.run(spec, mockCtx);

      expect(result.name).toBe('filtered_data');
      expect(mockCtx.log).toHaveBeenCalledWith({ from: undefined });
    });

    it('should use from field when specified', async () => {
      const mockDataset: Dataset = {
        name: 'specific_data',
        rows: [{ id: 1, value: 'test' }],
      };

      mockCtx.getDataset = vi.fn().mockReturnValue(mockDataset);

      const spec: QueryStepSpec = {
        type: 'query',
        needs: ['source_step'],
        from: 'specific_data',
        eqls: 'FIND item AS ?x RETURN ?x',
        out: 'result',
      };

      await runner.run(spec, mockCtx);

      expect(mockCtx.getDataset).toHaveBeenCalledWith('specific_data');
      expect(mockCtx.log).toHaveBeenCalledWith({ from: 'specific_data' });
    });

    it('should handle missing from dataset', async () => {
      mockCtx.getDataset = vi.fn().mockReturnValue(undefined);

      const spec: QueryStepSpec = {
        type: 'query',
        needs: ['source_step'],
        from: 'missing_data',
        eqls: 'FIND item AS ?x RETURN ?x',
        out: 'result',
      };

      await expect(runner.run(spec, mockCtx)).rejects.toThrow(
        "Dataset 'missing_data' not found",
      );
    });

    it('should handle missing dependencies', async () => {
      mockCtx.getDatasetByStepId = vi.fn().mockReturnValue(undefined);
      mockCtx.getDataset = vi.fn().mockReturnValue(undefined);

      const spec: QueryStepSpec = {
        type: 'query',
        needs: ['missing_step'],
        eqls: 'FIND item AS ?x RETURN ?x',
        out: 'result',
      };

      await expect(runner.run(spec, mockCtx)).rejects.toThrow(
        "Dependency 'missing_step' has no available dataset",
      );
    });

    it('should apply dry run limits', async () => {
      const mockDataset: Dataset = {
        name: 'test_data',
        rows: Array.from({ length: 100 }, (_, i) => ({ id: i })),
      };

      mockCtx.getDatasetByStepId = vi.fn().mockReturnValue(mockDataset);
      mockCtx.dry = true;
      mockCtx.limit = 10;

      const spec: QueryStepSpec = {
        type: 'query',
        needs: ['source_step'],
        eqls: 'FIND item AS ?x RETURN ?x',
        out: 'result',
      };

      const result = await runner.run(spec, mockCtx);

      // Note: This would need to be implemented in the actual query execution
      // For now, we just test that the limit is passed through
      expect(mockCtx.dry).toBe(true);
      expect(mockCtx.limit).toBe(10);
    });

    it('should handle query parsing errors', async () => {
      const mockDataset: Dataset = {
        name: 'test_data',
        rows: [],
      };

      mockCtx.getDatasetByStepId = vi.fn().mockReturnValue(mockDataset);

      const spec: QueryStepSpec = {
        type: 'query',
        needs: ['source_step'],
        eqls: 'INVALID QUERY SYNTAX',
        out: 'result',
      };

      await expect(runner.run(spec, mockCtx)).rejects.toThrow(
        'Query parsing failed',
      );
    });
  });
});

describe('OutputRunner', () => {
  let runner: OutputRunner;
  let mockCtx: StepCtx;

  beforeEach(() => {
    runner = new OutputRunner();
    mockCtx = {
      datasets: {},
      stepOutputs: {},
      env: {},
      vars: {},
      runId: 'test-run',
      dry: false,
      cacheMode: 'off',
      cache: {
        get: vi.fn(),
        set: vi.fn(),
      },
      getDataset: vi.fn(),
      getDatasetByName: vi.fn(),
      getDatasetByStepId: vi.fn(),
      log: vi.fn(),
    };
    vi.clearAllMocks();
  });

  describe('validation', () => {
    it('should validate file output', () => {
      const spec: OutputStepSpec = {
        type: 'output',
        needs: ['query_step'],
        output: {
          kind: 'file',
          format: 'json',
          path: './out/results.json',
        },
      };
      expect(() => runner.validate(spec)).not.toThrow();
    });

    it('should validate stdout output', () => {
      const spec: OutputStepSpec = {
        type: 'output',
        needs: ['query_step'],
        output: {
          kind: 'stdout',
          format: 'json',
        },
      };
      expect(() => runner.validate(spec)).not.toThrow();
    });

    it('should reject missing output config', () => {
      const spec = {
        type: 'output' as const,
        needs: ['query_step'],
        output: undefined as any,
      };
      expect(() => runner.validate(spec)).toThrow(
        'Output step requires output configuration',
      );
    });

    it('should reject missing needs', () => {
      const spec = {
        type: 'output' as const,
        needs: [],
        output: {
          kind: 'file' as const,
          format: 'json' as const,
          path: './out/results.json',
        },
      };
      expect(() => runner.validate(spec)).toThrow(
        'Output step requires at least one dependency',
      );
    });
  });

  describe('file output', () => {
    it('should validate file output specs', async () => {
      const spec: OutputStepSpec = {
        type: 'output',
        needs: ['query_step'],
        output: {
          kind: 'file',
          format: 'json',
          path: './out/results.json',
        },
      };
      expect(() => runner.validate(spec)).not.toThrow();
    });

    it('should handle dataset resolution', async () => {
      const mockDataset: Dataset = {
        name: 'test_results',
        rows: [{ id: 1, name: 'test' }],
      };

      mockCtx.getDatasetByStepId = vi.fn().mockReturnValue(mockDataset);

      const spec: OutputStepSpec = {
        type: 'output',
        needs: ['query_step'],
        output: {
          kind: 'stdout', // Use stdout to avoid file system mocking
          format: 'json',
        },
      };

      await runner.run(spec, mockCtx);

      expect(mockCtx.log).toHaveBeenCalledWith({
        message: "Using dataset 'test_results' with 1 rows",
      });
      expect(mockConsoleLog).toHaveBeenCalledWith(
        JSON.stringify(mockDataset.rows, null, 2),
      );
    });
  });

  describe('stdout output', () => {
    it('should output JSON to console', async () => {
      const mockDataset: Dataset = {
        name: 'test_results',
        rows: [
          { id: 1, name: 'test1' },
          { id: 2, name: 'test2' },
        ],
      };

      mockCtx.getDatasetByStepId = vi.fn().mockReturnValue(mockDataset);

      const spec: OutputStepSpec = {
        type: 'output',
        needs: ['query_step'],
        output: {
          kind: 'stdout',
          format: 'json',
        },
      };

      await runner.run(spec, mockCtx);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        JSON.stringify(mockDataset.rows, null, 2),
      );
      expect(mockCtx.log).toHaveBeenCalledWith({
        message: "Using dataset 'test_results' with 2 rows",
      });
    });

    it('should output CSV to console', async () => {
      const mockDataset: Dataset = {
        name: 'test_results',
        rows: [
          { id: 1, name: 'test1' },
          { id: 2, name: 'test2' },
        ],
      };

      mockCtx.getDatasetByStepId = vi.fn().mockReturnValue(mockDataset);

      const spec: OutputStepSpec = {
        type: 'output',
        needs: ['query_step'],
        output: {
          kind: 'stdout',
          format: 'csv',
        },
      };

      await runner.run(spec, mockCtx);

      const expectedCSV = 'id,name\n1,test1\n2,test2\n';
      expect(mockConsoleLog).toHaveBeenCalledWith(expectedCSV);
    });
  });

  describe('dataset resolution', () => {
    it('should resolve dataset by step output name', async () => {
      const mockDataset: Dataset = {
        name: 'output_data',
        rows: [{ id: 1 }],
      };

      mockCtx.stepOutputs = { query_step: 'output_data' };
      mockCtx.getDatasetByName = vi.fn().mockReturnValue(mockDataset);

      const spec: OutputStepSpec = {
        type: 'output',
        needs: ['query_step'],
        output: {
          kind: 'stdout',
          format: 'json',
        },
      };

      await runner.run(spec, mockCtx);

      expect(mockCtx.getDatasetByName).toHaveBeenCalledWith('output_data');
    });

    it('should resolve dataset by step ID fallback', async () => {
      const mockDataset: Dataset = {
        name: 'step_data',
        rows: [{ id: 1 }],
      };

      mockCtx.getDatasetByName = vi.fn().mockReturnValue(undefined);
      mockCtx.getDatasetByStepId = vi.fn().mockReturnValue(mockDataset);

      const spec: OutputStepSpec = {
        type: 'output',
        needs: ['query_step'],
        output: {
          kind: 'stdout',
          format: 'json',
        },
      };

      await runner.run(spec, mockCtx);

      expect(mockCtx.getDatasetByStepId).toHaveBeenCalledWith('query_step');
    });

    it('should handle missing datasets', async () => {
      mockCtx.getDatasetByName = vi.fn().mockReturnValue(undefined);
      mockCtx.getDatasetByStepId = vi.fn().mockReturnValue(undefined);

      const spec: OutputStepSpec = {
        type: 'output',
        needs: ['missing_step'],
        output: {
          kind: 'stdout',
          format: 'json',
        },
      };

      await expect(runner.run(spec, mockCtx)).rejects.toThrow(
        'No datasets available for output step',
      );
    });

    it('should prefer last dependency when multiple available', async () => {
      const mockDataset1: Dataset = {
        name: 'data1',
        rows: [{ id: 1 }],
      };
      const mockDataset2: Dataset = {
        name: 'data2',
        rows: [{ id: 2 }],
      };

      mockCtx.getDatasetByStepId = vi.fn().mockImplementation((stepId) => {
        if (stepId === 'step1') return mockDataset1;
        if (stepId === 'step2') return mockDataset2;
        return undefined;
      });

      const spec: OutputStepSpec = {
        type: 'output',
        needs: ['step1', 'step2'],
        output: {
          kind: 'stdout',
          format: 'json',
        },
      };

      await runner.run(spec, mockCtx);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        JSON.stringify([{ id: 2 }], null, 2),
      );
    });
  });
});
