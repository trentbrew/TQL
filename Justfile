# TQL Justfile - Convenient commands for TQL development and usage

# Default recipe - show available commands
default:
    @just --list

# Run TQL CLI with any arguments
tql *args:
    bun run src/cli/tql.ts {{args}}

# Development commands
dev:
    bun run src/cli/tql.ts --help

# Test commands
test:
    pnpm install && pnpm test

test-watch:
    pnpm install && pnpm test:watch

test-workflow:
    pnpm install && pnpm test:workflow

# Build and typecheck
build:
    pnpm build

typecheck:
    pnpm typecheck

# Demo commands
demo-eav:
    pnpm demo:eav

demo-graph:
    pnpm demo:graph

demo-tql:
    pnpm demo:tql

demo-products:
    pnpm demo:products

demo-real-data:
    pnpm demo:real-data

demos:
    pnpm demos

# Workflow shortcuts
wf-run file *args:
    bun run src/cli/tql.ts workflow run {{file}} {{args}}

wf-plan file *args:
    bun run src/cli/tql.ts workflow plan {{file}} {{args}}

# Quick workflow examples
wf-simple:
    bun run src/cli/tql.ts wf run examples/workflows/simple-demo.yml --dry

wf-webfonts:
    bun run src/cli/tql.ts wf run examples/workflows/webfonts-serifs.yml --dry --limit 5

# Clean up
clean:
    rm -rf dist out node_modules/.cache

# Install dependencies
install:
    pnpm install

# Show version
version:
    bun run src/cli/tql.ts --version
