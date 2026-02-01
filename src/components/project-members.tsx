import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Loader2, MoreHorizontal, Shield, ShieldCheck, Trash2, User, UserPlus } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface ProjectMembersProps {
  projectId: Id<"projects">;
  userRole: "owner" | "admin" | "member";
}

const roleIcons = {
  owner: ShieldCheck,
  admin: Shield,
  member: User,
};

const roleLabels = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

export function ProjectMembers({ projectId, userRole }: ProjectMembersProps) {
  const members = useQuery(api.projects.listMembers, { projectId });
  const addMember = useMutation(api.projects.addMember);
  const removeMember = useMutation(api.projects.removeMember);
  const updateMemberRole = useMutation(api.projects.updateMemberRole);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const canManageMembers = userRole === "owner" || userRole === "admin";
  const canUpdateRoles = userRole === "owner";

  async function handleAddMember() {
    if (!email.trim()) return;

    setIsAdding(true);
    setAddError(null);

    try {
      await addMember({ projectId, email: email.trim(), role });
      setEmail("");
      setRole("member");
      setShowAddDialog(false);
    } catch (err: any) {
      setAddError(err.data || "Failed to add member");
    } finally {
      setIsAdding(false);
    }
  }

  async function handleRemoveMember(memberId: Id<"projectMembers">) {
    try {
      await removeMember({ projectId, memberId });
    } catch (err: any) {
      console.error("Failed to remove member:", err);
    }
  }

  async function handleUpdateRole(memberId: Id<"projectMembers">, newRole: "admin" | "member") {
    try {
      await updateMemberRole({ projectId, memberId, role: newRole });
    } catch (err: any) {
      console.error("Failed to update role:", err);
    }
  }

  if (members === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>Manage who has access to this project</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>Manage who has access to this project</CardDescription>
        </div>
        {canManageMembers && (
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <UserPlus className="h-4 w-4" />
                Add Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Team Member</DialogTitle>
                <DialogDescription>
                  Invite a user to collaborate on this project by their email address.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="colleague@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddMember()}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as "admin" | "member")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Admin - Can add/remove members
                        </div>
                      </SelectItem>
                      <SelectItem value="member">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Member - View and edit variables
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {addError && <p className="text-sm text-destructive">{addError}</p>}
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddMember} disabled={isAdding || !email.trim()}>
                  {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Member
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {members.map((member) => {
            if (!member) return null;
            const RoleIcon = roleIcons[member.role];
            const canRemove =
              member.role !== "owner" &&
              (userRole === "owner" || (userRole === "admin" && member.role === "member"));

            return (
              <div
                key={member._id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.image} alt={member.name} />
                    <AvatarFallback>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <RoleIcon className="h-3 w-3" />
                    {roleLabels[member.role]}
                  </Badge>
                  {(canRemove || (canUpdateRoles && member.role !== "owner")) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canUpdateRoles && member.role !== "owner" && (
                          <>
                            <DropdownMenuItem
                              onClick={() =>
                                handleUpdateRole(
                                  member._id,
                                  member.role === "admin" ? "member" : "admin"
                                )
                              }
                            >
                              <Shield className="mr-2 h-4 w-4" />
                              {member.role === "admin" ? "Demote to Member" : "Promote to Admin"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        {canRemove && (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleRemoveMember(member._id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove from Project
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
