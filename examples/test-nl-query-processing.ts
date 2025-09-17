#!/usr/bin/env bun

/**
 * Test natural language query processing with common patterns
 */

import { processQuery } from '../src/ai/orchestrator.js';

// Sample catalog data for testing
const sampleCatalog = [
    {
        attribute: 'family',
        type: 'string',
        examples: ['ABeeZee', 'Roboto', 'Times New Roman']
    },
    {
        attribute: 'category',
        type: 'string',
        examples: ['serif', 'sans-serif', 'display']
    },
    {
        attribute: 'price',
        type: 'number',
        examples: [10.99, 25.50, 5.00]
    },
    {
        attribute: 'tags',
        type: 'string',
        examples: ['popular', 'new', 'sale']
    }
];

// Sample data stats
const dataStats = {
    totalFacts: 5000,
    uniqueEntities: 200,
    uniqueAttributes: 15
};

// Test cases for different natural language patterns
const testCases = [
    {
        description: "Simple equality",
        query: "show me serif fonts"
    },
    {
        description: "Starts with pattern",
        query: "find fonts that start with the letter A"
    },
    {
        description: "Begins with pattern variation",
        query: "list fonts beginning with R"
    },
    {
        description: "Contains pattern",
        query: "fonts with 'Sans' in the name"
    },
    {
        description: "Numerical comparison",
        query: "products over 20 dollars"
    },
    {
        description: "Between range",
        query: "items priced between 10 and 30"
    },
    {
        description: "Combined criteria",
        query: "serif fonts that start with T"
    }
];

// Run the tests
async function runTests() {
    console.log("🔍 Testing Natural Language Query Processing\n");

    for (const testCase of testCases) {
        console.log(`📝 Test: ${testCase.description}`);
        console.log(`Query: "${testCase.query}"`);

        try {
            const result = await processQuery(testCase.query, {
                catalog: sampleCatalog,
                dataStats: dataStats
            });

            if (result.error) {
                console.log(`❌ Error: ${result.error}`);
            } else if (result.eqlsQuery) {
                console.log(`✅ Generated EQL-S: ${result.eqlsQuery}`);
            }
        } catch (error) {
            console.log(`❌ Exception: ${error instanceof Error ? error.message : String(error)}`);
        }

        console.log("----------------------------------------------");
    }

    console.log("\n✨ Testing complete!");
}

runTests().catch(console.error);