#!/usr/bin/env bun

/**
 * Query Generator Demo
 * 
 * Demonstrates the query generator by loading a JSON file
 * and generating intelligent query suggestions based on the data structure
 */

import { EAVStore, jsonEntityFacts } from '../src/eav-engine.js';
import { QueryGenerator } from '../src/query/query-generator.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { createInterface } from 'readline';

// Helper functions for ANSI colors
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    red: '\x1b[31m'
};

// Sample data files in the data directory
const sampleFiles = [
    { name: 'posts.json', description: 'Blog posts with titles, content, and metadata' },
    { name: 'real-users.json', description: 'User profiles with contact information' },
    { name: 'products_webflow.json', description: 'Product catalog with prices and details' },
    { name: 'real-photos.json', description: 'Photo collection with URLs and album references' }
];

// Create an EAV store
const store = new EAVStore();

// Function to prompt for user input
function prompt(question: string): Promise<string> {
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(question, (answer: string) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

// Load data from a JSON file
async function loadData(filePath: string): Promise<void> {
    console.log(`${colors.bright}📥 Loading data from:${colors.reset} ${filePath}`);

    try {
        const fileContent = readFileSync(filePath, 'utf-8');
        const jsonData = JSON.parse(fileContent);

        // Clear existing store data
        const facts = store.getAllFacts();
        facts.length = 0;
        const links = store.getAllLinks();
        links.length = 0;

        // Ingest data into EAV store
        if (Array.isArray(jsonData)) {
            console.log(`${colors.dim}Array data detected with ${jsonData.length} items${colors.reset}`);

            // Array of objects - create one entity per array element
            for (let i = 0; i < jsonData.length; i++) {
                const item = jsonData[i];
                if (!item) continue;

                const entityType = inferType(item);
                const entityId = generateEntityId(item, i, entityType);
                const facts = jsonEntityFacts(entityId, item, entityType);
                store.addFacts(facts);
            }
        } else if (typeof jsonData === 'object') {
            // Handle single object
            console.log(`${colors.dim}Single object data detected${colors.reset}`);
            const entityType = 'root';
            const facts = jsonEntityFacts('root', jsonData, entityType);
            store.addFacts(facts);
        }

        console.log(`${colors.green}✅ Loaded data successfully${colors.reset}`);
        console.log(`${colors.dim}Store stats:${colors.reset}`, store.getStats());

    } catch (error) {
        console.error(`${colors.red}Error loading data:${colors.reset}`, error);
        throw error;
    }
}

// Generate entity ID
function generateEntityId(item: any, index: number, entityType: string): string {
    // Try to find a unique identifier using common fields
    if (item.id) return `${entityType}:${item.id}`;
    if (item._id) return `${entityType}:${item._id}`;
    if (item.name) return `${entityType}:${item.name}`;
    return `${entityType}:${index}`;
}

// Infer entity type
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

// Copy to clipboard
function copyToClipboard(text: string): void {
    const platform = process.platform;
    let command;

    if (platform === 'darwin') {
        // macOS
        command = `echo '${text.replace(/'/g, "'\\''")}'|pbcopy`;
    } else if (platform === 'win32') {
        // Windows
        command = `echo ${text.replace(/"/g, '\\"')}|clip`;
    } else {
        // Linux (assumes xclip is installed)
        command = `echo '${text.replace(/'/g, "'\\''")}'|xclip -selection clipboard`;
    }

    try {
        exec(command);
    } catch (error) {
        console.error('Failed to copy to clipboard');
    }
}

// Main interactive demo function
async function runDemo(): Promise<void> {
    try {
        // Show welcome message
        console.clear();
        console.log('\n');
        console.log(`${colors.bright}${colors.cyan}====================================${colors.reset}`);
        console.log(`${colors.bright}${colors.cyan}  TQL Query Generator Demo${colors.reset}`);
        console.log(`${colors.bright}${colors.cyan}====================================${colors.reset}`);
        console.log('\nThis demo shows how the query generator analyzes JSON data structure');
        console.log('and suggests meaningful EQL-S queries based on the patterns it finds.');

        // Show available sample files
        console.log('\n');
        console.log(`${colors.bright}Choose a sample data file:${colors.reset}`);
        for (let i = 0; i < sampleFiles.length; i++) {
            const file = sampleFiles[i]!;
            console.log(`  ${colors.yellow}${i + 1}.${colors.reset} ${file.name} - ${file.description}`);
        }
        console.log(`  ${colors.yellow}q.${colors.reset} Quit`);

        // Get user choice
        const choice = await prompt(`\n${colors.bright}Enter your choice (1-${sampleFiles.length}):${colors.reset} `);

        if (choice === 'q') {
            console.log('\nExiting demo. Goodbye!');
            process.exit(0);
        }

        const index = parseInt(choice, 10) - 1;
        if (isNaN(index) || index < 0 || index >= sampleFiles.length) {
            console.log(`${colors.red}Invalid choice. Please enter a number between 1 and ${sampleFiles.length}.${colors.reset}`);
            await prompt(`\nPress Enter to try again...`);
            return runDemo();
        }

        const selectedFile = sampleFiles[index]!;
        const filePath = join(process.cwd(), 'data', selectedFile.name);

        // Load the selected file
        await loadData(filePath);

        // Generate and display query suggestions
        console.log('\n');
        console.log(`${colors.bright}${colors.blue}Generating query suggestions...${colors.reset}`);

        const generator = new QueryGenerator(store);
        const suggestions = generator.generateSuggestions({
            maxSuggestions: 10,
            includeComplex: true
        });

        if (suggestions.length === 0) {
            console.log(`${colors.red}No query suggestions could be generated for this data.${colors.reset}`);
            await prompt(`\nPress Enter to restart...`);
            return runDemo();
        }

        console.log(`\n${colors.bright}Generated ${suggestions.length} query suggestions:${colors.reset}`);

        for (const [i, suggestion] of suggestions.entries()) {
            const complexityColor =
                suggestion.complexity === 'basic' ? colors.green :
                    suggestion.complexity === 'intermediate' ? colors.yellow :
                        colors.red;

            // Icons for focus type
            const focusIcons: Record<string, string> = {
                'exploration': '🔍',
                'filtering': '🔎',
                'aggregation': '📊',
                'relationship': '🔗'
            };

            console.log(`\n${colors.yellow}${i + 1}.${colors.reset} ${focusIcons[suggestion.focus]} ${colors.bright}${suggestion.description}${colors.reset} ${complexityColor}[${suggestion.complexity}]${colors.reset}`);
            console.log(`   ${colors.cyan}${suggestion.query}${colors.reset}`);
        }

        // Allow user to select a query
        const selection = await prompt(`\n${colors.bright}Enter a number to copy a query to clipboard (or 'r' to restart, 'q' to quit):${colors.reset} `);

        if (selection === 'q') {
            console.log('\nExiting demo. Goodbye!');
            process.exit(0);
        }

        if (selection === 'r') {
            return runDemo();
        }

        const queryIndex = parseInt(selection, 10) - 1;
        if (isNaN(queryIndex) || queryIndex < 0 || queryIndex >= suggestions.length) {
            console.log(`${colors.red}Invalid choice. Please enter a number between 1 and ${suggestions.length}.${colors.reset}`);
            await prompt(`\nPress Enter to try again...`);
            return runDemo();
        }

        // Copy the selected query to clipboard
        const selectedQuery = suggestions[queryIndex]!.query;
        copyToClipboard(selectedQuery);
        console.log(`\n${colors.green}✓ Copied to clipboard:${colors.reset} ${selectedQuery}`);

        // Ask if user wants to continue or quit
        const finalChoice = await prompt(`\n${colors.bright}Press Enter to restart or 'q' to quit:${colors.reset} `);

        if (finalChoice === 'q') {
            console.log('\nExiting demo. Goodbye!');
            process.exit(0);
        }

        return runDemo();

    } catch (error) {
        console.error(`${colors.red}Error:${colors.reset}`, error);
        await prompt(`\nPress Enter to restart...`);
        return runDemo();
    }
}

// Run the demo
runDemo().catch(error => {
    console.error(`${colors.red}Unhandled error:${colors.reset}`, error);
    process.exit(1);
});