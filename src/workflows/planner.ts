/**
 * Workflow execution planner
 *
 * Performs topological sort, validates dependencies, and creates execution plan.
 * Ensures source steps without dependencies run first.
 */

import type { WorkflowSpec, StepSpec, ExecutionPlan } from './types.js';
import { WorkflowValidationError } from './types.js';

/**
 * Create execution plan with topologically sorted steps
 */
export function createExecutionPlan(spec: WorkflowSpec): ExecutionPlan {
  const steps = spec.steps;
  const stepMap = new Map<string, StepSpec>();

  // Index steps by ID
  for (const step of steps) {
    stepMap.set(step.id, step);
  }

  // Validate needs references before topological sort
  validateNeedsReferences(steps);

  // Perform topological sort
  const order = topologicalSort(steps);

  return {
    steps,
    order,
  };
}

/**
 * Validate that needs references are step IDs, not dataset names
 */
function validateNeedsReferences(steps: StepSpec[]): void {
  const stepIds = new Set(steps.map((s) => s.id));
  const outputs = new Map(
    steps.map((s) => [s.out, s.id]).filter(([out, id]) => out && id) as [string, string][],
  );

  for (const step of steps) {
    for (const need of step.needs ?? []) {
      if (!stepIds.has(need)) {
        let hint = '';
        if (outputs.has(need)) {
          hint = ` Did you mean step id "${outputs.get(need)}"?`;
        } else {
          const stepList = Array.from(stepIds).join(', ');
          const datasetList = Array.from(outputs.keys()).join(', ');
          hint = ` Steps: ${stepList}. Datasets: ${datasetList}.`;
        }
        throw new WorkflowValidationError(
          `Step ${step.id} depends on unknown step: ${need}.${hint}`,
          step.id,
        );
      }
    }
  }
}

/**
 * Topological sort using Kahn's algorithm
 * Ensures dependencies are satisfied before execution
 */
function topologicalSort(steps: StepSpec[]): string[] {
  const graph = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  const result: string[] = [];

  // Initialize graph and in-degree counts
  for (const step of steps) {
    graph.set(step.id, []);
    inDegree.set(step.id, 0);
  }

  // Build dependency graph
  for (const step of steps) {
    const dependencies = step.needs || [];
    for (const dep of dependencies) {
      if (!graph.has(dep)) {
        throw new WorkflowValidationError(
          `Step ${step.id} depends on unknown step: ${dep}`,
          step.id,
        );
      }
      graph.get(dep)!.push(step.id);
      inDegree.set(step.id, (inDegree.get(step.id) || 0) + 1);
    }
  }

  // Find steps with no dependencies (source steps without needs)
  const queue: string[] = [];
  for (const [stepId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(stepId);
    }
  }

  // Process queue
  while (queue.length > 0) {
    // Sort queue to prioritize source steps
    queue.sort((a, b) => {
      const stepA = steps.find((s) => s.id === a)!;
      const stepB = steps.find((s) => s.id === b)!;

      // Source steps first
      if (stepA.type === 'source' && stepB.type !== 'source') return -1;
      if (stepB.type === 'source' && stepA.type !== 'source') return 1;

      // Then alphabetical
      return a.localeCompare(b);
    });

    const current = queue.shift()!;
    result.push(current);

    // Update in-degrees of dependent steps
    const dependents = graph.get(current) || [];
    for (const dependent of dependents) {
      const newDegree = (inDegree.get(dependent) || 0) - 1;
      inDegree.set(dependent, newDegree);

      if (newDegree === 0) {
        queue.push(dependent);
      }
    }
  }

  // Check for cycles
  if (result.length !== steps.length) {
    const remaining = steps
      .filter((step) => !result.includes(step.id))
      .map((step) => step.id);

    // Find minimal cycle
    const cycle = findMinimalCycle(remaining, graph);
    const cycleStr = cycle ? cycle.join(' → ') : remaining.join(', ');

    throw new WorkflowValidationError(
      `Workflow has circular dependencies: ${cycleStr}`,
    );
  }

  return result;
}

/**
 * Find minimal cycle in dependency graph
 */
function findMinimalCycle(
  remaining: string[],
  graph: Map<string, string[]>,
): string[] | null {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): string[] | null {
    if (recursionStack.has(node)) {
      // Found a cycle, extract it
      const cycleStart = path.indexOf(node);
      return path.slice(cycleStart).concat([node]);
    }

    if (visited.has(node)) {
      return null;
    }

    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const dependencies = graph.get(node) || [];
    for (const dep of dependencies) {
      if (remaining.includes(dep)) {
        const cycle = dfs(dep);
        if (cycle) {
          return cycle;
        }
      }
    }

    path.pop();
    recursionStack.delete(node);
    return null;
  }

  for (const node of remaining) {
    if (!visited.has(node)) {
      const cycle = dfs(node);
      if (cycle) {
        return cycle;
      }
    }
  }

  return null;
}

/**
 * Validate execution plan semantics
 */
export function validateExecutionPlan(plan: ExecutionPlan): void {
  const { steps, order } = plan;
  const stepMap = new Map(steps.map((s) => [s.id, s]));
  const availableDatasets = new Set<string>();

  // Validate execution order
  for (const stepId of order) {
    const step = stepMap.get(stepId);
    if (!step) {
      throw new WorkflowValidationError(`Step not found in plan: ${stepId}`);
    }

    // Check dependencies are satisfied
    const dependencies = step.needs || [];
    for (const dep of dependencies) {
      const depStep = stepMap.get(dep);
      if (!depStep || !depStep.out) {
        throw new WorkflowValidationError(
          `Step ${stepId} depends on ${dep} which doesn't produce output`,
          stepId,
        );
      }

      if (!availableDatasets.has(depStep.out)) {
        throw new WorkflowValidationError(
          `Step ${stepId} depends on dataset ${depStep.out} which is not yet available`,
          stepId,
        );
      }
    }

    // Validate step-specific requirements
    validateStepRequirements(step, availableDatasets);

    // Add output dataset if step produces one
    if (step.out) {
      availableDatasets.add(step.out);
    }
  }
}

/**
 * Validate step-specific requirements
 */
function validateStepRequirements(
  step: StepSpec,
  availableDatasets: Set<string>,
): void {
  switch (step.type) {
    case 'source':
      if (step.source.mode === 'map') {
        const mapFrom = step.source.mapFrom;
        if (!mapFrom || !availableDatasets.has(mapFrom)) {
          throw new WorkflowValidationError(
            `Step ${step.id} map mode requires dataset ${mapFrom} to be available`,
            step.id,
          );
        }
      }
      break;

    case 'query':
      // Validate 'from' dataset if specified
      if (step.from && !availableDatasets.has(step.from)) {
        throw new WorkflowValidationError(
          `Step ${step.id} references unavailable dataset: ${step.from}`,
          step.id,
        );
      }
      break;

    case 'output':
      // Output steps are validated by dependency checking
      break;
  }
}

/**
 * Get step dependencies in execution order
 */
export function getStepDependencies(
  step: StepSpec,
  plan: ExecutionPlan,
): StepSpec[] {
  const { steps, order } = plan;
  const stepMap = new Map(steps.map((s) => [s.id, s]));
  const dependencies: StepSpec[] = [];

  const stepIndex = order.indexOf(step.id);
  if (stepIndex === -1) {
    throw new WorkflowValidationError(
      `Step ${step.id} not found in execution plan`,
    );
  }

  // Get all dependencies that execute before this step
  for (let i = 0; i < stepIndex; i++) {
    const stepIdAtIndex = order[i];
    if (!stepIdAtIndex) continue;

    const depStep = stepMap.get(stepIdAtIndex);
    if (depStep && (step.needs || []).includes(depStep.id)) {
      dependencies.push(depStep);
    }
  }

  return dependencies;
}

/**
 * Get parallel execution groups
 * Steps in the same group can run concurrently
 */
export function getParallelGroups(plan: ExecutionPlan): StepSpec[][] {
  const { steps, order } = plan;
  const stepMap = new Map(steps.map((s) => [s.id, s]));
  const groups: StepSpec[][] = [];
  const processed = new Set<string>();

  for (const stepId of order) {
    if (processed.has(stepId)) continue;

    const step = stepMap.get(stepId)!;
    const group = [step];
    processed.add(stepId);

    // Find other steps that can run in parallel
    for (const otherStepId of order) {
      if (processed.has(otherStepId)) continue;

      const otherStep = stepMap.get(otherStepId)!;

      // Check if steps can run in parallel
      if (canRunInParallel(step, otherStep, stepMap)) {
        group.push(otherStep);
        processed.add(otherStepId);
      }
    }

    groups.push(group);
  }

  return groups;
}

/**
 * Check if two steps can run in parallel
 */
function canRunInParallel(
  stepA: StepSpec,
  stepB: StepSpec,
  stepMap: Map<string, StepSpec>,
): boolean {
  // Steps cannot run in parallel if one depends on the other
  const depsA = new Set(stepA.needs || []);
  const depsB = new Set(stepB.needs || []);

  if (depsA.has(stepB.id) || depsB.has(stepA.id)) {
    return false;
  }

  // Steps cannot run in parallel if one depends on output of the other
  if (stepA.out && depsB.has(stepA.id)) return false;
  if (stepB.out && depsA.has(stepB.id)) return false;

  // Map mode steps cannot run in parallel with their mapFrom source
  if (stepA.type === 'source' && stepA.source.mode === 'map') {
    if (stepA.source.mapFrom === stepB.out) return false;
  }
  if (stepB.type === 'source' && stepB.source.mode === 'map') {
    if (stepB.source.mapFrom === stepA.out) return false;
  }

  return true;
}
