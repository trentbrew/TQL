/**
 * EAV Datalog Engine Demo
 *
 * Demonstrates the schema-agnostic EAV engine with posts.json data
 */

import { EAVStore, jsonEntityFacts } from '../src/eav-engine.js';
import { QueryRunner } from '../src/query/index.js';
import postsData from '../data/posts.json' assert { type: 'json' };

/**
 * Initialize the EAV store with posts data
 */
function initializeStore(): EAVStore {
  const store = new EAVStore();

  console.log('📥 Ingesting posts data...');

  // Convert each post to EAV facts
  for (const post of postsData) {
    const entityId = `post:${post.id}`;
    const facts = jsonEntityFacts(entityId, post, 'post');
    store.addFacts(facts);
  }

  // Add some sample labels to demonstrate negation
  store.addFacts([
    { e: 'post:1', a: 'label', v: 'featured' },
    { e: 'post:2', a: 'label', v: 'featured' },
    { e: 'post:3', a: 'label', v: 'archived' },
  ]);

  console.log(`✅ Ingested ${postsData.length} posts`);
  console.log(`📊 Store stats:`, store.getStats());

  return store;
}

/**
 * Run example queries
 */
async function runExampleQueries(runner: QueryRunner): Promise<void> {
  console.log('\n🔍 Running example queries...\n');

  // 1. Popular crime posts (>1000 likes)
  console.log('1️⃣ Popular crime posts (>1000 likes):');
  const popularCrime = await runner.getPopularCrimePosts();
  console.log(`   Found ${popularCrime.count} posts`);
  console.log(`   Execution time: ${popularCrime.executionTime}ms`);
  if (popularCrime.results.length > 0) {
    console.log('   Sample results:', popularCrime.results.slice(0, 3));
  }
  console.log();

  // 2. Stormy mid-views posts
  console.log('2️⃣ Posts with "storm" or "forest" in body, views 1000-5000:');
  const stormyMidViews = await runner.getStormyMidViews();
  console.log(`   Found ${stormyMidViews.count} posts`);
  console.log(`   Execution time: ${stormyMidViews.executionTime}ms`);
  if (stormyMidViews.results.length > 0) {
    console.log('   Sample results:', stormyMidViews.results.slice(0, 3));
  }
  console.log();

  // 3. Top tags by total likes
  console.log('3️⃣ Top tags by total likes:');
  const topTags = await runner.getTopTagsByLikes();
  console.log(`   Execution time: ${topTags.executionTime}ms`);
  if (topTags.aggregatedResults) {
    console.log('   Top 10 tags:');
    topTags.aggregatedResults.slice(0, 10).forEach((item: any, i: number) => {
      console.log(`   ${i + 1}. ${item.tag}: ${item.totalLikes} likes`);
    });
  }
  console.log();

  // 4. Posts by specific user
  console.log('4️⃣ Posts by user 121:');
  const userPosts = await runner.getPostsByUser(121);
  console.log(`   Found ${userPosts.count} posts`);
  console.log(`   Execution time: ${userPosts.executionTime}ms`);
  console.log();

  // 5. Posts with specific tag
  console.log('5️⃣ Posts with "crime" tag:');
  const crimePosts = await runner.getPostsWithTag('crime');
  console.log(`   Found ${crimePosts.count} posts`);
  console.log(`   Execution time: ${crimePosts.executionTime}ms`);
  console.log();

  // 6. Posts with title keyword
  console.log('6️⃣ Posts with "forest" in title:');
  const forestPosts = await runner.getPostsWithTitleKeyword('forest');
  console.log(`   Found ${forestPosts.count} posts`);
  console.log(`   Execution time: ${forestPosts.executionTime}ms`);
  if (forestPosts.results.length > 0) {
    console.log('   Sample results:', forestPosts.results.slice(0, 3));
  }
  console.log();

  // 7. Popular posts (derived predicate)
  console.log('7️⃣ Popular posts (>500 likes) - Derived Predicate:');
  const popularPosts = await runner.getPopularPosts();
  console.log(`   Found ${popularPosts.count} posts`);
  console.log(`   Execution time: ${popularPosts.executionTime}ms`);
  if (popularPosts.results.length > 0) {
    console.log('   Sample results:', popularPosts.results.slice(0, 3));
  }
  console.log();

  // 8. Very popular posts (chained derived predicate)
  console.log('8️⃣ Very popular posts (>1000 likes) - Chained Rule:');
  const veryPopularPosts = await runner.getVeryPopularPosts();
  console.log(`   Found ${veryPopularPosts.count} posts`);
  console.log(`   Execution time: ${veryPopularPosts.executionTime}ms`);
  if (veryPopularPosts.results.length > 0) {
    console.log('   Sample results:', veryPopularPosts.results.slice(0, 3));
  }
  console.log();

  // 9. Unfeatured posts (negation)
  console.log('9️⃣ Unfeatured posts (no "featured" label) - Negation:');
  const unfeaturedPosts = await runner.getUnfeaturedPosts();
  console.log(`   Found ${unfeaturedPosts.count} posts`);
  console.log(`   Execution time: ${unfeaturedPosts.executionTime}ms`);
  if (unfeaturedPosts.results.length > 0) {
    console.log('   Sample results:', unfeaturedPosts.results.slice(0, 3));
  }
  console.log();

  // 10. Popular unfeatured posts (complex query)
  console.log('🔟 Popular unfeatured posts - Complex Query:');
  const popularUnfeaturedPosts = await runner.getPopularUnfeaturedPosts();
  console.log(`   Found ${popularUnfeaturedPosts.count} posts`);
  console.log(`   Execution time: ${popularUnfeaturedPosts.executionTime}ms`);
  if (popularUnfeaturedPosts.results.length > 0) {
    console.log(
      '   Sample results:',
      popularUnfeaturedPosts.results.slice(0, 3),
    );
  }
  console.log();
}

/**
 * Display catalog information
 */
function displayCatalog(runner: QueryRunner): void {
  console.log('📋 Catalog Information:\n');

  const catalog = runner.getCatalog();

  console.log('📊 Store Statistics:');
  console.log(`   Total facts: ${catalog.stats.totalFacts}`);
  console.log(`   Unique entities: ${catalog.stats.uniqueEntities}`);
  console.log(`   Unique attributes: ${catalog.stats.uniqueAttributes}`);
  console.log(`   Catalog entries: ${catalog.stats.catalogEntries}`);
  console.log();

  console.log('🏷️  Attribute Catalog:');
  catalog.entries.forEach((entry: any) => {
    console.log(`   ${entry.attribute}:`);
    console.log(`     Type: ${entry.type}`);
    console.log(`     Cardinality: ${entry.cardinality}`);
    console.log(`     Distinct values: ${entry.distinctCount}`);
    if (entry.examples.length > 0) {
      console.log(`     Examples: ${entry.examples.slice(0, 3).join(', ')}`);
    }
    if (entry.min !== undefined && entry.max !== undefined) {
      console.log(`     Range: ${entry.min} - ${entry.max}`);
    }
    console.log();
  });
}

/**
 * Demonstrate schema-agnostic nature
 */
function demonstrateSchemaAgnostic(store: EAVStore): void {
  console.log('🔄 Schema-Agnostic Demonstration:\n');

  // Show how we can query any attribute without schema knowledge
  const allAttributes = store.getCatalog().map((entry: any) => entry.attribute);
  console.log('📝 All discovered attributes:');
  allAttributes.forEach((attr: string) => {
    console.log(`   - ${attr}`);
  });
  console.log();

  // Show how we can add new data types without schema changes
  console.log('➕ Adding sample email data (no schema changes needed):');
  const emailFacts = jsonEntityFacts(
    'email:1',
    {
      subject: 'Invoice #12345',
      body: 'Please pay your invoice of $500 by 2024-01-15',
      from: 'billing@example.com',
      to: 'trent@example.com',
      date: new Date('2024-01-01'),
      labels: ['unpaid', 'invoice'],
      amount: 500,
      dueDate: new Date('2024-01-15'),
    },
    'email',
  );

  store.addFacts(emailFacts);
  console.log(`   Added ${emailFacts.length} email facts`);
  console.log(`   New store stats:`, store.getStats());
  console.log();

  // Show how the same query patterns work across domains
  console.log('🔄 Cross-domain query example:');
  const invoiceEmails = store.getFactsByValue('subject', 'Invoice #12345');
  console.log(`   Found ${invoiceEmails.length} emails with invoice subject`);
  console.log();
}

/**
 * Main demo function
 */
async function runDemo(): Promise<void> {
  console.log('🚀 EAV Datalog Engine Demo\n');
  console.log('='.repeat(50));

  try {
    // Initialize store with posts data
    const store = initializeStore();

    // Create query runner
    const runner = new QueryRunner(store);

    // Display catalog
    displayCatalog(runner);

    // Run example queries
    await runExampleQueries(runner);

    // Demonstrate schema-agnostic nature
    demonstrateSchemaAgnostic(store);

    console.log('✅ Demo completed successfully!');
  } catch (error) {
    console.error('❌ Demo failed:', error);
    throw error;
  }
}

// Export for use in other modules
export { runDemo, initializeStore, QueryRunner };

// Run demo if this file is executed directly
if (import.meta.main) {
  runDemo().catch(console.error);
}
