#!/usr/bin/env bun

import { EAVStore, jsonEntityFacts } from '../src/store/eav-store.js';
import { EQLSParser, EQLSCompiler } from '../src/query/eqls-parser.js';
import { DatalogEvaluator } from '../src/query/datalog-evaluator.js';

console.log('🔍 Tracing EQL-S Parse->Compile Pipeline\n');

const sampleData = [
  { id: 1, title: 'Hello World', views: 1500, reactions: { likes: 100 } },
];

const store = new EAVStore();
const parser = new EQLSParser();
const compiler = new EQLSCompiler();

// Load data
sampleData.forEach((item, index) => {
  const entityId = `post:${item.id}`;
  const facts = jsonEntityFacts(entityId, item, 'post');
  store.addFacts(facts);
});

console.log('📊 Facts with type attribute:');
const typeFacts = store.getAllFacts().filter((f) => f.a === 'type');
console.log(typeFacts);

const testQuery = 'FIND post AS ?p RETURN ?p';
console.log(`\n🧪 Tracing: ${testQuery}`);

// Step 1: Parse
console.log('\n1️⃣ Parsing...');
const parseResult = parser.parse(testQuery);

if (parseResult.errors.length > 0) {
  console.log('❌ Parse errors:', parseResult.errors);
} else {
  console.log('✅ Parsed EQL-S query:');
  console.log(JSON.stringify(parseResult.query, null, 2));

  // Step 2: Compile
  console.log('\n2️⃣ Compiling...');
  const compiledQuery = compiler.compile(parseResult.query!);

  console.log('✅ Compiled Datalog query:');
  console.log('Variables:', Array.from(compiledQuery.variables));
  console.log('Goals:');
  compiledQuery.goals.forEach((goal, i) => {
    console.log(`  ${i}: ${JSON.stringify(goal)}`);
  });

  // Step 3: Evaluate
  console.log('\n3️⃣ Evaluating...');
  const evaluator = new DatalogEvaluator(store);
  const result = evaluator.evaluate(compiledQuery);
  console.log(`Results: ${result.bindings.length}`);
  result.bindings.forEach((binding, i) => {
    console.log(`  ${i}: ${JSON.stringify(binding)}`);
  });
}
