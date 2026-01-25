# AGENTS.md - Tijori Codebase Guide

> This document is for agentic coding assistants operating in the Tijori codebase.

## Project Overview

**Tijori** (Hindi for "vault/safe") is a secure environment variables manager built with:

- **Frontend**: TanStack Start (React + Router + SSR)
- **Backend**: Convex (Realtime database & backend functions)
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Authentication**: Clerk
- **Encryption**: Web Crypto API (client-side only)
- **Validation**: Zod
- **Runtime**: Bun

**Core Security Principle**: The server (Convex) **never** sees plaintext secrets. All encryption/decryption happens client-side in the browser.

---

## Build/Lint/Test Commands

| Command | Description |
|---------|-------------|
| `bun install` | Install dependencies |
| `bun run dev` | Start Vite dev server (frontend) |
| `bun cvx:dev` | Start Convex dev server (backend) |
| `bun test` | Run all tests |
| `bun test <file>` | Run a single test file, e.g., `bun test test/crypto.test.ts` |
| `bun test --watch` | Run tests in watch mode |
| `bun run lint` | Run ESLint |
| `bun run lint:fix` | Fix ESLint errors |
| `bun run format` | Run Prettier |
| `bun run check` | Run Prettier + ESLint together |
| `bun run tsc` | TypeScript type-checking (no emit) |
| `bun run build` | Production build |
| `bun cvx:deploy` | Deploy Convex to production |

### Running a Single Test

```bash
bun test test/crypto.test.ts              # Run single file
bun test --grep "hash"                     # Run tests matching pattern
bun test test/crypto.test.ts --watch       # Watch mode for single file
```

### Development Workflow

Run both servers in parallel:

```bash
bun run dev       # Terminal 1 - Frontend on http://localhost:3000
bun cvx:dev       # Terminal 2 - Convex backend
```

---

## Code Style Guidelines

### TypeScript & Types

- **Strict mode enabled** - No implicit any, strict null checks
- Use `v.*` validators in Convex schema (`v.string()`, `v.id("table")`, etc.)
- Define shared types in `src/lib/types.ts`
- Use `Id<"tableName">` for Convex document IDs
- Prefer explicit return types for exported functions

```typescript
// ✅ Good
export async function deriveKey(passcode: string, salt: string): Promise<CryptoKey> {}

// ❌ Avoid
export async function deriveKey(passcode, salt) {}
```

### Imports

- Use `@/` path alias for src imports: `import { Button } from "@/components/ui/button"`
- Group imports: external packages → internal modules → relative imports
- Use `import type` for type-only imports

```typescript
// External
import { useState, useCallback } from "react";
import { v } from "convex/values";

// Internal (path alias)
import { Button } from "@/components/ui/button";
import { CRYPTO } from "@/lib/constants";

// Relative
import type { Variable } from "../../convex/_generated/dataModel";
```

### Formatting (Prettier)

- **Double quotes** for strings
- **Trailing commas**: ES5 style
- **Tab width**: 2 spaces
- **Semicolons**: Always
- **Print width**: 100 characters

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `VariableEditRow.tsx` |
| Hooks | camelCase with `use` prefix | `useTheme.ts` |
| Utilities | camelCase | `deriveKey`, `arrayBufferToBase64` |
| Constants | SCREAMING_SNAKE_CASE | `CRYPTO`, `SHARE_EXPIRY_OPTIONS` |
| Types/Interfaces | PascalCase | `Environment`, `SharedSecret` |
| Convex functions | camelCase | `listMembers`, `updateProject` |
| Files | kebab-case or PascalCase for components | `key-store.ts`, `ShareDialog.tsx` |

### Component Structure

```tsx
// 1. Imports
import { useState } from "react";
import { Button } from "@/components/ui/button";

// 2. Types/Interfaces
export interface ComponentProps {
  name: string;
  onSave?: () => void;
}

// 3. Component (named export preferred)
export function ComponentName({ name, onSave }: ComponentProps) {
  // Hooks first
  const [state, setState] = useState("");
  
  // Event handlers
  const handleClick = useCallback(() => {}, []);
  
  // Render
  return <div>...</div>;
}
```

### Error Handling

- Throw descriptive errors in Convex mutations: `throw new Error("Access denied: Only owners can delete projects")`
- Use try/catch for crypto operations (they can fail)
- Always check for `null`/`undefined` before proceeding

```typescript
// Convex pattern
const user = await ctx.db.get(userId);
if (!user) {
  throw new Error("User not found");
}
```

### Convex Conventions

- Always authenticate: Check `ctx.auth.getUserIdentity()` in mutations/queries
- Validate ownership: Verify resources belong to the requesting user
- Use compound indexes for permission checks: `by_project_user`
- Never log or expose decrypted secrets

```typescript
// ✅ Good - Defense in depth
const environment = await ctx.db.get(args.environmentId);
if (!environment || environment.projectId !== args.projectId) {
  throw new Error("Mismatched resources");
}
```

### Crypto Best Practices

- Generate fresh salt/IV for each encryption operation
- Use `CRYPTO` constants from `src/lib/constants.ts`
- Never store plaintext secrets - only encrypted values with IV and authTag
- Clear keys from memory on logout/navigation

---

## Project Structure

```
tijori/
├── convex/                 # Backend (Convex functions & schema)
│   ├── _generated/         # Auto-generated types (DO NOT EDIT)
│   ├── schema.ts           # Database schema definition
│   ├── projects.ts         # Project mutations/queries
│   ├── variables.ts        # Variable mutations/queries
│   └── ...
├── src/
│   ├── components/         # React components
│   │   ├── ui/             # shadcn/ui primitives (DO NOT EDIT)
│   │   └── ...             # Feature components
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utilities & constants
│   │   ├── crypto.ts       # Encryption/decryption (CRITICAL)
│   │   ├── constants.ts    # App-wide constants
│   │   ├── types.ts        # Shared TypeScript types
│   │   └── key-store.ts    # In-memory key storage
│   ├── routes/             # TanStack Router pages
│   └── styles.css          # Global styles (Tailwind v4)
├── test/                   # Test files
├── init.md                 # Implementation plan & architecture
├── learning.md             # Technical learnings & decisions
└── TODO.md                 # Pending tasks
```

---

## Critical Files

| File | Importance | Notes |
|------|------------|-------|
| `src/lib/crypto.ts` | 🔴 CRITICAL | All encryption logic. Changes require security review. |
| `convex/schema.ts` | 🔴 CRITICAL | Database schema. Migrations needed for changes. |
| `src/lib/key-store.ts` | 🟠 HIGH | In-memory key storage. Security-sensitive. |
| `init.md` | 🟢 REFERENCE | Architecture & implementation plan. |
| `learning.md` | 🟢 REFERENCE | Design decisions & gotchas. |

---

## Key Architectural Decisions

1. **User-level Master Key**: Single master key per user (stored as hash), not per-project.
2. **Passcode per Project**: 6-digit passcode encrypts environment variables.
3. **Zero-Knowledge Sharing**: Shared secrets use nested encryption (ShareKey → Passcode → ProjectKey).
4. **In-Memory Keys**: Derived `CryptoKey` objects live in memory only, cleared on reload.
5. **RBAC**: Owner > Admin > Member. Permissions enforced on both UI and backend.

---

## Common Patterns

### Authentication Check (Convex)

```typescript
async function getUserId(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  
  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
  if (!user) throw new Error("User not found");
  
  return user._id;
}
```

### Permission Check (Convex)

```typescript
const membership = await ctx.db
  .query("projectMembers")
  .withIndex("by_project_user", (q) => q.eq("projectId", args.projectId).eq("userId", userId))
  .unique();

if (!membership || membership.role === "member") {
  throw new Error("Access denied");
}
```

### Encryption Pattern (Client-side)

```typescript
import { deriveKey, encrypt, decrypt, generateSalt } from "@/lib/crypto";

// Encrypt
const key = await deriveKey(passcode, salt);
const { encryptedValue, iv, authTag } = await encrypt(plaintext, key);

// Decrypt
const plaintext = await decrypt(encryptedValue, iv, authTag, key);
```

---

## PR Guidelines

1. Bump version in `package.json` for every PR.
2. Update `progress-log/` with completed tasks.
3. Update `learning.md` with new insights or decisions.
4. Run `bun run check` before committing.
5. Never commit plaintext secrets or API keys.
