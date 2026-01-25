import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { 
  Edit, 
  FolderKey,
  Loader2, 
  LogOut, 
  MoreVertical,
  Pencil,
  Save,
  Trash2,
  Users 
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { hash as cryptoHash } from "@/lib/crypto";

interface Environment {
  _id: Id<"environments">;
  name: string;
  description?: string;
}

interface ProjectSettingsProps {
  project: {
    _id: Id<"projects">;
    name: string;
    description?: string;
    passcodeHint?: string;
    role: "owner" | "admin" | "member";
  };
  environments: Array<Environment>;
  membersCount: number;
  trigger: React.ReactNode;
}

export function ProjectSettings({ 
  project, 
  environments,
  membersCount,
  trigger 
}: ProjectSettingsProps) {
  const navigate = useNavigate();
  const user = useQuery(api.users.me);
  const leaveProject = useMutation(api.projects.leaveProject);
  const updateProject = useMutation(api.projects.updateProject);
  const deleteProject = useMutation(api.projects.deleteProject);
  const updateEnvironment = useMutation(api.environments.updateEnvironment);
  const deleteEnvironment = useMutation(api.environments.deleteEnvironment);

  const [open, setOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [masterKeyForDelete, setMasterKeyForDelete] = useState("");

  // Edit project state
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const [editDescription, setEditDescription] = useState(project.description || "");
  const [editPasscodeHint, setEditPasscodeHint] = useState(project.passcodeHint || "");
  const [isSavingProject, setIsSavingProject] = useState(false);

  // Edit environment state
  const [editingEnvId, setEditingEnvId] = useState<Id<"environments"> | null>(null);
  const [editEnvName, setEditEnvName] = useState("");
  const [editEnvDescription, setEditEnvDescription] = useState("");
  const [isSavingEnv, setIsSavingEnv] = useState(false);

  const isOwner = project.role === "owner";
  const isOwnerOrAdmin = project.role === "owner" || project.role === "admin";

  async function handleLeave() {
    setIsLeaving(true);
    try {
      await leaveProject({ projectId: project._id });
      setOpen(false);
      navigate({ to: "/" });
    } catch (err) {
      console.error("Failed to leave project:", err);
    } finally {
      setIsLeaving(false);
    }
  }

  async function handleSaveProject() {
    if (!editName.trim()) return;
    
    setIsSavingProject(true);
    try {
      await updateProject({
        projectId: project._id,
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        passcodeHint: editPasscodeHint.trim() || undefined,
      });
      setIsEditingProject(false);
    } catch (err) {
      console.error("Failed to update project:", err);
    } finally {
      setIsSavingProject(false);
    }
  }

  async function handleSaveEnvironment() {
    if (!editingEnvId || !editEnvName.trim()) return;
    
    setIsSavingEnv(true);
    try {
      await updateEnvironment({
        environmentId: editingEnvId,
        name: editEnvName.trim(),
        description: editEnvDescription.trim() || undefined,
      });
      setEditingEnvId(null);
    } catch (err) {
      console.error("Failed to update environment:", err);
    } finally {
      setIsSavingEnv(false);
    }
  }

  async function handleDeleteEnvironment(envId: Id<"environments">) {
    try {
      await deleteEnvironment({ environmentId: envId });
    } catch (err) {
      console.error("Failed to delete environment:", err);
    }
  }

  async function handleDeleteProject() {
    if (!user?.masterKeySalt || !user?.masterKeyHash) {
      setDeleteError("Master key not configured");
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const enteredHash = await cryptoHash(masterKeyForDelete, user.masterKeySalt);
      if (enteredHash !== user.masterKeyHash) {
        setDeleteError("Incorrect master key");
        setIsDeleting(false);
        return;
      }

      await deleteProject({ projectId: project._id });
      setOpen(false);
      navigate({ to: "/" });
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete project");
    } finally {
      setIsDeleting(false);
    }
  }

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) {
      setIsEditingProject(false);
      setEditName(project.name);
      setEditDescription(project.description || "");
      setEditPasscodeHint(project.passcodeHint || "");
      setMasterKeyForDelete("");
      setDeleteError(null);
      setEditingEnvId(null);
    }
  }

  function startEditEnv(env: Environment) {
    setEditingEnvId(env._id);
    setEditEnvName(env.name);
    setEditEnvDescription(env.description || "");
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Project Settings</DialogTitle>
          <DialogDescription>
            Manage project details, environments, and membership.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="environments">Environments ({environments.length})</TabsTrigger>
            <TabsTrigger value="danger">Danger</TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-4 mt-4">
            {/* Project Info Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <FolderKey className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                <p className="text-2xl font-bold">{environments.length}</p>
                <p className="text-xs text-muted-foreground">Environments</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <Users className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                <p className="text-2xl font-bold">{membersCount}</p>
                <p className="text-xs text-muted-foreground">Members</p>
              </div>
            </div>

            <Separator />

            {/* Edit Project Details - Owner only */}
            {isOwner && (
              <>
                {isEditingProject ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="editName">Project Name</Label>
                      <Input
                        id="editName"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="editDescription">Description</Label>
                      <Textarea
                        id="editDescription"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Optional description..."
                        rows={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="editPasscodeHint">Passcode Hint</Label>
                      <Input
                        id="editPasscodeHint"
                        value={editPasscodeHint}
                        onChange={(e) => setEditPasscodeHint(e.target.value)}
                        placeholder="Help remember your passcode..."
                      />
                      <p className="text-xs text-muted-foreground">
                        Only visible to you in settings.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleSaveProject}
                        disabled={isSavingProject || !editName.trim()}
                      >
                        {isSavingProject && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                        <Save className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setIsEditingProject(false);
                          setEditName(project.name);
                          setEditDescription(project.description || "");
                          setEditPasscodeHint(project.passcodeHint || "");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{project.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {project.description || "No description"}
                        </p>
                        {project.passcodeHint && (
                          <p className="text-xs text-muted-foreground mt-1">
                            <span className="font-medium">Passcode hint:</span>{" "}
                            {project.passcodeHint}
                          </p>
                        )}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => setIsEditingProject(true)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Non-owner view */}
            {!isOwner && (
              <div className="space-y-2">
                <p className="font-medium">{project.name}</p>
                <p className="text-sm text-muted-foreground">
                  {project.description || "No description"}
                </p>
              </div>
            )}
          </TabsContent>

          {/* Environments Tab */}
          <TabsContent value="environments" className="space-y-4 mt-4">
            {environments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FolderKey className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No environments in this project</p>
              </div>
            ) : (
              <div className="space-y-2">
                {environments.map((env) => (
                  <div
                    key={env._id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                  >
                    {editingEnvId === env._id ? (
                      <div className="flex-1 space-y-2">
                        <Input
                          value={editEnvName}
                          onChange={(e) => setEditEnvName(e.target.value)}
                          placeholder="Environment name"
                        />
                        <Input
                          value={editEnvDescription}
                          onChange={(e) => setEditEnvDescription(e.target.value)}
                          placeholder="Description (optional)"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleSaveEnvironment}
                            disabled={isSavingEnv || !editEnvName.trim()}
                          >
                            {isSavingEnv && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingEnvId(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{env.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {env.description || "No description"}
                          </p>
                        </div>
                        {isOwnerOrAdmin && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => startEditEnv(env)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem
                                    onSelect={(e) => e.preventDefault()}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Environment?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete "{env.name}" and all its
                                      variables. This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteEnvironment(env._id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Danger Tab */}
          <TabsContent value="danger" className="space-y-4 mt-4">
            {/* Leave Project - Non-owners */}
            {!isOwner && (
              <div className="rounded-lg border p-4">
                <h4 className="font-medium text-sm">Leave Project</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  You will lose access to this project and all its variables.
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  className="mt-3 gap-2"
                  onClick={handleLeave}
                  disabled={isLeaving}
                >
                  {isLeaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  <LogOut className="h-4 w-4" />
                  Leave Project
                </Button>
              </div>
            )}

            {/* Delete Project - Owner only */}
            {isOwner && (
              <div className="rounded-lg border border-destructive/50 p-4">
                <h4 className="font-medium text-sm text-destructive">Delete Project</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Permanently delete this project and all its data.
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="mt-3 gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Project
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Project?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete <strong>{project.name}</strong> and all its:
                        <ul className="list-disc list-inside mt-2">
                          <li>{environments.length} environment(s) and all variables</li>
                          <li>All shared links</li>
                          <li>All member associations</li>
                        </ul>
                        <p className="mt-2 font-medium">This action cannot be undone.</p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-2 py-2">
                      <Label htmlFor="masterKeyDelete">Enter your Master Key to confirm</Label>
                      <Input
                        id="masterKeyDelete"
                        type="password"
                        placeholder="Master Key"
                        value={masterKeyForDelete}
                        onChange={(e) => setMasterKeyForDelete(e.target.value)}
                      />
                      {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={(e) => {
                          e.preventDefault();
                          handleDeleteProject();
                        }}
                        disabled={isDeleting || !masterKeyForDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isDeleting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                        Delete Permanently
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

            {/* Owner note */}
            {isOwner && (
              <p className="text-xs text-muted-foreground">
                As the owner, you cannot leave this project. Transfer ownership or delete it
                instead.
              </p>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
