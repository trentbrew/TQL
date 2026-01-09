#!/usr/bin/env bun

/**
 * Demo: TQL + Ratatui Integration
 * 
 * This example shows how to launch the Ratatui TUI from TypeScript
 * and communicate with it via IPC.
 */

import { TQLTUIBridge } from '../src/cli/tui-bridge.js';
import { Graph } from '../src/graph/graph.js';
import { TrellisKernel } from '../src/kernel/trellis-kernel.js';
import chalk from 'chalk';

async function demoGraphViewer() {
  console.log(chalk.cyan.bold('\n🎨 TQL Graph Viewer Demo\n'));

  // Create a sample graph
  const graph = new Graph();
  
  graph.addNode({
    id: 'init',
    label: 'Initialize',
    executor: 'function',
  });
  
  graph.addNode({
    id: 'query',
    label: 'Query Data',
    executor: 'llm',
  });
  
  graph.addNode({
    id: 'analyze',
    label: 'Analyze Results',
    executor: 'function',
  });
  
  graph.addNode({
    id: 'output',
    label: 'Output Results',
    executor: 'function',
  });
  
  graph.addEdge({
    id: 'e1',
    from: 'init',
    to: 'query',
    label: 'NEXT',
  });
  
  graph.addEdge({
    id: 'e2',
    from: 'query',
    to: 'analyze',
    label: 'result',
  });
  
  graph.addEdge({
    id: 'e3',
    from: 'analyze',
    to: 'output',
    label: 'data',
  });

  console.log(chalk.gray('Launching Ratatui Graph Viewer in IPC mode...'));
  console.log(chalk.gray('Running headless - communicating via JSON-RPC\n'));

  const tui = new TQLTUIBridge();
  
  try {
    await tui.launchGraphViewer(graph, false);
    console.log(chalk.green('✓ TUI process started successfully'));
    
    // Simulate workflow execution updates
    console.log(chalk.gray('\nSimulating workflow execution...'));
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log(chalk.cyan('  → init: success'));
    await tui.updateNodeState('init', 'success');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log(chalk.yellow('  → query: running'));
    await tui.updateNodeState('query', 'running');
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    console.log(chalk.cyan('  → query: success'));
    await tui.updateNodeState('query', 'success');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log(chalk.yellow('  → analyze: running'));
    await tui.updateNodeState('analyze', 'running');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log(chalk.cyan('  → analyze: success'));
    await tui.updateNodeState('analyze', 'success');
    
    console.log(chalk.green('\n✓ Demo complete!\n'));
    process.exit(0);
    
  } catch (error) {
    console.error(chalk.red('Failed to launch TUI:'), error);
    console.log(chalk.yellow('\nMake sure to build the Rust TUI first:'));
    console.log(chalk.cyan('  just tui-build\n'));
    process.exit(1);
  }
}

async function demoQueryBuilder() {
  console.log(chalk.cyan.bold('\n📝 TQL Query Builder Demo\n'));
  
  const kernel = new TrellisKernel();
  const tui = new TQLTUIBridge();

  // Handle query execution requests from TUI
  tui.on('executeQuery', async (query: string, callback: Function) => {
    console.log(chalk.gray(`Executing query: ${query}`));
    try {
      const result = await kernel.query(query);
      callback(null, result);
    } catch (error) {
      callback(error);
    }
  });

  console.log(chalk.gray('Launching Ratatui Query Builder...'));
  console.log(chalk.gray('Type your EQL-S query, press Enter to execute, q to quit\n'));

  try {
    await tui.launchQueryBuilder();
  } catch (error) {
    console.error(chalk.red('Failed to launch TUI:'), error);
    console.log(chalk.yellow('\nMake sure to build the Rust TUI first:'));
    console.log(chalk.cyan('  just tui-build\n'));
  }
}

async function demoDashboard() {
  console.log(chalk.cyan.bold('\n📊 TQL Dashboard Demo\n'));
  
  const tui = new TQLTUIBridge();

  console.log(chalk.gray('Launching Ratatui Dashboard...'));
  console.log(chalk.gray('Navigate with Tab, q to quit\n'));

  try {
    await tui.launchDashboard();
  } catch (error) {
    console.error(chalk.red('Failed to launch TUI:'), error);
    console.log(chalk.yellow('\nMake sure to build the Rust TUI first:'));
    console.log(chalk.cyan('  just tui-build\n'));
  }
}

// Main menu
const args = process.argv.slice(2);
const demo = args[0] || 'graph';

switch (demo) {
  case 'graph':
    await demoGraphViewer();
    break;
  case 'query':
    await demoQueryBuilder();
    break;
  case 'dashboard':
    await demoDashboard();
    break;
  default:
    console.log(chalk.yellow('Usage: bun run examples/tql-tui-demo.ts [graph|query|dashboard]'));
    console.log(chalk.gray('\nExamples:'));
    console.log(chalk.cyan('  bun run examples/tql-tui-demo.ts graph'));
    console.log(chalk.cyan('  bun run examples/tql-tui-demo.ts query'));
    console.log(chalk.cyan('  bun run examples/tql-tui-demo.ts dashboard'));
}
