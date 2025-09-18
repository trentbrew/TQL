/**
 * TQL CLI extension for query generation
 * 
 * Registers a query-gen command that generates query suggestions based on data structure
 */

import { Command } from 'commander';
import { EAVStore, jsonEntityFacts } from '../eav-engine.js';
import { QueryGenerator } from '../query/query-generator.js';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Register the query-gen command with the TQL CLI
 */
export function registerQueryGenCommand(program: Command): void {
    program
        .command('query-gen')
        .description('Generate query suggestions for JSON data')
        .requiredOption('-d, --data <source>', 'Data source (file path or URL)')
        .option('-t, --type <type>', 'Force entity type label (e.g., user, post)')
        .option('-c, --count <number>', 'Number of suggestions to generate', '10')
        .option(
            '-f, --format <format>',
            'Output format (json|table)',
            'table'
        )
        .option('--id-key <key>', 'Choose id field if not "id"')
        .action(async (options) => {
            try {
                // Create a new store for this operation
                const store = new EAVStore();

                // Load data
                await loadData(store, options.data, options.type, options.idKey);

                // Generate query suggestions
                const generator = new QueryGenerator(store);
                const suggestions = generator.generateSuggestions({
                    maxSuggestions: parseInt(options.count, 10),
                    includeComplex: true
                });

                if (suggestions.length === 0) {
                    console.log('No query suggestions could be generated for this data.');
                    return;
                }

                // Output suggestions based on format
                if (options.format === 'json') {
                    console.log(JSON.stringify(suggestions, null, 2));
                } else {
                    console.log('\n📝 Query Suggestions');
                    console.log('='.repeat(60));

                    for (const [i, suggestion] of suggestions.entries()) {
                        console.log(`\n[${i + 1}] ${suggestion.description} (${suggestion.complexity})`);
                        console.log(`  ${suggestion.query}`);
                    }
                }
            } catch (error) {
                console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
                process.exit(1);
            }
        });
}

/**
 * Load data from file or URL into EAV store
 */
async function loadData(
    store: EAVStore,
    source: string,
    forcedType?: string,
    idKey?: string
): Promise<void> {
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
            const entityId = generateEntityId(item, i, forcedType, idKey);
            const entityType = forcedType || inferType(item);
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
                const entityId = generateEntityId(item, i, forcedType, idKey);
                const entityType = forcedType || inferType(item);
                const facts = jsonEntityFacts(entityId, item, entityType);
                store.addFacts(facts);
            }
        } else {
            // Single object or nested structure
            const entityType = forcedType || 'root';
            const facts = jsonEntityFacts('root', jsonData, entityType);
            store.addFacts(facts);
        }
    } else {
        throw new Error('Data must be a JSON object or array');
    }

    console.log(`✅ Loaded data successfully`);
    console.log(`📊 Store stats:`, store.getStats());
}

/**
 * Extract data array from common API response patterns
 */
function extractDataArray(jsonData: any): any[] | null {
    // Handle null/undefined responses gracefully
    if (jsonData === null || jsonData === undefined) {
        return null;
    }

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
}

/**
 * Generate entity ID based on item properties
 */
function generateEntityId(
    item: any,
    index: number,
    forcedType?: string,
    idKey?: string
): string {
    const entityType = forcedType || inferType(item);

    // Try to find a unique identifier using the specified idKey or common fields
    if (idKey && item[idKey]) return `${entityType}:${item[idKey]}`;
    if (item.id) return `${entityType}:${item.id}`;
    if (item._id) return `${entityType}:${item._id}`;
    if (item.name) return `${entityType}:${item.name}`;
    return `${entityType}:${index}`;
}

/**
 * Infer entity type from item structure
 */
function inferType(item: any): string {
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
}