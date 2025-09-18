/**
 * Workflow execution engine
 *
 * Orchestrates the complete workflow execution with caching, logging, and error handling.
 */

import { readFile } from 'fs/promises';
import type {
  WorkflowSpec,
  StepSpec,
  StepCtx,
  Dataset,
  WorkflowRunOptions,
  WorkflowEvent,
} from './types.js';
import { WorkflowValidationError, WorkflowRuntimeError } from './types.js';
import { parseWorkflow, validateWorkflowSemantics } from './parser.js';
import { createExecutionPlan, validateExecutionPlan } from './planner.js';
import { getRunner } from './runners.js';
import { LOG_LEVELS } from './log-levels.js';
import {
  createCacheManager,
  createCacheKey,
  createInputDatasetsHash,
  createTemplateVarsHash,
  withCache,
  type CacheManager,
} from './cache.js';

/**
 * Main workflow execution engine
 */
export class WorkflowEngine {
  private datasetsByName: Record<string, Dataset> = {};
  private datasetsByStepId: Record<string, Dataset> = {};
  private stepOutputNames: Record<string, string> = {};
  private runId: string;
  private cacheManager: CacheManager;
  private events: WorkflowEvent[] = [];

  constructor(
    private options: WorkflowRunOptions = {},
    cacheDir?: string,
  ) {
    this.runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    this.cacheManager = createCacheManager(options.cache || 'write', cacheDir);
  }

  /**
   * Execute workflow from YAML file
   */
  async executeWorkflowFile(filePath: string): Promise<void> {
    const yamlContent = await readFile(filePath, 'utf-8');
    const spec = parseWorkflow(yamlContent);
    await this.executeWorkflow(spec);
  }

  /**
   * Execute workflow from specification
   */
  async executeWorkflow(spec: WorkflowSpec): Promise<void> {
    // Show dry-run banner if applicable
    if (this.options.dry) {
      const limit = this.options.limit || 50;
      const mapCap = 20;
      console.log(`${LOG_LEVELS.DRY} DRY RUN (limit=${limit}, map cap=${mapCap})`);

      // Show map mode sources with their mapFrom
      const mapSources = spec.steps.filter(
        (step) => step.type === 'source' && (step as any).source.mode === 'map',
      );
      for (const source of mapSources) {
        console.log(
          `  mapFrom=${(source as any).source.mapFrom} cap=${mapCap}`,
        );
      }
    }

    this.logEvent('workflow', 'started', {});

    try {
      // Validate workflow semantics
      validateWorkflowSemantics(spec);

      // Create execution plan
      const plan = createExecutionPlan(spec);
      validateExecutionPlan(plan);

      // Merge environment variables
      const env = {
        ...process.env,
        ...spec.env,
        ...this.options.vars,
      } as Record<string, string>;

      // Execute steps in order
      for (const stepId of plan.order) {
        const step = plan.steps.find((s) => s.id === stepId);
        if (!step) {
          throw new WorkflowRuntimeError(`Step not found: ${stepId}`);
        }

        const startTime = Date.now();
        await this.executeStep(step, env);
        const duration = Date.now() - startTime;

        // Log step completion with timing and counts
        const dataset = this.datasetsByStepId[stepId];
        const count = dataset?.rows?.length || 0;
        const cacheStatus = this.getCacheStatus(stepId);
        const checkmark = '';
        console.log(
          `${checkmark}${stepId} ${duration}ms out=${count} cache:${cacheStatus}`,
        );
      }

      this.logEvent('workflow', 'completed', {});
    } catch (error) {
      this.logEvent('workflow', 'failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof WorkflowValidationError) {
        process.exit(1);
      } else if (error instanceof WorkflowRuntimeError) {
        process.exit(2);
      } else {
        process.exit(2);
      }
    }
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(
    step: StepSpec,
    env: Record<string, string>,
  ): Promise<void> {
    const startTime = Date.now();

    this.logEvent(step.id, 'started', {});

    try {
      // Create step context
      const ctx: StepCtx = {
        datasets: this.datasetsByName,
        stepOutputs: { ...this.stepOutputNames },
        env,
        vars: this.options.vars || {},
        runId: this.runId,
        dry: this.options.dry || false,
        limit: this.options.limit,
        cacheMode: this.options.cache || 'write',
        cache: this.cacheManager,
        getDataset: (ref: string) => this.resolveDataset(ref),
        getDatasetByName: (name: string) => this.datasetsByName[name],
        getDatasetByStepId: (stepId: string) => this.datasetsByStepId[stepId],
        log: (event: any) => this.logEvent(step.id, 'info', event),
      };

      // Create cache key
      const inputDatasetsHash = createInputDatasetsHash(this.datasetsByName);
      const templateVarsHash = createTemplateVarsHash(env, ctx.vars);
      const cacheKey = createCacheKey(
        step,
        inputDatasetsHash,
        templateVarsHash,
      );

      // Execute with caching
      const { result, cacheHit } = await withCache(
        this.cacheManager,
        cacheKey,
        async () => {
          const runner = getRunner(step.type, step);

          // Extract the appropriate spec portion for each runner type
          let runnerSpec: any;
          switch (step.type) {
            case 'source':
              runnerSpec = (step as any).source;
              break;
            case 'query':
            case 'output':
              runnerSpec = step;
              break;
            default:
              runnerSpec = step;
          }

          return runner.run(runnerSpec, ctx);
        },
        (event) => this.logEvent(step.id, 'cache', event),
      );

      // Store result if step produces output
      if (result && step.out) {
        const dataset = result as Dataset;
        this.datasetsByName[step.out] = dataset;
        this.datasetsByStepId[step.id] = dataset;
        this.stepOutputNames[step.id] = step.out;
      }

      const duration = Date.now() - startTime;
      const inputRows = this.getInputRowCount(step);
      const outputRows =
        result && typeof result === 'object' && 'rows' in result
          ? (result as Dataset).rows.length
          : 0;

      this.logEvent(step.id, 'completed', {
        durationMs: duration,
        inputRows,
        outputRows,
        cache: cacheHit ? 'hit' : 'miss',
        cacheKey: cacheKey,
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logEvent(step.id, 'failed', {
        durationMs: duration,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Calculate input row count for a step
   */
  private getInputRowCount(step: StepSpec): number {
    if (!step.needs || step.needs.length === 0) {
      return 0;
    }

    return step.needs.reduce((total, need) => {
      const dataset = this.datasetsByStepId[need] || this.datasetsByName[need];
      return total + (dataset?.rows.length || 0);
    }, 0);
  }

  /**
   * Resolve dataset by step id or dataset name
   */
  private resolveDataset(ref: string): Dataset | undefined {
    return this.datasetsByName[ref] || this.datasetsByStepId[ref];
  }

  /**
   * Log workflow event
   */
  private logEvent(stepId: string, event: string, data: any = {}): void {
    const workflowEvent: WorkflowEvent = {
      runId: this.runId,
      stepId,
      event: event as any,
      timestamp: Date.now(),
      ...data,
    };

    this.events.push(workflowEvent);

    // Output log based on format
    if (this.options.log === 'json') {
      console.log(JSON.stringify(workflowEvent));
    } else {
      // Pretty format (default)
      this.logPretty(workflowEvent);
    }
  }

  /**
   * Get cache status for a step
   */
  private getCacheStatus(stepId: string): string {
    // This would need to be implemented based on the actual cache logic
    // For now, return a placeholder
    return 'miss';
  }

  /**
   * Pretty log formatting
   */
  private logPretty(event: WorkflowEvent): void {
    const timestamp = new Date(event.timestamp).toLocaleTimeString();

    switch (event.event) {
      case 'started':
        if (event.stepId === 'workflow') {
          console.log(
            `${LOG_LEVELS.START} [${timestamp}] Starting workflow (${event.runId})`,
          );
        } else {
          console.log(`${LOG_LEVELS.RUN} [${timestamp}] ${event.stepId}: Starting...`);
        }
        break;

      case 'completed':
        if (event.stepId === 'workflow') {
          console.log(`${LOG_LEVELS.DONE} [${timestamp}] Workflow completed`);
        } else {
          const duration = event.durationMs ? `${event.durationMs}ms` : '';
          const inputRows = event.inputRows ? `${event.inputRows} in` : '';
          const outputRows = event.outputRows ? `${event.outputRows} out` : '';
          const cache = event.cache ? `(${event.cache})` : '';
          const cacheKey = (event as any).cacheKey
            ? `[${(event as any).cacheKey.slice(0, 8)}]`
            : '';

          const details = [duration, inputRows, outputRows, cache, cacheKey]
            .filter(Boolean)
            .join(', ');

          console.log(`${LOG_LEVELS.DONE} [${timestamp}] ${event.stepId}: ${details}`);
        }
        break;

      case 'failed':
        const duration = event.durationMs ? ` (${event.durationMs}ms)` : '';
        console.log(
          `${LOG_LEVELS.FAIL} [${timestamp}] ${event.stepId}: Failed${duration}`,
        );
        if (event.error) {
          console.log(`   Error: ${event.error}`);
        }
        break;

      case 'cache':
        // Don't log cache events in pretty mode unless debug
        break;

      case 'info':
        if ('message' in event && typeof event.message === 'string') {
          console.log(`${LOG_LEVELS.INFO} [${timestamp}] ${event.stepId}: ${event.message}`);
        } else {
          console.log(
            `${LOG_LEVELS.INFO} [${timestamp}] ${event.stepId}: ${JSON.stringify(event)}`,
          );
        }
        break;

      default:
        console.log(`${LOG_LEVELS.LOG} [${timestamp}] ${event.stepId}: ${event.event}`);
    }
  }

  /**
   * Get all events for this run
   */
  getEvents(): WorkflowEvent[] {
    return [...this.events];
  }

  /**
   * Get final datasets
   */
  getDatasets(): Record<string, Dataset> {
    return { ...this.datasetsByName };
  }
}
