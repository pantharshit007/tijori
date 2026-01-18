# Tijori - Agentic Workflow & Implementation Plan

# ⚡ Package & Runtime Management

+As of Jan 2026, **Tijori uses [bun](https://bun.sh/)** as its package manager and script runner (instead of npm/yarn/pnpm). All install, add, remove, and run/test commands documented henceforth assume bun usage (see [Bun CLI docs](https://bun.sh/docs/cli)).
- Install dependency: `bun add <pkg>`
- Run tests: `bun test`
- Run scripts: `bun run <script>`

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

- [x] check convex working: it works for our dev mode via `npx convex dev` or locally.
- [x] **Dashboard**: List all projects.
- [x] **Project View**: Tabs for different environments (Dev, Prod).
- [x] **Variables Grid**:
  - [x] Display variables.
  - [x] "Reveal" button triggers decryption (prompts for Passcode if key not in memory).
  - [x] "Edit" button triggers encryption.

#### Task 3.4: State Management

- [x] Use React State / Context to hold the _decrypted_ passcode-derived key temporarily.
- [x] Ensure key is wiped on page reload or logout.

---

### Phase 3.5: Security Fixes & Improvements

_Goal: Fix security bugs and improve verification flow._

#### Task 3.5.1: Master Key Verification in Project Creation ✅

- [x] Verify entered master key matches stored hash before encrypting passcode.
- [x] Show clear error if master key is incorrect.

#### Task 3.5.2: Passcode Verification on Unlock ✅

- [x] Add `verificationBlob` to projects table (encrypted "TIJORI_VERIFY" string).
- [x] On unlock, decrypt verification blob to verify passcode is correct.
- [x] Show error immediately if passcode is wrong.

#### Task 3.5.3: Add Environment Functionality ✅

- [x] Implement "Add" button in environment tabs.
- [x] Dialog to create new environment.

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
- [ ] add a button to copy the shared key to clipboard.

---

### Phase 5: Master Key Management (Future)

_Goal: Advanced master key features._

#### Task 5.1: Master Key Rotation

- [ ] When master key is updated, re-encrypt all project passcodes.
- [ ] Prompt user to enter old master key for verification.
- [ ] Batch re-encryption with progress indicator.

#### Task 5.2: Passcode Recovery Flow

- [ ] "Forgot Passcode?" button in unlock dialog.
- [ ] Prompt for master key to decrypt passcode.
- [ ] Show recovered passcode to user.

---

### Phase 6: Project Management (Future)

_Goal: Advanced project management features._

#### Task 6.1: Recent Projects Dashboard

- [ ] Display recent projects (5) on /dashboard

#### Task 6.2: Project Member Management

- [ ] Add members to project
- [ ] Remove members from project
- [ ] Update the member role

#### Task 6.3: Project Details View Improvements

- [ ] Grid/table view for project
- [ ] Card or table to show number of environments and members
- [ ] Add description option to the dialog, when creating a new environment

#### Task 6.4: Bulk Add/Edit Variable Values

- [ ] Allow user to paste multiple key/values from clipboard in textarea, parse and add
- [ ] Add option to edit single variable; each shows a pencil icon

#### Task 6.5: Variable Copy Enhancements

- [ ] Add option to copy all values from selected environment, `"VAR_NAME"= VAR_VALUE`

---

#### Task 6.6: OVERHAUL

- [ ] Vercel-inspired Environment Variable Management UI

> Design a web UI for managing environment variables, inspired by Vercel’s environment variable management screen.
>
> The interface must support both dark mode and light mode, with identical layout and behavior across themes.
>
> The interface should include:
> **Top Controls**
>
> - A search input for filtering variables
> - A dropdown to filter by environment (e.g. “All Environments”, “Production”, “Preview”, “Development”)
> - A sort dropdown (e.g. “Last Updated”)
>
> **Environment Variable List**
>
> - Display variables in a vertical list or table
> - Each row represents one environment variable and contains:
>   - Variable name (monospace or code-style text)
>   - Environment scope label (e.g. “All Environments”)
>   - A masked value shown as dots (••••••••)
>   - A reveal icon (eye icon) next to the value
>
> **Reveal & Copy Behavior**
>
> - By default, values are hidden
> - Hovering the eye icon shows a tooltip: “Click to reveal”
> - Clicking the eye icon:
>   - Reveals the actual value inline, value.slice(0, 10) + “…”
>   - On clicking the revealed val, it copies the value to the clipboard
>   - Provides subtle feedback (tooltip or toast like “Copied”)
>
> **Row Metadata & Actions**
>
> - On the right side of each row:
>   - “Added <date>”
>   - Avatar of the user who added it
>   - A kebab menu (⋯) with options:
>     - Edit
>     - Copy to Clipboard
>     - Remove (destructive, styled in red)
>
> **Design Style**
>
> - Dark theme
> - Clean, minimal, developer-focused
> - Clear spacing and alignment
> - Destructive actions visually distinct
>
> Focus on UX clarity, security-aware defaults, and polished micro-interactions.
>
> Optional Implementation Notes:
>
> - Masked values should never be selectable unless revealed
> - Clipboard copy should use the Web Clipboard API
> - Revealed secrets should auto-re-mask after a short delay or on blur
> - Use subtle animations for reveal and menu actions
> - Ensure accessibility (keyboard navigation, aria-labels)
> - Include a search bar to search vars

---

### Phase 7: Security Audit & Hardening

_Goal: Comprehensive security review and penetration testing._

#### Task 7.1: Code Security Review

- [ ] Review all crypto implementations for vulnerabilities
- [ ] Verify salt usage in all hash operations
- [ ] Check for timing attack vulnerabilities
- [ ] Audit all client-side encryption/decryption flows
- [ ] Review key derivation parameters (iterations, algorithms)

#### Task 7.2: Input Validation & Sanitization

- [ ] Verify 6-digit passcode enforcement everywhere
- [ ] Check for XSS vulnerabilities in user inputs
- [ ] Validate all Convex mutation arguments
- [ ] Test SQL injection prevention (Convex handles this, but verify)
- [ ] Review file upload security (if applicable)

#### Task 7.3: Authentication & Authorization

- [ ] Verify Clerk JWT validation
- [ ] Test project access control (owner/admin/member roles)
- [ ] Check for IDOR vulnerabilities (accessing other users' data)
- [ ] Verify environment variable access restrictions
- [ ] Test shared secret access controls

#### Task 7.4: Data Protection

- [ ] Verify all secrets are encrypted at rest
- [ ] Check for accidental logging of sensitive data
- [ ] Review error messages for information leakage
- [ ] Verify master key is never stored in plaintext
- [ ] Test passcode hash collision resistance

#### Task 7.5: Frontend Security

- [ ] Implement Content Security Policy (CSP)
- [ ] Add security headers (HSTS, X-Frame-Options, etc.)
- [ ] Review for DOM-based XSS
- [ ] Check for sensitive data in browser storage
- [ ] Verify keys are cleared from memory on logout

#### Task 7.6: Penetration Testing

- [ ] Attempt to bypass passcode verification
- [ ] Try to access other users' projects
- [ ] Test for replay attacks
- [ ] Attempt CSRF attacks
- [ ] Test rate limiting on authentication

#### Task 7.7: Dependency Audit

- [ ] Run `bun audit` and fix vulnerabilities
- [ ] Review all third-party dependencies
- [ ] Check for outdated packages with known CVEs
- [ ] Verify Convex SDK is up to date

#### Task 7.8: Documentation & Compliance

- [ ] Document security architecture
- [ ] Create incident response plan
- [ ] Add security best practices to README
- [ ] Consider GDPR/privacy compliance
- [ ] Add security disclosure policy

---

## 📝 Rules & Conventions

- **Aesthetics**: Premium, dark mode, glassmorphism.
- **Type Safety**: Full TypeScript usage.
- **Convex**: Use `mutation`, `query`, and `action` appropriately.
- **Performance**: Optimistic updates for UI.
