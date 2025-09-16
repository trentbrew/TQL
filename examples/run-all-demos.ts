/**
 * Run All Demos Script
 *
 * Demonstrates all available demos for the EAV Datalog Engine
 */

import { execSync } from 'child_process';

const demos = [
  {
    name: 'EAV Demo',
    script: 'demo:eav',
    description: 'Basic EAV operations and queries',
  },
  {
    name: 'Graph Demo',
    script: 'demo:graph',
    description: 'Graph queries with reachability and motifs',
  },
  {
    name: 'Products Demo',
    script: 'demo:products',
    description: 'Complex product catalog queries',
  },
  {
    name: 'Tree of Thoughts Demo',
    script: 'demo:tot',
    description: 'AI-powered planning and reasoning',
  },
  {
    name: 'Real Data Demo',
    script: 'demo:real-data',
    description: 'Queries on real JSON data from JSONPlaceholder API',
  },
  {
    name: 'Enhanced Real Data Demo',
    script: 'demo:enhanced-real-data',
    description:
      'Comprehensive queries on real JSON data with albums and photos',
  },
];

async function runAllDemos(): Promise<void> {
  console.log('🚀 EAV Datalog Engine - All Demos\n');
  console.log('='.repeat(80));
  console.log('Available demos for testing the query engine:');
  console.log('='.repeat(80));

  for (let i = 0; i < demos.length; i++) {
    const demo = demos[i]!;
    console.log(`\n${i + 1}. ${demo.name}`);
    console.log(`   Script: bun run ${demo.script}`);
    console.log(`   Description: ${demo.description}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('To run a specific demo, use:');
  console.log('  bun run <script-name>');
  console.log('\nExample:');
  console.log('  bun run demo:real-data');
  console.log('  bun run demo:enhanced-real-data');
  console.log('  bun run demo:graph');
  console.log('='.repeat(80));

  console.log('\n📊 Data Sources:');
  console.log('  - Static JSON files in data/ directory');
  console.log('  - Real JSON data fetched via curl from JSONPlaceholder API');
  console.log('  - Graph data with relationships and reachability');
  console.log('  - Product catalog data with complex nested structures');

  console.log('\n🔍 Query Capabilities Demonstrated:');
  console.log('  - Basic EAV queries with filters and joins');
  console.log('  - Complex graph queries (reachability, triangles, paths)');
  console.log('  - Derived predicates and rule-based reasoning');
  console.log('  - String pattern matching and regex queries');
  console.log('  - Aggregations and statistical analysis');
  console.log('  - Path-aware JSON ingestion');
  console.log('  - Multi-entity relationship queries');

  console.log('\n✅ All demos are ready to run!');
}

// Run the demo
if (import.meta.main) {
  runAllDemos().catch(console.error);
}
