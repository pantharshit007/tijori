import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState  } from "react";
import { AlertTriangle, Check, KeyRound, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { api } from "../../convex/_generated/api";

import type { MasterKeyRotationStep } from "@/lib/constants";
import type { ProjectPasscodeUpdate } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

import { decrypt, deriveKey, encrypt, generateSalt, hash } from "@/lib/crypto";

/**
 * Master Key Rotation Steps:
 * 1. User clicks "Rotate Master Key"
 * 2. Dialog prompts for CURRENT master key (verification)
 * 3. Once verified, prompt for NEW master key + confirmation
 * 4. Re-encrypt all project passcodes with new master key
 * 5. Batch update projects and update user's master key hash
 */


function Settings() {
  const user = useQuery(api.users.me);
  const ownedProjects = useQuery(api.projects.listOwned);
  const setMasterKeyMutation = useMutation(api.users.setMasterKey);
  const batchUpdatePasscodes = useMutation(api.projects.batchUpdatePasscodes);

  // Ref to track rotation dialog close timeout
  const rotationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // First-time setup state
  const [masterKey, setMasterKeyInput] = useState("");
  const [confirmMasterKey, setConfirmMasterKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Rotation dialog state
  const [rotationDialogOpen, setRotationDialogOpen] = useState(false);
  const [rotationStep, setRotationStep] = useState<MasterKeyRotationStep>("verify");
  const [currentMasterKey, setCurrentMasterKey] = useState("");
  const [newMasterKey, setNewMasterKey] = useState("");
  const [confirmNewMasterKey, setConfirmNewMasterKey] = useState("");
  const [rotationError, setRotationError] = useState<string | null>(null);
  const [rotationLoading, setRotationLoading] = useState(false);

  // Progress state for re-encryption
  const [rotationProgress, setRotationProgress] = useState(0);
  const [rotationStatus, setRotationStatus] = useState("");

  const hasMasterKey = user?.masterKeyHash !== undefined;

  useEffect(() => {
    // Cleanup rotation dialog timeout on unmount
    return () => {
      if (rotationTimeoutRef.current) {
        clearTimeout(rotationTimeoutRef.current);
        rotationTimeoutRef.current = null;
      }
    };
  }, []);

  // === First-time Master Key Setup ===
  async function handleSetMasterKey(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!masterKey.trim()) {
      setError("Master key is required");
      return;
    }
    if (masterKey.length < 8) {
      setError("Master key must be at least 8 characters");
      return;
    }
    if (masterKey !== confirmMasterKey) {
      setError("Master keys do not match");
      return;
    }

    setIsLoading(true);

    try {
      const masterKeySalt = generateSalt();
      const masterKeyHash = await hash(masterKey, masterKeySalt);

      await setMasterKeyMutation({ masterKeyHash, masterKeySalt });
      setSuccess(true);
      setMasterKeyInput("");
      setConfirmMasterKey("");
    } catch (err: any) {
      setError(err.message || "Failed to set master key");
    } finally {
      setIsLoading(false);
    }
  }

  // === Master Key Rotation: Verify Current Key ===
  async function handleVerifyCurrentKey(e?: React.FormEvent) {
    e?.preventDefault?.(); // Allow form submit to call this without reload
    setRotationError(null);

    if (!currentMasterKey.trim()) {
      setRotationError("Please enter your current master key");
      return;
    }

    if (!user?.masterKeySalt || !user?.masterKeyHash) {
      setRotationError("Master key configuration is invalid");
      return;
    }

    setRotationLoading(true);

    try {
      // Hash the entered key with existing salt and compare
      const enteredHash = await hash(currentMasterKey, user.masterKeySalt);

      if (enteredHash !== user.masterKeyHash) {
        setRotationError("Incorrect master key. Please try again.");
        return;
      }

      // Verification passed - proceed to update step
      setRotationStep("update");
    } catch (err: any) {
      setRotationError(err.message || "Verification failed");
    } finally {
      setRotationLoading(false);
    }
  }

  // === Master Key Rotation: Update to New Key with Re-encryption ===
  async function handleUpdateMasterKey() {
    setRotationError(null);

    if (!newMasterKey.trim()) {
      setRotationError("New master key is required");
      return;
    }
    if (newMasterKey.length < 8) {
      setRotationError("Master key must be at least 8 characters");
      return;
    }
    if (newMasterKey !== confirmNewMasterKey) {
      setRotationError("New master keys do not match");
      return;
    }
    if (newMasterKey === currentMasterKey) {
      setRotationError("New master key must be different from current");
      return;
    }

    // Move to processing step
    setRotationStep("processing");
    setRotationProgress(0);
    setRotationStatus("Starting re-encryption...");

    if (ownedProjects === undefined) {
      setRotationError("Project list is still loading. Please wait...");
      setRotationStep("update");
      return;
    }

    try {
      const projects = ownedProjects;
      const totalProjects = projects.length;

      if (totalProjects === 0) {
        // No projects to re-encrypt, just update the master key
        setRotationStatus("Updating master key...");
        const newSalt = generateSalt();
        const newHash = await hash(newMasterKey, newSalt);

        await setMasterKeyMutation({
          masterKeyHash: newHash,
          masterKeySalt: newSalt,
        });

        setRotationProgress(100);
        setRotationStatus("Complete!");

        // Wait a moment then close
        setTimeout(() => {
          setRotationDialogOpen(false);
          resetRotationState();
          setSuccess(true);
        }, 1000);
        return;
      }

      // Re-encrypt each project's passcode
      const updates: Array<ProjectPasscodeUpdate> = [];

      for (let i = 0; i < projects.length; i++) {
        const project = projects[i];
        setRotationStatus(`Re-encrypting: ${project.name}...`);
        setRotationProgress(Math.round(((i + 0.5) / (totalProjects + 1)) * 100));

        // Step 1: Decrypt the passcode with OLD master key
        const oldKey = await deriveKey(currentMasterKey, project.passcodeSalt);
        const plainPasscode = await decrypt(
          project.encryptedPasscode,
          project.iv,
          project.authTag,
          oldKey
        );

        // Step 2: Encrypt the passcode with NEW master key
        // IMPORTANT: We KEEP the same project.passcodeSalt so variables remain decryptable
        const newKey = await deriveKey(newMasterKey, project.passcodeSalt);
        const { encryptedValue, iv, authTag } = await encrypt(plainPasscode, newKey);

        updates.push({
          projectId: project._id,
          passcodeHash: project.passcodeHash,
          encryptedPasscode: encryptedValue,
          passcodeSalt: project.passcodeSalt,
          iv,
          authTag,
        });
      }

      // Compute new master key hash/salt upfront
      const newSalt = generateSalt();
      const newHash = await hash(newMasterKey, newSalt);

      // Batch update all projects AND master key atomically
      setRotationStatus("Saving encrypted data...");
      setRotationProgress(Math.round((totalProjects / (totalProjects + 1)) * 100));

      await batchUpdatePasscodes({
        updates,
        newMasterKeyHash: newHash,
        newMasterKeySalt: newSalt,
      });

      setRotationProgress(100);
      setRotationStatus(`Complete! Re-encrypted ${totalProjects} project(s).`);

      // Wait a moment then close
      rotationTimeoutRef.current = setTimeout(() => {
        // Guard: do not update state if dialog already closed
        if (!rotationDialogOpen) return;
        setRotationDialogOpen(false);
        resetRotationState();
        setSuccess(true);
      }, 1500);
    } catch (err: any) {
      setRotationStep("update"); // Go back to update step on error
      setRotationError(err.message || "Failed to rotate master key");
    }
  }

  function resetRotationState() {
    setRotationStep("verify");
    setCurrentMasterKey("");
    setNewMasterKey("");
    setConfirmNewMasterKey("");
    setRotationError(null);
    setRotationLoading(false);
    setRotationProgress(0);
    setRotationStatus("");
  }

  function handleDialogOpenChange(open: boolean) {
    setRotationDialogOpen(open);
    if (!open) {
      // Clear rotation finish timeout if dialog is closed early
      if (rotationTimeoutRef.current) {
        clearTimeout(rotationTimeoutRef.current);
        rotationTimeoutRef.current = null;
      }
      resetRotationState();
    }
  }

  if (user === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account and security</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Master Key
          </CardTitle>
          <CardDescription>
            Your master key is used to encrypt project passcodes. This is the only way to recover
            access if you forget a project passcode.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasMasterKey ? (
            // === User HAS a master key: Show rotation option ===
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-green-500">
                <ShieldCheck className="h-4 w-4" />
                Master key is configured
              </div>

              <div className="p-4 rounded-lg border border-border bg-card">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="font-medium">Rotate Master Key</p>
                    <p className="text-sm text-muted-foreground">
                      Change your master key. This will re-encrypt all project passcodes with the
                      new key.
                    </p>
                  </div>
                  <Dialog open={rotationDialogOpen} onOpenChange={handleDialogOpenChange}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Rotate Key
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      {rotationStep === "verify" ? (
                        // Step 1: Verify current master key
                        <form onSubmit={handleVerifyCurrentKey} className="space-y-4">
                          <DialogHeader>
                            <DialogTitle>Verify Current Master Key</DialogTitle>
                            <DialogDescription>
                              For security, please enter your current master key before rotating to
                              a new one.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="currentMasterKey">Current Master Key</Label>
                              <Input
                                id="currentMasterKey"
                                type="password"
                                placeholder="Enter your current master key"
                                value={currentMasterKey}
                                onChange={(e) => setCurrentMasterKey(e.target.value)}
                                disabled={rotationLoading}
                                autoFocus
                              />
                            </div>

                            {rotationError && (
                              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                                {rotationError}
                              </div>
                            )}
                          </div>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => handleDialogOpenChange(false)}
                              disabled={rotationLoading}
                              type="button"
                            >
                              Cancel
                            </Button>
                            <Button type="submit" disabled={rotationLoading || !currentMasterKey}>
                              {rotationLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Verify & Continue
                            </Button>
                          </DialogFooter>
                        </form>
                      ) : rotationStep === "update" ? (
                        // Step 2: Enter new master key
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleUpdateMasterKey();
                          }}
                          className="space-y-4"
                        >
                          <DialogHeader>
                            <DialogTitle>Set New Master Key</DialogTitle>
                            <DialogDescription>
                              Enter your new master key. This will be used to protect all your
                              project passcodes.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="newMasterKey">New Master Key</Label>
                              <Input
                                id="newMasterKey"
                                type="password"
                                placeholder="Enter new master key (min 8 chars)"
                                value={newMasterKey}
                                onChange={(e) => setNewMasterKey(e.target.value)}
                                disabled={rotationLoading}
                                autoFocus
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="confirmNewMasterKey">Confirm New Master Key</Label>
                              <Input
                                id="confirmNewMasterKey"
                                type="password"
                                placeholder="Confirm your new master key"
                                value={confirmNewMasterKey}
                                onChange={(e) => setConfirmNewMasterKey(e.target.value)}
                                disabled={rotationLoading}
                              />
                            </div>

                            {rotationError && (
                              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                                {rotationError}
                              </div>
                            )}

                            {ownedProjects === undefined && (
                              <div className="p-3 rounded-lg bg-muted border border-border text-muted-foreground text-sm">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin inline-block" />{" "}
                                Loading project list...
                              </div>
                            )}

                            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 text-sm">
                              <div className="flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                                <span>
                                  All project passcodes will be re-encrypted with your new master
                                  key. Make sure to remember it!
                                </span>
                              </div>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => setRotationStep("verify")}
                              disabled={rotationLoading}
                              type="button"
                            >
                              Back
                            </Button>
                            <Button
                              type="submit"
                              disabled={
                                rotationLoading ||
                                !newMasterKey ||
                                !confirmNewMasterKey ||
                                ownedProjects === undefined
                              }
                            >
                              {rotationLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Update Master Key
                            </Button>
                          </DialogFooter>
                        </form>
                      ) : (
                        // Step 3: Processing - Re-encrypting projects
                        <>
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <RefreshCw className="h-5 w-5 animate-spin" />
                              Rotating Master Key
                            </DialogTitle>
                            <DialogDescription>
                              Please wait while we re-encrypt your project passcodes with the new
                              master key.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-6">
                            <Progress value={rotationProgress} className="h-2" />
                            <p className="text-sm text-center text-muted-foreground">
                              {rotationStatus}
                            </p>
                            {rotationProgress === 100 && (
                              <div className="flex justify-center">
                                <Check className="h-8 w-8 text-green-500" />
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {success && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 text-sm flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  Master key updated successfully!
                </div>
              )}
            </div>
          ) : (
            // === User does NOT have a master key: First-time setup ===
            <>
              <div className="flex items-center gap-2 text-sm text-amber-500 mb-4">
                <AlertTriangle className="h-4 w-4" />
                No master key set. You'll need to set one before creating projects.
              </div>

              <form onSubmit={handleSetMasterKey} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="masterKey">Master Key</Label>
                  <Input
                    id="masterKey"
                    type="password"
                    placeholder="Enter a strong master key (min 8 chars)"
                    value={masterKey}
                    onChange={(e) => setMasterKeyInput(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmMasterKey">Confirm Master Key</Label>
                  <Input
                    id="confirmMasterKey"
                    type="password"
                    placeholder="Confirm your master key"
                    value={confirmMasterKey}
                    onChange={(e) => setConfirmMasterKey(e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 text-sm flex items-center gap-2">
                    <Check className="h-4 w-4" />
                    Master key set successfully!
                  </div>
                )}

                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Set Master Key
                </Button>
              </form>
            </>
          )}

          <div className="mt-6 p-4 rounded-lg bg-muted text-sm">
            <p className="font-medium mb-2">⚠️ Important Security Notes:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>
                Your master key is <strong>never</strong> stored on our servers.
              </li>
              <li>Only a hash of your master key is stored for verification.</li>
              <li>If you lose your master key, you cannot recover project passcodes.</li>
              <li>Write it down and store it in a safe place.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/settings")({
  component: Settings,
});
