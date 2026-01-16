# Row Level Security (RLS) in Supabase - Complete Guide

This document explains how Row Level Security works in Supabase and how it's implemented in the Tijori application.

## Table of Contents

1. [What is Row Level Security (RLS)?](#what-is-row-level-security-rls)
2. [How RLS Works in Supabase](#how-rls-works-in-supabase)
3. [Tijori's Security Model](#tijoris-security-model)
4. [Policy Explanations](#policy-explanations)
5. [Setup Instructions](#setup-instructions)
6. [Testing RLS Policies](#testing-rls-policies)
7. [Common Pitfalls & Troubleshooting](#common-pitfalls--troubleshooting)
8. [Best Practices](#best-practices)

---

## What is Row Level Security (RLS)?

**Row Level Security (RLS)** is a PostgreSQL feature that allows you to control which rows users can access in a database table based on security policies. Instead of managing permissions at the application level, you define access rules directly in the database.

### Key Benefits

- **Database-level security**: Protection even if application code is compromised
- **Fine-grained control**: Different policies for SELECT, INSERT, UPDATE, DELETE
- **User context aware**: Policies use `auth.uid()` to identify the current user
- **Zero-trust architecture**: All queries are denied by default; only allowed by explicit policies

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  User Request (with JWT token)                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Supabase extracts auth.uid() from JWT                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Query sent to PostgreSQL                                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  RLS Policies evaluate row-by-row                           │
│  • Check if auth.uid() matches allowed conditions           │
│  • Apply helper functions (is_project_member, etc.)         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Return only rows that pass policy checks                   │
└─────────────────────────────────────────────────────────────┘
```

---

## How RLS Works in Supabase

Supabase is built on PostgreSQL and uses RLS as its primary authorization mechanism. When a user makes a request through the Supabase client:

1. **Authentication**: User logs in via Supabase Auth
2. **JWT Token**: Supabase issues a JWT token containing the user's ID
3. **Request**: Client sends query with JWT in headers
4. **Context**: Supabase sets `auth.uid()` to the user ID from the JWT
5. **Policy Evaluation**: PostgreSQL evaluates RLS policies for each row
6. **Response**: Only rows passing policy checks are returned

### Anonymous vs Authenticated Access

- **Authenticated**: `auth.uid()` returns the user's UUID
- **Anonymous**: `auth.uid()` returns `NULL`

Policies can support both:
```sql
-- Authenticated only
USING (auth.uid() = user_id)

-- Anonymous allowed
USING (auth.uid() IS NULL OR auth.uid() = user_id)
```

---

## Tijori's Security Model

Tijori implements a **project-based access control** system with the following hierarchy:

```
Users
  ├── Project Members (role: owner, admin, member)
  │     └── Projects
  │           ├── Environments (dev, prod, staging)
  │           │     └── Environment Variables (encrypted)
  │           └── Shared Secrets (encrypted, supports anonymous sharing)
```

### Access Rules

| Entity | Who Can Access? |
|--------|----------------|
| **Users** | Only the user themselves |
| **Projects** | Project members only |
| **Environments** | Members of the parent project |
| **Environment Variables** | Members of the parent project |
| **Project Members** | Members of the same project |
| **Shared Secrets** | Project members OR anonymous users (if not expired) |

### Role Hierarchy

```
owner (highest) > admin > member (lowest)
```

- **Owner**: Full control, can delete project, manage all members
- **Admin**: Can manage members and environments, cannot delete project
- **Member**: Can view/edit environment variables

---

## Policy Explanations

### 1. Users Table (`tijori_user`)

#### Profile Isolation
```sql
CREATE POLICY "Users can view their own profile"
  ON tijori_user FOR SELECT
  USING (auth.uid() = id);
```

**How it works**: 
- `auth.uid()` returns the authenticated user's ID from their JWT token
- Only rows where `id` matches the current user pass the check
- Result: Users can only see their own profile, never others'

**Example**:
- User A (ID: `123`) queries: `SELECT * FROM tijori_user`
- RLS adds: `WHERE id = '123'`
- User A only sees their own record

---

### 2. Projects Table (`tijori_project`)

#### Project Member Access
```sql
CREATE POLICY "Project members can view projects"
  ON tijori_project FOR SELECT
  USING (is_project_member(id, auth.uid(), 'member'));
```

**How it works**:
- Calls helper function `is_project_member(project_id, user_id, min_role)`
- Function checks `tijori_project_member` table for membership
- Returns `TRUE` if user is a member with at least the specified role
- Role hierarchy: owner (3) > admin (2) > member (1)

**Example**:
- User A is owner of Project 1, member of Project 2
- Query: `SELECT * FROM tijori_project`
- RLS filters to only Project 1 and Project 2
- User A cannot see other projects

#### Admin-Level Modifications
```sql
CREATE POLICY "Project owners and admins can update projects"
  ON tijori_project FOR UPDATE
  USING (is_project_member(id, auth.uid(), 'admin'))
  WITH CHECK (is_project_member(id, auth.uid(), 'admin'));
```

**How it works**:
- `USING`: Determines which existing rows can be updated
- `WITH CHECK`: Validates new data after update
- Only owners and admins pass the `'admin'` role check
- Regular members cannot update project details

---

### 3. Environments Table (`tijori_environment`)

#### Inherited Project Access
```sql
CREATE POLICY "Project members can view environments"
  ON tijori_environment FOR SELECT
  USING (is_project_member(project_id, auth.uid(), 'member'));
```

**How it works**:
- Uses `project_id` foreign key to check parent project membership
- If user is a member of the project, they can see its environments
- Access is inherited from project membership

**Example**:
- User A is a member of Project 1
- Project 1 has environments: dev, prod, staging
- User A can see all three environments
- User B (not a member) sees zero environments

---

### 4. Environment Variables Table (`tijori_environment_variable`)

#### Multi-Level Access Check
```sql
CREATE POLICY "Project members can view environment variables"
  ON tijori_environment_variable FOR SELECT
  USING (
    is_project_member(
      get_project_for_environment(environment_id),
      auth.uid(),
      'member'
    )
  );
```

**How it works**:
1. `get_project_for_environment(environment_id)` - Lookup the project ID
2. `is_project_member(project_id, user_id, 'member')` - Check membership
3. Two-step chain: environment → project → membership check

**Why this design**:
- Environment variables don't have a direct `project_id` column
- Must traverse: variable → environment → project
- Helper function encapsulates this lookup for cleaner policies

---

### 5. Project Members Table (`tijori_project_member`)

#### Member Management
```sql
CREATE POLICY "Project owners and admins can add members"
  ON tijori_project_member FOR INSERT
  WITH CHECK (is_project_member(project_id, auth.uid(), 'admin'));
```

**How it works**:
- Only owners/admins can add new members
- `WITH CHECK` validates the new row being inserted
- Prevents members from adding other members without permission

**Security consideration**:
- Without this policy, a member could add themselves as owner to any project
- Policy ensures only authorized users can modify membership

---

### 6. Shared Secrets Table (`tijori_shared_secret`)

#### Dual Access Model

**Policy 1: Authenticated Project Members**
```sql
CREATE POLICY "Project members can view shared secrets"
  ON tijori_shared_secret FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    is_project_member(project_id, auth.uid(), 'member')
  );
```

**Policy 2: Anonymous Public Access**
```sql
CREATE POLICY "Anonymous users can view non-expired shared secrets"
  ON tijori_shared_secret FOR SELECT
  USING (NOT is_shared_secret_expired(id));
```

**How it works**:
- **Two separate policies** for the same table
- PostgreSQL evaluates them with OR logic: if either passes, access granted
- Policy 1: Authenticated users see all secrets from their projects
- Policy 2: Anyone (even anonymous) can view non-expired secrets

**Why this design**:
- Supports "share via link" feature for external users
- External users don't have Tijori accounts (anonymous)
- They receive a link like: `https://app.com/shared/abc-123`
- Anonymous access fetches the encrypted secret by ID
- Actual decryption requires the passcode (zero-knowledge)

**Security layers**:
1. **RLS**: Controls who can read the database row
2. **Expiration**: Expired secrets blocked for anonymous users
3. **Encryption**: Secret values are encrypted, unreadable without passcode
4. **Client-side decryption**: Passcode never sent to server

---

## Setup Instructions

### Step 1: Apply Your Schema

First, ensure your database schema is created. If using Drizzle:

```bash
# Generate and push your schema
bun run db:push

# Or run migrations
bun run db:migrate
```

### Step 2: Apply RLS Policies

Run the RLS policies file in Supabase SQL Editor:

1. Open your Supabase dashboard
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy the contents of [`supabase_rls_policies.sql`](file:///Users/hpant00/personal/projects/tijori/supabase_rls_policies.sql)
5. Click **Run**

This will:
- Create helper functions
- Enable RLS on all tables
- Create all security policies

### Step 3: Apply Setup Triggers

Run the setup file in Supabase SQL Editor:

1. Create a new query in SQL Editor
2. Copy the contents of [`supabase_setup.sql`](file:///Users/hpant00/personal/projects/tijori/supabase_setup.sql)
3. Click **Run**

This will:
- Auto-create user profiles when users sign up
- Auto-assign creator as project owner
- Add helper functions for your application

### Step 4: Verify Setup

To confirm everything is working:

1. Check that RLS is enabled:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename LIKE 'tijori_%';
```
All tables should show `rowsecurity = true`

2. List all policies:
```sql
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename LIKE 'tijori_%';
```

---

## Testing RLS Policies

### Automated Testing

Use the provided test suite [`supabase_rls_tests.sql`](file:///Users/hpant00/personal/projects/tijori/supabase_rls_tests.sql):

1. Open Supabase SQL Editor
2. Copy the entire test file
3. Execute the **SETUP** section first
4. Execute each **TEST** section individually
5. Review results (✓ should return data, ✗ should return nothing)
6. Execute the **CLEANUP** section when done

### Manual Testing with Supabase Client

Test in your application code:

```typescript
// Test 1: User can see own profile
const { data: profile } = await supabase
  .from('tijori_user')
  .select('*')
  .eq('id', user.id)
  .single();
// Should succeed

// Test 2: User cannot see others' profiles
const { data: otherProfile } = await supabase
  .from('tijori_user')
  .select('*')
  .eq('id', 'some-other-user-id')
  .single();
// Should return null (RLS blocks access)

// Test 3: Project members can view project
const { data: projects } = await supabase
  .from('tijori_project')
  .select('*');
// Should return only projects where user is a member

// Test 4: Anonymous access to shared secret
const { data: secret } = await supabase
  .from('tijori_shared_secret')
  .select('*')
  .eq('id', 'shared-secret-id')
  .single();
// Should work even without authentication (if not expired)
```

### Testing Anonymous Access

For shared secrets:

```typescript
// Create anonymous Supabase client (no auth)
const anonClient = createClient(supabaseUrl, supabaseAnonKey);

// Try to access a non-expired shared secret
const { data, error } = await anonClient
  .from('tijori_shared_secret')
  .select('encrypted_payload, encrypted_share_key')
  .eq('id', shareId)
  .single();

// Should succeed for non-expired secrets
// Should fail for expired secrets
```

---

## Common Pitfalls & Troubleshooting

### Issue 1: "New row violates row-level security policy"

**Symptom**: Cannot insert data, even as the owner

**Cause**: `WITH CHECK` policy failing

**Solution**: Check that:
1. User is authenticated (`auth.uid()` is not null)
2. User has required permissions
3. Foreign keys reference accessible records

**Example**:
```sql
-- ❌ This will fail if user isn't a project member
INSERT INTO tijori_environment_variable (environment_id, name, encrypted_value)
VALUES ('env-id', 'API_KEY', 'encrypted-value');

-- ✅ First verify user can access the environment
SELECT * FROM tijori_environment WHERE id = 'env-id';
```

### Issue 2: "Created project but can't see it"

**Symptom**: User creates a project but it doesn't appear in queries

**Cause**: User not added to `tijori_project_member`

**Solution**: Ensure the `on_project_created` trigger is active:
```sql
-- Check if trigger exists
SELECT tgname FROM pg_trigger WHERE tgname = 'on_project_created';

-- If missing, run supabase_setup.sql again
```

The trigger automatically adds the creator as owner.

### Issue 3: "User profile doesn't exist"

**Symptom**: Cannot insert data because user record is missing

**Cause**: User signed up but profile wasn't created

**Solution**: 
1. Check that `on_auth_user_created` trigger exists
2. Manually create profile if needed:
```sql
INSERT INTO tijori_user (id, email, name)
VALUES (auth.uid(), 'user@example.com', 'User Name');
```

### Issue 4: "Helper function returns unexpected results"

**Symptom**: `is_project_member()` returns FALSE when it should be TRUE

**Solution**: Debug step-by-step:
```sql
-- Check membership directly
SELECT * FROM tijori_project_member 
WHERE project_id = 'project-id' AND user_id = auth.uid();

-- Test helper function
SELECT is_project_member('project-id', auth.uid(), 'member');

-- Verify user_id matches
SELECT auth.uid();
```

### Issue 5: "Anonymous users can't access shared secrets"

**Symptom**: Public sharing links don't work

**Cause**: Missing anonymous policy or secret is expired

**Solution**:
1. Verify the anonymous policy exists:
```sql
SELECT * FROM pg_policies 
WHERE tablename = 'tijori_shared_secret' 
AND policyname = 'Anonymous users can view non-expired shared secrets';
```

2. Check secret expiration:
```sql
SELECT id, expires_at, expires_at < NOW() as is_expired
FROM tijori_shared_secret
WHERE id = 'secret-id';
```

3. Create anonymous client without authentication:
```typescript
const client = createClient(url, anonKey); // No .auth.signIn()
```

---

## Best Practices

### 1. Always Use Authenticated Requests

```typescript
// ✅ Good: Authenticated client
const supabase = createClient(url, anonKey);
await supabase.auth.signInWithPassword({ email, password });

// ❌ Bad: Unauthenticated client for protected resources
const supabase = createClient(url, anonKey);
await supabase.from('tijori_project').select(); // Will fail RLS
```

### 2. Check Auth State Before Queries

```typescript
const { data: { session } } = await supabase.auth.getSession();

if (!session) {
  // Redirect to login
  return;
}

// Now safe to query protected resources
const { data } = await supabase.from('tijori_project').select();
```

### 3. Handle RLS Errors Gracefully

```typescript
const { data, error } = await supabase
  .from('tijori_project')
  .select()
  .eq('id', projectId)
  .single();

if (error) {
  if (error.code === 'PGRST116') {
    // Row-level security policy violation
    console.error('Access denied: You are not a member of this project');
  }
}
```

### 4. Use Helper Functions in Application Code

```typescript
// Instead of checking membership in your app, trust RLS
// ❌ Bad: Application-level check
const isMember = await checkIfUserIsProjectMember(projectId, userId);
if (!isMember) return;

// ✅ Good: Let RLS handle it
const { data, error } = await supabase
  .from('tijori_project')
  .select()
  .eq('id', projectId);

if (error || !data) {
  // User doesn't have access (RLS blocked)
}
```

### 5. Test Policies in Development

Always test that:
- ✅ Authorized users CAN access data
- ✅ Unauthorized users CANNOT access data
- ✅ Anonymous access works where intended
- ✅ Anonymous access blocks where not intended

### 6. Monitor RLS Performance

RLS policies run on every query. For large tables:
- Add indexes on columns used in policies (e.g., `project_id`, `user_id`)
- Keep helper functions efficient (avoid expensive subqueries)
- Use `EXPLAIN ANALYZE` to check query plans

```sql
EXPLAIN ANALYZE
SELECT * FROM tijori_environment_variable 
WHERE environment_id = 'some-id';
```

---

## Security Considerations

### Encryption vs RLS

**RLS controls ACCESS, not DECRYPTION**

- RLS: Who can read database rows
- Encryption: Who can decrypt sensitive values

In Tijori:
1. RLS prevents unauthorized users from reading encrypted data rows
2. Even if someone bypasses RLS, data is encrypted
3. Decryption keys are never stored in the database
4. Client-side decryption requires user's passcode

### Zero-Knowledge Architecture

Even though someone might access a row via RLS:
- `encrypted_passcode`: Encrypted with master key (not in database)
- `encrypted_value`: Encrypted with passcode-derived key
- `encrypted_share_key`: Encrypted with share passcode

**Server sees only encrypted blobs**—zero-knowledge principle maintained.

### Anonymous Sharing Security

When sharing secrets anonymously:
1. RLS allows reading the row
2. But data is encrypted
3. Recipient must have the passcode (shared out-of-band)
4. Passcode never sent to server
5. Decryption happens client-side

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Request                              │
│  (HTTP with JWT token from Supabase Auth)                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Supabase API Layer                           │
│  • Validates JWT token                                           │
│  • Extracts auth.uid() from token                                │
│  • Forwards query to PostgreSQL                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PostgreSQL Database                         │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  1. Query Arrives                                          │ │
│  │     SELECT * FROM tijori_project WHERE id = 'xyz'          │ │
│  └─────────────────────────┬──────────────────────────────────┘ │
│                            │                                     │
│                            ▼                                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  2. RLS Policies Applied                                   │ │
│  │     • is_project_member(id, auth.uid(), 'member')          │ │
│  │     • Checks tijori_project_member table                   │ │
│  │     • Returns TRUE or FALSE for each row                   │ │
│  └─────────────────────────┬──────────────────────────────────┘ │
│                            │                                     │
│                            ▼                                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  3. Filter Results                                         │ │
│  │     • Keep rows where policy returned TRUE                 │ │
│  │     • Discard rows where policy returned FALSE             │ │
│  └─────────────────────────┬──────────────────────────────────┘ │
└────────────────────────────┼──────────────────────────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Return Results │
                    └─────────────────┘
```

---

## Conclusion

Row Level Security in Supabase provides **database-level authorization** that:
- ✅ Prevents unauthorized data access
- ✅ Works alongside encryption for defense in depth
- ✅ Supports both authenticated and anonymous access patterns
- ✅ Scales automatically with your application
- ✅ Reduces application-level security code

Tijori's implementation demonstrates:
- Multi-level access (projects → environments → variables)
- Role-based permissions (owner, admin, member)
- Hybrid access (authenticated members + anonymous sharing)
- Zero-knowledge encryption (RLS + client-side decryption)

**Next Steps**:
1. Run [`supabase_rls_policies.sql`](file:///Users/hpant00/personal/projects/tijori/supabase_rls_policies.sql) in your Supabase dashboard
2. Run [`supabase_setup.sql`](file:///Users/hpant00/personal/projects/tijori/supabase_setup.sql) to enable triggers
3. Test policies using [`supabase_rls_tests.sql`](file:///Users/hpant00/personal/projects/tijori/supabase_rls_tests.sql)
4. Integrate with your Supabase client in the application

Your database is now secured with enterprise-grade Row Level Security! 🔒
