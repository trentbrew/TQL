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

describe('TrellisKernel: Index Snapshots', () => {
  let dir: string;
  let dbPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'tql-kernel-snapshot-'));
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

  sqliteIt(
    'should snapshot state and restore from it on next boot',
    async () => {
      // 1. Initial boot and populate
      {
        const backend = new SqliteKernelBackend({ filename: dbPath });
        const kernel = new TrellisKernel({ backend });
        await kernel.boot(
          [
            { id: 1, val: 'a' },
            { id: 2, val: 'b' },
          ],
          { entityType: 'Item' },
        );

        // Manually trigger checkpoint
        await kernel.checkpoint();
        kernel.close();
      }

      // 2. Add more data without snapshotting
      {
        const backend = new SqliteKernelBackend({ filename: dbPath });
        const kernel = new TrellisKernel({ backend });
        // This should have loaded from snapshot and replayed nothing extra yet
        await kernel.createNode('item:3', { id: 3, val: 'c' }, 'Item');
        kernel.close();
      }

      // 3. Final boot - should restore from snapshot and replay the last op
      {
        const backend = new SqliteKernelBackend({ filename: dbPath });
        const kernel = new TrellisKernel({ backend });

        const res = await kernel.query('FIND Item AS ?i RETURN ?i.id, ?i.val');
        expect(res.rows.length).toBe(3);

        const ids = res.rows.map((r) => r['?i.id']).sort();
        expect(ids).toEqual([1, 2, 3]);

        kernel.close();
      }
    },
  );
});
