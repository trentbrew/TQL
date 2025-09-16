/**
 * Q - EAV Datalog Engine
 *
 * Quick start example
 */

import { EAVStore, jsonEntityFacts } from './src/index.js';

// Example usage
const store = new EAVStore();

// Sample data
const sampleData = {
  id: 1,
  title: 'Hello World',
  tags: ['demo', 'example'],
  metadata: {
    created: '2024-01-01',
    views: 100,
  },
};

// Convert to EAV facts
const facts = jsonEntityFacts('demo:1', sampleData, 'demo');
store.addFacts(facts);

console.log('✅ EAV Datalog Engine initialized!');
console.log(`📊 Store contains ${store.getAllFacts().length} facts`);
console.log("🚀 Run 'bun run demo:eav' to see the full demo");
