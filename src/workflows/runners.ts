/**
 * Core workflow runners
 * 
 * Implements source:http, query:eqls, and output:file/stdout runners.
 * Each runner validates its spec and executes within step context.
 */

import { writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import type { 
  Runner, 
  Dataset, 
  StepCtx, 
  HttpSourceSpec, 
  QueryStepSpec, 
  OutputStepSpec 
} from './types.js';
import { WorkflowRuntimeError } from './types.js';
import { interpolateObject, type TemplateContext } from './parser.js';
import { EAVStore, jsonEntityFacts } from '../eav-engine.js';
import { DatalogEvaluator } from '../query/datalog-evaluator.js';
import { EQLSProcessor } from '../query/eqls-parser.js';

/**
 * HTTP Source Runner
 * Supports batch (single request) and map (per-row requests) modes
 */
export class HttpSourceRunner implements Runner<HttpSourceSpec> {
  validate(spec: HttpSourceSpec): void {
    if (!spec.url) {
      throw new WorkflowRuntimeError('HTTP source requires url');
    }
    
    if (spec.mode === 'map' && !spec.mapFrom) {
      throw new WorkflowRuntimeError('Map mode requires mapFrom dataset');
    }
  }
  
  async run(spec: HttpSourceSpec, ctx: StepCtx): Promise<Dataset> {
    this.validate(spec);
    
    const templateContext: TemplateContext = {
      env: ctx.env,
      vars: ctx.vars
    };
    
    switch (spec.mode) {
      case 'batch':
        return this.runBatch(spec, templateContext, ctx);
      case 'map':
        return this.runMap(spec, templateContext, ctx);
      default:
        throw new WorkflowRuntimeError(`Unsupported HTTP mode: ${spec.mode}`);
    }
  }
  
  private async runBatch(
    spec: HttpSourceSpec, 
    templateContext: TemplateContext, 
    ctx: StepCtx
  ): Promise<Dataset> {
    const interpolatedSpec = interpolateObject(spec, templateContext);
    const url = interpolatedSpec.url;
    
    ctx.log({ message: `HTTP GET ${url}` });
    
    try {
      const response = await this.fetchWithTimeout(url, {
        headers: interpolatedSpec.headers || {}
      });
      
      if (!response.ok) {
        throw new WorkflowRuntimeError(
          `HTTP ${response.status}: ${response.statusText}`
        );
      }
      
      const data = await response.json();
      const rows = this.extractDataArray(data);
      
      // Apply limit for dry runs
      const limitedRows = ctx.dry && ctx.limit 
        ? rows.slice(0, ctx.limit) 
        : rows;
      
      return {
        name: spec.mapFrom || 'batch_result',
        rows: limitedRows
      };
    } catch (error) {
      if (error instanceof WorkflowRuntimeError) {
        throw error;
      }
      throw new WorkflowRuntimeError(
        `HTTP request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  
  private async runMap(
    spec: HttpSourceSpec, 
    templateContext: TemplateContext, 
    ctx: StepCtx
  ): Promise<Dataset> {
    if (!spec.mapFrom) {
      throw new WorkflowRuntimeError('Map mode requires mapFrom dataset');
    }
    
    const sourceDataset = ctx.getDataset(spec.mapFrom);
    if (!sourceDataset) {
      throw new WorkflowRuntimeError(`Dataset not found: ${spec.mapFrom}`);
    }
    
    const allRows: any[] = [];
    const sourceRows = ctx.dry && ctx.limit 
      ? sourceDataset.rows.slice(0, ctx.limit)
      : sourceDataset.rows;
    
    for (const row of sourceRows) {
      const rowContext: TemplateContext = {
        ...templateContext,
        row
      };
      
      const interpolatedSpec = interpolateObject(spec, rowContext);
      const url = interpolatedSpec.url;
      
      try {
        const response = await this.fetchWithTimeout(url, {
          headers: interpolatedSpec.headers || {}
        });
        
        if (!response.ok) {
          throw new WorkflowRuntimeError(
            `HTTP ${response.status} for row ${JSON.stringify(row)}: ${response.statusText}`
          );
        }
        
        const data = await response.json();
        const rows = this.extractDataArray(data);
        allRows.push(...rows);
      } catch (error) {
        if (error instanceof WorkflowRuntimeError) {
          throw error;
        }
        throw new WorkflowRuntimeError(
          `HTTP request failed for row ${JSON.stringify(row)}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    }
    
    return {
      name: `${spec.mapFrom}_mapped`,
      rows: allRows
    };
  }
  
  private async fetchWithTimeout(
    url: string, 
    options: RequestInit = {},
    timeoutMs: number = 15000
  ): Promise<Response> {
    const maxBytes = parseInt(process.env.TQL_HTTP_MAX_BYTES || '10485760'); // 10MB
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      // Check content length
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > maxBytes) {
        throw new WorkflowRuntimeError(
          `Response too large: ${contentLength} bytes (max: ${maxBytes})`
        );
      }
      
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  
  private extractDataArray(data: any): any[] {
    // Handle common API response patterns
    if (Array.isArray(data)) {
      return data;
    }
    
    // Check for common data wrapper keys
    for (const key of ['items', 'data', 'results', 'rows']) {
      if (data[key] && Array.isArray(data[key])) {
        return data[key];
      }
    }
    
    // Fallback: wrap single object in array
    return [data];
  }
}

/**
 * EQL-S Query Runner
 * Executes EQL-S queries against datasets using EAV store
 */
export class QueryRunner implements Runner<QueryStepSpec> {
  validate(spec: QueryStepSpec): void {
    if (!spec.eqls || spec.eqls.trim().length === 0) {
      throw new WorkflowRuntimeError('Query step requires non-empty eqls');
    }
    
    if (!spec.needs || spec.needs.length === 0) {
      throw new WorkflowRuntimeError('Query step requires at least one dependency');
    }
  }
  
  async run(spec: QueryStepSpec, ctx: StepCtx): Promise<Dataset> {
    this.validate(spec);
    
    // Create EAV store and populate with input datasets
    const store = new EAVStore();
    const inputDatasets = this.resolveInputDatasets(spec, ctx);
    
    // Load data into store
    for (const dataset of inputDatasets) {
      if (!dataset) continue;
      
      for (let i = 0; i < dataset.rows.length; i++) {
        const row = dataset.rows[i];
        const entityId = `${dataset.name}:${i}`;
        
        // Use jsonEntityFacts to properly convert to EAV facts
        const facts = jsonEntityFacts(entityId, row, dataset.name);
        store.addFacts(facts);
      }
    }
    
    // Parse and execute query
    try {
      const processor = new EQLSProcessor();
      
      // Set schema so processor knows about attributes
      const catalog = store.getCatalog();
      processor.setSchema(catalog);
      
      const evaluator = new DatalogEvaluator(store);
      const parseResult = processor.process(spec.eqls);
      
      if (parseResult.errors.length > 0) {
        throw new WorkflowRuntimeError(
          `Query parsing failed: ${parseResult.errors.map(e => e.message).join('; ')}`
        );
      }
      
      const results = evaluator.evaluate(parseResult.query!);
      
      // Convert results back to rows
      const rows = this.resultsToRows(results);
      
      // Apply limit for dry runs
      const limitedRows = ctx.dry && ctx.limit 
        ? rows.slice(0, ctx.limit) 
        : rows;
      
      return {
        name: spec.out,
        rows: limitedRows
      };
    } catch (error) {
      throw new WorkflowRuntimeError(
        `Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  
  private resultsToRows(results: any): any[] {
    // Convert QueryResult to rows - this is a simplified version
    // In a full implementation, you'd need to properly map the 
    // query results based on the projection map
    if (results && results.bindings && Array.isArray(results.bindings)) {
      return results.bindings;
    }
    
    // Fallback for other result formats
    return [];
  }

  private resolveInputDatasets(spec: QueryStepSpec, ctx: StepCtx): Dataset[] {
    const datasets: Dataset[] = [];
    const seen = new Set<string>();

    if (spec.from) {
      const dataset = ctx.getDataset(spec.from);
      if (!dataset) {
        throw new WorkflowRuntimeError(
          `Dataset '${spec.from}' not found for query step ${spec.id}`
        );
      }
      datasets.push(dataset);
      seen.add(dataset.name ?? spec.from);
    }

    for (const dependency of spec.needs) {
      const dataset = ctx.getDatasetByStepId(dependency) || ctx.getDataset(dependency);
      if (!dataset) {
        throw new WorkflowRuntimeError(
          `Dependency '${dependency}' has no available dataset for query step ${spec.id}`
        );
      }

      const key = dataset.name || dependency;
      if (!seen.has(key)) {
        datasets.push(dataset);
        seen.add(key);
      }
    }

    if (datasets.length === 0) {
      const available = Object.keys(ctx.datasets).join(', ') || 'none';
      throw new WorkflowRuntimeError(
        `No input datasets resolved for query step ${spec.id}. Available datasets: ${available}`
      );
    }

    return datasets;
  }
}

/**
 * Output Runner
 * Writes datasets to files or stdout in JSON/CSV format
 */
export class OutputRunner implements Runner<OutputStepSpec> {
  validate(spec: OutputStepSpec): void {
    if (!spec.output) {
      throw new WorkflowRuntimeError('Output step requires output configuration');
    }
    
    if (!spec.needs || spec.needs.length === 0) {
      throw new WorkflowRuntimeError('Output step requires at least one dependency');
    }
  }
  
  async run(spec: OutputStepSpec, ctx: StepCtx): Promise<void> {
    this.validate(spec);
    
    const inputDataset = this.resolveOutputDataset(spec, ctx);
    
    ctx.log({ message: `Using dataset '${inputDataset.name}' with ${inputDataset.rows.length} rows` });
    
    // Use the input dataset rows
    const allRows = inputDataset.rows;
    
    // Format output
    const content = spec.output.format === 'json' 
      ? this.formatJSON(allRows)
      : this.formatCSV(allRows);
    
    // Write output
    if (spec.output.kind === 'file') {
      await this.writeToFile(spec.output.path, content, ctx);
    } else {
      // stdout
      console.log(content);
    }
  }
  
  private formatJSON(rows: any[]): string {
    return JSON.stringify(rows, null, 2);
  }
  
  private formatCSV(rows: any[]): string {
    if (rows.length === 0) {
      return '';
    }
    
    // Get all unique keys from all rows
    const allKeys = new Set<string>();
    for (const row of rows) {
      Object.keys(row).forEach(key => allKeys.add(key));
    }
    
    const headers = Array.from(allKeys);
    const csvRows = [headers.join(',')];
    
    for (const row of rows) {
      const values = headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) {
          return '';
        }
        
        const stringValue = String(value);
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        
        return stringValue;
      });
      
      csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
  }
  
  private async writeToFile(path: string, content: string, ctx: StepCtx): Promise<void> {
    try {
      // Ensure directory exists
      const dir = dirname(path);
      await mkdir(dir, { recursive: true });
      
      // Write file
      await writeFile(path, content, 'utf-8');
    } catch (error) {
      throw new WorkflowRuntimeError(
        `Failed to write file ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private resolveOutputDataset(spec: OutputStepSpec, ctx: StepCtx): Dataset {
    const candidates: Dataset[] = [];

    for (const dependency of spec.needs) {
      const datasetName = ctx.stepOutputs[dependency];
      const dataset = (datasetName && ctx.getDatasetByName(datasetName))
        || ctx.getDatasetByStepId(dependency)
        || ctx.getDataset(dependency);

      if (dataset) {
        candidates.push(dataset);
      }
    }

    if (candidates.length === 0) {
      const available = Object.keys(ctx.datasets).join(', ') || 'none';
      throw new WorkflowRuntimeError(
        `No datasets available for output step ${spec.id}. Available datasets: ${available}`
      );
    }

    // Prefer the dataset associated with the last declared dependency
    return candidates[candidates.length - 1]!;
  }
}

/**
 * Runner registry
 */
export const BUILTIN_RUNNERS = {
  'source:http': new HttpSourceRunner(),
  'query:eqls': new QueryRunner(),
  'output:file': new OutputRunner(),
  'output:stdout': new OutputRunner()
} as const;

/**
 * Get runner for step type
 */
export function getRunner(stepType: string, stepSpec: any): Runner {
  switch (stepType) {
    case 'source':
      if (stepSpec.source?.kind === 'http') {
        return BUILTIN_RUNNERS['source:http'];
      }
      break;
    case 'query':
      return BUILTIN_RUNNERS['query:eqls'];
    case 'output':
      return BUILTIN_RUNNERS['output:file']; // Same runner handles both file and stdout
  }
  
  throw new WorkflowRuntimeError(`No runner found for step type: ${stepType}`);
}
