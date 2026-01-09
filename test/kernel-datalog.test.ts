import { describe, it, expect } from 'vitest';
import { TrellisKernel } from '../src/kernel/trellis-kernel.js';

describe('TrellisKernel: Direct Datalog Queries', () => {
  it('should execute direct Datalog queries', async () => {
    const kernel = new TrellisKernel();
    await kernel.boot([
      { id: 1, name: 'Alice', type: 'Person' },
      { id: 2, name: 'Bob', type: 'Person' },
    ]);

    const query = {
      goals: [
        { predicate: 'attr', terms: ['?p', 'type', 'Person'] },
        { predicate: 'attr', terms: ['?p', 'name', '?name'] },
      ],
      variables: new Set(['?p', '?name']),
    };

    const res = await kernel.queryDatalog(query);
    expect(res.bindings?.length).toBe(2);

    const names = res.bindings?.map((b) => b['?name']).sort();
    expect(names).toEqual(['Alice', 'Bob']);
  });

  it('should support recursive queries via queryDatalog', async () => {
    const kernel = new TrellisKernel();

    // Setup a small hierarchy
    // Note: boot() prefixes IDs with entityType (default 'item' or provided)
    // and idKey (default 'id').
    await kernel.boot(
      [
        { id: 'ceo', name: 'CEO' },
        { id: 'vp', name: 'VP', reportsTo: 'Employee:ceo' },
        { id: 'mgr', name: 'Manager', reportsTo: 'Employee:vp' },
        { id: 'eng', name: 'Engineer', reportsTo: 'Employee:mgr' },
      ],
      { entityType: 'Employee' },
    );

    // Join query: find who reports to whom
    const query = {
      goals: [
        { predicate: 'attr', terms: ['?e1', 'name', '?n1'] },
        { predicate: 'attr', terms: ['?e1', 'reportsTo', '?e2'] },
        { predicate: 'attr', terms: ['?e2', 'name', '?n2'] },
      ],
      variables: new Set(['?n1', '?n2']),
    };

    const res = await kernel.queryDatalog(query);
    expect(res.bindings?.length).toBe(3);

    const reports = res.bindings
      ?.map((b) => `${b['?n1']} reports to ${b['?n2']}`)
      .sort();
    expect(reports).toContain('Engineer reports to Manager');
    expect(reports).toContain('Manager reports to VP');
    expect(reports).toContain('VP reports to CEO');
  });
});
