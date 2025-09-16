#!/usr/bin/env bun

import { EAVStore, jsonEntityFacts } from '../src/eav-engine.js';
import { EQLSProcessor } from '../src/query/eqls-parser.js';
import { DatalogEvaluator } from '../src/query/datalog-evaluator.js';

console.log('🔍 Testing Case Sensitivity\n');

const sampleData = [
    { id: 1, title: "Hello World", views: 1500, reactions: { likes: 100 } },
    { id: 2, title: "TypeScript Guide", views: 2000, reactions: { likes: 1200 } },
    { id: 3, title: "Graph Theory", views: 800, reactions: { likes: 50 } }
];

const store = new EAVStore();
const processor = new EQLSProcessor();
const evaluator = new DatalogEvaluator(store);

// Load data
sampleData.forEach((item, index) => {
    const entityId = `post:${item.id}`;
    const facts = jsonEntityFacts(entityId, item, 'post');
    store.addFacts(facts);
});

const catalog = store.getCatalog();
processor.setSchema(catalog);

// Test different cases
const testQueries = [
    'FIND post AS ?p RETURN ?p',      // lowercase post
    'FIND POST AS ?p RETURN ?p',      // uppercase POST
    'FIND Post AS ?p RETURN ?p',      // title case Post
];

for (const query of testQueries) {
    console.log(`\n🧪 Testing: ${query}`);

    const parseResult = processor.process(query);

    if (parseResult.errors.length > 0) {
        console.log('❌ Parse errors:');
        parseResult.errors.forEach(error => {
            console.log(`  - ${error.message}`);
        });
    } else {
        console.log('✅ Parse successful');
        // Look at the first goal which should be the type constraint
        const typeGoal = parseResult.query!.goals[0];
        console.log('Type goal:', JSON.stringify(typeGoal));

        const result = evaluator.evaluate(parseResult.query!);
        console.log(`Results: ${result.bindings.length}`);
    }
}