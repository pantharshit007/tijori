import { createFileRoute } from "@tanstack/react-router";
import { useUser } from "@clerk/tanstack-react-start";
import { Calendar, Mail, Shield, User } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { TIER_LIMITS } from "../../../convex/lib/roleLimits";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime } from "@/lib/time";

export const Route = createFileRoute("/d/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, isLoaded } = useUser();
  const me = useQuery(api.users.getUsageStats);

  if (!isLoaded || me === undefined) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <div>Please sign in to view your profile.</div>;
  }

  const limits = me ? TIER_LIMITS[me.tier] : null;

  function displayLimit(val: number | undefined) {
    if (val === undefined) return "∞";
    if (val === Infinity) return "∞";
    return val;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">
          Manage your account information and security settings.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-4 space-y-0">
          <Avatar className="h-20 w-20">
            <AvatarImage src={user.imageUrl} />
            <AvatarFallback>
              <User className="h-10 w-10" />
            </AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-2xl font-bold">{user.fullName || user.username}</CardTitle>
            <CardDescription>{user.primaryEmailAddress?.emailAddress}</CardDescription>
            <div className="flex gap-2 mt-2">
              <Badge variant="default" className="uppercase font-bold">
                {me?.tier || "free"}
              </Badge>
              <Badge variant="outline">
                {user.hasVerifiedEmailAddress ? "Verified" : "Unverified"}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6 border-t">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Primary Email
              </Label>
              <Input
                value={user.primaryEmailAddress?.emailAddress || ""}
                readOnly
                className="bg-muted/50"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              Security Status
            </Label>
            <div className="p-4 rounded-lg border bg-accent/10 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span>Account Protection</span>
                <span className="text-green-500 font-medium">Standard</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>Last Sign In</span>
                <span className="text-muted-foreground">
                  {user.lastSignInAt
                    ? formatDateTime(new Date(user.lastSignInAt).getTime())
                    : "Unknown"}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium">Resources & Usage</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="profile-card">
                <p className="profile-card-name">Projects</p>
                <div className="text-2xl font-bold text-primary">
                  {me?.projectsCount} / {displayLimit(limits?.maxProjects)}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Total projects you own</p>
              </div>
              <div className="profile-card">
                <p className="profile-card-name">Environments</p>
                <div className="text-2xl font-bold text-primary">
                  {displayLimit(limits?.maxEnvironmentsPerProject)}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Allowed per project</p>
              </div>
              <div className="profile-card">
                <p className="profile-card-name">Members</p>
                <div className="text-2xl font-bold text-primary">
                  {displayLimit(limits?.maxMembersPerProject)}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Collaborators per project</p>
              </div>
            </div>

            {/* Additional Limits */}
            <div className="grid gap-4 sm:grid-cols-2 mt-4">
              <div className="flex items-center justify-between p-3 rounded-lg border bg-secondary/20">
                <span className="text-sm">Variables per environment</span>
                <span className="font-semibold">
                  {displayLimit(limits?.maxVariablesPerEnvironment)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border bg-secondary/20">
                <span className="text-sm">Shared secret links</span>
                <span className="font-semibold">
                  {displayLimit(limits?.maxSharedSecretsPerProject)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Joined {user.createdAt ? formatDate(new Date(user.createdAt).getTime()) : "Unknown"}
            </div>
            <div>ID: {user.id}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
