import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
  ChevronLeft,
  ChevronRight,
  Database,
  FolderKey,
  LayoutDashboard,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { getErrorMessage } from "@/lib/errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/time";
import { UserAvatar } from "@/components/user-avatar";
import { toastStyle } from "@/utilities/toast-style";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/d/admin")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const [numItems] = useState(10);
  const [cursor, setCursor] = useState<string | null>(null);
  const [history, setHistory] = useState<(string | null)[]>([]);
  const [showMetrics, setShowMetrics] = useState(true);
  const [showExtraMetrics, setShowExtraMetrics] = useState(false);

  const metrics = useQuery(api.admin.getPlatformMetrics, { includeExtra: showExtraMetrics });
  const usersPaginated = useQuery(api.admin.listUsers, {
    paginationOpts: { numItems, cursor },
  });

  const updateUserRole = useMutation(api.admin.updateUserRole);
  const toggleUserStatus = useMutation(api.admin.toggleUserStatus);
  const triggerDeletion = useMutation(api.admin.triggerUserDeletion);
  const [deletionEmail, setDeletionEmail] = useState("");
  const [isDeletionLoading, setIsDeletionLoading] = useState(false);

  function isUserDeactivated(user: { accountStatus?: string; isDeactivated?: boolean }) {
    return (
      user.accountStatus === "DEACTIVATED" ||
      (Boolean(user.isDeactivated) && user.accountStatus !== "DELETION_QUEUED")
    );
  }

  function isDeletionQueued(user: { accountStatus?: string }) {
    return user.accountStatus === "DELETION_QUEUED";
  }

  const handleNextPage = () => {
    if (usersPaginated?.continueCursor) {
      setHistory([...history, cursor]);
      setCursor(usersPaginated.continueCursor);
    }
  };

  const handlePrevPage = () => {
    const prevCursor = history[history.length - 1];
    setHistory(history.slice(0, -1));
    setCursor(prevCursor ?? null);
  };

  const handleUpdateTier = async (userId: any, tier: any) => {
    try {
      await updateUserRole({ userId, tier });
      setCursor(null);
      setHistory([]);
      toast.success(`User tier updated to ${tier}`, toastStyle.success);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to update tier"), toastStyle.error);
    }
  };

  const handleToggleStatus = async (userId: any, isDeactivated: boolean) => {
    try {
      await toggleUserStatus({ userId, isDeactivated });
      toast.success(`User ${isDeactivated ? "deactivated" : "reactivated"}`, toastStyle.success);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to toggle status"), toastStyle.error);
    }
  };

  const handleTriggerDeletion = async (email?: string) => {
    const targetEmail = email || deletionEmail.trim();
    if (!targetEmail) {
      toast.error("Please enter an email address", toastStyle.error);
      return;
    }
    setIsDeletionLoading(true);
    try {
      await triggerDeletion({ email: targetEmail });
      toast.success(`Deletion sweep triggered for ${targetEmail}`, toastStyle.success);
      setDeletionEmail("");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to trigger deletion"), toastStyle.error);
    } finally {
      setIsDeletionLoading(false);
    }
  };

  if (metrics === undefined || usersPaginated === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between font-mono">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Control Panel</h1>
          <p className="text-muted-foreground">Platform-wide metrics and user management.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowMetrics(!showMetrics)}
          className="gap-2"
        >
          {showMetrics ? "Hide Metrics" : "Show Metrics"}
          <LayoutDashboard className="h-4 w-4" />
        </Button>
      </div>

      {showMetrics && (
        <div className="space-y-8">
          {/* Metrics Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm  uppercase font-bold tracking-tighter opacity-70">
                  Total Users
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.counts.users}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm  uppercase font-bold tracking-tighter opacity-70">
                  Projects
                </CardTitle>
                <FolderKey className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.counts.projects}</div>
              </CardContent>
            </Card>

            {showExtraMetrics ? (
              <>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm  uppercase font-bold tracking-tighter opacity-70">
                      Environments
                    </CardTitle>
                    <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics.counts.environments}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm  uppercase font-bold tracking-tighter opacity-70">
                      Secrets
                    </CardTitle>
                    <Database className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics.counts.variables}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm  uppercase font-bold tracking-tighter opacity-70">
                      Shares
                    </CardTitle>
                    <Share2 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics.counts.sharedSecrets}</div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="col-span-3 border-dashed flex items-center justify-center p-6 bg-muted/20">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowExtraMetrics(true)}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Show Extra Metrics (Environments, Secrets, Shares)
                </Button>
              </Card>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Role Distribution</CardTitle>
                <CardDescription>Breakdown of users by their platform tier.</CardDescription>
              </CardHeader>
              <CardContent>
              <div className="space-y-4">
                  {Object.entries(metrics.tierDistribution).map(([tier, count]) => (
                    <div key={tier} className="flex items-center justify-between">
                      <span className="capitalize text-sm font-medium">{tier}</span>
                      <div className="flex items-center gap-4">
                        <div className="h-2 w-32 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${((count) / metrics.counts.users) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* User Management Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle>User Management</CardTitle>
            <CardDescription>A list of all users registered on the platform.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search coming soon..."
                className="pl-8 w-[250px]"
                disabled
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role Tier</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersPaginated.page.map((user) => (
                <TableRow key={user._id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <UserAvatar src={user.image} name={user.name} />
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{user.name}</span>
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        user.tier === "super_admin"
                          ? "default"
                          : user.tier === "pro" || user.tier === "pro_plus"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {user.tier || "free"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(user._creationTime)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {user.masterKeyHash ? (
                        <Badge variant="active" className="gap-1">
                          <ShieldCheck className="size-3" />
                          Vault
                        </Badge>
                      ) : (
                        <Badge variant="disabled" className="gap-1">
                          <ShieldAlert className="size-3" />
                          No Vault
                        </Badge>
                      )}
                      {isUserDeactivated(user) && (
                        <Badge variant="destructive" className="gap-1">
                          Deactivated
                        </Badge>
                      )}
                      {isDeletionQueued(user) && (
                        <Badge variant="secondary" className="gap-1">
                          Deletion Queued
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => handleUpdateTier(user._id, "free")}>
                          Make Free
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleUpdateTier(user._id, "pro")}>
                          Make Pro
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleUpdateTier(user._id, "pro_plus")}>
                          Make Pro+
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => handleUpdateTier(user._id, "super_admin")}
                        >
                          Make Super Admin
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={isDeletionQueued(user)}
                          className={isUserDeactivated(user) ? "text-green-600" : "text-destructive"}
                          onSelect={() => handleToggleStatus(user._id, !isUserDeactivated(user))}
                        >
                          {isDeletionQueued(user)
                            ? "Deletion in Progress"
                            : isUserDeactivated(user)
                              ? "Reactivate User"
                              : "Deactivate User"}
                        </DropdownMenuItem>
                        {isDeletionQueued(user) && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-amber-600 gap-2"
                              onSelect={() => handleTriggerDeletion(user.email)}
                            >
                              <Trash2 className="h-3 w-3" />
                              Expedite Deletion
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination Footer */}
          <div className="flex items-center justify-end space-x-2 py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevPage}
              disabled={history.length === 0}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={usersPaginated.isDone}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
      {/* Trigger Deletion Sweep */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Trigger Deletion Sweep
          </CardTitle>
          <CardDescription>
            Manually trigger or re-trigger a user data deletion sweep by email.
            This resets a failed or stalled job and runs it immediately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Input
              type="email"
              placeholder="user@example.com"
              value={deletionEmail}
              onChange={(e) => setDeletionEmail(e.target.value)}
              className="max-w-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleTriggerDeletion();
              }}
            />
            <Button
              variant="destructive"
              size="sm"
              className="gap-2"
              disabled={isDeletionLoading || !deletionEmail.trim()}
              onClick={() => handleTriggerDeletion()}
            >
              {isDeletionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Trigger Sweep
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
