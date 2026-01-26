import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
  ChevronLeft,
  ChevronRight,
  Database,
  FolderKey,
  LayoutDashboard,
  MoreHorizontal,
  Plus,
  Search,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
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
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
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

  const handleUpdateRole = async (userId: any, role: any) => {
    try {
      await updateUserRole({ userId, role });
      setCursor(null);
      setHistory([]);
      toast.success(`User role updated to ${role}`);
    } catch (err: any) {
      toast.error(err.data || "Failed to update role");
    }
  };

  const handleToggleStatus = async (userId: any, isDeactivated: boolean) => {
    try {
      await toggleUserStatus({ userId, isDeactivated });
      toast.success(`User ${isDeactivated ? "deactivated" : "reactivated"}`);
    } catch (err: any) {
      toast.error(err.data || "Failed to toggle status");
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
                <CardTitle className="text-sm font-medium uppercase font-bold tracking-tighter opacity-70">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.counts.users}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium uppercase font-bold tracking-tighter opacity-70">Projects</CardTitle>
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
                    <CardTitle className="text-sm font-medium uppercase font-bold tracking-tighter opacity-70">Environments</CardTitle>
                    <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics.counts.environments}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium uppercase font-bold tracking-tighter opacity-70">Secrets</CardTitle>
                    <Database className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics.counts.variables}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium uppercase font-bold tracking-tighter opacity-70">Shares</CardTitle>
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
                  {Object.entries(metrics.roleDistribution).map(([role, count]) => (
                    <div key={role} className="flex items-center justify-between">
                      <span className="capitalize text-sm font-medium">{role}</span>
                      <div className="flex items-center gap-4">
                        <div className="h-2 w-32 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${(count / metrics.counts.users) * 100}%` }}
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
          <div>
            <CardTitle>User Management</CardTitle>
            <CardDescription>A list of all users registered on the platform.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input type="search" placeholder="Search users..." className="pl-8 w-[250px]" />
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
                        user.platformRole === "super_admin"
                          ? "default"
                          : user.platformRole === "pro" || user.platformRole === "pro_plus"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {user.platformRole || "user"}
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
                      {user.isDeactivated && (
                        <Badge variant="destructive" className="gap-1">
                          Deactivated
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
                        <DropdownMenuItem onSelect={() => handleUpdateRole(user._id, "user")}>
                          Make User
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleUpdateRole(user._id, "pro")}>
                          Make Pro
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleUpdateRole(user._id, "pro_plus")}>
                          Make Pro+
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleUpdateRole(user._id, "super_admin")}>
                          Make Super Admin
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className={user.isDeactivated ? "text-green-600" : "text-destructive"}
                          onSelect={() => handleToggleStatus(user._id, !user.isDeactivated)}
                        >
                          {user.isDeactivated ? "Reactivate User" : "Deactivate User"}
                        </DropdownMenuItem>
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
    </div>
  );
}
