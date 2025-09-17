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
    const spec = parse(yamlContent);
    
    if (!validateWorkflow(spec)) {
      const errors = validateWorkflow.errors
        ?.map(err => `${err.schemaPath}: ${err.message}`)
        .join('; ') || 'Unknown validation error';
      throw new Error(`Workflow validation failed: ${errors}`);
    }
    
    return spec as WorkflowSpec;
  } catch (error) {
    if (error instanceof Error) {
      throw new WorkflowValidationError(`Failed to parse workflow: ${error.message}`);
    }
    throw new WorkflowValidationError('Failed to parse workflow: Unknown error');
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
  context: TemplateContext
): string {
  return template.replace(/\$\{\{\s*([^}]+)\s*\}\}/g, (match, expression) => {
    const trimmed = expression.trim();
    
    // Handle env.KEY and secrets.KEY (both resolve to env)
    if (trimmed.startsWith('env.') || trimmed.startsWith('secrets.')) {
      const key = trimmed.split('.').slice(1).join('.');
      const value = context.env[key];
      if (value === undefined) {
        throw new Error(`Environment variable not found: ${key}`);
      }
      return value;
    }
    
    // Handle var.NAME
    if (trimmed.startsWith('var.')) {
      const key = trimmed.substring(4);
      const value = context.vars[key];
      if (value === undefined) {
        throw new Error(`Variable not found: ${key}`);
      }
      return value;
    }
    
    // Handle row.attr (map mode only)
    if (trimmed.startsWith('row.')) {
      if (!context.row) {
        throw new Error('Row variables are only available in map mode');
      }
      const path = trimmed.substring(4);
      const value = getNestedValue(context.row, path);
      if (value === undefined) {
        throw new Error(`Row attribute not found: ${path}`);
      }
      return String(value);
    }
    
    throw new Error(`Invalid template expression: ${trimmed}`);
  });
}

/**
 * Recursively interpolate templates in an object
 */
export function interpolateObject<T>(
  obj: T, 
  context: TemplateContext
): T {
  if (typeof obj === 'string') {
    return interpolateTemplate(obj, context) as T;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => interpolateObject(item, context)) as T;
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
  return path.split('.').reduce((current, key) => {
    return current && typeof current === 'object' ? current[key] : undefined;
  }, obj);
}

/**
 * Validate workflow semantic rules beyond JSON schema
 */
export function validateWorkflowSemantics(spec: WorkflowSpec): void {
  const stepIds = new Set<string>();
  const outputs = new Set<string>();
  
  // Check for duplicate step IDs
  for (const step of spec.steps) {
    if (stepIds.has(step.id)) {
      throw new WorkflowValidationError(`Duplicate step ID: ${step.id}`);
    }
    stepIds.add(step.id);
    
    if (step.out) {
      outputs.add(step.out);
    }
  }
  
  // Check dependencies and detect cycles
  const graph = new Map<string, string[]>();
  for (const step of spec.steps) {
    graph.set(step.id, step.needs || []);
    
    // Validate that all dependencies exist
    for (const need of step.needs || []) {
      if (!stepIds.has(need)) {
        throw new WorkflowValidationError(
          `Step ${step.id} depends on unknown step: ${need}`,
          step.id
        );
      }
    }
    
    // Validate mapFrom references
    if (step.type === 'source' && step.source.mode === 'map') {
      if (!step.source.mapFrom || !outputs.has(step.source.mapFrom)) {
        throw new WorkflowValidationError(
          `Step ${step.id} map mode requires valid mapFrom dataset`,
          step.id
        );
      }
    }
    
    // Validate from references
    if (step.type === 'query' && step.from) {
      if (!outputs.has(step.from)) {
        throw new WorkflowValidationError(
          `Step ${step.id} references unknown dataset: ${step.from}`,
          step.id
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
      throw new WorkflowValidationError('Circular dependency detected in workflow');
    }
  }
}