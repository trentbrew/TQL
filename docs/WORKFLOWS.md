# TQL Workflows

This document explains the current capabilities of the TQL workflow runtime and how to take advantage of the latest improvements.

## Step dependencies
- `needs` always refer to step identifiers. The engine now maps those identifiers back to the dataset emitted by each step, so query and output runners automatically pull in the correct data.
- Use the optional `from` field on query steps when you want to target a specific named dataset. Otherwise, every dependency listed in `needs` is loaded into the query's EAV store.
- Map-mode HTTP sources resolve their `mapFrom` reference through the same lookup, so you can safely use either the step id or the dataset name when iterating.

## Output handling
- Output steps now read from their declared dependencies instead of the most recent dataset in memory. When multiple dependencies are present, the workflow uses the last one in the list; keep the desired dataset last for clarity.
- The runner surfaces friendly log lines showing which dataset and row count were written.

## Caching
- Cache keys include the normalized step specification plus a hash of the datasets that have been materialised so far. Because dependency resolution is deterministic, cache hits remain stable across runs.

## CLI usage
```
tql workflow run examples/workflows/webfonts-serifs.yml --dry --limit 10 --log pretty
```
- Add `--var KEY=value` to pass template variables used in URLs or headers.
- Use `--cache read` to reuse previously materialised datasets when iterating on downstream steps.
