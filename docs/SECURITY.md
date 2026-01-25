# Tijori Security Architecture

> Last Updated: January 26, 2026

## Overview

Tijori employs a **zero-knowledge architecture** where the server never sees plaintext secrets. All encryption and decryption happens client-side in the browser using the Web Crypto API.

## Encryption Stack

### Algorithms Used

| Purpose | Algorithm | Parameters |
|---------|-----------|------------|
| Symmetric Encryption | AES-256-GCM | 256-bit key, 96-bit IV, 128-bit auth tag |
| Key Derivation | PBKDF2 | 100,000 iterations, SHA-256, 128-bit salt |
| Hashing | SHA-256 | With salt prepended |

### Key Hierarchy

```
User's Master Key (memorized)
    │
    ├── Hash (SHA-256 + salt) → Stored in DB for verification
    │
    └── Derive via PBKDF2 → Master CryptoKey
            │
            └── Encrypts Project Passcodes (for recovery)

Project Passcode (6-digit)
    │
    ├── Hash (SHA-256 + salt) → Stored in DB for verification
    │
    └── Derive via PBKDF2 → Project CryptoKey
            │
            └── Encrypts all Environment Variables
```

### Shared Secret Flow

```
Share Creation (by owner/admin):
1. Decrypt selected variables with Project CryptoKey
2. Generate random 256-bit ShareKey
3. Encrypt variables with ShareKey → encryptedPayload
4. User enters 6-digit share passcode
5. Derive SharePassKey from share passcode + new salt
6. Encrypt ShareKey with SharePassKey → encryptedShareKey
7. Store encrypted data in Convex

Share Access (by recipient):
1. Recipient enters share passcode
2. Derive SharePassKey from passcode + stored salt
3. Decrypt ShareKey from encryptedShareKey
4. Decrypt variables from encryptedPayload
5. Display to user
```

## Authentication & Authorization

### Authentication

- **Provider**: Clerk (OAuth 2.0 / JWT)
- **Token Validation**: `ctx.auth.getUserIdentity()` in all Convex functions
- **User Binding**: `tokenIdentifier` links Clerk identity to Convex user record

### Role-Based Access Control (RBAC)

Three roles per project:

| Role | Permissions |
|------|-------------|
| **Owner** | Full control, delete project, manage all members |
| **Admin** | CRUD variables/environments, share secrets, add members |
| **Member** | Read-only access to variables |

### Access Control Enforcement

Every Convex mutation/query:
1. Validates JWT via `getUserIdentity()`
2. Looks up user in database
3. Checks project membership
4. Verifies role has required permission

## Data Protection

### At Rest

| Data | Storage | Protection |
|------|---------|------------|
| Master Key | Not stored | Only hash + salt stored |
| Project Passcode | Convex | Encrypted with Master Key |
| Environment Variables | Convex | Encrypted with Project Key |
| Shared Secrets | Convex | Encrypted with Share Key |

### In Transit

- All connections use HTTPS/WSS
- Convex uses encrypted WebSocket connections
- Clerk handles OAuth flows over HTTPS

### In Memory

- `CryptoKey` objects stored in `keyStore` (Map)
- Cleared on logout (`keyStore.clear()`)
- Cleared on project lock (`keyStore.removeKey()`)
- Never persisted to localStorage/sessionStorage

## Security Headers

Implemented via Nitro middleware and config:

| Header | Value | Purpose |
|--------|-------|---------|
| `Content-Security-Policy` | Allowlist for self, Clerk, Convex, fonts | Prevent XSS |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `X-XSS-Protection` | `1; mode=block` | Legacy XSS filter |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Control referrer leakage |
| `Permissions-Policy` | Disable camera, mic, geo | Limit browser APIs |

## Input Validation

### Client-Side

- Passcodes: Regex `/^\d{6}$/` + `maxLength={6}` + non-digit stripping
- Form validation before API calls

### Server-Side (Convex)

- All arguments use strict `v.*` validators
- Type-safe document IDs with `v.id("table")`
- No raw SQL (document database)

## Threat Model

### Protected Against

✅ Eavesdropping (encryption at rest + in transit)
✅ Server compromise (zero-knowledge design)
✅ XSS attacks (CSP + React's escaping)
✅ Clickjacking (X-Frame-Options: DENY)
✅ CSRF (Convex's token-based auth)
✅ IDOR (ownership verification on all resources)
✅ SQL Injection (N/A - document database)
✅ Unauthorized access (RBAC on all mutations)

### Out of Scope

⚠️ Client-side keyloggers (user's machine compromised)
⚠️ Shoulder surfing (physical access)
⚠️ Weak passcodes (6-digit provides ~1M combinations)
⚠️ Forgotten master key (no recovery possible by design)

## Security Checklist for Contributors

- [ ] Never log secrets or keys (check `console.log` calls)
- [ ] Use `deriveKey()` for key derivation, never raw passwords
- [ ] Generate fresh IV/salt for every encryption
- [ ] Validate user identity in every Convex mutation
- [ ] Check project membership before resource access
- [ ] Use `v.*` validators for all mutation arguments
- [ ] Clear keys on logout/navigation
