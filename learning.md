# Learning Log

## 2026-01-16 - Phase 1, Task 1.1

### Migration Approach

When migrating from one stack to another (Next.js → TanStack Start, Supabase → Convex):

1. **Clean thoroughly first** - Don't try to reuse too much. Old configs create conflicts.
2. **Keep only truly reusable logic** - Crypto utilities, pure business logic. Framework-specific code should be rewritten.
3. **Strip `package.json` aggressively** - Better to re-add dependencies than have ghost deps causing issues.

### Files to Always Check

- `tsconfig.json` - Often has framework-specific plugins and includes.
- `eslint.config.js` - Framework-specific linting rules.
- Lockfiles (`bun.lock`, `package-lock.json`) - Best to regenerate after major changes.

---

## 2026-01-16 - Phase 1, Task 1.3

### Convex Local Development

- Convex supports **local-first development** without requiring an account.
- Running `convex dev` without logging in creates an `anonymous` deployment.
- The local backend runs at `http://127.0.0.1:3210`.
- A local dashboard is available at `http://127.0.0.1:6790`.

### Environment Variables

- `CONVEX_DEPLOYMENT` - Used by the CLI to identify the deployment.
- `VITE_CONVEX_URL` - The URL your frontend uses to connect (prefixed with `VITE_` for Vite).

### Future: Cloud Deployment

- Run `npx convex login` to authenticate and link to a cloud deployment.
- This will update `.env.local` with a cloud URL.

---

## 2026-01-16 - Phase 2, Task 2.1

### Convex Schema Design

- **No Explicit Unique Constraints**: Convex indexes are used for performance, but uniqueness must often be enforced at the application/logic level in mutations.
- **`v.id("table")`**: Always use this for foreign keys to ensure referential integrity and better typing.
- **Computed Creation Time**: All Convex tables automatically get a `_creationTime` and `_id`, so there's no need to define them in `schema.ts`.
- **Compound Indexes**: Extremely useful for junction tables like `projectMembers` to quickly check permissions (`projectId`, `userId`).

---

## 2026-01-18 - Phase 3

### Environment Variable Validation with @t3-oss/env-core

The project uses `@t3-oss/env-core` for type-safe environment variable validation:

- **`src/env.ts`**: Validates both client (`VITE_*`) and server-side env vars using Zod.
- **`src/env.server.ts`**: Server-only env vars for SSR/API routes.
- **Key benefit**: Runtime validation with TypeScript types, catches missing vars early.

### Convex Environment Variables (Critical!)

**Convex functions run in a separate runtime** - they don't have access to your Node.js `process.env` or Vite's `import.meta.env`.

To set environment variables for Convex:

```bash
# Set a variable in the Convex deployment
bunx convex env set CLERK_JWT_ISSUER_DOMAIN "https://your-instance.clerk.accounts.dev"

# List all variables
bunx convex env list
```

**Common mistake**: Trying to import from `src/` files into `convex/` files. The Convex runtime is isolated - only use `process.env` (which Convex provides from its own env var store).

### Clerk + Convex Integration

- Clerk authentication passes a JWT to Convex.
- Convex validates this JWT using the `CLERK_JWT_ISSUER_DOMAIN`.
- The `auth.config.ts` file must use `process.env.CLERK_JWT_ISSUER_DOMAIN` (Convex-provided).
- The JWT issuer domain is found in Clerk Dashboard → API Keys or JWT Templates.

### shadcn/ui with TanStack Start

- Use `bunx shadcn@latest init --template start` for proper TanStack Start configuration.
- Components are placed in `src/components/ui/`.
- The `cn()` utility is auto-generated in `src/lib/utils.ts`.
- Tailwind CSS v4 uses `@theme` and `@custom-variant` directives (IDE may show warnings but they're valid).

### ConvexProviderWithClerk Pattern

When integrating Convex with Clerk in React:

```tsx
<ClerkProvider>
  <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  </ConvexProviderWithClerk>
</ClerkProvider>
```

The order matters: Clerk must be outermost, then Convex (which uses Clerk's `useAuth`), then React Query.

### Client-Side Crypto State Management

- Derived encryption keys are held in React state (component-level or context).
- Keys are automatically wiped on page reload (browser behavior).
- For added security, consider clearing keys on route changes or after a timeout.

---

## Troubleshooting

### "Environment variable X is used in auth config file but its value was not set"

This error means Convex's runtime doesn't have the env var. Fix with:

```bash
bunx convex env set VARIABLE_NAME "value"
```

Note: The dashboard URL for anonymous deployments may 404 - use the CLI instead.

---

## 2026-01-18 - Master Key Architecture

### User-Level Master Key (Design Decision)

Originally, each project had its own master key. This was changed to a **single master key per user**:

**Old Design (per-project):**

- `projects.masterKeyHash` - Each project stores its own master key hash
- User must remember a different master key per project
- Poor UX for users with many projects

**New Design (per-user):**

- `users.masterKeyHash` + `users.masterKeySalt` - Single master key stored at user level
- Master key is set once in Settings
- All project passcodes are encrypted using the same master key
- Much better UX

### Flow:

1. User sets master key in **Settings** (one-time setup)
2. When creating a project, user enters:
   - **Passcode**: For daily use to encrypt/decrypt secrets
   - **Master Key**: To encrypt the passcode for recovery
3. The passcode is encrypted with a key derived from the master key
4. If user forgets passcode, they can recover it using the master key

### Important:

- Master key hash is stored, never the plaintext
- Changing the master key requires re-encrypting all project passcodes
- This is enforced: users cannot create projects without setting a master key first

---

## 2026-01-19 - Phase 4

### Zero-Knowledge Dashboard Management

We implemented a way for users to see the passcodes of the links they've shared without storing those passcodes in plaintext. This uses a **Nested Encryption** approach:

1. **The Shared Data**: Encrypted with a random `ShareKey`.
2. **The ShareKey**: Encrypted with the **User-Defined 6-Digit Passcode**.
3. **The 6-Digit Passcode**: Encrypted with the **Project Key** (which is derived from the project's own passcode).

**Result**:

- **Recipients** can decrypt the data using only the 6-digit passcode.
- **Creators** can see the 6-digit passcode in their dashboard, but ONLY if they have unlocked the project (derived the Project Key).
- **The DB/Server** never sees either the variables or the 6-digit passcode in plaintext.

### In-Memory Key Persistence (SPAs)

In a Single Page Application (SPA), we can use an in-memory singleton (like `keyStore.ts`) to persist sensitive `CryptoKey` objects across route navigations.

While using an in-memory singleton (e.g., `keyStore.ts`) ensures the key is not persisted to disk or browser storage, it does **not** protect against XSS: any JavaScript running in the page (malicious or otherwise) can read in‑memory keys. The security advantage is solely that the key's lifetime is limited to the page session and it is lost on reload, not that it prevents access by injected scripts.

- **Pros**: Key survives navigation between Dashboard, Projects, and Shared pages. No need to re-type the passcode every time you click a different environment.
- **Cons**: Key is lost on hard reload (F5).
- **Security**: Much safer than `localStorage` or `sessionStorage` because the key only lives in the JS heap and is never written to disk. However, in-memory keys are still readable by any script running in the app, so this only mitigates persistence risk—not script-level access.

### Key Rotation Cost Analysis

We learned to distinguish between **Master Key Rotation** and **Project Passcode Rotation**:

- **Master Key Rotation (Low Cost)**: Since the Master Key only encrypts the _Project Passcode_, rotating it only requires re-encrypting a few small strings in the `projects` table.
- **Project Passcode Rotation (High Cost)**: Since the Project Passcode is used to derive the Project Key which encrypts ALL variables and shared passcodes, rotating it requires a massive batch re-encryption job.
- **Decision**: Always warn users about the cost and consider making high-cost rotations a background or multi-step process.

### ID Ownership Validation (Defense in Depth)

When performing mutations that take multiple IDs (e.g. `projectId` and `environmentId`), always verify that the sub-resource actually belongs to the parent-resource:

```typescript
const environment = await ctx.db.get(args.environmentId);
if (!environment || environment.projectId !== args.projectId) {
  throw new Error("Mismatched resources");
}
```

This prevents **data corruption** and **cross-linking vulnerabilities** where a user might try to associate an environment they don't own with a project they do.
