#!/usr/bin/env bun

/**
 * Comprehensive test suite for TQL regex pattern matching and natural language processing
 * This validates both the MATCHES operator and natural language pattern recognition
 */

import { EAVStore, jsonEntityFacts } from '../src/eav-engine.js';
import { DatalogEvaluator } from '../src/query/datalog-evaluator.js';
import { processQuery } from '../src/ai/orchestrator.js';
import chalk from 'chalk';

// Import the EQL-S processor directly from the parser file
import { EQLSProcessor } from '../src/query/eqls-parser.js';

// Define font data interface to avoid type errors
interface FontData {
    type: string;
    id: string;
    family: string;
    category: string;
    price: number;
    tags: string[];
    [key: string]: string | number | string[]; // Index signature for dynamic access
}

// Sample data for testing
const fontData: FontData[] = [
    { type: 'font', id: '1', family: 'ABeeZee', category: 'sans-serif', price: 15.99, tags: ['popular', 'clean'] },
    { type: 'font', id: '2', family: 'Roboto', category: 'sans-serif', price: 10.50, tags: ['modern', 'popular'] },
    { type: 'font', id: '3', family: 'Times New Roman', category: 'serif', price: 5.00, tags: ['classic'] },
    { type: 'font', id: '4', family: 'Arial', category: 'sans-serif', price: 0.00, tags: ['common', 'basic'] },
    { type: 'font', id: '5', family: 'Pacifico', category: 'display', price: 25.50, tags: ['decorative'] },
    { type: 'font', id: '6', family: 'Anton', category: 'display', price: 19.99, tags: ['bold', 'strong'] },
    { type: 'font', id: '7', family: 'Merriweather', category: 'serif', price: 12.75, tags: ['elegant', 'readable'] },
    { type: 'font', id: '8', family: 'Tahoma', category: 'sans-serif', price: 9.99, tags: ['legible'] },
];

// Helper function to run an EQL-S query and return results
async function runQuery(store: EAVStore, query: string): Promise<any> {
    // Create processor and evaluator
    const processor = new EQLSProcessor();
    const evaluator = new DatalogEvaluator(store);

    // Process the query to get compiled form
    const result = processor.process(query);

    if (result.errors && result.errors.length > 0) {
        throw new Error(`Query parsing failed: ${result.errors[0]?.message || 'Unknown error'}`);
    }

    // Execute the query
    const queryResult = evaluator.evaluate(result.query!);

    // Format results as rows
    const rows = queryResult.bindings.map(binding => {
        // Extract values using the projection map values (not keys)
        return Array.from(result.projectionMap?.entries() || []).map(([key, varName]) => {
            const value = binding[varName] || binding[varName.substring(1)]; // Try with and without ?
            return value;
        });
    });

    return { rows, executionTime: queryResult.executionTime };
}

// Test cases for regex pattern matching with direct EQL-S
const regexTestCases = [
    {
        description: "Simple MATCHES with exact pattern",
        query: `FIND font AS ?f WHERE ?f.family MATCHES /^A/ RETURN ?f.family`,
        expectedMatches: ["ABeeZee", "Arial", "Anton"]
    },
    {
        description: "MATCHES with contains pattern",
        query: `FIND font AS ?f WHERE ?f.family MATCHES /ot/ RETURN ?f.family`,
        expectedMatches: ["Roboto"]
    },
    {
        description: "MATCHES with ending pattern",
        query: `FIND font AS ?f WHERE ?f.family MATCHES /o$/ RETURN ?f.family`,
        expectedMatches: ["Roboto", "Pacifico"]
    },
    {
        description: "Complex regex pattern with alternation",
        query: `FIND font AS ?f WHERE ?f.family MATCHES /^(A|T)/ RETURN ?f.family`,
        expectedMatches: ["ABeeZee", "Times New Roman", "Tahoma", "Arial", "Anton"]
    },
    {
        description: "MATCHES with character class",
        query: `FIND font AS ?f WHERE ?f.family MATCHES /[aeiou]{2}/ RETURN ?f.family`,
        expectedMatches: ["ABeeZee", "Times New Roman", "Pacifico", "Tahoma"]
    },
    {
        description: "Numeric filtering with regex",
        query: `FIND font AS ?f WHERE ?f.price < 10 AND ?f.family MATCHES /^[AT]/ RETURN ?f.family, ?f.price`,
        expectedMatches: ["Arial", "Tahoma"]
    }
];

// Test cases for natural language pattern processing
const nlTestCases = [
    {
        description: "Starting with pattern",
        query: "fonts that start with A",
        expectedPattern: "^A"
    },
    {
        description: "Beginning with pattern variation",
        query: "show me fonts beginning with T",
        expectedPattern: "^T"
    },
    {
        description: "Contains pattern",
        query: "fonts containing the text 'mer'",
        expectedPattern: "mer"
    },
    {
        description: "Ending with pattern",
        query: "fonts that end with o",
        expectedPattern: "o$"
    },
    {
        description: "Price comparison",
        query: "fonts cheaper than 10 dollars",
        expectedComparison: "<"
    },
    {
        description: "Category with pattern",
        query: "serif fonts that start with M",
        expectedCombination: true
    }
];

// Generate sample catalog for NL processing
function generateCatalog() {
    const attributes = ['family', 'category', 'price', 'tags'];
    return attributes.map(attr => {
        const examples = new Set<string | number>();
        fontData.forEach(font => {
            const value = font[attr];
            if (Array.isArray(value)) {
                value.forEach(val => examples.add(val));
            } else if (value !== undefined) {
                examples.add(value);
            }
        });
        return {
            attribute: attr,
            // Using safe type checking with optional chaining
            type: typeof fontData[0]?.[attr] === 'number' ? 'number' : 'string',
            examples: Array.from(examples).slice(0, 3)
        };
    });
}

// Run the tests
async function runTests() {
    console.log(chalk.bgBlue.white("\n 🧪 COMPREHENSIVE TQL PATTERN TESTING SUITE \n"));

    // Create store with font data
    console.log(chalk.blue("📊 Initializing test data store..."));
    const store = new EAVStore();

    // Convert sample data to EAV facts
    const allFacts: any[] = [];

    fontData.forEach(font => {
        const entityId = `${font.type}:${font.id}`;
        const facts = jsonEntityFacts(entityId, font, font.type);
        allFacts.push(...facts);
    });

    // Add all facts at once
    store.addFacts(allFacts);

    const stats = store.getStats();
    console.log(chalk.green(`✅ Store initialized with ${stats.totalFacts} facts\n`));

    // Generate catalog for NL processing
    const catalog = generateCatalog();
    const dataStats = {
        totalFacts: stats.totalFacts,
        uniqueEntities: stats.uniqueEntities,
        uniqueAttributes: stats.uniqueAttributes
    };

    // Part 1: Test REGEX pattern matching with EQL-S
    console.log(chalk.bgYellow.black("\n 📋 PART 1: TESTING REGEX PATTERN MATCHING WITH EQL-S \n"));

    let regexPassCount = 0;
    for (const testCase of regexTestCases) {
        console.log(chalk.yellow(`\n📝 Test: ${testCase.description}`));
        console.log(`Query: ${chalk.cyan(testCase.query)}`);

        try {
            const results = await runQuery(store, testCase.query);

            if (!results || !results.rows) {
                console.log(chalk.red(`❌ No results returned`));
                continue;
            }

            const familyValues = results.rows.map((row: any[]) => row[0]);
            console.log(`Results: ${chalk.green(JSON.stringify(familyValues))}`);

            // Verify expected matches
            const allMatched = testCase.expectedMatches.every(expected =>
                familyValues.includes(expected)
            );

            const matchCount = testCase.expectedMatches.filter(expected =>
                familyValues.includes(expected)
            ).length;

            if (allMatched && matchCount === testCase.expectedMatches.length && matchCount === familyValues.length) {
                console.log(chalk.green(`✅ PASS: All expected matches found and nothing extra`));
                regexPassCount++;
            } else if (allMatched && matchCount === testCase.expectedMatches.length) {
                console.log(chalk.yellow(`⚠️ PARTIAL PASS: All expected matches found, but extra results present`));
                console.log(`Expected: ${chalk.cyan(JSON.stringify(testCase.expectedMatches))}`);
            } else {
                console.log(chalk.red(`❌ FAIL: Not all expected matches found`));
                console.log(`Expected: ${chalk.cyan(JSON.stringify(testCase.expectedMatches))}`);
                console.log(`Missing: ${chalk.red(JSON.stringify(testCase.expectedMatches.filter(e => !familyValues.includes(e))))}`);
            }
        } catch (error) {
            console.log(chalk.red(`❌ ERROR: ${error instanceof Error ? error.message : String(error)}`));
        }

        console.log(chalk.gray("----------------------------------------------"));
    }

    // Part 2: Test Natural Language Processing
    console.log(chalk.bgMagenta.white("\n 🗣️ PART 2: TESTING NATURAL LANGUAGE PATTERN PROCESSING \n"));

    let nlPassCount = 0;
    for (const testCase of nlTestCases) {
        console.log(chalk.magenta(`\n📝 Test: ${testCase.description}`));
        console.log(`Query: ${chalk.cyan(testCase.query)}`);

        try {
            const result = await processQuery(testCase.query, {
                catalog,
                dataStats
            });

            if (result.error) {
                console.log(chalk.red(`❌ Error: ${result.error}`));
            } else if (result.eqlsQuery) {
                console.log(`Generated EQL-S: ${chalk.green(result.eqlsQuery)}`);

                // Pattern validation
                let patternMatch = true;

                if (testCase.expectedPattern) {
                    patternMatch = result.eqlsQuery.includes("MATCHES") &&
                        result.eqlsQuery.includes(testCase.expectedPattern);
                }

                if (testCase.expectedComparison) {
                    patternMatch = result.eqlsQuery.includes(testCase.expectedComparison);
                }

                if (testCase.expectedCombination) {
                    patternMatch = result.eqlsQuery.includes("MATCHES") &&
                        (result.eqlsQuery.includes("category") ||
                            result.eqlsQuery.includes("serif"));
                }

                if (patternMatch) {
                    console.log(chalk.green(`✅ PASS: Pattern properly recognized`));

                    // Actually run the query to validate results
                    try {
                        const queryResults = await runQuery(store, result.eqlsQuery);
                        console.log(`Query execution results: ${chalk.green(queryResults.rows.length)} rows returned`);
                        if (queryResults.rows.length > 0) {
                            console.log(`Sample result: ${chalk.cyan(JSON.stringify(queryResults.rows[0]))}`);
                        }
                        nlPassCount++;
                    } catch (queryError) {
                        console.log(chalk.red(`❌ Generated query execution failed: ${queryError instanceof Error ? queryError.message : String(queryError)}`));
                    }
                } else {
                    console.log(chalk.red(`❌ FAIL: Pattern not properly recognized in generated query`));
                    if (testCase.expectedPattern) {
                        console.log(`Expected pattern: ${chalk.cyan(testCase.expectedPattern)}`);
                    }
                }
            }
        } catch (error) {
            console.log(chalk.red(`❌ Exception: ${error instanceof Error ? error.message : String(error)}`));
        }

        console.log(chalk.gray("----------------------------------------------"));
    }

    // Summary
    console.log(chalk.bgGreen.black("\n 📊 TEST SUMMARY \n"));
    console.log(`Regex Pattern Tests: ${chalk.green(`${regexPassCount}/${regexTestCases.length} passed`)} (${Math.round(regexPassCount / regexTestCases.length * 100)}%)`);
    console.log(`Natural Language Tests: ${chalk.green(`${nlPassCount}/${nlTestCases.length} passed`)} (${Math.round(nlPassCount / nlTestCases.length * 100)}%)`);
    console.log(`Overall: ${chalk.green(`${regexPassCount + nlPassCount}/${regexTestCases.length + nlTestCases.length} passed`)} (${Math.round((regexPassCount + nlPassCount) / (regexTestCases.length + nlTestCases.length) * 100)}%)`);

    if (regexPassCount === regexTestCases.length && nlPassCount === nlTestCases.length) {
        console.log(chalk.bgGreen.black("\n 🎉 ALL TESTS PASSED! \n"));
    } else {
        console.log(chalk.bgYellow.black("\n ⚠️ SOME TESTS FAILED \n"));
    }
}

runTests().catch(console.error);