# Tijori 🔐

**Tijori** (Hindi for "vault/safe") is a secure environment variables manager that allows teams to store, manage, and share encrypted environment variables across projects.

## Overview

Tijori solves the problem of securely sharing environment variables within teams. Instead of sharing `.env` files through insecure channels, Tijori provides:

- 🔒 **Client-side encryption** - Variables are encrypted/decrypted in the browser
- 🏢 **Project-based organization** - Group variables by project
- 🌍 **Multiple environments** - Separate dev, prod, staging, etc.
- 🔑 **Passcode protection** - 6-digit passcode to access variables
- 🛡️ **Master key recovery** - Recover forgotten passcodes securely

---

## Architecture

### Database Schema

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                  PROJECTS                                   │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  id (UUID)                                                             │ │
│  │  name                                                                  │ │
│  │  description                                                           │ │
│  │  encryptedPasscode  ←── Passcode encrypted with master key            │ │
│  │  masterKeyHash      ←── Hash of master key (for verification)         │ │
│  │  passcodeSalt       ←── Salt for deriving encryption key              │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                      │
│                                      │ 1:N                                  │
│                                      ▼                                      │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                            ENVIRONMENTS                                │ │
│  │  id (UUID)                                                             │ │
│  │  projectId (FK)                                                        │ │
│  │  name (e.g., "dev", "prod", "staging")                                │ │
│  │  description                                                           │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                      │
│                                      │ 1:N                                  │
│                                      ▼                                      │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        ENVIRONMENT VARIABLES                           │ │
│  │  id (UUID)                                                             │ │
│  │  environmentId (FK)                                                    │ │
│  │  name (plain text - for searchability)                                │ │
│  │  encryptedValue  ←── Value encrypted with passcode-derived key        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Security Model

#### Encryption Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           PROJECT CREATION                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  User provides:  MASTER_KEY + PASSCODE (6-digit)                            │
│                                                                              │
│  ┌─────────────┐                                                            │
│  │ MASTER_KEY  │──┬──► SHA-256 Hash ──────────► masterKeyHash (stored)      │
│  └─────────────┘  │                                                         │
│                   └──► AES Encrypt(PASSCODE) ──► encryptedPasscode (stored) │
│                                                                              │
│  ┌─────────────┐      ┌──────────────┐                                      │
│  │  PASSCODE   │──────│ Random Salt  │──► passcodeSalt (stored)             │
│  └─────────────┘      └──────────────┘                                      │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                         VARIABLE ENCRYPTION                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PASSCODE + passcodeSalt ──► PBKDF2 ──► Derived Key                         │
│                                              │                               │
│  ENV_VALUE ──────────────────────────────────┼──► AES-256-GCM               │
│                                              │         │                     │
│                                              ▼         ▼                     │
│                                         encryptedValue (stored)              │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Decryption Flow (Client-Side)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          ACCESSING VARIABLES                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. User enters 6-digit PASSCODE                                            │
│                                                                              │
│  2. Fetch project data (encryptedValue, passcodeSalt)                       │
│                                                                              │
│  3. PASSCODE + passcodeSalt ──► PBKDF2 ──► Derived Key                      │
│                                                 │                            │
│  4. encryptedValue ─────────────────────────────┼──► AES-256-GCM Decrypt    │
│                                                 │           │                │
│                                                 ▼           ▼                │
│                                            Plain text ENV_VALUE              │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Passcode Recovery Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          FORGOT PASSCODE?                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. User enters MASTER_KEY                                                  │
│                                                                              │
│  2. SHA-256(MASTER_KEY) ══► Compare with masterKeyHash                      │
│                                    │                                         │
│                              ┌─────┴─────┐                                   │
│                              │  Match?   │                                   │
│                              └─────┬─────┘                                   │
│                                    │                                         │
│                         ┌──────────┴──────────┐                              │
│                         ▼                     ▼                              │
│                       [YES]                 [NO]                             │
│                         │                     │                              │
│   MASTER_KEY ──► Decrypt(encryptedPasscode)   └──► Access Denied            │
│                         │                                                    │
│                         ▼                                                    │
│                   PASSCODE revealed                                          │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

### Shared Secrets (Zero-Knowledge Sharing)

Tijori allows secure sharing of environment variables via a **URL + Passcode** without requiring the recipient to have an account.

#### Security Model

| Data | Sent Over Network? | Notes |
|------|-------------------|-------|
| `share_id` | ✅ Yes | To fetch the share record from DB |
| `encryptedPayload` | ✅ Yes | Encrypted with share key (useless without it) |
| `encryptedShareKey` | ✅ Yes | Encrypted with passcode (useless without it) |
| `passcodeSalt` | ✅ Yes | Safe to share; required for key derivation |
| `iv`, `authTag` | ✅ Yes | Required for AES-GCM decryption |
| **Passcode** | ❌ **NEVER** | Entered by user, stays in browser |
| **Share Key (decrypted)** | ❌ **NEVER** | Derived in browser only |
| **Secrets (decrypted)** | ❌ **NEVER** | Decrypted in browser only |

#### Create Share Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           CREATE SHARED SECRET                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. User selects environment variables to share                              │
│                                                                              │
│  2. Generate random SHARE_KEY (256-bit)                                      │
│                                                                              │
│  3. Encrypt secrets with SHARE_KEY:                                          │
│     SECRETS ──► AES-256-GCM(SHARE_KEY) ──► encryptedPayload                 │
│                                                                              │
│  4. User enters SHARE_PASSCODE                                               │
│                                                                              │
│  5. Derive key from passcode:                                                │
│     SHARE_PASSCODE + salt ──► PBKDF2 ──► derivedKey                         │
│                                                                              │
│  6. Encrypt share key with derived key:                                      │
│     SHARE_KEY ──► AES-256-GCM(derivedKey) ──► encryptedShareKey             │
│                                                                              │
│  7. Store in database:                                                       │
│     • encryptedPayload                                                       │
│     • encryptedShareKey                                                      │
│     • passcodeSalt, iv, authTag, payloadIv, payloadAuthTag                  │
│                                                                              │
│  8. Generate URL: https://tijori.app/share/[share_id]                       │
│                                                                              │
│  9. Share URL + PASSCODE with recipient (via any channel)                   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Access Share Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           ACCESS SHARED SECRET                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Recipient opens URL: https://tijori.app/share/[share_id]                │
│                                                                              │
│  2. Frontend fetches share metadata from server:                             │
│     • encryptedPayload                                                       │
│     • encryptedShareKey                                                      │
│     • passcodeSalt, iv, authTag, payloadIv, payloadAuthTag                  │
│     • description (optional)                                                 │
│     • expiresAt (check if expired)                                           │
│                                                                              │
│  3. User enters SHARE_PASSCODE ◄─── (never sent to server)                  │
│                                                                              │
│  4. Derive key from passcode (in browser):                                   │
│     SHARE_PASSCODE + passcodeSalt ──► PBKDF2 ──► derivedKey                 │
│                                                                              │
│  5. Decrypt share key (in browser):                                          │
│     encryptedShareKey ──► AES-256-GCM(derivedKey) ──► SHARE_KEY             │
│                                                                              │
│  6. Decrypt secrets (in browser):                                            │
│     encryptedPayload ──► AES-256-GCM(SHARE_KEY) ──► SECRETS                 │
│                                                                              │
│  7. Display secrets in UI                                                    │
│                                                                              │
│  8. Update lastAccessedAt in database                                        │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### What the Server Can See (Even if Compromised)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         SERVER COMPROMISE SCENARIO                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Attacker gains access to database. They see:                                │
│                                                                              │
│  • encryptedPayload ──► ❌ Useless (encrypted with unknown share key)       │
│  • encryptedShareKey ─► ❌ Useless (encrypted with passcode)                │
│  • passcodeSalt ──────► ⚠️  Only useful if they brute-force the passcode    │
│                                                                              │
│  Without the PASSCODE, the data is cryptographically meaningless.            │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org) (App Router)
- **Database**: PostgreSQL with [Supabase](https://supabase.com)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team)
- **Styling**: [Tailwind CSS](https://tailwindcss.com)
- **Validation**: [Zod](https://zod.dev)
- **Environment**: [@t3-oss/env-nextjs](https://env.t3.gg)

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (or Supabase project)

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Push database schema
npm run db:push

# Start development server
npm run dev
```

### Database Commands

```bash
npm run db:generate  # Generate migrations
npm run db:migrate   # Run migrations
npm run db:push      # Push schema directly (dev)
npm run db:studio    # Open Drizzle Studio
```

---

## Project Structure

```
src/
├── app/                    # Next.js App Router
├── server/
│   └── db/
│       ├── index.ts        # Database connection
│       └── schema.ts       # Drizzle schema definitions
├── env.js                  # Environment validation
└── styles/
    └── globals.css         # Global styles
```

---

## Security Considerations

> ⚠️ **Important**: The master key is never stored in the database. Users must keep it safe. If lost, there is no way to recover the passcode.

- All encryption/decryption happens **client-side**
- Server never sees plain text values or passcodes
- Passcode-derived keys use PBKDF2 with high iteration count
- AES-256-GCM provides authenticated encryption

---

## License

MIT
