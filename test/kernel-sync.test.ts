import { describe, it, expect } from 'vitest';
import { TrellisKernel } from '../src/kernel/trellis-kernel.js';
import { MockSyncProvider } from '../src/kernel/sync.js';
import { createOp } from '../src/kernel/operations.js';

describe('TrellisKernel: Synchronization', () => {
  it('should broadcast local operations through the sync provider', async () => {
    const sync = new MockSyncProvider();
    const kernel = new TrellisKernel({ sync });

    await kernel.createNode('node:1', { name: 'Alice' }, 'Person');

    expect(sync.broadcastedOps.length).toBe(1);
    expect(sync.broadcastedOps[0]?.kind).toBe('addFacts');
    expect(
      sync.broadcastedOps[0]?.facts?.some(
        (f) => f.a === 'name' && f.v === 'Alice',
      ),
    ).toBe(true);
  });

  it('should apply remote operations received from the sync provider', async () => {
    const sync = new MockSyncProvider();
    const kernel = new TrellisKernel({ sync });

    const remoteOp = await createOp('addFacts', {
      agentId: 'remote-agent',
      facts: [
        { e: 'node:2', a: 'type', v: 'Person' },
        { e: 'node:2', a: 'name', v: 'Bob' },
      ],
    });

    await sync.simulateRemoteOp(remoteOp);

    const res = await kernel.query('FIND Person AS ?p RETURN ?p.name');
    expect(res.rows.length).toBe(1);
    expect(res.rows[0]?.['?p.name']).toBe('Bob');
  });

  it('should not broadcast remote operations back to the sync provider', async () => {
    const sync = new MockSyncProvider();
    const kernel = new TrellisKernel({ sync });

    const remoteOp = await createOp('addFacts', {
      agentId: 'remote-agent',
      facts: [{ e: 'node:2', a: 'type', v: 'Person' }],
    });

    await sync.simulateRemoteOp(remoteOp);

    // Should have applied it locally but not broadcasted it back
    expect(sync.broadcastedOps.length).toBe(0);
  });
});
