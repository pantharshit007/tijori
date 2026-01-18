import { Link, createFileRoute, useParams } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Clock,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { hash as cryptoHash, decrypt, deriveKey, encrypt } from "@/lib/crypto";
import { formatRelativeTime } from "@/lib/time";

function ProjectView() {
  const { projectId } = useParams({ from: "/projects/$projectId" });
  const project = useQuery(api.projects.get, {
    projectId: projectId as Id<"projects">,
  });
  const environments = useQuery(api.environments.list, {
    projectId: projectId as Id<"projects">,
  });
  const createEnvironment = useMutation(api.environments.create);

  const [activeEnv, setActiveEnv] = useState<string | null>(null);
  const [passcode, setPasscode] = useState("");
  const [derivedKey, setDerivedKey] = useState<CryptoKey | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);

  const [showNewEnvDialog, setShowNewEnvDialog] = useState(false);
  const [newEnvName, setNewEnvName] = useState("");
  const [isCreatingEnv, setIsCreatingEnv] = useState(false);

  // Set first environment as active when loaded
  useEffect(() => {
    if (environments && environments.length > 0 && !activeEnv) {
      setActiveEnv(environments[0]._id);
    }
  }, [environments, activeEnv]);

  async function handleUnlock() {
    if (!project || !passcode) return;

    setIsUnlocking(true);
    setUnlockError(null);

    try {
      // Verify passcode by comparing hash
      const enteredHash = await cryptoHash(passcode, project.passcodeSalt);
      if (enteredHash !== project.passcodeHash) {
        setUnlockError("Invalid passcode. Please try again.");
        setIsUnlocking(false);
        return;
      }

      // Passcode verified, derive key for encryption/decryption
      const key = await deriveKey(passcode, project.passcodeSalt);
      setDerivedKey(key);
      setShowUnlockDialog(false);

      setPasscode("");
    } catch (err: any) {
      setUnlockError("Failed to unlock. Please check your passcode.");
    } finally {
      setIsUnlocking(false);
    }
  }

  function handleLock() {
    setDerivedKey(null);
  }

  async function handleCreateEnvironment() {
    if (!newEnvName.trim()) return;

    setIsCreatingEnv(true);
    try {
      await createEnvironment({
        projectId: projectId as Id<"projects">,
        name: newEnvName.trim(),
      });
      setNewEnvName("");
      setShowNewEnvDialog(false);
    } catch (err) {
      console.error("Failed to create environment:", err);
    } finally {
      setIsCreatingEnv(false);
    }
  }

  if (project === undefined || environments === undefined) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (project === null) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">Project not found</h2>
        <p className="text-muted-foreground mt-2">
          This project may have been deleted or you don't have access.
        </p>
        <Link to="/">
          <Button className="mt-4">Go to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
              <Badge variant="outline">{project.role}</Badge>
            </div>
            <p className="text-muted-foreground">{project.description || "No description"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {derivedKey ? (
            <Button variant="outline" onClick={handleLock} className="gap-2">
              <KeyRound className="h-4 w-4" />
              Lock
            </Button>
          ) : (
            <Dialog open={showUnlockDialog} onOpenChange={setShowUnlockDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <KeyRound className="h-4 w-4" />
                  Unlock
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Enter Passcode</DialogTitle>
                  <DialogDescription>
                    Enter your project passcode to view and edit secrets.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
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
                  {unlockError && <p className="text-sm text-destructive">{unlockError}</p>}
                </div>
                <DialogFooter>
                  <Button onClick={handleUnlock} disabled={isUnlocking || !passcode}>
                    {isUnlocking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Unlock
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          <Button variant="ghost" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Environment Tabs */}
      {environments.length > 0 ? (
        <Tabs value={activeEnv || undefined} onValueChange={setActiveEnv} className="w-full">
          <div className="flex items-center gap-2">
            <TabsList>
              {environments.map((env) => (
                <TabsTrigger key={env._id} value={env._id}>
                  {env.name}
                </TabsTrigger>
              ))}
            </TabsList>
            <Dialog open={showNewEnvDialog} onOpenChange={setShowNewEnvDialog}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1">
                  <Plus className="h-3 w-3" />
                  Add
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Environment</DialogTitle>
                  <DialogDescription>Create a new environment for this project.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="envName">Environment Name</Label>
                    <Input
                      id="envName"
                      placeholder="Production"
                      value={newEnvName}
                      onChange={(e) => setNewEnvName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCreateEnvironment()}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleCreateEnvironment}
                    disabled={isCreatingEnv || !newEnvName.trim()}
                  >
                    {isCreatingEnv && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {environments.map((env) => (
            <TabsContent key={env._id} value={env._id} className="mt-4">
              <EnvironmentVariables environment={env} derivedKey={derivedKey} />
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">No environments found</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EnvironmentVariables({
  environment,
  derivedKey,
}: {
  environment: {
    _id: Id<"environments">;
    _creationTime: number;
    name: string;
    updatedAt: number;
    projectId: Id<"projects">;
    description?: string;
  };
  derivedKey: CryptoKey | null;
}) {
  const variables = useQuery(api.variables.list, { environmentId: environment._id });
  const saveVariable = useMutation(api.variables.save);
  const removeVariable = useMutation(api.variables.remove);

  const [revealedVars, setRevealedVars] = useState<Set<string>>(new Set());
  const [decryptedValues, setDecryptedValues] = useState<Record<string, string>>({});

  // Reset sensitive state when derivedKey is locked (becomes null)
  useEffect(() => {
    if (!derivedKey) {
      setRevealedVars(new Set());
      setDecryptedValues({});
    }
  }, [derivedKey]);
  const [copied, setCopied] = useState<string | null>(null);

  // New variable form
  const [showNewVar, setShowNewVar] = useState(false);
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleReveal(varId: string, encryptedValue: string, iv: string, authTag: string) {
    if (!derivedKey) return;

    if (revealedVars.has(varId)) {
      // Hide
      setRevealedVars((prev) => {
        const next = new Set(prev);
        next.delete(varId);
        return next;
      });
      return;
    }

    try {
      const decrypted = await decrypt(encryptedValue, iv, authTag, derivedKey);
      setDecryptedValues((prev) => ({ ...prev, [varId]: decrypted }));
      setRevealedVars((prev) => new Set(prev).add(varId));
    } catch (err) {
      console.error("Failed to decrypt:", err);
    }
  }

  async function handleCopy(varId: string, encryptedValue: string, iv: string, authTag: string) {
    if (!derivedKey) return;

    try {
      let value = decryptedValues[varId];
      if (!value) {
        value = await decrypt(encryptedValue, iv, authTag, derivedKey);
      }
      await navigator.clipboard.writeText(value);
      setCopied(varId);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }

  async function handleAddVariable() {
    if (!derivedKey || !newName.trim() || !newValue.trim()) return;

    setIsSaving(true);
    try {
      const { encryptedValue, iv, authTag } = await encrypt(newValue, derivedKey);
      await saveVariable({
        environmentId: environment._id,
        name: newName.trim(),
        encryptedValue,
        iv,
        authTag,
      });
      setNewName("");
      setNewValue("");
      setShowNewVar(false);
    } catch (err) {
      console.error("Failed to save variable:", err);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(varId: Id<"variables">) {
    if (!confirm("Are you sure you want to delete this variable?")) return;
    await removeVariable({ id: varId });
  }

  if (variables === undefined) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">
            {variables.length} variable{variables.length !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              {environment.updatedAt === environment._creationTime
                ? `Created ${formatRelativeTime(environment._creationTime)}`
                : `Updated ${formatRelativeTime(environment.updatedAt)}`}
            </span>
          </div>
        </div>
        {derivedKey && (
          <Button
            size="sm"
            onClick={() => setShowNewVar(true)}
            disabled={showNewVar}
            className="gap-1"
          >
            <Plus className="h-3 w-3" />
            Add Variable
          </Button>
        )}
      </div>

      {!derivedKey && variables.length > 0 && (
        <div className="rounded-lg bg-muted/50 border p-4 text-center">
          <KeyRound className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Unlock the project to view or edit variables
          </p>
        </div>
      )}

      {showNewVar && derivedKey && (
        <Card className="border-primary/50">
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="newName" className="text-xs">
                  Name
                </Label>
                <Input
                  id="newName"
                  placeholder="VARIABLE_NAME"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleAddVariable()}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="newValue" className="text-xs">
                  Value
                </Label>
                <Input
                  id="newValue"
                  placeholder="secret_value"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddVariable()}
                  type="password"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowNewVar(false);
                  setNewName("");
                  setNewValue("");
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAddVariable}
                disabled={isSaving || !newName.trim() || !newValue.trim()}
              >
                {isSaving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                Add
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {variables.map((variable) => (
          <div
            key={variable._id}
            className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <code className="text-sm font-semibold font-mono">{variable.name}</code>
              <div className="text-sm text-muted-foreground font-mono truncate mt-0.5">
                {revealedVars.has(variable._id) && decryptedValues[variable._id]
                  ? decryptedValues[variable._id]
                  : "••••••••••••••••"}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={!derivedKey}
                onClick={() =>
                  handleReveal(variable._id, variable.encryptedValue, variable.iv, variable.authTag)
                }
              >
                {revealedVars.has(variable._id) ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={!derivedKey}
                onClick={() =>
                  handleCopy(variable._id, variable.encryptedValue, variable.iv, variable.authTag)
                }
              >
                {copied === variable._id ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => handleDelete(variable._id as Id<"variables">)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}

        {variables.length === 0 && !showNewVar && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No variables in this environment</p>
            {derivedKey && (
              <Button variant="link" onClick={() => setShowNewVar(true)} className="mt-2">
                Add your first variable
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/projects/$projectId")({
  component: ProjectView,
});
