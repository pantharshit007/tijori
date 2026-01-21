import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  onEmailChange: (email: string) => void;
  role: "admin" | "member";
  onRoleChange: (role: "admin" | "member") => void;
  error: string | null;
  isAdding: boolean;
  onAdd: () => void;
}

export function AddMemberDialog({
  open,
  onOpenChange,
  email,
  onEmailChange,
  role,
  onRoleChange,
  error,
  isAdding,
  onAdd,
}: AddMemberDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Member</DialogTitle>
          <DialogDescription>
            Invite a user to this project by their email address.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="memberEmail">Email Address</Label>
            <Input
              id="memberEmail"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="memberRole">Role</Label>
            <Select value={role} onValueChange={(v) => onRoleChange(v as "admin" | "member")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member (view & copy only)</SelectItem>
                <SelectItem value="admin">Admin (full access except role changes)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onAdd} disabled={isAdding || !email.trim()}>
            {isAdding && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Add Member
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
