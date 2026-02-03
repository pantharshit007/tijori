import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/docs/deployment")({
  component: DeploymentDocsPage,
});

function DeploymentDocsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-12">
      <section className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Deployment
        </p>
        <h1 className="text-4xl font-bold tracking-tight">Ship Tijori to production</h1>
        <p className="text-muted-foreground text-lg">
          This guide covers the minimum required setup: Clerk for auth, Convex for backend, and an
          optional Vercel frontend deploy.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle>Before you begin</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Ensure these are ready before deploying:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Clerk application with a production instance.</li>
              <li>Convex project linked to your repo.</li>
              <li>Production domain (if using Clerk custom domain).</li>
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Environment variables</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>These are the required env vars (see `.env.example`).</p>
            <pre className="rounded-lg border bg-muted/50 p-3 text-xs">
{`# Convex
CONVEX_DEPLOYMENT=
VITE_CONVEX_URL=
CONVEX_URL=

# Clerk
VITE_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_JWT_ISSUER_DOMAIN=`}
            </pre>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">1. Configure Clerk</h2>
        <div className="space-y-3 text-muted-foreground">
          <p>
            Create a Clerk application and grab the publishable key, secret key, and JWT issuer
            domain from the Clerk dashboard.
          </p>
          <p>
            Set the following variables in your deployment environment (frontend + server where
            applicable):
          </p>
        </div>
        <Card>
          <CardContent className="space-y-3 p-5 text-sm text-muted-foreground">
            <pre className="rounded-lg border bg-muted/50 p-3 text-xs">
{`VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_JWT_ISSUER_DOMAIN=https://your-instance.clerk.accounts.dev`}
            </pre>
            <p>
              If you use a custom Clerk domain, make sure the issuer domain matches that domain.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">2. Configure Convex</h2>
        <div className="space-y-3 text-muted-foreground">
          <p>
            Convex runs in a separate runtime. It needs its own environment variables set via the
            CLI.
          </p>
          <p>
            After linking your Convex project, set the Clerk issuer domain inside the Convex
            deployment:
          </p>
        </div>
        <Card>
          <CardContent className="space-y-3 p-5 text-sm text-muted-foreground">
            <pre className="rounded-lg border bg-muted/50 p-3 text-xs">
{`bunx convex env set CLERK_JWT_ISSUER_DOMAIN "https://your-instance.clerk.accounts.dev"

bunx convex env list`}
            </pre>
            <p>
              The Convex auth config reads `process.env.CLERK_JWT_ISSUER_DOMAIN` in the Convex
              runtime, not from Vite or Node.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">3. Optional: Deploy with Vercel</h2>
        <div className="space-y-3 text-muted-foreground">
          <p>
            You can deploy the frontend to Vercel and point it at your Convex backend. Add the same
            environment variables in the Vercel project settings.
          </p>
          <p>
            Build command and output can follow the default Bun + Vite configuration.
          </p>
        </div>
        <Card>
          <CardContent className="space-y-3 p-5 text-sm text-muted-foreground">
            <pre className="rounded-lg border bg-muted/50 p-3 text-xs">
{`# Example Vercel settings
Build Command: bun run build
Output Directory: (use the framework default)`}
            </pre>
            <p>
              Leave the output directory unset unless your hosting provider asks for a custom
              value.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
