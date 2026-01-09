import type { KernelOp } from '../persist/backend.js';

/**
 * Interface for synchronization providers (e.g., Iroh, p2p, cloud relay).
 */
export interface SyncProvider {
  name: string;

  /**
   * Called by the kernel when a local operation is performed.
   * The provider should broadcast this to peers.
   */
  broadcast(op: KernelOp): Promise<void>;

  /**
   * Subscribes to remote operations.
   * The callback should be invoked when an operation is received from a peer.
   */
  onRemoteOp(callback: (op: KernelOp) => Promise<void>): void;

  /**
   * Starts the sync provider.
   */
  start(): Promise<void>;

  /**
   * Stops the sync provider.
   */
  stop(): Promise<void>;
}

/**
 * Mock implementation of SyncProvider for testing.
 */
export class MockSyncProvider implements SyncProvider {
  name = 'mock';
  public broadcastedOps: KernelOp[] = [];
  private remoteOpCallback?: (op: KernelOp) => Promise<void>;

  async broadcast(op: KernelOp): Promise<void> {
    this.broadcastedOps.push(op);
  }

  onRemoteOp(callback: (op: KernelOp) => Promise<void>): void {
    this.remoteOpCallback = callback;
  }

  async simulateRemoteOp(op: KernelOp): Promise<void> {
    if (this.remoteOpCallback) {
      await this.remoteOpCallback(op);
    }
  }

  async start(): Promise<void> {}
  async stop(): Promise<void> {}
}
