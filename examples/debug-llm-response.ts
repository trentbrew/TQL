#!/usr/bin/env bun

/**
 * Debug LLM Response - Deep dive into what the LLM is actually receiving and responding with
 */

import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

// Test the exact same prompt that processQuery creates
async function debugLLMResponse() {
  console.log("🤖 DEBUGGING LLM RESPONSES\n");
  
  // Test data
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
    totalFacts: 22,
    uniqueEntities: 3,
    uniqueAttributes: 9
  };
  
  // Test one failing query
  const query = "users with gmail emails";
  const entityType = "user"; // We know this is correct from our test
  
  const catalogInfo = catalog
    .map(attr => `- ${attr.attribute}:${attr.type} e.g. ${attr.examples.join(', ')}`)
    .join('\n');

  const prompt = `You are an expert at converting natural language queries to EQL-S (EAV Query Language - Strict).

Available attributes in the dataset:
${catalogInfo}

Data statistics: ${JSON.stringify(dataStats, null, 2)}

EQL-S Grammar Rules:
- Use FIND <type> AS ?var to specify entity type and variable
- Use WHERE clause for conditions
- Use RETURN clause to specify output fields
- Use ORDER BY for sorting, LIMIT for result limits
- Operators: = != > >= < <= BETWEEN ... AND ... CONTAINS MATCHES
- For string pattern matching use MATCHES with regex patterns: MATCHES /pattern/
- For "starts with", use MATCHES /^prefix/
- For "ends with", use MATCHES /suffix$/
- For "contains", use MATCHES /text/ or CONTAINS "text"
- Regex literals must use forward slashes: /pattern/

Entity type detected: ${entityType}
- Avoid using the IN operator for string matching
- Variables must start with ? (e.g., ?p, ?user)
- Strings must be in double quotes
- Regex patterns should be in /pattern/ format but PREFER CONTAINS when possible

Query Pattern Examples (adapt to available attributes):
- "show me [entities] with more than X [numeric_attribute]" → FIND <type> AS ?e WHERE ?e.<attribute> > X RETURN ?e
- "find [entities] containing [text]" → FIND <type> AS ?e WHERE ?e.<text_attribute> CONTAINS "text" RETURN ?e
- "[entities] tagged with [value]" → FIND <type> AS ?e WHERE ?e.<tag_attribute> = "value" RETURN ?e
- "[entities] between X and Y [units]" → FIND <type> AS ?e WHERE ?e.<numeric_attribute> BETWEEN X AND Y RETURN ?e
- "[entities] that start with [prefix]" → FIND <type> AS ?e WHERE ?e.<text_attribute> MATCHES /^prefix/ RETURN ?e.<text_attribute>
- "list [category] [entities]" → FIND <type> AS ?e WHERE ?e.<category_attribute> = "category" RETURN ?e

Convert this natural language query to EQL-S: "${query}"

Output ONLY the EQL-S query, no explanations or additional text.`;

  console.log("📝 PROMPT BEING SENT TO LLM:");
  console.log("=".repeat(80));
  console.log(prompt);
  console.log("=".repeat(80));
  console.log();
  
  try {
    console.log("🤖 Calling LLM...\n");
    
    const result = await generateText({
      model: openai('gpt-4o-mini'),
      prompt,
      temperature: 0.1,
    });
    
    console.log("📤 RAW LLM RESPONSE:");
    console.log(`"${result.text}"`);
    console.log();
    
    const eqlsQuery = result.text.trim();
    console.log("🔍 TRIMMED RESPONSE:");
    console.log(`"${eqlsQuery}"`);
    console.log();
    
    console.log("✅ VALIDATION CHECKS:");
    console.log(`Starts with 'FIND': ${eqlsQuery.startsWith('FIND')}`);
    console.log(`Length: ${eqlsQuery.length} characters`);
    console.log(`Is empty: ${eqlsQuery === ''}`);
    console.log(`Contains newlines: ${eqlsQuery.includes('\n')}`);
    
    if (!eqlsQuery.startsWith('FIND')) {
      console.log("❌ This would trigger: 'Generated query does not start with FIND'");
    }
    
  } catch (error) {
    console.log("❌ LLM ERROR:");
    console.log(error);
  }
}

debugLLMResponse().catch(console.error);