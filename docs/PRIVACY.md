# Tijori Privacy & Compliance (GDPR)

> Last Updated: January 26, 2026

## Overview

Tijori is designed with "Privacy by Design" and "Privacy by Default" principles. Due to its **zero-knowledge architecture**, the service has several inherent privacy-preserving features that align with GDPR (General Data Protection Regulation) requirements.

## Data Processing Roles

- **Data Controller**: The user/organization hosting and using Tijori.
- **Data Processor**: The infrastructure providers used by Tijori (Convex, Clerk).
- **Sub-processors**: Clerk (Identity Management), Convex (Backend-as-a-Service).

## Data Types Collected

### 1. Personal Identity Data (Managed by Clerk)

- Name
- Email Address
- Profile Image URL
- OAuth Provider IDs (e.g., Google/GitHub ID)

### 2. Encrypted Secret Data (Managed by Convex)

- Project Names/Descriptions
- **Encrypted** Environment Variable Names and Values
- **Encrypted** Passcodes
- **Encrypted** Share Keys

**Note**: All secret data is encrypted client-side. The server and infrastructure providers do not have access to the decryption keys.

## GDPR Principles Alignment

### 1. Data Minimization

Tijori only collects the bare minimum data required for authentication and secret management. We do not track user behavior or collect analytics beyond what is provided by Clerk/Convex.

### 2. Integrity and Confidentiality (Security)

Tijori uses AES-256-GCM encryption for all sensitive data at rest. Data is transmitted over encrypted channels (HTTPS/WSS).

### 3. Purpose Limitation

Data is used solely for the purpose of managing and sharing environment variables as directed by the user.

### 4. Right to Access and Portability

Users can view all their projects and secrets at any time through the interface. Data can be exported by copying variable values (decrypted client-side).

### 5. Right to Erasure ("Right to be Forgotten")

- Users can delete individual variables, environments, and entire projects.
- Deleting a project removes all associated variables, shared secrets, and memberships from the database.

## Privacy Recommendations for Self-Hosters

If you are self-hosting Tijori or using it in a corporate environment:

1. **Clerk Configuration**: Ensure your Clerk settings are configured to respect user privacy preferences.
2. **Data Retention**: Periodically audit and delete old projects or shared secrets that are no longer needed.
3. **Access Control**: Use the built-in RBAC (Owner/Admin/Member) to restrict access to sensitive data on a need-to-know basis.

## Disclosure

Tijori does not sell user data. All data is stored on Convex (sensitive data is encrypted) and managed through Clerk. For more information on their privacy practices, please refer to:

- [Clerk Privacy Policy](https://clerk.com/privacy)
- [Convex Privacy Policy](https://www.convex.dev/privacy)
