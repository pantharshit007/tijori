import { useState } from "react";
import { Check, Clock, Copy, LogOut, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { keyStore } from "@/lib/key-store";
import { makeExpediteDeleteMailto } from "@/lib/constants";
import { env } from "@/env";

interface ShowDeletionScreenProps {
  signOut: (cb?: () => void) => void;
}

function CopyMailIconArea({
  supportEmail,
  mailtoExpediteDeleteUrl,
}: {
  supportEmail: string;
  mailtoExpediteDeleteUrl: string;
}) {
  const [hover, setHover] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(supportEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const hiddenStyle = "absolute opacity-0 scale-75 -rotate-12 pointer-events-none";
  const shownStyle = "absolute opacity-100 scale-100 rotate-0 ";

  let icon: "mail" | "copy" | "check";
  if (copied) icon = "check";
  else if (hover) icon = "copy";
  else icon = "mail";

  return (
    <div
      className="flex items-center justify-center gap-2 text-sm cursor-pointer select-none relative min-h-[1.25rem]"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={handleCopy}
      title={copied ? "Copied!" : "Copy email"}
      tabIndex={0}
      role="button"
      aria-label={`Copy support email address: ${supportEmail}`}
    >
      <span className="relative w-5 h-5 inline-block ">
        <Mail
          className={cn(
            "h-5 w-5 text-muted-foreground transition-all duration-300",
            icon === "mail" ? shownStyle : hiddenStyle
          )}
        />
        <Copy
          className={cn(
            "h-5 w-5 text-muted-foreground transition-all duration-300",
            icon === "copy" ? shownStyle : hiddenStyle
          )}
        />
        <Check
          className={cn(
            "h-5 w-5 text-green-500 transition-all duration-300",
            icon === "check" ? shownStyle : hiddenStyle
          )}
        />
      </span>
      <a
        href={mailtoExpediteDeleteUrl}
        className="text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {supportEmail}
      </a>
    </div>
  );
}

export function ShowDeletionScreen({ signOut }: ShowDeletionScreenProps) {
  const supportEmail = env.VITE_SUPPORT_EMAIL;
  const mailtoExpediteDeleteUrl = makeExpediteDeleteMailto(supportEmail);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
      <div className="max-w-md space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-amber-500/10 p-6">
            <Clock className="h-16 w-16 text-amber-500" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tighter">Account Deletion in Progress</h1>
          <p className="text-muted-foreground">
            Your account is currently scheduled for deletion. All your data is being securely wiped
            from our systems.
          </p>
          <p className="text-muted-foreground text-sm">
            If you'd like to create a new account with this email, please contact our team to
            expedite the data wipe.
          </p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3">
          <CopyMailIconArea
            supportEmail={supportEmail}
            mailtoExpediteDeleteUrl={mailtoExpediteDeleteUrl}
          />
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
