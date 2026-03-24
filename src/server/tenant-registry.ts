import { createRequire } from 'module';
import { randomUUID } from 'crypto';
import { join } from 'node:path';

const require = createRequire(import.meta.url);

export interface TenantRecord {
  key: string;
  label: string;
  dbPath: string;
  createdAt: string;
}

function generateApiKey(): string {
  return 'tql_' + randomUUID().replace(/-/g, '').slice(0, 32);
}

export class TenantRegistry {
  private db: any;

  constructor(registryDbPath: string) {
    const mod = require(['bun', 'sqlite'].join(':')) as any;
    this.db = new mod.Database(registryDbPath);
    this.init();
  }

  private init(): void {
    this.db.run('PRAGMA journal_mode = WAL');
    this.db.run(`
      CREATE TABLE IF NOT EXISTS api_keys (
        key        TEXT PRIMARY KEY,
        label      TEXT NOT NULL,
        db_path    TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);
  }

  provision(dataDir: string, label?: string): TenantRecord {
    const key = generateApiKey();
    const dbPath = join(dataDir, `${key}.db`);
    const createdAt = new Date().toISOString();
    const effectiveLabel = label ?? key;

    this.db.run(
      'INSERT INTO api_keys (key, label, db_path, created_at) VALUES (?, ?, ?, ?)',
      [key, effectiveLabel, dbPath, createdAt],
    );

    return { key, label: effectiveLabel, dbPath, createdAt };
  }

  lookup(key: string): TenantRecord | undefined {
    const row = this.db
      .query('SELECT key, label, db_path, created_at FROM api_keys WHERE key = ?')
      .get(key) as { key: string; label: string; db_path: string; created_at: string } | null;

    if (!row) return undefined;
    return { key: row.key, label: row.label, dbPath: row.db_path, createdAt: row.created_at };
  }

  revoke(key: string): boolean {
    const existing = this.lookup(key);
    if (!existing) return false;
    this.db.run('DELETE FROM api_keys WHERE key = ?', [key]);
    return true;
  }

  list(): TenantRecord[] {
    const rows = this.db
      .query('SELECT key, label, db_path, created_at FROM api_keys ORDER BY created_at ASC')
      .all() as { key: string; label: string; db_path: string; created_at: string }[];

    return rows.map((r) => ({
      key: r.key,
      label: r.label,
      dbPath: r.db_path,
      createdAt: r.created_at,
    }));
  }

  close(): void {
    this.db.close();
  }
}
