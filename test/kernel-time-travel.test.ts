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

describe('TrellisKernel: Time-Travel Queries', () => {
  let dir: string;
  let dbPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'tql-kernel-tt-'));
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

  sqliteIt('should query the state at a specific operation hash', async () => {
    const backend = new SqliteKernelBackend({ filename: dbPath });
    const kernel = new TrellisKernel({ backend });

    // 1. Create a node
    await kernel.createNode('node:1', { val: 10 }, 'Item');
    const op1 = backend.getLastOp()!;

    // 2. Update the node
    await kernel.updateNode('node:1', { val: 20 }, 'Item');
    const op2 = backend.getLastOp()!;

    // 3. Current state should be 20
    const resNow = await kernel.query('FIND Item AS ?i RETURN ?i.val');
    expect(resNow.rows[0]?.['?i.val']).toBe(20);

    // 4. Query at op1 should be 10
    const resPast = await kernel.query('FIND Item AS ?i RETURN ?i.val', {
      atHash: op1.hash,
    });
    expect(resPast.rows[0]?.['?i.val']).toBe(10);
  });

  sqliteIt('should query the state at a specific timestamp', async () => {
    const backend = new SqliteKernelBackend({ filename: dbPath });
    const kernel = new TrellisKernel({ backend });

    // 1. Create a node
    await kernel.createNode('node:1', { status: 'created' }, 'Item');
    const t1 = new Date().toISOString();

    // Wait a bit to ensure timestamp difference
    await new Promise((r) => setTimeout(r, 100));

    // 2. Update the node
    await kernel.updateNode('node:1', { status: 'processed' }, 'Item');

    // 3. Current state should be 'processed'
    const resNow = await kernel.query('FIND Item AS ?i RETURN ?i.status');
    expect(resNow.rows[0]?.['?i.status']).toBe('processed');

    // 4. Query at t1 should be 'created'
    const resPast = await kernel.query('FIND Item AS ?i RETURN ?i.status', {
      atTimestamp: t1,
    });
    expect(resPast.rows[0]?.['?i.status']).toBe('created');
  });
});
