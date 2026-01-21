import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { 
  Edit, 
  FolderKey,
  Loader2, 
  LogOut, 
  Save,
  Trash2,
  Users 
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useNavigate } from "@tanstack/react-router";

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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { hash as cryptoHash } from "@/lib/crypto";

interface ProjectSettingsProps {
  project: {
    _id: Id<"projects">;
    name: string;
    description?: string;
    passcodeHint?: string;
    role: "owner" | "admin" | "member";
  };
  environmentsCount: number;
  membersCount: number;
  trigger: React.ReactNode;
}

export function ProjectSettings({ 
  project, 
  environmentsCount, 
  membersCount,
  trigger 
}: ProjectSettingsProps) {
  const navigate = useNavigate();
  const user = useQuery(api.users.me);
  const leaveProject = useMutation(api.projects.leaveProject);
  const updateProject = useMutation(api.projects.updateProject);
  const deleteProject = useMutation(api.projects.deleteProject);

  const [open, setOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [masterKeyForDelete, setMasterKeyForDelete] = useState("");

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const [editDescription, setEditDescription] = useState(project.description || "");
  const [editPasscodeHint, setEditPasscodeHint] = useState(project.passcodeHint || "");
  const [isSaving, setIsSaving] = useState(false);

  const isOwner = project.role === "owner";

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

  async function handleSaveEdit() {
    if (!editName.trim()) return;
    
    setIsSaving(true);
    try {
      await updateProject({
        projectId: project._id,
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        passcodeHint: editPasscodeHint.trim() || undefined,
      });
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to update project:", err);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!user?.masterKeySalt || !user?.masterKeyHash) {
      setDeleteError("Master key not configured");
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      // Verify master key
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
      // Reset state when closing
      setIsEditing(false);
      setEditName(project.name);
      setEditDescription(project.description || "");
      setEditPasscodeHint(project.passcodeHint || "");
      setMasterKeyForDelete("");
      setDeleteError(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Project Settings</DialogTitle>
          <DialogDescription>
            Manage project details and membership.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Project Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3 text-center">
              <FolderKey className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-2xl font-bold">{environmentsCount}</p>
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
              {isEditing ? (
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
                      onClick={handleSaveEdit}
                      disabled={isSaving || !editName.trim()}
                    >
                      {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                      <Save className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => {
                        setIsEditing(false);
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
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{project.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {project.description || "No description"}
                      </p>
                      {project.passcodeHint && (
                        <p className="text-xs text-muted-foreground mt-1">
                          <span className="font-medium">Passcode hint:</span> {project.passcodeHint}
                        </p>
                      )}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              <Separator />
            </>
          )}

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
              <h4 className="font-medium text-sm text-destructive">Danger Zone</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Delete this project and all its data permanently.
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="mt-3 gap-2"
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
                        <li>{environmentsCount} environment(s) and all variables</li>
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
                    {deleteError && (
                      <p className="text-sm text-destructive">{deleteError}</p>
                    )}
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => {
                        e.preventDefault();
                        handleDelete();
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
        </div>

        <DialogFooter>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
