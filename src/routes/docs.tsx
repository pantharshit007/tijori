import { Link, Outlet, createFileRoute, useLocation } from "@tanstack/react-router";
import { BookOpen, ChevronRight, HelpCircle, Lightbulb, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DOC_GROUPS } from "@/utilities/doc-config";
import { SITE_CONFIG } from "@/utilities/site-config";
import { useTheme } from "@/components/theme-provider";

import { NotFound } from "@/components/not-found";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: SITE_CONFIG.pages.docs },
      { name: "description", content: SITE_CONFIG.description },
      { property: "og:title", content: SITE_CONFIG.pages.docs },
      { property: "og:description", content: SITE_CONFIG.description },
      { property: "og:url", content: `${SITE_CONFIG.siteUrl}/docs` },
      { property: "og:image", content: SITE_CONFIG.ogImage },
      { name: "twitter:title", content: SITE_CONFIG.pages.docs },
      { name: "twitter:description", content: SITE_CONFIG.description },
      { name: "twitter:image", content: SITE_CONFIG.ogImage },
    ],
  }),
  component: DocsLayout,
  notFoundComponent: () => (
    <NotFound
      title="Document Not Found"
      description="The documentation page you're looking for doesn't exist or has been moved."
      backLink="/docs"
      backText="Back to Docs"
      isDocs
    />
  ),
});

function DocsLayout() {
  const { setTheme, resolvedTheme } = useTheme();

  const handleToggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  const location = useLocation();
  const [query, setQuery] = useState("");

  const filteredGroups = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return DOC_GROUPS;
    return DOC_GROUPS.map((group) => ({
      ...group,
      links: group.links.filter((link) =>
        [link.title, link.description, group.name].some((value) =>
          value.toLowerCase().includes(trimmed)
        )
      ),
    })).filter((group) => group.links.length > 0);
  }, [query]);

  const activeLink = useMemo(() => {
    return DOC_GROUPS.flatMap((g) => g.links).find((link) => link.to === location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background selection:bg-primary/10">
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5 group transition-all">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-transform group-hover:scale-105">
                <BookOpen className="h-4 w-4" />
              </span>
              <span className="text-xl font-bold tracking-tight">Tijori</span>
              <span className="hidden rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground sm:block">
                Documentation
              </span>
            </Link>
          </div>
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
            <Link to="/d/dashboard">
              <Button
                variant="ghost"
                size="sm"
                className="hidden sm:flex text-sm font-medium"
                title="Go to dashboard"
              >
                Dashboard
              </Button>
            </Link>
            <Link to="/">
              <Button size="sm" className="shadow-lg shadow-primary/20" title="Back to home">
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
        <div className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-12">
          {/* Sidebar */}
          <aside className="mb-10 lg:mb-0">
            <div className="sticky top-28 space-y-8">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search documentation..."
                  className="h-10 border-border/50 bg-muted/30 pl-10 focus-visible:ring-primary/20 focus-visible:ring-offset-0 placeholder:text-muted-foreground/50 transition-all rounded-xl"
                />
              </div>

              <nav className="space-y-8">
                {filteredGroups.length === 0 ? (
                  <div className="px-3 py-12 text-center rounded-2xl border border-dashed border-border/60">
                    <HelpCircle className="mx-auto h-8 w-8 text-muted-foreground/30 mb-3" />
                    <p className="text-sm font-medium text-muted-foreground text-balance">
                      No matching documents found.
                    </p>
                  </div>
                ) : (
                  filteredGroups.map((group) => (
                    <div key={group.name} className="space-y-3">
                      <h3 className="px-3 text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground/70">
                        {group.name}
                      </h3>
                      <ul className="space-y-1">
                        {group.links.map((link) => {
                          const isActive = location.pathname === link.to;
                          const Icon = link.icon;
                          return (
                            <li key={link.to}>
                              <Link
                                to={link.to}
                                className={cn(
                                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                                  isActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                              >
                                <Icon
                                  className={cn(
                                    "h-4 w-4 transition-colors",
                                    isActive
                                      ? "text-primary"
                                      : "text-muted-foreground group-hover:text-foreground"
                                  )}
                                />
                                <span className="flex-1">{link.title}</span>
                                {isActive && (
                                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                                )}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))
                )}
              </nav>

              <div className="rounded-2xl border border-border/40 bg-card/50 p-6 space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Need help?
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Check out our GitHub for more information.
                </p>
                <a href={SITE_CONFIG.links.githubRepo} target="_blank" rel="noreferrer">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-[10px] h-7 rounded-lg"
                    title="Open GitHub repository"
                  >
                    GitHub Repository
                  </Button>
                </a>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="min-w-0">
            {activeLink && (
              <div className="mb-8 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Link to="/docs" className="hover:text-foreground transition-colors">
                  Documentation
                </Link>
                <ChevronRight className="h-3 w-3" />
                <span className="text-foreground">{activeLink.title}</span>
              </div>
            )}
            <div className="prose prose-invert max-w-none">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
