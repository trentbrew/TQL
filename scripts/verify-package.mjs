import { accessSync, readFileSync, statSync } from 'node:fs';
import { constants } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const packageJson = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8'));

const requiredPaths = new Set();

for (const key of ['main', 'module']) {
  if (typeof packageJson[key] === 'string') {
    requiredPaths.add(packageJson[key]);
  }
}

if (packageJson.bin && typeof packageJson.bin === 'object') {
  for (const path of Object.values(packageJson.bin)) {
    if (typeof path === 'string') {
      requiredPaths.add(path);
    }
  }
}

if (packageJson.exports && typeof packageJson.exports === 'object') {
  for (const value of Object.values(packageJson.exports)) {
    if (typeof value === 'string') {
      requiredPaths.add(value);
    }
  }
}

const missing = [];
for (const relativePath of requiredPaths) {
  const absolutePath = resolve(repoRoot, relativePath);
  try {
    accessSync(absolutePath, constants.F_OK);
  } catch {
    missing.push(relativePath);
  }
}

if (missing.length > 0) {
  console.error('Missing package artifacts:');
  for (const relativePath of missing) {
    console.error(`- ${relativePath}`);
  }
  process.exit(1);
}

if (!Array.isArray(packageJson.files) || !packageJson.files.includes('dist')) {
  console.error('package.json must explicitly publish the dist directory via the files field.');
  process.exit(1);
}

for (const relativePath of Object.values(packageJson.bin ?? {})) {
  if (typeof relativePath !== 'string') {
    continue;
  }

  const mode = statSync(resolve(repoRoot, relativePath)).mode & 0o111;
  if (mode === 0) {
    console.error(`CLI artifact is not executable: ${relativePath}`);
    process.exit(1);
  }
}

console.log(`Verified ${requiredPaths.size} package artifacts.`);
