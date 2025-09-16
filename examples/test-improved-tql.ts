#!/usr/bin/env bun

import { builtinTools } from '../src/graph/tools.js';

console.log('🔧 Testing Improved TQL Query Tool\n');

const sampleData = [
    { id: 1, title: "Hello World", views: 1500, reactions: { likes: 100 } },
    { id: 2, title: "TypeScript Guide", views: 2000, reactions: { likes: 1200 } },
    { id: 3, title: "Graph Theory", views: 800, reactions: { likes: 50 } }
];

// Test complex queries now
const testQueries = [
    // Basic query
    'FIND post AS ?p RETURN ?p',

    // Attribute projection
    'FIND post AS ?p RETURN ?p, ?p.title',

    // WHERE with comparison
    'FIND post AS ?p WHERE ?p.views > 1000 RETURN ?p, ?p.title',

    // WHERE with exact match
    'FIND post AS ?p WHERE ?p.id = 2 RETURN ?p.title',

    // String comparison
    'FIND post AS ?p WHERE ?p.title = "Graph Theory" RETURN ?p, ?p.views'
];

for (const query of testQueries) {
    console.log(`\n🧪 Testing: ${query}`);

    try {
        const result = await builtinTools.tql_query({
            query,
            data: sampleData,
            entityType: 'post',
            idKey: 'id'
        }) as any;

        if (result.error) {
            console.log('❌ Error:', result.error);
            if (result.parseErrors) {
                console.log('Parse errors:', result.parseErrors);
            }
        } else if (result.ok) {
            console.log(`✅ Success: ${result.count} results`);
            if (result.results && result.results.length > 0) {
                console.log('Sample result:', result.results[0]);
                if (result.results.length > 1) {
                    console.log(`... and ${result.results.length - 1} more`);
                }
            }
        }
    } catch (error: any) {
        console.log('❌ Exception:', error.message);
    }
}