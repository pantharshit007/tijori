# Tijori

> **तिजोरी** (Hindi for "vault/safe") - A secure environment variables manager with zero-knowledge encryption.

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](LICENSE)

## Overview

Tijori is a self-hosted secrets management tool that keeps your environment variables encrypted. The server **never** sees your plaintext secrets - all encryption happens client-side in your browser.

### Key Features

- 🔐 **Zero-Knowledge Architecture** - Server only stores encrypted data
- 🔑 **End-to-End Encryption** - AES-256-GCM with PBKDF2 key derivation
- 👥 **Team Collaboration** - Role-based access (Owner/Admin/Member)
- 🔗 **Secure Sharing** - Time-limited encrypted share links
- 🌐 **Modern Stack** - React, TanStack Router, Convex, Clerk

## Tech Stack

| Layer    | Technology                             |
| -------- | -------------------------------------- |
| Frontend | TanStack Start (React + Router + SSR)  |
| Backend  | Convex (Realtime database + functions) |
| Auth     | Clerk (OAuth 2.0)                      |
| Styling  | Tailwind CSS v4 + shadcn/ui            |
| Crypto   | Web Crypto API (client-side)           |
| Runtime  | Bun                                    |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (or Node.js 20+)
- [Convex](https://convex.dev/) account
- [Clerk](https://clerk.com/) account

### Installation

```bash
# Clone the repository
git clone https://github.com/pantharshit007/tijori.git
cd tijori

# Install dependencies
bun install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Convex and Clerk credentials

# Start development servers
bun run dev        # Frontend (http://localhost:3000)
bun cvx:dev        # Convex backend (separate terminal)
```

### Commands

| Command         | Description             |
| --------------- | ----------------------- |
| `bun run dev`   | Start Vite dev server   |
| `bun cvx:dev`   | Start Convex dev server |
| `bun test`      | Run tests               |
| `bun run lint`  | Run ESLint              |
| `bun run check` | Run Prettier + ESLint   |
| `bun run build` | Production build        |

## Security

Tijori uses industry-standard cryptography:

- **AES-256-GCM** for symmetric encryption
- **PBKDF2** with 100,000 iterations for key derivation
- **SHA-256** for hashing

See [docs/SECURITY.md](docs/SECURITY.md) for the full security architecture.

### Reporting Vulnerabilities

Please **do not** open public issues for security vulnerabilities. See our [Security Disclosure Policy](docs/SECURITY.md#security-disclosure-policy) for responsible reporting.

## Project Structure

```
tijori/
├── convex/           # Backend (Convex functions + schema)
├── src/
│   ├── components/   # React components
│   ├── hooks/        # Custom React hooks
│   ├── lib/          # Utilities (crypto, constants)
│   └── routes/       # TanStack Router pages
├── server/           # Nitro middleware
├── docs/             # Documentation
└── test/             # Tests
```

## Contributing

Contributions are welcome! Please read the security checklist in [docs/SECURITY.md](docs/SECURITY.md#security-checklist-for-contributors) before submitting PRs that touch crypto or auth code.

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

The AGPL ensures that if you run a modified version on a server, you must make the source code available. See the [LICENSE](./LICENSE) file for details.

---

Made with 🔒 by [@pantharshit007](https://x.com/pantharshit007)

#### धन्यवाद
