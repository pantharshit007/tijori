# Tijori Security Guide

Canonical system design lives in [ARCHITECTURE.md](./ARCHITECTURE.md). This file is intentionally narrower: it covers the controls contributors should preserve and the process for reporting vulnerabilities.

## Security Controls

- Secret values are encrypted and decrypted in the browser.
- Project passcodes are verified server-side with `projects.passcodeHash`, but plaintext passcodes are not persisted.
- Convex functions authenticate with Clerk identity and re-check project membership or role before reading or mutating data.
- Nitro middleware sets `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, and `Permissions-Policy` headers.

## Security Checklist for Contributors

- Never log secrets, passcodes, keys, or decrypted payloads.
- Keep secret-value encryption and decryption in the browser.
- Use `deriveKey()`, `encrypt()`, `decrypt()`, and `hash()` instead of ad hoc crypto code.
- Generate a fresh salt or IV for every encryption operation.
- Authenticate every Convex entry point with `ctx.auth.getUserIdentity()`.
- Re-check project membership and role before resource access.
- Use strict `v.*` validators and typed document IDs in Convex functions.
- Clear project keys from `keyStore` on lock, logout, deactivation, and deletion flows.
- Treat `src/lib/crypto.ts`, `src/lib/key-store.ts`, `convex/schema.ts`, `convex/projects.ts`, and `convex/sharedSecrets.ts` as security-sensitive files.
- Review metadata exposure separately from secret encryption. Project names, environment names, variable names, roles, and timestamps are not ciphertext.

## Threat Model

### Protected Against

- Backend or database access to plaintext secret values
- Network eavesdropping during normal app traffic
- Unauthorized project access when auth and RBAC checks are implemented correctly
- Common browser attack classes mitigated by headers and React escaping

### Out of Scope

- Compromised client devices or browsers
- Shoulder surfing, clipboard leakage, or other local machine exposure
- Weak passcodes chosen by users
- Recovery of forgotten master keys without the original secret

## Security Disclosure Policy

Do not open public GitHub issues for vulnerabilities. Use the repository's private security reporting flow instead:

- GitHub Security: <https://github.com/pantharshit007/tijori/security>

Please include:

- A short description of the issue
- Reproduction steps
- Expected impact
- Suggested remediation, if available
