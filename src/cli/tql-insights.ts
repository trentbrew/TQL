#!/usr/bin/env node
/**
 * TQL Insights CLI
 * 
 * Command-line interface for generating insights from datasets
 */

import { Command } from 'commander';
import { EAVStore, jsonEntityFacts } from '../eav-engine.js';
import { InsightsEngine, InsightType } from '../analytics/insights-engine.js';
import { DatasetRelationshipAnalyzer } from '../analytics/dataset-relationship-analyzer.js';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const program = new Command();

program
    .name('tql-insights')
    .description('Generate insights from multiple datasets using TQL')
    .version('0.1.0');

program
    .command('generate')
    .description('Generate insights from datasets')
    .requiredOption('-d, --datasets <paths...>', 'Paths to datasets (local files or URLs)')
    .option('-o, --output <path>', 'Output file for generated insights')
    .option('-c, --confidence <threshold>', 'Minimum confidence threshold (0-1)', parseFloat, 0.5)
    .option('-m, --max <count>', 'Maximum number of insights to generate', parseInt, 20)
    .option('-t, --types <types...>', 'Types of insights to include (count, distribution, etc.)')
    .option('-f, --format <format>', 'Output format (json, table)', 'table')
    .action(async (options) => {
        try {
            // Load datasets
            const stores = new Map<string, EAVStore>();

            for (const datasetPath of options.datasets) {
                const datasetName = path.basename(datasetPath, path.extname(datasetPath));
                console.log(`Loading dataset: ${datasetName} from ${datasetPath}...`);

                let data;

                // Check if URL or local file
                if (datasetPath.startsWith('http://') || datasetPath.startsWith('https://')) {
                    const response = await fetch(datasetPath);
                    data = await response.json();
                } else {
                    const fileContent = fs.readFileSync(datasetPath, 'utf-8');
                    data = JSON.parse(fileContent);
                }

                // Create store
                const store = new EAVStore();

                // Process data
                if (Array.isArray(data)) {
                    // Assume array of entities
                    data.forEach((entity, idx) => {
                        // Try to get the entity type from data structure
                        const entityType = entity.type || datasetName;
                        // Try to get ID from entity, or use index
                        const id = entity.id || idx;
                        const entityId = `${entityType}:${id}`;

                        const facts = jsonEntityFacts(entityId, entity, entityType);
                        store.addFacts(facts);
                    });
                } else {
                    // Single entity or custom structure
                    const entityId = `${datasetName}:1`;
                    const facts = jsonEntityFacts(entityId, data, datasetName);
                    store.addFacts(facts);
                }

                stores.set(datasetName, store);
            }

            // Configure insight types
            let insightTypes: InsightType[] | undefined;
            if (options.types) {
                insightTypes = options.types.map((type: string) => {
                    const upperType = type.toUpperCase() as keyof typeof InsightType;
                    if (InsightType[upperType]) {
                        return InsightType[upperType];
                    }
                    throw new Error(`Unknown insight type: ${type}`);
                });
            }

            // Create insights engine
            const insightsEngine = new InsightsEngine({
                confidenceThreshold: options.confidence,
                maxInsights: options.max,
                insightTypes,
                verbose: true
            });

            // Register datasets
            for (const [name, store] of stores.entries()) {
                insightsEngine.registerDataset(name, store);
            }

            // Generate insights
            console.log('Generating insights...');
            const insights = insightsEngine.generateInsights();

            // Output results
            if (options.format === 'json') {
                const output = JSON.stringify(insights, null, 2);

                if (options.output) {
                    fs.writeFileSync(options.output, output);
                    console.log(`Saved ${insights.length} insights to ${options.output}`);
                } else {
                    console.log(output);
                }
            } else {
                // Table format
                console.log(`\nGenerated ${insights.length} insights:\n`);

                insights.forEach((insight, idx) => {
                    console.log(`[${idx + 1}] ${insight.title} (${insight.type})`);
                    console.log(`    Confidence: ${(insight.confidence * 100).toFixed(1)}%`);
                    console.log(`    Description: ${insight.description}`);
                    console.log(`    Query: ${insight.query}`);
                    console.log(`    Datasets: ${insight.datasets.join(', ')}`);
                    console.log('');
                });

                if (options.output) {
                    const output = insights.map((insight, idx) => {
                        return `[${idx + 1}] ${insight.title} (${insight.type})\n` +
                            `    Confidence: ${(insight.confidence * 100).toFixed(1)}%\n` +
                            `    Description: ${insight.description}\n` +
                            `    Query: ${insight.query}\n` +
                            `    Datasets: ${insight.datasets.join(', ')}\n`;
                    }).join('\n');

                    fs.writeFileSync(options.output, output);
                    console.log(`Saved insights to ${options.output}`);
                }
            }
        } catch (error) {
            console.error('Error generating insights:', error);
            process.exit(1);
        }
    });

program.parse(process.argv);