import { describe, it, expect } from 'vitest';
import { TrellisKernel } from '../src/kernel/trellis-kernel.js';

// These tests verify query semantics that must match VISION.md:
// - OR semantics is a union of branches (DNF)
// - ORDER BY and LIMIT are enforced at the query level

describe('TrellisKernel query semantics', () => {
  it('should treat OR as union (deduped)', async () => {
    const kernel2 = new TrellisKernel();
    await kernel2.boot(
      [
        { id: 1, status: 'active' },
        { id: 2, status: 'planning' },
        { id: 3, status: 'done' },
      ],
      { entityType: 'item', idKey: 'id' },
    );

    const res = await kernel2.query(
      'FIND item AS ?e WHERE ?e.status = "active" OR ?e.status = "planning" RETURN ?e.id, ?e.status',
    );

    expect(res.rows.length).toBe(2);

    const ids = res.rows.map((r) => r['?e.id']).sort();
    expect(ids).toEqual([1, 2]);

    const keys = Object.keys(res.rows[0] || {});
    expect(keys).toContain('?e.id');
    expect(keys).toContain('?e.status');
  });

  it('should enforce ORDER BY and LIMIT', async () => {
    const kernel = new TrellisKernel();
    await kernel.boot(
      [
        { id: 3, title: 'c' },
        { id: 1, title: 'a' },
        { id: 2, title: 'b' },
      ],
      { entityType: 'item', idKey: 'id' },
    );

    const res = await kernel.query(
      'FIND item AS ?e RETURN ?e.id, ?e.title ORDER BY ?e.id ASC LIMIT 2',
    );

    expect(res.rows.length).toBe(2);
    expect(res.rows[0]!['?e.id']).toBe(1);
    expect(res.rows[1]!['?e.id']).toBe(2);
  });
});
