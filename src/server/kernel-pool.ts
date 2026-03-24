import { TrellisKernel } from '../kernel/trellis-kernel.js';
import { SqliteKernelBackend } from '../persist/sqlite-backend.js';

export class KernelPool {
  private pool = new Map<string, TrellisKernel>();

  getOrCreate(dbPath: string): TrellisKernel {
    const existing = this.pool.get(dbPath);
    if (existing) return existing;

    const backend = new SqliteKernelBackend({ filename: dbPath });
    const kernel = new TrellisKernel({ backend });
    this.pool.set(dbPath, kernel);
    return kernel;
  }

  close(dbPath: string): void {
    const kernel = this.pool.get(dbPath);
    if (kernel) {
      kernel.close();
      this.pool.delete(dbPath);
    }
  }

  closeAll(): void {
    for (const [dbPath] of this.pool) {
      this.close(dbPath);
    }
  }
}
