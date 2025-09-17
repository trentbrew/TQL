#!/usr/bin/env bun

/**
 * Comprehensive TQL Pattern Testing with Synthetic Data
 * Tests edge cases, complex patterns, and diverse data types
 */

import { EAVStore, jsonEntityFacts } from '../src/eav-engine.js';
import { DatalogEvaluator } from '../src/query/datalog-evaluator.js';
import { processQuery } from '../src/ai/orchestrator.js';
import { EQLSProcessor } from '../src/query/eqls-parser.js';
import chalk from 'chalk';

// Comprehensive synthetic test data covering edge cases
const syntheticData = [
    // Products with edge case patterns
    {
        type: 'product',
        id: '1',
        name: 'iPhone 15',
        description: 'Latest smartphone with advanced features',
        price: 999.99,
        category: 'electronics',
        brand: 'Apple',
        model: 'iPhone',
        sku: 'APL-IPH-15-128',
        tags: ['smartphone', 'premium', 'new'],
        inStock: true,
        released: '2023-09-15',
        specs: {
            storage: '128GB',
            color: 'Space Black',
            screen: '6.1"'
        }
    },
    {
        type: 'product',
        id: '2',
        name: 'Samsung Galaxy S24',
        description: null, // Test null values
        price: 899.99,
        category: 'electronics',
        brand: 'Samsung',
        model: 'Galaxy S24',
        sku: 'SAM-GAL-S24-256',
        tags: ['smartphone', 'android'],
        inStock: false,
        released: '2024-01-17',
        specs: {
            storage: '256GB',
            color: 'Phantom Silver',
            screen: '6.2"'
        }
    },
    {
        type: 'product',
        id: '3',
        name: 'Éclair Pastry', // Unicode characters
        description: 'Delicious French pastry with cream',
        price: 4.50,
        category: 'food',
        brand: 'Café François',
        model: '',
        sku: 'FOOD-ECL-001',
        tags: ['pastry', 'dessert', 'french', 'éclair'],
        inStock: true,
        released: '2024-01-01',
        specs: null
    },

    // Users with various name patterns
    {
        type: 'user',
        id: '1',
        name: 'Alice Johnson',
        email: 'alice.johnson@example.com',
        username: 'alice_j',
        age: 28,
        department: 'Engineering',
        role: 'Senior Developer',
        skills: ['JavaScript', 'Python', 'React'],
        active: true,
        joinDate: '2020-03-15',
        metadata: {
            lastLogin: '2024-09-16',
            preferences: {
                theme: 'dark',
                notifications: true
            }
        }
    },
    {
        type: 'user',
        id: '2',
        name: 'Bob O\'Connor', // Test apostrophes
        email: 'bob.oconnor@company.org',
        username: 'bob_o',
        age: 35,
        department: 'Marketing',
        role: 'Product Manager',
        skills: ['Strategy', 'Analytics', 'SQL'],
        active: true,
        joinDate: '2019-07-22',
        metadata: {
            lastLogin: '2024-09-15',
            preferences: {
                theme: 'light',
                notifications: false
            }
        }
    },
    {
        type: 'user',
        id: '3',
        name: '陈小明', // Chinese characters
        email: 'xiaoming.chen@global.com',
        username: 'chen_xm',
        age: 31,
        department: 'Engineering',
        role: 'Tech Lead',
        skills: ['Java', 'Kubernetes', 'Architecture'],
        active: false,
        joinDate: '2021-11-08',
        metadata: {
            lastLogin: '2024-08-30',
            preferences: {
                theme: 'auto',
                notifications: true
            }
        }
    },

    // Documents with various content patterns
    {
        type: 'document',
        id: '1',
        title: 'API Documentation v2.1',
        content: 'This document describes the REST API endpoints...',
        author: 'Alice Johnson',
        category: 'technical',
        tags: ['api', 'documentation', 'v2.1'],
        wordCount: 1250,
        published: true,
        createdAt: '2024-01-15',
        updatedAt: '2024-09-10',
        version: '2.1.0',
        format: 'markdown'
    },
    {
        type: 'document',
        id: '2',
        title: 'Meeting Notes - Q3 Planning',
        content: 'Attendees: Alice, Bob, Chen\\nAgenda:\\n1. Review Q2 results\\n2. Plan Q3 objectives',
        author: 'Bob O\'Connor',
        category: 'meeting',
        tags: ['meeting', 'planning', 'q3', '2024'],
        wordCount: 450,
        published: false,
        createdAt: '2024-07-01',
        updatedAt: '2024-07-01',
        version: '1.0.0',
        format: 'text'
    },

    // Events with date/time patterns
    {
        type: 'event',
        id: '1',
        title: 'TechConf 2024',
        description: 'Annual technology conference',
        startDate: '2024-10-15',
        endDate: '2024-10-17',
        location: 'San Francisco, CA',
        organizer: 'Tech Events Inc.',
        capacity: 500,
        registered: 342,
        tags: ['conference', 'technology', '2024'],
        virtual: false,
        price: 299.00
    },
    {
        type: 'event',
        id: '2',
        title: 'Online Workshop: Advanced SQL',
        description: 'Learn advanced SQL techniques and optimization',
        startDate: '2024-09-25',
        endDate: '2024-09-25',
        location: 'Virtual',
        organizer: 'Data Academy',
        capacity: 100,
        registered: 87,
        tags: ['workshop', 'sql', 'online', 'database'],
        virtual: true,
        price: 49.99
    }
];

// Complex test patterns to validate
const comprehensiveTests = [
    // Unicode and special characters
    {
        description: "Unicode characters in names",
        query: `FIND product AS ?p WHERE ?p.name MATCHES /Éclair/ RETURN ?p.name`,
        expectedCount: 1
    },
    {
        description: "Apostrophes in names",
        query: `FIND user AS ?u WHERE ?u.name MATCHES /O'Connor/ RETURN ?u.name`,
        expectedCount: 1
    },
    {
        description: "Chinese characters",
        query: `FIND user AS ?u WHERE ?u.name MATCHES /陈/ RETURN ?u.name`,
        expectedCount: 1
    },

    // Complex regex patterns
    {
        description: "Email domain patterns",
        query: `FIND user AS ?u WHERE ?u.email MATCHES /@[a-z]+\\.com$/ RETURN ?u.email`,
        expectedCount: 2 // example.com and global.com
    },
    {
        description: "SKU format validation",
        query: `FIND product AS ?p WHERE ?p.sku MATCHES /^[A-Z]{3}-[A-Z]{3}-/ RETURN ?p.sku`,
        expectedCount: 3 // All products have this format
    },
    {
        description: "Version number patterns",
        query: `FIND document AS ?d WHERE ?d.version MATCHES /^[0-9]+\\.[0-9]+\\.[0-9]+$/ RETURN ?d.version`,
        expectedCount: 2
    },

    // Null and empty value handling
    {
        description: "Products with null descriptions",
        query: `FIND product AS ?p WHERE ?p.description = null RETURN ?p.name`,
        expectedCount: 1 // Samsung Galaxy S24
    },
    {
        description: "Products with empty model",
        query: `FIND product AS ?p WHERE ?p.model = "" RETURN ?p.name`,
        expectedCount: 1 // Éclair Pastry
    },

    // Numeric range patterns
    {
        description: "High-priced products",
        query: `FIND product AS ?p WHERE ?p.price > 500 RETURN ?p.name`,
        expectedCount: 2 // iPhone and Samsung
    },
    {
        description: "Event capacity ranges",
        query: `FIND event AS ?e WHERE ?e.capacity BETWEEN 100 AND 500 RETURN ?e.title`,
        expectedCount: 2
    },

    // Boolean and date patterns
    {
        description: "Active users",
        query: `FIND user AS ?u WHERE ?u.active = true RETURN ?u.name`,
        expectedCount: 2
    },
    {
        description: "Recent events (2024)",
        query: `FIND event AS ?e WHERE ?e.startDate MATCHES /^2024/ RETURN ?e.title`,
        expectedCount: 2
    },

    // Nested object patterns
    {
        description: "Dark theme users",
        query: `FIND user AS ?u WHERE ?u.metadata.preferences.theme = "dark" RETURN ?u.name`,
        expectedCount: 1
    },
    {
        description: "Products with storage specs",
        query: `FIND product AS ?p WHERE ?p.specs.storage MATCHES /GB$/ RETURN ?p.name, ?p.specs.storage`,
        expectedCount: 2
    },

    // Array/tag patterns
    {
        description: "JavaScript developers",
        query: `FIND user AS ?u WHERE ?u.skills CONTAINS "JavaScript" RETURN ?u.name`,
        expectedCount: 1
    },
    {
        description: "Technical documents",
        query: `FIND document AS ?d WHERE ?d.tags CONTAINS "api" RETURN ?d.title`,
        expectedCount: 1
    },

    // Complex combinations
    {
        description: "Expensive electronics in stock",
        query: `FIND product AS ?p WHERE ?p.category = "electronics" AND ?p.price > 500 AND ?p.inStock = true RETURN ?p.name`,
        expectedCount: 1 // Only iPhone 15
    },
    {
        description: "Engineers with modern skills",
        query: `FIND user AS ?u WHERE ?u.department = "Engineering" AND ?u.skills CONTAINS "React" RETURN ?u.name`,
        expectedCount: 1
    }
];

// Natural language test cases for diverse patterns
const naturalLanguageTests = [
    {
        description: "Unicode product search",
        query: "products containing Éclair",
        shouldFind: "éclair"
    },
    {
        description: "User email domain search",
        query: "users with gmail emails",
        shouldMatch: "@gmail"
    },
    {
        description: "Price range search",
        query: "products between 400 and 1000 dollars",
        shouldWork: true
    },
    {
        description: "Boolean field search",
        query: "active users in engineering",
        shouldWork: true
    },
    {
        description: "Date pattern search",
        query: "events in 2024",
        shouldWork: true
    },
    {
        description: "Skills search",
        query: "users skilled in Python",
        shouldWork: true
    }
];

async function runComprehensiveTests() {
    console.log(chalk.bgBlue.white("\n 🧪 COMPREHENSIVE TQL PATTERN TESTING WITH SYNTHETIC DATA \n"));

    // Initialize store with synthetic data
    console.log(chalk.blue("📊 Initializing comprehensive test data store..."));
    const store = new EAVStore();

    const allFacts: any[] = [];
    syntheticData.forEach(entity => {
        const entityId = `${entity.type}:${entity.id}`;
        const facts = jsonEntityFacts(entityId, entity, entity.type);
        allFacts.push(...facts);
    });

    store.addFacts(allFacts);
    const stats = store.getStats();
    console.log(chalk.green(`✅ Store initialized with ${stats.totalFacts} facts across ${stats.uniqueEntities} entities\n`));

    // Helper function to run EQL-S queries
    async function runEQLSQuery(query: string): Promise<any> {
        const processor = new EQLSProcessor();
        const evaluator = new DatalogEvaluator(store);

        const result = processor.process(query);
        if (result.errors?.length > 0) {
            throw new Error(`Query error: ${result.errors[0]?.message}`);
        }

        const queryResult = evaluator.evaluate(result.query!);
        const rows = queryResult.bindings.map(binding => {
            return Array.from(result.projectionMap?.entries() || []).map(([key, varName]) => {
                return binding[varName] || binding[varName.substring(1)];
            });
        });

        return { rows, count: rows.length };
    }

    // Test comprehensive patterns
    console.log(chalk.bgYellow.black("\n 📋 PART 1: COMPREHENSIVE PATTERN TESTING \n"));

    let passCount = 0;
    for (const test of comprehensiveTests) {
        console.log(chalk.yellow(`\n📝 Test: ${test.description}`));
        console.log(`Query: ${chalk.cyan(test.query)}`);

        try {
            const result = await runEQLSQuery(test.query);
            console.log(`Results: ${chalk.green(`${result.count} items found`)}`);

            if (result.count === test.expectedCount) {
                console.log(chalk.green(`✅ PASS: Expected ${test.expectedCount}, got ${result.count}`));
                passCount++;
            } else {
                console.log(chalk.red(`❌ FAIL: Expected ${test.expectedCount}, got ${result.count}`));
                if (result.rows.length > 0) {
                    console.log(`Sample results: ${chalk.cyan(JSON.stringify(result.rows.slice(0, 2)))}`);
                }
            }
        } catch (error) {
            console.log(chalk.red(`❌ ERROR: ${error instanceof Error ? error.message : String(error)}`));
        }

        console.log(chalk.gray("----------------------------------------------"));
    }

    // Test natural language processing
    console.log(chalk.bgMagenta.white("\n 🗣️ PART 2: NATURAL LANGUAGE PROCESSING WITH DIVERSE DATA \n"));

    // Generate catalog for NL processing
    const catalog = [
        { attribute: 'name', type: 'string', examples: ['iPhone 15', 'Alice Johnson'] },
        { attribute: 'email', type: 'string', examples: ['alice@example.com'] },
        { attribute: 'price', type: 'number', examples: [999.99, 4.50] },
        { attribute: 'category', type: 'string', examples: ['electronics', 'food'] },
        { attribute: 'tags', type: 'string', examples: ['smartphone', 'api'] },
        { attribute: 'active', type: 'boolean', examples: [true, false] },
        { attribute: 'skills', type: 'string', examples: ['JavaScript', 'Python'] }
    ];

    const dataStats = {
        totalFacts: stats.totalFacts,
        uniqueEntities: stats.uniqueEntities,
        uniqueAttributes: stats.uniqueAttributes
    };

    let nlPassCount = 0;
    for (const test of naturalLanguageTests) {
        console.log(chalk.magenta(`\n📝 Test: ${test.description}`));
        console.log(`Query: ${chalk.cyan(test.query)}`);

        try {
            const result = await processQuery(test.query, { catalog, dataStats });

            if (result.error) {
                console.log(chalk.red(`❌ Error: ${result.error}`));
            } else if (result.eqlsQuery) {
                console.log(`Generated EQL-S: ${chalk.green(result.eqlsQuery)}`);

                // Validate the generated query makes sense
                let valid = true;
                if (test.shouldFind && !result.eqlsQuery.toLowerCase().includes(test.shouldFind.toLowerCase())) {
                    valid = false;
                }
                if (test.shouldMatch && !result.eqlsQuery.includes(test.shouldMatch)) {
                    valid = false;
                }

                if (valid && test.shouldWork) {
                    console.log(chalk.green(`✅ PASS: Query generated successfully`));
                    nlPassCount++;

                    // Try to execute the query
                    try {
                        const execResult = await runEQLSQuery(result.eqlsQuery);
                        console.log(`Execution result: ${chalk.green(`${execResult.count} items found`)}`);
                    } catch (execError) {
                        console.log(chalk.yellow(`⚠️ Query generated but execution failed: ${execError instanceof Error ? execError.message : String(execError)}`));
                    }
                } else {
                    console.log(chalk.red(`❌ FAIL: Generated query doesn't match expected pattern`));
                }
            }
        } catch (error) {
            console.log(chalk.red(`❌ Exception: ${error instanceof Error ? error.message : String(error)}`));
        }

        console.log(chalk.gray("----------------------------------------------"));
    }

    // Final summary
    console.log(chalk.bgGreen.black("\n 📊 COMPREHENSIVE TEST SUMMARY \n"));
    console.log(`Pattern Tests: ${chalk.green(`${passCount}/${comprehensiveTests.length} passed`)} (${Math.round(passCount / comprehensiveTests.length * 100)}%)`);
    console.log(`Natural Language Tests: ${chalk.green(`${nlPassCount}/${naturalLanguageTests.length} passed`)} (${Math.round(nlPassCount / naturalLanguageTests.length * 100)}%)`);
    console.log(`Overall: ${chalk.green(`${passCount + nlPassCount}/${comprehensiveTests.length + naturalLanguageTests.length} passed`)} (${Math.round((passCount + nlPassCount) / (comprehensiveTests.length + naturalLanguageTests.length) * 100)}%)`);

    if (passCount === comprehensiveTests.length && nlPassCount === naturalLanguageTests.length) {
        console.log(chalk.bgGreen.black("\n 🎉 ALL COMPREHENSIVE TESTS PASSED! \n"));
        console.log(chalk.green("TQL is robust and ready for production use with diverse data patterns!"));
    } else {
        console.log(chalk.bgYellow.black("\n ⚠️ SOME TESTS FAILED - AREAS FOR IMPROVEMENT IDENTIFIED \n"));
    }
}

// Run the comprehensive tests
runComprehensiveTests().catch(console.error);