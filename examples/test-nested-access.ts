#!/usr/bin/env bun

/**
 * Test nested object access fix
 */

import { EAVStore, jsonEntityFacts } from '../src/eav-engine.js';
import { EQLSProcessor } from '../src/query/eqls-parser.js';
import { DatalogEvaluator } from '../src/query/datalog-evaluator.js';

// Simple test data with nested objects
const testData = [
    {
        type: 'user',
        id: '1',
        name: 'Alice',
        metadata: {
            preferences: {
                theme: 'dark',
                language: 'en'
            },
            profile: {
                bio: 'Software engineer',
                location: 'NYC'
            }
        }
    },
    {
        type: 'user',
        id: '2',
        name: 'Bob',
        metadata: {
            preferences: {
                theme: 'light',
                language: 'es'
            },
            profile: {
                bio: 'Designer',
                location: 'LA'
            }
        }
    }
];

async function testNestedAccess() {
    console.log('🧪 Testing nested object access...');

    // Initialize store
    const store = new EAVStore();
    const allFacts: any[] = [];

    testData.forEach(entity => {
        const entityId = `${entity.type}:${entity.id}`;
        const facts = jsonEntityFacts(entityId, entity, entity.type);
        allFacts.push(...facts);
    });

    store.addFacts(allFacts);
    console.log(`✅ Store initialized with ${store.getStats().totalFacts} facts`);

    // Test nested queries
    const testQueries = [
        'FIND user AS ?u WHERE ?u.metadata.preferences.theme = "dark" RETURN ?u.name',
        'FIND user AS ?u WHERE ?u.metadata.profile.location = "NYC" RETURN ?u.name',
        'FIND user AS ?u RETURN ?u.name, ?u.metadata.preferences.theme'
    ];

    const processor = new EQLSProcessor();
    const evaluator = new DatalogEvaluator(store);

    for (const query of testQueries) {
        console.log(`\n📝 Testing: ${query}`);

        try {
            const result = processor.process(query);

            if (result.errors?.length > 0) {
                console.log(`❌ Parse error: ${result.errors[0]?.message}`);
                continue;
            }

            console.log('✅ Query parsed successfully');

            const queryResult = evaluator.evaluate(result.query!);
            console.log(`📊 Found ${queryResult.bindings.length} results`);

            if (queryResult.bindings.length > 0) {
                console.log('Sample result:', queryResult.bindings[0]);
            }

        } catch (error) {
            console.log(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

testNestedAccess().catch(console.error);