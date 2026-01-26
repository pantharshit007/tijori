import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { SignedIn, SignedOut, UserButton  } from '@clerk/tanstack-react-start'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/d')({
  beforeLoad: ({ context, location }: { context: any, location: any }) => {
    if (context.auth?.userId === null) {
      throw redirect({
        to: '/',
        search: {
          redirect: location.href,
        },
      })
    }
  },
  component: DashboardLayout,
})

function DashboardLayout() {
  return (
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
              <main className="flex flex-1 flex-col p-4">
                <Outlet />
              </main>
            </SidebarInset>
          </SidebarProvider>
        </AuthenticatedLayout>
      </SignedIn>
      <SignedOut>
        {/* Redirecting to home or login page if signed out */}
        {/* In TanStack Start with Clerk, we can use redirect() in beforeLoad or just show a message */}
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold">Authentication Required</h1>
            <p className="text-muted-foreground">Please sign in to access the dashboard.</p>
            <Button onClick={() => window.location.href = '/'}>Go back to Home</Button>
          </div>
        </div>
      </SignedOut>
    </>
  )
}

