import { HeadContent, Link, Scripts, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { ClerkProvider, useAuth } from "@clerk/tanstack-react-start";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/react";
import { Compass, Home, LifeBuoy } from "lucide-react";

import appCss from "../styles.css?url";
import { ThemeProvider } from "@/components/theme-provider";
import { convex, queryClient } from "@/lib/convex";
import { Button } from "@/components/ui/button";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Tijori - Secure Environment Variables Manager",
      },
      {
        name: "description",
        content:
          "Securely store, manage, and share encrypted environment variables across your team.",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap",
      },
      {
        rel: "stylesheet",
        href: "https://cdn.jsdelivr.net/npm/geist@1.3.0/dist/mono.css",
      },
    ],
  }),

  shellComponent: RootDocument,
  notFoundComponent: NotFound,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <html lang="en" suppressHydrationWarning>
              <head>
                <HeadContent />
                <script
                  dangerouslySetInnerHTML={{
                    __html: `
                      (function() {
                        const stored = localStorage.getItem('tijori-theme');
                        const theme = stored || 'dark';
                        const resolved = theme === 'system' 
                          ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
                          : theme;
                        document.documentElement.classList.add(resolved);
                      })();
                    `,
                  }}
                />
              </head>
              <body className="min-h-screen bg-background font-sans antialiased">
                <main className="flex flex-1 flex-col">{children}</main>
                <Toaster position="top-right" richColors />
                <Analytics />
                <TanStackDevtools
                  config={{
                    position: "bottom-right",
                  }}
                  plugins={[
                    {
                      name: "Router Devtools",
                      render: <TanStackRouterDevtoolsPanel />,
                    },
                  ]}
                />
                <Scripts />
              </body>
            </html>
          </ThemeProvider>
        </QueryClientProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-1 items-center justify-center px-6 py-16">
      <div className="max-w-xl space-y-6 rounded-3xl border border-border/50 bg-gradient-to-br from-muted/40 via-background to-muted/20 p-8 shadow-xl">
        <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Compass className="h-5 w-5" />
          </span>
          Lost in the vault
        </div>
        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight">This page doesn&apos;t exist</h1>
          <p className="text-muted-foreground">
            The route you entered is empty. Head back to the dashboard or check the docs for what
            you need.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/">
            <Button className="gap-2" title="Go home">
              <Home className="h-4 w-4" />
              Home
            </Button>
          </Link>
          <Link to="/docs">
            <Button variant="outline" className="gap-2" title="Open docs">
              <LifeBuoy className="h-4 w-4" />
              Docs
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
