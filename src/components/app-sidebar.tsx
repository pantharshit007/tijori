import { Link, useLocation } from "@tanstack/react-router";
import { useClerk, useUser } from "@clerk/tanstack-react-start";
import { FolderKey, Home, KeyRound, LogOut, Settings, Share2, ShieldCheck, User } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { TIER_LIMITS } from "../../convex/lib/roleLimits";
import type { Tier } from "../../convex/lib/roleLimits";
import { SidebarThemeToggle } from "@/components/sidebar-theme-toggle";
import { keyStore } from "@/lib/key-store";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const mainNavItems = [
  {
    title: "Dashboard",
    url: "/d/dashboard",
    icon: Home,
  },
  {
    title: "Shared",
    url: "/d/shared",
    icon: Share2,
  },
  {
    title: "All Projects",
    url: "/d/projects",
    icon: FolderKey,
  },
];

const settingsNavItems = [
  {
    title: "Profile",
    url: "/d/profile",
    icon: User,
  },
  {
    title: "Settings",
    url: "/d/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const { user: clerkUser, isLoaded } = useUser();
  const { signOut } = useClerk();
  const { state } = useSidebar();
  const location = useLocation();
  const me = useQuery(api.users.getUsageStats);

  const user = clerkUser
    ? {
        name: clerkUser.fullName || clerkUser.username || "User",
        email: clerkUser.primaryEmailAddress?.emailAddress || "",
        image: clerkUser.imageUrl || null,
        tier: (me?.tier as Tier) || "free",
      }
    : null;

  const limits = me ? TIER_LIMITS[user?.tier || "free"] : null;

  const handleLogout = async () => {
    keyStore.clear();
    await signOut();
  };

  return (
    <Sidebar
      variant="inset"
      collapsible="icon"
      className={cn(state === "expanded" ? "pt-0" : "pt-[14px]")}
    >
      <SidebarHeader className="border-b border-sidebar-border ">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/d/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <KeyRound className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Tijori</span>
                  <span className="truncate text-xs text-muted-foreground">Secure Vault</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    tooltip={item.title}
                    isActive={location.pathname === item.url}
                  >
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {user?.tier === "super_admin" && (
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    tooltip="Admin Panel"
                    isActive={location.pathname === "/d/admin"}
                  >
                    <Link to="/d/admin" className="text-amber-500 font-medium">
                      <ShieldCheck className="size-4" />
                      <span>Admin Panel</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {state === "expanded" && me && limits && (
          <SidebarGroup>
            <SidebarGroupLabel>Usage</SidebarGroupLabel>
            <SidebarGroupContent className="px-3 py-2 space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  <span>Projects</span>
                  <span>{me.projectsCount} / {limits.maxProjects}</span>
                </div>
                <Progress value={(me.projectsCount / (limits.maxProjects || 1)) * 100} className="h-1.5" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  <span>Shared Secrets</span>
                  <span>{limits.maxSharedSecretsPerProject === Infinity ? "No Limit" : limits.maxSharedSecretsPerProject}</span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Limit per project
                </div>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    tooltip={item.title}
                    isActive={location.pathname === item.url}
                  >
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="px-2 py-2">
          <SidebarThemeToggle />
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  {!isLoaded || !user ? (
                    <>
                      <Skeleton className="h-8 w-8 rounded-lg" />
                      <div className="grid flex-1 gap-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </>
                  ) : (
                    <>
                      <Avatar className="h-8 w-8 rounded-lg">
                        <AvatarImage src={user.image ?? undefined} alt={user.name} />
                        <AvatarFallback className="rounded-lg">
                          <User className="size-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-semibold">{user.name}</span>
                          <Badge variant="outline" className="h-4 px-1 text-[9px] uppercase font-bold">
                            {user.tier}
                          </Badge>
                        </div>
                        <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                      </div>
                    </>
                  )}
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuItem asChild>
                  <Link to="/d/profile">
                    <User className="mr-2 size-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/d/settings">
                    <Settings className="mr-2 size-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleLogout}>
                  <LogOut className="mr-2 size-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
