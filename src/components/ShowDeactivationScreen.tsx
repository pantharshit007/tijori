import { LogOut, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { keyStore } from "@/lib/key-store";

interface ShowDeactivationScreenProps {
  signOut: (cb?: () => void) => void;
}

export function ShowDeactivationScreen({ signOut }: ShowDeactivationScreenProps) {
  return (
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
            Your access to Tijori has been suspended by a platform administrator. If you believe
            this is a mistake, please contact your organization's admin or our support team.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => {
              signOut(() => {
                keyStore.clear();
                window.location.href = "/";
              });
            }}
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
  );
}
