import { join } from 'node:path';
import { TrellisKernel } from '../kernel/trellis-kernel.js';
import type { TrellisKernelQueryResult } from '../kernel/trellis-kernel.js';
import { SqliteKernelBackend } from '../persist/sqlite-backend.js';
import type { NLQueryOptions } from '../kernel/ai-interop.js';
import type { Query } from '../query/datalog-evaluator.js';
import { TenantRegistry } from '../server/tenant-registry.js';
import { KernelPool } from '../server/kernel-pool.js';

const DEFAULT_PORT = 8080;

export interface TQLServerOptions {
  port?: number;
  // Single-tenant (legacy)
  db?: string;
  openapi?: boolean;
  // Multi-tenant
  adminKey?: string;
  dataDir?: string;
  registryDb?: string;
}

interface CreateNodeBody {
  id: string;
  data: Record<string, unknown>;
  type?: string;
}

interface UpdateNodeBody {
  data: Record<string, unknown>;
  type?: string;
}

interface CreateLinkBody {
  source: string;
  target: string;
  relation: string;
}

interface QueryBody {
  q: string;
  natural?: boolean;
  context?: Record<string, unknown>;
}

interface DatalogBody {
  query: Query;
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

async function parseBody<T>(req: Request): Promise<T> {
  const body = await req.json();
  return body as T;
}

export class TQLServer {
  private kernel: TrellisKernel | null;
  private port: number;
  private adminKey: string | undefined;
  private dataDir: string | undefined;
  private registry: TenantRegistry | null;
  private pool: KernelPool | null;

  constructor(opts: TQLServerOptions = {}) {
    this.port = opts.port ?? DEFAULT_PORT;
    this.adminKey = opts.adminKey;
    this.dataDir = opts.dataDir;

    if (opts.adminKey) {
      if (!opts.dataDir) {
        throw new Error('dataDir is required when adminKey is provided');
      }
      const registryDb = opts.registryDb ?? join(opts.dataDir, 'registry.db');
      this.registry = new TenantRegistry(registryDb);
      this.pool = new KernelPool();
      this.kernel = null;
    } else {
      this.registry = null;
      this.pool = null;
      if (opts.db) {
        const backend = new SqliteKernelBackend({ filename: opts.db });
        this.kernel = new TrellisKernel({ backend });
      } else {
        this.kernel = new TrellisKernel();
      }
    }
  }

  getKernel() {
    return this.kernel;
  }

  private extractBearerToken(req: Request): string | null {
    const auth = req.headers.get('Authorization') ?? req.headers.get('authorization');
    if (!auth?.startsWith('Bearer ')) return null;
    return auth.slice(7).trim();
  }

  private getEntitiesFrom(kernel: TrellisKernel): string[] {
    const entities = new Set<string>();
    for (const fact of kernel.getStore().getAllFacts()) {
      entities.add(fact.e);
    }
    return Array.from(entities).sort();
  }

  async handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    if (method === 'OPTIONS') {
      return jsonResponse({ ok: true });
    }

    // Multi-tenant auth gate
    if (this.adminKey !== undefined) {
      const token = this.extractBearerToken(req);

      if (path === '/instances' || path.startsWith('/instances/')) {
        if (token !== this.adminKey) {
          return errorResponse('Unauthorized', 401);
        }
        return this.handleAdminRequest(req, path, method);
      }

      if (!token) {
        return errorResponse('Unauthorized', 401);
      }
      const tenant = this.registry!.lookup(token);
      if (!tenant) {
        return errorResponse('Unauthorized', 401);
      }
      const kernel = this.pool!.getOrCreate(tenant.dbPath);
      return this.handleTenantRequest(req, url, path, method, kernel);
    }

    // Single-tenant mode
    return this.handleTenantRequest(req, url, path, method, this.kernel!);
  }

  private async handleAdminRequest(req: Request, path: string, method: string): Promise<Response> {
    if (path === '/instances' && method === 'POST') {
      const body = await req.json() as { label?: string };
      const record = this.registry!.provision(this.dataDir!, body.label);
      return jsonResponse(
        { apiKey: record.key, label: record.label, dbPath: record.dbPath, createdAt: record.createdAt },
        201,
      );
    }

    if (path === '/instances' && method === 'GET') {
      const tenants = this.registry!.list().map((r) => ({
        apiKey: r.key,
        label: r.label,
        dbPath: r.dbPath,
        createdAt: r.createdAt,
      }));
      return jsonResponse({ tenants });
    }

    if (path.startsWith('/instances/') && method === 'DELETE') {
      const key = decodeURIComponent(path.slice('/instances/'.length));
      const tenant = this.registry!.lookup(key);
      if (!tenant) {
        return errorResponse(`Not found: ${key}`, 404);
      }
      this.pool!.close(tenant.dbPath);
      this.registry!.revoke(key);
      return jsonResponse({ revoked: true });
    }

    return errorResponse(`Not found: ${method} ${path}`, 404);
  }

  private async handleTenantRequest(
    req: Request,
    url: URL,
    path: string,
    method: string,
    kernel: TrellisKernel,
  ): Promise<Response> {
    try {
      if (path === '/' && method === 'GET') {
        return jsonResponse({
          name: 'TQL HTTP API',
          version: '1.0.0',
          description: 'REST API for the Trellis Query Language kernel',
          endpoints: {
            'GET  /':                     'This index',
            'GET  /health':               'Health check and uptime',
            'GET  /stats':                'Fact/link/entity counts',
            'GET  /catalog':              'Attribute catalog with types and examples',
            'GET  /nodes':                'List all entity IDs',
            'POST /nodes':                'Create a node  { id, data, type? }',
            'GET  /nodes/:id':            'Get all facts for an entity',
            'PUT  /nodes/:id':            'Update a node  { data, type? }',
            'DELETE /nodes/:id':          'Delete a node and its facts',
            'GET  /links':                'List all links',
            'POST /links':                'Create a link  { source, relation, target }',
            'POST /query':                'Run an EQL-S query  { q, natural?, context? }',
            'GET  /query?q=':            'Run an EQL-S query via GET',
            'POST /query/datalog':        'Run a raw Datalog query  { query }',
            'GET  /workspace':            'Export workspace config',
            'POST /workspace':            'Boot from workspace config',
            'POST /workspace/checkpoint': 'Save a state snapshot',
            'GET  /openapi.json':         'OpenAPI 3.0 spec',
          },
          query_syntax: 'FIND <type> AS ?var [WHERE <conditions>] RETURN <fields>',
          examples: {
            create_node:  'POST /nodes  {"id":"alice","data":{"name":"Alice","age":30},"type":"person"}',
            create_link:  'POST /links  {"source":"alice","relation":"works_at","target":"acme"}',
            query:        'POST /query  {"q":"FIND person AS ?e RETURN ?e.name, ?e.age"}',
            query_filter: 'POST /query  {"q":"FIND person AS ?e WHERE ?e.age > 25 RETURN ?e.name"}',
          },
        });
      }

      if (path === '/health' && method === 'GET') {
        return jsonResponse({ status: 'ok', uptime: process.uptime() });
      }

      if (path === '/stats' && method === 'GET') {
        return jsonResponse(kernel.getStore().getStats());
      }

      if (path === '/catalog' && method === 'GET') {
        return jsonResponse(kernel.getStore().getCatalog());
      }

      if (path === '/nodes' && method === 'GET') {
        return jsonResponse({ entities: this.getEntitiesFrom(kernel) });
      }

      if (path === '/nodes' && method === 'POST') {
        const body = await parseBody<CreateNodeBody>(req);
        const { id, data, type } = body;
        if (!id || !data) {
          return errorResponse('Missing required fields: id, data');
        }
        await kernel.createNode(id, data, type ?? 'default');
        return jsonResponse({ id, created: true }, 201);
      }

      if (path.startsWith('/nodes/') && method === 'GET') {
        const id = decodeURIComponent(path.slice(7));
        const facts = kernel.getStore().getFactsByEntity(id);
        return jsonResponse({ id, facts });
      }

      if (path.startsWith('/nodes/') && method === 'PUT') {
        const id = decodeURIComponent(path.slice(7));
        const body = await parseBody<UpdateNodeBody>(req);
        const { data, type } = body;
        if (!data) {
          return errorResponse('Missing required field: data');
        }
        await kernel.updateNode(id, data, type ?? 'default');
        return jsonResponse({ id, updated: true });
      }

      if (path.startsWith('/nodes/') && method === 'DELETE') {
        const id = decodeURIComponent(path.slice(7));
        await kernel.deleteNode(id);
        return jsonResponse({ id, deleted: true });
      }

      if (path === '/links' && method === 'GET') {
        return jsonResponse({ links: kernel.getStore().getAllLinks() });
      }

      if (path === '/links' && method === 'POST') {
        const body = await parseBody<CreateLinkBody>(req);
        const { source, target, relation } = body;
        if (!source || !target || !relation) {
          return errorResponse('Missing required fields: source, target, relation');
        }
        await kernel.link(source, relation, target);
        return jsonResponse({ source, target, relation, created: true }, 201);
      }

      if (path === '/query' && method === 'POST') {
        const body = await parseBody<QueryBody>(req);
        const { q, natural, context } = body;
        if (!q) {
          return errorResponse('Missing required field: q');
        }

        const start = performance.now();
        let result: TrellisKernelQueryResult;
        if (natural) {
          const { DefaultNLQueryProvider } = await import('../ai/nl-query-provider.js');
          const nlProvider = new DefaultNLQueryProvider({
            catalog: kernel.getStore().getCatalog(),
            dataStats: kernel.getStore().getStats(),
          });
          result = await kernel.queryNatural(q, { provider: nlProvider, context } as NLQueryOptions);
        } else {
          const queryResult = kernel.query(q);
          result = queryResult instanceof Promise ? await queryResult : queryResult;
        }
        const elapsed = performance.now() - start;

        return jsonResponse({
          rows: result.rows,
          executionTime: result.executionTime ?? elapsed,
          plan: result.plan,
          rowCount: result.rows.length,
        });
      }

      if (path === '/query' && method === 'GET') {
        const q = url.searchParams.get('q');
        const natural = url.searchParams.get('natural') === 'true';
        if (!q) {
          return errorResponse('Missing query parameter: q');
        }

        const start = performance.now();
        let result: TrellisKernelQueryResult;
        if (natural) {
          const { DefaultNLQueryProvider } = await import('../ai/nl-query-provider.js');
          const nlProvider = new DefaultNLQueryProvider({
            catalog: kernel.getStore().getCatalog(),
            dataStats: kernel.getStore().getStats(),
          });
          result = await kernel.queryNatural(q, { provider: nlProvider } as NLQueryOptions);
        } else {
          const queryResult = kernel.query(q);
          result = queryResult instanceof Promise ? await queryResult : queryResult;
        }
        const elapsed = performance.now() - start;

        return jsonResponse({
          rows: result.rows,
          executionTime: result.executionTime ?? elapsed,
          plan: result.plan,
          rowCount: result.rows.length,
        });
      }

      if (path === '/query/datalog' && method === 'POST') {
        const body = await parseBody<DatalogBody>(req);
        const { query } = body;
        if (!query) {
          return errorResponse('Missing required field: query');
        }
        const result = await kernel.queryDatalog(query);
        return jsonResponse({
          rows: result.rows,
          executionTime: result.executionTime,
          plan: result.plan,
          rowCount: result.rows.length,
        });
      }

      if (path === '/workspace' && method === 'POST') {
        const body = await req.json();
        await kernel.boot(body);
        return jsonResponse({ booted: true });
      }

      if (path === '/workspace' && method === 'GET') {
        const workspace = await kernel.exportWorkspace();
        return jsonResponse(workspace);
      }

      if (path === '/workspace/checkpoint' && method === 'POST') {
        await kernel.checkpoint();
        return jsonResponse({ checkpoint: true });
      }

      if (path === '/openapi.json' && method === 'GET') {
        return jsonResponse(this.generateOpenAPI());
      }

      return errorResponse(`Not found: ${method} ${path}`, 404);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error';
      console.error(`Error handling ${method} ${path}:`, err);
      return errorResponse(message, 500);
    }
  }

  private generateOpenAPI() {
    const securitySchemes = this.adminKey
      ? { BearerAuth: { type: 'http', scheme: 'bearer' } }
      : undefined;
    const security = this.adminKey ? [{ BearerAuth: [] }] : undefined;

    return {
      openapi: '3.0.0',
      info: {
        title: 'TQL HTTP API',
        version: '1.0.0',
        description: 'REST API for Trellis Query Language kernel',
      },
      servers: [{ url: `http://localhost:${this.port}` }],
      ...(securitySchemes ? { components: { securitySchemes } } : {}),
      ...(security ? { security } : {}),
      paths: {
        '/instances': {
          get: {
            summary: 'List all tenants (admin only)',
            responses: { '200': { description: 'Tenant list' } },
          },
          post: {
            summary: 'Provision a new tenant (admin only)',
            requestBody: {
              content: {
                'application/json': {
                  schema: { type: 'object', properties: { label: { type: 'string' } } },
                },
              },
            },
            responses: { '201': { description: 'Provisioned' } },
          },
        },
        '/instances/{key}': {
          delete: {
            summary: 'Revoke a tenant key (admin only)',
            parameters: [{ name: 'key', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { '200': { description: 'Revoked' } },
          },
        },
        '/health': {
          get: { summary: 'Health check', responses: { '200': { description: 'OK' } } },
        },
        '/stats': {
          get: { summary: 'Get store statistics', responses: { '200': { description: 'Store stats' } } },
        },
        '/catalog': {
          get: { summary: 'Get data catalog', responses: { '200': { description: 'Attribute catalog' } } },
        },
        '/nodes': {
          get: { summary: 'List all entities', responses: { '200': { description: 'Entity list' } } },
          post: {
            summary: 'Create a node',
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['id', 'data'],
                    properties: { id: { type: 'string' }, data: {}, type: { type: 'string' } },
                  },
                },
              },
            },
            responses: { '201': { description: 'Created' } },
          },
        },
        '/nodes/{id}': {
          get: {
            summary: 'Get entity facts',
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { '200': { description: 'Entity facts' } },
          },
          put: {
            summary: 'Update a node',
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['data'],
                    properties: { data: {}, type: { type: 'string' } },
                  },
                },
              },
            },
            responses: { '200': { description: 'Updated' } },
          },
          delete: {
            summary: 'Delete a node',
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { '200': { description: 'Deleted' } },
          },
        },
        '/links': {
          get: { summary: 'List all links', responses: { '200': { description: 'Link list' } } },
          post: {
            summary: 'Create a link',
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['source', 'target', 'relation'],
                    properties: {
                      source: { type: 'string' },
                      target: { type: 'string' },
                      relation: { type: 'string' },
                    },
                  },
                },
              },
            },
            responses: { '201': { description: 'Created' } },
          },
        },
        '/query': {
          get: {
            summary: 'Execute query via GET',
            parameters: [
              { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
              { name: 'natural', in: 'query', schema: { type: 'boolean' } },
            ],
            responses: { '200': { description: 'Query results' } },
          },
          post: {
            summary: 'Execute EQL-S or natural language query',
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['q'],
                    properties: {
                      q: { type: 'string' },
                      natural: { type: 'boolean' },
                      context: { type: 'object' },
                    },
                  },
                },
              },
            },
            responses: { '200': { description: 'Query results' } },
          },
        },
        '/query/datalog': {
          post: {
            summary: 'Execute raw Datalog query',
            requestBody: {
              content: {
                'application/json': {
                  schema: { type: 'object', required: ['query'], properties: { query: {} } },
                },
              },
            },
            responses: { '200': { description: 'Query results' } },
          },
        },
        '/workspace': {
          get: {
            summary: 'Export workspace config',
            responses: { '200': { description: 'Workspace config' } },
          },
          post: {
            summary: 'Boot from workspace config or data',
            requestBody: { content: { 'application/json': {} } },
            responses: { '200': { description: 'Booted' } },
          },
        },
        '/workspace/checkpoint': {
          post: { summary: 'Save state snapshot', responses: { '200': { description: 'Checkpoint saved' } } },
        },
        '/openapi.json': {
          get: { summary: 'OpenAPI spec', responses: { '200': { description: 'OpenAPI 3.0 document' } } },
        },
      },
    };
  }

  start(): Promise<{ port: number }> {
    return new Promise((resolve) => {
      const self = this;
      const server = Bun.serve({
        port: this.port,
        async fetch(req) {
          return self.handleRequest(req);
        },
      });
      const actualPort = server.port ?? this.port;
      const mode = this.adminKey ? 'multi-tenant' : 'single-tenant';
      console.log(`🚀 TQL HTTP server running at http://localhost:${actualPort} [${mode}]`);
      resolve({ port: actualPort });
    });
  }
}

if (import.meta.main) {
  const port = parseInt(process.argv[2] ?? String(DEFAULT_PORT));
  const db = process.argv.find((a) => a.startsWith('--db='))?.split('=')[1];
  const adminKey = process.env.ADMIN_KEY;
  const dataDir = process.env.DATA_DIR;

  const server = new TQLServer({ port, db, adminKey, dataDir });
  server.start();
}
