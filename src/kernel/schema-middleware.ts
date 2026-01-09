import type {
  KernelMiddleware,
  MiddlewareContext,
  OpMiddlewareNext,
} from './middleware.js';
import type { KernelOp } from '../persist/backend.js';
import type { SchemaDefinition } from './workspace.js';

export interface SchemaProvider {
  getOntology(id: string): SchemaDefinition | undefined;
}

export class SchemaMiddleware implements KernelMiddleware {
  name = 'schema-enforcement';

  constructor(private provider: SchemaProvider) {}

  async handleOp(
    op: KernelOp,
    ctx: MiddlewareContext,
    next: OpMiddlewareNext,
  ): Promise<void> {
    // Only enforce on local mutations (replay/system usually skipped unless we want strictness everywhere)
    if (ctx.system || ctx.remote) {
      return next(op, ctx);
    }

    if (op.kind === 'addFacts' && op.facts) {
      // Find the entity type from the facts
      const typeFact = op.facts.find((f) => f.a === 'type');
      if (typeFact && typeof typeFact.v === 'string') {
        const type = typeFact.v;
        const schema = this.provider.getOntology(
          `trellis:schema/${type.toLowerCase()}`,
        );

        if (schema) {
          // Validate facts against schema fields
          const allowedFields = new Set(schema.fields.map((f) => f.name));
          // Always allow 'type' and '@id'
          allowedFields.add('type');
          allowedFields.add('@id');

          for (const fact of op.facts) {
            if (!allowedFields.has(fact.a)) {
              throw new Error(
                `Schema violation: attribute "${fact.a}" is not allowed for entity type "${type}".`,
              );
            }

            // Optional: add type validation here based on schema.fields[].valueType
          }
        }
      }
    }

    return next(op, ctx);
  }
}
