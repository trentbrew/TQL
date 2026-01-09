import type { KernelOp, KernelOpKind } from '../persist/backend.js';
import type { Fact, Link } from '../store/eav-store.js';

/**
 * Creates a unique hash for a KernelOp based on its content and causality.
 */
export async function hashOp(op: Omit<KernelOp, 'hash'>): Promise<string> {
  const content = JSON.stringify({
    kind: op.kind,
    timestamp: op.timestamp,
    agentId: op.agentId,
    previousHash: op.previousHash,
    facts: op.facts,
    links: op.links,
  });

  // Simple SHA-256 hash using Web Crypto API (available in Bun/Node/Browser)
  const msgUint8 = new TextEncoder().encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `trellis:op:${hashHex}`;
}

/**
 * Helper to construct a new KernelOp with full metadata.
 */
export async function createOp(
  kind: KernelOpKind,
  params: {
    agentId: string;
    previousHash?: string;
    facts?: Fact[];
    links?: Link[];
  },
): Promise<KernelOp> {
  const opBase = {
    kind,
    timestamp: new Date().toISOString(),
    agentId: params.agentId,
    previousHash: params.previousHash,
    facts: params.facts,
    links: params.links,
  };

  const hash = await hashOp(opBase);
  return { ...opBase, hash };
}
