#!/usr/bin/env bun

/**
 * Test workflow implementation
 * 
 * Validates that the workflow system can parse, plan, and execute a simple workflow.
 */

import { WorkflowEngine } from '../src/workflows/engine.js';
import { parseWorkflow } from '../src/workflows/parser.js';
import { createExecutionPlan, validateExecutionPlan } from '../src/workflows/planner.js';

console.log('🧪 Testing Workflow Implementation\n');

const simpleWorkflowYaml = `
version: 1
name: test-workflow

steps:
  - id: fetch_data
    type: source
    source:
      kind: http
      url: "https://jsonplaceholder.typicode.com/posts?_limit=3"
      mode: batch
    out: posts

  - id: filter_posts
    type: query
    needs: [fetch_data]
    from: posts
    eqls: |
      FIND item AS ?p WHERE ?p.id <= 2
      RETURN ?p.id, ?p.title
    out: filtered

  - id: output_json
    type: output
    needs: [filter_posts]
    output:
      kind: stdout
      format: json
`;

async function testWorkflow() {
  try {
    console.log('✅ Step 1: Parse YAML workflow');
    const spec = parseWorkflow(simpleWorkflowYaml);
    console.log(`   Parsed workflow: ${spec.name} with ${spec.steps.length} steps`);
    
    console.log('\n✅ Step 2: Create execution plan');
    const plan = createExecutionPlan(spec);
    validateExecutionPlan(plan);
    console.log(`   Execution order: ${plan.order.join(' → ')}`);
    
    console.log('\n✅ Step 3: Execute workflow');
    const engine = new WorkflowEngine({
      dry: true,
      limit: 2,
      log: 'pretty'
    });
    
    await engine.executeWorkflow(spec);
    
    console.log('\n🎉 Workflow test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Workflow test failed:', error);
    process.exit(1);
  }
}

testWorkflow();