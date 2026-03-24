import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createRequire } from 'module';

import { TQLServer } from '../src/cli/server.js';
import { TQLClient } from '../src/client/tql-client.js';

const require = createRequire(import.meta.url);
const bunSqliteAvailable = (() => {
  try {
    require(['bun', 'sqlite'].join(':'));
    return true;
  } catch {
    return false;
  }
})();

const ADMIN_KEY = 'test-admin-secret';

// Helper: build a fake Request as handleRequest expects
function req(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function auth(key: string) {
  return { Authorization: `Bearer ${key}` };
}

async function json(res: Response) {
  return res.json();
}

describe('TQLServer auth', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'tql-auth-'));
  });

  afterEach(() => {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  const sqliteIt = bunSqliteAvailable ? it : it.skip;

  // -------------------------------------------------------------------------
  // 1. Single-tenant mode — no auth required
  // -------------------------------------------------------------------------

  it('single-tenant: /health requires no auth', async () => {
    const server = new TQLServer({ port: 0 });
    const res = await server.handleRequest(req('GET', '/health'));
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.status).toBe('ok');
  });

  // -------------------------------------------------------------------------
  // 2-4. Multi-tenant auth rejections
  // -------------------------------------------------------------------------

  sqliteIt('multi-tenant: missing Authorization → 401', async () => {
    const server = new TQLServer({ adminKey: ADMIN_KEY, dataDir: dir });
    const res = await server.handleRequest(req('GET', '/health'));
    expect(res.status).toBe(401);
  });

  sqliteIt('multi-tenant: wrong token → 401', async () => {
    const server = new TQLServer({ adminKey: ADMIN_KEY, dataDir: dir });
    const res = await server.handleRequest(req('GET', '/nodes', undefined, auth('wrong-key')));
    expect(res.status).toBe(401);
  });

  sqliteIt('admin endpoint with non-admin token → 401', async () => {
    const server = new TQLServer({ adminKey: ADMIN_KEY, dataDir: dir });
    const res = await server.handleRequest(req('POST', '/instances', {}, auth('not-admin')));
    expect(res.status).toBe(401);
  });

  // -------------------------------------------------------------------------
  // 5. Provision a new tenant
  // -------------------------------------------------------------------------

  sqliteIt('POST /instances provisions a new tenant', async () => {
    const server = new TQLServer({ adminKey: ADMIN_KEY, dataDir: dir });
    const res = await server.handleRequest(
      req('POST', '/instances', { label: 'test-tenant' }, auth(ADMIN_KEY)),
    );
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.apiKey).toMatch(/^tql_[a-f0-9]{32}$/);
    expect(body.label).toBe('test-tenant');
    expect(body.dbPath).toContain(dir);
    expect(body.createdAt).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // 6. Valid tenant key allows access
  // -------------------------------------------------------------------------

  sqliteIt('valid tenant key → /health 200', async () => {
    const server = new TQLServer({ adminKey: ADMIN_KEY, dataDir: dir });
    const { apiKey } = await json(
      await server.handleRequest(req('POST', '/instances', {}, auth(ADMIN_KEY))),
    );

    const res = await server.handleRequest(req('GET', '/health', undefined, auth(apiKey)));
    expect(res.status).toBe(200);
  });

  // -------------------------------------------------------------------------
  // 7. Data isolation between tenants
  // -------------------------------------------------------------------------

  sqliteIt('tenants are isolated — data written by A not visible to B', async () => {
    const server = new TQLServer({ adminKey: ADMIN_KEY, dataDir: dir });

    const { apiKey: keyA } = await json(
      await server.handleRequest(req('POST', '/instances', { label: 'A' }, auth(ADMIN_KEY))),
    );
    const { apiKey: keyB } = await json(
      await server.handleRequest(req('POST', '/instances', { label: 'B' }, auth(ADMIN_KEY))),
    );

    // Write a node as tenant A
    await server.handleRequest(
      req('POST', '/nodes', { id: 'alice', data: { name: 'Alice' }, type: 'person' }, auth(keyA)),
    );

    // Tenant B should see nothing
    const res = await server.handleRequest(req('GET', '/nodes', undefined, auth(keyB)));
    const body = await json(res);
    expect(body.entities).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // 8. List tenants
  // -------------------------------------------------------------------------

  sqliteIt('GET /instances lists provisioned tenants', async () => {
    const server = new TQLServer({ adminKey: ADMIN_KEY, dataDir: dir });

    await server.handleRequest(req('POST', '/instances', { label: 'A' }, auth(ADMIN_KEY)));
    await server.handleRequest(req('POST', '/instances', { label: 'B' }, auth(ADMIN_KEY)));

    const res = await server.handleRequest(req('GET', '/instances', undefined, auth(ADMIN_KEY)));
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.tenants).toHaveLength(2);
    expect(body.tenants.map((t: any) => t.label)).toEqual(['A', 'B']);
  });

  // -------------------------------------------------------------------------
  // 9. Revoke a tenant
  // -------------------------------------------------------------------------

  sqliteIt('DELETE /instances/:key revokes access', async () => {
    const server = new TQLServer({ adminKey: ADMIN_KEY, dataDir: dir });

    const { apiKey } = await json(
      await server.handleRequest(req('POST', '/instances', { label: 'temp' }, auth(ADMIN_KEY))),
    );

    // Confirm it works before revocation
    const before = await server.handleRequest(req('GET', '/health', undefined, auth(apiKey)));
    expect(before.status).toBe(200);

    // Revoke
    const del = await server.handleRequest(
      req('DELETE', `/instances/${apiKey}`, undefined, auth(ADMIN_KEY)),
    );
    expect(del.status).toBe(200);
    expect(await json(del)).toEqual({ revoked: true });

    // Now it should be 401
    const after = await server.handleRequest(req('GET', '/health', undefined, auth(apiKey)));
    expect(after.status).toBe(401);
  });

  // -------------------------------------------------------------------------
  // 10. Revoke nonexistent key → 404
  // -------------------------------------------------------------------------

  sqliteIt('DELETE /instances/nonexistent → 404', async () => {
    const server = new TQLServer({ adminKey: ADMIN_KEY, dataDir: dir });
    const res = await server.handleRequest(
      req('DELETE', '/instances/tql_doesnotexist00000000000000000', undefined, auth(ADMIN_KEY)),
    );
    expect(res.status).toBe(404);
  });

  // -------------------------------------------------------------------------
  // 11. TQLClient.provision() round-trip
  // -------------------------------------------------------------------------

  sqliteIt('TQLClient.provision() returns tenant record', async () => {
    const server = new TQLServer({ adminKey: ADMIN_KEY, dataDir: dir });

    // Wire client to call handleRequest directly (no real HTTP server)
    const client = new TQLClient({
      baseUrl: 'http://localhost',
      fetch: (url, init) => server.handleRequest(new Request(url, init)),
    });

    const record = await client.provision(ADMIN_KEY, 'sdk-tenant');
    expect(record.apiKey).toMatch(/^tql_[a-f0-9]{32}$/);
    expect(record.label).toBe('sdk-tenant');
    expect(record.dbPath).toContain(dir);
    expect(record.createdAt).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // 12. TQLClient injects Authorization header
  // -------------------------------------------------------------------------

  it('TQLClient with apiKey injects Authorization header', async () => {
    const capturedHeaders: Record<string, string>[] = [];

    const spyFetch: typeof globalThis.fetch = async (url, init) => {
      capturedHeaders.push(Object.fromEntries(new Headers(init?.headers).entries()));
      return new Response(JSON.stringify({ status: 'ok', uptime: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new TQLClient({
      baseUrl: 'http://localhost',
      fetch: spyFetch,
      apiKey: 'tql_abc123',
    });

    await client.health();
    expect(capturedHeaders[0]?.['authorization']).toBe('Bearer tql_abc123');
  });
});
