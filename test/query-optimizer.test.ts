import { describe, it, expect } from 'vitest';
import { QueryOptimizer } from '../src/query/query-optimizer.js';
import type { Query, Atom_ } from '../src/query/datalog-evaluator.js';

describe('QueryOptimizer', () => {
  const optimizer = new QueryOptimizer();

  it('should push filters down after their variables are bound', () => {
    const query: Query = {
      goals: [
        { predicate: 'attr', terms: ['?p', 'type', 'Person'] },
        { predicate: 'gt', terms: ['?age', 20] }, // Filter depending on ?age
        { predicate: 'attr', terms: ['?p', 'age', '?age'] }, // ?age bound here
      ],
      variables: new Set(['?p', '?age']),
    };

    const optimized = optimizer.optimize(query);

    // Optimized order should be: type -> age -> gt
    expect(optimized.goals[0]!.predicate).toBe('attr');
    expect(optimized.goals[0]!.terms[1]).toBe('type');

    expect(optimized.goals[1]!.predicate).toBe('attr');
    expect(optimized.goals[1]!.terms[1]).toBe('age');

    expect(optimized.goals[2]!.predicate).toBe('gt');
  });

  it('should order goals by restrictiveness (literals first)', () => {
    const query: Query = {
      goals: [
        { predicate: 'attr', terms: ['?p', 'name', '?name'] },
        { predicate: 'attr', terms: ['?p', 'type', 'Person'] }, // More restrictive (literal 'Person')
      ],
      variables: new Set(['?p', '?name']),
    };

    const optimized = optimizer.optimize(query);

    expect(optimized.goals[0]!.predicate).toBe('attr');
    expect(optimized.goals[0]!.terms[1]).toBe('type'); // Literal 'Person' makes it more restrictive
    expect(optimized.goals[1]!.terms[1]).toBe('name');
  });

  it('should use catalog info for ordering', () => {
    // Catalog says 'email' is very unique (cardinality one, high distinct count)
    // while 'status' is common.
    const catalog = [
      {
        attribute: 'email',
        type: 'string' as const,
        cardinality: 'one' as const,
        distinctCount: 1000,
        examples: [],
      },
      {
        attribute: 'status',
        type: 'string' as const,
        cardinality: 'one' as const,
        distinctCount: 3,
        examples: [],
      },
    ];
    const catOptimizer = new QueryOptimizer(catalog);

    const query: Query = {
      goals: [
        { predicate: 'attr', terms: ['?p', 'status', 'active'] },
        { predicate: 'attr', terms: ['?p', 'email', '?email'] },
      ],
      variables: new Set(['?p', '?email']),
    };

    const optimized = catOptimizer.optimize(query);

    // Even though 'active' is a literal in status,
    // a lookup by email might be considered restrictive if we had a literal there.
    // In this case, status lookup with literal 'active' is still better than email lookup with variable ?email.
    expect(optimized.goals[0]!.terms[1]).toBe('status');
  });

  it('should handle complex join reordering', () => {
    const query: Query = {
      goals: [
        { predicate: 'attr', terms: ['?p', 'name', '?name'] },
        { predicate: 'attr', terms: ['?p', 'age', '?age'] },
        { predicate: 'gt', terms: ['?age', 25] },
        { predicate: 'attr', terms: ['?p', 'type', 'Person'] },
      ],
      variables: new Set(['?p', '?name', '?age']),
    };

    const optimized = optimizer.optimize(query);

    // Expectation: type (literal) -> age (provides ?age for filter) -> gt (filter) -> name
    expect(optimized.goals[0]!.terms[1]).toBe('type');
    expect(optimized.goals[1]!.terms[1]).toBe('age');
    expect(optimized.goals[2]!.predicate).toBe('gt');
    expect(optimized.goals[3]!.terms[1]).toBe('name');
  });
});
