import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { AlertTriangle, ArrowLeft, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { hash as cryptoHash, deriveKey, encrypt, generateSalt } from "@/lib/crypto";

function NewProject() {
  const navigate = useNavigate();
  const user = useQuery(api.users.me);
  const createProject = useMutation(api.projects.create);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [passcode, setPasscode] = useState("");
  const [confirmPasscode, setConfirmPasscode] = useState("");
  const [masterKey, setMasterKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPasscode, setShowPasscode] = useState(false);

  const hasMasterKey = user?.masterKeyHash !== undefined;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validation
    if (!name.trim()) {
      setError("Project name is required");
      return;
    }
    // Enforce 6-digit numeric passcode
    if (!/^\d{6}$/.test(passcode)) {
      setError("Passcode must be exactly 6 digits");
      return;
    }
    if (passcode !== confirmPasscode) {
      setError("Passcodes do not match");
      return;
    }
    if (!masterKey.trim()) {
      setError("Master key is required");
      return;
    }

    setIsLoading(true);

    try {
      // Verify master key matches stored hash
      if (!user?.masterKeySalt) {
        setError(
          "Unable to verify master key: salt missing. Try reconfiguring your master key in settings."
        );
        setIsLoading(false);
        return;
      }
      const enteredHash = await cryptoHash(masterKey, user.masterKeySalt);
      if (enteredHash !== user?.masterKeyHash) {
        setError("Invalid master key. Please enter the correct master key.");
        setIsLoading(false);
        return;
      }

      // 1. Generate salt for passcode encryption
      const passcodeSalt = generateSalt();

      // 2. Derive key from master key (for encrypting passcode)
      const recoveryKey = await deriveKey(masterKey, passcodeSalt);

      // 3. Encrypt the passcode with the recovery key
      const { encryptedValue, iv, authTag } = await encrypt(passcode, recoveryKey);

      // 4. Hash the passcode for verification (like master key)
      const passcodeHash = await cryptoHash(passcode, passcodeSalt);

      // 5. Create the project in Convex
      const projectId = await createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        passcodeHash,
        encryptedPasscode: encryptedValue,
        passcodeSalt,
        iv,
        authTag,
      });

      // Navigate to the new project
      navigate({ to: "/projects/$projectId", params: { projectId } });
    } catch (err: any) {
      setError(err.message || "Failed to create project");
      setIsLoading(false);
    }
  }

  if (user === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If user doesn't have a master key set, redirect to settings
  if (!hasMasterKey) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Create New Project</h1>
            <p className="text-muted-foreground">
              Set up a new project with secure environment variables
            </p>
          </div>
        </div>

        <Card className="border-amber-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-500">
              <AlertTriangle className="h-5 w-5" />
              Master Key Required
            </CardTitle>
            <CardDescription>
              You need to set up your master key before creating projects.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your master key is used to encrypt project passcodes for recovery. This is a one-time
              setup that you can manage in Settings.
            </p>
            <Link to="/settings">
              <Button className="gap-2">
                <KeyRound className="h-4 w-4" />
                Go to Settings
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create New Project</h1>
          <p className="text-muted-foreground">
            Set up a new project with secure environment variables
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
            <CardDescription>Basic information about your project</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                placeholder="My Awesome Project"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Optional description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Security Configuration
            </CardTitle>
            <CardDescription>Set up your passcode for this project</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 text-sm">
              <p className="font-medium text-primary mb-2">How it works:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>
                  <strong>Passcode</strong>: Used to encrypt/decrypt your secrets. You'll need this
                  to access variables.
                </li>
                <li>
                  <strong>Master Key</strong>: Your global master key (set in Settings) is used to
                  recover this passcode.
                </li>
                <li>
                  These are <strong>never</strong> stored on our servers in plain text.
                </li>
              </ul>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="passcode">6-Digit Passcode *</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() => setShowPasscode(!showPasscode)}
                >
                  {showPasscode ? (
                    <>
                      <EyeOff className="h-3 w-3 mr-1" />
                      Hide
                    </>
                  ) : (
                    <>
                      <Eye className="h-3 w-3 mr-1" />
                      Show
                    </>
                  )}
                </Button>
              </div>
              <Input
                id="passcode"
                type={showPasscode ? "text" : "password"}
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                placeholder="Enter 6-digit passcode"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value.replace(/\D/g, ""))}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPasscode">Confirm Passcode *</Label>
              <Input
                id="confirmPasscode"
                type={showPasscode ? "text" : "password"}
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                placeholder="Confirm 6-digit passcode"
                value={confirmPasscode}
                onChange={(e) => setConfirmPasscode(e.target.value.replace(/\D/g, ""))}
                disabled={isLoading}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="masterKey">Master Key (for recovery) *</Label>
              <Input
                id="masterKey"
                type="password"
                placeholder="Enter your master key"
                value={masterKey}
                onChange={(e) => setMasterKey(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Enter the master key you configured in Settings to encrypt this project's passcode
                for recovery.
              </p>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-4">
          <Link to="/">
            <Button type="button" variant="outline" disabled={isLoading}>
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Project
          </Button>
        </div>
      </form>
    </div>
  );
}

export const Route = createFileRoute("/projects/new")({
  component: NewProject,
});
