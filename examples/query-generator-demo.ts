/**
 * TQL Query Generator Example
 * 
 * Demonstrates how to use the query generator to analyze JSON structure
 * and suggest meaningful EQL-S queries
 */

import { EAVStore, jsonEntityFacts } from '../src/eav-engine.js';
import { QueryGenerator } from '../src/query/query-generator.js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Create an EAV store
const store = new EAVStore();

// Sample JSON data
const loadData = async (source: string): Promise<void> => {
    console.log(`📥 Loading data from: ${source}`);

    let jsonData: any;

    if (source.startsWith('http://') || source.startsWith('https://')) {
        // Load from URL
        const response = await fetch(source);
        if (!response.ok) {
            throw new Error(`Failed to fetch data from URL: ${response.statusText}`);
        }
        jsonData = await response.json();
    } else {
        // Load from local file
        try {
            const filePath = join(process.cwd(), source);
            const fileContent = readFileSync(filePath, 'utf-8');
            jsonData = JSON.parse(fileContent);
        } catch (error) {
            throw new Error(
                `Failed to load file: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    // Ingest data into EAV store
    if (Array.isArray(jsonData)) {
        // Array of objects - create one entity per array element
        for (let i = 0; i < jsonData.length; i++) {
            const item = jsonData[i]!;
            const entityId = generateEntityId(item, i);
            const entityType = inferType(item);
            const facts = jsonEntityFacts(entityId, item, entityType);
            store.addFacts(facts);
        }
    } else if (typeof jsonData === 'object') {
        // Check if this is a wrapper object with a data array (common API pattern)
        const dataArray = extractDataArray(jsonData);
        if (dataArray) {
            // Process the extracted array
            for (let i = 0; i < dataArray.length; i++) {
                const item = dataArray[i]!;
                const entityId = generateEntityId(item, i);
                const entityType = inferType(item);
                const facts = jsonEntityFacts(entityId, item, entityType);
                store.addFacts(facts);
            }
        } else {
            // Single object or nested structure
            const entityType = 'root';
            const facts = jsonEntityFacts('root', jsonData, entityType);
            store.addFacts(facts);
        }
    } else {
        throw new Error('Data must be a JSON object or array');
    }

    console.log(`✅ Loaded data successfully`);
    console.log(`📊 Store stats:`, store.getStats());
};

const extractDataArray = (jsonData: any): any[] | null => {
    // Common patterns for API responses with data arrays
    const commonArrayKeys = [
        'data',
        'results',
        'items',
        'shows',
        'posts',
        'users',
        'products',
    ];

    for (const key of commonArrayKeys) {
        if (jsonData[key] && Array.isArray(jsonData[key])) {
            console.log(`📦 Detected data array in '${key}' field`);
            return jsonData[key];
        }
    }

    return null;
};

const generateEntityId = (item: any, index: number): string => {
    const entityType = inferType(item);

    // Try to find a unique identifier using common fields
    if (item.id) return `${entityType}:${item.id}`;
    if (item._id) return `${entityType}:${item._id}`;
    if (item.name) return `${entityType}:${item.name}`;
    return `${entityType}:${index}`;
};

const inferType = (item: any): string => {
    // Try to infer type from common fields
    if (item.type) return item.type;
    if (item._type) return item._type;
    if (item.kind) return item.kind;

    // Infer from structure
    if (item.title && item.body) return 'post';
    if (item.name && item.email) return 'user';
    if (item.subject && item.body) return 'email';
    if (item.name && item.price) return 'product';
    if (item.albumId && item.url) return 'photo';
    if (item.userId && item.title && !item.body) return 'album';

    return 'item';
};

// Main function
const main = async () => {
    // Get data source from command line arguments
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('Please provide a data source (file path or URL)');
        process.exit(1);
    }

    const dataSource = args[0]!;

    try {
        // Load data
        await loadData(dataSource);

        // Generate query suggestions
        const generator = new QueryGenerator(store);
        const suggestions = generator.generateSuggestions({
            maxSuggestions: 10,
            includeComplex: true
        });

        // Display suggestions
        console.log('\n📝 Generated Query Suggestions');
        console.log('='.repeat(60));

        if (suggestions.length === 0) {
            console.log('No query suggestions could be generated for this data.');
            return;
        }

        for (const [i, suggestion] of suggestions.entries()) {
            console.log(`\n[${i + 1}] ${suggestion.description} (${suggestion.complexity})`);
            console.log(`  ${suggestion.query}`);
        }

    } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
    }
};

// Run the main function
main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});