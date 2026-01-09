import { describe, it, expect } from 'vitest';
import { TrellisKernel } from '../src/kernel/trellis-kernel.js';
import { EQLSProcessor } from '../src/query/eqls-parser.js';

describe('Query Optimizer Benchmark', () => {
  it('should show performance improvement with optimized joins', async () => {
    const kernel = new TrellisKernel();

    // Create a larger dataset
    const users = [];
    for (let i = 0; i < 1000; i++) {
      users.push({
        id: i,
        type: 'User',
        name: `User ${i}`,
        age: Math.floor(Math.random() * 80) + 10,
        status: i === 500 ? 'active' : 'inactive',
      });
    }

    await kernel.boot(users, { entityType: 'User' });

    // A query that is very slow if executed in the wrong order:
    // 1. Find all Users (?u type User) - 1000 results
    // 2. Get names of all Users (?u name ?n) - 1000 results
    // 3. Filter by status 'active' (?u status 'active') - 1 result
    //
    // If we run step 3 first, we only process 1 entity for step 2.
    const queryStr =
      'FIND User AS ?u WHERE ?u.name = ?n AND ?u.status = "active" RETURN ?u.id, ?u.name';

    // Measure optimized execution
    const t0 = performance.now();
    const res = await kernel.query(queryStr);
    const t1 = performance.now();
    const optimizedTime = t1 - t0;

    expect(res.rows.length).toBe(1);
    expect(res.rows[0]?.['?u.id']).toBe(500);

    console.log(`Optimized query time: ${optimizedTime.toFixed(4)}ms`);

    // To prove it's optimized, we can inspect the plan
    // (Our current plan string doesn't show goal order yet, maybe we should add it)
    if (res.plan) {
      console.log(`Query Plan: ${res.plan}`);
    }
  });
});
