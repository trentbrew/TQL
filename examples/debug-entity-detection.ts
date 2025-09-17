#!/usr/bin/env bun

/**
 * Debug Entity Type Detection
 * Test the entity type detection logic to see why NL queries fail
 */

// Copy the identifyEntityType function from orchestrator
function identifyEntityType(query: string): string | null {
  const normalizedQuery = query.toLowerCase();

  const entityPatterns = [
    /(?:find|show|list|get|search)\s+([a-z]+s?)\b/i,
    /\b([a-z]+s?)\s+(?:that|with|containing|having)\b/i,
    /\b([a-z]+s?)'?s?\s+[a-z]+/i,
  ];

  for (const pattern of entityPatterns) {
    const match = normalizedQuery.match(pattern);
    if (match && match[1]) {
      let entityType = match[1].toLowerCase();

      if (entityType.endsWith('ies')) {
        entityType = entityType.slice(0, -3) + 'y';
      } else if (entityType.endsWith('es')) {
        entityType = entityType.slice(0, -2);
      } else if (entityType.endsWith('s') && entityType.length > 3) {
        entityType = entityType.slice(0, -1);
      }

      const excludeWords = ['this', 'that', 'the', 'and', 'or', 'but', 'with', 'from', 'by', 'at', 'in', 'on', 'to', 'for', 'of', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'all', 'any', 'some', 'more', 'most', 'less', 'least', 'first', 'last', 'next', 'previous'];

      if (!excludeWords.includes(entityType) && entityType.length > 2) {
        return entityType;
      }
    }
  }

  return 'item';
}

// Test the failing queries
const failingQueries = [
  "users with gmail emails",
  "events in 2024", 
  "active users in engineering",
  "products containing iPhone"
];

const workingQueries = [
  "products between 400 and 1000 dollars",
  "users skilled in Python"
];

console.log("🔍 ENTITY TYPE DETECTION DEBUG\n");

console.log("❌ FAILING QUERIES:");
failingQueries.forEach(query => {
  const entityType = identifyEntityType(query);
  console.log(`"${query}" → entity type: "${entityType}"`);
  
  // Test each pattern individually
  const normalizedQuery = query.toLowerCase();
  const patterns = [
    { name: "find/show/list pattern", regex: /(?:find|show|list|get|search)\s+([a-z]+s?)\b/i },
    { name: "entity + with/containing pattern", regex: /\b([a-z]+s?)\s+(?:that|with|containing|having)\b/i },
    { name: "possessive pattern", regex: /\b([a-z]+s?)'?s?\s+[a-z]+/i }
  ];
  
  patterns.forEach(pattern => {
    const match = normalizedQuery.match(pattern.regex);
    if (match) {
      console.log(`  ✓ Matched "${pattern.name}": captured "${match[1]}"`);
    } else {
      console.log(`  ✗ No match for "${pattern.name}"`);
    }
  });
  console.log();
});

console.log("✅ WORKING QUERIES:");
workingQueries.forEach(query => {
  const entityType = identifyEntityType(query);
  console.log(`"${query}" → entity type: "${entityType}"`);
  
  // Test each pattern individually
  const normalizedQuery = query.toLowerCase();
  const patterns = [
    { name: "find/show/list pattern", regex: /(?:find|show|list|get|search)\s+([a-z]+s?)\b/i },
    { name: "entity + with/containing pattern", regex: /\b([a-z]+s?)\s+(?:that|with|containing|having)\b/i },
    { name: "possessive pattern", regex: /\b([a-z]+s?)'?s?\s+[a-z]+/i }
  ];
  
  patterns.forEach(pattern => {
    const match = normalizedQuery.match(pattern.regex);
    if (match) {
      console.log(`  ✓ Matched "${pattern.name}": captured "${match[1]}"`);
    } else {
      console.log(`  ✗ No match for "${pattern.name}"`);
    }
  });
  console.log();
});