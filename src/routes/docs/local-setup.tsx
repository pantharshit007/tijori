import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Code2, Info, Laptop, Terminal } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DocsCodeBlock, DocsStepHeader } from "@/components/docs-components";
import { SITE_CONFIG } from "@/utilities/site-config";

export const Route = createFileRoute("/docs/local-setup")({
  head: () => ({
    meta: [
      { title: SITE_CONFIG.pages.localSetup },
      { name: "description", content: SITE_CONFIG.description },
      { property: "og:title", content: SITE_CONFIG.pages.localSetup },
      { property: "og:description", content: SITE_CONFIG.description },
      { property: "og:url", content: `${SITE_CONFIG.siteUrl}/docs/local-setup` },
      { property: "og:image", content: SITE_CONFIG.ogImage },
      { name: "twitter:title", content: SITE_CONFIG.pages.localSetup },
      { name: "twitter:description", content: SITE_CONFIG.description },
      { name: "twitter:image", content: SITE_CONFIG.ogImage },
    ],
  }),
  component: LocalSetupPage,
});

const softwareRequirements = [
  "Bun runtime (recommended) or Node.js 20+",
  "Git installed and configured",
  "A modern browser (Chrome, Firefox, Safari)",
  "VS Code or your preferred editor",
];

const accountsNeeded = ["Convex Cloud account", "Clerk account (for auth)"];

function LocalSetupPage() {
  return (
    <div className="docs-page-container space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Page Header */}
      <section className="space-y-4">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Local Development</h1>
        <p className="text-lg text-muted-foreground max-w-3xl leading-relaxed">
          Set up Tijori on your local machine for development and testing.
        </p>
      </section>

      {/* Prerequisites */}
      <section className="grid gap-6 md:grid-cols-2">
        <Card className="border-primary/20 bg-primary/5 rounded-lg">
          <CardHeader>
            <div className="flex items-center gap-2 text-primary">
              <Laptop className="h-5 w-5" />
              <CardTitle>Software</CardTitle>
            </div>
            <CardDescription>Requirements for your dev environment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3">
              {softwareRequirements.map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-foreground/80">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-muted bg-muted/20 rounded-lg">
          <CardHeader>
            <div className="flex items-center gap-2 text-foreground">
              <Code2 className="h-5 w-5" />
              <CardTitle>Accounts Needed</CardTitle>
            </div>
            <CardDescription>Cloud services used by Tijori</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3">
              {accountsNeeded.map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-foreground/80">
                  <div className="h-1.5 w-1.5 rounded-full bg-foreground/40" />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Step 1: Clone and Install */}
      <section>
        <DocsStepHeader>Clone and Install Dependencies</DocsStepHeader>
        <p className="text-muted-foreground leading-relaxed transition-colors group-hover:text-foreground/80">
          Get the source code and install the required packages.
        </p>
        <DocsCodeBlock
          code={`git clone ${SITE_CONFIG.links.githubRepo}.git\ncd tijori\nbun install`}
        />
      </section>

      {/* Step 2: Environment Setup */}
      <section className="space-y-8">
        <div>
          <DocsStepHeader>Environment Variables</DocsStepHeader>
          <p className="text-muted-foreground leading-relaxed">
            Configure your local environment with Clerk and Convex keys.
          </p>
        </div>

        <div className="space-y-6">
          <p className="doc-p-tag">
            Copy the example environment file and fill in your keys from Clerk and Convex
            dashboards.
          </p>
          <DocsCodeBlock code={`cp .env.example .env.local`} />
          <p className="doc-p-tag mb-0">
            For Clerk keys, go to you dashboard and copy the keys from the "API Keys" section.
            Navigate here{" "}
            <a
              className="text-primary underline underline-offset-4"
              href={SITE_CONFIG.links.clerkApiKeys}
              target="_blank"
              rel="noreferrer"
            >
              API Keys
            </a>
          </p>
          <p className="doc-p-tag">
            Update the framework from NextJS to TanStack Start, and update them in your .env.local
            file.
          </p>
          <p className="doc-p-tag">
            For detail guide, check offical{" "}
            <a
              href={SITE_CONFIG.links.convexClerkGuide}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-4"
            >
              Convex docs
            </a>
          </p>

          <Card className="border-none bg-muted/40 backdrop-blur-sm rounded-lg">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg text-foreground font-bold">Required Keys</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <p className="text-xs font-black uppercase tracking-widest text-primary/80">
                  Clerk (Dev Instance)
                </p>
                <div className="font-mono text-[11px] text-muted-foreground space-y-1 pl-3 border-l-2 border-primary/20">
                  <div>VITE_CLERK_PUBLISHABLE_KEY</div>
                  <div>CLERK_SECRET_KEY</div>
                  <div>CLERK_JWT_ISSUER_DOMAIN</div>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-xs font-black uppercase tracking-widest text-primary/80">
                  Convex (Generated when dev server starts)
                </p>
                <div className="font-mono text-[11px] text-muted-foreground space-y-1 pl-3 border-l-2 border-primary/20">
                  <div>VITE_CONVEX_URL</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Step 3: Run Development Servers */}
      <section className="space-y-8">
        <div>
          <DocsStepHeader>Start Development Servers</DocsStepHeader>
          <p className="text-muted-foreground leading-relaxed">
            You need to run both the frontend and the Convex backend simultaneously.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="bg-muted/30 border-none transition-all hover:bg-muted/40 rounded-lg">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Terminal className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg font-bold">Frontend</CardTitle>
              </div>
              <CardDescription className="font-medium">Vite + TanStack Start</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <DocsCodeBlock code={`bun run dev`} className="my-0" />
              <p className="text-xs text-muted-foreground italic font-medium pt-3 pl-3">
                Runs on http://localhost:3000
              </p>
            </CardContent>
          </Card>

          <Card className="bg-muted/30 border-none transition-all hover:bg-muted/40 rounded-lg">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Terminal className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg font-bold">Backend</CardTitle>
              </div>
              <CardDescription className="font-medium">Convex Dev Server</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <DocsCodeBlock code={`bun run cvx:dev`} className="my-0" />
              <p className="text-xs text-muted-foreground italic font-medium pt-3 pl-3">
                Syncs schema and functions in real-time
              </p>
            </CardContent>
          </Card>
        </div>
        <p className="doc-p-tag">
          You may be asked to login to your convex account, it's upto you whether you want to use
          the local running convex instance or the development instance via the cloud, for that you
          have to login to your convex account and follow the steps to generate the keys.
        </p>
      </section>

      {/* Verification */}
      <section className="rounded-3xl border border-primary/20 bg-linear-to-b from-primary/10 to-transparent p-10 flex flex-col items-center text-center space-y-6">
        <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
          <CheckCircle2 className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-black tracking-tight">You're all set!</h2>
        <p className="text-muted-foreground max-w-xl font-medium leading-relaxed">
          Once both servers are running and your environment variables are configured, you should be
          able to sign in and start creating projects locally.
        </p>
      </section>
    </div>
  );
}
