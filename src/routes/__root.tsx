import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { ClerkProvider, useAuth } from "@clerk/tanstack-react-start";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/react";

import appCss from "../styles.css?url";
import { ThemeProvider } from "@/components/theme-provider";
import { convex, queryClient } from "@/lib/convex";
import { NotFound as PremiumNotFound } from "@/components/not-found";
import { SITE_CONFIG } from "@/utilities/site-config";

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
        title: SITE_CONFIG.title,
      },
      {
        name: "description",
        content: SITE_CONFIG.description,
      },
      {
        name: "keywords",
        content: SITE_CONFIG.seo.keywords.join(", "),
      },
      {
        name: "robots",
        content: "index, follow",
      },
      {
        name: "theme-color",
        content: "#0a0a0a",
      },
      {
        property: "og:site_name",
        content: SITE_CONFIG.name,
      },
      {
        property: "og:title",
        content: SITE_CONFIG.title,
      },
      {
        property: "og:description",
        content: SITE_CONFIG.description,
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        property: "og:url",
        content: SITE_CONFIG.siteUrl,
      },
      {
        property: "og:image",
        content: SITE_CONFIG.ogImage,
      },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
      {
        name: "twitter:title",
        content: SITE_CONFIG.title,
      },
      {
        name: "twitter:description",
        content: SITE_CONFIG.description,
      },
      {
        name: "twitter:image",
        content: SITE_CONFIG.ogImage,
      },
      {
        name: "twitter:site",
        content: SITE_CONFIG.seo.twitterHandle,
      },
      {
        name: "twitter:creator",
        content: SITE_CONFIG.seo.twitterHandle,
      },
    ],
    links: [
      {
        rel: "canonical",
        href: SITE_CONFIG.siteUrl,
      },
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
  notFoundComponent: () => <PremiumNotFound />,
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
                  type="application/ld+json"
                  dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                      "@context": "https://schema.org",
                      "@type": "SoftwareApplication",
                      name: SITE_CONFIG.name,
                      url: SITE_CONFIG.siteUrl,
                      description: SITE_CONFIG.description,
                      applicationCategory: "SecurityApplication",
                      operatingSystem: "Web",
                      offers: {
                        "@type": "Offer",
                        price: "0",
                        priceCurrency: "USD",
                      },
                    }),
                  }}
                />
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
