// NOTE: In Bun environments, Node's "vm" may not exist. We auto-fallback to unsafe eval.
let vm: any = null;
try { vm = await import('node:vm'); } catch { /* noop */ }

import { EAVStore, jsonEntityFacts } from '../eav-engine.js';
import { EQLSProcessor } from '../query/eqls-parser.js';
import { DatalogEvaluator } from '../query/datalog-evaluator.js';

export const builtinTools = {
    // run_js: extracts first ```js block and executes.
    async run_js({ input }: { input?: unknown }): Promise<unknown> {
        const m = String(input ?? '').match(/```(?:js|javascript)?\s*([\s\S]*?)```/i);
        if (!m) return { error: 'no code block' };

        const code = m[1]!;
        if (vm?.default || vm?.Script) {
            try {
                const Script = (vm.default?.Script ?? vm.Script);
                const script = new Script(code, { filename: 'user.js' });
                const ctx = (vm.default?.createContext ?? vm.createContext)({}); // empty sandbox
                const res = await script.runInContext(ctx, { timeout: 500, microtaskMode: 'afterEvaluate' });
                return { ok: true, result: res };
            } catch (e) { return { ok: false, error: String(e) }; }
        }

        // Fallback: unsafe eval (last resort). Prefer replacing with a real sandbox in production.
        try {
            // eslint-disable-next-line no-new-func
            const fn = new Function(code);
            const res = await (async () => fn())();
            return { ok: true, result: res };
        } catch (e) {
            return { ok: false, error: String(e) };
        }
    },

    // tql_query: executes EQL-S queries against an EAV store
    async tql_query({
        query,
        data,
        dataUrl,
        entityType = 'item',
        idKey = 'id',
        limit = 100,
        state
    }: {
        query?: string;
        data?: any[];
        dataUrl?: string;
        entityType?: string;
        idKey?: string;
        limit?: number;
        state?: any;
    }): Promise<unknown> {
        try {
            // Parse query from input if not provided directly
            const eqlsQuery = query || (typeof state?.input === 'string' ? state.input : '');
            if (!eqlsQuery) {
                return { error: 'No EQL-S query provided' };
            }

            // Create EAV store
            const store = new EAVStore();

            // Load data into store
            let sourceData: any[] | undefined = data;
            if (!sourceData && dataUrl) {
                // Fetch data from URL
                const response = await fetch(dataUrl);
                if (!response.ok) {
                    return { error: `Failed to fetch data: ${response.statusText}` };
                }
                sourceData = await response.json() as any[];
            }

            if (!sourceData) {
                // Try to get data from state memory based on entity type
                const memoryKey = entityType === 'post' ? 'posts' :
                    entityType === 'user' ? 'users' :
                        entityType;
                sourceData = state?.memory?.[memoryKey] || state?.memory?.data || state?.data;
            }

            if (!sourceData) {
                return { error: 'No data source provided (data, dataUrl, or state.memory.data)' };
            }

            // Ensure data is an array
            const dataArray = Array.isArray(sourceData) ? sourceData : [sourceData];

            // Ingest data into EAV store
            for (let i = 0; i < dataArray.length; i++) {
                const item = dataArray[i]!;
                const entityId = item[idKey] ? `${entityType}:${item[idKey]}` : `${entityType}:${i}`;
                const facts = jsonEntityFacts(entityId, item, entityType);
                store.addFacts(facts);
            }

            // Parse and execute query
            const processor = new EQLSProcessor();

            // Set schema so processor knows about attributes
            const catalog = store.getCatalog();
            processor.setSchema(catalog);
            const evaluator = new DatalogEvaluator(store);

            const parseResult = processor.process(eqlsQuery);

            if (parseResult.errors.length > 0) {
                return {
                    ok: false,
                    error: 'Query parsing failed',
                    parseErrors: parseResult.errors.map(e => ({
                        line: e.line,
                        column: e.column,
                        message: e.message,
                        expected: e.expected
                    }))
                };
            }

            const result = evaluator.evaluate(parseResult.query!);

            // Apply limit
            const limitedResults = limit > 0 ? result.bindings.slice(0, limit) : result.bindings;

            return {
                ok: true,
                results: limitedResults,
                count: limitedResults.length,
                totalCount: result.bindings.length,
                executionTime: result.executionTime,
                store: {
                    totalFacts: store.getStats().totalFacts,
                    uniqueEntities: store.getStats().uniqueEntities,
                    uniqueAttributes: store.getStats().uniqueAttributes
                }
            };

        } catch (e: any) {
            return {
                ok: false,
                error: e?.message || String(e),
                stack: e?.stack
            };
        }
    },

    // tql_load_data: loads data into state memory for later querying
    async tql_load_data({
        data,
        dataUrl,
        key = 'data',
        state
    }: {
        data?: any;
        dataUrl?: string;
        key?: string;
        state?: any;
    }): Promise<unknown> {
        try {
            let sourceData = data;

            if (!sourceData && dataUrl) {
                const response = await fetch(dataUrl);
                if (!response.ok) {
                    return { error: `Failed to fetch data: ${response.statusText}` };
                }
                sourceData = await response.json();
            }

            if (!sourceData) {
                return { error: 'No data source provided (data or dataUrl)' };
            }

            // Store data in state memory
            if (state?.memory) {
                state.memory[key] = sourceData;
            }

            const count = Array.isArray(sourceData) ? sourceData.length : 1;

            return {
                ok: true,
                message: `Loaded ${count} items into state.memory.${key}`,
                count,
                dataType: Array.isArray(sourceData) ? 'array' : typeof sourceData
            };

        } catch (e: any) {
            return {
                ok: false,
                error: e?.message || String(e)
            };
        }
    }
};