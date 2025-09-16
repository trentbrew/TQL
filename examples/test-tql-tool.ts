import { builtinTools } from '../src/graph/tools.js';

console.log('🧪 Testing TQL Query Tool Directly\n');

// Test with simple data
const testData = [
    { id: 1, title: 'Hello World', views: 1500, reactions: { likes: 100 } },
    { id: 2, title: 'TypeScript Guide', views: 2000, reactions: { likes: 1200 } },
    { id: 3, title: 'Graph Theory', views: 800, reactions: { likes: 50 } }
];

async function testTQLQuery() {
    console.log('📊 Testing tql_query with sample data...');

    // Start with simplest possible query
    const result = await builtinTools.tql_query({
        query: 'FIND post AS ?p RETURN ?p',
        data: testData,
        entityType: 'post',
        limit: 10
    });

    console.log('Result:', JSON.stringify(result, null, 2));
}

async function testDataLoad() {
    console.log('\n📁 Testing tql_load_data...');

    const state = { memory: {} };

    const result = await builtinTools.tql_load_data({
        data: testData,
        key: 'posts',
        state
    });

    console.log('Load result:', JSON.stringify(result, null, 2));
    console.log('State memory:', JSON.stringify(state.memory, null, 2));

    // Now test querying from memory
    console.log('\n🔍 Testing tql_query from memory...');

    const queryResult = await builtinTools.tql_query({
        query: 'FIND post AS ?p RETURN ?p',
        entityType: 'post',
        limit: 5,
        state
    });

    console.log('Query from memory result:', JSON.stringify(queryResult, null, 2));
}

async function testRemoteData() {
    console.log('\n🌐 Testing with remote data...');

    const result = await builtinTools.tql_query({
        query: 'FIND post AS ?p RETURN ?p, ?p.title',
        dataUrl: 'https://jsonplaceholder.typicode.com/posts',
        entityType: 'post',
        limit: 3
    });

    console.log('Remote data result:', JSON.stringify(result, null, 2));
}

(async () => {
    try {
        await testTQLQuery();
        await testDataLoad();
        await testRemoteData();
    } catch (error) {
        console.error('Error:', error);
    }
})();