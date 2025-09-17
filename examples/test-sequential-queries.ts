#!/usr/bin/env bun

/**
 * Test sequential NL queries to detect rate limiting or timing issues
 */

import { processQuery } from '../src/ai/orchestrator.js';
import chalk from 'chalk';

async function testSequentialQueries() {
  console.log("🔄 TESTING SEQUENTIAL NL QUERIES\n");
  
  const catalog = [
    { attribute: 'name', type: 'string', examples: ['Alice Johnson', 'iPhone 15'] },
    { attribute: 'email', type: 'string', examples: ['alice@gmail.com'] },
    { attribute: 'price', type: 'number', examples: [999.99] },
    { attribute: 'tags', type: 'string', examples: ['smartphone', 'premium'] }
  ];
  
  const dataStats = {
    totalFacts: 22,
    uniqueEntities: 3,
    uniqueAttributes: 9
  };
  
  const queries = [
    "products containing Éclair",
    "users with gmail emails",
    "products between 400 and 1000 dollars",
    "users with gmail emails", // Test the same query again
  ];
  
  let successCount = 0;
  
  for (let i = 0; i < queries.length; i++) {
    const query = queries[i]!; // Non-null assertion since we know i is valid
    console.log(`${chalk.blue(`Query ${i+1}:`)} ${chalk.yellow(`"${query}"`)}`);
    
    const startTime = Date.now();
    
    try {
      const result = await processQuery(query, { catalog, dataStats });
      const endTime = Date.now();
      
      console.log(`⏱️ Time: ${endTime - startTime}ms`);
      
      if (result.error) {
        console.log(chalk.red(`❌ Error: ${result.error}`));
      } else if (result.eqlsQuery) {
        console.log(chalk.green(`✅ Success: ${result.eqlsQuery}`));
        successCount++;
      } else {
        console.log(chalk.yellow("⚠️ No error but no query"));
      }
      
    } catch (error) {
      console.log(chalk.red(`💥 Exception: ${error instanceof Error ? error.message : String(error)}`));
    }
    
    console.log();
    
    // Add a small delay to avoid rate limiting
    if (i < queries.length - 1) {
      console.log("⏳ Waiting 1 second...\n");
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(chalk.bgBlue.white(`\n 📊 SUMMARY: ${successCount}/${queries.length} queries succeeded \n`));
}

testSequentialQueries().catch(console.error);