import { Link, Outlet, createFileRoute, useLocation } from "@tanstack/react-router";
import { BookOpen, ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const DOC_LINKS = [
  {
    title: "Security",
    description: "Zero-knowledge architecture and threat model.",
    to: "/docs/security",
  },
  {
    title: "Deployment",
    description: "Clerk, Convex, and production rollout.",
    to: "/docs/deployment",
  },
];

export const Route = createFileRoute("/docs")({
  component: DocsLayout,
});

function DocsLayout() {
  const location = useLocation();
  const [query, setQuery] = useState("");

  const filteredLinks = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return DOC_LINKS;
    return DOC_LINKS.filter((item) =>
      [item.title, item.description].some((value) => value.toLowerCase().includes(trimmed))
    );
  }, [query]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
              <BookOpen className="h-4 w-4" />
            </span>
            <span>Docs</span>
          </Link>
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2" title="Back to home">
              Back to Home
            </Button>
          </Link>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-4 py-10 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-2xl border border-border/50 bg-card/60 p-4 shadow-sm">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Search Docs
            </label>
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-border/50 bg-background px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a page..."
                className="h-7 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
              />
            </div>
          </div>

          <nav className="rounded-2xl border border-border/50 bg-card/60 p-2 shadow-sm">
            {filteredLinks.length === 0 ? (
              <div className="px-3 py-6 text-sm text-muted-foreground">
                No docs match that search.
              </div>
            ) : (
              <ul className="space-y-1">
                {filteredLinks.map((item) => {
                  const isActive = location.pathname === item.to;
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        className={cn(
                          "flex items-start justify-between rounded-xl px-3 py-2 text-sm transition",
                          isActive
                            ? "bg-primary text-primary-foreground shadow"
                            : "hover:bg-muted"
                        )}
                      >
                        <div>
                          <p className="font-semibold">{item.title}</p>
                          <p className={cn("text-xs", isActive ? "text-primary-foreground/80" : "text-muted-foreground")}>
                            {item.description}
                          </p>
                        </div>
                        <ChevronRight className={cn("h-4 w-4", isActive ? "text-primary-foreground" : "text-muted-foreground")} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </nav>
        </aside>

        <main className="min-w-0">
          <div className="rounded-3xl border border-border/40 bg-card/40 p-6 shadow-sm md:p-10">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
