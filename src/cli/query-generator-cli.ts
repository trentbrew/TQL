/**
 * TQL Query Generator CLI Extension
 * 
 * Adds query suggestion capabilities to the TQL CLI
 */

import { Command } from 'commander';
import { TQLCLI } from './tql.js';
import { QueryGenerator, QuerySuggestion } from '../query/query-generator.js';
import { exec } from 'child_process';
import readline from 'readline';

interface QueryGeneratorOptions {
    data: string;
    type?: string;
    count?: number;
    format?: 'json' | 'table' | 'interactive';
    idKey?: string;
}

/**
 * Extended TQLCLI with query suggestion capabilities
 */
export class TQLQueryGenerator extends TQLCLI {
    async generateQueries(options: QueryGeneratorOptions): Promise<void> {
        try {
            // Load data
            await this.loadData(options.data, {
                data: options.data,
                query: '',
                format: 'table',
                limit: 0,
                verbose: false,
                natural: false,
                catalog: false,
                raw: false,
                type: options.type,
                idKey: options.idKey,
            });

            // Generate query suggestions
            const store = this.getStore();
            const generator = new QueryGenerator(store);
            const suggestions = generator.generateSuggestions({
                maxSuggestions: options.count || 10,
                includeComplex: true
            });

            if (suggestions.length === 0) {
                console.log('No query suggestions could be generated for this data.');
                return;
            }

            // Output suggestions based on format
            if (options.format === 'json') {
                console.log(JSON.stringify(suggestions, null, 2));
            } else if (options.format === 'table') {
                console.log('\n📝 Query Suggestions');
                console.log('='.repeat(60));

                for (const [i, suggestion] of suggestions.entries()) {
                    console.log(`\n[${i + 1}] ${suggestion.description} (${suggestion.complexity})`);
                    console.log(`  ${suggestion.query}`);
                }
            } else {
                // Interactive mode with simple readline
                this.displayInteractiveQuerySelector(suggestions);
            }
        } catch (error) {
            console.error(
                '❌ Error:',
                error instanceof Error ? error.message : 'Unknown error',
            );
            process.exit(1);
        }
    }

    /**
     * Display interactive query selector with readline
     */
    private displayInteractiveQuerySelector(suggestions: QuerySuggestion[]): void {
        console.log('\n📝 Query Suggestions (Interactive Mode)');
        console.log('='.repeat(60));
        console.log('Use up/down arrows to navigate, Enter to select and copy to clipboard');
        console.log('Press Ctrl+C to exit\n');

        let selectedIndex = 0;

        // Helper to render the list
        const renderList = () => {
            // Clear the console
            console.clear();
            console.log('\n📝 Query Suggestions (Interactive Mode)');
            console.log('='.repeat(60));
            console.log('Use up/down arrows to navigate, Enter to select and copy to clipboard');
            console.log('Press Ctrl+C to exit\n');

            for (const [i, suggestion] of suggestions.entries()) {
                const selected = i === selectedIndex;
                const pointer = selected ? '>' : ' ';

                // Icons for focus type
                const focusIcons: Record<string, string> = {
                    'exploration': '🔍',
                    'filtering': '🔎',
                    'aggregation': '📊',
                    'relationship': '🔗'
                };

                // Colors (using ANSI escape sequences)
                const complexityColors: Record<string, string> = {
                    'basic': '\x1b[32m', // green
                    'intermediate': '\x1b[33m', // yellow
                    'advanced': '\x1b[31m', // red
                };
                const resetColor = '\x1b[0m';
                const selectedColor = '\x1b[36m'; // cyan

                console.log(`${pointer} ${focusIcons[suggestion.focus]} ${selected ? selectedColor : ''}${suggestion.description}${resetColor} ${complexityColors[suggestion.complexity]}[${suggestion.complexity}]${resetColor}`);
                console.log(`   ${selected ? selectedColor : '\x1b[90m'}${suggestion.query}${resetColor}`);
                console.log('');
            }
        };

        // Initial render
        renderList();

        // Set up readline interface
        readline.emitKeypressEvents(process.stdin);
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }

        process.stdin.on('keypress', (_, key) => {
            if (key) {
                if (key.name === 'c' && key.ctrl) {
                    // Exit on Ctrl+C
                    process.stdin.setRawMode(false);
                    process.exit(0);
                } else if (key.name === 'up' || key.name === 'k') {
                    // Move selection up
                    selectedIndex = Math.max(0, selectedIndex - 1);
                    renderList();
                } else if (key.name === 'down' || key.name === 'j') {
                    // Move selection down
                    selectedIndex = Math.min(suggestions.length - 1, selectedIndex + 1);
                    renderList();
                } else if (key.name === 'return') {
                    // Copy to clipboard and provide feedback
                    const query = suggestions[selectedIndex].query;
                    this.copyToClipboard(query);

                    // Show success message
                    console.log(`\x1b[32m✓ Copied to clipboard: ${query}\x1b[0m`);

                    // Wait for user to press any key to continue
                    console.log('\nPress any key to continue...');

                    const resumeListener = () => {
                        process.stdin.removeListener('keypress', resumeListener);
                        renderList();
                    };

                    process.stdin.once('keypress', resumeListener);
                }
            }
        });
    }

    /**
     * Copy text to clipboard (platform-specific)
     */
    private copyToClipboard(text: string): void {
        // Handle platform-specific clipboard commands
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
}

/**
 * Register query-gen command
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
            'Output format (json|table|interactive)',
            'interactive'
        )
        .option('--id-key <key>', 'Choose id field if not "id"')
        .action(async (options) => {
            const generator = new TQLQueryGenerator();
            await generator.generateQueries({
                data: options.data,
                type: options.type,
                count: parseInt(options.count, 10),
                format: options.format as any,
                idKey: options.idKey,
            });
        });
}