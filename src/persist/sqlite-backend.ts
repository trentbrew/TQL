import { createRequire } from 'module';
import type { KernelBackend, KernelOp } from './backend.js';

const require = createRequire(import.meta.url);

type EncodedAtom =
  | string
  | number
  | boolean
  | {
      $type: 'date';
      value: string;
    };

const encodeAtom = (v: unknown): EncodedAtom => {
  if (v instanceof Date) return { $type: 'date', value: v.toISOString() };
  return v as EncodedAtom;
};

const decodeAtom = (v: unknown): unknown => {
  if (
    v &&
    typeof v === 'object' &&
    '$type' in v &&
    (v as any).$type === 'date' &&
    typeof (v as any).value === 'string'
  ) {
    return new Date((v as any).value);
  }
  return v;
};

const encodeOp = (op: KernelOp): any => {
  const encoded: any = { ...op };
  if (encoded.facts) {
    encoded.facts = encoded.facts.map((f: any) => ({
      ...f,
      v: encodeAtom(f.v),
    }));
  }
  return encoded;
};

const decodeOp = (raw: any): KernelOp => {
  const decoded: any = { ...raw };
  if (decoded.facts) {
    decoded.facts = decoded.facts.map((f: any) => ({
      ...f,
      v: decodeAtom(f.v),
    }));
  }
  return decoded as KernelOp;
};

export type SqliteKernelBackendOptions = {
  filename: string;
};

export class SqliteKernelBackend implements KernelBackend {
  private db: any;

  constructor(private opts: SqliteKernelBackendOptions) {
    const mod = require(['bun', 'sqlite'].join(':')) as any;
    const DatabaseCtor = mod?.Database;
    if (!DatabaseCtor) {
      throw new Error('bun:sqlite is not available in this runtime');
    }

    this.db = new DatabaseCtor(opts.filename);
  }

  init(): void {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS ops (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash TEXT NOT NULL UNIQUE,
        ts INTEGER NOT NULL,
        kind TEXT NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ops_hash ON ops(hash);

      CREATE TABLE IF NOT EXISTS snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        last_op_hash TEXT NOT NULL,
        ts INTEGER NOT NULL,
        data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_snapshots_ts ON snapshots(ts);
    `);
  }

  append(op: KernelOp): void {
    const stmt = this.db.prepare(
      'INSERT INTO ops (hash, ts, kind, payload) VALUES (?, ?, ?, ?)',
    );
    stmt.run(
      op.hash,
      new Date(op.timestamp).getTime(),
      op.kind,
      JSON.stringify(encodeOp(op)),
    );
  }

  readAll(): KernelOp[] {
    const rows = this.db
      .prepare('SELECT payload FROM ops ORDER BY id ASC')
      .all() as Array<{ payload: string }>;

    return rows.map((r) => decodeOp(JSON.parse(r.payload)));
  }

  readUntil(hash: string): KernelOp[] {
    // Find the ID of the op with the given hash
    const target = this.db
      .prepare('SELECT id FROM ops WHERE hash = ?')
      .get(hash) as { id: number } | undefined;

    if (!target) {
      throw new Error(`Operation with hash ${hash} not found`);
    }

    const rows = this.db
      .prepare('SELECT payload FROM ops WHERE id <= ? ORDER BY id ASC')
      .all(target.id) as Array<{ payload: string }>;

    return rows.map((r) => decodeOp(JSON.parse(r.payload)));
  }

  /**
   * Reads operations after a specific hash.
   */
  readAfter(hash: string): KernelOp[] {
    const target = this.db
      .prepare('SELECT id FROM ops WHERE hash = ?')
      .get(hash) as { id: number } | undefined;

    if (!target) {
      throw new Error(`Operation with hash ${hash} not found`);
    }

    const rows = this.db
      .prepare('SELECT payload FROM ops WHERE id > ? ORDER BY id ASC')
      .all(target.id) as Array<{ payload: string }>;

    return rows.map((r) => decodeOp(JSON.parse(r.payload)));
  }

  readUntilTimestamp(isoTimestamp: string): KernelOp[] {
    const ts = new Date(isoTimestamp).getTime();
    const rows = this.db
      .prepare('SELECT payload FROM ops WHERE ts <= ? ORDER BY id ASC')
      .all(ts) as Array<{ payload: string }>;

    return rows.map((r) => decodeOp(JSON.parse(r.payload)));
  }

  getLastOp(): KernelOp | undefined {
    const row = this.db
      .prepare('SELECT payload FROM ops ORDER BY id DESC LIMIT 1')
      .get() as { payload: string } | undefined;

    if (!row) return undefined;
    return decodeOp(JSON.parse(row.payload));
  }

  saveSnapshot(lastOpHash: string, data: any): void {
    const stmt = this.db.prepare(
      'INSERT INTO snapshots (last_op_hash, ts, data) VALUES (?, ?, ?)',
    );
    stmt.run(lastOpHash, Date.now(), JSON.stringify(data));
  }

  loadLatestSnapshot(): { lastOpHash: string; data: any } | undefined {
    const row = this.db
      .prepare(
        'SELECT last_op_hash, data FROM snapshots ORDER BY ts DESC LIMIT 1',
      )
      .get() as { last_op_hash: string; data: string } | undefined;

    if (!row) return undefined;
    return {
      lastOpHash: row.last_op_hash,
      data: JSON.parse(row.data),
    };
  }

  close(): void {
    this.db.close();
  }
}
