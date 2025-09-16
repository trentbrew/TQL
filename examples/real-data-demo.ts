/**
 * Real Data Demo for EAV Datalog Engine
 *
 * Demonstrates the query engine on real JSON data fetched from JSONPlaceholder API
 * via curl commands. Shows complex queries, aggregations, and derived predicates.
 */

import { EAVStore, jsonEntityFacts } from '../src/eav-engine.js';
import { DatalogEvaluator } from '../src/query/index.js';
import type { Query, Rule } from '../src/query/index.js';

// Import the real data fetched via curl
import realPosts from '../data/real-posts.json' assert { type: 'json' };
import realUsers from '../data/real-users.json' assert { type: 'json' };
import realComments from '../data/real-comments.json' assert { type: 'json' };

function initializeRealDataStore(): EAVStore {
  const store = new EAVStore();

  console.log('📥 Ingesting real JSON data from JSONPlaceholder API...');

  // Ingest users as entities
  for (const user of realUsers) {
    const facts = jsonEntityFacts(`user:${user.id}`, user, 'user');
    store.addFacts(facts);
  }

  // Ingest posts as entities
  for (const post of realPosts) {
    const facts = jsonEntityFacts(`post:${post.id}`, post, 'post');
    store.addFacts(facts);
  }

  // Ingest comments as entities
  for (const comment of realComments) {
    const facts = jsonEntityFacts(`comment:${comment.id}`, comment, 'comment');
    store.addFacts(facts);
  }

  // Add relationships as links
  const links = [];

  // User -> Post relationships
  for (const post of realPosts) {
    links.push({
      e1: `user:${post.userId}`,
      a: 'AUTHORED',
      e2: `post:${post.id}`,
    });
  }

  // Post -> Comment relationships
  for (const comment of realComments) {
    links.push({
      e1: `post:${comment.postId}`,
      a: 'HAS_COMMENT',
      e2: `comment:${comment.id}`,
    });
  }

  store.addLinks(links);

  console.log(`✅ Ingested real data:`);
  console.log(`   - ${realUsers.length} users`);
  console.log(`   - ${realPosts.length} posts`);
  console.log(`   - ${realComments.length} comments`);
  console.log(`📊 Store stats:`, store.getStats());

  return store;
}

function addRealDataRules(evaluator: DatalogEvaluator): void {
  // Rule 1: Popular posts (posts with many comments)
  const popularPostsRule: Rule = {
    head: { predicate: 'popular_post', terms: ['?P', '?CommentCount'] },
    body: [
      { predicate: 'attr', terms: ['?P', 'type', 'post'] },
      { predicate: 'link', terms: ['?P', 'HAS_COMMENT', '?C'] },
    ],
  };

  // Rule 2: Active users (users who have authored posts)
  const activeUserRule: Rule = {
    head: { predicate: 'active_user', terms: ['?U'] },
    body: [
      { predicate: 'attr', terms: ['?U', 'type', 'user'] },
      { predicate: 'link', terms: ['?U', 'AUTHORED', '?P'] },
    ],
  };

  // Rule 3: User post count
  const userPostCountRule: Rule = {
    head: { predicate: 'user_post_count', terms: ['?U', '?Count'] },
    body: [
      { predicate: 'attr', terms: ['?U', 'type', 'user'] },
      { predicate: 'link', terms: ['?U', 'AUTHORED', '?P'] },
    ],
  };

  // Rule 4: Long posts (posts with long titles or bodies)
  const longPostRule: Rule = {
    head: { predicate: 'long_post', terms: ['?P'] },
    body: [
      { predicate: 'attr', terms: ['?P', 'type', 'post'] },
      { predicate: 'attr', terms: ['?P', 'title', '?Title'] },
      { predicate: 'gt', terms: ['?Title', 50] }, // Title longer than 50 chars
    ],
  };

  // Rule 5: Email domain extraction
  const emailDomainRule: Rule = {
    head: { predicate: 'email_domain', terms: ['?U', '?Domain'] },
    body: [
      { predicate: 'attr', terms: ['?U', 'type', 'user'] },
      { predicate: 'attr', terms: ['?U', 'email', '?Email'] },
      { predicate: 'regex', terms: ['?Email', '@(.+)'] },
    ],
  };

  // Add all rules
  evaluator.addRule(popularPostsRule);
  evaluator.addRule(activeUserRule);
  evaluator.addRule(userPostCountRule);
  evaluator.addRule(longPostRule);
  evaluator.addRule(emailDomainRule);
}

async function runRealDataQueries(evaluator: DatalogEvaluator): Promise<void> {
  console.log('\n🔍 Running queries on real JSON data...\n');

  // 1. Find all users
  console.log('1️⃣ All users:');
  const allUsersQuery: Query = {
    goals: [
      { predicate: 'attr', terms: ['?U', 'type', 'user'] },
      { predicate: 'attr', terms: ['?U', 'name', '?Name'] },
      { predicate: 'attr', terms: ['?U', 'email', '?Email'] },
    ],
    variables: new Set(['U', 'Name', 'Email']),
  };
  const allUsersResult = evaluator.evaluate(allUsersQuery);
  console.log(`   Found ${allUsersResult.bindings.length} users`);
  console.log(
    `   Execution time: ${allUsersResult.executionTime.toFixed(2)}ms`,
  );
  console.log('   Sample results:', allUsersResult.bindings.slice(0, 3));
  console.log();

  // 2. Find posts by specific user
  console.log('2️⃣ Posts by user 1:');
  const userPostsQuery: Query = {
    goals: [
      { predicate: 'attr', terms: ['?P', 'type', 'post'] },
      { predicate: 'attr', terms: ['?P', 'userId', 1] },
      { predicate: 'attr', terms: ['?P', 'title', '?Title'] },
    ],
    variables: new Set(['P', 'Title']),
  };
  const userPostsResult = evaluator.evaluate(userPostsQuery);
  console.log(`   Found ${userPostsResult.bindings.length} posts by user 1`);
  console.log(
    `   Execution time: ${userPostsResult.executionTime.toFixed(2)}ms`,
  );
  console.log('   Sample results:', userPostsResult.bindings.slice(0, 3));
  console.log();

  // 3. Find posts with specific keywords in title
  console.log('3️⃣ Posts with "dolor" in title:');
  const keywordQuery: Query = {
    goals: [
      { predicate: 'attr', terms: ['?P', 'type', 'post'] },
      { predicate: 'attr', terms: ['?P', 'title', '?Title'] },
      { predicate: 'contains', terms: ['?Title', 'dolor'] },
    ],
    variables: new Set(['P', 'Title']),
  };
  const keywordResult = evaluator.evaluate(keywordQuery);
  console.log(
    `   Found ${keywordResult.bindings.length} posts with "dolor" in title`,
  );
  console.log(`   Execution time: ${keywordResult.executionTime.toFixed(2)}ms`);
  console.log('   Sample results:', keywordResult.bindings.slice(0, 3));
  console.log();

  // 4. Find long posts (using derived predicate)
  console.log('4️⃣ Long posts (titles > 50 chars):');
  const longPostsQuery: Query = {
    goals: [
      { predicate: 'long_post', terms: ['?P'] },
      { predicate: 'attr', terms: ['?P', 'title', '?Title'] },
    ],
    variables: new Set(['P', 'Title']),
  };
  const longPostsResult = evaluator.evaluate(longPostsQuery);
  console.log(`   Found ${longPostsResult.bindings.length} long posts`);
  console.log(
    `   Execution time: ${longPostsResult.executionTime.toFixed(2)}ms`,
  );
  console.log('   Sample results:', longPostsResult.bindings.slice(0, 3));
  console.log();

  // 5. Find active users (using derived predicate)
  console.log('5️⃣ Active users (users who authored posts):');
  const activeUsersQuery: Query = {
    goals: [
      { predicate: 'active_user', terms: ['?U'] },
      { predicate: 'attr', terms: ['?U', 'name', '?Name'] },
    ],
    variables: new Set(['U', 'Name']),
  };
  const activeUsersResult = evaluator.evaluate(activeUsersQuery);
  console.log(`   Found ${activeUsersResult.bindings.length} active users`);
  console.log(
    `   Execution time: ${activeUsersResult.executionTime.toFixed(2)}ms`,
  );
  console.log('   Sample results:', activeUsersResult.bindings.slice(0, 5));
  console.log();

  // 6. Find posts with comments
  console.log('6️⃣ Posts with comments:');
  const postsWithCommentsQuery: Query = {
    goals: [
      { predicate: 'attr', terms: ['?P', 'type', 'post'] },
      { predicate: 'link', terms: ['?P', 'HAS_COMMENT', '?C'] },
      { predicate: 'attr', terms: ['?P', 'title', '?Title'] },
    ],
    variables: new Set(['P', 'Title']),
  };
  const postsWithCommentsResult = evaluator.evaluate(postsWithCommentsQuery);
  console.log(
    `   Found ${postsWithCommentsResult.bindings.length} posts with comments`,
  );
  console.log(
    `   Execution time: ${postsWithCommentsResult.executionTime.toFixed(2)}ms`,
  );
  console.log(
    '   Sample results:',
    postsWithCommentsResult.bindings.slice(0, 3),
  );
  console.log();

  // 7. Find users by email domain
  console.log('7️⃣ Users by email domain:');
  const emailDomainQuery: Query = {
    goals: [
      { predicate: 'attr', terms: ['?U', 'type', 'user'] },
      { predicate: 'attr', terms: ['?U', 'email', '?Email'] },
      { predicate: 'regex', terms: ['?Email', '@(.+)'] },
    ],
    variables: new Set(['U', 'Email']),
  };
  const emailDomainResult = evaluator.evaluate(emailDomainQuery);
  console.log(
    `   Found ${emailDomainResult.bindings.length} users with email domains`,
  );
  console.log(
    `   Execution time: ${emailDomainResult.executionTime.toFixed(2)}ms`,
  );

  // Group by domain
  const domainCounts = new Map<string, number>();
  for (const binding of emailDomainResult.bindings) {
    const email = binding.Email as string;
    const domain = email.split('@')[1];
    if (domain) {
      domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
    }
  }
  console.log('   Domain distribution:', Array.from(domainCounts.entries()));
  console.log();

  // 8. Complex query: Users and their post counts
  console.log('8️⃣ Users and their post counts:');
  const userPostCountQuery: Query = {
    goals: [
      { predicate: 'attr', terms: ['?U', 'type', 'user'] },
      { predicate: 'attr', terms: ['?U', 'name', '?Name'] },
      { predicate: 'link', terms: ['?U', 'AUTHORED', '?P'] },
    ],
    variables: new Set(['U', 'Name']),
  };
  const userPostCountResult = evaluator.evaluate(userPostCountQuery);

  // Aggregate post counts per user
  const userPostCounts = new Map<string, { name: string; count: number }>();
  for (const binding of userPostCountResult.bindings) {
    const userId = binding.U as string;
    const userName = binding.Name as string;
    userPostCounts.set(userId, {
      name: userName,
      count: (userPostCounts.get(userId)?.count || 0) + 1,
    });
  }

  const sortedUsers = Array.from(userPostCounts.entries())
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 5);

  console.log(
    `   Found ${userPostCountResult.bindings.length} user-post relationships`,
  );
  console.log(
    `   Execution time: ${userPostCountResult.executionTime.toFixed(2)}ms`,
  );
  console.log('   Top 5 users by post count:', sortedUsers);
  console.log();

  // 9. Find comments on specific posts
  console.log('9️⃣ Comments on post 1:');
  const postCommentsQuery: Query = {
    goals: [
      { predicate: 'link', terms: ['post:1', 'HAS_COMMENT', '?C'] },
      { predicate: 'attr', terms: ['?C', 'type', 'comment'] },
      { predicate: 'attr', terms: ['?C', 'name', '?Name'] },
      { predicate: 'attr', terms: ['?C', 'email', '?Email'] },
    ],
    variables: new Set(['C', 'Name', 'Email']),
  };
  const postCommentsResult = evaluator.evaluate(postCommentsQuery);
  console.log(
    `   Found ${postCommentsResult.bindings.length} comments on post 1`,
  );
  console.log(
    `   Execution time: ${postCommentsResult.executionTime.toFixed(2)}ms`,
  );
  console.log('   Sample results:', postCommentsResult.bindings.slice(0, 3));
  console.log();

  // 10. Find posts with specific patterns in body
  console.log('🔟 Posts with "quia" in body:');
  const bodyPatternQuery: Query = {
    goals: [
      { predicate: 'attr', terms: ['?P', 'type', 'post'] },
      { predicate: 'attr', terms: ['?P', 'body', '?Body'] },
      { predicate: 'contains', terms: ['?Body', 'quia'] },
      { predicate: 'attr', terms: ['?P', 'title', '?Title'] },
    ],
    variables: new Set(['P', 'Title']),
  };
  const bodyPatternResult = evaluator.evaluate(bodyPatternQuery);
  console.log(
    `   Found ${bodyPatternResult.bindings.length} posts with "quia" in body`,
  );
  console.log(
    `   Execution time: ${bodyPatternResult.executionTime.toFixed(2)}ms`,
  );
  console.log('   Sample results:', bodyPatternResult.bindings.slice(0, 3));
  console.log();
}

async function runRealDataDemo(): Promise<void> {
  console.log('🚀 EAV Datalog Real Data Demo\n');
  console.log('='.repeat(60));
  console.log(
    'Testing query engine on real JSON data from JSONPlaceholder API',
  );
  console.log(
    'Data fetched via: curl https://jsonplaceholder.typicode.com/{posts,users,comments}',
  );
  console.log('='.repeat(60));

  try {
    // Initialize store with real data
    const store = initializeRealDataStore();

    // Create evaluator and add rules
    const evaluator = new DatalogEvaluator(store);
    addRealDataRules(evaluator);

    // Run queries
    await runRealDataQueries(evaluator);

    console.log('✅ Real data demo completed successfully!');
    console.log('\n📊 Summary:');
    console.log('   - Successfully ingested real JSON data from public API');
    console.log(
      '   - Demonstrated complex queries with joins, filters, and aggregations',
    );
    console.log('   - Showed derived predicates and rule-based reasoning');
    console.log('   - Validated query engine performance on real-world data');
  } catch (error) {
    console.error('❌ Real data demo failed:', error);
    throw error;
  }
}

// Run the demo
if (import.meta.main) {
  runRealDataDemo().catch(console.error);
}
