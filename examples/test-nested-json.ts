#!/usr/bin/env bun

import { EAVStore, jsonEntityFacts, flatten } from '../src/eav-engine.js';

// Create deeply nested test data
const nestedData = [
    {
        data: [
            {
                resource: {
                    id: 1,
                    name: "Test Resource",
                    attributes: {
                        price: 99.99,
                        category: "test",
                        tags: ["deep", "nested", "data"]
                    }
                }
            },
            {
                resource: {
                    id: 2,
                    name: "Another Resource",
                    attributes: {
                        price: 49.99,
                        category: "demo",
                        tags: ["json", "structure"]
                    }
                }
            }
        ]
    }
];

console.log('🔍 Testing nested JSON flattening\n');

// Test the flattening function directly
console.log('📊 Direct flattening test:');
const flattened = Array.from(flatten(nestedData[0]));
flattened.forEach(([path, value]) => {
    console.log(`  ${path} = ${value}`);
});

// Test EAV store ingestion
console.log('\n📊 EAV store test:');
const store = new EAVStore();

// Create entity from nested data
const facts = jsonEntityFacts('test:1', nestedData[0], 'test');
store.addFacts(facts);

console.log(`  Added ${facts.length} facts`);
console.log('  All facts:');
store.getAllFacts().forEach(fact => {
    console.log(`  ${fact.e} | ${fact.a} | ${fact.v}`);
});

// Show catalog
console.log('\n📊 Catalog:');
store.getCatalog().forEach(entry => {
    console.log(`  ${entry.attribute} (${entry.type}, ${entry.cardinality})`);
    console.log(`    Examples: ${entry.examples.slice(0, 3).join(', ')}`);
});

console.log('\n✅ Test completed');