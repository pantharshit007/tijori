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
