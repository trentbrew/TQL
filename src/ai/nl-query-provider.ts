import { processQuery } from './orchestrator.js';
import type { NaturalLanguageQueryProvider } from '../kernel/ai-interop.js';
import type { MiddlewareContext } from '../kernel/middleware.js';

export interface DefaultNLQueryProviderOptions {
  catalog?: any[];
  dataStats?: any;
}

/**
 * Default implementation of NaturalLanguageQueryProvider using the AI orchestrator.
 */
export class DefaultNLQueryProvider implements NaturalLanguageQueryProvider {
  name = 'default-orchestrator';

  constructor(private options: DefaultNLQueryProviderOptions = {}) {}

  async translate(nl: string, context?: MiddlewareContext): Promise<string> {
    // Priority: context values > constructor options > empty defaults
    const catalog = (context?.catalog as any[]) || this.options.catalog || [];
    const dataStats = context?.dataStats ||
      this.options.dataStats || { totalFacts: 0 };

    const result = await processQuery(nl, { catalog, dataStats });

    if (result.error) {
      throw new Error(`NL translation failed: ${result.error}`);
    }

    if (!result.eqlsQuery) {
      throw new Error('NL translation failed: no query generated');
    }

    return result.eqlsQuery;
  }
}
