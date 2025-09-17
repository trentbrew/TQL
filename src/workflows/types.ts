/**
 * Core types for TQL Workflow Engine
 * 
 * Minimal, shippable MVP for `tql workflow run` command.
 * Supports source (HTTP), query (EQL-S), and output (file/stdout) steps.
 */

export type Dataset = {
  name: string;
  rows: any[];
};

export type StepCtx = {
  datasets: Record<string, Dataset>;
  stepOutputs: Record<string, string | undefined>;
  env: Record<string, string>;
  vars: Record<string, string>;
  runId: string;
  dry: boolean;
  limit?: number;
  cacheMode: "read" | "write" | "off";
  cache: {
    get: (key: string) => Promise<Dataset | null>;
    set: (key: string, dataset: Dataset) => Promise<void>;
  };
  getDataset: (ref: string) => Dataset | undefined;
  getDatasetByName: (name: string) => Dataset | undefined;
  getDatasetByStepId: (stepId: string) => Dataset | undefined;
  log: (event: any) => void;
};

export interface Runner<TSpec = any> {
  validate(spec: TSpec): void;
  run(spec: TSpec, ctx: StepCtx): Promise<Dataset | void>;
}

// Workflow specification types
export type WorkflowSpec = {
  version: 1;
  name: string;
  env?: Record<string, string>;
  steps: StepSpec[];
};

export type StepSpec = {
  id: string;
  type: "source" | "query" | "output";
  needs?: string[];
  out?: string;
} & (SourceStepSpec | QueryStepSpec | OutputStepSpec);

export type SourceStepSpec = {
  type: "source";
  source: HttpSourceSpec;
  out: string;
};

export type HttpSourceSpec = {
  kind: "http";
  url: string;
  headers?: Record<string, string>;
  mode: "batch" | "map";
  mapFrom?: string; // required when mode=map
};

export type QueryStepSpec = {
  type: "query";
  needs: string[];
  from?: string; // optional; defaults to union(needs)
  eqls: string;
  out: string;
};

export type OutputStepSpec = {
  type: "output";
  needs: string[];
  output: FileOutputSpec | StdoutOutputSpec;
};

export type FileOutputSpec = {
  kind: "file";
  format: "json" | "csv";
  path: string;
};

export type StdoutOutputSpec = {
  kind: "stdout";
  format: "json" | "csv";
};

// CLI configuration
export type WorkflowRunOptions = {
  dry?: boolean;
  watch?: boolean;
  limit?: number;
  vars?: Record<string, string>;
  cache?: "read" | "write" | "off";
  log?: "pretty" | "json";
  out?: string;
};

// Execution context
export type ExecutionPlan = {
  steps: StepSpec[];
  order: string[]; // topologically sorted step IDs
};

// Events for logging
export type WorkflowEvent = {
  runId: string;
  stepId: string;
  event: "started" | "completed" | "failed" | "cache" | "info";
  timestamp: number;
  durationMs?: number;
  inputRows?: number;
  outputRows?: number;
  cache?: "hit" | "miss" | "write" | "off";
  error?: string;
};

// Validation errors
export class WorkflowValidationError extends Error {
  constructor(message: string, public stepId?: string) {
    super(message);
    this.name = "WorkflowValidationError";
  }
}

export class WorkflowRuntimeError extends Error {
  constructor(message: string, public stepId?: string) {
    super(message);
    this.name = "WorkflowRuntimeError";
  }
}
