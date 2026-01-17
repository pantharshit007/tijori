# Learning Log

## 2026-01-16 - Phase 1, Task 1.1

### Migration Approach
When migrating from one stack to another (Next.js → TanStack Start, Supabase → Convex):
1.  **Clean thoroughly first** - Don't try to reuse too much. Old configs create conflicts.
2.  **Keep only truly reusable logic** - Crypto utilities, pure business logic. Framework-specific code should be rewritten.
3.  **Strip `package.json` aggressively** - Better to re-add dependencies than have ghost deps causing issues.

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

## 2026-01-16 - Phase 2, Task 2.3 & 2.4

### Backend Access Control in Convex
- **`ctx.auth.getUserIdentity()`**: This is the source of truth for auth. Always link it to your `users` table via `tokenIdentifier`.
- **RBAC Checks**: Since Convex doesn't have RLS (it has simplified "Entitlements" in some modes but usually you do it in handlers), manually verifying the `projectMembers` junction table is the standard way to enforce security.
- **Shared Helpers**: Creating a small helper function like `checkProjectAccess` inside your mutation/query files keeps the code dry and secure.
- **Atomic Operations**: Convex mutations are atomic. When creating a project, creating the `projectMembers` entrance and the default `Development` environment in the same mutation ensures data consistency.
