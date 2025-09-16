# Tree-of-Thought (ToT) Planner

The Tree-of-Thought planner is an optional enhancement to the AI orchestrator that uses a cost-efficient model to generate multiple planning approaches, evaluate them, and select the best one before executing the main task.

## Overview

The ToT planner implements a "think step" that:

1. **Generates** multiple planning approaches using a smaller, cheaper model
2. **Evaluates** the plans using the same model acting as a judge
3. **Selects** the best plan based on correctness, clarity, and feasibility
4. **Optionally revises** the original prompt based on the selected plan

## Configuration

Add these options to enable the ToT planner:

```typescript
const result = await orchestrate(userPrompt, {
  useToT: true, // Enable ToT planning
  plannerModel: 'gpt-4o-mini', // Model for planning (cheaper than main)
  numThoughts: 3, // Number of plans to generate (2-8)
});
```

### Options

- **`useToT`** (boolean, default: false): Enable/disable ToT planning
- **`plannerModel`** (string, default: 'gpt-4o-mini'): Model used for planning
- **`numThoughts`** (number, default: 3): Number of plans to generate (2-8)

## When ToT Planning is Triggered

The planner is automatically triggered when:

- `useToT` is enabled AND
- The intent is `'task'` OR
- The intent is `'question'` with complexity `'complex'` OR
- The prompt contains planning keywords (`plan`, `design`, `evaluate`)

## Plan Structure

Each generated plan includes:

```typescript
interface Plan {
  rationale: string; // Why this approach was chosen
  steps: string[]; // Actionable steps to follow
  assumptions?: string[]; // Key assumptions made
  risks?: string[]; // Potential risks or challenges
  revisedPrompt?: string; // Improved version of original prompt
  toolHints?: string[]; // Hints for tool selection/routing
}
```

## Response Structure

When ToT planning is used, the response includes planning information:

```typescript
{
  status: 'ok',
  meta: { /* classification metadata */ },
  payload: {
    // ... standard response fields
    planning?: {
      winningIndex: number;      // Index of selected plan (0-based)
      reason: string;           // Why this plan was selected
      plan: Plan;              // The selected plan details
      allPlansCount: number;   // Total number of plans generated
    }
  }
}
```

## Example Usage

```typescript
import { orchestrate } from './src/ai/orchestrator';

// Complex task that will trigger ToT planning
const result = await orchestrate(
  'Design a comprehensive marketing strategy for a new AI app targeting remote workers',
  {
    useToT: true,
    plannerModel: 'gpt-4o-mini',
    numThoughts: 3,
  },
);

if (result.status === 'ok' && result.payload.planning) {
  console.log('Selected plan:', result.payload.planning.plan.rationale);
  console.log('Steps:', result.payload.planning.plan.steps);
  console.log('Selection reason:', result.payload.planning.reason);
}
```

## Cost Optimization

The ToT planner is designed to be cost-efficient:

- **Cheaper Model**: Uses `gpt-4o-mini` by default instead of larger models
- **Limited Plans**: Generates only 3 plans by default (configurable 2-8)
- **Selective Activation**: Only runs for complex tasks that benefit from planning
- **Fallback Handling**: Gracefully handles failures without breaking the main flow

## Error Handling

The planner includes robust error handling:

- **Plan Generation Failures**: Returns a fallback plan if individual plan generation fails
- **Evaluation Failures**: Uses the first generated plan if evaluation fails
- **Schema Validation**: Handles schema mismatches gracefully
- **Non-blocking**: Planning failures don't prevent main task execution

## Demo

Run the demo to see the ToT planner in action:

```bash
bun run demo:tot
```

This will demonstrate:

- Complex task that triggers planning
- Simple task that skips planning
- Planning information in the response
- Cost-efficient execution

## Best Practices

1. **Use for Complex Tasks**: Enable ToT for multi-step, strategic, or analytical tasks
2. **Keep Simple Tasks Simple**: Don't enable ToT for basic questions or simple requests
3. **Monitor Performance**: Track planning success rates and response quality
4. **Adjust Parameters**: Tune `numThoughts` based on task complexity and cost constraints
5. **Review Plans**: Use planning information to understand the AI's reasoning process

## Implementation Details

The ToT planner consists of:

- **`proposePlan()`**: Generates individual plans using the planner model
- **`runToT()`**: Orchestrates the full ToT process (generate → evaluate → select)
- **Integration**: Seamlessly integrated into the main `orchestrate()` function
- **Schema Validation**: Uses Zod schemas for type-safe plan generation and evaluation

The implementation is designed to be:

- **Non-intrusive**: Doesn't change the main orchestration flow
- **Configurable**: Easy to enable/disable and customize
- **Observable**: Provides detailed planning information for debugging
- **Resilient**: Handles errors gracefully without breaking the main flow
