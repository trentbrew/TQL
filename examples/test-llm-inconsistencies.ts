#!/usr/bin/env bun

/**
 * Test LLM Response Inconsistencies
 * Check if rate limiting or API issues cause response format problems
 */

import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import chalk from 'chalk';

async function testLLMInconsistencies() {
  console.log("🤖 TESTING LLM RESPONSE INCONSISTENCIES\n");
  
  const basePrompt = `You are an expert at converting natural language queries to EQL-S (EAV Query Language - Strict).

Available attributes in the dataset:
- email:string e.g. alice@gmail.com

EQL-S Grammar Rules:
- Use FIND <type> AS ?var to specify entity type and variable
- Use WHERE clause for conditions  
- Use RETURN clause to specify output fields

Entity type detected: user

Convert this natural language query to EQL-S: "users with gmail emails"

Output ONLY the EQL-S query, no explanations or additional text.`;

  // Test the same prompt multiple times quickly
  const attempts = 6;
  let successCount = 0;
  
  for (let i = 0; i < attempts; i++) {
    console.log(`${chalk.blue(`Attempt ${i+1}:`)} Testing same prompt...`);
    
    const startTime = Date.now();
    
    try {
      const result = await generateText({
        model: openai('gpt-4o-mini'),
        prompt: basePrompt,
        temperature: 0.1, // Low temperature for consistency
      });
      
      const endTime = Date.now();
      console.log(`⏱️ Time: ${endTime - startTime}ms`);
      
      const response = result.text.trim();
      console.log(`📤 Response: "${response}"`);
      
      // Check response validity
      if (response.startsWith('FIND')) {
        console.log(chalk.green(`✅ Valid EQL-S`));
        successCount++;
      } else {
        console.log(chalk.red(`❌ Invalid response (doesn't start with FIND)`));
        
        // Check if it's an error message or rate limit response
        if (response.includes('rate limit') || response.includes('quota') || response.includes('error')) {
          console.log(chalk.red(`🚨 API Error detected`));
        } else {
          console.log(chalk.yellow(`🤔 Unexpected format: "${response}"`));
        }
      }
      
    } catch (error) {
      console.log(chalk.red(`💥 Exception: ${error instanceof Error ? error.message : String(error)}`));
    }
    
    console.log();
    
    // Short delay between requests
    if (i < attempts - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log(chalk.bgBlue.white(`\n 📊 CONSISTENCY TEST: ${successCount}/${attempts} responses were valid \n`));
  
  if (successCount < attempts) {
    console.log(chalk.yellow("💡 ANALYSIS:"));
    console.log("- Rate limiting or API issues causing inconsistent responses");
    console.log("- Need to add retry logic and better error handling");
    console.log("- May need to implement exponential backoff");
  }
}

testLLMInconsistencies().catch(console.error);