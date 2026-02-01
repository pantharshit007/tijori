import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Crown, Search, ShieldCheck, User, UserPlus, Users } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { AddMemberDialog } from "@/components/add-member-dialog";
import { MemberActions } from "@/components/member-actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { Skeleton } from "@/components/ui/skeleton";

interface MembersDrawerProps {
  projectId: Id<"projects">;
  userRole: "owner" | "admin" | "member";
  trigger: React.ReactNode;
}

function getDisplayName(member: { name?: string | null; email?: string | null }): string {
  const displayName = member.name || member.email || "Unknown";
  return displayName.length > 15 ? displayName.slice(0, 15) + "..." : displayName;
}
export function MembersDrawer({ projectId, userRole, trigger }: MembersDrawerProps) {
  const members = useQuery(api.projects.listMembers, { projectId });
  const addMember = useMutation(api.projects.addMember);
  const removeMember = useMutation(api.projects.removeMember);
  const updateMemberRole = useMutation(api.projects.updateMemberRole);

  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Add member dialog
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<"admin" | "member">("member");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const canManageMembers = userRole === "owner" || userRole === "admin";
  const canUpdateRoles = userRole === "owner";

  const filteredMembers = members?.filter((m) => {
    if (!m) return false;
    return (
      m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  async function handleAddMember() {
    if (!newMemberEmail.trim()) return;

    setIsAdding(true);
    setAddError(null);

    try {
      await addMember({
        projectId,
        email: newMemberEmail.trim(),
        role: newMemberRole,
      });
      setNewMemberEmail("");
      setShowAddDialog(false);
    } catch (err: any) {
      setAddError(err.data || "Failed to add member");
    } finally {
      setIsAdding(false);
    }
  }

  async function handleRemoveMember(memberId: Id<"projectMembers">) {
    if (!confirm("Remove this member from the project?")) return;
    try {
      await removeMember({ projectId, memberId });
    } catch (err: any) {
      const message = err?.data || "Failed to remove member";
      alert(message);
      console.error("Failed to remove member:", err);
    }
  }

  async function handleUpdateRole(memberId: Id<"projectMembers">, newRole: "admin" | "member") {
    try {
      await updateMemberRole({ projectId, memberId, role: newRole });
    } catch (err: any) {
      const message = err?.data || "Failed to update role";
      alert(message);
      console.error("Failed to update role:", err);
    }
  }

  function getRoleIcon(role: string) {
    switch (role) {
      case "owner":
        return <Crown className="h-3 w-3" />;
      case "admin":
        return <ShieldCheck className="h-3 w-3" />;
      default:
        return <User className="h-3 w-3" />;
    }
  }

  function getRoleBadgeVariant(role: "owner" | "admin" | "member") {
    switch (role) {
      case "owner":
        return "default";
      case "admin":
        return "secondary";
      default:
        return "outline";
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent className="w-100 sm:w-135 sm:px-2.5">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Project Members
            </SheetTitle>
            <SheetDescription>
              {members?.length || 0} member{members?.length !== 1 ? "s" : ""} in this project
            </SheetDescription>
          </SheetHeader>

          <div className=" space-y-4">
            {/* Search and Add */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search members..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              {canManageMembers && (
                <Button size="sm" onClick={() => setShowAddDialog(true)} className="gap-1">
                  <UserPlus className="h-4 w-4" />
                  Add
                </Button>
              )}
            </div>

            {/* Members List */}
            <div className="space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto pr-2 pb-6">
              {members === undefined ? (
                // Loading
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-xl border">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                ))
              ) : filteredMembers && filteredMembers.length > 0 ? (
                filteredMembers.map((member) => {
                  if (!member) return null;

                  return (
                    <div
                      key={member._id}
                      className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-accent/30 transition-colors"
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Avatar
                            className={`h-10 w-10 ${
                              member.isDeactivated ? "grayscale opacity-50" : ""
                            }`}
                          >
                            <AvatarImage src={member.image} alt={member.name || ""} />
                            <AvatarFallback>
                              {member.name?.charAt(0).toUpperCase() ||
                                member.email?.charAt(0).toUpperCase() ||
                                "?"}
                            </AvatarFallback>
                          </Avatar>
                        </TooltipTrigger>
                        {member.isDeactivated && (
                          <TooltipContent>
                            <p>User is deactivated</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{getDisplayName(member)}</p>

                          <Badge
                            variant={getRoleBadgeVariant(member.role)}
                            className="gap-1 text-xs"
                          >
                            {getRoleIcon(member.role)}
                            {member.role}
                          </Badge>
                        </div>
                        <p className="text-xs pt-0.5 text-muted-foreground truncate">
                          {member.email}
                        </p>
                      </div>

                      {/* Actions - Only show if:
                        - Member is not owner (can never act on owners)
                        - Current user can manage members
                        - If member is admin, only owner can act on them */}
                      {member.role !== "owner" &&
                        canManageMembers &&
                        (member.role !== "admin" || userRole === "owner") && (
                          <MemberActions
                            canUpdateRoles={canUpdateRoles}
                            memberRole={member.role}
                            onUpdateRole={(role) => handleUpdateRole(member._id, role)}
                            onRemove={() => handleRemoveMember(member._id)}
                          />
                        )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>{searchQuery ? "No members match your search" : "No members found"}</p>
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Add Member Dialog */}
      <AddMemberDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        email={newMemberEmail}
        onEmailChange={setNewMemberEmail}
        role={newMemberRole}
        onRoleChange={setNewMemberRole}
        error={addError}
        isAdding={isAdding}
        onAdd={handleAddMember}
      />
    </>
  );
}
