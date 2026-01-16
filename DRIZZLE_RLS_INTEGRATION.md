# Drizzle ORM RLS Integration Guide

## Overview

**Yes, you CAN define RLS policies directly in your Drizzle schema!** 🎉

Drizzle ORM added native support for PostgreSQL Row-Level Security in version **v0.36.0** (October 2024). This allows you to define policies declaratively alongside your table definitions instead of maintaining separate SQL files.

## Key Features

### 1. **Enable RLS on Tables**

There are two ways to enable RLS:

#### Option A: Using `.withRLS()` (v1.0.0-beta.1+)
```typescript
import { pgTable } from 'drizzle-orm/pg-core';

export const users = pgTable.withRLS('users', {
  id: uuid().primaryKey().defaultRandom(),
  email: varchar({ length: 255 }).notNull(),
});
```

#### Option B: Add Policies (RLS auto-enabled)
When you add a policy to a table, RLS is automatically enabled. No need to explicitly call `.enableRLS()` or `.withRLS()`.

### 2. **Define Policies in Schema**

Policies are defined as the second argument to `pgTable`:

```typescript
import { sql } from 'drizzle-orm';
import { pgTable, pgPolicy, uuid, varchar } from 'drizzle-orm/pg-core';
import { authenticatedRole } from 'drizzle-orm/supabase';

export const users = pgTable('users', {
  id: uuid().primaryKey().defaultRandom(),
  email: varchar({ length: 255 }).notNull(),
}, (table) => [
  pgPolicy('users_select_policy', {
    for: 'select',
    to: authenticatedRole,
    using: sql`auth.uid() = ${table.id}`,
  }),
  pgPolicy('users_insert_policy', {
    for: 'insert',
    to: authenticatedRole,
    withCheck: sql`auth.uid() = ${table.id}`,
  }),
]);
```

### 3. **Supabase Integration**

Drizzle provides predefined Supabase roles and helpers via `drizzle-orm/supabase`:

```typescript
import { 
  authenticatedRole, 
  anonRole, 
  serviceRole,
  authUsers,  // Reference to auth.users table
  authUid,    // Helper: sql`(select auth.uid())`
} from 'drizzle-orm/supabase';
```

Available Supabase roles:
- `authenticatedRole` - Logged-in users
- `anonRole` - Anonymous/unauthenticated users  
- `serviceRole` - Service role (bypass RLS)
- `postgresRole` - Postgres role
- `supabaseAuthAdminRole` - Auth admin role

## Policy Options

```typescript
pgPolicy('policy_name', {
  as: 'permissive' | 'restrictive',  // Default: 'permissive'
  to: role | 'public' | 'current_role' | 'current_user' | 'session_user',
  for: 'all' | 'select' | 'insert' | 'update' | 'delete',
  using: sql`...`,      // USING clause for SELECT/UPDATE/DELETE
  withCheck: sql`...`,  // WITH CHECK clause for INSERT/UPDATE
})
```

## Example: Tijori Schema with Drizzle RLS

Here's how you could define RLS policies directly in your schema:

```typescript
import { sql } from 'drizzle-orm';
import { pgTable, pgPolicy, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { authenticatedRole, anonRole, authUid } from 'drizzle-orm/supabase';

// Helper function reference (needs to be created in SQL first)
const isProjectMember = (projectId: any, userId: any, role: string) => 
  sql`is_project_member(${projectId}, ${userId}, ${role})`;

// Users table with RLS policies
export const users = pgTable('tijori_user', {
  id: uuid().primaryKey().notNull(),
  email: varchar({ length: 255 }).notNull().unique(),
  name: varchar({ length: 255 }),
  image: text(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  // Users can only see their own profile
  pgPolicy('users_select_own_profile', {
    for: 'select',
    to: authenticatedRole,
    using: sql`${authUid} = ${table.id}`,
  }),
  // Users can insert their own profile
  pgPolicy('users_insert_own_profile', {
    for: 'insert',
    to: authenticatedRole,
    withCheck: sql`${authUid} = ${table.id}`,
  }),
  // Users can update their own profile
  pgPolicy('users_update_own_profile', {
    for: 'update',
    to: authenticatedRole,
    using: sql`${authUid} = ${table.id}`,
  }),
]);

// Projects table with RLS policies
export const projects = pgTable('tijori_project', {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar({ length: 256 }).notNull(),
  description: text(),
  encryptedPasscode: text().notNull(),
  masterKeyHash: text().notNull(),
  passcodeSalt: text().notNull(),
  iv: text().notNull(),
  authTag: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  // Project members can view projects
  pgPolicy('projects_select_members', {
    for: 'select',
    to: authenticatedRole,
    using: isProjectMember(table.id, authUid, 'member'),
  }),
  // Any authenticated user can create projects
  pgPolicy('projects_insert_authenticated', {
    for: 'insert',
    to: authenticatedRole,
    withCheck: sql`true`,
  }),
  // Only owners/admins can update
  pgPolicy('projects_update_admins', {
    for: 'update',
    to: authenticatedRole,
    using: isProjectMember(table.id, authUid, 'admin'),
  }),
  // Only owners can delete
  pgPolicy('projects_delete_owners', {
    for: 'delete',
    to: authenticatedRole,
    using: isProjectMember(table.id, authUid, 'owner'),
  }),
]);

// Shared secrets with dual access (authenticated + anonymous)
export const sharedSecrets = pgTable('tijori_shared_secret', {
  id: uuid().primaryKey().defaultRandom(),
  projectId: uuid().notNull().references(() => projects.id, { onDelete: 'cascade' }),
  environmentId: uuid().notNull().references(() => environments.id, { onDelete: 'cascade' }),
  createdBy: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  encryptedPayload: text().notNull(),
  encryptedShareKey: text().notNull(),
  passcodeSalt: text().notNull(),
  iv: text().notNull(),
  authTag: text().notNull(),
  payloadIv: text().notNull(),
  payloadAuthTag: text().notNull(),
  description: text(),
  expiresAt: timestamp({ withTimezone: true }),
  lastAccessedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  // Policy 1: Authenticated users can see project secrets
  pgPolicy('shared_secrets_select_members', {
    for: 'select',
    to: authenticatedRole,
    using: sql`${authUid} IS NOT NULL AND ${isProjectMember(table.projectId, authUid, 'member')}`,
  }),
  // Policy 2: Anonymous users can view non-expired secrets
  pgPolicy('shared_secrets_select_anonymous', {
    for: 'select',
    to: anonRole,
    using: sql`${table.expiresAt} IS NULL OR ${table.expiresAt} > NOW()`,
  }),
  // Project members can create secrets
  pgPolicy('shared_secrets_insert_members', {
    for: 'insert',
    to: authenticatedRole,
    withCheck: sql`${authUid} = ${table.createdBy} AND ${isProjectMember(table.projectId, authUid, 'member')}`,
  }),
]);
```

## Pros and Cons

### ✅ Pros: Using Drizzle RLS (In Schema)

1. **Co-location**: Policies live with table definitions
2. **Type-Safe**: TypeScript integration with schema
3. **Version Control**: Policies tracked with schema changes
4. **Automatic Migrations**: `drizzle-kit` generates migration files
5. **DRY**: Reuse table column references in policies
6. **Tooling**: Better IDE support and autocomplete

### ❌ Cons: Using Drizzle RLS (In Schema)

1. **SQL Template Strings**: Policy logic uses `sql\`...\`` (less readable for complex policies)
2. **Helper Functions**: Must still create helper functions in raw SQL first
3. **Limited to Drizzle Migrations**: Can't use with other migration tools
4. **Newer Feature**: Less mature, may have edge cases
5. **Debugging**: Harder to test SQL template strings in isolation

### ✅ Pros: Using Raw SQL Files (Current Approach)

1. **Full SQL Power**: Write complex policies with full PostgreSQL syntax
2. **Easier Testing**: Run SQL files directly in Supabase SQL Editor
3. **Better Readability**: Complex policies easier to understand
4. **Framework Agnostic**: Works with any migration tool or no migrations
5. **Mature**: Well-established pattern

### ❌ Cons: Using Raw SQL Files (Current Approach)

1. **Separation**: Policies separated from table definitions
2. **Manual Sync**: Must manually keep SQL files in sync with schema
3. **No Type Safety**: No TypeScript checking for SQL
4. **Manual Migrations**: Must run SQL files separately

## Recommendation for Tijori

**I recommend KEEPING the current SQL file approach** for several reasons:

1. **Complex Policies**: Your policies use helper functions (`is_project_member`, `get_project_for_environment`) which still need to be created in SQL anyway
2. **Testing**: Your comprehensive test suite works perfectly with SQL files
3. **Clarity**: The current SQL files with comments are very readable
4. **Flexibility**: SQL files can be run in any environment (Supabase dashboard, CI/CD, etc.)
5. **Documentation**: Your policies are already well-documented in SQL format

### Hybrid Approach (Best of Both Worlds)

You could use a **hybrid** approach:

1. **Simple policies** → Define in Drizzle schema (e.g., user isolation)
2. **Complex policies** → Keep in SQL files (e.g., multi-level access checks)
3. **Helper functions** → Always in SQL files (required for both approaches)

Example hybrid schema:

```typescript
import { pgTable, pgPolicy, uuid, varchar } from 'drizzle-orm/pg-core';
import { authenticatedRole, authUid } from 'drizzle-orm/supabase';

// Simple policy - good for Drizzle
export const users = pgTable('tijori_user', {
  id: uuid().primaryKey().notNull(),
  email: varchar({ length: 255 }).notNull(),
}, (table) => [
  pgPolicy('users_select_own', {
    for: 'select',
    to: authenticatedRole,
    using: sql`${authUid} = ${table.id}`,
  }),
]);

// Complex policies - keep in SQL files
export const projects = pgTable('tijori_project', {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar({ length: 256 }).notNull(),
  // ... other fields
});
// Policies for this table defined in supabase_rls_policies.sql
```

## Migration Steps (If You Want to Switch)

If you decide to use Drizzle RLS:

1. **Install latest Drizzle**: Ensure you have v0.36.0+
2. **Add policies to schema**: Update `src/server/db/schema.ts`
3. **Generate migration**: Run `bun run db:generate`
4. **Review migration**: Check generated SQL in `drizzle/migrations/`
5. **Apply migration**: Run `bun run db:migrate` or apply in Supabase
6. **Keep helper functions**: Still need `supabase_setup.sql` for triggers and functions

## Conclusion

**Both approaches are valid!** The current SQL file approach is excellent for your use case. Drizzle's RLS support is a nice-to-have for simpler policies, but your comprehensive SQL files with documentation, tests, and helper functions provide better clarity and flexibility.

**Stick with the SQL files for now**, but know that you have the option to gradually migrate simpler policies to Drizzle schema if you want TypeScript integration in the future.

---

## References

- [Drizzle RLS Documentation](https://orm.drizzle.team/docs/rls)
- [Drizzle Supabase Integration](https://orm.drizzle.team/docs/rls#using-with-supabase)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
