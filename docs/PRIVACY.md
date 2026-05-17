# Tijori Privacy & Data Handling

System design lives in [ARCHITECTURE.md](./ARCHITECTURE.md). This file focuses on what data exists, where it lives, and what is and is not encrypted.

## Data Locations

### Clerk

- Authentication identity and session data
- Basic profile fields such as name, email, avatar, and provider identifiers

### Convex

- Project metadata such as names, descriptions, passcode hints, ownership, and timestamps
- Environment names and descriptions
- Variable names
- Membership roles, quota documents, share metadata, and view or expiry counters
- Encrypted project passcodes, encrypted variable values, encrypted share payloads, encrypted share keys, and encrypted share passcodes
- Account state such as master key verifier fields, tier, and deletion or deactivation metadata

### Browser Session Only

- Plaintext master keys while entered by the user
- Plaintext project and share passcodes while entered by the user
- Decrypted variable values shown in the UI
- Derived `CryptoKey` objects cached in memory via `keyStore`

## What Is Not Encrypted

Tijori is zero-knowledge for secret values, not for all application metadata. The backend can still see:

- Project, environment, and variable names
- Descriptions and passcode hints
- Membership and role data
- Timestamps, quotas, expiry values, and share view counters
- Account and billing metadata

## Provider Notes

- Clerk handles authentication and related identity data.
- Convex stores application state and encrypted blobs.
- Deployment providers may collect standard request logs, telemetry, or error data.
- The frontend includes `@vercel/analytics`, so hosted deployments may also emit Vercel Analytics events depending on environment and platform configuration.

## User Controls

- Users can delete variables, environments, shares, and projects from the application.
- Account deletion work is tracked server-side through `deletionJobs`.
- Keys are not persisted to `localStorage` or `sessionStorage`.

## References

- [Security](./SECURITY.md)
- [Clerk Privacy Policy](https://clerk.com/privacy)
- [Convex Privacy Policy](https://www.convex.dev/privacy)
