import { HeadContent, Scripts, createRootRoute, useLocation } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import {
  ClerkProvider,
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton, useAuth
} from '@clerk/tanstack-react-start'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { QueryClientProvider } from '@tanstack/react-query'

import appCss from '../styles.css?url'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { ThemeProvider } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { convex, queryClient } from '@/lib/convex'



export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Tijori - Secure Environment Variables Manager',
      },
      {
        name: 'description',
        content:
          'Securely store, manage, and share encrypted environment variables across your team.',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.googleapis.com',
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap',
      },
      {
        rel: 'stylesheet',
        href: 'https://cdn.jsdelivr.net/npm/geist@1.3.0/dist/mono.css',
      },
    ],
  }),

  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const location = useLocation()

  // Public routes that don't require authentication
  const isPublicRoute = location.pathname.startsWith('/share/')

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
              {isPublicRoute ? (
                // Public routes - no auth required
                <main className="flex flex-1 flex-col">{children}</main>
              ) : (
                // Protected routes - auth required
                <>
                  <SignedIn>
                    <AuthenticatedLayout>
                      <SidebarProvider>
                        <AppSidebar />
                        <SidebarInset>
                        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
                            <SidebarTrigger className="-ml-1" />
                            <Separator orientation="vertical" className="mr-2 h-4" />
                            <div className="flex-1" />
                            <UserButton
                              appearance={{
                                elements: {
                                  avatarBox: 'h-8 w-8',
                                },
                              }}
                            />
                          </header>
                          <main className="flex flex-1 flex-col p-4">{children}</main>
                        </SidebarInset>
                      </SidebarProvider>
                    </AuthenticatedLayout>
                  </SignedIn>

                  <SignedOut>
                    <div className="flex min-h-screen items-center justify-center">
                      <div className="text-center space-y-6">
                        <div className="space-y-2">
                          <h1 className="text-4xl font-bold tracking-tight">Tijori</h1>
                          <p className="text-muted-foreground">
                            Secure environment variables manager
                          </p>
                        </div>
                        <SignInButton mode="modal">
                          <Button size="lg">Sign in to continue</Button>
                        </SignInButton>
                      </div>
                    </div>
                  </SignedOut>
                </>
              )}
              <TanStackDevtools
                config={{
                  position: 'bottom-right',
                }}
                plugins={[
                  {
                    name: 'Router Devtools',
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
  )
}
