import { Link, createFileRoute } from "@tanstack/react-router";
import { Shield, Rocket } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/docs/")({
  component: DocsIndex,
});

function DocsIndex() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Tijori Docs
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Start with the essentials</h1>
        <p className="text-muted-foreground">
          We keep the docs tight and practical. Pick a topic to dive in.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link to="/docs/security" className="group">
          <Card className="h-full transition group-hover:border-primary/60 group-hover:shadow-lg">
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Shield className="h-4 w-4" />
                </span>
                <div>
                  <CardTitle>Security</CardTitle>
                  <CardDescription>Zero-knowledge, encryption, and threat model.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Understand how Tijori keeps secrets encrypted end-to-end and the boundaries of our
              threat model.
            </CardContent>
          </Card>
        </Link>

        <Link to="/docs/deployment" className="group">
          <Card className="h-full transition group-hover:border-primary/60 group-hover:shadow-lg">
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Rocket className="h-4 w-4" />
                </span>
                <div>
                  <CardTitle>Deployment</CardTitle>
                  <CardDescription>Clerk, Convex, and production rollout.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Learn how to connect auth, backend, and ship to production environments.
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
