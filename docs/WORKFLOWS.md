# TQL Workflows

This document explains the current capabilities of the TQL workflow runtime and how to take advantage of the latest improvements.

## Step dependencies

- **`needs` = step IDs** (not dataset names). The engine now maps those identifiers back to the dataset emitted by each step, so query and output runners automatically pull in the correct data.
- Use the optional `from` field on query steps when you want to target a specific named dataset. Otherwise, every dependency listed in `needs` is loaded into the query's EAV store.
- Map-mode HTTP sources resolve their `mapFrom` reference through the same lookup, so you can safely use either the step id or the dataset name when iterating.

## Common Mistakes

### ❌ Wrong `needs` references

```yaml
steps:
  - id: fetch_posts
    type: source
    source:
      kind: http
      url: 'https://api.example.com/posts'
      mode: batch
    out: posts

  - id: filter_posts
    type: query
    needs: [posts] # ❌ Wrong! Should be [fetch_posts]
    eqls: 'FIND item AS ?p RETURN ?p'
    out: filtered_posts
```

**Error**: `Unknown dependency "posts" in step "filter_posts". Did you mean step id "fetch_posts"?`

### ❌ Missing `out` field

```yaml
steps:
  - id: fetch_data
    type: source
    source:
      kind: http
      url: 'https://api.example.com/data'
      mode: batch
    # ❌ Missing out: field

  - id: process_data
    type: query
    needs: [fetch_data] # ❌ fetch_data doesn't produce output
    eqls: 'FIND item AS ?x RETURN ?x'
    out: processed_data
```

### ❌ `map` without `mapFrom`

```yaml
steps:
  - id: fetch_users
    type: source
    source:
      kind: http
      url: 'https://api.example.com/users'
      mode: batch
    out: users

  - id: fetch_posts
    type: source
    source:
      kind: http
      url: 'https://api.example.com/posts/{{row.id}}'
      mode: map
      # ❌ Missing mapFrom: users
    out: posts
```

## Output handling

- Output steps now read from their declared dependencies instead of the most recent dataset in memory. When multiple dependencies are present, the workflow uses the last one in the list; keep the desired dataset last for clarity.
- The runner surfaces friendly log lines showing which dataset and row count were written.

## Caching

- Cache keys include the normalized step specification plus a hash of the datasets that have been materialised so far. Because dependency resolution is deterministic, cache hits remain stable across runs.

## CLI usage

**Note:** You can use `tql wf` as a shortcut for `tql workflow`.

### Running workflows

```bash
tql workflow run examples/workflows/webfonts-serifs.yml --dry --limit 10 --log pretty
```

**Options:**

- `--dry`: Dry run mode (limit data processing)
- `--watch`: Watch file for changes and re-run
- `--limit <number>`: Limit rows per step (default: 50)
- `--var <key=value...>`: Set template variables (can be used multiple times)
- `--cache <mode>`: Cache mode: read|write|off (default: write)
- `--log <format>`: Log format: pretty|json (default: pretty)
- `--no-color`: Disable colored output
- `--out <dir>`: Output directory (default: ./out)

### Planning workflows

```bash
# Show execution plan
tql workflow plan examples/workflows/simple-demo.yml

# Generate Graphviz DOT format
tql workflow plan examples/workflows/simple-demo.yml --dot

# Generate Mermaid format
tql workflow plan examples/workflows/simple-demo.yml --mermaid

# Generate JSON format for tooling
tql workflow plan examples/workflows/simple-demo.yml --json
```

**Options:**

- `--var <key=value...>`: Set template variables (can be used multiple times)
- `--dot`: Output as Graphviz DOT format
- `--mermaid`: Output as Mermaid format
- `--json`: Output as JSON format

### Template variables

```bash
# Pass variables for URL interpolation
tql workflow run workflow.yml --var API_KEY=abc123 --var LIMIT=100

# Use in workflow YAML
steps:
  - id: fetch_data
    type: source
    source:
      kind: http
      url: "https://api.example.com/data?key={{var.API_KEY}}&limit={{var.LIMIT}}"
      mode: batch
    out: data
```

## Troubleshooting

### Cache Issues

- **Cache not working**: Check `--cache write` on first run, then `--cache read` on subsequent runs
- **Cache key correlation**: Use `--log json` to see cache keys, or look for `[abc12345]` in pretty logs

### HTTP Limits

- **Large responses**: Default 10MB limit. Set `TQL_HTTP_MAX_BYTES=50MB` environment variable to increase
- **Non-JSON responses**: Check content-type header and first 256 bytes of response body in error message

### Dry Run Caps

- **Row limits**: `--limit N` caps all steps to N rows
- **Map mode caps**: First 20 rows of `mapFrom` dataset processed in dry mode
- **Memory usage**: Large datasets may be truncated; use `--limit` to control

### Common Error Messages

- **"Unknown dependency"**: Use step IDs in `needs`, not dataset names
- **"Circular dependency"**: Shows minimal cycle like `a → b → a`
- **"Missing mapFrom"**: Map mode sources require `mapFrom: dataset_name`
- **"Duplicate output"**: Each step's `out` field must be unique

### Telemetry

- **Opt-in analytics**: Set `TQL_TELEMETRY=true` to help improve TQL
- **No PII collected**: Only command types, durations, and success/failure
- **Disable**: Set `TQL_TELEMETRY=false` or unset the environment variable
