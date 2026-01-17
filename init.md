# Tijori - Agentic Workflow & Implementation Plan

## Project Overview

**Tijori** (Hindi for "vault/safe") is a secure environment variables manager designed to allow teams to store, manage, and share encrypted environment variables across projects avoiding insecure channels like Slack/Email.

## 🔄 Technology Stack Pivot

We are transitioning the codebase from a Next.js 16 + Supabase stack to a **TanStack Start + Convex** stack.

### New Stack Breakdown

- **Frontend Framework**: [TanStack Start](https://tanstack.com/start/latest) (Server-side rendering, routing).
- **Backend & Database**: [Convex](https://convex.dev) (Realtime database, backend functions).
- **Styling**: Tailwind CSS (v4).
- **Authentication**: Clerk (Recommended for Convex) or Convex Auth.
- **Encryption**: Web Crypto API (Client-side encryption/decryption).
- **Validation**: Zod.

## 🏗️ Architecture & Security Model

The core security philosophy remains: **The server (Convex) never sees the plain text secrets.** All encryption/decryption happens in the browser.

### Data Model (Convex Schema)

We will define the following tables in `convex/schema.ts` using `defineSchema` and `defineTable`.

#### 1. `users`

_Stores user profiles synced from the auth provider._

- `tokenIdentifier`: `v.string()` (Unique ID from Auth Provider, e.g., Clerk)
- `name`: `v.optional(v.string())`
- `email`: `v.string()`
- `image`: `v.optional(v.string())`
  _(Indexes: `by_tokenIdentifier`)_

#### 2. `projects`

_Top-level entity relative to a team/owner._

- `name`: `v.string()`
- `description`: `v.optional(v.string())`
- `encryptedPasscode`: `v.string()` (AES-256-GCM encrypted 6-digit passcode)
- `masterKeyHash`: `v.string()` (SHA-256 hash of Master Key)
- `passcodeSalt`: `v.string()` (Salt for PBKDF2)
- `iv`: `v.string()` (IV for encryptedPasscode)
- `authTag`: `v.string()` (AuthTag for encryptedPasscode)
- `ownerId`: `v.id("users")` (Link to the owner)
  _(Indexes: `by_ownerId`)_

#### 3. `projectMembers`

_Manages access control._

- `projectId`: `v.id("projects")`
- `userId`: `v.id("users")`
- `role`: `v.union(v.literal("owner"), v.literal("admin"), v.literal("member"))`
  _(Indexes: `by_projectId`, `by_userId`, `by_project_user` (unique))_

#### 4. `environments`

_e.g., "Development", "Production"._

- `projectId`: `v.id("projects")`
- `name`: `v.string()`
- `description`: `v.optional(v.string())`
  _(Indexes: `by_projectId`)_

#### 5. `variables`

_The actual secrets._

- `environmentId`: `v.id("environments")`
- `name`: `v.string()` (Plain text name for search)
- `encryptedValue`: `v.string()` (AES-256-GCM encrypted value)
- `iv`: `v.string()` (IV for this specific value)
- `authTag`: `v.string()` (AuthTag for this specific value)
  _(Indexes: `by_environmentId`)_

#### 6. `sharedSecrets`

_One-time share links._

- `projectId`: `v.id("projects")`
- `environmentId`: `v.id("environments")`
- `createdBy`: `v.id("users")`
- `encryptedPayload`: `v.string()` (Secrets encrypted with Share Key)
- `encryptedShareKey`: `v.string()` (Share Key encrypted with Passcode)
- `passcodeSalt`: `v.string()`
- `iv`: `v.string()` (For Share Key)
- `authTag`: `v.string()` (For Share Key)
- `payloadIv`: `v.string()` (For Payload)
- `payloadAuthTag`: `v.string()` (For Payload)
- `expiresAt`: `v.optional(v.number())`
- `isIndefinite`: `v.boolean()` (If true, expiresAt is ignored)
- `views`: `v.number()`
  _(Indexes: `by_projectId`, `by_expiry`)_

### Cryptographic Logic (Must be implemented in `src/utils/crypto.ts`)

#### Constants

- **Algorithm**: AES-GCM
- **Key Length**: 256 bits
- **KDF**: PBKDF2
- **Hash**: SHA-256
- **Iterations**: 100,000+

#### Flow A: Project Creation

1. **Inputs**: `MasterKey`, `Passcode` (6-digits).
2. **MasterKey**: `SHA-256(MasterKey) -> masterKeyHash`.
3. **Passcode Encryption**:
   - Generate `passcodeSalt` (random).
   - `PBKDF2(MasterKey, passcodeSalt)` -> `KEY_RECOVERY`.
   - `AES_Encrypt(Passcode, KEY_RECOVERY)` -> `encryptedPasscode`, `iv`, `authTag`.
     _Note: Original PG Schema implies master key encrypts passcode. This allows recovery._
4. **Store**: `masterKeyHash`, `encryptedPasscode`, `passcodeSalt`, `iv`, `authTag`.

#### Flow B: Variable Access (Read/Write)

1. **Inputs**: `Passcode`.
2. **Key Derivation**:
   - Fetch `passcodeSalt` from Project.
   - `PBKDF2(Passcode, passcodeSalt)` -> `KEY_A (Derived Key)`.
3. **Write Variable**:
   - `AES_Encrypt(Value, KEY_A)` -> `encryptedValue`, `iv`, `authTag`.
   - Send to Convex.
4. **Read Variable**:
   - Fetch `encryptedValue`, `iv`, `authTag` from Convex.
   - `AES_Decrypt(encryptedValue, KEY_A, iv, authTag)` -> `Value`.

## 🚀 Implementation Plan

### Phase 0: Workflow & Documentation (Continuous)

_Applies to every phase below._
**Default Branch**: Use `master` branch.

1. **Branch Often**: Create a new branch for each phase.
2. **Commit Often**: Create a git commit after completing each sub-task.
3. **Progress Log**: Create/Update a file in `./progress-log/` (e.g., `progress-01.md`) detailing what was completed.
4. **Learnings**: Update `./learning.md` with any new insights, technical challenges, or decisions made.

---

### Phase 1: Clean Up & Initialization

_Goal: Remove old stack debris and establish the new foundation._

#### Task 1.1: Archive & Cleanup

- [x] Remove `drizzle.config.ts`, `next.config.js`, `next-env.d.ts`.
- [x] Remove `supabase/` directory and `drizzle/` (or `src/server/db`) directories.
- [x] Remove unused dependencies from `package.json` (Next.js, Supabase, Drizzle, etc.).
- [x] Preserve `src/utils/crypto.ts` (or equivalent logic) if it contains reusable algorithms.

#### Task 1.2: Initialize TanStack Start

- [x] Run `npm create tanstack-start@latest` (or equivalent) in the current directory.
- [x] Configure `vite.config.ts` (if applicable) and basic routing structure.
- [x] Install Tailwind CSS v4 and configure basic global styles.

#### Task 1.3: Initialize Convex

- [x] Install Convex: `npm install convex`.
- [x] Run `npx convex dev` to initialize the project.
- [x] Set up `convex/` directory structure.

---

### Phase 2: Backend Core (Convex)

_Goal: Implement the Data Model and Security Logic._

#### Task 2.1: Schema Definition

- [x] Define `users` table with Clerk/Auth integration fields.
- [x] Define `projects` table with all security fields (`encryptedPasscode`, `masterKeyHash`, etc.).
- [x] Define `projectMembers` for RBAC.
- [x] Define `environments` and `variables` tables.
- [x] Define `sharedSecrets` table.
- [x] _Validation_: Ensure all fields use strict `v.*` validaters.

#### Task 2.2: Authentication Setup

- [x] Configure `convex/auth.config.ts`.
- [x] Create helper function `getUser` to retrieve authenticated user identity securely.

#### Task 2.3: Project Management Functions

- [x] `create` mutation: Handles `masterKeyHash` and `encryptedPasscode` storage.
- [x] `list` query: Returns projects the user is a member of.
- [x] `get` query: Returns project details (excluding secrets if user not authorized).

#### Task 2.4: Variable Management Functions

- [x] `listVariables` query: Returns encrypted values for a specific environment.
- [x] `updateVariable` mutation: Stores `encryptedValue`, `iv`, `authTag`.
- [x] _Security Check_: Ensure only project members can access these functions.

---

### Phase 3: Frontend Foundation & Crypto

_Goal: Build the UI shell and client-side encryption layer._

#### Task 3.1: Crypto Module (Client-Side)

- [x] Implement `deriveKey(passcode, salt)` using PBKDF2.
- [x] Implement `encrypt(text, key)` using AES-GCM.
- [x] Implement `decrypt(encryptedData, key)` using AES-GCM.
- [x] Implement `hash(text)` using SHA-256.
- [x] _Test_: Verify these work reliably in the browser environment.

#### Task 3.2: Layout & Navigation

- [x] Integrate shadcn/ui component library for universal UI primitives.
- [x] Create `App` layout with Sidebar/Navigation.
- [x] Implement Authentication UI (Login/Logout protection).
- [x] Design "Premium" global theme (Dark mode, fonts, colors).

#### Task 3.3: Project & Environment UI

- [ ] check convex working: it works for our dev mode via `npx convex dev` or locally.
- [ ] **Dashboard**: List all projects.
- [ ] **Project View**: Tabs for different environments (Dev, Prod).
- [ ] **Variables Grid**:
  - [ ] Display variables.
  - [ ] "Reveal" button triggers decryption (prompts for Passcode if key not in memory).
  - [ ] "Edit" button triggers encryption.

#### Task 3.4: State Management

- [ ] Use React State / Context to hold the _decrypted_ passcode-derived key temporarily.
- [ ] Ensure key is wiped on page reload or logout.

---

### Phase 4: Shared Secrets (Magic Links)

_Goal: Implement the Zero-Knowledge sharing flow._

#### Task 4.1: Share Creation Flow

- [ ] UI to select variables.
- [ ] UI to set expiry (duration or indefinite).
- [ ] Client-side encryption: Generate `ShareKey`, encrypt vars, encrypt `ShareKey` with `Passcode`.

- [ ] Mutation to store `encryptedPayload` in `sharedSecrets`.

#### Task 4.2: Public Access View

- [ ] Public route `tijori.app/share/[id]`.
- [ ] Fetch encrypted payload.
- [ ] UI prompts for Passcode.
- [ ] Client-side decryption and display.

---

## 📝 Rules & Conventions

- **Aesthetics**: Premium, dark mode, glassmorphism.
- **Type Safety**: Full TypeScript usage.
- **Convex**: Use `mutation`, `query`, and `action` appropriately.
- **Performance**: Optimistic updates for UI.
