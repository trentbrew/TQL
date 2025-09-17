#!/usr/bin/env bun

/**
 * Test for regex pattern matching in EQL-S
 * 
 * This test validates that regex patterns work correctly for the MATCHES operator
 */

import { EAVStore, jsonEntityFacts } from '../src/eav-engine.js';
import { DatalogEvaluator } from '../src/query/datalog-evaluator.js';
import { EQLSProcessor } from '../src/query/eqls-parser.js';

console.log('🔍 Testing regex pattern matching in EQL-S\n');

// Create test data
const testData = [
    { id: 1, family: 'Abhaya Libre', category: 'serif' },
    { id: 2, family: 'ABeeZee', category: 'sans-serif' },
    { id: 3, family: 'Montserrat', category: 'sans-serif' },
    { id: 4, family: 'Roboto', category: 'sans-serif' },
    { id: 5, family: 'Arial', category: 'sans-serif' },
    { id: 6, family: 'Times New Roman', category: 'serif' },
];

// Create EAV store
const store = new EAVStore();
for (let i = 0; i < testData.length; i++) {
    const item = testData[i]!;
    const facts = jsonEntityFacts(`font:${item.id}`, item, 'font');
    store.addFacts(facts);
}

// Setup processor and evaluator
const evaluator = new DatalogEvaluator(store);
const processor = new EQLSProcessor();
processor.setSchema(store.getCatalog());

function runTest(description: string, query: string) {
    console.log(`\n📋 Test: ${description}`);
    console.log(`🔍 Query: ${query}`);

    try {
        const result = processor.process(query);
        if (result.errors.length > 0) {
            console.log('❌ Parsing failed:');
            for (const error of result.errors) {
                console.log(`  Line ${error.line}, Column ${error.column}: ${error.message}`);
            }
            return;
        }

        const queryResult = evaluator.evaluate(result.query!);
        console.log(`✅ Results (${queryResult.bindings.length} items):`);

        if (queryResult.bindings.length === 0) {
            console.log('  No results found.');
            return;
        }

        for (const binding of queryResult.bindings) {
            const values = Object.entries(binding)
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ');
            console.log(`  ${values}`);
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(`❌ Error: ${message}`);
    }
}

// Run tests
runTest(
    'Simple font name matching with regex',
    'FIND font AS ?f WHERE ?f.family MATCHES /^A/ RETURN ?f.family'
);

runTest(
    'Font name matching with case-insensitive regex',
    'FIND font AS ?f WHERE ?f.family MATCHES /^a/i RETURN ?f.family'
);

runTest(
    'Font name matching with alternation',
    'FIND font AS ?f WHERE ?f.family MATCHES /(Arial|Roboto)/ RETURN ?f.family'
);

runTest(
    'Category matching with regex',
    'FIND font AS ?f WHERE ?f.category MATCHES /serif/ RETURN ?f.family, ?f.category'
);

runTest(
    'Combined criteria with AND',
    'FIND font AS ?f WHERE ?f.family MATCHES /^A/ AND ?f.category = "serif" RETURN ?f.family, ?f.category'
);

console.log('\n✨ Regex testing complete!');