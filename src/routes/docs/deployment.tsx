import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, ChevronRight, ExternalLink, Terminal } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DocsCodeBlock, DocsStepHeader } from "@/components/docs-components";
import { SITE_CONFIG } from "@/utilities/site-config";

export const Route = createFileRoute("/docs/deployment")({
  head: () => ({
    meta: [
      { title: SITE_CONFIG.pages.deployment },
      { name: "description", content: SITE_CONFIG.description },
      { property: "og:title", content: SITE_CONFIG.pages.deployment },
      { property: "og:description", content: SITE_CONFIG.description },
      { property: "og:url", content: `${SITE_CONFIG.siteUrl}/docs/deployment` },
      { property: "og:image", content: SITE_CONFIG.ogImage },
      { name: "twitter:title", content: SITE_CONFIG.pages.deployment },
      { name: "twitter:description", content: SITE_CONFIG.description },
      { name: "twitter:image", content: SITE_CONFIG.ogImage },
    ],
  }),
  component: DeploymentDocsPage,
});

const prerequisites = [
  "Clerk Account & Production Instance",
  "Convex Account",
  "Vercel Account (for frontend)",
  "A production domain (recommended)",
];

const finalRequiredKeys = [
  "CONVEX_DEPLOYMENT",
  "VITE_CONVEX_URL",
  "CONVEX_DEPLOY_KEY",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "CLERK_JWT_ISSUER_DOMAIN",
  "CLERK_JWKS_FIELD",
];

function DeploymentDocsPage() {
  return (
    <div className="docs-page-container space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Page Header */}
      <section className="space-y-4">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Production Deployment
        </h1>
        <p className="text-lg text-muted-foreground max-w-3xl leading-relaxed">
          Follow this guide to set up your production environment. Tijori requires Clerk for
          authentication and Convex for its realtime backend.
        </p>
      </section>

      {/* Prerequisites */}
      <section className="grid gap-6 md:grid-cols-2">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center gap-2 text-primary">
              <CheckCircle2 className="h-5 w-5" />
              <CardTitle>Prerequisites</CardTitle>
            </div>
            <CardDescription>What you need before you start</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3">
              {prerequisites.map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-foreground/80">
                  <ChevronRight className="h-4 w-4 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader>
            <div className="flex items-center gap-2 text-amber-500">
              <AlertCircle className="h-5 w-5" />
              <CardTitle className="important-note">Important Note</CardTitle>
            </div>
            <CardDescription>Security and Persistence</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-foreground/80 leading-relaxed">
            Ensure your Convex deployment is pinned to a stable version. Never share your
            <code className="mx-1 bg-amber-500/10 font-mono text-amber-600 rounded-[5px] px-1 py-0.5">
              CONVEX_DEPLOY_KEY
            </code>
            publicly. This key allows full administrative access to your database.
          </CardContent>
        </Card>
      </section>

      {/* Step 1: Clerk */}
      <section className="space-y-8">
        <div className="space-y-3">
          <DocsStepHeader>Configure Clerk Authentication</DocsStepHeader>
          <p className="text-muted-foreground leading-relaxed">
            Clerk handles identity management and secure session tokens for Tijori.
          </p>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-border/50 bg-muted/30 p-6 space-y-4">
            <h3 className="font-bold text-foreground">1. Create a Production Instance</h3>
            <p className="doc-p-tag">
              In your Clerk dashboard, navigate to your application and ensure you are in the{" "}
              <strong>Production</strong> environment settings.
            </p>
            <p className="doc-p-tag">
              Generate your production keys, and since convex doesn't support{" "}
              <span className="rounded-[5px] bg-muted-foreground/20 px-1 py-0.5">*.vercel.app</span>{" "}
              domains, you have to use your own domain, setup your records, for detailed guide,
              check the offical{" "}
              <a
                href={SITE_CONFIG.links.clerkProdGuide}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline underline-offset-4"
              >
                Clerk docs
              </a>
            </p>
          </div>

          <div className="rounded-2xl border border-border/50 bg-muted/30 p-6 space-y-4">
            <h3 className="font-bold text-foreground">2. Obtain API Keys</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Copy these keys into your local{" "}
              <code className="rounded-[5px] bg-muted-foreground/20 px-1 py-0.5">.env.prod</code>{" "}
              and your Vercel environment variables.
            </p>
            <DocsCodeBlock
              language="env"
              code={`VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_JWKS_FIELD=https://clerk.custom.domain/.well-known/jwks.json
CLERK_JWT_ISSUER_DOMAIN=https://clerk.custom.domain
`}
            />
          </div>
        </div>
      </section>

      {/* Step 2: Convex */}
      <section className="space-y-8">
        <div className="space-y-3">
          <DocsStepHeader>Initialize Convex Backend</DocsStepHeader>
          <p className="text-muted-foreground leading-relaxed">
            Convex powers the database, serverless functions, and real-time synchronization.
          </p>
        </div>

        <div className="space-y-6">
          <Card className="border-none bg-muted/30">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Terminal className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg font-bold">Convex Environment Variables</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Before deploying, make sure your schema is synced with Clerk. Once, your schema is
                in sync, generate the keys from the production instance via dashboard or from{" "}
                <a
                  className="text-primary underline underline-offset-4"
                  href={SITE_CONFIG.links.convexDeploymentSettings}
                  target="_blank"
                  rel="noreferrer"
                >
                  Deployment Settings
                </a>
              </p>
              <DocsCodeBlock
                code={`# Once logged in, deloy schema to convex
bun run cvx:deploy
`}
              />
              <DocsCodeBlock
                code={`# All production keys
CONVEX_DEPLOYMENT=cultured-man-99
VITE_CONVEX_URL=https://cultured-man-99.convex.cloud
CONVEX_DEPLOY_KEY=prod:cultured-man-99|abc123...
`}
              />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Step 3: Vercel */}
      <section className="space-y-8">
        <div className="space-y-3">
          <DocsStepHeader>Deploy Frontend to Vercel</DocsStepHeader>
          <p className="doc-p-tag mb-1">
            The final step is to host the React application and connect it to your backend.
          </p>
          <p className="doc-p-tag">
            For detailed guide, on deployment not only to vercel but also to any other platform,
            check the offical{" "}
            <a
              href={SITE_CONFIG.links.convexVercelGuide}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-4"
            >
              Convex Deployment Guide
            </a>
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="text-lg text-foreground font-bold">Build Settings</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-border/40">
                <span className="text-muted-foreground">Framework Preset</span>
                <span className="font-bold">Tanstack Start</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/40">
                <span className="text-muted-foreground">
                  Build Command <span className="text-xs">(vercel)</span>
                </span>
                <code className="rounded-[5px] bg-muted-foreground/20 px-2 py-0.5 text-xs font-mono">
                  bun run build:vercel
                </code>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-muted-foreground">Output Directory</span>
                <code className="rounded-[5px] bg-muted-foreground/20 px-2 py-0.5 text-xs font-mono">
                  dist
                </code>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="text-lg text-foreground font-bold">
                Environment Variables
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-3">
              <p className="text-muted-foreground">Add these to Vercel Project Settings:</p>
              <ul className="space-y-2 font-mono text-[11px] font-bold">
                {finalRequiredKeys.map((key) => (
                  <li key={key} className="flex items-center gap-2">
                    <div className="h-1 w-1 rounded-full bg-primary"></div>
                    {key}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Troubleshooting */}
      <section className="rounded-3xl border border-border/50 bg-card/40 p-10 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">Troubleshooting</h2>
        <div className="space-y-4">
          <details className="group rounded-xl border border-border/40 bg-background/50 p-4 transition-all">
            <summary className="flex cursor-pointer items-center justify-between font-bold">
              <span>"Unauthorized" errors in Convex</span>
              <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
            </summary>
            <div className="mt-4 text-sm text-muted-foreground leading-relaxed pl-4 border-l-2 border-primary/30 font-medium">
              This usually happens if{" "}
              <code className="rounded bg-muted px-1.5">CLERK_JWT_ISSUER_DOMAIN</code> is not set
              correctly in Convex or if the Clerk instance is not in production mode. Verify the
              environment variable in Convex via{" "}
              <code className="rounded bg-muted px-1">bunx convex env list</code>.
            </div>
          </details>
          <details className="group rounded-xl border border-border/40 bg-background/50 p-4 transition-all">
            <summary className="flex cursor-pointer items-center justify-between font-bold">
              <span>Variables not decrypting in production</span>
              <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
            </summary>
            <div className="mt-4 text-sm text-muted-foreground leading-relaxed pl-4 border-l-2 border-primary/30 font-medium">
              Check if your browser's Web Crypto API is restricted by Content Security Policy (CSP).
              Tijori requires full access to{" "}
              <code className="rounded bg-muted px-1.5">crypto.subtle</code>. Ensure your hosting
              provider isn't injecting overly restrictive headers.
            </div>
          </details>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-12 border-t border-border/40">
        <p className="text-muted-foreground mb-6 font-medium">Need further assistance?</p>
        <div className="flex justify-center gap-4">
          <a href={SITE_CONFIG.links.githubIssues} target="_blank" rel="noreferrer">
            <Button variant="outline" className="gap-2 font-bold" title="Open GitHub issues">
              <ExternalLink className="h-4 w-4" />
              GitHub Issues
            </Button>
          </a>
        </div>
      </footer>
    </div>
  );
}
