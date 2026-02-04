import { Link, createFileRoute } from "@tanstack/react-router";
import { Shield, Rocket, Key, Share2, Users, Database } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/docs/")({
  component: DocsIndex,
});

function DocsIndex() {
  return (
    <div className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Hero Section */}
      <section className="space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
          Security First
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl text-balance">
          The Vault for your <span className="text-primary">Environment Variables</span>
        </h1>
        <p className="sm:text-lg text-sm text-muted-foreground max-w-2xl leading-relaxed">
          Tijori is a zero-knowledge secrets manager designed for modern development teams. Manage,
          share, and protect your environment variables with ease.
        </p>
        <div className="flex flex-wrap gap-4 pt-4">
          <Link to="/docs/local-setup">
            <Button size="lg" className="h-12 px-8 rounded-xl shadow-xl shadow-primary/20">
              Get Started Locally
            </Button>
          </Link>
          <Link to="/docs/security">
            <Button variant="outline" size="lg" className="h-12 px-8 rounded-xl">
              Explore Security
            </Button>
          </Link>
          <Link to="/docs/deployment">
            <Button variant="ghost" size="lg" className="h-12 px-8 rounded-xl">
              Deployment Guide
            </Button>
          </Link>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="space-y-8">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Core Concepts</h2>
          <p className="text-muted-foreground">
            Everything you need to know about how Tijori works.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Zero-Knowledge",
              description:
                "Your secrets are encrypted in the browser. We never see your plaintext data.",
              icon: Shield,
              link: "/docs/security",
            },
            {
              title: "Encryption Stack",
              description:
                "Built on Web Crypto API using AES-256-GCM and PBKDF2 for maximum security.",
              icon: Key,
              link: "/docs/security",
            },
            {
              title: "Shared Secrets",
              description: "Securely share variables with one-time magic links and auto-expiry.",
              icon: Share2,
              link: "/docs",
            },
            {
              title: "Team RBAC",
              description: "Role-based access control for owners, admins, and members.",
              icon: Users,
              link: "/docs",
            },
            {
              title: "Convex Backend",
              description:
                "Real-time updates and seamless data synchronization across all devices.",
              icon: Database,
              link: "/docs/deployment",
            },
            {
              title: "Production Ready",
              description:
                "Deploy to Vercel or any other platform with standardized configurations.",
              icon: Rocket,
              link: "/docs/deployment",
            },
          ].map((feature, i) => (
            <Link key={i} to={feature.link} className="group">
              <Card className="h-full border-border/50 bg-card/50 transition-all duration-300 group-hover:-translate-y-1 group-hover:border-primary/30 group-hover:shadow-xl group-hover:shadow-primary/5">
                <CardHeader>
                  <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Getting Started Callout */}
      <section className="rounded-3xl border border-primary/20 bg-primary/5 p-8 sm:p-12">
        <div className="flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 space-y-6">
            <h2 className="text-3xl font-bold tracking-tight text-foreground text-balance">
              Ready to secure your development workflow?
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed tracking-tight">
              Check out our deployment guide to learn how to set up Tijori for your organization or
              yourself and start managing your secrets like a pro.
            </p>
            <Link to="/docs/deployment">
              <Button size="lg" className="rounded-xl font-semibold">
                Get Started with Deployment
              </Button>
            </Link>
          </div>
          <div className="flex-1 w-full max-w-sm">
            <div className="aspect-square rounded-2xl bg-linear-to-br from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center relative overflow-hidden group">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent opacity-50"></div>
              <Rocket className="relative z-10 h-24 w-24 text-primary transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
