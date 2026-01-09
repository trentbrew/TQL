import type { KernelOp } from '../persist/backend.js';
import type { TrellisKernelQueryResult } from './trellis-kernel.js';
import type { Query } from '../query/datalog-evaluator.js';

export type MiddlewareContext = {
  agentId?: string;
  [key: string]: unknown;
};

export type OpMiddlewareNext = (
  op: KernelOp,
  ctx: MiddlewareContext,
) => void | Promise<void>;

export type QueryMiddlewareNext = (
  query: string | Query,
  ctx: MiddlewareContext,
) => TrellisKernelQueryResult | Promise<TrellisKernelQueryResult>;

export interface KernelMiddleware {
  name: string;

  /**
   * Hook into kernel operations (mutations).
   * Can throw to block the operation (e.g. for security).
   */
  handleOp?: (
    op: KernelOp,
    ctx: MiddlewareContext,
    next: OpMiddlewareNext,
  ) => void | Promise<void>;

  /**
   * Hook into kernel queries.
   * Can modify the query string/object or intercept the result.
   */
  handleQuery?: (
    query: string | Query,
    ctx: MiddlewareContext,
    next: QueryMiddlewareNext,
  ) => TrellisKernelQueryResult | Promise<TrellisKernelQueryResult>;
}
