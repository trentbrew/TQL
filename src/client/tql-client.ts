/**
 * TQLClient — a typed HTTP client for the TQL REST API.
 *
 * Works in any environment with a native `fetch` (Node 18+, Bun, browsers).
 * Has zero dependencies beyond the server itself.
 *
 * @example
 *   const tql = new TQLClient('http://localhost:8080');
 *   await tql.createNode('alice', { name: 'Alice', age: 30 }, 'person');
 *   const { rows } = await tql.query('FIND person AS ?e RETURN ?e.name');
 */

export interface TQLFact {
  e: string;
  a: string;
  v: unknown;
}

export interface TQLLink {
  e1: string;
  a: string;
  e2: string;
}

export interface TQLCatalogEntry {
  attribute: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'mixed';
  cardinality: 'one' | 'many';
  distinctCount: number;
  examples: unknown[];
  min?: number;
  max?: number;
}

export interface TQLQueryResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTime: number;
  plan?: string;
}

export interface TQLStoreStats {
  totalFacts: number;
  totalLinks: number;
  uniqueEntities: number;
  uniqueAttributes: number;
  catalogEntries: number;
}

export interface TQLClientOptions {
  /** Base URL of the TQL server, e.g. "http://localhost:8080" */
  baseUrl: string;
  /** Optional fetch implementation — defaults to global fetch */
  fetch?: typeof globalThis.fetch;
  /** API key injected as Authorization: Bearer <apiKey> on every request */
  apiKey?: string;
}

export class TQLError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'TQLError';
  }
}

export class TQLClient {
  private baseUrl: string;
  private fetch: typeof globalThis.fetch;
  private apiKey: string | undefined;

  constructor(baseUrlOrOptions: string | TQLClientOptions) {
    if (typeof baseUrlOrOptions === 'string') {
      this.baseUrl = baseUrlOrOptions.replace(/\/$/, '');
      this.fetch = globalThis.fetch;
      this.apiKey = undefined;
    } else {
      this.baseUrl = baseUrlOrOptions.baseUrl.replace(/\/$/, '');
      this.fetch = baseUrlOrOptions.fetch ?? globalThis.fetch;
      this.apiKey = baseUrlOrOptions.apiKey;
    }
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

    const res = await this.fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const data = await res.json();

    if (!res.ok) {
      throw new TQLError(
        (data as { error?: string }).error ?? `HTTP ${res.status}`,
        res.status,
      );
    }

    return data as T;
  }

  // ---------------------------------------------------------------------------
  // Instance management (multi-tenant)
  // ---------------------------------------------------------------------------

  /** Provision a new tenant instance. Requires the admin key, not a tenant API key. */
  async provision(
    adminKey: string,
    label?: string,
  ): Promise<{ apiKey: string; label: string; dbPath: string; createdAt: string }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminKey}`,
    };
    const res = await this.fetch(`${this.baseUrl}/instances`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ label }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new TQLError(
        (data as { error?: string }).error ?? `HTTP ${res.status}`,
        res.status,
      );
    }
    return data as { apiKey: string; label: string; dbPath: string; createdAt: string };
  }

  // ---------------------------------------------------------------------------
  // Health / meta
  // ---------------------------------------------------------------------------

  health(): Promise<{ status: string; uptime: number }> {
    return this.req('GET', '/health');
  }

  stats(): Promise<TQLStoreStats> {
    return this.req('GET', '/stats');
  }

  catalog(): Promise<TQLCatalogEntry[]> {
    return this.req('GET', '/catalog');
  }

  // ---------------------------------------------------------------------------
  // Nodes
  // ---------------------------------------------------------------------------

  listNodes(): Promise<{ entities: string[] }> {
    return this.req('GET', '/nodes');
  }

  createNode(
    id: string,
    data: Record<string, unknown>,
    type = 'default',
  ): Promise<{ id: string; created: true }> {
    return this.req('POST', '/nodes', { id, data, type });
  }

  getNode(id: string): Promise<{ id: string; facts: TQLFact[] }> {
    return this.req('GET', `/nodes/${encodeURIComponent(id)}`);
  }

  updateNode(
    id: string,
    data: Record<string, unknown>,
    type = 'default',
  ): Promise<{ id: string; updated: true }> {
    return this.req('PUT', `/nodes/${encodeURIComponent(id)}`, { data, type });
  }

  deleteNode(id: string): Promise<{ id: string; deleted: true }> {
    return this.req('DELETE', `/nodes/${encodeURIComponent(id)}`);
  }

  // ---------------------------------------------------------------------------
  // Links
  // ---------------------------------------------------------------------------

  listLinks(): Promise<{ links: TQLLink[] }> {
    return this.req('GET', '/links');
  }

  createLink(
    source: string,
    relation: string,
    target: string,
  ): Promise<{ source: string; target: string; relation: string; created: true }> {
    return this.req('POST', '/links', { source, target, relation });
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  /** Run an EQL-S query string, e.g. "FIND person AS ?e RETURN ?e.name" */
  query(q: string): Promise<TQLQueryResult> {
    return this.req('POST', '/query', { q });
  }

  /** Run a natural-language query (requires AI provider configured on server) */
  queryNatural(q: string, context?: Record<string, unknown>): Promise<TQLQueryResult> {
    return this.req('POST', '/query', { q, natural: true, context });
  }

  // ---------------------------------------------------------------------------
  // Workspace
  // ---------------------------------------------------------------------------

  exportWorkspace(): Promise<unknown> {
    return this.req('GET', '/workspace');
  }

  bootWorkspace(config: unknown): Promise<{ booted: true }> {
    return this.req('POST', '/workspace', config);
  }

  checkpoint(): Promise<{ checkpoint: true }> {
    return this.req('POST', '/workspace/checkpoint');
  }
}
