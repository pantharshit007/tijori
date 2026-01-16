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
