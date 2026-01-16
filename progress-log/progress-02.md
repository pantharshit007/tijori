# Progress Log - 02

**Date**: 2026-01-16
**Phase**: 2 - Backend Core (Convex)
**Branch**: `phase-2/backend-core-convex`

---

# Task 2.1: Schema Definition ✅

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

---

# Task 2.2: Authentication Setup ✅

**Date**: 2026-01-16

## Summary

Configured Clerk authentication for the Convex backend and implemented user profile syncing.

## Implementation Details

### 1. Clerk Configuration (`convex/auth.config.ts`)
- Configured a JWT provider for Clerk.
- Uses `CLERK_JWT_ISSUER_DOMAIN` for verification.
- `applicationID` set to `"convex"`.

### 2. User Syncing (`convex/users.ts`)
- **`store` mutation**: Upserts a user in the `users` table based on their `tokenIdentifier`. Matches name, email, and image.
- **`me` query**: Helper to fetch the current authenticated user's record from the DB.

## Requirements for Frontend
- The frontend must call `api.users.store` after successful Clerk login to ensure the user record exists in the database.

---

# Task 2.3: Project & Environment Management ✅

**Date**: 2026-01-16

## Summary

Implemented core backend logic for managing projects and environments in Convex, including authentication and access control.

## Implementation Details

### 1. Projects (`convex/projects.ts`)
- **`create` mutation**:
    - Creates a new project with security metadata (`masterKeyHash`, `encryptedPasscode`, etc.).
    - Automatically adds the creator as the `owner`.
    - Initializes a default "Development" environment for the project.
- **`list` query**: Returns all projects where the current user is a member, including their role.
- **`get` query**: Retrieves specific project details after verifying membership via the `projectMembers` table.

### 2. Environments (`convex/environments.ts`)
- **`list` query**: Lists all environments for a project (e.g., Development, Staging, Production).
- **`create` mutation**: Allows adding custom environments to a project.
- **Access Control**: All environment operations require membership in the parent project.

## Technical Notes
- Implemented a compound index `by_project_user` in `schema.ts` for efficient membership verification.
- Reusable access check patterns established using Convex's `ctx.auth.getUserIdentity()`.

---

# Task 2.4: Variable Management Functions ✅

**Date**: 2026-01-16

## Summary

Implemented backend logic for managing encrypted environment variables in Convex.

## Implementation Details

### Variables (`convex/variables.ts`)
- **`list` query**: Retrieves all variables for a specific environment.
- **`save` mutation**: Performs an upsert (create or update) based on the variable name within an environment. Stores `encryptedValue`, `iv`, and `authTag`.
- **`remove` mutation**: Deletes a secret from the database.

## Security & Verification
- **Environment-Level Access Control**: Each operation verifies project membership through the environment's parent project.
- ✅ Verified operations via localized test handlers (simulated access).

---

## Phase 2 Complete! 🎉

Backend core is ready:
- ✅ Task 2.1: Schema Definition
- ✅ Task 2.2: Authentication Setup
- ✅ Task 2.3: Project Management Functions
- ✅ Task 2.4: Variable Management Functions

## Next Steps
- **Phase 3**: Frontend Foundation & Crypto Utilities.

---

*Logged by Antigravity Agent*
