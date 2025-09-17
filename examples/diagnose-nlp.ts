#!/usr/bin/env bun

/**
 * Diagnose Natural Language Processing Issues
 * Determine if problems are syntax errors or ineffective queries
 */

import { processQuery } from '../src/ai/orchestrator.js';
import { EQLSProcessor } from '../src/query/eqls-parser.js';
import { EAVStore, jsonEntityFacts } from '../src/eav-engine.js';
import { DatalogEvaluator } from '../src/query/datalog-evaluator.js';
import chalk from 'chalk';

// Test data for validation
const testData = [
  {
    type: 'user',
    id: '1',
    name: 'Alice Johnson',
    email: 'alice.johnson@gmail.com',
    department: 'Engineering',
    skills: ['JavaScript', 'Python'],
    active: true
  },
  {
    type: 'product',
    id: '1',
    name: 'iPhone 15',
    price: 999.99,
    category: 'electronics',
    inStock: true
  },
  {
    type: 'event',
    id: '1',
    title: 'TechConf 2024',
    startDate: '2024-10-15',
    capacity: 500
  }
];

// Natural language queries from our failing tests
const nlQueries = [
  {
    query: "users with gmail emails",
    expectedPattern: "@gmail",
    description: "Email domain search"
  },
  {
    query: "products between 400 and 1000 dollars", 
    expectedPattern: "BETWEEN",
    description: "Price range search"
  },
  {
    query: "events in 2024",
    expectedPattern: "2024",
    description: "Date pattern search"
  },
  {
    query: "users skilled in Python",
    expectedPattern: "Python",
    description: "Skills search"
  },
  {
    query: "active users in engineering",
    expectedPattern: "active",
    description: "Boolean field search"
  },
  {
    query: "products containing iPhone",
    expectedPattern: "iPhone",
    description: "Simple contains search"
  }
];

async function diagnoseNLP() {
  console.log(chalk.bgBlue.white("\n 🔍 DIAGNOSING NATURAL LANGUAGE PROCESSING ISSUES \n"));
  
  // Set up test environment
  const store = new EAVStore();
  const allFacts: any[] = [];
  
  testData.forEach(entity => {
    const entityId = `${entity.type}:${entity.id}`;
    const facts = jsonEntityFacts(entityId, entity, entity.type);
    allFacts.push(...facts);
  });
  
  store.addFacts(allFacts);
  
  // Generate catalog for NL processing
  const catalog = [
    { attribute: 'name', type: 'string', examples: ['Alice Johnson', 'iPhone 15'] },
    { attribute: 'email', type: 'string', examples: ['alice@gmail.com'] },
    { attribute: 'price', type: 'number', examples: [999.99] },
    { attribute: 'category', type: 'string', examples: ['electronics'] },
    { attribute: 'skills', type: 'string', examples: ['JavaScript', 'Python'] },
    { attribute: 'active', type: 'boolean', examples: [true, false] },
    { attribute: 'department', type: 'string', examples: ['Engineering'] },
    { attribute: 'startDate', type: 'string', examples: ['2024-10-15'] },
    { attribute: 'title', type: 'string', examples: ['TechConf 2024'] }
  ];
  
  const dataStats = {
    totalFacts: store.getStats().totalFacts,
    uniqueEntities: store.getStats().uniqueEntities,
    uniqueAttributes: store.getStats().uniqueAttributes
  };
  
  console.log(`📊 Test environment: ${dataStats.totalFacts} facts, ${dataStats.uniqueEntities} entities\n`);
  
  // Helper function to test EQL-S syntax
  async function testEQLSyntax(eqlsQuery: string): Promise<{ valid: boolean, error?: string, executable?: boolean }> {
    try {
      const processor = new EQLSProcessor();
      const result = processor.process(eqlsQuery);
      
      if (result.errors?.length > 0) {
        return { valid: false, error: result.errors[0]?.message };
      }
      
      // Try to execute the query
      try {
        const evaluator = new DatalogEvaluator(store);
        const queryResult = evaluator.evaluate(result.query!);
        return { valid: true, executable: true };
      } catch (execError) {
        return { 
          valid: true, 
          executable: false, 
          error: `Execution failed: ${execError instanceof Error ? execError.message : String(execError)}` 
        };
      }
      
    } catch (parseError) {
      return { 
        valid: false, 
        error: `Parse failed: ${parseError instanceof Error ? parseError.message : String(parseError)}` 
      };
    }
  }
  
  // Analyze each NL query
  let syntaxErrors = 0;
  let ineffectiveQueries = 0;
  let successfulQueries = 0;
  let totalFailures = 0;
  
  for (const test of nlQueries) {
    console.log(chalk.yellow(`\n📝 Testing: "${test.query}"`));
    console.log(`Expected to contain: ${chalk.cyan(test.expectedPattern)}`);
    
    try {
      // Step 1: Generate EQL-S from natural language
      const nlResult = await processQuery(test.query, { catalog, dataStats });
      
      if (nlResult.error) {
        console.log(chalk.red(`❌ NL Processing Error: ${nlResult.error}`));
        totalFailures++;
        
        // Check if it's a validation error vs generation error
        if (nlResult.error.includes("Generated query does not start with FIND")) {
          console.log(chalk.yellow(`   → Likely ineffective query generation`));
          ineffectiveQueries++;
        } else {
          console.log(chalk.yellow(`   → Processing error: ${nlResult.error}`));
        }
        continue;
      }
      
      if (!nlResult.eqlsQuery) {
        console.log(chalk.red(`❌ No EQL-S query generated`));
        ineffectiveQueries++;
        totalFailures++;
        continue;
      }
      
      console.log(`Generated EQL-S: ${chalk.green(nlResult.eqlsQuery)}`);
      
      // Step 2: Test EQL-S syntax validity
      const syntaxResult = await testEQLSyntax(nlResult.eqlsQuery);
      
      if (!syntaxResult.valid) {
        console.log(chalk.red(`❌ Syntax Error: ${syntaxResult.error}`));
        syntaxErrors++;
        totalFailures++;
        continue;
      }
      
      console.log(chalk.green(`✅ Valid EQL-S syntax`));
      
      // Step 3: Check if query is executable
      if (!syntaxResult.executable) {
        console.log(chalk.yellow(`⚠️ Query valid but not executable: ${syntaxResult.error}`));
        ineffectiveQueries++;
        totalFailures++;
        continue;
      }
      
      console.log(chalk.green(`✅ Query executable`));
      
      // Step 4: Check if query contains expected patterns
      const containsPattern = nlResult.eqlsQuery.toLowerCase().includes(test.expectedPattern.toLowerCase());
      
      if (!containsPattern) {
        console.log(chalk.yellow(`⚠️ Query doesn't contain expected pattern "${test.expectedPattern}"`));
        ineffectiveQueries++;
        totalFailures++;
        continue;
      }
      
      console.log(chalk.green(`✅ Query contains expected pattern`));
      successfulQueries++;
      
    } catch (error) {
      console.log(chalk.red(`❌ Unexpected Error: ${error instanceof Error ? error.message : String(error)}`));
      totalFailures++;
    }
    
    console.log(chalk.gray("----------------------------------------"));
  }
  
  // Summary analysis
  console.log(chalk.bgGreen.black("\n 📊 DIAGNOSTIC SUMMARY \n"));
  
  console.log(`Total Queries Tested: ${chalk.blue(nlQueries.length.toString())}`);
  console.log(`Successful: ${chalk.green(successfulQueries.toString())} (${Math.round(successfulQueries/nlQueries.length*100)}%)`);
  console.log(`Failed: ${chalk.red(totalFailures.toString())} (${Math.round(totalFailures/nlQueries.length*100)}%)`);
  
  console.log(chalk.yellow("\nFailure Breakdown:"));
  console.log(`• Syntax Errors: ${chalk.red(syntaxErrors.toString())} (${Math.round(syntaxErrors/nlQueries.length*100)}%)`);
  console.log(`• Ineffective Queries: ${chalk.yellow(ineffectiveQueries.toString())} (${Math.round(ineffectiveQueries/nlQueries.length*100)}%)`);
  
  // Recommendations
  console.log(chalk.bgBlue.white("\n 💡 RECOMMENDATIONS \n"));
  
  if (syntaxErrors > ineffectiveQueries) {
    console.log(chalk.red("🔥 Primary Issue: SYNTAX ERRORS"));
    console.log("   → Focus on improving EQL-S generation to produce valid syntax");
    console.log("   → Check grammar rules and token handling in LLM prompts");
  } else if (ineffectiveQueries > syntaxErrors) {
    console.log(chalk.yellow("🎯 Primary Issue: INEFFECTIVE QUERY GENERATION"));
    console.log("   → Focus on improving natural language understanding");
    console.log("   → Enhance entity type detection and attribute mapping");
    console.log("   → Review LLM prompt engineering and examples");
  } else {
    console.log(chalk.yellow("⚖️ Mixed Issues: Both syntax and effectiveness problems"));
    console.log("   → Address both syntax generation and semantic understanding");
  }
  
  if (syntaxErrors > 0) {
    console.log(chalk.red("\n🔧 Syntax Error Fixes Needed:"));
    console.log("   → Review EQL-S grammar rules in LLM prompts");
    console.log("   → Validate generated queries before returning");
    console.log("   → Add more robust error handling in NL processor");
  }
  
  if (ineffectiveQueries > 0) {
    console.log(chalk.yellow("\n🎨 Query Effectiveness Fixes Needed:"));
    console.log("   → Improve entity type detection algorithms");
    console.log("   → Enhance attribute name mapping from NL to schema");
    console.log("   → Add more diverse examples in LLM prompts");
    console.log("   → Consider fine-tuning prompts for specific query patterns");
  }
}

diagnoseNLP().catch(console.error);