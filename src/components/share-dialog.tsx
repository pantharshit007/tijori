import React, { useState } from "react";
import { Check, Clock, Copy, ExternalLink, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "../../convex/_generated/dataModel";

import type { ShareExpiryValue } from "@/lib/constants";
import type { Environment, Variable } from "@/lib/types";
import {
  MAX_LENGTHS,
  SHARE_EXPIRY_OPTIONS,
  SHARE_MAX_VIEWS_LIMIT,
  SHARE_PASSCODE_MAX_LENGTH,
  SHARE_PASSCODE_MIN_LENGTH,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { decrypt, deriveKey, encrypt, generateSalt } from "@/lib/crypto";
import { getErrorMessage } from "@/lib/errors";
import { generateSharePasscode, getSharePasscodeError } from "@/lib/utils";

export interface ShareDialogProps {
  variables: Array<Variable>;
  environment: Environment;
  derivedKey: CryptoKey;
  createShare: (args: {
    projectId: Id<"projects">;
    environmentId: Id<"environments">;
    name?: string;
    encryptedPasscode: string;
    passcodeIv: string;
    passcodeAuthTag: string;
    encryptedPayload: string;
    encryptedShareKey: string;
    passcodeSalt: string;
    iv: string;
    authTag: string;
    payloadIv: string;
    payloadAuthTag: string;
    expiresAt?: number;
    isIndefinite: boolean;
    maxViews?: number;
  }) => Promise<Id<"sharedSecrets">>;
  trigger?: React.ReactNode;
}

export function ShareDialog({
  variables,
  environment,
  derivedKey,
  createShare,
  trigger,
}: ShareDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedVars, setSelectedVars] = useState<Set<string>>(new Set());
  const [expiry, setExpiry] = useState<ShareExpiryValue>("24h");
  const [shareName, setShareName] = useState("");
  const [sharePasscode, setSharePasscode] = useState("");
  const [passcodeError, setPasscodeError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [limitViews, setLimitViews] = useState(false);
  const [oneTime, setOneTime] = useState(false);
  const [maxViews, setMaxViews] = useState("");
  const [viewsError, setViewsError] = useState<string | null>(null);

  function toggleVar(varId: string) {
    setSelectedVars((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(varId)) {
        next.delete(varId);
      } else {
        next.add(varId);
      }
      return next;
    });
  }

  function selectAll() {
    setSelectedVars(new Set(variables.map((v) => v._id)));
  }

  function deselectAll() {
    setSelectedVars(new Set());
  }

  async function handleCreate() {
    if (selectedVars.size === 0) return;

    const passcodeValidation = getSharePasscodeError(sharePasscode);
    if (passcodeValidation) {
      setPasscodeError(passcodeValidation);
      return;
    }
    setPasscodeError(null);

    let resolvedMaxViews: number | undefined;
    if (oneTime) {
      resolvedMaxViews = 1;
      setViewsError(null);
    } else if (limitViews) {
      const parsed = Number.parseInt(maxViews, 10);
      if (!Number.isFinite(parsed) || parsed < 1) {
        setViewsError("Max views must be a positive number");
        return;
      }
      if (parsed > SHARE_MAX_VIEWS_LIMIT) {
        setViewsError(`Max views cannot exceed ${SHARE_MAX_VIEWS_LIMIT}`);
        return;
      }
      resolvedMaxViews = parsed;
      setViewsError(null);
    } else {
      setViewsError(null);
    }

    setIsCreating(true);

    try {
      // 1. Decrypt selected variables using project's derivedKey
      const selectedVariables = variables.filter((v) => selectedVars.has(v._id));
      const decryptedVars: Array<{ name: string; value: string }> = [];

      for (const v of selectedVariables) {
        const value = await decrypt(v.encryptedValue, v.iv, v.authTag, derivedKey);
        decryptedVars.push({ name: v.name, value });
      }

      // 2. Generate a random ShareKey
      const shareKeyBytes = crypto.getRandomValues(new Uint8Array(32));
      const shareKeyBase64 = btoa(String.fromCharCode(...shareKeyBytes));

      // 3. Import ShareKey for encryption
      const shareKey = await crypto.subtle.importKey(
        "raw",
        shareKeyBytes,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt"]
      );

      // 4. Encrypt the variables with ShareKey
      const payloadJson = JSON.stringify(decryptedVars);
      const payloadIv = crypto.getRandomValues(new Uint8Array(12));
      const payloadEncoder = new TextEncoder();
      const payloadCiphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: payloadIv },
        shareKey,
        payloadEncoder.encode(payloadJson)
      );

      const payloadCiphertextArray = new Uint8Array(payloadCiphertext);
      const payloadAuthTagStart = payloadCiphertextArray.length - 16;
      const payloadEncrypted = payloadCiphertextArray.slice(0, payloadAuthTagStart);
      const payloadAuthTag = payloadCiphertextArray.slice(payloadAuthTagStart);

      // 5. Generate salt and derive key from USER-ENTERED share passcode
      const shareSalt = generateSalt();
      const sharePassKey = await deriveKey(sharePasscode, shareSalt);

      // 6. Encrypt ShareKey with the user's share passcode key
      const shareKeyIv = crypto.getRandomValues(new Uint8Array(12));
      const shareKeyCiphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: shareKeyIv },
        sharePassKey,
        payloadEncoder.encode(shareKeyBase64)
      );

      const shareKeyCiphertextArray = new Uint8Array(shareKeyCiphertext);
      const shareKeyAuthTagStart = shareKeyCiphertextArray.length - 16;
      const shareKeyEncrypted = shareKeyCiphertextArray.slice(0, shareKeyAuthTagStart);
      const shareKeyAuthTag = shareKeyCiphertextArray.slice(shareKeyAuthTagStart);

      // 7. Calculate expiry using constants
      let expiresAt: number | undefined;
      const isIndefinite = expiry === "never";
      if (!isIndefinite) {
        const option = SHARE_EXPIRY_OPTIONS.find((o) => o.value === expiry);
        if (option?.ms) {
          expiresAt = Date.now() + option.ms;
        }
      }

      // 8. Encrypt the share passcode itself using Project Key (derivedKey)
      // This is so the creator can see it in their dashboard but it's not plaintext in DB.
      const {
        encryptedValue: encPass,
        iv: passIv,
        authTag: passTag,
      } = await encrypt(sharePasscode, derivedKey);

      // 9. Create the share
      const shareId = await createShare({
        projectId: environment.projectId,
        environmentId: environment._id,
        name: shareName.trim() || undefined,
        encryptedPasscode: encPass,
        passcodeIv: passIv,
        passcodeAuthTag: passTag,
        encryptedPayload: btoa(String.fromCharCode(...payloadEncrypted)),
        encryptedShareKey: btoa(String.fromCharCode(...shareKeyEncrypted)),
        passcodeSalt: shareSalt,
        iv: btoa(String.fromCharCode(...shareKeyIv)),
        authTag: btoa(String.fromCharCode(...shareKeyAuthTag)),
        payloadIv: btoa(String.fromCharCode(...payloadIv)),
        payloadAuthTag: btoa(String.fromCharCode(...payloadAuthTag)),
        expiresAt,
        isIndefinite,
        maxViews: resolvedMaxViews,
      });

      // 10. Generate share URL
      const url = `${window.location.origin}/share/${shareId}`;
      setShareUrl(url);
      toast.success("Share link created");
    } catch (err: any) {
      console.error("Failed to create share:", err);
      toast.error(getErrorMessage(err, "Failed to create share"));
    } finally {
      setIsCreating(false);
    }
  }

  async function handleCopy() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleClose() {
    setOpen(false);
    // Reset state after dialog close animation
    setTimeout(() => {
      setSelectedVars(new Set());
      setExpiry("24h");
      setShareName("");
      setSharePasscode("");
      setPasscodeError(null);
      setLimitViews(false);
      setOneTime(false);
      setMaxViews("");
      setViewsError(null);
      setShareUrl(null);
      setCopied(false);
    }, 200);
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => (isOpen ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild>
        {React.isValidElement(trigger) ? (
          trigger
        ) : (
          <Button variant="outline" size="sm" className="gap-1" title="Open share dialog">
            <Share2 className="h-3 w-3" />
            Share
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        {!shareUrl ? (
          <>
            <DialogHeader>
              <DialogTitle>Share Variables</DialogTitle>
              <DialogDescription>
                Create a secure link to share variables from {environment.name}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Variable selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Select Variables</Label>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={selectAll}
                      className="h-7 text-xs"
                      title="Select all variables"
                    >
                      All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={deselectAll}
                      className="h-7 text-xs"
                      title="Deselect all variables"
                    >
                      None
                    </Button>
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto rounded-lg border p-2 space-y-1">
                  {variables.map((v) => (
                    <label
                      key={v._id}
                      className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedVars.has(v._id)}
                        onCheckedChange={() => toggleVar(v._id)}
                      />
                      <code className="text-sm font-mono">{v.name}</code>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {selectedVars.size} of {variables.length} selected
                </p>
              </div>

              {/* Share label (optional) */}
              <div className="space-y-2">
                <Label htmlFor="share-name">Label (optional)</Label>
                <Input
                  id="share-name"
                  type="text"
                  maxLength={MAX_LENGTHS.SECRET_NAME}
                  placeholder="e.g., For QA Team, Staging Deploy"
                  value={shareName}
                  onChange={(e) => setShareName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  A short description to help you identify this share later.
                </p>
              </div>

              {/* Passcode input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="share-passcode">Share Passcode</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSharePasscode(generateSharePasscode(10, 16));
                      setPasscodeError(null);
                    }}
                    title="Generate a random passcode"
                  >
                    Generate
                  </Button>
                </div>
                <Input
                  id="share-passcode"
                  type="password"
                  maxLength={SHARE_PASSCODE_MAX_LENGTH}
                  placeholder="Enter a strong passcode"
                  value={sharePasscode}
                  onChange={(e) => setSharePasscode(e.target.value)}
                />
                {passcodeError && <p className="text-xs text-destructive">{passcodeError}</p>}
                <p className="text-xs text-muted-foreground">
                  Use {SHARE_PASSCODE_MIN_LENGTH}+ letters and numbers. Recipients will need this
                  passcode to view the secrets.
                </p>
              </div>

              {/* Expiry selection */}
              <div className="space-y-2">
                <Label>Link Expiry</Label>
                <Select value={expiry} onValueChange={(v) => setExpiry(v as ShareExpiryValue)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SHARE_EXPIRY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* View limits */}
              <div className="space-y-3">
                <Label>View Limits (Optional)</Label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={oneTime}
                    onCheckedChange={(checked) => {
                      const next = Boolean(checked);
                      setOneTime(next);
                      if (next) {
                        setLimitViews(false);
                        setMaxViews("");
                        setViewsError(null);
                      }
                    }}
                  />
                  One-time link (max 1 view)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={limitViews}
                    onCheckedChange={(checked) => {
                      const next = Boolean(checked);
                      setLimitViews(next);
                      if (next) {
                        setOneTime(false);
                      } else {
                        setMaxViews("");
                        setViewsError(null);
                      }
                    }}
                    disabled={oneTime}
                  />
                  Limit number of views
                </label>
                {limitViews && !oneTime && (
                  <div className="space-y-2 pl-6">
                    <Input
                      type="number"
                      min={1}
                      max={SHARE_MAX_VIEWS_LIMIT}
                      placeholder="e.g., 3"
                      value={maxViews}
                      onChange={(e) => setMaxViews(e.target.value)}
                    />
                    {viewsError && <p className="text-xs text-destructive">{viewsError}</p>}
                    <p className="text-xs text-muted-foreground">
                      Max {SHARE_MAX_VIEWS_LIMIT} views.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} title="Cancel share creation">
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={
                  isCreating ||
                  selectedVars.size === 0 ||
                  Boolean(getSharePasscodeError(sharePasscode))
                }
                className="gap-2"
                title="Create share link"
              >
                {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Link
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Share Link Created</DialogTitle>
              <DialogDescription>
                Your secure link is ready. Anyone with the link and passcode can view these secrets
                until it expires.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Share Link</Label>
                <div className="flex gap-2">
                  <Input readOnly value={shareUrl} className="font-mono text-xs" />
                  <Button size="icon" variant="outline" onClick={handleCopy} title="Copy share link">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="rounded-lg bg-muted p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Passcode</span>
                  <code className="bg-background px-2 py-1 rounded border font-mono text-sm leading-none">
                    {sharePasscode}
                  </code>
                </div>
                <Separator className="opacity-50" />
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>
                      {expiry === "never"
                        ? "No expiration"
                        : `Expires ${SHARE_EXPIRY_OPTIONS.find((o) => o.value === expiry)?.label}`}
                    </span>
                  </div>
                  {oneTime && <div>Max views: 1 (one-time link)</div>}
                  {!oneTime && limitViews && maxViews && <div>Max views: {maxViews}</div>}
                  <div>{selectedVars.size} variables shared</div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button className="w-full gap-2" variant="outline" asChild title="Open share link">
                  <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Test Link
                  </a>
                </Button>
                <Button className="w-full" onClick={handleClose} title="Close share dialog">
                  Done
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Separator({ className }: { className?: string }) {
  return <div className={`h-px w-full bg-border ${className}`} />;
}
