import { Link, createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { 
  ArrowLeft, 
  KeyRound,
  Loader2,
  Plus,
  Settings,
} from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

import type {Environment} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { EnvironmentVariables } from "@/components/environment-variables";
import { hash as cryptoHash, deriveKey } from "@/lib/crypto";


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
              <EnvironmentVariables
                environment={env as Environment}
                derivedKey={derivedKey}
              />
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

export const Route = createFileRoute("/projects/$projectId")({
  component: ProjectView,
});
