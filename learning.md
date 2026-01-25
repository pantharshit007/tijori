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

---

## 2026-01-19 - Phase 5

### Master Key Rotation UI Patterns

When implementing key rotation features, there are important UX and security considerations:

#### Two-Step Dialog Pattern

For sensitive operations like key rotation, a multi-step dialog provides:

1. **Verification Gate**: Require old key before allowing new key entry
2. **Protection Against Accidental Changes**: Users can't accidentally rotate their key
3. **Clear Mental Model**: Users understand they're changing something important

```tsx
// Example pattern: step-based dialog state
const [rotationStep, setRotationStep] = useState<'verify' | 'update'>('verify')

// Step 1: Verify, Step 2: Update
{rotationStep === 'verify' ? <VerifyForm /> : <UpdateForm />}
```

#### Client-Side Hash Verification

Since we store only the **hash** of the master key (not the plaintext), verification happens entirely client-side:

```typescript
// Hash entered key with stored salt
const enteredHash = await hash(currentMasterKey, user.masterKeySalt)

// Compare with stored hash
if (enteredHash !== user.masterKeyHash) {
  throw new Error('Incorrect master key')
}
```

**Security Note**: This pattern is safe because:
- The salt and hash are already in the client (loaded via `useQuery`)
- No secret data is exposed - the hash is designed to be public
- The actual plaintext master key never leaves the browser

#### Separate Flows for Setup vs. Rotation

The Settings page now shows different UIs based on whether a master key exists:

- **No Master Key**: Shows simple setup form (two inputs: key + confirm)
- **Has Master Key**: Shows a card with "Rotate Key" button that opens the two-step dialog

This prevents the old issue where users could bypass verification by just setting a "new" key.

### Batch Re-Encryption Pattern

When rotating a key that encrypts other secrets (like the Master Key encrypting project passcodes), the pattern is:

```typescript
// 1. Fetch all affected records
const projects = await listOwned()

// 2. For each record:
for (const project of projects) {
  // Decrypt with OLD key
  const oldKey = await deriveKey(oldMasterKey, project.passcodeSalt)
  const plainPasscode = await decrypt(
    project.encryptedPasscode,
    project.iv,
    project.authTag,
    oldKey
  )

  // Re-encrypt with NEW key (and fresh salt!)
  const newSalt = generateSalt()
  const newKey = await deriveKey(newMasterKey, newSalt)
  const { encryptedValue, iv, authTag } = await encrypt(plainPasscode, newKey)

  // Collect updates
  updates.push({ projectId, encryptedPasscode: encryptedValue, passcodeSalt: newSalt, iv, authTag })
}

// 3. Batch update atomically
await batchUpdatePasscodes({ updates })
```

**Key Points**:
- Generate a **fresh salt** for each re-encrypted item (better security)
- Batch the database updates for atomicity
- Client-side re-encryption means server never sees plaintext

### Progress Indicators for Long Operations

For multi-step operations, use a step-based state machine:

```typescript
const [step, setStep] = useState<'verify' | 'update' | 'processing'>('verify')
const [progress, setProgress] = useState(0)
const [status, setStatus] = useState('')

// In processing step:
for (let i = 0; i < items.length; i++) {
  setStatus(`Processing: ${items[i].name}...`)
  setProgress(Math.round(((i + 0.5) / total) * 100))
  // ... do work
}
setProgress(100)
setStatus('Complete!')
```

This provides:
- Real-time feedback during potentially slow operations
- User confidence that the app isn't frozen
- Clear indication of what's happening

### Critical: Shared Salt Architecture Warning ⚠️

In Tijori, `passcodeSalt` is used for **two purposes**:
1. Deriving the recovery key (from Master Key) for `encryptedPasscode`
2. Hashing the 6-digit passcode for verification (`passcodeHash`)

**Problem**: If you change the salt during any operation, you MUST update BOTH:
- `encryptedPasscode` (re-encrypt)
- `passcodeHash` (re-compute)

**Failure mode**: If only one is updated, the other becomes invalid:
- If only `encryptedPasscode` is updated → Passcode verification fails on unlock
- If only `passcodeHash` is updated → Passcode recovery fails

**Takeaway**: When a salt is shared between encryption and hashing, any change to the salt cascades to ALL dependent fields. Document these dependencies clearly:

```typescript
// passcodeSalt dependencies:
// 1. encryptedPasscode = encrypt(passcode, deriveKey(masterKey, passcodeSalt))
// 2. passcodeHash = hash(passcode, passcodeSalt)
// BOTH must be updated when passcodeSalt changes!
```

---

## 2026-01-21 - Phase 6

### Role-Based Access Control (RBAC) Implementation

When implementing granular access control, consider both **UI restrictions** and **backend authorization**:

#### UI-Level Restrictions

Conditionally render UI elements based on user role:

```tsx
// Only show for owners and admins
{(userRole === "owner" || userRole === "admin") && (
  <ShareButton />
)}

// Only show for owners
{userRole === "owner" && (
  <DeleteProjectButton />
)}
```

#### Backend Authorization

Always validate permissions in mutations, even if UI hides the action:

```typescript
const membership = await ctx.db.query("projectMembers")
  .withIndex("by_project_user", (q) => 
    q.eq("projectId", args.projectId).eq("userId", userId)
  )
  .unique();

if (!membership || membership.role === "member") {
  throw new Error("Access denied");
}
```

**Both layers are required**: UI restrictions improve UX, backend restrictions prevent bypass.

### Master Key Binding and Passcode Recovery

An important security design decision: **Passcode recovery is only available to project owners**.

**Why**: The project passcode is encrypted using a key derived from the **owner's master key**. This creates a cryptographic binding:

```text
encryptedPasscode = AES_Encrypt(passcode, deriveKey(ownerMasterKey, passcodeSalt))
```

**Implications**:
1. Only the owner can recover the passcode (they need their master key)
2. Admins and members cannot recover the passcode - they must ask the owner
3. If a project is transferred (owner changed), the new owner would need to re-encrypt the passcode with their master key

**UI Pattern**: Only show "Forgot Passcode?" for owners:

```tsx
{userRole === "owner" && (
  <Button onClick={onForgotPasscode}>
    Forgot Passcode?
  </Button>
)}
```

### Leave Project Pattern

Non-owners need a way to remove themselves from projects they no longer want access to:

**Backend**:
```typescript
export const leaveProject = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const membership = await getMembership(ctx, args.projectId);
    
    // Owners cannot leave their own project
    if (membership.role === "owner") {
      throw new Error("Owners cannot leave. Transfer ownership or delete instead.");
    }
    
    await ctx.db.delete(membership._id);
  }
});
```

**UI Pattern**: Add to a "Project Settings" dialog accessible via a Settings icon:

```tsx
<Dialog>
  <DialogTrigger>
    <Settings />
  </DialogTrigger>
  <DialogContent>
    {project.role !== "owner" && (
      <Button variant="destructive" onClick={handleLeave}>
        Leave Project
      </Button>
    )}
  </DialogContent>
</Dialog>
```

### Theme Management Best Practices

When implementing theme switching (dark/light/system):

1. **Prevent Flash of Unstyled Content (FOUC)**: Add an inline script in `<head>` that runs before React hydrates:

```tsx
<script dangerouslySetInnerHTML={{
  __html: `
    (function() {
      const stored = localStorage.getItem('theme');
      const theme = stored || 'dark';
      const resolved = theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : theme;
      document.documentElement.classList.add(resolved);
    })();
  `
}} />
```

2. **Use `suppressHydrationWarning`**: Add to `<html>` element to prevent React warnings about class mismatch between server and client.

3. **Persist to localStorage**: Store user preference so it survives page reloads.

4. **Position thoughtfully**: Theme toggles work well in sidebars near user profile, not in the main header.

---

## 2026-01-25 - Phase 6.7: SharedSecrets RBAC

### The canManage Pattern

When a resource can be viewed by multiple users but only managed by some, implement a `canManage` flag at query time:

```typescript
// In the query, compute permissions upfront
return allSharedSecrets.map((s) => {
  const userRole = roleMap.get(s.projectId) || null;
  const isOwner = userRole === "owner";
  const isCreator = s.createdBy === user._id;
  
  // canManage = owner OR creator with admin rights
  const canManage = isOwner || (isCreator && (userRole === "owner" || userRole === "admin"));

  return {
    ...s,
    isOwner,
    isCreator,
    canManage, // Frontend uses this to show/hide actions
  };
});
```

**Frontend usage:**

```tsx
{share.canManage ? (
  <DropdownMenuItem onClick={handleEdit}>Edit</DropdownMenuItem>
) : (
  <DropdownMenuItem disabled>View Only</DropdownMenuItem>
)}
```

**Key Insight**: Always compute permissions on the backend and pass them to the frontend. Never derive permissions solely on the frontend from other flags - the backend is the source of truth.

### Demoted User Anti-Pattern

**Scenario**: User was admin and created a shared link. Later, they're demoted to member.

**Wrong approach**: Check only `createdBy === user._id` (allows demoted users to modify)

**Correct approach**: Check BOTH ownership AND current role:

```typescript
// In mutation
const membership = await getMembership(ctx, sharedSecret.projectId);

// Demoted creator cannot manage
const canManage = membership.role === "owner" || 
  (sharedSecret.createdBy === user._id && membership.role === "admin");

if (!canManage) {
  throw new Error("Access denied");
}
```

### Dual-Layer Visibility

When a resource should be visible to multiple user types for different reasons:

```typescript
// 1. Get user's own shares (by createdBy)
const userShares = await getSharesByCreator(user._id);

// 2. Get all shares from projects where user is owner
const ownerProjectIds = getMembershipsByRole(user._id, "owner");
const ownerShares = await getSharesByProjects(ownerProjectIds);

// 3. Combine, deduplicate, mark appropriately
const allShares = dedupe([...userShares, ...ownerShares]);
```

**Result**: The creator sees their share to monitor it, the owner sees it to govern it.

