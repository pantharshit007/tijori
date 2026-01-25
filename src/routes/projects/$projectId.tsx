import { Link, createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ExternalLink,
  KeyRound,
  Loader2,
  Plus,
  Settings,
  Share2,
  ShieldQuestion,
  Users,
} from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

import type { Environment } from "@/lib/types";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { EnvironmentVariables } from "@/components/environment-variables";
import { PasscodeRecovery } from "@/components/passcode-recovery";
import { MembersDrawer } from "@/components/members-drawer";
import { ProjectSettings } from "@/components/project-settings";
import { UserAvatar } from "@/components/user-avatar";
import { hash as cryptoHash, deriveKey } from "@/lib/crypto";
import { keyStore } from "@/lib/key-store";


function ProjectView() {
  const { projectId } = useParams({ from: "/projects/$projectId" });
  const project = useQuery(api.projects.get, {
    projectId: projectId as Id<"projects">,
  });
  const environments = useQuery(api.environments.list, {
    projectId: projectId as Id<"projects">,
  });
  const user = useQuery(api.users.me);
  const members = useQuery(api.projects.listMembers, {
    projectId: projectId as Id<"projects">,
  });
  const createEnvironment = useMutation(api.environments.create);

  const [activeEnv, setActiveEnv] = useState<string | null>(null);
  const [derivedKey, setDerivedKey] = useState<CryptoKey | null>(null);
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<"project" | "shared">("project");

  // Query shared secrets for the Shared tab
  const sharedSecrets = useQuery(api.sharedSecrets.listByProject, {
    projectId: projectId as Id<"projects">,
  });

  // Passcode recovery state
  const [recoveryMode, setRecoveryMode] = useState(false);

  const [showNewEnvDialog, setShowNewEnvDialog] = useState(false);
  const [newEnvName, setNewEnvName] = useState("");
  const [newEnvDescription, setNewEnvDescription] = useState("");
  const [isCreatingEnv, setIsCreatingEnv] = useState(false);

  // 1. Sync local derivedKey to keyStore (Only if non-null)
  useEffect(() => {
    if (derivedKey) {
      keyStore.setKey(projectId, derivedKey);
    }
  }, [derivedKey, projectId]);

  // 2. Rehydrate from keyStore on mount or project switch
  useEffect(() => {
    if (!derivedKey) {
      const existing = keyStore.getKey(projectId);
      if (existing) {
        setDerivedKey(existing);
      }
    }
  }, [projectId, derivedKey]);

  // 3. Clear local state when project ID changes to prevent cross-project key leakage
  useEffect(() => {
    setDerivedKey(null);
  }, [projectId]);

  // Set first environment as active when loaded
  useEffect(() => {
    if (environments && environments.length > 0 && !activeEnv) {
      setActiveEnv(environments[0]._id);
    }
  }, [environments, activeEnv]);

  function handleLock() {
    setDerivedKey(null);
    keyStore.removeKey(projectId);
  }

  async function handleCreateEnvironment() {
    if (!newEnvName.trim()) return;

    setIsCreatingEnv(true);
    try {
      await createEnvironment({
        projectId: projectId as Id<"projects">,
        name: newEnvName.trim(),
        description: newEnvDescription.trim() || undefined,
      });
      setNewEnvName("");
      setNewEnvDescription("");
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
    <div
      className="w-full max-w-300 mx-auto space-y-6 px-2 sm:px-4 md:px-8 lg:px-12 xl:px-20"
      style={{ minWidth: 0 }}
    >
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
              <h1 className="text-2xl max-md:text-xl font-bold tracking-tight">{project.name}</h1>
              <Badge variant="outline">{project.role}</Badge>
            </div>
            <p className="text-muted-foreground max-md:text-sm">
              {project.description
                ? project.description.length > 30
                  ? project.description.slice(0, 30) + "..."
                  : project.description
                : "No description"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {derivedKey ? (
            <Button variant="outline" onClick={handleLock} className="gap-2">
              <KeyRound className="h-4 w-4" />
              Lock
            </Button>
          ) : (
            <Dialog
              open={showUnlockDialog}
              onOpenChange={(open) => {
                setShowUnlockDialog(open);
                if (!open) {
                  setRecoveryMode(false);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <KeyRound className="h-4 w-4" />
                  Unlock
                </Button>
              </DialogTrigger>
              <DialogContent>
                {recoveryMode ? (
                  <PasscodeRecovery
                    project={project}
                    user={user}
                    onBack={() => setRecoveryMode(false)}
                  />
                ) : (
                  <PasscodeUnlock
                    project={project}
                    userRole={project.role}
                    onUnlockSuccess={(key) => {
                      setDerivedKey(key);
                      setShowUnlockDialog(false);
                    }}
                    onForgotPasscode={() => setRecoveryMode(true)}
                  />
                )}
              </DialogContent>
            </Dialog>
          )}
          {/* Members Drawer */}
          <MembersDrawer
            projectId={projectId as Id<"projects">}
            userRole={project.role}
            trigger={
              <Button variant="ghost" size="icon">
                <Users className="h-4 w-4" />
              </Button>
            }
          />
          {/* Project Settings */}
          <ProjectSettings
            project={project}
            environments={environments || []}
            membersCount={members?.length || 0}
            trigger={
              <Button variant="ghost" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            }
          />
        </div>
      </div>

      {/* Project / Shared Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "project" | "shared")}
        className="w-full"
      >
        <TabsList>
          <TabsTrigger value="project" className="data-[state=active]:bg-secondary dark:data-[state=active]:bg-secondary text-accent data-[state=active]:text-accent data-[state=inactive]:text-zinc-800">
            Project
          </TabsTrigger>
          <TabsTrigger
            value="shared"
            className="gap-1.5 data-[state=active]:bg-secondary dark:data-[state=active]:bg-secondary text-accent data-[state=active]:text-accent  data-[state=inactive]:text-zinc-800"
          >
            <Share2 className="h-3 w-3" />
            Shared
          </TabsTrigger>
        </TabsList>

        {/* Project Tab Content */}
        <TabsContent value="project" className="mt-4 space-y-4">
          {environments.length > 0 ? (
            <>
              {/* Environment Dropdown + Add Button */}
              <div className="flex items-center gap-2">
                <Select value={activeEnv || undefined} onValueChange={setActiveEnv}>
                  <SelectTrigger className="w-50">
                    <SelectValue placeholder="Select Environment" />
                  </SelectTrigger>
                  <SelectContent>
                    {environments.map((env) => (
                      <SelectItem key={env._id} value={env._id}>
                        {env.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Only owners and admins can add environments */}
                {(project.role === "owner" || project.role === "admin") && (
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
                        <DialogDescription>
                          Create a new environment for this project.
                        </DialogDescription>
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
                        <div className="space-y-2">
                          <Label htmlFor="envDescription">Description (Optional)</Label>
                          <Input
                            id="envDescription"
                            placeholder="Production environment for live app..."
                            value={newEnvDescription}
                            onChange={(e) => setNewEnvDescription(e.target.value)}
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
                )}
              </div>

              {/* Environment Variables */}
              {activeEnv && environments.find((e) => e._id === activeEnv) && (
                <EnvironmentVariables
                  environment={environments.find((e) => e._id === activeEnv) as Environment}
                  derivedKey={derivedKey}
                  userRole={project.role}
                />
              )}
            </>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground">No environments found</p>
                {(project.role === "owner" || project.role === "admin") && (
                  <Button variant="link" onClick={() => setShowNewEnvDialog(true)} className="mt-2">
                    Create your first environment
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Shared Tab Content */}
        <TabsContent value="shared" className="mt-4">
          {sharedSecrets && sharedSecrets.length > 0 ? (
            <div className="space-y-2">
              {sharedSecrets.map((share) => (
                <Link
                  key={share._id}
                  to="/shared"
                  search={{ p: project.name }}
                  className="block"
                >
                  <Card className="p-4 hover:bg-accent/50 transition-colors cursor-pointer group">
                    <div className="grid grid-cols-12 items-center gap-4">
                      {/* Column 1: Creator Avatar (col 1) */}
                      <div className="col-span-1">
                        <UserAvatar
                          src={share.creatorImage}
                          name={share.creatorName}
                          size="md"
                          showTooltip={true}
                          tooltipContent={<p className="text-xs font-medium">{share.creatorName}</p>}
                        />
                      </div>

                      {/* Column 2: Label, Environment, Creator, Views (col 2-8) */}
                      <div className="col-span-7 min-w-0">
                        <div className="flex items-center gap-2">
                          {share.name && (
                            <span className="font-medium text-sm truncate">{share.name}</span>
                          )}
                          <span className={`text-sm ${share.name ? 'text-muted-foreground' : 'font-medium'}`}>
                            {share.environmentName}
                          </span>
                        </div>

                        <p className="text-xs text-muted-foreground mt-0.5">
                          by {share.creatorName?.split(" ")[0] || "Unknown"} • {share.views} views
                        </p>
                      </div>

                      {/* Column 3: Status + Arrow (col 9-12) */}
                      <div className="col-span-4 flex items-center justify-end gap-3">
                        <Badge
                          variant={
                            share.isDisabled ? "disabled" : share.isExpired ? "expired" : "active"
                          }
                        >
                          {share.isDisabled ? "Disabled" : share.isExpired ? "Expired" : "Active"}
                        </Badge>
                        <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </Card>


                </Link>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Share2 className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="font-medium">No shared variables linked</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Link variables from your team's shared environment variables to use them in this
                  project.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

      </Tabs>
    </div>
  );
}

function PasscodeUnlock({
  project,
  userRole,
  onUnlockSuccess,
  onForgotPasscode,
}: {
  project: any;
  userRole: "owner" | "admin" | "member";
  onUnlockSuccess: (key: CryptoKey) => void;
  onForgotPasscode: () => void;
}) {
  const [passcode, setPasscode] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

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
      onUnlockSuccess(key);
      setPasscode("");
    } catch (err: any) {
      console.error("Unlock failed:", err);
      setUnlockError("Failed to unlock. Please check your passcode.");
    } finally {
      setIsUnlocking(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Enter Passcode</DialogTitle>
        <DialogDescription>Enter your project passcode to view and edit secrets.</DialogDescription>
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
            autoFocus
          />
        </div>
        {unlockError && <p className="text-sm text-destructive">{unlockError}</p>}
      </div>
      <DialogFooter className="flex-col gap-2 sm:flex-row">
        {/* Only owners can recover passcode - it's bound to their master key */}
        {userRole === "owner" && (
          <Button variant="ghost" onClick={onForgotPasscode} className="text-muted-foreground">
            <ShieldQuestion className="mr-2 h-4 w-4" />
            Forgot Passcode?
          </Button>
        )}
        <Button onClick={handleUnlock} disabled={isUnlocking || !passcode}>
          {isUnlocking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Unlock
        </Button>
      </DialogFooter>
    </>
  );
}

export const Route = createFileRoute("/projects/$projectId")({
  component: ProjectView,
});
