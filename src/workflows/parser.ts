/**
 * Workflow parser with templating engine
 *
 * Parses YAML workflow files and handles template interpolation for:
 * - ${{ env.KEY }} - environment variables
 * - ${{ var.NAME }} - CLI variables (--var)
 * - ${{ row.attr }} - row attributes (map mode only)
 */

import { parse } from 'yaml';
import Ajv from 'ajv';
import { WORKFLOW_SCHEMA } from './schema.js';
import type { WorkflowSpec } from './types.js';
import { WorkflowValidationError } from './types.js';

const ajv = new Ajv({ allErrors: true });
const validateWorkflow = ajv.compile(WORKFLOW_SCHEMA);

/**
 * Template context for variable interpolation
 */
export type TemplateContext = {
  env: Record<string, string>;
  vars: Record<string, string>;
  row?: Record<string, any>; // Only available in map mode
};

/**
 * Parse and validate a workflow YAML file
 */
export function parseWorkflow(yamlContent: string): WorkflowSpec {
  try {
    const spec = parse(yamlContent, {
      prettyErrors: true,
      strict: true,
    });

    if (!validateWorkflow(spec)) {
      const errors =
        validateWorkflow.errors
          ?.map((err) => {
            const path = err.instancePath || err.schemaPath;
            const message = err.message;
            return `${path}: ${message}`;
          })
          .join('; ') || 'Unknown validation error';
      throw new WorkflowValidationError(
        `Workflow validation failed: ${errors}`,
      );
    }

    return spec as WorkflowSpec;
  } catch (error) {
    if (error instanceof Error) {
      // Check if it's a YAML parsing error with position info
      if (error.message.includes('line') && error.message.includes('column')) {
        throw new WorkflowValidationError(
          `YAML parsing failed: ${error.message}`,
        );
      }
      throw new WorkflowValidationError(
        `Failed to parse workflow: ${error.message}`,
      );
    }
    throw new WorkflowValidationError(
      'Failed to parse workflow: Unknown error',
    );
  }
}

/**
 * Interpolate template variables in a string
 *
 * Supports:
 * - ${{ env.KEY }} - environment variables
 * - ${{ var.NAME }} - CLI variables
 * - ${{ row.attr }} - row attributes (map mode only)
 * - ${{ secrets.KEY }} - alias for env.KEY (for YAML readability)
 */
export function interpolateTemplate(
  template: string,
  context: TemplateContext,
  options: { urlEncode?: boolean } = {},
): string {
  // Support both ${{}} and {{}} formats
  return template.replace(/(\$)?\{\{\s*([^}]+)\s*\}\}/g, (match, dollar, expression) => {
    const trimmed = expression.trim();

    // Guard against prototype pollution
    if (trimmed.includes('__proto__') || trimmed.includes('constructor') || trimmed.includes('prototype')) {
      throw new Error(`Invalid template expression (security): ${trimmed}`);
    }

    let value: string;

    // Handle env.KEY and secrets.KEY (both resolve to env)
    if (trimmed.startsWith('env.') || trimmed.startsWith('secrets.')) {
      const key = trimmed.split('.').slice(1).join('.');
      const envValue = context.env[key];
      if (envValue === undefined) {
        throw new Error(`Environment variable not found: ${key}`);
      }
      value = envValue;
    }
    // Handle var.NAME
    else if (trimmed.startsWith('var.')) {
      const key = trimmed.substring(4);
      const varValue = context.vars[key];
      if (varValue === undefined) {
        throw new Error(`Variable not found: ${key}`);
      }
      value = varValue;
    }
    // Handle row.attr (map mode only)
    else if (trimmed.startsWith('row.')) {
      if (!context.row) {
        throw new Error('Row variables are only available in map mode');
      }
      const path = trimmed.substring(4);
      const rowValue = getNestedValue(context.row, path);
      if (rowValue === undefined) {
        throw new Error(`Row attribute not found: ${path}`);
      }
      value = String(rowValue);
    }
    else {
      throw new Error(`Invalid template expression: ${trimmed}`);
    }

    // Apply URL encoding if requested
    return options.urlEncode ? encodeURIComponent(value) : value;
  });
}

/**
 * Recursively interpolate templates in an object
 */
export function interpolateObject<T>(obj: T, context: TemplateContext): T {
  if (typeof obj === 'string') {
    return interpolateTemplate(obj, context) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => interpolateObject(item, context)) as T;
  }

  if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = interpolateObject(value, context);
    }
    return result;
  }

  return obj;
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  // Guard against prototype pollution attacks
  const parts = path.split('.');
  for (const part of parts) {
    if (part === '__proto__' || part === 'constructor' || part === 'prototype') {
      throw new Error(`Invalid property access (security): ${part}`);
    }
  }

  return parts.reduce((current, key) => {
    return current && typeof current === 'object' ? current[key] : undefined;
  }, obj);
}

/**
 * Validate workflow semantic rules beyond JSON schema
 */
export function validateWorkflowSemantics(spec: WorkflowSpec): void {
  const stepIds = new Set<string>();
  const outputs = new Set<string>();

  // Check for duplicate step IDs and output names
  const outputNames = new Set<string>();
  for (const step of spec.steps) {
    if (stepIds.has(step.id)) {
      throw new WorkflowValidationError(`Duplicate step ID: ${step.id}`);
    }
    stepIds.add(step.id);

    if (step.out) {
      if (outputNames.has(step.out)) {
        throw new WorkflowValidationError(
          `duplicate output name: ${step.out}`,
          step.id,
        );
      }

      // Check if output name matches a step ID (potential collision)
      if (stepIds.has(step.out)) {
        throw new WorkflowValidationError(
          `Output name "${step.out}" conflicts with step ID. Use different names to avoid ambiguity.`,
          step.id,
        );
      }

      outputNames.add(step.out);
      outputs.add(step.out);
    }
  }

  // Check dependencies and detect cycles
  const graph = new Map<string, string[]>();
  for (const step of spec.steps) {
    graph.set(step.id, step.needs || []);

    // Validate mapFrom references
    if (step.type === 'source' && step.source.mode === 'map') {
      if (!step.source.mapFrom || !outputs.has(step.source.mapFrom)) {
        throw new WorkflowValidationError(
          `Step ${step.id} map mode requires valid mapFrom dataset`,
          step.id,
        );
      }
    }

    // Validate from references
    if (step.type === 'query' && step.from) {
      if (!outputs.has(step.from)) {
        throw new WorkflowValidationError(
          `Step ${step.id} references unknown dataset: ${step.from}`,
          step.id,
        );
      }
    }
  }

  // Detect cycles using DFS
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(nodeId: string): boolean {
    if (recursionStack.has(nodeId)) {
      return true;
    }
    if (visited.has(nodeId)) {
      return false;
    }

    visited.add(nodeId);
    recursionStack.add(nodeId);

    const dependencies = graph.get(nodeId) || [];
    for (const dep of dependencies) {
      if (hasCycle(dep)) {
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  for (const stepId of stepIds) {
    if (hasCycle(stepId)) {
      throw new WorkflowValidationError(
        'Circular dependency detected in workflow',
      );
    }
  }
}
