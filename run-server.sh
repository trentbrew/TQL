#!/usr/bin/env bash
set -a
source /home/sprite/tql/.env
set +a
exec bun run /home/sprite/tql/src/cli/server.ts
