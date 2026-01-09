import type {
  KernelMiddleware,
  MiddlewareContext,
  OpMiddlewareNext,
  QueryMiddlewareNext,
} from './middleware.js';
import type { KernelOp } from '../persist/backend.js';
import type { Query } from '../query/datalog-evaluator.js';
import type { TrellisKernelQueryResult } from './trellis-kernel.js';

export interface SecurityCapability {
  agentId: string;
  action: 'query' | 'mutate';
  targetEntityType?: string;
  targetEntityId?: string;
}

export interface CapabilityProvider {
  can(cap: SecurityCapability): boolean | Promise<boolean>;
}

export class SecurityMiddleware implements KernelMiddleware {
  name = 'security';

  constructor(private provider: CapabilityProvider) {}

  async handleOp(
    op: KernelOp,
    ctx: MiddlewareContext,
    next: OpMiddlewareNext,
  ): Promise<void> {
    const agentId = ctx.agentId || 'anonymous';

    // System operations (like replay) are always allowed if marked in context
    if (ctx.system) {
      return next(op, ctx);
    }

    // Extract target info from operation if possible
    let targetEntityId: string | undefined;
    let targetEntityType: string | undefined;

    if (op.facts && op.facts.length > 0) {
      const firstFact = op.facts[0]!;
      targetEntityId = firstFact.e;
      // Find the 'type' attribute in the facts to get the entity type
      const typeFact = op.facts.find((f) => f.a === 'type');
      if (typeFact && typeof typeFact.v === 'string') {
        targetEntityType = typeFact.v;
      }
    } else if (op.links && op.links.length > 0) {
      targetEntityId = op.links[0]!.e1;
    }

    const allowed = await this.provider.can({
      agentId,
      action: 'mutate',
      targetEntityId,
      targetEntityType,
    });

    if (!allowed) {
      throw new Error(
        `Security violation: agent ${agentId} is not authorized to mutate kernel state${
          targetEntityId ? ` for entity ${targetEntityId}` : ''
        }.`,
      );
    }

    return next(op, ctx);
  }

  async handleQuery(
    query: string | Query,
    ctx: MiddlewareContext,
    next: QueryMiddlewareNext,
  ): Promise<TrellisKernelQueryResult> {
    const agentId = ctx.agentId || 'anonymous';

    if (ctx.system) {
      return next(query, ctx);
    }

    const allowed = await this.provider.can({
      agentId,
      action: 'query',
    });

    if (!allowed) {
      throw new Error(
        `Security violation: agent ${agentId} is not authorized to query the kernel.`,
      );
    }

    return next(query, ctx);
  }
}
