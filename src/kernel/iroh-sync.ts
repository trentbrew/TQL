import { Iroh, type Doc, type AuthorId } from '@number0/iroh';
import type { SyncProvider } from './sync.js';
import type { KernelOp } from '../persist/backend.js';

/**
 * Iroh-based P2P Sync Provider
 * Uses Iroh Documents and Gossip for real-time synchronization between devices.
 */
export class IrohSyncProvider implements SyncProvider {
  name = 'iroh';
  private iroh?: any;
  private doc?: Doc;
  private author?: AuthorId;
  private remoteOpCallback?: (op: KernelOp) => Promise<void>;
  private isRunning = false;

  constructor(
    private options: {
      dataDir?: string;
      ticket?: string;
    } = {},
  ) {}

  async start(): Promise<void> {
    if (this.isRunning) return;

    // Initialize Iroh
    this.iroh = await (Iroh as any).memory();
    this.author = await this.iroh.authors.create();

    if (this.options.ticket) {
      // Join existing document
      this.doc = await this.iroh.docs.import(this.options.ticket);
    } else {
      // Create new document
      this.doc = await this.iroh.docs.create();
    }

    if (!this.doc) throw new Error('Failed to initialize Iroh document');

    // Subscribe to document changes
    try {
      const subscribe = await (this.doc as any).subscribe();
      if (subscribe) {
        (async () => {
          for await (const event of subscribe as any) {
            if (event.type === 'InsertRemote') {
              await this.handleRemoteInsert(event.entry);
            }
          }
        })();
      }
    } catch (e) {
      console.warn(
        'Iroh subscription failed, real-time sync may be limited:',
        e,
      );
    }

    this.isRunning = true;
    const ticket = await (this.doc as any).share(
      { mode: 'write' },
      { addrOptions: { kind: 'Relay' } },
    );
    console.log(`📡 Iroh Sync Provider started. Ticket: ${ticket}`);
  }

  async stop(): Promise<void> {
    this.isRunning = false;
  }

  onRemoteOp(callback: (op: KernelOp) => Promise<void>): void {
    this.remoteOpCallback = callback;
  }

  async broadcast(op: KernelOp): Promise<void> {
    if (!this.doc || !this.author) return;

    const key = Array.from(Buffer.from(`op:${op.hash}`));
    const value = Array.from(Buffer.from(JSON.stringify(op)));

    await (this.doc as any).setBytes(this.author, key, value);
  }

  private async handleRemoteInsert(entry: any): Promise<void> {
    if (!this.doc || !this.remoteOpCallback || !entry) return;

    try {
      // In @number0/iroh, the entry object contains the hash
      const bytes = await (this.iroh as any).blobs.readToBytes(
        entry.contentHash,
      );
      if (bytes) {
        const op = JSON.parse(Buffer.from(bytes).toString()) as KernelOp;
        await this.remoteOpCallback(op);
      }
    } catch (error) {
      console.error('Failed to process remote op:', error);
    }
  }

  async getTicket(): Promise<string | undefined> {
    if (!this.doc) return undefined;
    return (
      await this.doc.share(
        { mode: 'write' } as any,
        { addrOptions: { kind: 'Relay' } } as any,
      )
    ).toString();
  }
}
