import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Check, ExternalLink, KeyRound, Lock, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/docs/security")({
  component: SecurityDocsPage,
});

function SecurityDocsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="container flex h-16 max-w-5xl items-center justify-between mx-auto px-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <KeyRound className="size-5" />
            </div>
            <span>Tijori</span>
          </Link>
          <Link to="/">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="size-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 py-16 space-y-16">
        {/* Hero */}
        <section className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary">
            <Shield className="size-3" />
            Security Architecture
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Zero-Knowledge by Design
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Tijori is built from the ground up with security as the primary concern. Your secrets
            are encrypted in your browser and never leave your device in plaintext.
          </p>
        </section>

        {/* Overview */}
        <section className="space-y-8">
          <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
          <p className="text-muted-foreground leading-relaxed">
            Tijori employs a <strong>zero-knowledge architecture</strong> where the server never
            sees plaintext secrets. All encryption and decryption happens client-side in the browser
            using the Web Crypto API. Even if our database were compromised, your secrets would
            remain encrypted and unusable without your passcodes.
          </p>
        </section>

        {/* Encryption Stack */}
        <section className="space-y-8">
          <h2 className="text-2xl font-bold tracking-tight">Encryption Stack</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="size-5 text-primary" />
                  AES-256-GCM
                </CardTitle>
                <CardDescription>Symmetric Encryption</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>256-bit key, 96-bit IV, 128-bit authentication tag.</p>
                <p>
                  Provides both confidentiality and integrity. If any bit of the ciphertext is
                  tampered with, decryption will fail.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="size-5 text-primary" />
                  PBKDF2
                </CardTitle>
                <CardDescription>Key Derivation</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>100,000 iterations with SHA-256 and a 128-bit salt.</p>
                <p>
                  Derives a cryptographic key from your 6-digit passcode. High iteration count makes
                  brute-force attacks computationally expensive.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="size-5 text-primary" />
                  SHA-256
                </CardTitle>
                <CardDescription>Hashing</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>Salted hashing for passcode verification.</p>
                <p>
                  We store a hash of your passcode for verification, but never the passcode itself.
                  This allows us to confirm correctness without knowing the value.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Key Hierarchy */}
        <section className="space-y-8">
          <h2 className="text-2xl font-bold tracking-tight">Key Hierarchy</h2>
          <Card className="p-6 bg-muted/30">
            <pre className="text-sm font-mono whitespace-pre-wrap text-muted-foreground">
              {`Master Key (memorized)
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
        └── Encrypts all Environment Variables`}
            </pre>
          </Card>
        </section>

        {/* What We Protect Against */}
        <section className="space-y-8">
          <h2 className="text-2xl font-bold tracking-tight">Threat Model</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-green-500">Protected Against</h3>
              <ul className="space-y-2">
                {[
                  "Eavesdropping (encryption at rest + in transit)",
                  "Server compromise (zero-knowledge design)",
                  "XSS attacks (CSP + React's escaping)",
                  "Clickjacking (X-Frame-Options: DENY)",
                  "CSRF (Convex's token-based auth)",
                  "IDOR (ownership verification on all resources)",
                  "SQL Injection (N/A - document database)",
                  "Unauthorized access (RBAC on all mutations)",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="size-4 text-green-500 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-amber-500">Out of Scope</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">⚠️</span>
                  Client-side keyloggers (user's machine compromised)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">⚠️</span>
                  Shoulder surfing (physical access)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">⚠️</span>
                  Weak passcodes (6-digit provides ~1M combinations)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">⚠️</span>
                  Forgotten master key (no recovery possible by design)
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Security Headers */}
        <section className="space-y-8">
          <h2 className="text-2xl font-bold tracking-tight">Security Headers</h2>
          <p className="text-muted-foreground">
            In production, Tijori serves responses with the following security headers:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold">Header</th>
                  <th className="text-left py-3 px-4 font-semibold">Value</th>
                  <th className="text-left py-3 px-4 font-semibold">Purpose</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b">
                  <td className="py-3 px-4 font-mono text-xs">Content-Security-Policy</td>
                  <td className="py-3 px-4">Strict allowlist</td>
                  <td className="py-3 px-4">Prevent XSS</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4 font-mono text-xs">X-Content-Type-Options</td>
                  <td className="py-3 px-4">nosniff</td>
                  <td className="py-3 px-4">Prevent MIME sniffing</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4 font-mono text-xs">X-Frame-Options</td>
                  <td className="py-3 px-4">DENY</td>
                  <td className="py-3 px-4">Prevent clickjacking</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4 font-mono text-xs">Referrer-Policy</td>
                  <td className="py-3 px-4">strict-origin-when-cross-origin</td>
                  <td className="py-3 px-4">Control referrer leakage</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-mono text-xs">Permissions-Policy</td>
                  <td className="py-3 px-4">camera=(), microphone=(), geolocation=()</td>
                  <td className="py-3 px-4">Disable unused browser APIs</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Disclosure */}
        <section className="space-y-8">
          <h2 className="text-2xl font-bold tracking-tight">Reporting a Vulnerability</h2>
          <Card className="p-6">
            <CardContent className="p-0 space-y-4">
              <p className="text-muted-foreground">
                We take security seriously. If you discover a security vulnerability, please follow
                responsible disclosure:
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                <li>
                  <strong>Do NOT</strong> open a public GitHub issue for security vulnerabilities.
                </li>
                <li>Email security concerns to the project maintainers.</li>
                <li>Include a description, steps to reproduce, and potential impact.</li>
              </ul>
              <div className="pt-4">
                <a
                  href="https://github.com/pantharshit007/tijori/security"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button variant="outline" className="gap-2">
                    <ExternalLink className="size-4" />
                    View Security Policy on GitHub
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* CTA */}
        <section className="text-center py-8">
          <Link to="/d/dashboard">
            <Button size="lg" className="gap-2">
              Go to Dashboard
            </Button>
          </Link>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Tijori. Released under AGPL-3.0.
      </footer>
    </div>
  );
}
