import { Outlet, createFileRoute, redirect, useLocation } from "@tanstack/react-router";
import { SignedIn, SignedOut, UserButton, useClerk } from "@clerk/tanstack-react-start";
import { useQuery } from "convex/react";
import { BookOpen, LogOut, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthenticatedLayout } from "@/components/authenticated-layout";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { PlanEnforcementBanner } from "@/components/PlanEnforcementBanner";
import { OnboardingTutorial } from "@/components/onboarding-tutorial";

import { NotFound } from "@/components/not-found";

export const Route = createFileRoute("/d")({
  beforeLoad: ({ context, location }: { context: any; location: any }) => {
    if (context.auth?.userId === null) {
      throw redirect({
        to: "/",
        search: {
          redirect: location.href,
        },
      });
    }
  },
  component: DashboardLayout,
  notFoundComponent: () => (
    <NotFound 
      title="Feature Not Found" 
      description="The dashboard feature or project you're looking for doesn't exist."
      backLink="/d/dashboard"
      backText="Back to Dashboard"
    />
  ),
});

function DashboardLayout() {
  const user = useQuery(api.users.me);
  const { signOut } = useClerk();
  const location = useLocation();
  const [tutorialRestartSignal, setTutorialRestartSignal] = useState(0);

  const showTutorialButton =
    location.pathname === "/d/dashboard" || location.pathname.startsWith("/d/project/");

  return (
    <>
      <SignedIn>
        {user === undefined ? (
          <div className="flex min-h-screen items-center justify-center">
            <div className="animate-pulse flex flex-col items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-muted" />
              <div className="h-4 w-32 bg-muted rounded" />
            </div>
          </div>
        ) : user?.isDeactivated ? (
          <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
            <div className="max-w-md space-y-6">
              <div className="flex justify-center">
                <div className="rounded-full bg-destructive/10 p-6">
                  <ShieldAlert className="h-16 w-16 text-destructive" />
                </div>
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tighter">Account Deactivated</h1>
                <p className="text-muted-foreground">
                  Your access to Tijori has been suspended by a platform administrator. If you
                  believe this is a mistake, please contact your organization's admin or our support
                  team.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() =>
                    signOut(() => {
                      window.location.href = "/";
                    })
                  }
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
                <Button
                  variant="link"
                  className="w-full text-muted-foreground"
                  onClick={() => (window.location.href = "/")}
                >
                  Return to Landing Page
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <AuthenticatedLayout>
            <SidebarProvider>
              <AppSidebar />
              <SidebarInset>
                <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
                  <SidebarTrigger className="-ml-1" />
                  <Separator orientation="vertical" className="mr-2 h-4" />
                  <div className="flex-1" />
                  {showTutorialButton && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2"
                      data-tutorial-id="tutorial-restart"
                      title="Restart tutorial"
                      onClick={() => setTutorialRestartSignal((value) => value + 1)}
                    >
                      <BookOpen className="h-4 w-4" />
                      Tutorial
                    </Button>
                  )}
                  <UserButton
                    appearance={{
                      elements: {
                        avatarBox: "h-8 w-8",
                      },
                    }}
                  />
                </header>
                <main className="flex flex-1 flex-col p-4">
                  <PlanEnforcementBanner />
                  <Outlet />
                </main>
              </SidebarInset>
              <OnboardingTutorial enabled={Boolean(user)} restartSignal={tutorialRestartSignal} />
            </SidebarProvider>
          </AuthenticatedLayout>
        )}
      </SignedIn>
      <SignedOut>
        {/* Redirecting to home or login page if signed out */}
        {/* In TanStack Start with Clerk, we can use redirect() in beforeLoad or just show a message */}
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold">Authentication Required</h1>
            <p className="text-muted-foreground">Please sign in to access the dashboard.</p>
            <Button onClick={() => (window.location.href = "/")}>Go back to Home</Button>
          </div>
        </div>
      </SignedOut>
    </>
  );
}
