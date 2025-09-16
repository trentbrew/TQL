#!/usr/bin/env bun

import { builtinTools } from '../src/graph/tools.js';

console.log('🔍 Testing Real JSONPlaceholder Data\n');

// Test loading real data
console.log('📊 Loading posts from JSONPlaceholder...');
const postsResult = await builtinTools.tql_load_data({
    dataUrl: 'https://jsonplaceholder.typicode.com/posts',
    key: 'posts'
}) as any;

console.log('Load result:', postsResult.message);

// Test basic query to see the schema
console.log('\n🧪 Testing basic query to see data structure...');
const queryResult = await builtinTools.tql_query({
    query: 'FIND post AS ?p RETURN ?p LIMIT 3',
    dataUrl: 'https://jsonplaceholder.typicode.com/posts',
    entityType: 'post',
    idKey: 'id'
}) as any;

if (queryResult.ok) {
    console.log(`Found ${queryResult.count} posts`);
    console.log('Sample post:', queryResult.results[0]);

    // Test a query for actual attributes
    console.log('\n🧪 Testing query with actual attributes...');
    const titleQuery = await builtinTools.tql_query({
        query: 'FIND post AS ?p WHERE ?p.userId = 1 RETURN ?p, ?p.title',
        dataUrl: 'https://jsonplaceholder.typicode.com/posts',
        entityType: 'post',
        idKey: 'id'
    }) as any;

    if (titleQuery.ok) {
        console.log(`Found ${titleQuery.count} posts by user 1`);
        if (titleQuery.results.length > 0) {
            console.log('Sample result:', titleQuery.results[0]);
        }
    } else {
        console.log('Title query error:', titleQuery.error);
    }

} else {
    console.log('Query error:', queryResult.error);
}