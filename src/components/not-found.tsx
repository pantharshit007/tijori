import { Link } from "@tanstack/react-router";
import { Home, ArrowLeft, HelpCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NotFoundProps {
  title?: string;
  description?: string;
  backLink?: string;
  backText?: string;
  isDocs?: boolean;
}

export function NotFound({
  title = "Page Not Found",
  description = "Oops! The page you're looking for seems to have vanished into the vault.",
  backLink = "/",
  backText = "Back to Home",
  isDocs = false,
}: NotFoundProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 transition-all duration-700 animate-in fade-in slide-in-from-bottom-8",
        isDocs ? "min-h-[400px] py-12" : "min-h-[80vh] py-20"
      )}
    >
      <div className="relative mb-8">
        <div className="absolute inset-0 blur-3xl opacity-20 bg-primary rounded-full animate-pulse" />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-muted/50 border border-border/50 text-primary shadow-2xl backdrop-blur-sm">
          <HelpCircle className="h-12 w-12 animate-bounce" />
        </div>
      </div>

      <div className="max-w-md text-center space-y-4">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl bg-clip-text text-transparent bg-linear-to-b from-foreground to-foreground/70">
          404
        </h1>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">{title}</h2>
        <p className="text-muted-foreground text-lg leading-relaxed">{description}</p>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <Link to={backLink}>
          <Button
            size="lg"
            className="rounded-xl gap-2 shadow-xl shadow-primary/20 font-semibold group"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            {backText}
          </Button>
        </Link>
        <Link to="/">
          <Button variant="outline" size="lg" className="rounded-xl gap-2 font-semibold">
            <Home className="h-4 w-4" />
            Dashboard
          </Button>
        </Link>
        {!isDocs && (
          <Link to="/docs">
            <Button variant="ghost" size="lg" className="rounded-xl gap-2 font-semibold">
              <FileText className="h-4 w-4" />
              Read Docs
            </Button>
          </Link>
        )}
      </div>

      {!isDocs && (
        <div className="mt-20 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
          <div className="p-6 rounded-2xl border border-border/40 bg-muted/10 hover:bg-muted/20 transition-colors">
            <h3 className="font-bold text-foreground mb-1">Looking for setup?</h3>
            <p className="text-sm text-muted-foreground mb-4">Check our local development guide.</p>
            <Link to="/docs/local-setup" className="text-xs font-bold text-primary hover:underline">
              View Guide →
            </Link>
          </div>
          <div className="p-6 rounded-2xl border border-border/40 bg-muted/10 hover:bg-muted/20 transition-colors">
            <h3 className="font-bold text-foreground mb-1">Security questions?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Learn about our zero-knowledge architecture.
            </p>
            <Link to="/docs/security" className="text-xs font-bold text-primary hover:underline">
              Explore Security →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
