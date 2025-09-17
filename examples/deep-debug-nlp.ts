#!/usr/bin/env bun

/**
 * Deep Debug NLP - trace exactly where processQuery fails
 */

import { processQuery } from '../src/ai/orchestrator.js';
import chalk from 'chalk';

async function deepDebugNLP() {
  console.log("🔍 DEEP DEBUGGING NLP PROCESS\n");
  
  // Test data
  const catalog = [
    { attribute: 'name', type: 'string', examples: ['Alice Johnson', 'iPhone 15'] },
    { attribute: 'email', type: 'string', examples: ['alice@gmail.com'] },
  ];
  
  const dataStats = {
    totalFacts: 22,
    uniqueEntities: 3,
    uniqueAttributes: 9
  };
  
  const failingQuery = "users with gmail emails";
  
  console.log(`Testing query: ${chalk.yellow(`"${failingQuery}"`)}\n`);
  
  try {
    console.log("🤖 Calling processQuery...");
    const startTime = Date.now();
    
    const result = await processQuery(failingQuery, { catalog, dataStats });
    
    const endTime = Date.now();
    console.log(`⏱️ Processing took: ${endTime - startTime}ms\n`);
    
    console.log("📤 RAW RESULT:");
    console.log(JSON.stringify(result, null, 2));
    console.log();
    
    if (result.error) {
      console.log(chalk.red(`❌ Error: ${result.error}`));
    } else if (result.eqlsQuery) {
      console.log(chalk.green(`✅ Success: ${result.eqlsQuery}`));
    } else {
      console.log(chalk.yellow("⚠️ No error but no query either"));
    }
    
  } catch (error) {
    console.log(chalk.red("💥 EXCEPTION CAUGHT:"));
    console.log(error);
    
    if (error instanceof Error) {
      console.log(`Message: ${error.message}`);
      console.log(`Stack: ${error.stack}`);
    }
  }
}

deepDebugNLP().catch(console.error);