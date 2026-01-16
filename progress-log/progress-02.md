# Progress Log - 02

**Date**: 2026-01-16
**Phase**: 2 - Backend Core (Convex)
**Task**: 2.1 - Schema Definition
**Branch**: `phase-2/backend-core-convex`

## Summary

Defined the complete Convex database schema for Tijori, including tables for users, projects, environments, variables, and shared secrets.

## Schema Highlights

### Tables Defined
- **`users`**: Stores authenticated user profiles (`tokenIdentifier`, `email`, `name`, `image`).
- **`projects`**: Top-level entity containing project metadata and security constants (`encryptedPasscode`, `masterKeyHash`, `passcodeSalt`, `iv`, `authTag`).
- **`projectMembers`**: Junction table for Role-Based Access Control (RBAC) with `owner`, `admin`, and `member` roles.
- **`environments`**: Logical groupings of variables (e.g., Development, Production).
- **`variables`**: Stores the actual encrypted secrets with their respective IVs and authentication tags.
- **`sharedSecrets`**: Zero-knowledge storage for shared magic links.

### Indexes Added
- Optimized lookups for `ownerId`, `projectId`, `userId`, and `environmentId`.
- Unique-style lookup for `tokenIdentifier` on `users`.
- Compound index `by_project_user` for efficient member verification.
- Expiry-based index for `sharedSecrets`.

## Verification
- ✅ `bunx convex dev --once` successfully pushed the schema.
- ✅ Table indexes created in the local Convex deployment.
- ✅ Generated types updated in `convex/_generated`.

## Next Steps

- **Task 2.2**: Authentication Setup (Clerk/Convex Auth integration).
- **Task 2.3**: Project Management Functions (Mutations/Queries).

---

*Logged by Antigravity Agent*
