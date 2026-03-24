# TQL Server Embedded Scheduler - Implementation Plan

## Overview

Add a lightweight cron-like scheduler directly to the TQL HTTP server, running as a background task within the existing sprite service.

## Architecture

### Job Storage (SQLite)

```sql
CREATE TABLE scheduler_jobs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  schedule TEXT NOT NULL,  -- cron-like: "*/5 * * * *" or "interval:60000"
  handler TEXT NOT NULL,  -- "workflow:my-workflow.yml" or "query:FIND..."
  enabled INTEGER DEFAULT 1,
  last_run TEXT,
  next_run TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE scheduler_runs (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT,  -- "running", "success", "failed"
  result TEXT,
  error TEXT,
  FOREIGN KEY (job_id) REFERENCES scheduler_jobs(id)
);
```

### Schedule Format

Support two modes:

1. **Cron syntax**: `"0 * * * *"` (standard 5-field cron)
2. **Interval**: `"interval:3600000"` (milliseconds)

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/scheduler/jobs` | List all jobs |
| POST | `/scheduler/jobs` | Create a job |
| GET | `/scheduler/jobs/:id` | Get job details |
| PUT | `/scheduler/jobs/:id` | Update job |
| DELETE | `/scheduler/jobs/:id` | Delete job |
| POST | `/scheduler/jobs/:id/run` | Trigger immediate run |
| GET | `/scheduler/jobs/:id/runs` | Get job run history |
| GET | `/scheduler/runs` | List recent runs |

### Scheduler Loop

- Runs every 1 second
- Queries jobs where `next_run <= now()` and `enabled = 1`
- For each due job:
  1. Create run record (status: "running")
  2. Execute handler (async, non-blocking)
  3. Update run record on completion
  4. Calculate and update `next_run`
- Uses `setInterval` in Node/Bun

### Job Handlers

Two types initially:

1. **Workflow**: Execute a workflow file
2. **Query**: Execute an EQL-S query and optionally write results

Extensible for future handlers (webhook, etc.)

### Concurrency

- One scheduler loop (single-threaded check)
- Job execution is async but serialized per-job (no parallel runs of same job)
- Use mutex/lock per job ID to prevent overlap

### Error Handling

- Failed jobs logged to `scheduler_runs` with error message
- Configurable retry (max_retries on job)
- Alert endpoint: `POST /webhook` on failure (optional)

## File Changes

- `src/cli/server.ts` - Add scheduler class, endpoints, middleware
- `src/scheduler/` (new directory)
  - `scheduler.ts` - Core scheduler loop
  - `job-store.ts` - SQLite job persistence
  - `handlers/` - Job handler implementations
  - `cron.ts` - Cron parser
- `docs/SCHEDULER.md` - User documentation

## Implementation Order

1. Job storage layer (SQLite schema + CRUD)
2. Scheduler loop (core tick mechanism)
3. Cron parser
4. Basic job handlers (workflow, query)
5. API endpoints
6. Run history & logging
7. Error handling & retries
8. Documentation
