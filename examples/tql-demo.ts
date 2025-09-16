/**
 * TQL CLI Demo
 *
 * Demonstrates the Tree Query Language CLI tool with various data sources and query types
 */

import { execSync } from 'child_process';

const demos = [
  {
    name: 'Local JSON File - EQL-S Query',
    command:
      'bun run tql -d data/real-posts.json -q "FIND post AS ?p WHERE ?p.title CONTAINS \\"dolor\\" RETURN ?p, ?p.title" -l 3',
    description: 'Query local JSON file using EQL-S syntax',
  },
  {
    name: 'Local JSON File - Natural Language',
    command:
      'bun run tql -d data/real-posts.json -q "show me posts with dolor in the title" -n -l 3',
    description: 'Query local JSON file using natural language',
  },
  {
    name: 'URL Data Source - EQL-S Query',
    command:
      'bun run tql -d https://jsonplaceholder.typicode.com/users -q "FIND user AS ?u WHERE ?u.id = 1 RETURN ?u, ?u.name" -l 3',
    description: 'Query remote JSON data using EQL-S syntax',
  },
  {
    name: 'URL Data Source - Natural Language',
    command:
      'bun run tql -d https://jsonplaceholder.typicode.com/users -q "find users with april in their email" -n -l 3',
    description: 'Query remote JSON data using natural language',
  },
  {
    name: 'Data Catalog',
    command: 'bun run tql -d https://jsonplaceholder.typicode.com/users -c',
    description: 'Show data catalog and schema information',
  },
  {
    name: 'CSV Export',
    command:
      'bun run tql -d data/real-posts.json -q "FIND post AS ?p WHERE ?p.id = 1 RETURN ?p" -f csv -l 3',
    description: 'Export query results as CSV',
  },
  {
    name: 'JSON Export',
    command:
      'bun run tql -d data/real-posts.json -q "FIND post AS ?p WHERE ?p.id = 1 RETURN ?p" -f json -l 3',
    description: 'Export query results as JSON',
  },
];

async function runTQLDemo(): Promise<void> {
  console.log('🚀 TQL (Tree Query Language) CLI Demo\n');
  console.log('='.repeat(80));
  console.log(
    'Demonstrating the power of combining orchestrator + query engine',
  );
  console.log('='.repeat(80));

  for (let i = 0; i < demos.length; i++) {
    const demo = demos[i]!;
    console.log(`\n${i + 1}. ${demo.name}`);
    console.log(`   ${demo.description}`);
    console.log(`   Command: ${demo.command}`);
    console.log('   ' + '-'.repeat(60));

    try {
      const output = execSync(demo.command, {
        encoding: 'utf-8',
        cwd: process.cwd(),
        stdio: 'pipe',
      });
      console.log(output);
    } catch (error) {
      console.error(
        '   ❌ Demo failed:',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }

    console.log('   ' + '='.repeat(60));
  }

  console.log('\n🎉 TQL CLI Demo completed!');
  console.log('\n📊 Key Features Demonstrated:');
  console.log('   ✅ EQL-S DSL parsing and compilation');
  console.log('   ✅ Natural language query processing via orchestrator');
  console.log('   ✅ Local JSON file data sources');
  console.log('   ✅ Remote URL data sources');
  console.log('   ✅ Data catalog and schema discovery');
  console.log('   ✅ Multiple output formats (table, CSV, JSON)');
  console.log('   ✅ Query result limiting and formatting');
  console.log('   ✅ Complex query operations (CONTAINS, comparisons)');

  console.log('\n🔧 Usage Examples:');
  console.log('   # Show help');
  console.log('   bun run tql --help');
  console.log('');
  console.log('   # Query local file with EQL-S');
  console.log(
    '   bun run tql -d data/posts.json -q "FIND post AS ?p WHERE ?p.views > 1000"',
  );
  console.log('');
  console.log('   # Query URL with natural language');
  console.log(
    '   bun run tql -d https://api.example.com/data -q "show me popular items" -n',
  );
  console.log('');
  console.log('   # Show data catalog');
  console.log('   bun run tql -d data/users.json -c');
  console.log('');
  console.log('   # Export as CSV');
  console.log(
    '   bun run tql -d data/products.json -q "FIND product AS ?p RETURN ?p" -f csv',
  );
}

// Run the demo
if (import.meta.main) {
  runTQLDemo().catch(console.error);
}
