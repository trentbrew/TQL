import { describe, it, expect } from 'vitest';
import { TrellisKernel } from '../src/kernel/trellis-kernel.js';
import { SecurityMiddleware } from '../src/kernel/security-middleware.js';
import type {
  CapabilityProvider,
  SecurityCapability,
} from '../src/kernel/security-middleware.js';

describe('TrellisKernel Phase 3: Middleware & Security', () => {
  it('should allow queries when security provider permits', async () => {
    const provider: CapabilityProvider = {
      can: async () => true,
    };
    const kernel = new TrellisKernel({
      middleware: [new SecurityMiddleware(provider)],
    });

    await kernel.boot([{ id: 1, type: 'test' }]);

    const res = await kernel.query('FIND item AS ?i RETURN ?i.id');
    expect(res.rows.length).toBe(1);
  });

  it('should block queries when security provider denies', async () => {
    const provider: CapabilityProvider = {
      can: async (cap) => cap.action !== 'query', // allow boot (mutate) but block query
    };
    const kernel = new TrellisKernel({
      middleware: [new SecurityMiddleware(provider)],
    });

    await kernel.boot([{ id: 1, type: 'test' }]);

    await expect(kernel.query('FIND item AS ?i RETURN ?i.id')).rejects.toThrow(
      /Security violation/,
    );
  });

  it('should pass agentId from context to provider', async () => {
    let capturedAgentId = '';
    const provider: CapabilityProvider = {
      can: async (cap) => {
        capturedAgentId = cap.agentId;
        return true;
      },
    };
    const kernel = new TrellisKernel({
      middleware: [new SecurityMiddleware(provider)],
    });

    await kernel.query('FIND item AS ?i RETURN ?i.id', { agentId: 'alice' });
    expect(capturedAgentId).toBe('alice');
  });

  it('should allow system operations regardless of provider', async () => {
    const provider: CapabilityProvider = {
      can: async () => false, // Deny everything
    };
    const kernel = new TrellisKernel({
      middleware: [new SecurityMiddleware(provider)],
    });

    // query with system: true should pass
    const res = await kernel.query('FIND item AS ?i RETURN ?i.id', {
      system: true,
    });
    expect(res.rows).toBeDefined();
  });
});
