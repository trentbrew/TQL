#!/usr/bin/env bun

import { Graph } from '../src/graph/graph.js';
import { Engine } from '../src/graph/engine.js';
import { colors } from '../src/graph/logger.js';

// Deterministic Router demo without network calls
console.log(`${colors.brightCyan}╔══════════════════════════════════════════════════════════════╗${colors.reset}`);
console.log(`${colors.brightCyan}║${colors.reset} ${colors.bright}🚦 Router Demo (Deterministic)${colors.reset}                         ${colors.brightCyan}║${colors.reset}`);
console.log(`${colors.brightCyan}║${colors.reset} ${colors.dim}Verifies router conditions and edge selection${colors.reset}        ${colors.brightCyan}║${colors.reset}`);
console.log(`${colors.brightCyan}╚══════════════════════════════════════════════════════════════╝${colors.reset}\n`);

const g = new Graph();

g.addNode({ id: 'init_mem', kind: 'MemoryWrite', data: { key: 'query_results', from: 'meta.seed' } });

g.addNode({
  id: 'check_results',
  kind: 'Router',
  data: {
    routes: [
      { label: 'has_data', when: (state: any) => state.memory?.query_results?.results?.length > 0 },
      { label: 'no_data', when: (state: any) => !state.memory?.query_results?.results?.length },
    ],
  },
});

g.addNode({ id: 'success_end', kind: 'End' });

g.addNode({ id: 'error_end', kind: 'End' });

// Edges

g.addEdge({ id: 'e1', from: 'init_mem', to: 'check_results', label: 'success' });

g.addEdge({ id: 'e2', from: 'check_results', to: 'success_end', label: 'has_data' });

g.addEdge({ id: 'e3', from: 'check_results', to: 'error_end', label: 'no_data' });

g.addEdge({ id: 'e4', from: 'check_results', to: 'error_end', label: 'default' });

const engine = new Engine(g, { maxSteps: 20, onEvent: (ev) => console.log(`Event: ${ev.type} - ${ev.nodeId}`) });

console.log(`${colors.dim}Starting router-only workflow...${colors.reset}\n`);

(async () => {
  const gen = engine.run('init_mem', {}, { meta: { seed: { results: [1, 2, 3] } } });
  let steps = 0;
  for await (const _ of gen) steps++;
  const final = await gen.next();
  console.log(`${colors.brightGreen}\nRouter demo complete. Steps executed: ${steps}.${colors.reset}`);
})().catch((err) => {
  console.error(`${colors.brightRed}Router demo failed:${colors.reset}`, err);
  process.exit(1);
});
