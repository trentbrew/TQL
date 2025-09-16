#!/usr/bin/env bun

import { EAVStore, jsonEntityFacts } from '../src/eav-engine.js';
import { EQLSProcessor } from '../src/query/eqls-parser.js';
import { DatalogEvaluator } from '../src/query/datalog-evaluator.js';

console.log('🔍 Debugging > Comparison\n');

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

// Debug the specific query that's failing
const problematicQuery = 'FIND post AS ?p WHERE ?p.views > 1000 RETURN ?p, ?p.title';

console.log(`Testing: ${problematicQuery}\n`);

// First, let's see what facts we have for views
console.log('📊 Facts for views attribute:');
const allFacts = store.getAllFacts();
const viewsFacts = allFacts.filter(f => f.a === 'views');
console.log(viewsFacts);

console.log('\n📊 Facts for type attribute:');
const typeFacts = allFacts.filter(f => f.a === 'type');
console.log(typeFacts);

console.log('\n📋 Catalog for views:');
const viewsCatalogEntry = catalog.find(c => c.attribute === 'views');
console.log(viewsCatalogEntry);

// Parse the query
console.log('\n🔍 Parsing query...');
const parseResult = processor.process(problematicQuery);

if (parseResult.errors.length > 0) {
    console.log('❌ Parse errors:');
    parseResult.errors.forEach(error => {
        console.log(`  - ${error.message}`);
    });
} else {
    console.log('✅ Parse successful');
    console.log('Goals:');
    parseResult.query!.goals.forEach((goal, i) => {
        console.log(`  ${i}: ${JSON.stringify(goal)}`);
    });

    // Try evaluating
    console.log('\n🔍 Evaluating...');
    try {
        const result = evaluator.evaluate(parseResult.query!);
        console.log(`Results: ${result.bindings.length}`);
        result.bindings.forEach((binding, i) => {
            console.log(`  ${i}: ${JSON.stringify(binding)}`);
        });
    } catch (error: any) {
        console.log('❌ Evaluation error:', error.message);
    }
}