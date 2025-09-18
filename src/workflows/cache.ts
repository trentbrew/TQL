/**
 * Workflow caching system
 * 
 * Provides deterministic caching with hash-based keys and gzipped JSON storage.
 * Supports read/write/off modes as specified in the MVP.
 */

import { createHash } from 'crypto';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import type { Dataset } from './types.js';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export interface CacheManager {
  get(key: string): Promise<Dataset | null>;
  set(key: string, dataset: Dataset): Promise<void>;
}

/**
 * File-based cache manager using .tql-cache directory
 */
export class FileCacheManager implements CacheManager {
  private cacheDir: string;
  
  constructor(cacheDir = '.tql-cache') {
    this.cacheDir = cacheDir;
  }
  
  async get(key: string): Promise<Dataset | null> {
    try {
      const filePath = this.getCacheFilePath(key);
      
      if (!existsSync(filePath)) {
        return null;
      }
      
      const compressed = await readFile(filePath);
      const decompressed = await gunzipAsync(compressed);
      const dataset = JSON.parse(decompressed.toString('utf-8'));
      
      return dataset;
    } catch (error) {
      // Cache miss on error
      return null;
    }
  }
  
  async set(key: string, dataset: Dataset): Promise<void> {
    try {
      const filePath = this.getCacheFilePath(key);
      
      // Ensure cache directory exists
      await mkdir(dirname(filePath), { recursive: true });
      
      // Compress and write
      const json = JSON.stringify(dataset);
      const compressed = await gzipAsync(Buffer.from(json, 'utf-8'));
      await writeFile(filePath, compressed);
    } catch (error) {
      // Silently fail cache writes to avoid disrupting workflow
      console.warn(`Cache write failed for key ${key}:`, error);
    }
  }
  
  private getCacheFilePath(key: string): string {
    return join(this.cacheDir, `${key}.bin`);
  }
}

/**
 * No-op cache manager for cache=off mode
 */
export class NoCacheManager implements CacheManager {
  async get(): Promise<Dataset | null> {
    return null;
  }
  
  async set(): Promise<void> {
    // No-op
  }
}

/**
 * Read-only cache manager for cache=read mode
 */
export class ReadOnlyCacheManager implements CacheManager {
  constructor(private delegate: CacheManager) {}
  
  async get(key: string): Promise<Dataset | null> {
    return this.delegate.get(key);
  }
  
  async set(): Promise<void> {
    // No-op for read-only mode
  }
}

/**
 * Create cache key from step specification and input dependencies
 */
export function createCacheKey(
  stepSpec: any, 
  inputDatasetsHash: string,
  secretsHash?: string
): string {
  // Validate inputs against injection attacks
  if (!stepSpec || typeof stepSpec !== 'object') {
    throw new Error('Invalid step specification for cache key');
  }
  
  if (!inputDatasetsHash || !/^[a-f0-9]+$/.test(inputDatasetsHash)) {
    throw new Error('Invalid input datasets hash for cache key');
  }
  
  if (secretsHash && !/^[a-f0-9]+$/.test(secretsHash)) {
    throw new Error('Invalid secrets hash for cache key');
  }

  // Create normalized spec without secrets for consistent hashing
  const normalizedSpec = normalizeSpecForCache(stepSpec);
  
  const specHash = createHash('sha256')
    .update(JSON.stringify(normalizedSpec))
    .digest('hex')
    .substring(0, 16);
  
  const inputHash = inputDatasetsHash.substring(0, 16);
  
  // Include secrets hash if provided (for URL templating)
  const secretsPart = secretsHash ? `_${secretsHash.substring(0, 8)}` : '';
  
  const cacheKey = `${specHash}_${inputHash}${secretsPart}`;
  
  // Final validation: ensure cache key is safe for filesystem
  if (!/^[a-f0-9_]+$/.test(cacheKey)) {
    throw new Error('Generated cache key contains invalid characters');
  }
  
  return cacheKey;
}

/**
 * Create hash of input datasets for cache key
 */
export function createInputDatasetsHash(datasets: Record<string, Dataset>): string {
  // Sort dataset names for consistent hashing
  const sortedNames = Object.keys(datasets).sort();
  
  const dataToHash = sortedNames.map(name => {
    const dataset = datasets[name];
    return {
      name: dataset?.name,
      rowCount: dataset?.rows.length,
      // Include sample of first few rows for content-based hashing
      sample: dataset?.rows.slice(0, 3)
    };
  });
  
  return createHash('sha256')
    .update(JSON.stringify(dataToHash))
    .digest('hex');
}

/**
 * Create hash of template variables (excluding secrets)
 */
export function createTemplateVarsHash(
  env: Record<string, string>,
  vars: Record<string, string>
): string {
  // Only include non-secret environment variables in hash
  const nonSecretVars = { ...vars };
  
  // Add non-secret env vars (exclude common secret patterns)
  for (const [key, value] of Object.entries(env)) {
    if (!isSecretKey(key)) {
      nonSecretVars[key] = value;
    }
  }
  
  // Sort keys for consistent hashing
  const sortedEntries = Object.entries(nonSecretVars).sort(([a], [b]) => a.localeCompare(b));
  
  return createHash('sha256')
    .update(JSON.stringify(sortedEntries))
    .digest('hex');
}

/**
 * Check if a key looks like a secret
 */
function isSecretKey(key: string): boolean {
  const secretPatterns = [
    /^.*key$/i,
    /^.*secret$/i,
    /^.*token$/i,
    /^.*password$/i,
    /^.*pass$/i,
    /^api_/i,
    /^auth_/i
  ];
  
  return secretPatterns.some(pattern => pattern.test(key));
}

/**
 * Normalize step specification for consistent caching
 */
function normalizeSpecForCache(spec: any): any {
  if (spec === null || spec === undefined) {
    return spec;
  }
  
  if (Array.isArray(spec)) {
    return spec.map(normalizeSpecForCache);
  }
  
  if (typeof spec === 'object') {
    const normalized: any = {};
    
    // Sort keys for consistent object serialization
    const sortedKeys = Object.keys(spec).sort();
    
    for (const key of sortedKeys) {
      const value = spec[key];
      
      // Remove template variables from URLs for caching
      if (key === 'url' && typeof value === 'string') {
        // Replace template variables with placeholders for consistent caching (support both ${{}} and {{}} formats)
        normalized[key] = value.replace(/(\$)?\{\{\s*[^}]+\s*\}\}/g, '{{TEMPLATE_VAR}}');
      } else {
        normalized[key] = normalizeSpecForCache(value);
      }
    }
    
    return normalized;
  }
  
  return spec;
}

/**
 * Create cache manager based on mode
 */
export function createCacheManager(mode: 'read' | 'write' | 'off', cacheDir?: string): CacheManager {
  switch (mode) {
    case 'off':
      return new NoCacheManager();
    case 'read':
      return new ReadOnlyCacheManager(new FileCacheManager(cacheDir));
    case 'write':
    default:
      return new FileCacheManager(cacheDir);
  }
}

/**
 * Cache-aware step execution wrapper
 */
export async function withCache<TResult>(
  cacheManager: CacheManager,
  cacheKey: string,
  operation: () => Promise<TResult>,
  logger?: (event: any) => void
): Promise<{ result: TResult; cacheHit: boolean }> {
  // Try cache first
  const cached = await cacheManager.get(cacheKey);
  if (cached) {
    logger?.({ cache: 'hit' });
    return { result: cached as TResult, cacheHit: true };
  }
  
  // Execute operation
  logger?.({ cache: 'miss' });
  const result = await operation();
  
  // Cache result if it's a dataset
  if (result && typeof result === 'object' && 'name' in result && 'rows' in result) {
    await cacheManager.set(cacheKey, result as Dataset);
    logger?.({ cache: 'write' });
  }
  
  return { result, cacheHit: false };
}