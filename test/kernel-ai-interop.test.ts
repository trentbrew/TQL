import { describe, it, expect } from 'vitest';
import { TrellisKernel } from '../src/kernel/trellis-kernel.js';
import type { NaturalLanguageQueryProvider } from '../src/kernel/ai-interop.js';

describe('TrellisKernel Phase 4: AI Interop', () => {
  it('should use a provider to translate and execute NL queries', async () => {
    const mockProvider: NaturalLanguageQueryProvider = {
      name: 'mock-gpt',
      translate: async (nl) => {
        if (nl === 'show me active items') {
          return 'FIND item AS ?i WHERE ?i.status = "active" RETURN ?i.id';
        }
        return '';
      },
    };

    const kernel = new TrellisKernel();
    await kernel.boot([
      { id: 1, status: 'active' },
      { id: 2, status: 'inactive' },
    ]);

    const res = await kernel.queryNatural('show me active items', {
      provider: mockProvider,
    });
    expect(res.rows.length).toBe(1);
    expect(res.rows[0]?.['?i.id']).toBe(1);
  });
});
