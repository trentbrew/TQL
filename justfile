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

# TUI (Ratatui) commands
tui-build:
    cd tql-tui && cargo build

tui-build-release:
    cd tql-tui && cargo build --release

tui-graph:
    cd tql-tui && cargo run -- graph

tui-query:
    cd tql-tui && cargo run -- query

tui-dashboard:
    cd tql-tui && cargo run -- dashboard

tui-install:
    cd tql-tui && cargo install --path .

tui-test:
    cd tql-tui && cargo test

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

# HTTP server commands
serve port="8080" *args:
    bun run src/cli/server.ts {{port}} {{args}}

serve-db db port="8080":
    bun run src/cli/server.ts {{port}} --db={{db}}

# Deployment
# Requires: ADMIN_KEY and DATA_DIR env vars (or a .env file sourced beforehand)
# Usage: just deploy
#        just deploy "feat: my change"   (custom commit message)
deploy msg="deploy: update tql server":
    #!/usr/bin/env bash
    set -euo pipefail

    # Load .env if it exists
    set -a && source .env 2>/dev/null || true && set +a

    # Validate required env vars
    : "${ADMIN_KEY:?ADMIN_KEY env var is required}"
    : "${DATA_DIR:?DATA_DIR env var is required}"

    echo "==> Running tests..."
    bun test --reporter=dot

    echo "==> Committing changes..."
    git add -A
    if git diff --cached --quiet; then
        echo "    (nothing to commit)"
    else
        git commit -m "{{msg}}"
    fi

    echo "==> Pushing to origin..."
    git push

    echo "==> Creating data directory..."
    mkdir -p "$DATA_DIR"

    echo "==> Redeploying sprite service..."
    sprite-env services delete tql-server 2>/dev/null && echo "    deleted old service" || echo "    (no existing service)"
    sprite-env services create tql-server \
        --cmd /home/sprite/tql/run-server.sh \
        --dir /home/sprite/tql \
        --http-port 8080 \
        --duration 5s

    echo ""
    echo "✓ Deployed. Sprite URL: $(sprite-env info | jq -r .sprite_url)"

# Deploy without running tests (faster, use with care)
deploy-fast msg="deploy: update tql server":
    #!/usr/bin/env bash
    set -euo pipefail

    : "${ADMIN_KEY:?ADMIN_KEY env var is required}"
    : "${DATA_DIR:?DATA_DIR env var is required}"

    echo "==> Committing changes..."
    git add -A
    if git diff --cached --quiet; then
        echo "    (nothing to commit)"
    else
        git commit -m "{{msg}}"
    fi

    echo "==> Pushing to origin..."
    git push

    echo "==> Creating data directory..."
    mkdir -p "$DATA_DIR"

    echo "==> Redeploying sprite service..."
    sprite-env services delete tql-server 2>/dev/null && echo "    deleted old service" || echo "    (no existing service)"
    sprite-env services create tql-server \
        --cmd /home/sprite/tql/run-server.sh \
        --dir /home/sprite/tql \
        --http-port 8080 \
        --duration 5s

    echo ""
    echo "✓ Deployed. Sprite URL: $(sprite-env info | jq -r .sprite_url)"

# Restart the running service without redeploying (picks up file changes in-place)
restart:
    sprite-env services stop tql-server
    sprite-env services start tql-server --duration 3s

# Show service status and logs
status:
    @sprite-env services get tql-server | jq .
    @echo ""
    @echo "Sprite URL: $(sprite-env info | jq -r .sprite_url)"

# NPM Publishing
# Usage: just publish
#        just publish "feat: add new feature"  (custom commit message)
publish msg="chore: release":
    #!/usr/bin/env bash
    set -euo pipefail

    echo "==> Running tests..."
    bun test --reporter=dot

    echo "==> Building..."
    rm -rf dist
    bun run build:all

    echo "==> Bumping version..."
    npm version patch --no-git-tag-version

    echo "==> Publishing to npm..."
    npm publish --access public

    echo "==> Committing and tagging..."
    VERSION=$(node -p "require('./package.json').version")
    git add -A
    git commit -m "{{msg }} v${VERSION}"
    git tag -a "v${VERSION}" -m "v${VERSION}"
    git push
    git push --tags

    echo ""
    echo "Published trellis@${VERSION}"
