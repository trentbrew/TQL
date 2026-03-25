# TQL Conventions

This repository favors conventions that reduce search cost and make module boundaries explicit.

## Module Rules

- Keep core kernel behavior in `src/store`, `src/query`, `src/persist`, and `src/kernel`.
- Treat `src/ai`, `src/graph`, `src/workflows`, `src/cli`, and analytics/telemetry code as explicit secondary surfaces.
- Prefer adding small focused files within an existing module over growing a central file indefinitely.
- Prefer flat module layouts with descriptive filenames over deep nesting.

## Public Surface Rules

- The root package surface should stay kernel-first.
- `q/kernel` should resolve to a stable module surface, not a single implementation file.
- Optional capabilities should be imported through explicit subpaths.
- When changing `package.json` exports or `src/index.ts`, treat the change as high risk and verify broadly.

## Contracts Before Implementations

Before changing implementation details, check whether the change should start in one of these contract files:

- `src/kernel/middleware.ts`
- `src/kernel/workspace.ts`
- `src/kernel/ai-interop.ts`
- `src/persist/backend.ts`
- `src/query/index.ts`

If the boundary changes, update the contract first and then update consumers.

## File Patterns

For a module that grows beyond a few focused files, prefer this pattern:

- `index.ts` for the local public surface
- `types.ts` for stable shared types when needed
- small implementation files grouped by responsibility
- `README.md` describing purpose, entrypoints, invariants, and verification

## Import Rules

- Import through the closest stable local surface when it keeps dependencies obvious.
- Avoid creating hidden cross-module coupling from optional subsystems back into core.
- Keep provider-specific dependencies outside kernel contracts whenever possible.

## Tests and Verification

- Use the smallest useful verification command first.
- Keep cross-boundary tests in `test/`.
- When touching exports, contracts, or shared types, run both `bun run typecheck` and `bun run test`.

## Documentation Rules

- Root docs describe repo-wide boundaries and conventions.
- Module READMEs describe local purpose and safe extension points.
- When a README and an older design doc differ, prefer the newer boundary docs for current implementation guidance and update stale docs when practical.
