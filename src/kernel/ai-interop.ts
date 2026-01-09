import type { TrellisKernelQueryResult } from './trellis-kernel.js';
import type { MiddlewareContext } from './middleware.js';

/**
 * Interface for AI providers that can translate natural language to EQL-S.
 * This allows the kernel to remain lean and provider-agnostic.
 */
export interface NaturalLanguageQueryProvider {
  name: string;

  /**
   * Translates a natural language string into a valid EQL-S query.
   * @param nl The natural language input from the user.
   * @param context Optional context (e.g. current schema, user metadata).
   */
  translate(nl: string, context?: MiddlewareContext): Promise<string>;
}

/**
 * Interface for AI providers that can generate content for virtual attributes.
 */
export interface AIGenerationProvider {
  name: string;

  /**
   * Generates content based on a prompt and input data.
   */
  generate(prompt: string, input: Record<string, any>): Promise<string>;
}

export type NLQueryOptions = {
  provider: NaturalLanguageQueryProvider;
  context?: MiddlewareContext;
};
