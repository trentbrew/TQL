import type {
  KernelMiddleware,
  MiddlewareContext,
  QueryMiddlewareNext,
} from './middleware.js';
import type { TrellisKernelQueryResult } from './trellis-kernel.js';
import type { SchemaDefinition } from './workspace.js';
import type { Query } from '../query/datalog-evaluator.js';
import type { EAVStore } from '../store/eav-store.js';
import type { AIGenerationProvider } from './ai-interop.js';

export interface LogicSchemaProvider {
  getOntology(id: string): SchemaDefinition | undefined;
}

export class LogicMiddleware implements KernelMiddleware {
  name = 'logic-layer';

  constructor(
    private provider: LogicSchemaProvider,
    private store: EAVStore,
    private aiProvider?: AIGenerationProvider,
  ) {}

  async handleQuery(
    query: string | Query,
    ctx: MiddlewareContext,
    next: QueryMiddlewareNext,
  ): Promise<TrellisKernelQueryResult> {
    const result = await next(query, ctx);

    // If it's a Datalog query or we don't have rows, skip
    if (typeof query !== 'string' || !result.rows || result.rows.length === 0) {
      return result;
    }

    // Attempt to enrich rows with virtual attributes (formulas/rollups/ai_generated)
    // We need to know the entity type for each row.
    // Usually EQL-S results have 'type' or we can infer it from the query.
    // For now, we'll look for '?e.type' or 'type' in the rows.

    const enrichedRows = [...result.rows];
    let changed = false;

    for (let i = 0; i < enrichedRows.length; i++) {
      const row = enrichedRows[i]!;
      const entityType = this.extractEntityType(row);
      if (!entityType) continue;

      const schema = this.provider.getOntology(
        `trellis:schema/${entityType.toLowerCase()}`,
      );
      if (!schema) continue;

      const virtualAttrs = schema.fields.filter(
        (f) =>
          f.valueType === 'formula' ||
          f.valueType === 'rollup' ||
          f.valueType === 'ai_generated',
      );

      if (virtualAttrs.length > 0) {
        const enrichedRow = { ...row };
        for (const attr of virtualAttrs) {
          if (attr.valueType === 'formula' && attr.formula) {
            const val = this.evaluateFormula(attr.formula, enrichedRow);
            if (val !== undefined) {
              const prefix = this.getVarPrefix(row);
              if (prefix) {
                enrichedRow[`${prefix}.${attr.name}`] = val;
              }
              enrichedRow[attr.name] = val;
              changed = true;
            }
          } else if (attr.valueType === 'rollup' && attr.rollup) {
            const val = this.evaluateRollup(attr.rollup, enrichedRow);
            if (val !== undefined) {
              const prefix = this.getVarPrefix(row);
              if (prefix) {
                enrichedRow[`${prefix}.${attr.name}`] = val;
              }
              enrichedRow[attr.name] = val;
              changed = true;
            }
          } else if (
            attr.valueType === 'ai_generated' &&
            attr.aiGenerated &&
            this.aiProvider
          ) {
            const val = await this.evaluateAIGenerated(
              attr.aiGenerated,
              enrichedRow,
            );
            if (val !== undefined) {
              const prefix = this.getVarPrefix(row);
              if (prefix) {
                enrichedRow[`${prefix}.${attr.name}`] = val;
              }
              enrichedRow[attr.name] = val;
              changed = true;
            }
          }
        }
        enrichedRows[i] = enrichedRow;
      }
    }

    return changed ? { ...result, rows: enrichedRows } : result;
  }

  private async evaluateAIGenerated(aiConfig: any, row: Record<string, any>) {
    if (!this.aiProvider) return undefined;
    const cleanRow = this.getCleanRow(row);
    return this.aiProvider.generate(aiConfig.prompt, cleanRow);
  }

  private extractEntityType(row: Record<string, any>): string | undefined {
    // Look for common type field patterns in projected rows
    for (const key of Object.keys(row)) {
      if (key === 'type' || key.endsWith('.type')) {
        return row[key];
      }
    }
    return undefined;
  }

  private getVarPrefix(row: Record<string, any>): string | undefined {
    for (const key of Object.keys(row)) {
      if (key.startsWith('?') && key.includes('.')) {
        return key.split('.')[0];
      }
    }
    return undefined;
  }

  private getCleanRow(row: Record<string, any>): Record<string, any> {
    const cleanRow: Record<string, any> = {};
    for (const [k, v] of Object.entries(row)) {
      const cleanKey = k.includes('.') ? k.split('.').pop()! : k;
      cleanRow[cleanKey] = v;
    }
    return cleanRow;
  }

  private evaluateRollup(rollup: any, row: Record<string, any>): any {
    const entityId =
      row['@id'] || row['id'] || row[this.getVarPrefix(row) + '.@id'];
    if (!entityId) return undefined;

    const links = this.store.getLinksByEntityAndAttribute(
      entityId,
      rollup.relationProperty,
    );
    const targetEntities = links.map((l) => l.e2);

    if (rollup.aggregation === 'count') {
      return targetEntities.length;
    }

    const values: any[] = [];
    for (const targetId of targetEntities) {
      const facts = this.store.getFactsByEntity(targetId);
      const targetFact = facts.find((f) => f.a === rollup.targetProperty);
      if (targetFact) {
        values.push(targetFact.v);
      }
    }

    if (values.length === 0) return 0;

    switch (rollup.aggregation) {
      case 'sum':
        return values.reduce((a, b) => (typeof b === 'number' ? a + b : a), 0);
      case 'avg':
        const sum = values.reduce(
          (a, b) => (typeof b === 'number' ? a + b : a),
          0,
        );
        return sum / values.length;
      case 'min':
        return Math.min(...values.filter((v) => typeof v === 'number'));
      case 'max':
        return Math.max(...values.filter((v) => typeof v === 'number'));
      case 'median':
        const nums = values
          .filter((v) => typeof v === 'number')
          .sort((a, b) => a - b);
        if (nums.length === 0) return 0;
        const mid = Math.floor(nums.length / 2);
        return nums.length % 2 !== 0
          ? nums[mid]
          : (nums[mid - 1]! + nums[mid]!) / 2;
      case 'mode':
        if (values.length === 0) return undefined;
        const counts = new Map<any, number>();
        let maxCount = 0;
        let mode: any = values[0];
        for (const v of values) {
          const count = (counts.get(v) || 0) + 1;
          counts.set(v, count);
          if (count > maxCount) {
            maxCount = count;
            mode = v;
          }
        }
        return mode;
      default:
        return undefined;
    }
  }

  private evaluateFormula(formula: string, row: Record<string, any>): any {
    // Simple arithmetic formula evaluator for "attr1 - attr2" etc.
    // Plus built-in functions $if, $concat, $date
    try {
      const cleanRow = this.getCleanRow(row);

      // Pre-process built-in functions
      let expr = formula;

      // $if(cond, then, else) -> (cond ? then : else)
      // This is a very basic regex-based transform
      expr = expr.replace(/\$if\((.*?), (.*?), (.*?)\)/g, '($1 ? $2 : $3)');

      // $concat(a, b, ...) -> (a + b + ...)
      expr = expr.replace(/\$concat\((.*?)\)/g, (match, args) => {
        return args
          .split(',')
          .map((a: string) => a.trim())
          .join(' + ');
      });

      const tokens = expr
        .split(/([-+*/()<>!=&|?, ]+)/)
        .filter((t) => t.trim().length > 0);

      for (const token of tokens) {
        // If token is a potential attribute name (not a number or JS operator)
        if (
          /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(token) &&
          !['true', 'false', 'null', 'undefined'].includes(token)
        ) {
          const val = cleanRow[token];
          if (val !== undefined) {
            // Escape strings for evaluation
            const stringified =
              typeof val === 'string'
                ? `"${val.replace(/"/g, '\\"')}"`
                : String(val);
            expr = expr.replace(new RegExp(`\\b${token}\\b`, 'g'), stringified);
          }
        }
      }

      // Using Function constructor as a safe-ish eval for math/logic only
      return new Function(`return (${expr})`)();
    } catch (e) {
      console.warn(`[logic] Formula evaluation failed: ${formula}`, e);
      return undefined;
    }
  }
}
