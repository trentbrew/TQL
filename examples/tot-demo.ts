#!/usr/bin/env bun

import { orchestrate } from '../src/ai/orchestrator';

async function demonstrateToT() {
  console.log('🌳 Tree-of-Thought Planner Demo\n');

  // Example 1: Complex task that should trigger ToT planning
  const complexTask =
    'Design a comprehensive marketing strategy for a new AI-powered productivity app targeting remote workers. Include user research, competitive analysis, pricing strategy, and launch timeline.';

  console.log('📝 Original Prompt:');
  console.log(complexTask);
  console.log('\n' + '='.repeat(80) + '\n');

  try {
    console.log('🤖 Running with ToT Planner enabled...\n');

    const result = await orchestrate(complexTask, {
      useToT: true,
      plannerModel: 'gpt-4o-mini',
      numThoughts: 3,
      includeAnalysis: true,
    });

    if (result.status === 'ok') {
      console.log('✅ Orchestration successful!\n');

      // Display planning information
      if (result.payload.planning) {
        console.log('🧠 Planning Information:');
        console.log(
          `   Selected Plan Index: ${result.payload.planning.winningIndex}`,
        );
        console.log(
          `   Total Plans Generated: ${result.payload.planning.allPlansCount}`,
        );
        console.log(`   Selection Reason: ${result.payload.planning.reason}`);
        console.log('\n📋 Selected Plan:');
        console.log(`   Rationale: ${result.payload.planning.plan.rationale}`);
        console.log('   Steps:');
        result.payload.planning.plan.steps.forEach((step, i) => {
          console.log(`     ${i + 1}. ${step}`);
        });

        if (
          result.payload.planning.plan.assumptions &&
          result.payload.planning.plan.assumptions.length > 0
        ) {
          console.log('   Assumptions:');
          result.payload.planning.plan.assumptions.forEach((assumption, i) => {
            console.log(`     • ${assumption}`);
          });
        }

        if (
          result.payload.planning.plan.risks &&
          result.payload.planning.plan.risks.length > 0
        ) {
          console.log('   Risks:');
          result.payload.planning.plan.risks.forEach((risk, i) => {
            console.log(`     ⚠️  ${risk}`);
          });
        }

        if (result.payload.planning.plan.revisedPrompt) {
          console.log('\n🔄 Revised Prompt:');
          console.log(result.payload.planning.plan.revisedPrompt);
        }

        console.log('\n' + '='.repeat(80) + '\n');
      }

      // Display the final response
      console.log('💬 Final Response:');
      console.log(
        typeof result.payload.response === 'string'
          ? result.payload.response
          : '[Streaming response - check logs for details]',
      );

      console.log(
        `\n⏱️  Processing Time: ${result.payload.processingTimeMs}ms`,
      );
    } else {
      console.log('❌ Orchestration failed:');
      console.log(result.payload.error);
    }
  } catch (error) {
    console.error('💥 Error during orchestration:', error);
  }

  console.log('\n' + '='.repeat(80) + '\n');

  // Example 2: Simple task that should NOT trigger ToT planning
  const simpleTask = 'What is the capital of France?';

  console.log('📝 Simple Prompt (should not trigger ToT):');
  console.log(simpleTask);
  console.log('\n' + '='.repeat(80) + '\n');

  try {
    console.log('🤖 Running with ToT Planner enabled but simple task...\n');

    const result2 = await orchestrate(simpleTask, {
      useToT: true,
      plannerModel: 'gpt-4o-mini',
      numThoughts: 3,
      includeAnalysis: true,
    });

    if (result2.status === 'ok') {
      console.log('✅ Orchestration successful!\n');

      if (result2.payload.planning) {
        console.log('🧠 Planning was triggered (unexpected for simple task)');
      } else {
        console.log('✅ No planning triggered (as expected for simple task)');
      }

      console.log('💬 Response:');
      console.log(
        typeof result2.payload.response === 'string'
          ? result2.payload.response
          : '[Streaming response]',
      );
    } else {
      console.log('❌ Orchestration failed:');
      console.log(result2.payload.error);
    }
  } catch (error) {
    console.error('💥 Error during orchestration:', error);
  }
}

// Run the demo
demonstrateToT().catch(console.error);
