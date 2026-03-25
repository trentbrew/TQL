import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');

const entrypoints = [
  ['src/index.ts', 'dist/index.js'],
  ['src/store/eav-store.ts', 'dist/store/eav-store.js'],
  ['src/query/index.ts', 'dist/query/index.js'],
  ['src/kernel/trellis-kernel.ts', 'dist/kernel/trellis-kernel.js'],
  ['src/persist/backend.ts', 'dist/persist/backend.js'],
  ['src/persist/sqlite-backend.ts', 'dist/persist/sqlite-backend.js'],
  ['src/kernel/middleware.ts', 'dist/kernel/middleware.js'],
  ['src/kernel/security-middleware.ts', 'dist/kernel/security-middleware.js'],
  ['src/kernel/schema-middleware.ts', 'dist/kernel/schema-middleware.js'],
  ['src/kernel/logic-middleware.ts', 'dist/kernel/logic-middleware.js'],
  ['src/kernel/operations.ts', 'dist/kernel/operations.js'],
  ['src/kernel/workspace.ts', 'dist/kernel/workspace.js'],
  ['src/ai/index.ts', 'dist/ai/index.js'],
  ['src/graph/index.ts', 'dist/graph/index.js'],
  ['src/workflows/index.ts', 'dist/workflows/index.js'],
  ['src/client/tql-client.ts', 'dist/client/tql-client.js'],
  ['src/server/index.ts', 'dist/server/index.js'],
  ['src/cli/tql.ts', 'dist/cli/tql.js'],
  ['src/cli/server.ts', 'dist/cli/server.js'],
];

const executableOutputs = new Set(['dist/cli/tql.js', 'dist/cli/server.js']);

rmSync(resolve(repoRoot, 'dist'), { recursive: true, force: true });

for (const [input, output] of entrypoints) {
  const outputPath = resolve(repoRoot, output);
  mkdirSync(dirname(outputPath), { recursive: true });
  execFileSync(
    'bun',
    [
      'build',
      input,
      '--outdir',
      dirname(output),
      '--target',
      'node',
      '--format',
      'esm',
      '--packages',
      'external',
    ],
    { cwd: repoRoot, stdio: 'inherit' },
  );

  if (executableOutputs.has(output)) {
    // Ensure a proper node shebang for npm bin compatibility
    const NODE_SHEBANG = '#!/usr/bin/env node\n';
    let content = readFileSync(outputPath, 'utf8');
    if (content.startsWith('#!')) {
      content = content.replace(/^#!.*\n/, NODE_SHEBANG);
    } else {
      content = NODE_SHEBANG + content;
    }
    writeFileSync(outputPath, content);
    chmodSync(outputPath, 0o755);
  }
}
