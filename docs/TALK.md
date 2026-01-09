# On Rich Harris, Svelte, and Introducing Trellis

This is one of my favorite technical talks ever. Let me break down why it works, how Svelte relates to Trellis, and how you should present Trellis.

---

## Why This Talk is Masterful

### 1. **The Spreadsheet Hook (0:00-2:33)**

**What Rich does:**

- Opens with Apollo 11... but pivots to spreadsheets
- Makes a 50-year-old technology feel revolutionary
- Shows VisiCalc vs. LANPAR (reactive vs. naive)
- Establishes the core thesis: **reactive is better, we just forgot**

**Why it works:**

- Everyone understands spreadsheets
- The dependency graph is _visual_ - you can see it
- Historical framing: "We had this, lost it, need it back"
- Sets up React as VisiCalc: "works, but we can do better"

**Trellis parallel:**

```
Spreadsheets (1969)         →  Modern Apps (2024)
─────────────────────────────────────────────────
Forward referencing         →  Reactive graphs
Formulas = dependencies     →  Datalog queries
Change cell → auto update   →  Mutate node → projections update
Dependency graph            →  Semantic graph
```

**Your opening should be:**

> "Fifty years ago, we built something revolutionary: **the file system**. Files in folders. Simple, universal, portable. But then we forgot something important: **files have relationships**. Your design mockup _belongs to_ a project. Your meeting notes _reference_ three people and two tasks. The file system can't express this—so we invented apps. Notion for projects. Slack for conversations. Figma for designs. We didn't solve the problem, we just... worked around it. What if we could bring back the simplicity of files, but with the power of relationships? Not files in folders—**nodes in a graph**."

### 2. **The Villain Origin Story (3:14-5:53)**

**What Rich does:**

- Praises React ("React is a miracle")
- Then systematically dismantles it
- Not mean-spirited—respectful but honest
- The villain isn't React, it's the **virtual DOM**

**Key move:** Show the inefficiency visually

```javascript
// All this work to change 4 → 5
<button>Clicked {count} times</button>
```

Then walks through every reconciliation step. The audience _feels_ the waste.

**Why it works:**

- He's not attacking people, he's attacking **assumptions**
- "React is not reactive" is _shocking_ but provable
- The inefficiency is visceral, not abstract

**Trellis parallel:**

Your villain isn't React—it's **data silos**.

**Your visual equivalent:**

```
User's workflow:
┌─────────────┐
│ Notion      │ ← Project management
│ (closed)    │
└─────────────┘
       ↓ (manual copy/paste)
┌─────────────┐
│ Linear      │ ← Engineering tasks
│ (closed)    │
└─────────────┘
       ↓ (manual copy/paste)
┌─────────────┐
│ Figma       │ ← Design files
│ (closed)    │
└─────────────┘
       ↓ (manual copy/paste)
┌─────────────┐
│ Slack       │ ← Conversations
│ (closed)    │
└─────────────┘

PROBLEM: Same data, five places.
No relationships. No queries. No truth.
```

Then show:

```
Trellis:
┌─────────────────────────────────────┐
│  ONE GRAPH                          │
│                                     │
│  Project ──contains──> Task         │
│    ↓                    ↓           │
│  Design ──referenced──> Conversation│
│                                     │
│  Query: "Show me blocked tasks"     │
│  → Instant. Accurate. Yours.        │
└─────────────────────────────────────┘
```

**Your version of "React is not reactive":**

> "Notion isn't a database. It's a **pretty** database. But the data is theirs, not yours. You can't query it with Datalog. You can't sync it P2P. You can't git commit your workspace. Notion is to knowledge work what WordPress is to web development—**a silo with a nice UI**."

### 3. **The "Aha!" Moment (7:16-9:46)**

**What Rich does:**

- "Frameworks are not tools for organizing code—they're tools for **organizing your mind**"
- Therefore: **compile-time, not runtime**
- Shows the magic: `count += 1` just works

**The reveal:**

```svelte
let count = 0;

<button on:click={() => count += 1}>
  Clicked {count} times
</button>
```

No `setState`, no `useState`, no `this`—just **assignment**.

**Why it works:**

- The syntax is _too simple_ to ignore
- "How does this work?" → "We're a compiler, we make the rules"
- Violates expectations in a delightful way

**Trellis parallel:**

Your "aha!" is the `.trellis` file.

**Before (status quo):**

```
Data model: Proprietary (Notion API)
Queries: SQL (limited)
Sync: Cloud-only (Notion's servers)
Ownership: Theirs
```

**After (Trellis):**

```json
{
  "workspace": {
    "ontologies": {
      /* your schemas */
    },
    "graph": {
      /* your data */
    },
    "projections": {
      /* your views */
    }
  }
}
```

**The reveal:**

> "This isn't a config file. It's your **operating system**. Like NixOS for your system, Trellis is NixOS for your workspace. Same file = same workspace, anywhere. Git commit it. Share it P2P. Export it. It's **yours**."

**Show the magic:**

```bash
# Boot workspace
trellis boot workspace.trellis

# Query (natural language)
> Show me overdue projects owned by Alice

# Result (instant, local, Datalog)
[ { "title": "Website Redesign", "dueDate": "2024-06-30" } ]
```

Then:

```bash
# Share with Bob (P2P, no server)
> trellis share
iroh://abc123def...

# Bob joins
trellis join iroh://abc123def...

# Alice edits → Bob sees update (real-time)
```

### 4. **The $: Moment (13:42-16:26)**

**What Rich does:**

- Shows the `$:` reactive statement
- "This is a labeled statement—no one uses this"
- "So we stole it"
- Demonstrates topological ordering

**Key line:**

> "I'm the guy Kyle Simpson was trying to warn you about."

Self-aware humor defuses criticism.

**Why it works:**

- The syntax is _weird_ but _works_
- Compiler magic feels like language magic
- Observable notebooks → spreadsheets → Svelte (lineage matters)

**Trellis parallel:**

Your `$:` moment is **Datalog for normal people**.

**Show evolution:**

**SQL (familiar but limited):**

```sql
SELECT * FROM projects WHERE status = 'active'
```

**EQL-S (better, but still imperative):**

```sql
FIND root AS ?r
WHERE ?r.workspace.graph.nodes.status = "active"
```

**Datalog (powerful, but scary):**

```prolog
at_risk(P) :- budget_risk(P).
budget_risk(P) :- spent(P, S), budget(P, B), S > B * 0.9.
```

**Natural Language (magic):**

```
> Which projects are at risk due to budget overruns?

[AI generates Datalog]
→ [ Project X, Project Y ]
```

**Your version of "I'm the guy Kyle warned you about":**

> "We took Datalog—a 40-year-old logic programming language—and made it... friendly. You type in English, Claude writes the query. You don't need to learn Prolog. You don't need to understand resolution algorithms. You just **ask**."

### 5. **The Performance Benchmarks (18:03-24:58)**

**What Rich does:**

- Shows benchmarks (Svelte 35x faster than React)
- Acknowledges Dan Abramov's criticism
- Then shows _why it matters_ (concurrent mode demo)
- Live demo: React (chunky) vs. Svelte (smooth)

**The kill shot:**

> "The best way to deliver a good user experience is to be **extremely fast**."

**The ICE → Tesla analogy:**

- React = internal combustion (incremental optimization)
- Svelte = electric motor (different assumptions)

**Why it works:**

- Benchmarks are visceral
- Live demos don't lie
- Analogies make abstract concrete

**Trellis parallel:**

You're not benchmarking _speed_—you're benchmarking **freedom**.

**Show the comparison:**

| Feature            | Notion             | Trellis               |
| ------------------ | ------------------ | --------------------- |
| **Data ownership** | Notion's servers   | Your SQLite file      |
| **Queries**        | SQL (via API)      | Datalog (local)       |
| **Sync**           | Cloud-only         | P2P (Iroh)            |
| **Offline**        | Limited            | Full                  |
| **Export**         | CSV (lossy)        | JSON-LD (lossless)    |
| **AI**             | Notion AI ($10/mo) | Claude (your API key) |
| **Vendor lock-in** | Total              | Zero                  |

**Your "live demo":**

Split screen:

**Left: Notion**

1. "Export workspace" → wait 30s → get CSV
2. "Import to Linear" → manual mapping, data loss
3. "Query: 'Show projects Alice owns'" → not possible

**Right: Trellis**

1. `trellis export workspace.trellis` → instant
2. `trellis import workspace.trellis` → instant, perfect fidelity
3. `trellis query "Show projects Alice owns"` → instant, Datalog-powered

**Your Tesla moment:**

> "Notion spent millions building a fast cloud sync engine. Iroh said: **what if we just don't use servers?** P2P is faster, cheaper, and you can't get de-platformed."

### 6. **The Real-World Impact (25:50-26:32)**

**What Rich does:**

- Stone (Brazil): 200K POS devices running Svelte
- Mustlab (Russia): Smart TVs, embedded systems
- "The mobile web is not the frontier—**embedded web** is"

**Why it works:**

- Abstract performance → concrete businesses
- Proves it's not academic
- Aspirational ("This is the future")

**Trellis parallel:**

Your real-world users aren't POS systems—they're **knowledge workers who got burned**.

**Your version:**

> "Meet Sarah. She's a product manager. She uses Notion for roadmaps, Linear for eng tasks, Figma for mocks, Slack for updates. One day, Notion raises prices 3x. She can't export her data—it's trapped. She switches to Trellis. Now her workspace is **a file**. If Trellis dies tomorrow, she doesn't care. She owns the data. She can write her own UI. She's **free**."

**Then show the slide:**

```
Current state (2024):
├─ 47 SaaS subscriptions/year
├─ $12,000/year average cost
├─ Data locked in 47 silos
└─ Zero interoperability

Trellis future:
├─ 1 workspace file
├─ $0/year (self-hosted)
├─ All data in ONE graph
└─ Infinite interoperability
```

### 7. **Beyond Performance (27:51-34:05)**

**What Rich does:**

- Accessibility (warnings for missing `alt` tags)
- Scoped CSS (no BEM, no CSS-in-JS)
- Transitions (CSS animations, declarative)

**The point:**

> "CSS-in-JS is designed to solve a problem. Svelte solves it **better** because the compiler understands both."

**Why it works:**

- Shows Svelte isn't just fast—it's **complete**
- Accessibility isn't optional
- Styling is first-class

**Trellis parallel:**

Trellis isn't just a graph database—it's a **complete OS**.

**Show the layers:**

```
User sees: Graph editor (Svelte Flow)
           ↓
Built on:  Projections (cards, tables, timelines)
           ↓
Powered by: Query engine (EQL-S, Datalog, NL)
            ↓
Stored in:  SQLite + Iroh sync
            ↓
Configured: .trellis file (declarative)
```

**Your accessibility moment:**

> "Trellis validates your schemas. If you create a `Person` node without a `name` field, it yells at you. If you write a formula that references a non-existent property, it fails **at compile time**. Not at runtime when your user clicks. At **build time**."

**Your scoped CSS moment (scoped schemas):**

```json
{
  "ontologies": {
    "project-schema": {
      "fields": [
        {
          "name": "status",
          "valueType": "status",
          "required": true // ← Compiler enforces this
        }
      ]
    }
  }
}
```

### 8. **The Ecosystem (34:05-35:25)**

**What Rich does:**

- Sapper (app framework, like Next.js)
- Svelte Native (mobile)
- Svelte GL (3D, aspirational)

**Why it works:**

- Shows vision beyond the core
- Proves it's not a toy
- "We're just getting started"

**Trellis parallel:**

**Your ecosystem:**

```
Trellis Core (kernel + query engine)
    ↓
Trellis Desktop (Tauri + Svelte Flow)
    ↓
Trellis Sync (Iroh P2P)
    ↓
Trellis AI (Claude integration)
    ↓
Trellis Mobile (React Native, future)
    ↓
Trellis Plugins (user projections, future)
```

**Show the vision:**

> "Today: Trellis is a desktop app. Tomorrow: It's an OS. You define schemas in `.trellis` files. You share workspaces with Iroh. You query with natural language. You build projections as Svelte components. One day, you won't install apps—you'll **import schemas**."

### 9. **The Closer (35:25-36:50)**

**What Rich does:**

- Comes back to spreadsheets
- "My wife can do incredible things with spreadsheets"
- "Wouldn't it be wonderful if web dev were this accessible?"
- Final line: "In a strange way, it brought us all a little closer together"

**Why it works:**

- Human, not technical
- Aspirational, not self-promotional
- Echoes the opening (spreadsheets)
- Leaves you _feeling_ something

**Trellis parallel:**

**Your closer:**

> "Fifty years ago, we built the file system. Files in folders. Simple. Portable. Yours. Then we forgot. We built apps. Apps became silos. Silos became prisons. But it doesn't have to be this way. Your workspace can be a file again. Your data can be yours. Your tools can interoperate. Trellis isn't about replacing Notion—it's about **remembering what we lost**. The file. The graph. The freedom. And in a strange way, maybe it'll bring us a little closer together."

---

## Has Svelte Accomplished Its Goals?

### What Svelte Set Out to Do

**From the talk:**

1. ✅ **Faster than React** - Demonstrably true
2. ✅ **Compile-time, not runtime** - Revolutionary
3. ✅ **Reactivity in the language** - The `$:` syntax works
4. ✅ **Scoped CSS** - No more BEM hell
5. ✅ **Accessibility warnings** - Built-in
6. ✅ **Smaller bundles** - 3KB vs. 45KB (React)
7. ⚠️ **"Accessible as spreadsheets"** - Debatable

### What Actually Happened

**Successes:**

- Svelte is mainstream (adopted by NYT, Spotify, etc.)
- SvelteKit is excellent (better than Next.js IMO)
- Reactivity _feels_ magical
- Performance is unmatched

**Shortcomings:**

- Not as accessible as Rich hoped (still requires JS knowledge)
- Ecosystem smaller than React's
- Hiring is harder (fewer Svelte devs)
- The `$:` syntax is polarizing (some love it, some hate it)

**Verdict:** Svelte **delivered** on technical goals but **underdelivered** on "accessible as spreadsheets." It's still a programmer's tool.

---

## Parallels & Differences: Svelte vs. Trellis

| Aspect             | Svelte                     | Trellis                       |
| ------------------ | -------------------------- | ----------------------------- |
| **Problem**        | Virtual DOM is slow        | Data silos are limiting       |
| **Solution**       | Compile to imperative code | Compile to semantic graph     |
| **Innovation**     | Reactivity = assignment    | Queries = natural language    |
| **Villain**        | React's reconciliation     | Notion's lock-in              |
| **Magic**          | `$:` reactive statements   | `.trellis` declarative config |
| **Paradigm shift** | Compile-time > runtime     | Data > apps                   |
| **Accessibility**  | Simpler syntax (failed)    | Simpler queries (AI-powered)  |
| **Ecosystem**      | Sapper, SvelteKit          | Tauri, Iroh, Datalog          |

### Key Difference

**Svelte:** "What if we compiled the UI?"
**Trellis:** "What if we compiled the **workspace**?"

Svelte is to React what Trellis is to Notion.

---

## How to Introduce Trellis (Your Talk Structure)

### Act 1: The Hook (5 min)

**Title Slide:**

> "Rethinking Workspaces"
> or
> "What if Notion Were a File?"

**Opening:**

> "Fifty years ago, we built something revolutionary: the file system..."

**Show the problem (viscerally):**

Live demo:

1. Open Notion → create project
2. Export → wait 30s → CSV (data loss)
3. Try to query "Show projects Alice owns" → impossible

**Thesis:**

> "We traded ownership for convenience. We got prettier apps, but lost our data. What if we could have both?"

### Act 2: The Villain (5 min)

**The Data Silo Problem:**

Show the user workflow:

```
Morning: Check Notion (projects)
         ↓
Afternoon: Update Linear (tasks)
           ↓
Evening: Post in Slack (status)
```

**The question:**

> "Why are these separate? They're the **same data**. Projects. Tasks. People. Why can't I query across them?"

**Show the cost:**

| Year | SaaS Subscriptions | Avg Cost |
| ---- | ------------------ | -------- |
| 2015 | 8                  | $1,200   |
| 2020 | 34                 | $7,800   |
| 2024 | 47                 | $12,000  |

> "We're paying more to own less."

### Act 3: The Aha! (10 min)

**Introduce Trellis:**

> "What if your workspace were **a file**?"

**Show the `.trellis` file:**

```json
{
  "workspace": {
    "ontologies": {
      /* schemas */
    },
    "graph": {
      /* nodes & edges */
    },
    "projections": {
      /* views */
    }
  }
}
```

**The magic:**

```bash
# Boot
trellis boot workspace.trellis

# Query (English)
> Show overdue projects

# Result (instant)
[...]

# Share (P2P)
> trellis share
iroh://abc123...

# Export (perfect fidelity)
trellis export workspace.trellis
```

**Live demo:**

1. Create project in graph view (Svelte Flow)
2. Query with natural language
3. Share with peer via Iroh
4. Peer sees update in real-time
5. Export as `.trellis` file
6. Git commit it

### Act 4: The Technical Deep Dive (10 min)

**Show the stack:**

```
Svelte Flow (graph UI)
     ↓
Tauri (native app)
     ↓
Bun kernel (query engine)
     ↓
SQLite + Iroh (storage + sync)
     ↓
.trellis file (config)
```

**The three query interfaces:**

1. **EQL-S** (SQL-like)
2. **Datalog** (recursive)
3. **Natural Language** (AI-powered)

**Show each:**

```sql
-- EQL-S
FIND root AS ?r
WHERE ?r.workspace.graph.nodes.status = "active"
```

```prolog
-- Datalog
at_risk(P) :- budget_risk(P).
```

```
-- Natural Language
"Show projects at risk"
```

**The compiler:**

```typescript
Natural Language
  → Claude (AI)
  → EQL-S
  → Datalog
  → SQLite
  → Results
```

### Act 5: The Real-World Impact (5 min)

**Who needs this:**

**Sarah (Product Manager):**

- Pays $200/mo for Notion, Linear, Figma
- Data locked in silos
- Can't query across tools
- **Switches to Trellis:** Owns data, queries everything, $0/mo

**Dev Team:**

- Uses GitHub for code, Notion for docs, Linear for tasks
- No single source of truth
- **Switches to Trellis:** One graph, queryable, git-trackable

**Enterprise:**

- 500 employees, 50 SaaS tools
- $600K/year in subscriptions
- Compliance nightmare (data everywhere)
- **Switches to Trellis:** Self-hosted, auditable, secure

### Act 6: The Vision (5 min)

**Beyond the desktop app:**

**Phase 1 (Today):** Desktop app (Tauri + Svelte Flow)
**Phase 2 (Q1 2025):** Mobile companion
**Phase 3 (Q2 2025):** Plugin system (custom projections)
**Phase 4 (Q3 2025):** Federation (cross-workspace queries)
**Phase 5 (Q4 2025):** AI agents (autonomous workflows)

**The dream:**

> "One day, you won't install apps. You'll **import schemas**. Your workspace will be a file. Your data will be yours. And your tools will finally, finally, **talk to each other**."

### Act 7: The Closer (2 min)

**Return to the file system:**

> "Fifty years ago, we built the file system. Files in folders. Simple. Portable. Yours. Then we forgot. We built apps. Apps became silos. Silos became prisons. Trellis is about **remembering**. The file. The graph. The freedom. It's not a tool for organizing your data—it's a tool for organizing your **mind**. And in a strange way, maybe it'll bring us a little closer together."

**End slide:**

```
Trellis OS
github.com/trentbrew/trellis

Try it: trellis.app
```

---

## Final Thoughts

**What Rich got right:**

1. **Historical framing** (spreadsheets)
2. **Live demos** (React chunky vs. Svelte smooth)
3. **Respectful criticism** (React is great, but...)
4. **Human closer** (wife uses spreadsheets)

**What you should do:**

1. **Historical framing** (file systems)
2. **Live demos** (Notion export fail vs. Trellis instant)
3. **Respectful criticism** (Notion is great, but...)
4. **Human closer** (Sarah escapes vendor lock-in)

**The key:**

Rich made Svelte feel **inevitable**. Not "here's a cool thing I built," but "**this is obviously how it should work**."

You need to make Trellis feel inevitable: "**Of course** workspaces should be files. **Of course** data should be yours. How did we forget?"

**Your mantra:**

> "Trellis isn't new. It's **remembering**."
