#!/usr/bin/env bun

import { EAVStore, jsonEntityFacts } from '../src/eav-engine.js';
import { EQLSProcessor } from '../src/query/eqls-parser.js';
import { DatalogEvaluator } from '../src/query/datalog-evaluator.js';

console.log('🔍 Testing Specific EQL-S Issues\n');

// Create sample data
const sampleData = [
    { id: 1, title: "Hello World", views: 1500, reactions: { likes: 100 } },
    { id: 2, title: "TypeScript Guide", views: 2000, reactions: { likes: 1200 } },
    { id: 3, title: "Graph Theory", views: 800, reactions: { likes: 50 } }
];

// Set up store
const store = new EAVStore();
const processor = new EQLSProcessor();
const evaluator = new DatalogEvaluator(store);

console.log('📊 Loading sample data...');
sampleData.forEach((item, index) => {
    const entityId = `post:${item.id}`;
    const facts = jsonEntityFacts(entityId, item, 'post');
    store.addFacts(facts);
});

// Set the schema so the processor knows about our attributes
const catalog = store.getCatalog();
processor.setSchema(catalog);

console.log(`Store has ${store.getAllFacts().length} facts\n`);

// Test step by step
const testQueries = [
    // Basic - should work
    "FIND post AS ?p RETURN ?p",

    // Just return with one attribute
    "FIND post AS ?p RETURN ?p.title",

    // Just WHERE without complex return
    "FIND post AS ?p WHERE ?p.views = 1500 RETURN ?p",

    // Simple comparison with number
    "FIND post AS ?p WHERE ?p.id = 1 RETURN ?p",

    // Simple string comparison
    'FIND post AS ?p WHERE ?p.title = "Hello World" RETURN ?p',
];

for (const query of testQueries) {
    console.log(`\n🧪 Testing: ${query}`);

    try {
        const processResult = processor.process(query);

        if (processResult.errors.length > 0) {
            console.log('❌ Parse errors:');
            processResult.errors.forEach(error => {
                console.log(`  - ${error.message}`);
            });
            continue;
        }

        if (!processResult.query) {
            console.log('❌ No query generated');
            continue;
        }

        console.log('✅ Parse successful');

        try {
            const results = evaluator.evaluate(processResult.query);
            console.log(`📊 Results: ${results.bindings.length} found`);
            if (results.bindings.length > 0) {
                console.log('First result:', results.bindings[0]);
                if (results.bindings.length > 1) {
                    console.log('All results:', results.bindings);
                }
            }
        } catch (evalError: any) {
            console.log('❌ Evaluation error:', evalError.message);
        }

    } catch (parseError: any) {
        console.log('❌ Parse error:', parseError.message);
    }
}