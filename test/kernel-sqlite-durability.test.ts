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

describe('TrellisKernel SQLite durability', () => {
  let dir: string;
  let dbPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'tql-kernel-sqlite-'));
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

  sqliteIt('should replay op-log on reopen', async () => {
    {
      const backend = new SqliteKernelBackend({ filename: dbPath });
      const k = new TrellisKernel({ backend });
      await k.boot(
        [
          { id: 1, status: 'active' },
          { id: 2, status: 'planning' },
        ],
        { entityType: 'item', idKey: 'id' },
      );
      k.close();
    }

    {
      const backend = new SqliteKernelBackend({ filename: dbPath });
      const k = new TrellisKernel({ backend });
      const res = await k.query(
        'FIND item AS ?e WHERE ?e.status = "active" RETURN ?e.id, ?e.status',
      );
      expect(res.rows.length).toBe(1);
      expect(res.rows[0]!['?e.id']).toBe(1);
      expect(res.rows[0]!['?e.status']).toBe('active');
      k.close();
    }
  });
});
