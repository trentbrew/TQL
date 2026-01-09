import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createRequire } from 'module';

import { TrellisKernel } from '../src/kernel/trellis-kernel.js';
import { SqliteKernelBackend } from '../src/persist/sqlite-backend.js';

const require = createRequire(import.meta.url);
const bunSqliteAvailable = (() => {
  try {
    require(['bun', 'sqlite'].join(':'));
    return true;
  } catch {
    return false;
  }
})();

describe('TrellisKernel Event Sourcing & Causality', () => {
  let dir: string;
  let dbPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'tql-kernel-es-'));
    dbPath = join(dir, 'kernel.sqlite');
  });

  afterEach(() => {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  const sqliteIt = bunSqliteAvailable ? it : it.skip;

  sqliteIt('should maintain a causal chain of operations', async () => {
    const backend = new SqliteKernelBackend({ filename: dbPath });
    const kernel = new TrellisKernel({ backend });

    await kernel.createNode('node:1', { name: 'Alice' }, 'Person', {
      agentId: 'user-1',
    });
    await kernel.createNode('node:2', { name: 'Bob' }, 'Person', {
      agentId: 'user-1',
    });
    await kernel.link('node:1', 'friend', 'node:2', { agentId: 'user-1' });

    const ops = backend.readAll();
    expect(ops.length).toBe(3);

    // Verify hashes exist and are unique
    const hashes = ops.map((o) => o.hash);
    expect(new Set(hashes).size).toBe(3);

    // Verify causality (linked list of hashes)
    expect(ops[0]!.previousHash).toBeUndefined();
    expect(ops[1]!.previousHash).toBe(ops[0]!.hash);
    expect(ops[2]!.previousHash).toBe(ops[1]!.hash);

    // Verify metadata
    expect(ops[0]!.agentId).toBe('user-1');
    expect(ops[0]!.kind).toBe('addFacts');
    expect(ops[2]!.kind).toBe('addLinks');
  });

  sqliteIt(
    'should apply remote operations and maintain local causality',
    async () => {
      const backend = new SqliteKernelBackend({ filename: dbPath });
      const kernel = new TrellisKernel({ backend });

      // 1. Local op
      await kernel.createNode('node:1', { name: 'Alice' }, 'Person');
      const op1 = backend.getLastOp()!;

      // 2. Remote op (received from another agent)
      // In a real scenario, this would come over the wire
      const remoteOp = {
        hash: 'trellis:op:remote-hash',
        kind: 'addFacts' as const,
        timestamp: new Date().toISOString(),
        agentId: 'remote-agent',
        previousHash: 'some-remote-prev', // causality in the remote chain
        facts: [
          { e: 'node:2', a: 'type', v: 'Person' },
          { e: 'node:2', a: 'name', v: 'Bob' },
        ],
      };

      await kernel.applyRemoteOperation(remoteOp);
      const op2 = backend.getLastOp()!;
      expect(op2.hash).toBe(remoteOp.hash);
      expect(op2.agentId).toBe('remote-agent');

      // 3. Next local op should link to the last applied op (even if remote)
      await kernel.link('node:1', 'friend', 'node:2');
      const op3 = backend.getLastOp()!;
      expect(op3.previousHash).toBe(remoteOp.hash);

      // Verify state
      const res = await kernel.query('FIND Person AS ?p RETURN ?p.name');
      expect(res.rows.length).toBe(2);
    },
  );
});
