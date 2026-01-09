import { describe, it, expect } from 'vitest';
import { TrellisKernel } from '../src/kernel/trellis-kernel.js';

describe('TrellisKernel: Query Debugger & Explain', () => {
  it('should return a trace of execution metrics for each goal', async () => {
    const kernel = new TrellisKernel();
    await kernel.boot([
      { id: 1, name: 'Alice', type: 'Person' },
      { id: 2, name: 'Bob', type: 'Person' },
    ]);

    const res = await kernel.query('FIND Person AS ?p RETURN ?p.name');

    expect(res.trace).toBeDefined();
    expect(res.trace?.length).toBeGreaterThan(0);

    // Check first goal (type lookup)
    const typeGoal = res.trace?.find((t) => t.goal.includes('type'));
    expect(typeGoal).toBeDefined();
    expect(typeGoal?.bindingsCount).toBe(2);
    expect(typeof typeGoal?.durationMs).toBe('number');

    // Check name lookup goal
    const nameGoal = res.trace?.find((t) => t.goal.includes('name'));
    expect(nameGoal).toBeDefined();
    expect(nameGoal?.bindingsCount).toBe(2);
  });
});
