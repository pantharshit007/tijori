import { createFileRoute, useParams } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import {
  AlertCircle,
  Check,
  Clock,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  ShieldAlert,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { decrypt, deriveKey } from "@/lib/crypto";
import { formatDateTime, formatRelativeTime } from "@/lib/time";

interface SharedVariable {
  name: string;
  value: string;
}

function ShareView() {
  const { shareId } = useParams({ from: "/share/$shareId" });
  const sharedSecret = useQuery(api.sharedSecrets.get, {
    id: shareId as Id<"sharedSecrets">,
  });
  const recordView = useMutation(api.sharedSecrets.recordView);

  const [passcode, setPasscode] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [decryptedVariables, setDecryptedVariables] = useState<Array<SharedVariable> | null>(null);
  const [revealedVars, setRevealedVars] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  async function handleUnlock() {
    if (!sharedSecret || "expired" in sharedSecret) return;
    if (!/^\d{6}$/.test(passcode)) {
      setUnlockError("Passcode must be exactly 6 digits");
      return;
    }

    setIsUnlocking(true);
    setUnlockError(null);

    try {
      // 1. Derive key from passcode
      const key = await deriveKey(passcode, data.passcodeSalt);

      // 2. Decrypt the ShareKey
      const shareKeyBase64 = await decrypt(
        data.encryptedShareKey,
        data.iv,
        data.authTag,
        key
      );

      // 3. Import the ShareKey
      const shareKeyData = Uint8Array.from(atob(shareKeyBase64), (c) => c.charCodeAt(0));
      const shareKey = await crypto.subtle.importKey(
        "raw",
        shareKeyData,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
      );

      // 4. Decrypt the payload
      const payloadJson = await decrypt(
        data.encryptedPayload,
        data.payloadIv,
        data.payloadAuthTag,
        shareKey
      );

      const variables: Array<SharedVariable> = JSON.parse(payloadJson);
      setDecryptedVariables(variables);

      // Record the view
      await recordView({ id: shareId as Id<"sharedSecrets"> });

      setPasscode("");
    } catch (err: any) {
      console.error("Decryption failed:", err);
      setUnlockError("Invalid passcode. Please check and try again.");
    } finally {
      setIsUnlocking(false);
    }
  }

  function toggleReveal(index: number) {
    setRevealedVars((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  async function handleCopy(index: number, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(index);
    setTimeout(() => setCopied(null), 2000);
  }

  async function handleCopyAll() {
    if (!decryptedVariables) return;
    const text = decryptedVariables.map((v) => `${v.name}=${v.value}`).join("\n");
    await navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  }

  // Loading state
  if (sharedSecret === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not found
  if (sharedSecret === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <ShieldAlert className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Link Not Found</h2>
            <p className="text-muted-foreground">
              This shared secret link doesn't exist or has been deleted.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Disabled
  if ("disabled" in sharedSecret) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full border-destructive/50">
          <CardContent className="pt-6 text-center">
            <ShieldAlert className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Disabled</h2>
            <p className="text-muted-foreground">
              This shared secret link has been disabled by the owner.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Expired
  if ("expired" in sharedSecret) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full border-amber-500/50">
          <CardContent className="pt-6 text-center">
            <Clock className="h-12 w-12 mx-auto text-amber-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Link Expired</h2>
            <p className="text-muted-foreground">
              This shared secret link has expired and is no longer accessible.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // At this point sharedSecret is the success object
  const data = sharedSecret;


  // Decrypted view
  if (decryptedVariables) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto space-y-6 py-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <Check className="h-6 w-6 text-green-500" />
              </div>
            </div>
            <h1 className="text-2xl font-bold">Shared Secrets</h1>
            <p className="text-muted-foreground mt-1">
              {decryptedVariables.length} variable{decryptedVariables.length !== 1 ? "s" : ""}{" "}
              shared with you
            </p>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Variables</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyAll}
                  className="gap-1"
                >
                  {copiedAll ? (
                    <>
                      <Check className="h-3 w-3" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Copy All
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {decryptedVariables.map((variable, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                >
                  <div className="flex-1 min-w-0">
                    <code className="text-sm font-semibold font-mono">{variable.name}</code>
                    <div className="text-sm text-muted-foreground font-mono truncate mt-0.5">
                      {revealedVars.has(index) ? variable.value : "••••••••••••••••"}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => toggleReveal(index)}
                    >
                      {revealedVars.has(index) ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleCopy(index, variable.value)}
                    >
                      {copied === index ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              {data.isIndefinite
                ? "Never expires"
                : `Expires ${formatRelativeTime(data.expiresAt!)}`}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Unlock view
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="h-6 w-6 text-primary" />
            </div>
          </div>
          <CardTitle>Shared Secrets</CardTitle>
          <CardDescription>
            Enter the passcode to view the shared secrets.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="passcode">6-Digit Passcode</Label>
            <Input
              id="passcode"
              type="password"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              placeholder="Enter 6-digit passcode"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
            />
          </div>

          {unlockError && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {unlockError}
            </div>
          )}

          <Button
            className="w-full gap-2"
            onClick={handleUnlock}
            disabled={isUnlocking || passcode.length !== 6}
          >
            {isUnlocking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            Unlock
          </Button>

          <div className="text-center text-xs text-muted-foreground pt-2">
            {sharedSecret.isIndefinite ? (
              <p>This link does not expire.</p>
            ) : (
              <p>Expires: {formatDateTime(sharedSecret.expiresAt!)}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/share/$shareId")({
  component: ShareView,
});
