# Kernel Module

The kernel module is the composition root for Trellis runtime behavior. It combines storage, query execution, persistence hooks, middleware, workspace bootstrapping, and interface-only AI/sync boundaries.

## Public Entry Points

- `q/kernel`
- `q/kernel/middleware`
- `q/kernel/security`
- `q/kernel/schema`
- `q/kernel/logic`
- `q/kernel/operations`
- `q/kernel/workspace`
- `q/kernel/backend`
- `q/kernel/sqlite`

## Authoritative Files

- `trellis-kernel.ts`
- `middleware.ts`
- `workspace.ts`
- `ai-interop.ts`
- `sync.ts`

## Invariants

- `TrellisKernel` is the main composition root for kernel behavior.
- Middleware contracts must remain async-safe.
- `ai-interop.ts` defines interfaces only; provider-specific SDK dependencies belong outside the kernel contract.
- Workspace configuration shape is owned by `workspace.ts`.
- Sync abstractions should stay decoupled from core query and store behavior.

## Verify Changes

- `bun run typecheck`
- `bun run test`
