/**
 * Datalog Evaluator with External Predicates (V2)
 *
 * Implements proper semi-naive evaluation with working set for derived predicates
 */

import { EAVStore } from '../eav-engine.js';
import type { Fact, Atom, QueryResult } from '../eav-engine.js';

export type Variable = string;
export type Term = Variable | Atom;

export interface Predicate {
  name: string;
  arity: number;
}

export interface Atom_ {
  predicate: string;
  terms: Term[];
}

export interface Rule {
  head: Atom_;
  body: Atom_[];
}

export interface Query {
  goals: Atom_[];
  variables: Set<Variable>;
}

export type Tuple = Atom[];
export type Binding = Record<string, Atom>;

/**
 * External predicate implementations
 */
export class ExternalPredicates {
  static regex(str: string, pattern: string | RegExp): boolean {
    if (typeof pattern === 'string') {
      // Check if it's a regex pattern (contains | or starts with /)
      if (pattern.includes('|') || pattern.startsWith('/')) {
        try {
          // Remove leading/trailing slashes and create regex
          const cleanPattern = pattern.replace(/^\/|\/$/g, '');
          const regex = new RegExp(cleanPattern, 'i');
          return regex.test(str);
        } catch (e) {
          // Fall back to simple contains check
          return str.toLowerCase().includes(pattern.toLowerCase());
        }
      }
      // Simple string contains check
      return str.toLowerCase().includes(pattern.toLowerCase());
    }
    return pattern.test(str);
  }

  static gt(a: number, b: number): boolean {
    return a > b;
  }

  static lt(a: number, b: number): boolean {
    return a < b;
  }

  static between(val: number, min: number, max: number): boolean {
    return val >= min && val <= max;
  }

  static contains(str: string, substr: string): boolean {
    return str.toLowerCase().includes(substr.toLowerCase());
  }

  static after(a: Date, b: Date): boolean {
    return a > b;
  }

  static betweenDate(d: Date, start: Date, end: Date): boolean {
    return d >= start && d <= end;
  }

  static sum(values: number[]): number {
    return values.reduce((a, b) => a + b, 0);
  }

  static count(values: any[]): number {
    return values.length;
  }

  static avg(values: number[]): number {
    return values.length > 0 ? this.sum(values) / values.length : 0;
  }
}

/**
 * Datalog evaluator with proper working set
 */
export class DatalogEvaluator {
  private store: EAVStore;
  private rules: Rule[] = [];
  private ws = new Map<string, Tuple[]>(); // predicate -> tuples

  constructor(store: EAVStore) {
    this.store = store;
  }

  addRule(rule: Rule): void {
    this.rules.push(rule);
  }

  /**
   * Seed base facts into working set
   */
  private seedBaseFacts(): void {
    // attr/3 from store
    const attrRows: Tuple[] = [];
    for (const f of this.store.getAllFacts()) {
      attrRows.push([f.e, f.a, f.v]);
    }
    this.ws.set('attr', attrRows);

    // link/3 from store
    const linkRows: Tuple[] = [];
    for (const link of this.store.getAllLinks()) {
      linkRows.push([link.e1, link.a, link.e2]);
    }
    this.ws.set('link', linkRows);
  }

  /**
   * Push derived fact to working set
   */
  private pushDerived(predicate: string, tuple: Tuple): boolean {
    const bucket = this.ws.get(predicate) || [];
    if (!this.ws.has(predicate)) {
      this.ws.set(predicate, bucket);
    }

    // Structured deduplication
    const key = JSON.stringify(tuple);
    if (!(bucket as any)._keys) {
      (bucket as any)._keys = new Set<string>();
    }
    const keys: Set<string> = (bucket as any)._keys;

    if (keys.has(key)) {
      return false; // Already exists
    }

    bucket.push(tuple);
    keys.add(key);
    return true; // Added new fact
  }

  /**
   * Evaluate a query using semi-naive evaluation
   */
  evaluate(query: Query): QueryResult {
    const startTime = performance.now();

    // Seed base facts
    this.seedBaseFacts();

    let added = true;
    let iterations = 0;
    const maxIterations = 100;

    // Semi-naive evaluation loop
    while (added && iterations < maxIterations) {
      added = false;

      for (const rule of this.rules) {
        const bindings = this.findBindingsOverWS(rule.body);
        for (const binding of bindings) {
          const head = this.substitute(rule.head, binding);
          const tuple = head.terms.map((term) =>
            this.resolveTerm(term, binding),
          );
          if (this.pushDerived(head.predicate, tuple)) {
            added = true;
          }
        }
      }

      iterations++;
    }

    // Evaluate query goals
    const bindings = this.findBindingsOverWS(query.goals);

    return {
      bindings,
      executionTime: performance.now() - startTime,
      plan: `Semi-naive evaluation: ${iterations} iterations, ${this.getTotalFacts()} facts`,
    };
  }

  /**
   * Get total number of facts across all predicates
   */
  private getTotalFacts(): number {
    let total = 0;
    for (const tuples of this.ws.values()) {
      total += tuples.length;
    }
    return total;
  }

  /**
   * Find bindings over working set
   */
  private findBindingsOverWS(goals: Atom_[]): Binding[] {
    if (goals.length === 0) {
      return [{}];
    }

    let bindings: Binding[] = [{}];

    for (const goal of goals) {
      const newBindings: Binding[] = [];

      for (const binding of bindings) {
        const goalBindings = this.evaluateGoal(goal, binding);
        for (const goalBinding of goalBindings) {
          const merged = { ...binding, ...goalBinding };
          // Check for conflicts in variable bindings
          let hasConflict = false;
          for (const key in merged) {
            if (
              binding[key] !== undefined &&
              goalBinding[key] !== undefined &&
              binding[key] !== goalBinding[key]
            ) {
              hasConflict = true;
              break;
            }
          }
          if (!hasConflict) {
            newBindings.push(merged);
          }
        }
      }

      bindings = newBindings;
    }

    // Remove duplicates
    const uniqueBindings = new Map<string, Binding>();
    for (const binding of bindings) {
      const key = JSON.stringify(binding);
      uniqueBindings.set(key, binding);
    }

    return Array.from(uniqueBindings.values());
  }

  /**
   * Evaluate a single goal
   */
  private evaluateGoal(goal: Atom_, binding: Binding): Binding[] {
    const { predicate, terms } = goal;

    // Handle negation
    if (predicate === 'not') {
      const inner = goal.terms[0] as unknown as Atom_;
      const res = this.evaluateGoal(inner, binding);
      // If the inner goal fails (returns empty), negation succeeds
      // Return the current binding if negation succeeds
      return res.length === 0 ? [binding] : [];
    }

    // Handle built-in predicates
    if (predicate === 'attr') {
      return this.evaluateAttrPredicate(terms, binding);
    }

    if (predicate === 'link') {
      return this.evaluateLinkPredicate(terms, binding);
    }

    // Handle comparison predicates
    if (predicate === 'gt' || predicate === 'lt' || predicate === 'between' ||
      predicate === '>' || predicate === '<' || predicate === '>=' ||
      predicate === '<=' || predicate === '=' || predicate === '!=') {
      return this.evaluateComparisonPredicate(goal, binding);
    }

    if (predicate === 'regex' || predicate === 'contains') {
      return this.evaluateStringPredicate(goal, binding);
    }

    if (predicate === 'after' || predicate === 'betweenDate') {
      return this.evaluateDatePredicate(goal, binding);
    }

    // Handle external predicates
    if (predicate.startsWith('ext_')) {
      return this.evaluateExternalPredicate(goal, binding);
    }

    // Fall back to working set lookup
    return this.evalPredicateFromWS(predicate, terms, binding);
  }

  /**
   * Evaluate predicate from working set
   */
  private evalPredicateFromWS(
    predicate: string,
    terms: Term[],
    binding: Binding,
  ): Binding[] {
    const rows = this.ws.get(predicate) || [];
    const results: Binding[] = [];

    rowloop: for (const row of rows) {
      const newBinding = { ...binding };

      for (let i = 0; i < terms.length; i++) {
        const term = terms[i]!;
        const val = row[i]!;

        if (typeof term === 'string' && term.startsWith('?')) {
          const bound = newBinding[term];
          if (bound !== undefined && bound !== val) {
            continue rowloop; // Conflict
          }
          newBinding[term] = val;
        } else {
          if (term !== val) {
            continue rowloop; // No match
          }
        }
      }

      results.push(newBinding);
    }

    return results;
  }

  /**
   * Evaluate attr predicate
   */
  private evaluateAttrPredicate(terms: Term[], binding: Binding): Binding[] {
    if (terms.length !== 3) return [];

    // Resolve variables in terms
    const [entity, attribute, value] = terms.map((term) =>
      this.resolveTerm(term, binding),
    );
    const results: Binding[] = [];

    // If all terms are bound, check if fact exists
    if (
      typeof entity === 'string' &&
      !entity.startsWith('?') &&
      typeof attribute === 'string' &&
      !attribute.startsWith('?') &&
      (typeof value !== 'string' || !value.startsWith('?'))
    ) {
      const facts = this.store.getFactsByValue(attribute, value as Atom);
      for (const fact of facts) {
        if (fact.e === entity) {
          results.push({});
        }
      }
      return results;
    }

    // If entity and attribute are bound, find values
    if (
      typeof entity === 'string' &&
      !entity.startsWith('?') &&
      typeof attribute === 'string' &&
      !attribute.startsWith('?')
    ) {
      const facts = this.store.getFactsByEntity(entity);
      for (const fact of facts) {
        if (fact.a === attribute) {
          const newBinding = { ...binding };
          if (typeof value === 'string' && value.startsWith('?')) {
            newBinding[value] = fact.v;
          }
          results.push(newBinding);
        }
      }
      return results;
    }

    // If only attribute is bound, find entity-value pairs
    if (typeof attribute === 'string' && !attribute.startsWith('?')) {
      const facts = this.store.getFactsByAttribute(attribute);
      for (const fact of facts) {
        const newBinding = { ...binding };
        if (typeof entity === 'string' && entity.startsWith('?')) {
          newBinding[entity] = fact.e;
        }
        if (typeof value === 'string' && value.startsWith('?')) {
          newBinding[value] = fact.v;
        }
        results.push(newBinding);
      }
      return results;
    }

    return [];
  }

  /**
   * Evaluate link predicate
   */
  private evaluateLinkPredicate(terms: Term[], binding: Binding): Binding[] {
    if (terms.length !== 3) return [];

    const [e1, a, e2] = terms;
    const results: Binding[] = [];

    // Get all links from store
    const links = this.store.getAllLinks();

    for (const link of links) {
      const newBinding = { ...binding };
      let matches = true;

      if (typeof e1 === 'string' && !e1.startsWith('?')) {
        if (link.e1 !== e1) continue;
      } else if (typeof e1 === 'string' && e1.startsWith('?')) {
        newBinding[e1] = link.e1;
      }

      if (typeof a === 'string' && !a.startsWith('?')) {
        if (link.a !== a) continue;
      } else if (typeof a === 'string' && a.startsWith('?')) {
        newBinding[a] = link.a;
      }

      if (typeof e2 === 'string' && !e2.startsWith('?')) {
        if (link.e2 !== e2) continue;
      } else if (typeof e2 === 'string' && e2.startsWith('?')) {
        newBinding[e2] = link.e2;
      }

      if (matches) {
        results.push(newBinding);
      }
    }

    return results;
  }

  /**
   * Evaluate comparison predicate
   */
  private evaluateComparisonPredicate(
    goal: Atom_,
    binding: Binding,
  ): Binding[] {
    const { predicate, terms } = goal;

    if (terms.length < 2) return [];

    const left = this.resolveTerm(terms[0]!, binding);
    const right = this.resolveTerm(terms[1]!, binding);

    // Handle string comparisons for gt/lt (convert to numbers if possible)
    let leftNum = left;
    let rightNum = right;

    if (typeof left === 'string' && !isNaN(Number(left))) {
      leftNum = Number(left);
    }
    if (typeof right === 'string' && !isNaN(Number(right))) {
      rightNum = Number(right);
    }

    if (typeof leftNum !== 'number' || typeof rightNum !== 'number') return [];

    let result = false;
    switch (predicate) {
      case 'gt':
      case '>':
        result = ExternalPredicates.gt(leftNum, rightNum);
        break;
      case 'lt':
      case '<':
        result = ExternalPredicates.lt(leftNum, rightNum);
        break;
      case '>=':
        result = leftNum >= rightNum;
        break;
      case '<=':
        result = leftNum <= rightNum;
        break;
      case '=':
        result = leftNum === rightNum;
        break;
      case '!=':
        result = leftNum !== rightNum;
        break;
      case 'between':
        if (terms.length >= 3) {
          const max = this.resolveTerm(terms[2]!, binding);
          let maxNum = max;
          if (typeof max === 'string' && !isNaN(Number(max))) {
            maxNum = Number(max);
          }
          if (typeof maxNum === 'number') {
            result = ExternalPredicates.between(leftNum, rightNum, maxNum);
          }
        }
        break;
    }

    return result ? [{}] : [];
  }

  /**
   * Evaluate string predicate
   */
  private evaluateStringPredicate(goal: Atom_, binding: Binding): Binding[] {
    const { predicate, terms } = goal;

    if (terms.length < 2) return [];

    const str = this.resolveTerm(terms[0]!, binding);
    const pattern = this.resolveTerm(terms[1]!, binding);

    if (typeof str !== 'string' || typeof pattern !== 'string') return [];

    let result = false;
    switch (predicate) {
      case 'regex':
        result = ExternalPredicates.regex(str, pattern);
        break;
      case 'contains':
        result = ExternalPredicates.contains(str, pattern);
        break;
    }

    return result ? [{}] : [];
  }

  /**
   * Evaluate date predicate
   */
  private evaluateDatePredicate(goal: Atom_, binding: Binding): Binding[] {
    const { predicate, terms } = goal;

    if (terms.length < 2) return [];

    const left = this.resolveTerm(terms[0]!, binding);
    const right = this.resolveTerm(terms[1]!, binding);

    if (!(left instanceof Date) || !(right instanceof Date)) return [];

    let result = false;
    switch (predicate) {
      case 'after':
        result = ExternalPredicates.after(left, right);
        break;
      case 'betweenDate':
        if (terms.length >= 3) {
          const end = this.resolveTerm(terms[2]!, binding);
          if (end instanceof Date) {
            result = ExternalPredicates.betweenDate(left, right, end);
          }
        }
        break;
    }

    return result ? [{}] : [];
  }

  /**
   * Evaluate external predicate
   */
  private evaluateExternalPredicate(goal: Atom_, binding: Binding): Binding[] {
    const { predicate, terms } = goal;

    // Substitute variables in terms
    const resolvedTerms = terms.map((term) => this.resolveTerm(term, binding));

    // Call external predicate
    let result = false;
    switch (predicate) {
      case 'ext_regex':
        if (resolvedTerms.length >= 2 && typeof resolvedTerms[0] === 'string') {
          result = ExternalPredicates.regex(
            resolvedTerms[0],
            resolvedTerms[1] as string,
          );
        }
        break;
      case 'ext_gt':
        if (
          resolvedTerms.length >= 2 &&
          typeof resolvedTerms[0] === 'number' &&
          typeof resolvedTerms[1] === 'number'
        ) {
          result = ExternalPredicates.gt(resolvedTerms[0], resolvedTerms[1]);
        }
        break;
      case 'ext_between':
        if (
          resolvedTerms.length >= 3 &&
          typeof resolvedTerms[0] === 'number' &&
          typeof resolvedTerms[1] === 'number' &&
          typeof resolvedTerms[2] === 'number'
        ) {
          result = ExternalPredicates.between(
            resolvedTerms[0],
            resolvedTerms[1],
            resolvedTerms[2],
          );
        }
        break;
      case 'ext_contains':
        if (resolvedTerms.length >= 2 && typeof resolvedTerms[0] === 'string') {
          result = ExternalPredicates.contains(
            resolvedTerms[0],
            resolvedTerms[1] as string,
          );
        }
        break;
    }

    return result ? [{}] : [];
  }

  /**
   * Resolve term to value
   */
  private resolveTerm(term: Term, binding: Binding): Atom {
    if (typeof term === 'string' && term.startsWith('?')) {
      return binding[term] || term;
    }
    return term;
  }

  /**
   * Substitute variables in atom
   */
  private substitute(atom: Atom_, binding: Binding): Atom_ {
    return {
      predicate: atom.predicate,
      terms: atom.terms.map((term) => this.resolveTerm(term, binding)),
    };
  }
}
