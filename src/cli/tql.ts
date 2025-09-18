#!/usr/bin/env node

/**
 * TQL (Tree Query Language) CLI
 *
 * A powerful CLI tool that combines the orchestrator and query engine
 * to process natural language queries on JSON data from files or URLs
 */

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join } from 'path';
import { EAVStore, jsonEntityFacts } from '../eav-engine.js';
import { DatalogEvaluator } from '../query/datalog-evaluator.js';
import { EQLSProcessor } from '../query/eqls-parser.js';
import { processQuery } from '../ai/orchestrator.js';
import { WorkflowEngine } from '../workflows/engine.js';
import {
  initTelemetry,
  trackCommand,
  shutdownTelemetry,
} from '../telemetry.js';

interface TQLOptions {
  data: string;
  query: string;
  format: 'json' | 'table' | 'csv';
  limit: number;
  verbose: boolean;
  natural: boolean;
  catalog: boolean;
  raw: boolean;
  type?: string;
  idKey?: string;
}

export class TQLCLI {
  private store: EAVStore;
  private evaluator: DatalogEvaluator;
  private eqlsProcessor: EQLSProcessor;

  constructor() {
    this.store = new EAVStore();
    this.evaluator = new DatalogEvaluator(this.store);
    this.eqlsProcessor = new EQLSProcessor();
  }

  getStore(): EAVStore {
    return this.store;
  }

  async loadData(source: string, options: TQLOptions): Promise<void> {
    if (!options.raw) {
      console.log(`📥 Loading data from: ${source}`);
    }

    let jsonData: any;

    if (source.startsWith('http://') || source.startsWith('https://')) {
      // Load from URL
      const response = await fetch(source);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch data from URL: ${response.statusText}`,
        );
      }
      jsonData = await response.json();
    } else {
      // Load from local file
      try {
        const filePath = join(process.cwd(), source);
        const fileContent = readFileSync(filePath, 'utf-8');
        jsonData = JSON.parse(fileContent);
      } catch (error) {
        throw new Error(
          `Failed to load file: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
      }
    }

    // Ingest data into EAV store
    if (Array.isArray(jsonData)) {
      // Array of objects - create one entity per array element
      for (let i = 0; i < jsonData.length; i++) {
        const item = jsonData[i]!;
        const entityId = this.generateEntityId(item, i, options);
        const entityType = options.type || this.inferType(item);
        const facts = jsonEntityFacts(entityId, item, entityType);
        this.store.addFacts(facts);
      }
    } else if (typeof jsonData === 'object') {
      // Check if this is a wrapper object with a data array (common API pattern)
      const dataArray = this.extractDataArray(jsonData, options);
      if (dataArray) {
        // Process the extracted array
        for (let i = 0; i < dataArray.length; i++) {
          const item = dataArray[i]!;
          const entityId = this.generateEntityId(item, i, options);
          const entityType = options.type || this.inferType(item);
          const facts = jsonEntityFacts(entityId, item, entityType);
          this.store.addFacts(facts);
        }
      } else {
        // Single object or nested structure
        const entityType = options.type || 'root';
        const facts = jsonEntityFacts('root', jsonData, entityType);
        this.store.addFacts(facts);
      }
    } else {
      throw new Error('Data must be a JSON object or array');
    }

    if (!options.raw) {
      console.log(`✅ Loaded data successfully`);
      console.log(`📊 Store stats:`, this.store.getStats());
    }

    // Set up schema for attribute validation
    const catalog = this.store.getCatalog();
    this.eqlsProcessor.setSchema(catalog);
  }

  private extractDataArray(jsonData: any, options: TQLOptions): any[] | null {
    // Handle null/undefined responses gracefully
    if (jsonData === null || jsonData === undefined) {
      return null;
    }

    // Common patterns for API responses with data arrays
    const commonArrayKeys = [
      'data',
      'results',
      'items',
      'shows',
      'posts',
      'users',
      'products',
    ];

    for (const key of commonArrayKeys) {
      if (jsonData[key] && Array.isArray(jsonData[key])) {
        if (!options.raw) {
          console.log(`📦 Detected data array in '${key}' field`);
        }
        return jsonData[key];
      }
    }

    return null;
  }

  private generateEntityId(
    item: any,
    index: number,
    options: TQLOptions,
  ): string {
    const entityType = options.type || this.inferType(item);

    // Try to find a unique identifier using the specified idKey or common fields
    const idKey = options.idKey || 'id';
    if (item[idKey]) return `${entityType}:${item[idKey]}`;
    if (item.id) return `${entityType}:${item.id}`;
    if (item._id) return `${entityType}:${item._id}`;
    if (item.name) return `${entityType}:${item.name}`;
    return `${entityType}:${index}`;
  }

  private inferType(item: any): string {
    // Try to infer type from common fields
    if (item.type) return item.type;
    if (item._type) return item._type;
    if (item.kind) return item.kind;

    // Infer from structure
    if (item.title && item.body) return 'post';
    if (item.name && item.email) return 'user';
    if (item.subject && item.body) return 'email';
    if (item.name && item.price) return 'product';
    if (item.albumId && item.url) return 'photo';
    if (item.userId && item.title && !item.body) return 'album';

    return 'item';
  }

  async processQuery(query: string, options: TQLOptions): Promise<void> {
    let processedQuery: string = query;

    // If natural language mode, use orchestrator to convert to EQL-S
    if (options.natural) {
      if (!options.raw) {
        console.log('🧠 Processing natural language query...');
      }
      const catalog = this.store.getCatalog();
      const catalogInfo = Array.from(catalog.entries())
        .slice(0, 20) // Top 20 attributes
        .map(([attr, entry]) => ({
          attribute: attr,
          type: entry.type,
          examples: entry.examples.slice(0, 2),
        }));

      try {
        const result = await processQuery(query, {
          catalog: catalogInfo,
          dataStats: this.store.getStats(),
        });

        if (result.eqlsQuery) {
          processedQuery = result.eqlsQuery;
          if (!options.raw) {
            console.log(`📝 Generated EQL-S query: ${processedQuery}`);
          }
        } else {
          throw new Error(
            'Failed to generate EQL-S query from natural language',
          );
        }
      } catch (error) {
        console.error('❌ Natural language processing failed:', error);
        throw error;
      }
    }

    // Parse and compile EQL-S query
    if (!options.raw) {
      console.log('🔍 Parsing and compiling query...');
    }
    const result = this.eqlsProcessor.process(processedQuery);

    if (result.errors.length > 0) {
      console.error('❌ Query parsing errors:');
      for (const error of result.errors) {
        console.error(
          `  Line ${error.line}, Column ${error.column}: ${error.message}`,
        );
        if (error.expected) {
          console.error(`    Expected: ${error.expected.join(', ')}`);
        }
      }
      throw new Error('Query parsing failed');
    }

    // Execute query
    if (!options.raw) {
      console.log('⚡ Executing query...');
    }
    const queryResult = this.evaluator.evaluate(result.query!);

    // Apply projection map to results
    const projectedResults = this.applyProjectionMap(
      queryResult.bindings,
      result.projectionMap || new Map(),
    );

    // Apply limit
    const limitedResults =
      options.limit > 0
        ? projectedResults.slice(0, options.limit)
        : projectedResults;

    // Display results
    this.displayResults(limitedResults, options, queryResult.executionTime);
  }

  private applyProjectionMap(
    bindings: Record<string, any>[],
    projectionMap: Map<string, string>,
  ): Record<string, any>[] {
    if (projectionMap.size === 0) {
      return bindings;
    }

    return bindings.map((binding) => {
      const projected: Record<string, any> = {};

      for (const [originalField, outputVar] of projectionMap) {
        const value = binding[outputVar];
        if (value !== undefined) {
          projected[originalField] = value;
        } else {
          // Fallback to original field if outputVar not found
          projected[originalField] = binding[originalField];
        }
      }

      return projected;
    });
  }

  private displayResults(
    results: Record<string, any>[],
    options: TQLOptions,
    executionTime: number,
  ): void {
    // Skip annotations for raw output
    if (!options.raw) {
      console.log(
        `\n📊 Query Results (${results.length} rows, ${executionTime.toFixed(
          2,
        )}ms)`,
      );
      console.log('='.repeat(60));
    }

    if (results.length === 0) {
      if (!options.raw) {
        console.log('No results found.');
      } else {
        console.log('[]');
      }
      return;
    }

    switch (options.format) {
      case 'json':
        console.log(JSON.stringify(results, null, 2));
        break;

      case 'csv':
        this.displayCSV(results);
        break;

      case 'table':
      default:
        this.displayTable(results);
        break;
    }
  }

  private displayTable(results: Record<string, any>[]): void {
    if (results.length === 0) return;

    // Get all unique keys
    const allKeys = new Set<string>();
    for (const result of results) {
      for (const key of Object.keys(result)) {
        allKeys.add(key);
      }
    }

    const keys = Array.from(allKeys).sort();

    // Calculate column widths
    const widths: Record<string, number> = {};
    for (const key of keys) {
      widths[key] = Math.max(key.length, 8);
    }

    for (const result of results) {
      for (const key of keys) {
        const value = String(result[key] || '');
        widths[key] = Math.max(widths[key]!, value.length);
      }
    }

    // Print header
    let header = '';
    for (const key of keys) {
      header += key.padEnd(widths[key]! + 2);
    }
    console.log(header);
    console.log('-'.repeat(header.length));

    // Print rows
    for (const result of results) {
      let row = '';
      for (const key of keys) {
        const value = String(result[key] || '');
        row += value.padEnd(widths[key]! + 2);
      }
      console.log(row);
    }
  }

  private displayCSV(results: Record<string, any>[]): void {
    if (results.length === 0) return;

    // Get all unique keys
    const allKeys = new Set<string>();
    for (const result of results) {
      for (const key of Object.keys(result)) {
        allKeys.add(key);
      }
    }

    const keys = Array.from(allKeys).sort();

    // Print header
    console.log(keys.join(','));

    // Print rows
    for (const result of results) {
      const row = keys.map((key) => {
        const value = result[key];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return String(value);
      });
      console.log(row.join(','));
    }
  }

  showCatalog(): void {
    console.log('\n📋 Data Catalog');
    console.log('='.repeat(60));

    const catalog = this.store.getCatalog();
    const entries = catalog.sort((a, b) => b.distinctCount - a.distinctCount);

    for (const entry of entries) {
      console.log(`\n${entry.attribute}`);
      console.log(`  Type: ${entry.type}`);
      console.log(`  Cardinality: ${entry.cardinality}`);
      console.log(`  Distinct values: ${entry.distinctCount}`);
      if (entry.min !== undefined && entry.max !== undefined) {
        console.log(`  Range: ${entry.min} - ${entry.max}`);
      }
      console.log(`  Examples: ${entry.examples.slice(0, 3).join(', ')}`);
    }
  }

  async run(options: TQLOptions): Promise<void> {
    try {
      // Load data
      await this.loadData(options.data, options);

      // Show catalog if requested explicitly
      if (options.catalog) {
        this.showCatalog();
        return;
      }

      // Automatically show catalog before natural language query
      // This helps the user understand the data structure
      if (options.natural && !options.raw) {
        console.log(
          '\n📋 Auto-generating catalog for natural language query...',
        );
        console.log(
          'This helps ensure accurate query generation by understanding data structure',
        );
        console.log('='.repeat(60));
        this.showCatalog();
        console.log('\n🔄 Now processing natural language query...');
      }

      // Process query
      await this.processQuery(options.query, options);
    } catch (error) {
      console.error(
        '❌ Error:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      process.exit(1);
    }
  }
}

// Initialize telemetry
initTelemetry();

// CLI setup
const program = new Command();

program
  .name('tql')
  .description(
    'Tree Query Language - Query JSON data with natural language or EQL-S',
  )
  .version('1.1.0')
  .allowUnknownOption(false)
  .showHelpAfterError(true);

// Add workflow subcommand FIRST
const workflowCommand = program
  .command('workflow')
  .alias('wf')
  .description('Execute workflow files');

workflowCommand
  .command('run <file>')
  .description('Run a workflow from YAML file')
  .option('--dry', 'Dry run mode (validates workflow, fetches data, processes queries, but skips file writes)', false)
  .option('--watch', 'Watch file for changes and re-run', false)
  .option('--max-rows <number>', 'Limit rows per step')
  .option('--var <key=value...>', 'Set template variables', [])
  .option('--cache <mode>', 'Cache mode: read|write|off', 'write')
  .option('--log <format>', 'Log format: pretty|json', 'pretty')
  .option('--no-color', '[DEPRECATED] No-op: output is always plain text', false)
  .option('--out <dir>', 'Output directory', './out')
  .action(async (file: string, options: any) => {
    const startTime = Date.now();
    let success = false;
    let errorType: string | undefined;

    try {
      // Parse variables
      const vars: Record<string, string> = {};
      for (const varStr of options.var || []) {
        const [key, ...valueParts] = varStr.split('=');
        if (key && valueParts.length > 0) {
          vars[key] = valueParts.join('=');
        }
      }

      // Show deprecation warning for --no-color
      if (options.color === false) {
        console.warn('⚠️  --no-color is deprecated: output is always plain text');
      }

      const engine = new WorkflowEngine({
        dry: options.dry,
        watch: options.watch,
        limit: options.maxRows ? parseInt(options.maxRows) : undefined,
        vars,
        cache: options.cache as 'read' | 'write' | 'off',
        log: options.log as 'pretty' | 'json',
        out: options.out,
      });

      await engine.executeWorkflowFile(file);
      success = true;
    } catch (error) {
      console.error('Workflow execution failed:', error);
      errorType = error instanceof Error ? error.constructor.name : 'Unknown';
      process.exit(1);
    } finally {
      const duration = Date.now() - startTime;
      trackCommand('workflow', 'run', duration, success, errorType);
    }
  });

// Add plan command
workflowCommand
  .command('plan <file>')
  .description('Show execution plan for a workflow')
  .option('--var <key=value...>', 'Set template variables', [])
  .option('--dot', 'Output as Graphviz DOT format')
  .option('--mermaid', 'Output as Mermaid format')
  .option('--json', 'Output as JSON format')
  .action(async (file: string, options: any) => {
    const startTime = Date.now();
    let success = false;
    let errorType: string | undefined;

    try {
      // Parse variables
      const vars: Record<string, string> = {};
      for (const varStr of options.var || []) {
        const [key, ...valueParts] = varStr.split('=');
        if (key && valueParts.length > 0) {
          vars[key] = valueParts.join('=');
        }
      }

      const { readFile } = await import('fs/promises');
      const { parseWorkflow } = await import('../workflows/parser.js');
      const { createExecutionPlan } = await import('../workflows/planner.js');

      const yamlContent = await readFile(file, 'utf-8');
      const spec = parseWorkflow(yamlContent);
      const plan = createExecutionPlan(spec);

      if (options.dot) {
        console.log(generateDotGraph(plan));
      } else if (options.mermaid) {
        console.log(generateMermaidGraph(plan));
      } else if (options.json) {
        const jsonPlan = {
          name: spec.name,
          version: spec.version,
          steps: plan.order.map((stepId) => {
            const step = spec.steps.find((s) => s.id === stepId);
            const stepInfo: any = {
              id: stepId,
              type: step?.type,
              needs: step?.needs || [],
              from: step?.type === 'query' ? (step as any).from : undefined,
              out: step?.out,
            };

            // Add source.kind for source steps
            if (step?.type === 'source' && 'source' in step) {
              stepInfo.source = {
                kind: step.source.kind,
                mode: step.source.mode,
                url: step.source.url,
              };
            }

            return stepInfo;
          }),
        };
        console.log(JSON.stringify(jsonPlan, null, 2));
      } else {
        console.log('📋 Workflow Execution Plan\n');
        console.log(`Name: ${spec.name}`);
        console.log(`Version: ${spec.version}\n`);

        console.log('Execution Order:');
        plan.order.forEach((stepId, index) => {
          const step = spec.steps.find((s) => s.id === stepId);
          if (step) {
            const needs = step.needs?.length
              ? ` (needs: ${step.needs.join(', ')})`
              : '';
            const from = step.type === 'query' && (step as any).from ? ` (from: ${(step as any).from})` : '';
            const out = step.out ? ` → ${step.out}` : '';
            console.log(
              `  ${index + 1}. ${stepId} [${step.type}]${needs}${from}${out}`,
            );
          }
        });
      }
      success = true;
    } catch (error) {
      console.error('Failed to plan workflow:', error);
      errorType = error instanceof Error ? error.constructor.name : 'Unknown';
      process.exit(1);
    } finally {
      const duration = Date.now() - startTime;
      trackCommand('workflow', 'plan', duration, success, errorType);
    }
  });

// Main query command as default action
program
  .option('-d, --data <source>', 'Data source (file path or URL)')
  .option('-q, --query <query>', 'Query in EQL-S format or natural language')
  .option('-f, --format <format>', 'Output format (json|table|csv)', 'table')
  .option('--limit <number>', 'Limit number of results', '0')
  .option('-v, --verbose', 'Verbose output', false)
  .option(
    '-n, --natural',
    'Process as natural language query (automatically shows catalog first)',
    false,
  )
  .option('-c, --catalog', 'Show data catalog instead of querying', false)
  .option(
    '-r, --raw',
    'Raw output without annotations (useful for piping)',
    false,
  )
  .option('--type <name>', 'Force entity type label (e.g., user, post)')
  .option('--id-key <key>', 'Choose id field if not "id"')
  .action(async (options: any) => {
    // Only run query action if data is provided and we're not running a subcommand
    if (options.data) {
      // Validate that query is provided unless showing catalog
      if (!options.catalog && !options.query) {
        console.error(
          'Error: Query is required unless showing catalog with -c option',
        );
        process.exit(1);
      }

      const tql = new TQLCLI();
      await tql.run({
        data: options.data,
        query: options.query || '',
        format: options.format,
        limit: parseInt(options.limit) || 0,
        verbose: options.verbose,
        natural: options.natural,
        catalog: options.catalog,
        raw: options.raw,
        type: options.type,
        idKey: options.idKey,
      });
    } else if (process.argv.length === 2) {
      // No arguments, show help
      program.help();
    }
  });

// Add examples
program.addHelpText(
  'after',
  `
Examples:
  # Query local JSON file with EQL-S
  tql -d data/posts.json -q "FIND post AS ?p WHERE ?p.views > 1000 RETURN ?p, ?p.title"

  # Query URL with natural language
  tql -d https://jsonplaceholder.typicode.com/posts -q "show me posts with more than 1000 views" -n

  # Show data catalog
  tql -d data/users.json -c

  # Export results as CSV
  tql -d data/products.json -q "FIND product AS ?p WHERE ?p.price > 100 RETURN ?p.name, ?p.price" -f csv

  # Limit results
  tql -d data/posts.json -q "FIND post AS ?p RETURN ?p" -l 10

  # Run workflow
  tql workflow run examples/workflows/webfonts-serifs.yml --dry --limit 10

EQL-S Query Examples:
  # Find posts with specific tags
  FIND post AS ?p WHERE "crime" IN ?p.tags AND ?p.reactions.likes > 1000

  # Find users by email domain
  FIND user AS ?u WHERE ?u.email CONTAINS "@gmail.com"

  # Find products in price range
  FIND product AS ?p WHERE ?p.price BETWEEN 100 AND 500

  # Find posts with regex pattern
  FIND post AS ?p WHERE ?p.title MATCHES /(storm|forest)/

  # Complex query with ordering and limits
  FIND post AS ?p WHERE ?p.views > 1000 RETURN ?p, ?p.title ORDER BY ?p.views DESC LIMIT 5

Workflow Examples:
  # Run workflow with variables
  tql workflow run workflow.yml --var API_KEY=secret --cache write

  # Dry run with limited data
  tql workflow run workflow.yml --dry --limit 20

  # JSON logging for automation
  tql workflow run workflow.yml --log json
`,
);

// Helper functions for plan visualization
function generateDotGraph(plan: any): string {
  const { steps, order } = plan;
  let dot = 'digraph Workflow {\n';
  dot += '  rankdir=TB;\n';
  dot += '  node [shape=box, style=filled];\n\n';

  // Add nodes
  for (const step of steps) {
    const color =
      step.type === 'source'
        ? 'lightblue'
        : step.type === 'query'
          ? 'lightgreen'
          : 'lightcoral';
    dot += `  "${step.id}" [label="${step.id}\\n[${step.type}]", fillcolor="${color}"];\n`;
  }

  // Add edges
  for (const step of steps) {
    if (step.needs) {
      for (const dep of step.needs) {
        dot += `  "${dep}" -> "${step.id}";\n`;
      }
    }
  }

  dot += '}\n';
  return dot;
}

function generateMermaidGraph(plan: any): string {
  const { steps, order } = plan;
  let mermaid = 'graph TD\n';

  // Add nodes
  for (const step of steps) {
    const shape =
      step.type === 'source'
        ? '((source))'
        : step.type === 'query'
          ? '[query]'
          : '[[output]]';
    mermaid += `  ${step.id}${shape}\n`;
  }

  // Add edges
  for (const step of steps) {
    if (step.needs) {
      for (const dep of step.needs) {
        mermaid += `  ${dep} --> ${step.id}\n`;
      }
    }
  }

  return mermaid;
}

// Parse command line arguments
program.parse();

// Shutdown telemetry on exit
process.on('exit', () => {
  shutdownTelemetry();
});

process.on('SIGINT', () => {
  shutdownTelemetry();
  process.exit(0);
});

process.on('SIGTERM', () => {
  shutdownTelemetry();
  process.exit(0);
});
