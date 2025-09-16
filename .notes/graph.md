Switching gears to our graph implementation tailored for agentic workflows. The following will need its own directory under `src/graph`.

---

Here’s a lean graph + runtime shaped for **agentic LLM workflows**: nodes carry kind-specific config; edges label control-flow (success/error/route), with optional conditions. Executors are pluggable.

````js
// === Types ===
/** @typedef {{ id:string, kind:string, type?:string, data?:object }} Node */
/** @typedef {{ id:string, from:string, to:string, label?:string, cond?:(s:any)=>boolean, data?:object }} Edge */

class Graph {
  constructor() {
    /** @type {Map<string, Node>} */ this.nodes = new Map();
    /** @type {Map<string, Edge>} */ this.edges = new Map();
    /** @type {Map<string, Set<string>>} */ this.outIdx = new Map();
  }
  addNode(n) {
    if (this.nodes.has(n.id)) throw Error(`node ${n.id} exists`);
    this.nodes.set(n.id, n);
    this.outIdx.set(n.id, this.outIdx.get(n.id) || new Set());
  }
  addEdge(e) {
    if (!this.nodes.has(e.from) || !this.nodes.has(e.to))
      throw Error(`bad endpoints`);
    if (this.edges.has(e.id)) throw Error(`edge ${e.id} exists`);
    this.edges.set(e.id, e);
    this.outIdx.get(e.from).add(e.id);
  }
  out(nodeId, label) {
    const ids = [...(this.outIdx.get(nodeId) || [])];
    return ids
      .map((id) => this.edges.get(id))
      .filter((e) => !label || e.label === label);
  }
  getNode(id) {
    return this.nodes.get(id);
  }
}

// === Runtime ===
class Engine {
  constructor(graph, { executors = {}, llm, tools = {} } = {}) {
    this.g = graph;
    this.llm = llm || (async () => ({ text: '(mock LLM)' })); // plug real LLM here
    this.tools = tools;
    /** @type {Record<string,Function>} */ this.exec = {
      Agent: async (node, state) => {
        const {
          system = '',
          prompt = '',
          model = 'gpt-4o',
          vars = {},
        } = node.data || {};
        const input = state.input ?? '';
        const text = await this.llm({
          model,
          system,
          prompt: interpolate(prompt, { ...vars, input, state }),
        }).then((r) => r.text);
        return { output: { text }, next: 'success' };
      },
      Tool: async (node, state) => {
        const { name, args = {} } = node.data || {};
        const fn = this.tools[name];
        if (!fn) throw Error(`tool missing: ${name}`);
        const res = await fn({ ...args, input: state.output?.text, state });
        return { output: { tool: name, result: res }, next: 'success' };
      },
      Router: async (node, state) => {
        const { routes = [] } = node.data || {}; // [{when:(s)=>bool,label:"foo"}]
        const hit = routes.find((r) => r.when(state));
        return { output: state.output, next: hit?.label || 'default' };
      },
      Guard: async (node, state) => {
        const { allow } = node.data || {};
        const ok = typeof allow === 'function' ? allow(state) : !!allow;
        return { output: state.output, next: ok ? 'pass' : 'fail' };
      },
      MemoryRead: async (node, state) => {
        const { key } = node.data || {};
        const v = state.memory?.[key];
        return {
          output: { ...state.output, memory: { [key]: v } },
          next: 'success',
        };
      },
      MemoryWrite: async (node, state) => {
        const { key, from = 'output.text' } = node.data || {};
        const val = pluck(state, from);
        state.memory ||= {};
        state.memory[key] = val;
        return { output: state.output, next: 'success' };
      },
      End: async (_node, state) => ({ output: state.output, next: null }),
      ...executors,
    };
  }

  /** Run from a node id; returns final state/output */
  async run(startId, input, seedState = {}) {
    let current = this.g.getNode(startId);
    if (!current) throw Error(`no start node`);
    /** @type {any} */ let state = {
      input,
      output: null,
      memory: {},
      ...seedState,
    };
    while (current) {
      const exec = this.exec[current.kind];
      if (!exec) throw Error(`no executor: ${current.kind}`);
      const { output, next } = await exec(current, state);
      state.output = output;
      if (!next) break;
      // choose edge by label + optional cond
      const candidates = this.g
        .out(current.id, next)
        .filter((e) => (e.cond ? e.cond(state) : true));
      const edge = candidates[0] || this.g.out(current.id)[0];
      if (!edge) break;
      current = this.g.getNode(edge.to);
    }
    return state;
  }
}

// === Helpers ===
const interpolate = (tpl, vars) =>
  tpl.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, k) =>
    String(pluck(vars, k) ?? ''),
  );
function pluck(obj, path) {
  return path
    .split('.')
    .reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}

// === Example: planner → router → coder → run tool → evaluator → guard → end ===
const g = new Graph();

// Nodes
g.addNode({
  id: 'n:start',
  kind: 'Agent',
  type: 'Planner',
  data: {
    model: 'gpt-4o',
    system: 'You write concise plans.',
    prompt: "Plan steps to fulfill '{{input}}' as bullet points.",
  },
});

g.addNode({
  id: 'n:router',
  kind: 'Router',
  data: {
    routes: [
      {
        label: 'code',
        when: (s) => /code|function|script/i.test(s.output.text || ''),
      },
      { label: 'text', when: (_) => true },
    ],
  },
});

g.addNode({
  id: 'n:coder',
  kind: 'Agent',
  type: 'Coder',
  data: {
    model: 'gpt-4o',
    system: 'Return ONLY runnable JS in triple backticks.',
    prompt:
      'Write JS to accomplish: {{state.input}}.\nContext:\n{{state.output.text}}',
  },
});

g.addNode({ id: 'n:run', kind: 'Tool', data: { name: 'run_js' } });
g.addNode({
  id: 'n:eval',
  kind: 'Agent',
  type: 'Evaluator',
  data: {
    model: 'gpt-4o',
    system: 'Be strict QA.',
    prompt:
      "Given plan + result:\nPlan:\n{{state.output.plan||state.output.text}}\nResult:\n{{state.output.result}}\nIs this acceptable? Reply 'PASS' or 'FAIL: <why>'.",
  },
});

g.addNode({
  id: 'n:guard',
  kind: 'Guard',
  data: { allow: (s) => /^PASS/.test(s.output?.text || '') },
});
g.addNode({
  id: 'n:textGen',
  kind: 'Agent',
  type: 'Writer',
  data: {
    model: 'gpt-4o',
    system: 'You write final answers.',
    prompt:
      'Write the final response to: {{state.input}} using the plan:\n{{state.output.text}}',
  },
});
g.addNode({ id: 'n:end', kind: 'End' });

// Edges
g.addEdge({ id: 'e1', from: 'n:start', to: 'n:router', label: 'success' });
g.addEdge({ id: 'e2', from: 'n:router', to: 'n:coder', label: 'code' });
g.addEdge({ id: 'e3', from: 'n:router', to: 'n:textGen', label: 'text' });
g.addEdge({ id: 'e4', from: 'n:coder', to: 'n:run', label: 'success' });
g.addEdge({ id: 'e5', from: 'n:run', to: 'n:eval', label: 'success' });
g.addEdge({ id: 'e6', from: 'n:eval', to: 'n:guard', label: 'success' });
g.addEdge({ id: 'e7', from: 'n:guard', to: 'n:end', label: 'pass' });
g.addEdge({ id: 'e8', from: 'n:guard', to: 'n:start', label: 'fail' }); // retry loop
g.addEdge({ id: 'e9', from: 'n:textGen', to: 'n:end', label: 'success' });

// Tools + mock LLM
const tools = {
  async run_js({ input }) {
    // naive runner: extracts first ``` block and evals in a sandbox-y Function
    const m = String(input || '').match(
      /```(?:js|javascript)?\s*([\s\S]*?)```/i,
    );
    if (!m) return { error: 'no code' };
    try {
      const result = await (async () => new Function(m[1])())();
      return { ok: true, result };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  },
};

// super-light mock LLM (replace with real call)
async function mockLLM({ system, prompt }) {
  // This is just to show the flow; swap with your LLM API.
  if (system.includes('concise plans'))
    return {
      text: '- Parse input\n- Generate code if needed\n- Return result',
    };
  if (system.includes('ONLY runnable JS'))
    return { text: '```js\nreturn 21*2\n```' };
  if (system.includes('strict QA')) return { text: 'PASS' };
  if (system.includes('final answers'))
    return { text: 'Here’s a clean answer without code.' };
  return { text: '(mock)' };
}

const engine = new Engine(g, { llm: mockLLM, tools });

// Run once:
engine.run('n:start', 'compute 42 from 21*2').then((s) => {
  console.log('FINAL OUTPUT:', s.output);
});
````

Notes (why this works for agentic flows):

- **Kinds**: `Agent`, `Tool`, `Router`, `Guard`, `MemoryRead/Write`, `End`. Add `Map`, `FanOut`, `Batch`, `Retry` as new kinds without changing the core.
- **Edges as labels**: deterministic control-flow (`success`, `fail`, `code`, `text`) with optional `cond(state)`.
- **State**: shared `input | output | memory`; node executors mutate nothing except via return, keeping effects local and testable.
- **Pluggable LLM/tools**: inject your real LLM client and tool map; this keeps the graph serializable and portable.

---

Sharp. You’ve got the right primitives and the flow reads clean. Here’s where I’d tighten and harden it so you can ship it without the gremlins.

# Keep (good calls)

- Small, orthogonal kinds: Agent/Tool/Router/Guard/Memory/End. Easy to extend.
- Labelled edges for control-flow. Human-readable.
- Pluggable `llm` + `tools`. Good separation.
- Minimal mutable state (single `state` object).

# Fix (stuff that will bite)

1. **Ambiguous routing**
   `const edge = candidates[0] || g.out(current.id)[0]` is nondeterministic and silently falls back. Routes should be **ordered** and **validated**.
2. **Infinite loops / runaway graphs**
   You have a retry loop; add a hard **step budget** and per-node **timeout**.
3. **Tool sandbox**
   `new Function` is not a sandbox. Use Node `vm` with `timeout` / `microtaskMode`, or QuickJS/isolated-vm.
4. **Observability**
   No tracing. You’ll want step logs, timings, and a `runId`.
5. **Error boundaries**
   Executor errors should bubble into a `fail` edge (if present) before killing the run.
6. **Types**
   You wrote JS; you need TS here. Strong node/edge schemas, executor signatures, and serializable `data`.
7. **Streaming**
   Let `Agent` support streamed chunks (esp. when you swap in a real LLM).
8. **Graph validation**
   At build time: missing nodes, duplicate labels per source, unreachable nodes, cycles (warn, not forbid), missing “default” path, unknown kinds.
9. **Deterministic templating**
   `interpolate` is fine, but guard missing keys and enable `{{#json}}` for structured tool args.
10. **State discipline**
    Namespaces: `state = { input, output, memory, meta, step, traces }`. Tools shouldn’t scribble all over `output`.

# Drop-in upgrades (tight)

## Deterministic routing + budgets + tracing

```ts
type ExecResult = { output: any; next: string | null };
type Trace = { nodeId: string; kind: string; tStart: number; tEnd: number; next: string | null; error?: string };

class Engine {
  constructor(graph, { executors = {}, llm, tools = {}, maxSteps = 200, perNodeMs = 15000 } = {}) {
    this.g = graph;
    this.llm = llm || (async () => ({ text: '(mock LLM)' }));
    this.tools = tools;
    this.maxSteps = maxSteps;
    this.perNodeMs = perNodeMs;
    this.exec = {/* …your kinds… */, ...executors};
  }

  /** Async generator: yields per-step traces; consumer can stream UI/logs */
  async *run(startId, input, seedState = {}) {
    const runId = crypto.randomUUID?.() || String(Date.now());
    let current = this.g.getNode(startId); if (!current) throw Error('no start node');
    let steps = 0;
    /** @type {any} */ let state = { runId, step: 0, input, output: null, memory: {}, meta:{}, ...seedState };
    /** @type {Trace[]} */ const traces = []; state.traces = traces;

    while (current) {
      if (++steps > this.maxSteps) throw Error(`step budget exceeded (${this.maxSteps})`);
      state.step = steps;

      const t0 = Date.now();
      let nextLabel = null, output = state.output, err;
      try {
        const exec = this.exec[current.kind]; if (!exec) throw Error(`no executor: ${current.kind}`);
        const { output: out, next } = await withTimeout(exec(current, state), this.perNodeMs);
        output = out; nextLabel = next;
      } catch (e) {
        err = e instanceof Error ? e.message : String(e);
        nextLabel = 'fail'; // try fail edge first
      }
      state.output = output;

      const t1 = Date.now();
      const trace = { nodeId: current.id, kind: current.kind, tStart: t0, tEnd: t1, next: nextLabel, error: err };
      traces.push(trace);
      yield { state, trace };

      if (!nextLabel) break;
      const edge = this._selectEdge(current.id, nextLabel, state);
      if (!edge) {
        if (err) throw Error(`unhandled error at ${current.id}: ${err}`);
        break;
      }
      current = this.g.getNode(edge.to);
    }
    return state;
  }

  _selectEdge(fromId, label, state) {
    // deterministic: labeled edges first (ordered by insertion), then explicit "default" label
    const outs = this.g.out(fromId);
    const labeled = outs.filter(e => e.label === label);
    const candidates = labeled.length ? labeled : outs.filter(e => e.label === 'default');
    const hit = candidates.find(e => (typeof e.cond === 'function' ? e.cond(state) : true));
    return hit || null;
  }
}

function withTimeout(promise, ms) {
  let t; return Promise.race([
    promise.finally(() => clearTimeout(t)),
    new Promise((_, rej) => t = setTimeout(() => rej(new Error(`node timeout ${ms}ms`)), ms))
  ]);
}
```

## Safer code tool (Node `vm`)

````ts
import vm from 'node:vm';
const tools = {
  async run_js({ input }) {
    const m = String(input || '').match(
      /```(?:js|javascript)?\s*([\s\S]*?)```/i,
    );
    if (!m) return { error: 'no code' };
    try {
      const script = new vm.Script(m[1], { filename: 'user.js' });
      const ctx = vm.createContext(Object.freeze({ console: undefined })); // no console, no globals
      const res = await script.runInContext(ctx, {
        timeout: 500,
        microtaskMode: 'afterEvaluate',
      });
      return { ok: true, result: res };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  },
};
````

## Stream-capable Agent

```ts
this.exec.Agent = async (node, state) => {
  const {
    system = '',
    prompt = '',
    model = 'gpt-4o',
    vars = {},
    stream = false,
  } = node.data || {};
  const input = state.input ?? '';
  const rendered = interpolate(prompt, { ...vars, input, state });

  if (stream && this.llm.stream) {
    const iter = await this.llm.stream({ model, system, prompt: rendered }); // expect AsyncIterable<string>
    return { output: { stream: iter }, next: 'success' };
  } else {
    const { text } = await this.llm({ model, system, prompt: rendered });
    return { output: { text }, next: 'success' };
  }
};
```

## Graph validation (run once at build/load)

```ts
function validate(graph) {
  for (const [_, e] of graph.edges) {
    if (!graph.nodes.has(e.from) || !graph.nodes.has(e.to))
      throw Error(`dangling edge ${e.id}`);
  }
  for (const [id] of graph.nodes) {
    const outs = graph.out(id);
    const byLabel = new Map();
    for (const e of outs) {
      if (!e.label) continue;
      const list = byLabel.get(e.label) || [];
      list.push(e.id);
      byLabel.set(e.label, list);
    }
    for (const [label, ids] of byLabel) {
      if (ids.length > 1)
        throw Error(
          `node ${id} has duplicate label "${label}" to edges ${ids.join(',')}`,
        );
    }
  }
}
```

# Small polish

- Add `onStep`/`onFinish` hooks or `EventEmitter`.
- JSON-schema your `node.data` by `kind` and validate at add time.
- Support `Retry` kind with backoff instead of hand-rolled edge loops.
- Add `state.meta.tags` & `node.tags` for analytics and filtering.
- Support `Map`/`FanOut` via `for…of await` in the generator.

# Why this matters

- Deterministic routing + validation → reproducible runs (critical for debugging).
- Budgets + timeouts → no hung runs.
- Traces + step streaming → easy UI and CI logs.
- Safer tool exec → prevents the “oops, my process can eval anything” class of bugs.

If you want, I can translate this to strict TypeScript types for `NodeByKind`, `Executor<K>`, and a serializable graph schema next.
