import type { Query, Atom_ } from './datalog-evaluator.js';
import type { CatalogEntry } from '../store/eav-store.js';

/**
 * Basic Query Optimizer for Trellis Datalog Engine
 *
 * Implements:
 * 1. Filter Pushdown: Ensures filters run as soon as their variables are bound.
 * 2. Restrictiveness Ordering: Orders goals based on estimated result set size.
 */
export class QueryOptimizer {
  constructor(private catalog: CatalogEntry[] = []) {}

  /**
   * Optimizes a Datalog query by reordering its goals.
   */
  optimize(query: Query): Query {
    if (query.goals.length <= 1) return query;

    const optimizedGoals: Atom_[] = [];
    const remainingGoals = [...query.goals];
    const boundVars = new Set<string>();

    // Start with the main entity type goal if it exists (usually the first goal in EQL-S)
    const typeGoalIdx = remainingGoals.findIndex(
      (g) => g.predicate === 'attr' && g.terms[1] === 'type',
    );
    if (typeGoalIdx !== -1) {
      const typeGoal = remainingGoals.splice(typeGoalIdx, 1)[0]!;
      optimizedGoals.push(typeGoal);
      this.collectVars(typeGoal, boundVars);
    }

    while (remainingGoals.length > 0) {
      // 1. Pick the "best" next goal
      const bestIdx = this.findBestNextGoal(remainingGoals, boundVars);

      if (bestIdx === -1) {
        // No goals can be satisfied with current bound vars (shouldn't happen in valid EQL-S)
        // Just take the first one to avoid infinite loop
        const goal = remainingGoals.splice(0, 1)[0]!;
        optimizedGoals.push(goal);
        this.collectVars(goal, boundVars);
      } else {
        const goal = remainingGoals.splice(bestIdx, 1)[0]!;
        optimizedGoals.push(goal);
        this.collectVars(goal, boundVars);
      }

      // 2. Filter Pushdown: Pick any filters that are now fully satisfied
      let pushdownPossible = true;
      while (pushdownPossible) {
        const filterIdx = remainingGoals.findIndex(
          (g) => this.isFilter(g) && this.isSatisfied(g, boundVars),
        );
        if (filterIdx !== -1) {
          const filter = remainingGoals.splice(filterIdx, 1)[0]!;
          optimizedGoals.push(filter);
          // Filters don't bind new variables usually
        } else {
          pushdownPossible = false;
        }
      }
    }

    return {
      ...query,
      goals: optimizedGoals,
    };
  }

  private findBestNextGoal(goals: Atom_[], boundVars: Set<string>): number {
    let bestIdx = -1;
    let bestScore = -1;

    // Pre-calculate which variables are needed by remaining filters
    const filterVars = new Set<string>();
    for (const goal of goals) {
      if (this.isFilter(goal)) {
        for (const term of goal.terms) {
          if (typeof term === 'string' && term.startsWith('?')) {
            filterVars.add(term);
          }
        }
      }
    }

    for (let i = 0; i < goals.length; i++) {
      const goal = goals[i]!;

      // We prefer non-filters (joins/attr lookups) that have some bound variables
      if (this.isFilter(goal)) continue;

      let score = this.calculateRestrictiveness(goal, boundVars);

      // Boost score if this goal binds variables needed by filters
      for (const term of goal.terms) {
        if (
          typeof term === 'string' &&
          term.startsWith('?') &&
          !boundVars.has(term) &&
          filterVars.has(term)
        ) {
          score += 25; // Boost for unblocking a filter
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    return bestIdx;
  }

  /**
   * Calculates a "restrictiveness" score for a goal.
   * Higher is more restrictive (better to run earlier).
   */
  private calculateRestrictiveness(
    goal: Atom_,
    boundVars: Set<string>,
  ): number {
    // Basic heuristic:
    // 1. Count literals (100 points each)
    // 2. Count bound variables (50 points each)
    // 3. Subtract cardinality if known (lower cardinality = higher score)

    let score = 0;
    const terms = goal.terms;

    for (const term of terms) {
      if (typeof term !== 'string' || !term.startsWith('?')) {
        score += 100; // Literal
      } else if (boundVars.has(term)) {
        score += 50; // Bound variable
      }
    }

    // Catalog-based optimization
    if (goal.predicate === 'attr' && typeof terms[1] === 'string') {
      const entry = this.catalog.find((e) => e.attribute === terms[1]);
      if (entry) {
        // Lower distinctCount is better for 'one' cardinality,
        // but 'many' might be very broad.
        if (entry.cardinality === 'one') {
          score += 20;
        }
        // Normalize distinctCount to a small penalty
        score -= Math.min(10, entry.distinctCount / 100);
      }
    }

    return score;
  }

  private isFilter(goal: Atom_): boolean {
    const filters = new Set([
      'gt',
      'lt',
      'between',
      'regex',
      'contains',
      '>',
      '<',
      '>=',
      '<=',
      '=',
      '!=',
      'after',
      'betweenDate',
    ]);
    return filters.has(goal.predicate) || goal.predicate.startsWith('ext_');
  }

  private isSatisfied(goal: Atom_, boundVars: Set<string>): boolean {
    // A filter is satisfied if all its variable terms are in boundVars
    return goal.terms.every((term) => {
      if (typeof term === 'string' && term.startsWith('?')) {
        return boundVars.has(term);
      }
      return true;
    });
  }

  private collectVars(goal: Atom_, boundVars: Set<string>): void {
    for (const term of goal.terms) {
      if (typeof term === 'string' && term.startsWith('?')) {
        boundVars.add(term);
      }
    }
  }
}
