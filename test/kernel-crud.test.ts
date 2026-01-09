import { describe, it, expect } from 'vitest';
import { TrellisKernel } from '../src/kernel/trellis-kernel.js';
import { createOp } from '../src/kernel/operations.js';

describe('TrellisKernel Phase 3: CRUD API', () => {
  it('should create and delete nodes', async () => {
    const kernel = new TrellisKernel();

    // Create
    await kernel.createNode('node:1', { name: 'Alice', age: 30 }, 'Person');

    let res = await kernel.query('FIND Person AS ?p RETURN ?p.name, ?p.age');
    expect(res.rows.length).toBe(1);
    expect(res.rows[0]?.['?p.name']).toBe('Alice');

    // Delete
    await kernel.deleteNode('node:1');
    res = await kernel.query('FIND Person AS ?p RETURN ?p.name');
    expect(res.rows.length).toBe(0);
  });

  it('should create and delete links', async () => {
    const kernel = new TrellisKernel();

    await kernel.createNode('node:1', { name: 'Alice' }, 'Person');
    await kernel.createNode('node:2', { name: 'Bob' }, 'Person');

    // Link
    await kernel.link('node:1', 'friend', 'node:2');

    // We don't have a direct link query in EQL-S yet (it's mostly attribute based)
    // but we can check the store directly
    expect(kernel.getStore().getLinksByEntity('node:1').length).toBe(1);

    // Delete Link
    const op = await createOp('deleteLinks', {
      agentId: 'test',
      links: [{ e1: 'node:1', a: 'friend', e2: 'node:2' }],
    });
    await kernel.mutate(op);
    expect(kernel.getStore().getLinksByEntity('node:1').length).toBe(0);
  });

  it('should update nodes (overwrite facts)', async () => {
    const kernel = new TrellisKernel();

    await kernel.createNode('node:1', { status: 'active' }, 'Item');
    await kernel.updateNode('node:1', { status: 'completed' }, 'Item');

    const res = await kernel.query('FIND Item AS ?i RETURN ?i.status');
    // Note: Our current EAVStore.addFacts appends.
    // EQL-S usually returns the latest or all if not deduped.
    // In our TrellisKernel.query, we dedupe rows.
    expect(res.rows.length).toBe(1);
    expect(res.rows[0]?.['?i.status']).toBe('completed');
  });
});
