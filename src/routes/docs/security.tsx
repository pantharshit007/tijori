import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Check,
  ExternalLink,
  Lock,
  Shield,
  Zap,
  Info,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DocsHeader } from "@/components/docs-components";

export const Route = createFileRoute("/docs/security")({
  component: SecurityDocsPage,
});

function SecurityDocsPage() {
  return (
    <div className="docs-page-container space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Hero */}
      <section className="space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary">
          <ShieldCheck className="h-3.5 w-3.5" />
          Validated Security
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl text-balance">
          Zero-Knowledge <span className="text-primary">Architecture</span>
        </h1>
        <p className="sm:text-lg text-sm text-muted-foreground max-w-3xl leading-relaxed">
          Tijori is built on the principle that we should never have access to your secrets. All
          encryption and decryption happens exclusively in your browser.
        </p>
      </section>

      {/* Overview Card */}
      <section>
        <Card className="border-primary/20 bg-primary/5 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Lock className="h-32 w-32" />
          </div>
          <CardHeader className="relative z-10">
            <CardTitle className="text-2xl font-bold">The Core Philosophy</CardTitle>
            <CardDescription className="text-base text-foreground/70 leading-relaxed max-w-2xl">
              Even if our database were fully compromised, your secrets would remain encrypted and
              unusable. We store only salted hashes of your passcodes and strongly encrypted blobs
              of data.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>

      {/* Encryption Stack */}
      <section className="space-y-8">
        <div className="space-y-2">
          <DocsHeader className="mb-2">Security Stack</DocsHeader>
          <p className="text-muted-foreground">
            Modern cryptographic standards powered by the Web Crypto API.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="bg-muted/30 border-none">
            <CardHeader>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Lock className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">AES-256-GCM</CardTitle>
              <CardDescription>Symmetric Encryption</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-relaxed">
              We use 256-bit keys with a 96-bit IV. This provides authenticated encryption, ensuring
              both the confidentiality and integrity of your secrets.
            </CardContent>
          </Card>

          <Card className="bg-muted/30 border-none">
            <CardHeader>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Zap className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">PBKDF2</CardTitle>
              <CardDescription>Key Derivation</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-relaxed">
              Keys are derived using 100,000 iterations of SHA-256 with random salts. This makes
              brute-force attacks on your passcodes extremely difficult.
            </CardContent>
          </Card>

          <Card className="bg-muted/30 border-none">
            <CardHeader>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Shield className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">SHA-256</CardTitle>
              <CardDescription>Secure Hashing</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-relaxed">
              We never store your passcodes. Instead, we store a secure SHA-256 hash to verify
              correctness during the unlock process.
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Key Hierarchy Visualization */}
      <section className="space-y-8">
        <div className="space-y-2">
          <DocsHeader className="mb-2">Key Hierarchy</DocsHeader>
          <p className="text-muted-foreground">
            How your master key and project passcodes interact.
          </p>
        </div>
        <div className="rounded-2xl border border-border/50 bg-muted/20 p-8 font-mono text-sm">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                1
              </div>
              <div>
                <span className="text-foreground font-bold font-sans">Master Key</span>
                <span className="text-muted-foreground ml-2">→ Derives Master CryptoKey</span>
              </div>
            </div>
            <div className="ml-4 h-8 w-px bg-border"></div>
            <div className="flex items-center gap-4">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                2
              </div>
              <div>
                <span className="text-foreground font-bold font-sans">Project Passcode</span>
                <span className="text-muted-foreground ml-2">
                  → Encrypted by Master Key (for recovery)
                </span>
              </div>
            </div>
            <div className="ml-4 h-8 w-px bg-border"></div>
            <div className="flex items-center gap-4">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                3
              </div>
              <div>
                <span className="text-foreground font-bold font-sans">Project CryptoKey</span>
                <span className="text-muted-foreground ml-2">
                  → Encrypts all Environment Variables
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Threat Model */}
      <section className="space-y-8">
        <DocsHeader>Threat Model</DocsHeader>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-500 font-bold">
              <Check className="h-5 w-5" />
              <h3>Protected Against</h3>
            </div>
            <ul className="space-y-3">
              {[
                "Eavesdropping (encryption in transit)",
                "Server compromise (zero-knowledge design)",
                "XSS attacks (strict CSP + React escaping)",
                "CSRF (token-based auth)",
                "Unauthorized data access (RBAC)",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-sm text-muted-foreground font-medium"
                >
                  <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-green-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-amber-500 font-bold">
              <AlertTriangle className="h-5 w-5" />
              <h3>Out of Scope</h3>
            </div>
            <ul className="space-y-3">
              {[
                "Compromised user machine (keyloggers)",
                "Physical access (shoulder surfing)",
                "Weak 6-digit passcodes (high-entropy required)",
                "Forgotten master key (no recovery possible)",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-sm text-muted-foreground text-balance font-medium"
                >
                  <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Security Headers */}
      <section className="space-y-8">
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-primary" />
          <DocsHeader className="mb-0">Response Headers</DocsHeader>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border/50 bg-muted/20 backdrop-blur-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border/50">
              <tr>
                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-muted-foreground">
                  Security Header
                </th>
                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-muted-foreground">
                  Production Value
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 font-mono text-xs">
              {[
                { name: "Content-Security-Policy", val: "Strict allowlist" },
                { name: "X-Content-Type-Options", val: "nosniff" },
                { name: "X-Frame-Options", val: "DENY" },
                { name: "Referrer-Policy", val: "strict-origin-when-cross-origin" },
              ].map((h) => (
                <tr key={h.name} className="transition-colors hover:bg-muted/30">
                  <td className="px-6 py-4 font-bold text-foreground">{h.name}</td>
                  <td className="px-6 py-4 text-muted-foreground font-medium">{h.val}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Disclosure */}
      <section className="rounded-3xl border border-border/60 bg-linear-to-t from-muted/20 to-transparent p-8 sm:p-12 text-center space-y-6">
        <h2 className="text-2xl font-black tracking-tight">Reporting a Vulnerability</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed font-medium">
          We take security seriously. If you've discovered a vulnerability, please report it
          responsibly through our security portal on GitHub.
        </p>
        <div className="pt-4">
          <a
            href="https://github.com/pantharshit007/tijori/security"
            target="_blank"
            rel="noreferrer"
          >
            <Button
              size="lg"
              className="rounded-xl gap-2 font-bold shadow-lg shadow-primary/10 transition-all hover:scale-105"
            >
              <ExternalLink className="h-4 w-4" />
              Open Security Policy
            </Button>
          </a>
        </div>
      </section>

      <div className="flex justify-center pt-8 border-t border-border/40">
        <Link to="/d/dashboard">
          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-foreground font-medium"
          >
            Return to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
