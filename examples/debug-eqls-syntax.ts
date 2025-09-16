#!/usr/bin/env bun

import { EAVStore, jsonEntityFacts } from '../src/eav-engine.js';
import { EQLSProcessor } from '../src/query/eqls-parser.js';
import { DatalogEvaluator } from '../src/query/datalog-evaluator.js';

console.log('🔍 Debugging EQL-S Syntax Issues\n');

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

console.log(`Store has ${store.getAllFacts().length} facts\n`);

// Test various query syntaxes
const testQueries = [
    // Basic query (should work)
    "FIND post AS ?p RETURN ?p",

    // Attribute projection (should work)
    "FIND post AS ?p RETURN ?p, ?p.title",

    // WHERE with attribute access
    "FIND post AS ?p WHERE ?p.views > 1000 RETURN ?p, ?p.title",

    // Pipeline style
    "from post | where ?p.views > 1000 | return ?p, ?p.title",

    // Direct datalog style
    "attr(?p, \"views\", ?v), gt(?v, 1000)",

    // Alternative WHERE syntax
    "FIND post AS ?p WHERE attr(?p, \"views\", ?v) AND gt(?v, 1000) RETURN ?p"
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
        console.log('Query variables:', Array.from(processResult.query.variables).join(', '));
        console.log('Query goals count:', processResult.query.goals.length);

        try {
            const results = evaluator.evaluate(processResult.query);
            console.log(`📊 Results: ${results.bindings.length} found`);
            if (results.bindings.length > 0) {
                console.log('Sample result:', results.bindings[0]);
            }
        } catch (evalError: any) {
            console.log('❌ Evaluation error:', evalError.message);
        }

    } catch (parseError: any) {
        console.log('❌ Parse error:', parseError.message);
    }
}

// Also test the catalog to see what attributes are available
console.log('\n📋 Store Catalog:');
const catalog = store.getCatalog();
console.log(JSON.stringify(catalog, null, 2));