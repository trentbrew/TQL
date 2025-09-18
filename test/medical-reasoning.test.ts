#!/usr/bin/env node

/**
 * TQL Dataset Test — medical-reasoning.json
 *
 * Programmatically loads the dataset and runs EQL-S queries using core APIs.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { EAVStore, jsonEntityFacts } from '../src/eav-engine.js';
import { EQLSProcessor } from '../src/query/eqls-parser.js';
import { DatalogEvaluator } from '../src/query/datalog-evaluator.js';

function setupStoreFromFile(relPath: string): {
  store: EAVStore;
  processor: EQLSProcessor;
  evaluator: DatalogEvaluator;
} {
  const abs = join(process.cwd(), relPath);
  const data = JSON.parse(readFileSync(abs, 'utf-8'));

  const store = new EAVStore();
  // Ingest as a single entity with type "default" so EQL-S examples work
  const facts = jsonEntityFacts('default:root', data, 'default');
  store.addFacts(facts);

  const processor = new EQLSProcessor();
  processor.setSchema(store.getCatalog());
  const evaluator = new DatalogEvaluator(store);

  return { store, processor, evaluator };
}

describe('medical-reasoning dataset (EQL-S)', () => {
  it('should find rows with "hallucinations" in the Question', () => {
    const { processor, evaluator } = setupStoreFromFile(
      'data/medical-reasoning.json',
    );

    const eqls =
      'FIND default AS ?e WHERE ?e.rows.row.Question MATCHES /hallucinat/i RETURN ?e.rows.row_idx, ?e.rows.row.Question, ?e.rows.row.Response LIMIT 10';
    const result = processor.process(eqls);
    expect(result.errors).toHaveLength(0);
    const exec = evaluator.evaluate(result.query!);
    const projMap = result.projectionMap || new Map<string, string>();

    expect(exec.bindings.length).toBeGreaterThan(0);
    // Apply projection to get original field names
    const projected = exec.bindings.map((b) => {
      const o: Record<string, unknown> = {};
      for (const [field, varName] of projMap.entries()) {
        o[field] = (b as any)[varName];
      }
      return o;
    });

    const anyMatch = projected.some((row) =>
      Object.entries(row).some(
        ([k, v]) =>
          /Question/.test(k) && typeof v === 'string' && /hallucinat/i.test(v),
      ),
    );
    expect(anyMatch).toBe(true);
  });

  it('should project Question and Response fields without filter (LIMIT 3)', () => {
    const { processor, evaluator } = setupStoreFromFile(
      'data/medical-reasoning.json',
    );

    const eqls =
      'FIND default AS ?e RETURN ?e.rows.row_idx, ?e.rows.row.Question, ?e.rows.row.Response LIMIT 3';
    const result = processor.process(eqls);
    expect(result.errors).toHaveLength(0);
    const exec = evaluator.evaluate(result.query!);
    const projMap = result.projectionMap || new Map<string, string>();

    expect(exec.bindings.length).toBeGreaterThan(0);
    const projected = exec.bindings.map((b) => {
      const o: Record<string, unknown> = {};
      for (const [field, varName] of projMap.entries()) {
        o[field] = (b as any)[varName];
      }
      return o;
    });

    // Check that each projection has those columns present
    const keys = new Set<string>();
    for (const row of projected) {
      for (const k of Object.keys(row)) keys.add(k);
    }
    const keyStr = Array.from(keys).join(',');
    expect(keyStr).toMatch(/rows\.row_idx/);
    expect(keyStr).toMatch(/rows\.row\.Question/);
    expect(keyStr).toMatch(/rows\.row\.Response/);
  });
});
