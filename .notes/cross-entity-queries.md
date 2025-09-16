Q:

Would we be able to provide multiple relational JSON files/urls and query across entities? (ie. /posts and /users where posts are owned by users:id)

A:

We're looking into implementing a cross-source join using Datalog with various data sources. The idea is to ingest multiple files and query them together using an example CLI command. Also, I want to address potential conflicts in property naming and handling arrays, with type inference based on file paths or keys.

I’m thinking about adding sample Queries across different sources for EQL-S. I’ll include advanced queries like counting posts per user, left joins, or anti-joins to detect users without posts. I may need to update the CLI to support multiple sources, using a manifest YAML for data sources, with an example provided.

I’m exploring how to further define join semantics in EQL-S, like using JOIN sugar or resolving foreign keys with a RESOLVE operator. I also want to support cross-domain catalog merges, unifying duplicate entities based on a canonical ID, and handling source-specific fields properly. I’ll propose strategies for merging different sources correctly.

We will load multiple JSON files/URLs into the **same EAV store**, synthesize (or infer) foreign-key links, and your EQL-S/Datalog layer can join across them like any relational DB—schema-agnostic.

Here’s the playbook + concrete tweaks to TQL.

# How to wire it up

## 1) Load many sources into one store

Allow multiple `-d/--data` flags or a manifest.

```bash
# multiple sources
bun run tql \
  -d posts=https://jsonplaceholder.typicode.com/posts \
  -d users=https://jsonplaceholder.typicode.com/users \
  --type posts=post --type users=user \
  --id-key posts=id --id-key users=id
```

Or a YAML:

```yaml
# sources.yaml
sources:
  - name: posts
    url: https://.../posts
    type: post
    idKey: id
    fks:
      - from: userId # posts.userId → users.id
        toType: user
        toIdKey: id
        rel: BY # synthesize link(post,"BY",user)
  - name: users
    url: https://.../users
    type: user
    idKey: id
```

CLI:

```bash
bun run tql --manifest sources.yaml
```

## 2) Ingest one entity per array element

For each source:

- If top-level is an array: create one entity per item: `post:1`, `user:7`, etc.
- If object: one entity: `root:...` (or `type:id` if present).

## 3) Synthesize FK links (fast joins later)

Use your link synthesizer on each ingested row:

```ts
// posts row example
links.push({ e1: `post:${row.id}`, a: 'BY', e2: `user:${row.userId}` });
// keep a generic REF too if you like:
links.push({ e1: `post:${row.id}`, a: 'REF', e2: `user:${row.userId}` });
```

Index both directions:

- `out[e1][a] -> Set<e2>`
- `in[e2][a]  -> Set<e1>`

(You already implemented these.)

# Querying across entities (EQL-S)

### Explicit attribute join (no links required)

```eql
FIND post AS ?p, user AS ?u
WHERE ?p.userId = ?u.id
RETURN ?p.id, ?u.name, ?p.title
```

### Using synthesized link (cleaner, faster)

```eql
FIND post AS ?p, user AS ?u
WHERE LINK(?p, "BY", ?u)
RETURN ?p.id, ?u.name, ?p.title
```

### Aggregation: posts per user

```eql
FIND post AS ?p, user AS ?u
WHERE LINK(?p, "BY", ?u)
RETURN ?u.name AS name, COUNT(?p) AS posts
GROUP BY name
ORDER BY posts DESC
LIMIT 10
```

### Anti-join: users without posts

```eql
FIND user AS ?u
WHERE NOT EXISTS LINK(?p, "BY", ?u)
RETURN ?u.id, ?u.name
```

### Two-hop: users who wrote posts mentioning “dolor”

```eql
FIND user AS ?u, post AS ?p
WHERE LINK(?p, "BY", ?u) AND ?p.title CONTAINS "dolor"
RETURN ?u.name, ?p.title
```

> Compiler detail: for `LINK(?a,"REL",?b)` emit a goal that hits the link index; for `?x.y` in `RETURN`, inject a hidden `attr(?x,"y",?ret)` goal (fixes the projection issue you saw).

# CLI tweaks (minimal)

- Accept repeated data flags with optional names:

  - `-d posts=pathOrUrl` / `-d users=pathOrUrl`

- Per-source hints:

  - `--type posts=post --type users=user`
  - `--id-key posts=id --id-key users=id`
  - `--fk posts.userId=user.id:BY` (FK hint inline if no manifest)

- Show a **multi-source catalog** (group by `type` and `source`).
- Add `--explain` to print selected join order (planner should start from the most selective goal and prefer `LINK` joins over full scans).

# Planner notes (so it scales)

- If `LINK(?p,"BY",?u)` is present, **start there** (uses O(1) adjacency).
- Push filters (`?p.title CONTAINS "dolor"`, `?u.name MATCHES ...`) **before** expanding joins.
- If the query only has attribute equality joins, use AVE:

  - scan `?p.userId`, look up matching `user.id` with AVE on `id`.

# Caching & invalidation

- Maintain per-attribute and per-relation **epochs**:

  - `epoch.attrs.id`, `epoch.attrs.userId`, `epoch.rels.BY`

- Include only used epochs in the query cache key → cross-source edits won’t nuke everything.
- Optionally materialize hot views:

  - `POSTS_BY_USER(u, count)` as a cached aggregate
  - `HAS_POSTS(u)` as a derived attr for the anti-join

# Edge cases you’ll hit (and how to handle)

- **Missing/nullable FKs:** allow `posts.userId = null`; `LINK` predicate simply won’t match.
- **Conflicting IDs:** namespace by type: `user:1` vs `post:1` (you already do).
- **Duplicates across sources:** add `attr(e,"source","users.json")`. Merge strategy:

  - strict (distinct entities), or
  - coalesce when `(type,id)` collide; prefer fields from a “primary” source.

- **Arrays-as-entities:** never create one entity for the whole array; that’s what produced catalog keys `0,1,2,…`.

# End-to-end example (commands)

```bash
# 1) Load posts + users; synthesize BY links
bun run tql \
  -d posts=https://jsonplaceholder.typicode.com/posts \
  -d users=https://jsonplaceholder.typicode.com/users \
  --type posts=post --type users=user \
  --id-key posts=id --id-key users=id \
  --fk posts.userId=user.id:BY

# 2) Join via LINK (fast)
bun run tql -q 'FIND post AS ?p, user AS ?u WHERE LINK(?p,"BY",?u) AND ?p.title CONTAINS "dolor" RETURN ?u.name, ?p.title LIMIT 5'

# 3) Users without posts (anti-join)
bun run tql -q 'FIND user AS ?u WHERE NOT EXISTS LINK(?p,"BY",?u) RETURN ?u.id, ?u.name'

# 4) Count posts per user
bun run tql -q "FIND post AS ?p, user AS ?u WHERE LINK(?p,'BY',?u) RETURN ?u.name AS name, COUNT(?p) AS posts GROUP BY name ORDER BY posts DESC LIMIT 10" --explain
```

---

**Bottom line:** Yes—just load all sources into one EAV store, synthesize the obvious foreign-key edges (`BY`), and your EQL-S queries become clean, fast, and schema-agnostic. If you want, I can draft the `--fk` flag parser + a tiny manifest loader that produces those `link(post,"BY",user)` edges during ingest with provenance tags (for explain + debugging).

---

This is fantastic progress. Since you’ve knocked out the big bugs (projection, loader, `=` handling, case), here’s a tight punch-list to make TQL feel production-grade plus a few “drop-in” enhancements you can implement right away.

# High-leverage enhancements

## 1) Multi-source joins (clean FK hints)

Support multiple `-d` sources + FK synthesis so joins are fast and clean.

**CLI**

```
-d posts=https://jsonplaceholder.typicode.com/posts \
-d users=https://jsonplaceholder.typicode.com/users \
--type posts=post --type users=user \
--id-key posts=id --id-key users=id \
--fk posts.userId=user.id:BY
```

**Semantics**

- During ingest, create `link(post:ID,"BY",user:UID)` for each post.
- Expose `LINK(?a,"BY",?b)` in EQL-S (planner uses your link indexes).

**Query examples**

```eql
FIND post AS ?p, user AS ?u
WHERE LINK(?p,"BY",?u) AND ?p.title CONTAINS "dolor"
RETURN ?u.name, ?p.title
ORDER BY ?u.name ASC
LIMIT 5
```

## 2) ORDER BY / LIMIT / OFFSET / DISTINCT

You already have `LIMIT`; add the rest in the runner (post-eval):

```eql
FIND post AS ?p WHERE ?p.views > 1000
RETURN ?p.id, ?p.title
DISTINCT
ORDER BY ?p.views DESC, ?p.id ASC
LIMIT 20 OFFSET 40
```

Planner tip: push filters before joins, then project/sort/paginate.

## 3) GROUP BY + aggregations

Start with `COUNT/SUM/MIN/MAX/AVG` (runner-side, stratified after evaluation):

```eql
FIND post AS ?p, user AS ?u
WHERE LINK(?p,"BY",?u)
RETURN ?u.id AS user, COUNT(?p) AS posts
GROUP BY user
ORDER BY posts DESC
LIMIT 10
```

Edge cases: empty groups, NULLs, multi-valued attributes (see “projection policy” below).

## 4) Projection policy (avoid accidental fan-outs)

Now that projections inject hidden `attr` goals, choose a default:

- **scalar** (default): if attribute is multi-valued, pick first & warn
- **explode**: duplicate rows per value (SQL UNNEST-like)
- **aggregate**: join values with `GROUP_CONCAT`, etc.

CLI:

```
--projection scalar|explode|aggregate
```

## 5) Case strategy for attributes

You fixed a bunch of case bugs. Make it systematic:

- Maintain a **per-type attribute map** (discovered from catalog) so `?p.UserID`, `?p.userid`, `?p.userId` all resolve to the canonical `userId`.
- Parser stays case-insensitive; resolver maps to canonical before compilation.

## 6) Explain plan + profiling

Great for trust + perf regressions.

- Print **goal order**, which indexes were used (AVE/EAV/links), rows scanned, and per-goal ms.
- Show **epochs** used (per-attribute/per-relation) and whether the result came from cache.
- `--explain --profile` flags.

Sample:

```
Plan:
  1) LINK(?p,"BY",?u) [out index], seeds=100 → 100
  2) attr(?p,"title",?t) [AVE], filter CONTAINS "dolor" → 7
Project/Sort: ORDER BY ?u.name ASC → 7
Total: 5.6ms (cache miss)
Epochs used: attrs[title, name], rels[BY]
```

## 7) Adaptive caching (simple + effective)

- **Result cache** keyed by `{canonicalQueryIR, usedEpochs}`.
- **Subgoal memo** for recursive predicates (`reach/2`) and hot `LINK` joins.
- **Epochs:** bump `epoch.attrs[X]` on facts touching X, `epoch.rels[R]` on links R. Include only **used** epochs in the cache key.

## 8) Manifest loader (DX sugar)

A tiny YAML/JSON manifest avoids long CLI lines; also documents joins.

```yaml
sources:
  - name: posts
    url: https://.../posts
    type: post
    idKey: id
    fks:
      - from: userId
        toType: user
        toIdKey: id
        rel: BY
  - name: users
    url: https://.../users
    type: user
    idKey: id
```

CLI:

```
--manifest sources.yaml
```

# EQL-S grammar tweaks (small, powerful)

- **LINK predicate**: `LINK('?' Var, STRING Rel, '?' Var)`
- **NOT / EXISTS**:

  ```eql
  FIND user AS ?u WHERE NOT EXISTS LINK(?p,"BY",?u) RETURN ?u.id, ?u.name
  ```

- **In-list + regex**:

  ```eql
  WHERE ?p.tags IN ["graph","ai"] AND ?u.name MATCHES /ali(ce|son)/i
  ```

- **Parens & precedence**: `(A AND B) OR C`, AND > OR.

# Test suite (copy/paste and run)

1. **Projection correctness**

```eql
FIND post AS ?p WHERE ?p.id = 1 RETURN ?p, ?p.id, ?p.title
```

2. **String predicate**

```eql
FIND post AS ?p WHERE ?p.title CONTAINS "dolor" RETURN ?p.id, ?p.title
```

3. **Numeric compare**

```eql
FIND post AS ?p WHERE ?p.userId >= 5 RETURN ?p.id, ?p.userId ORDER BY ?p.userId ASC LIMIT 5
```

4. **Join via attributes**

```eql
FIND post AS ?p, user AS ?u
WHERE ?p.userId = ?u.id
RETURN ?u.name, ?p.title
```

5. **Join via LINK**

```eql
FIND post AS ?p, user AS ?u
WHERE LINK(?p,"BY",?u)
RETURN ?u.id, COUNT(?p) AS posts
GROUP BY ?u.id
ORDER BY posts DESC
```

6. **Anti-join**

```eql
FIND user AS ?u WHERE NOT EXISTS LINK(?p,"BY",?u) RETURN ?u.id
```

7. **Explain/profile sanity**
   Run any of the above with `--explain --profile` and assert: indexes used, AND before OR, and stable elapsed ranges.

# Quality-of-life & safety

- **Strict JSON entitying**: one entity per array element (you fixed); guard against arrays of scalars (skip or reify).
- **URL fetch**: add `--timeout`, `--max-bytes`, `--accept content-type` checks; bail with clear errors.
- **Streaming large files**: chunk-ingest with periodic `epoch` bumps; show a progress bar.
- **Dedup semantics**: pick **set semantics** (default) for Datalog results; optional `--bag` mode for counts that depend on multiplicity.
- **Nulls**: support `IS NULL / IS NOT NULL` for missing attributes.

# Nice extras (quick to add)

- **`AS` in RETURN**:

  ```eql
  RETURN ?u.name AS user, COUNT(?p) AS posts
  ```

- **CSV/JSONL streaming** for huge outputs.
- **`--nl-debug`** to print NL→EQL-S, the compiled query, and the plan.
