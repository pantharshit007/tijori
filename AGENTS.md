# AGENTS.md - Tijori Guide

This file is for coding agents working in the Tijori repository. Keep changes aligned with the current architecture and security model.

## Project

Tijori is a zero-knowledge environment variable manager built with TanStack Start, React, Convex, Clerk, Tailwind CSS v4, Nitro, and Bun.

Start with:

- `docs/ARCHITECTURE.md`
- `docs/SECURITY.md`
- `docs/PRIVACY.md`

## Commands

- `bun run dev`: frontend dev server
- `bun cvx:dev`: Convex dev server
- `bun test`: test suite
- `bun run tsc`: type-checking
- `bun run check`: Prettier + ESLint
- `bun run build`: production build

## Repo-Specific Invariants

- Secret values are encrypted and decrypted only in the browser.
- Project passcodes are exactly 6 digits and are verified server-side with `projects.passcodeHash`.
- The user master key is never stored; only `users.masterKeyHash` and `users.masterKeySalt` are persisted.
- Project names, environment names, variable names, descriptions, roles, and timestamps are not encrypted. Do not treat the backend as blind to metadata.
- Shared secrets use a random ShareKey encrypted by a share passcode. The share passcode is also encrypted with the unlocked project key so creators can recover it later.
- Derived project keys live only in `src/lib/key-store.ts` and must be cleared on lock, logout, deactivation, and deletion flows.

## Sensitive Files

- `src/lib/crypto.ts`
- `src/lib/key-store.ts`
- `convex/schema.ts`
- `convex/projects.ts`
- `convex/sharedSecrets.ts`
- `server/middleware/security-headers.ts`

## Coding Notes

- Use `@/` imports for `src` modules.
- Use `import type` for type-only imports.
- Keep Convex functions authenticated and authorization-checked.
- Use `v.*` validators for all Convex arguments.
- Do not log secrets, passcodes, keys, or decrypted payloads.
- Avoid editing generated files under `convex/_generated/`.
- Avoid editing `src/components/ui/` unless the task requires it.
- If you use `Button` from `@/components/ui/button`, include a `title` attribute.

## When Shipping Changes

- Run the smallest relevant verification for the change.
- For non-trivial app changes, prefer `bun run check` plus targeted tests.
- If asked to prepare a PR, also bump `package.json` version and update `docs/learning.md` if applicable.
