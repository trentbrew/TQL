/**
 * Graph Demo for EAV Datalog Engine
 *
 * Demonstrates graph query capabilities with reachability, motifs, and path queries
 */

import { EAVStore, jsonEntityFacts } from '../src/eav-engine.js';
import { DatalogEvaluator } from '../src/query/index.js';
import type { Query, Rule } from '../src/query/index.js';
import graphData from '../data/graph.json' assert { type: 'json' };

function initializeGraphStore(): EAVStore {
  const store = new EAVStore();

  console.log('📥 Ingesting graph data...');

  // Ingest entities as facts
  for (const user of graphData.users) {
    const facts = jsonEntityFacts(`user:${user.id}`, user, 'user');
    store.addFacts(facts);
  }

  for (const org of graphData.orgs) {
    const facts = jsonEntityFacts(`org:${org.id}`, org, 'org');
    store.addFacts(facts);
  }

  for (const tag of graphData.tags) {
    const facts = jsonEntityFacts(`tag:${tag.id}`, tag, 'tag');
    store.addFacts(facts);
  }

  for (const post of graphData.posts) {
    const facts = jsonEntityFacts(`post:${post.id}`, post, 'post');
    store.addFacts(facts);
  }

  // Ingest reified edges as entities
  for (const edge of graphData.edges_reified) {
    const facts = jsonEntityFacts(edge.id, edge, 'edge');
    store.addFacts(facts);
  }

  // Ingest relationship edges as links
  store.addLinks(graphData.edges);

  console.log(`✅ Ingested graph data`);
  console.log(`📊 Store stats:`, store.getStats());

  return store;
}

function addGraphRules(evaluator: DatalogEvaluator): void {
  // Rule 1: Reachability (transitive closure)
  const reachabilityRule: Rule = {
    head: { predicate: 'reach', terms: ['?X', '?Y'] },
    body: [{ predicate: 'link', terms: ['?X', '?A', '?Y'] }],
  };

  const reachabilityRecursiveRule: Rule = {
    head: { predicate: 'reach', terms: ['?X', '?Y'] },
    body: [
      { predicate: 'link', terms: ['?X', '?A', '?Z'] },
      { predicate: 'reach', terms: ['?Z', '?Y'] },
    ],
  };

  // Rule 2: Follow reachability (only FOLLOWS edges)
  const followReachRule: Rule = {
    head: { predicate: 'follow_reach', terms: ['?X', '?Y'] },
    body: [{ predicate: 'link', terms: ['?X', 'FOLLOWS', '?Y'] }],
  };

  const followReachRecursiveRule: Rule = {
    head: { predicate: 'follow_reach', terms: ['?X', '?Y'] },
    body: [
      { predicate: 'link', terms: ['?X', 'FOLLOWS', '?Z'] },
      { predicate: 'follow_reach', terms: ['?Z', '?Y'] },
    ],
  };

  // Rule 3: Triangles (3-cycles)
  const triangleRule: Rule = {
    head: { predicate: 'triangle', terms: ['?A', '?B', '?C'] },
    body: [
      { predicate: 'link', terms: ['?A', '?R1', '?B'] },
      { predicate: 'link', terms: ['?B', '?R2', '?C'] },
      { predicate: 'link', terms: ['?C', '?R3', '?A'] },
    ],
  };

  // Rule 4: Path length 2 (2-hop connections)
  const path2Rule: Rule = {
    head: { predicate: 'path2', terms: ['?X', '?Y', '?Z'] },
    body: [
      { predicate: 'link', terms: ['?X', '?R1', '?Y'] },
      { predicate: 'link', terms: ['?Y', '?R2', '?Z'] },
    ],
  };

  // Rule 5: Influential users (users who are mentioned in posts)
  const influentialRule: Rule = {
    head: { predicate: 'influential', terms: ['?U'] },
    body: [{ predicate: 'link', terms: ['?P', 'MENTIONS', '?U'] }],
  };

  // Rule 6: Content creators (users who posted content)
  const creatorRule: Rule = {
    head: { predicate: 'creator', terms: ['?U', '?P'] },
    body: [{ predicate: 'link', terms: ['?U', 'POSTED', '?P'] }],
  };

  // Add all rules
  evaluator.addRule(reachabilityRule);
  evaluator.addRule(reachabilityRecursiveRule);
  evaluator.addRule(followReachRule);
  evaluator.addRule(followReachRecursiveRule);
  evaluator.addRule(triangleRule);
  evaluator.addRule(path2Rule);
  evaluator.addRule(influentialRule);
  evaluator.addRule(creatorRule);
}

async function runGraphQueries(evaluator: DatalogEvaluator): Promise<void> {
  console.log('\n🔍 Running graph queries...\n');

  // 1. Direct connections
  console.log('1️⃣ Direct FOLLOWS connections:');
  const followsQuery: Query = {
    goals: [{ predicate: 'link', terms: ['?X', 'FOLLOWS', '?Y'] }],
    variables: new Set(['X', 'Y']),
  };
  const followsResult = evaluator.evaluate(followsQuery);
  console.log(`   Found ${followsResult.bindings.length} connections`);
  console.log(`   Execution time: ${followsResult.executionTime}ms`);
  console.log('   Sample results:', followsResult.bindings.slice(0, 5));
  console.log();

  // 2. Reachability (transitive closure)
  console.log('2️⃣ Reachability (transitive closure):');
  const reachQuery: Query = {
    goals: [{ predicate: 'reach', terms: ['u1', '?Y'] }],
    variables: new Set(['Y']),
  };
  const reachResult = evaluator.evaluate(reachQuery);
  console.log(
    `   Found ${reachResult.bindings.length} reachable nodes from u1`,
  );
  console.log(`   Execution time: ${reachResult.executionTime}ms`);
  console.log('   Sample results:', reachResult.bindings.slice(0, 5));
  console.log();

  // 3. Follow reachability (only FOLLOWS edges)
  console.log('3️⃣ Follow reachability (FOLLOWS only):');
  const followReachQuery: Query = {
    goals: [{ predicate: 'follow_reach', terms: ['u1', '?Y'] }],
    variables: new Set(['Y']),
  };
  const followReachResult = evaluator.evaluate(followReachQuery);
  console.log(
    `   Found ${followReachResult.bindings.length} follow-reachable nodes from u1`,
  );
  console.log(`   Execution time: ${followReachResult.executionTime}ms`);
  console.log('   Sample results:', followReachResult.bindings.slice(0, 5));
  console.log();

  // 4. Triangles (3-cycles)
  console.log('4️⃣ Triangles (3-cycles):');
  const triangleQuery: Query = {
    goals: [{ predicate: 'triangle', terms: ['?A', '?B', '?C'] }],
    variables: new Set(['A', 'B', 'C']),
  };
  const triangleResult = evaluator.evaluate(triangleQuery);
  console.log(`   Found ${triangleResult.bindings.length} triangles`);
  console.log(`   Execution time: ${triangleResult.executionTime}ms`);
  console.log('   Sample results:', triangleResult.bindings.slice(0, 3));
  console.log();

  // 5. 2-hop paths
  console.log('5️⃣ 2-hop paths:');
  const path2Query: Query = {
    goals: [{ predicate: 'path2', terms: ['u1', '?Y', '?Z'] }],
    variables: new Set(['Y', 'Z']),
  };
  const path2Result = evaluator.evaluate(path2Query);
  console.log(`   Found ${path2Result.bindings.length} 2-hop paths from u1`);
  console.log(`   Execution time: ${path2Result.executionTime}ms`);
  console.log('   Sample results:', path2Result.bindings.slice(0, 3));
  console.log();

  // 6. Influential users (mentioned in posts)
  console.log('6️⃣ Influential users (mentioned in posts):');
  const influentialQuery: Query = {
    goals: [{ predicate: 'influential', terms: ['?U'] }],
    variables: new Set(['U']),
  };
  const influentialResult = evaluator.evaluate(influentialQuery);
  console.log(
    `   Found ${influentialResult.bindings.length} influential users`,
  );
  console.log(`   Execution time: ${influentialResult.executionTime}ms`);
  console.log('   Results:', influentialResult.bindings);
  console.log();

  // 7. Content creators
  console.log('7️⃣ Content creators:');
  const creatorQuery: Query = {
    goals: [{ predicate: 'creator', terms: ['?U', '?P'] }],
    variables: new Set(['U', 'P']),
  };
  const creatorResult = evaluator.evaluate(creatorQuery);
  console.log(`   Found ${creatorResult.bindings.length} creator-post pairs`);
  console.log(`   Execution time: ${creatorResult.executionTime}ms`);
  console.log('   Sample results:', creatorResult.bindings.slice(0, 5));
  console.log();

  // 8. Complex query: Users who are both influential and creators
  console.log('8️⃣ Users who are both influential and creators:');
  const bothQuery: Query = {
    goals: [
      { predicate: 'influential', terms: ['?U'] },
      { predicate: 'creator', terms: ['?U', '?P'] },
    ],
    variables: new Set(['U', 'P']),
  };
  const bothResult = evaluator.evaluate(bothQuery);
  console.log(
    `   Found ${bothResult.bindings.length} users who are both influential and creators`,
  );
  console.log(`   Execution time: ${bothResult.executionTime}ms`);
  console.log('   Results:', bothResult.bindings);
  console.log();
}

async function runGraphDemo(): Promise<void> {
  console.log('🚀 EAV Datalog Graph Demo\n');
  console.log('='.repeat(50));

  try {
    // Initialize store with graph data
    const store = initializeGraphStore();

    // Create evaluator and add graph rules
    const evaluator = new DatalogEvaluator(store);
    addGraphRules(evaluator);

    // Run graph queries
    await runGraphQueries(evaluator);

    console.log('✅ Graph demo completed successfully!');
  } catch (error) {
    console.error('❌ Graph demo failed:', error);
    throw error;
  }
}

// Run the demo
if (import.meta.main) {
  runGraphDemo().catch(console.error);
}
