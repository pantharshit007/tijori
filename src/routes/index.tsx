import { Link, createFileRoute } from "@tanstack/react-router";
import { SignInButton, SignedIn, SignedOut } from "@clerk/tanstack-react-start";
import {
  ArrowRight,
  BookOpen,
  Github,
  KeyRound,
  Lightbulb,
  Lock,
  Share2,
  Shield,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SITE_CONFIG } from "@/utilities/site-config";
import { useTheme } from "@/components/theme-provider";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: SITE_CONFIG.title },
      { name: "description", content: SITE_CONFIG.description },
      { property: "og:title", content: SITE_CONFIG.title },
      { property: "og:description", content: SITE_CONFIG.description },
      { property: "og:url", content: SITE_CONFIG.siteUrl },
      { property: "og:image", content: SITE_CONFIG.ogImage },
      { name: "twitter:title", content: SITE_CONFIG.title },
      { name: "twitter:description", content: SITE_CONFIG.description },
      { name: "twitter:image", content: SITE_CONFIG.ogImage },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const { setTheme, resolvedTheme } = useTheme();

  const handleToggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground overflow-hidden">
      {/* Background patterns */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-secondary/5 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="container flex h-16 max-w-screen-2xl items-center justify-between mx-auto px-4 lg:px-8">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <KeyRound className="size-5" />
            </div>
            <span className="bg-clip-text text-transparent bg-linear-to-r from-foreground to-foreground/70">
              Tijori
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors cursor-pointer">
              Features
            </a>
            <a href="#security" className="hover:text-foreground transition-colors cursor-pointer">
              Security
            </a>
            <a
              href={SITE_CONFIG.links.githubRepo}
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Github
            </a>
          </nav>

          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              className="h-8 w-8 border-none dark:bg-transparent"
              onClick={handleToggleTheme}
              title="Toggle theme"
            >
              <Lightbulb className="h-4 w-4 fill-primary" />
              <span className="sr-only">Toggle Dark Mode</span>
            </Button>
            <SignedOut>
              <SignInButton mode="modal">
                <Button variant="ghost" className="hidden sm:inline-flex" title="Sign in">
                  Sign In
                </Button>
              </SignInButton>
              <SignInButton mode="modal">
                <Button className="shadow-lg shadow-primary/20" title="Get started">
                  Get Started
                </Button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <Link to="/d/dashboard">
                <Button className="gap-2 shadow-lg shadow-primary/20" title="Go to dashboard">
                  Dashboard
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
            </SignedIn>
          </div>
        </div>
      </header>

      <main className="flex-1 z-10">
        {/* Hero Section */}
        <section className="relative px-4 py-20 lg:py-32 xl:py-40">
          <div className="container max-w-7xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary mb-4 animate-fade-in">
              <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
              Secure by Design. Open Source Forever.
            </div>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight max-w-4xl mx-auto leading-[1.1]">
              Management of your{" "}
              <span className="bg-clip-text text-transparent bg-linear-to-r from-primary to-primary/60">
                Environments
              </span>{" "}
              shouldn't be a risk.
            </h1>

            <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              Tijori is a zero-knowledge vault for your team's secrets. Encrypted in your browser.
              Never shared with the server.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <SignedOut>
                <SignInButton mode="modal">
                  <Button
                    size="lg"
                    className="h-12 px-8 text-md font-semibold gap-2 shadow-xl shadow-primary/20"
                    title="Get started free"
                  >
                    Get Started Free
                    <ArrowRight className="size-5" />
                  </Button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <Link to="/d/dashboard">
                  <Button
                    size="lg"
                    className="h-12 px-8 text-md font-semibold gap-2 shadow-xl shadow-primary/20"
                    title="Go to dashboard"
                  >
                    Go to Dashboard
                    <ArrowRight className="size-5" />
                  </Button>
                </Link>
              </SignedIn>
              <Link to="/docs">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 px-8 text-md font-semibold gap-2 backdrop-blur-sm bg-background/50 border-white/10"
                  title="Read documentation"
                >
                  <BookOpen className="size-5" />
                  Read Documentation
                </Button>
              </Link>
            </div>

            {/* Dashboard Preview Mockup */}
            <div className="mt-16 relative mx-auto max-w-5xl rounded-xl border border-border/50 bg-background/50 shadow-2xl p-2 backdrop-blur-md animate-reveal">
              <div className="rounded-lg border bg-background overflow-hidden shadow-inner">
                <div className="h-10 bg-muted/30 border-b flex items-center px-4 gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-destructive/50" />
                    <div className="w-3 h-3 rounded-full bg-amber-500/50" />
                    <div className="w-3 h-3 rounded-full bg-green-500/50" />
                  </div>
                  <div className="flex-1 bg-muted/50 rounded h-6 max-w-md mx-auto" />
                </div>
                <div className="aspect-video bg-muted/10 p-8 flex flex-col gap-6">
                  <div className="flex items-center justify-between">
                    <div className="h-8 w-32 bg-muted/40 rounded" />
                    <div className="h-8 w-24 bg-primary/20 rounded" />
                  </div>
                  <div className="grid grid-cols-3 gap-6">
                    <div className="h-32 bg-muted/20 rounded-lg border border-border/50" />
                    <div className="h-32 bg-muted/20 rounded-lg border border-border/50" />
                    <div className="h-32 bg-muted/20 rounded-lg border border-border/50" />
                  </div>
                  <div className="h-40 bg-muted/10 rounded-lg border border-border/50 border-dashed" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 bg-muted/30 relative overflow-hidden">
          <div className="container max-w-7xl mx-auto px-4">
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Everything you need, nothing you don't.
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Built for developers, by developers. Secure, fast, and simple.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <FeatureCard
                icon={<Lock className="size-6 text-primary" />}
                title="End-to-End Encryption"
                description="Secrets are encrypted in your browser using AES-256-GCM before they ever hit our database."
              />
              <FeatureCard
                icon={<Shield className="size-6 text-primary" />}
                title="Zero-Knowledge"
                description="We don't store your master key or project passcodes. We literally can't see your data even if we wanted to."
              />
              <FeatureCard
                icon={<Zap className="size-6 text-primary" />}
                title="Blazing Fast"
                description="Built on Convex and TanStack Start for real-time updates and instant loading states."
              />
              <FeatureCard
                icon={<Users className="size-6 text-primary" />}
                title="Team Collaboration"
                description="Role-based access control allows you to share variables with team members without exposing them."
              />
              <FeatureCard
                icon={<Share2 className="size-6 text-primary" />}
                title="Secure Sharing"
                description="Share encrypted variables with temporary, time-limited links with secondary passcode protection."
              />
              <FeatureCard
                icon={<Github className="size-6 text-primary" />}
                title="Open Source"
                description="Fully open source. Star us on Github and contribute to the future of secret management."
              />
            </div>
          </div>
        </section>

        {/* Security Section */}
        <section id="security" className="py-24 border-t border-border/40">
          <div className="container max-w-7xl mx-auto px-4">
            <div className="flex flex-col lg:flex-row items-center gap-16">
              <div className="flex-1 space-y-6">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Your keys. Your data.
                </h2>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Tijori uses the industry standard Web Crypto API. When you create a project, we
                  derive a cryptographic key from your 6-digit passcode using PBKDF2 with 100,000
                  iterations.
                </p>
                <ul className="space-y-4">
                  <li className="flex gap-3 items-start">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckIcon className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div>
                      <span className="font-semibold">AES-256-GCM Encryption</span>
                      <p className="text-sm text-muted-foreground">
                        Authenticated encryption for both data and keys.
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-3 items-start">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckIcon className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div>
                      <span className="font-semibold">In-Memory Secret Handling</span>
                      <p className="text-sm text-muted-foreground">
                        Keys are never persisted to localStorage or cookies.
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-3 items-start">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckIcon className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div>
                      <span className="font-semibold">6-Digit Protection</span>
                      <p className="text-sm text-muted-foreground">
                        Simple for humans, nearly impossible for machines with heavy KDF.
                      </p>
                    </div>
                  </li>
                </ul>
                <div className="pt-4">
                  <Link to="/docs/security">
                    <Button
                      variant="link"
                      className="p-0 h-auto text-primary gap-1"
                      title="Read security docs"
                    >
                      Read more about our security model
                      <ArrowRight className="size-4" />
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="flex-1 w-full flex justify-center">
                <div className="relative w-full max-w-md aspect-square bg-linear-to-br from-primary/20 to-secondary/20 rounded-3xl flex items-center justify-center p-8 backdrop-blur shadow-2xl border border-white/5 overflow-hidden">
                  <Lock className="size-40 text-primary/40" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-[80%] h-[80%] border-2 border-primary/10 rounded-full animate-ping-slow" />
                    <div className="w-[60%] h-[60%] border-2 border-primary/20 rounded-full animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 bg-primary text-primary-foreground">
          <div className="container max-w-7xl mx-auto px-4 text-center space-y-8">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              Ready to secure your stack?
            </h2>
            <p className="text-primary-foreground/80 text-lg max-w-2xl mx-auto">
              Join teams choosing security first. Get started for free today.
            </p>
            <div className="flex justify-center gap-4">
              <SignedOut>
                <SignInButton mode="modal">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="h-14 px-10 text-lg font-bold shadow-2xl"
                    title="Get started now"
                  >
                    Get Started Now
                  </Button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <Link to="/d/dashboard">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="h-14 px-10 text-lg font-bold shadow-2xl"
                    title="Go to dashboard"
                  >
                    Go to Dashboard
                  </Button>
                </Link>
              </SignedIn>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-12 bg-background">
        <div className="container max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-8 text-center md:text-left">
          <div className="space-y-4">
            <div className="flex items-center justify-center md:justify-start gap-2 font-bold text-xl">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground">
                <KeyRound className="size-3.5" />
              </div>
              Tijori
            </div>
            <p className="text-muted-foreground text-sm max-w-xs">
              Open source environment variable management designed for modern teams.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-12 text-sm">
            <div className="space-y-4">
              <div className="font-semibold uppercase tracking-wider text-xs text-foreground/70">
                Product
              </div>
              <ul className="space-y-2 text-muted-foreground">
                <li className="hover:text-foreground transition-colors cursor-pointer">Features</li>
                <li className="hover:text-foreground transition-colors cursor-pointer">Security</li>
                <li className="hover:text-foreground transition-colors cursor-pointer">Pricing</li>
              </ul>
            </div>
            <div className="space-y-4">
              <div className="font-semibold uppercase tracking-wider text-xs text-foreground/70">
                Resources
              </div>
              <ul className="space-y-2 text-muted-foreground">
                <li className="hover:text-foreground transition-colors cursor-pointer">
                  Documentation
                </li>
                <li className="hover:text-foreground transition-colors cursor-pointer">
                  API Reference
                </li>
                <li className="hover:text-foreground transition-colors cursor-pointer">
                  Community
                </li>
              </ul>
            </div>
            <div className="space-y-4 hidden sm:block">
              <div className="font-semibold uppercase tracking-wider text-xs text-foreground/70">
                Company
              </div>
              <ul className="space-y-2 text-muted-foreground">
                <li className="hover:text-foreground transition-colors cursor-pointer">About</li>
                <li className="hover:text-foreground transition-colors cursor-pointer">Github</li>
                <li className="hover:text-foreground transition-colors cursor-pointer">Privacy</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="container max-w-7xl mx-auto px-4 pt-8 mt-12 border-t border-border/20 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Tijori. Built by{" "}
          <a href={SITE_CONFIG.links.twitter} className="underline hover:text-foreground">
            pantharshit007
          </a>
          . Released under AGPL-3.0.
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="group p-8 rounded-2xl border border-border/50 bg-background/50 backdrop-blur-sm hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 transition-all">
      <div className="mb-4 p-3 rounded-lg bg-primary/5 inline-block group-hover:bg-primary/10 transition-colors">
        {icon}
      </div>
      <h3 className="text-lg font-bold mb-2 group-hover:text-primary transition-colors">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
