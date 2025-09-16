/**
 * Query Examples for Posts Data
 *
 * Demonstrates the EAV Datalog engine with real queries on posts.json
 */

import { EAVStore, jsonEntityFacts } from '../eav-engine.js';
import { DatalogEvaluator } from './datalog-evaluator.js';
import type { Query, Atom_, Rule } from './datalog-evaluator.js';

/**
 * Query builder for common patterns
 */
export class QueryBuilder {
  private evaluator: DatalogEvaluator;

  constructor(evaluator: DatalogEvaluator) {
    this.evaluator = evaluator;
  }

  /**
   * Popular crime posts (>1000 likes)
   */
  popularCrimePosts(): Query {
    return {
      goals: [
        { predicate: 'attr', terms: ['?P', 'type', 'post'] },
        { predicate: 'attr', terms: ['?P', 'tags', 'crime'] },
        { predicate: 'attr', terms: ['?P', 'reactions.likes', '?Likes'] },
        { predicate: 'gt', terms: ['?Likes', 1000] },
      ],
      variables: new Set(['P', 'Likes']),
    };
  }

  /**
   * Posts with storm or forest in body, views between 1000-5000
   */
  stormyMidViews(): Query {
    return {
      goals: [
        { predicate: 'attr', terms: ['?P', 'type', 'post'] },
        { predicate: 'attr', terms: ['?P', 'body', '?Body'] },
        { predicate: 'regex', terms: ['?Body', '(storm|forest)'] },
        { predicate: 'attr', terms: ['?P', 'views', '?Views'] },
        { predicate: 'between', terms: ['?Views', 1000, 5000] },
      ],
      variables: new Set(['P', 'Body', 'Views']),
    };
  }

  /**
   * Top tags by total likes (aggregation example)
   */
  topTagsByLikes(): Query {
    return {
      goals: [
        { predicate: 'attr', terms: ['?P', 'type', 'post'] },
        { predicate: 'attr', terms: ['?P', 'tags', '?Tag'] },
        { predicate: 'attr', terms: ['?P', 'reactions.likes', '?Likes'] },
      ],
      variables: new Set(['Tag', 'Likes']),
    };
  }

  /**
   * Posts with high engagement (likes > views/2)
   */
  highEngagementPosts(): Query {
    return {
      goals: [
        { predicate: 'attr', terms: ['?P', 'type', 'post'] },
        { predicate: 'attr', terms: ['?P', 'reactions.likes', '?Likes'] },
        { predicate: 'attr', terms: ['?P', 'views', '?Views'] },
        { predicate: 'gt', terms: ['?Likes', '?HalfViews'] },
      ],
      variables: new Set(['P', 'Likes', 'Views']),
    };
  }

  /**
   * Posts by specific user
   */
  postsByUser(userId: number): Query {
    return {
      goals: [
        { predicate: 'attr', terms: ['?P', 'type', 'post'] },
        { predicate: 'attr', terms: ['?P', 'userId', userId] },
      ],
      variables: new Set(['P']),
    };
  }

  /**
   * Posts with specific tag
   */
  postsWithTag(tag: string): Query {
    return {
      goals: [
        { predicate: 'attr', terms: ['?P', 'type', 'post'] },
        { predicate: 'attr', terms: ['?P', 'tags', tag] },
      ],
      variables: new Set(['P']),
    };
  }

  /**
   * Posts with title containing keyword
   */
  postsWithTitleKeyword(keyword: string): Query {
    return {
      goals: [
        { predicate: 'attr', terms: ['?P', 'type', 'post'] },
        { predicate: 'attr', terms: ['?P', 'title', '?Title'] },
        { predicate: 'contains', terms: ['?Title', keyword] },
      ],
      variables: new Set(['P', 'Title']),
    };
  }
}

/**
 * Example email queries (for future extension)
 */
export class EmailQueryBuilder {
  private evaluator: DatalogEvaluator;

  constructor(evaluator: DatalogEvaluator) {
    this.evaluator = evaluator;
  }

  /**
   * Emails awaiting reply
   */
  awaitingReply(): Query {
    return {
      goals: [
        { predicate: 'attr', terms: ['?M', 'type', 'email'] },
        { predicate: 'attr', terms: ['?M', 'is_last_in_thread', true] },
        { predicate: 'attr', terms: ['?M', 'to', 'trent@...'] },
        // Note: Negation not yet implemented in current system
        // { predicate: 'not', terms: [{ predicate: 'attr', terms: ['?M', 'label', 'SENT'] }] },
      ],
      variables: new Set(['M']),
    };
  }

  /**
   * Unpaid invoices
   */
  unpaidInvoices(): Query {
    return {
      goals: [
        { predicate: 'attr', terms: ['?M', 'type', 'email'] },
        { predicate: 'attr', terms: ['?M', 'subject', '?Subject'] },
        { predicate: 'ext_regex', terms: ['?Subject', 'invoice|receipt|bill'] },
      ],
      variables: new Set(['M', 'Subject']),
    };
  }
}

/**
 * Utility functions for running queries
 */
export class QueryRunner {
  private store: EAVStore;
  private evaluator: DatalogEvaluator;
  private queryBuilder: QueryBuilder;

  constructor(store: EAVStore) {
    this.store = store;
    this.evaluator = new DatalogEvaluator(store);
    this.queryBuilder = new QueryBuilder(this.evaluator);

    // Add some useful derived predicate rules
    this.addDerivedPredicates();
  }

  /**
   * Add useful derived predicate rules
   */
  private addDerivedPredicates(): void {
    // Popular posts rule
    const popularRule: Rule = {
      head: { predicate: 'popular', terms: ['?P', '?Likes'] },
      body: [
        { predicate: 'attr', terms: ['?P', 'type', 'post'] },
        { predicate: 'attr', terms: ['?P', 'reactions.likes', '?Likes'] },
        { predicate: 'gt', terms: ['?Likes', 500] },
      ],
    };

    // Very popular posts rule
    const veryPopularRule: Rule = {
      head: { predicate: 'very_popular', terms: ['?P'] },
      body: [
        { predicate: 'popular', terms: ['?P', '?Likes'] },
        { predicate: 'gt', terms: ['?Likes', 1000] },
      ],
    };

    // Unfeatured posts rule (using negation)
    const unfeaturedRule: Rule = {
      head: { predicate: 'unfeatured', terms: ['?P'] },
      body: [
        { predicate: 'attr', terms: ['?P', 'type', 'post'] },
        // Note: Negation not yet implemented in current system
        // { predicate: 'not', terms: [{ predicate: 'attr', terms: ['?P', 'label', 'featured'] }] },
      ],
    };

    this.evaluator.addRule(popularRule);
    this.evaluator.addRule(veryPopularRule);
    this.evaluator.addRule(unfeaturedRule);
  }

  /**
   * Run a query and return formatted results
   */
  async runQuery(query: Query): Promise<any> {
    const result = this.evaluator.evaluate(query);

    return {
      results: result.bindings,
      count: result.bindings.length,
      executionTime: result.executionTime,
      plan: result.plan,
    };
  }

  /**
   * Run popular crime posts query
   */
  async getPopularCrimePosts(): Promise<any> {
    return this.runQuery(this.queryBuilder.popularCrimePosts());
  }

  /**
   * Run stormy mid-views query
   */
  async getStormyMidViews(): Promise<any> {
    return this.runQuery(this.queryBuilder.stormyMidViews());
  }

  /**
   * Run top tags by likes query
   */
  async getTopTagsByLikes(): Promise<any> {
    const result = await this.runQuery(this.queryBuilder.topTagsByLikes());

    // Group by tag and sum likes
    const tagLikes = new Map<string, number>();
    for (const binding of result.results) {
      const tag = binding.Tag as string;
      const likes = binding.Likes as number;
      tagLikes.set(tag, (tagLikes.get(tag) || 0) + likes);
    }

    // Sort by total likes
    const sortedTags = Array.from(tagLikes.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([tag, totalLikes]) => ({ tag, totalLikes }));

    return {
      ...result,
      aggregatedResults: sortedTags,
    };
  }

  /**
   * Run high engagement posts query
   */
  async getHighEngagementPosts(): Promise<any> {
    return this.runQuery(this.queryBuilder.highEngagementPosts());
  }

  /**
   * Run posts by user query
   */
  async getPostsByUser(userId: number): Promise<any> {
    return this.runQuery(this.queryBuilder.postsByUser(userId));
  }

  /**
   * Run posts with tag query
   */
  async getPostsWithTag(tag: string): Promise<any> {
    return this.runQuery(this.queryBuilder.postsWithTag(tag));
  }

  /**
   * Run posts with title keyword query
   */
  async getPostsWithTitleKeyword(keyword: string): Promise<any> {
    return this.runQuery(this.queryBuilder.postsWithTitleKeyword(keyword));
  }

  /**
   * Get popular posts using derived predicate
   */
  async getPopularPosts(): Promise<any> {
    const query: Query = {
      goals: [{ predicate: 'popular', terms: ['?P', '?Likes'] }],
      variables: new Set(['P', 'Likes']),
    };
    return this.runQuery(query);
  }

  /**
   * Get very popular posts using chained derived predicate
   */
  async getVeryPopularPosts(): Promise<any> {
    const query: Query = {
      goals: [{ predicate: 'very_popular', terms: ['?P'] }],
      variables: new Set(['P']),
    };
    return this.runQuery(query);
  }

  /**
   * Get unfeatured posts using negation
   */
  async getUnfeaturedPosts(): Promise<any> {
    const query: Query = {
      goals: [{ predicate: 'unfeatured', terms: ['?P'] }],
      variables: new Set(['P']),
    };
    return this.runQuery(query);
  }

  /**
   * Get popular unfeatured posts (complex query)
   */
  async getPopularUnfeaturedPosts(): Promise<any> {
    const query: Query = {
      goals: [
        { predicate: 'popular', terms: ['?P', '?Likes'] },
        { predicate: 'unfeatured', terms: ['?P'] },
      ],
      variables: new Set(['P', 'Likes']),
    };
    return this.runQuery(query);
  }

  /**
   * Get catalog information
   */
  getCatalog(): any {
    return {
      entries: this.store.getCatalog(),
      stats: this.store.getStats(),
    };
  }
}
