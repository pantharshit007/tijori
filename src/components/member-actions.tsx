import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical, UserMinus, Shield, Trash2 } from "lucide-react";

interface MemberActionsProps {
  canUpdateRoles: boolean;
  memberRole: "admin" | "member";
  onUpdateRole: (role: "admin" | "member") => void;
  onRemove: () => void;
}

export function MemberActions({
  canUpdateRoles,
  memberRole,
  onUpdateRole,
  onRemove,
}: MemberActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canUpdateRoles && (
          <>
            {memberRole === "admin" ? (
              <DropdownMenuItem onClick={() => onUpdateRole("member")}>
                <UserMinus className="h-4 w-4 mr-2" />
                Demote to Member
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => onUpdateRole("admin")}>
                <Shield className="h-4 w-4 mr-2" />
                Promote to Admin
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={onRemove} className="text-destructive focus:text-destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
