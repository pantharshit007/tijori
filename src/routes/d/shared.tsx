import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useMutation, usePaginatedQuery } from "convex/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Clock,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Filter,
  Lock,
  MoreHorizontal,
  Search,
  Trash2,
  Unlock,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

import type { ShareExpiryValue } from "@/lib/constants";
import type { SharedSecret } from "@/lib/types";
import { PAGINATION_LIMIT, SHARE_EXPIRY_OPTIONS  } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDateTime, formatRelativeTime } from "@/lib/time";
import { Checkbox } from "@/components/ui/checkbox";
import { keyStore } from "@/lib/key-store";
import { decrypt } from "@/lib/crypto";
import { UserAvatar } from "@/components/user-avatar";
import { getErrorMessage } from "@/lib/errors";

type SharedSearchParams = {
  p?: string;
};

export const Route = createFileRoute("/d/shared")({
  validateSearch: (search: Record<string, unknown>): SharedSearchParams => {
    return {
      p: typeof search.p === "string" ? search.p : undefined,
    };
  },
  component: SharedDashboard,
});

function SharedDashboard() {
  const { p: initialProjectFilter } = useSearch({ from: "/d/shared" });
  const {
    results: sharedSecrets,
    status: paginationStatus,
    loadMore,
  } = usePaginatedQuery(api.sharedSecrets.paginatedListByUser, {}, { initialNumItems: PAGINATION_LIMIT });

  const toggleDisabled = useMutation(api.sharedSecrets.toggleDisabled);
  const removeShare = useMutation(api.sharedSecrets.remove);
  const updateExpiry = useMutation(api.sharedSecrets.updateExpiry);

  const bulkToggleDisabled = useMutation(api.sharedSecrets.bulkToggleDisabled);
  const bulkRemove = useMutation(api.sharedSecrets.bulkRemove);

  const [searchQuery, setSearchQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [revealedPasscodes, setRevealedPasscodes] = useState<Set<string>>(new Set());
  const [decryptedPasscodes, setDecryptedPasscodes] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Initialize project filter from URL param once data is loaded
  useEffect(() => {
    if (initialProjectFilter && sharedSecrets.length > 0) {
      const matchingProject = sharedSecrets.find(
        (s) => s.projectName.toLowerCase() === initialProjectFilter.toLowerCase()
      );
      if (matchingProject) {
        setProjectFilter(matchingProject.projectName);
      }
    }
  }, [initialProjectFilter, sharedSecrets]);

  if (paginationStatus === "LoadingFirstPage") {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-4 w-64 bg-muted rounded" />
        </div>
        <Card>
          <div className="h-[400px] w-full bg-muted/50 rounded" />
        </Card>
      </div>
    );
  }

  const projects = [...new Set(sharedSecrets.map((s) => s.projectName))].sort();

  const filteredShares = sharedSecrets.filter((share) => {
    const matchesSearch =
      share.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      share.environmentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (share.name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

    const matchesProject = projectFilter === "all" || share.projectName === projectFilter;

    // Determine share status
    const isDisabled = share.isDisabled;
    const isExpired = share.isExpired;
    const isActive = !isDisabled && !isExpired;

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && isActive) ||
      (statusFilter === "expired" && isExpired && !isDisabled) ||
      (statusFilter === "disabled" && isDisabled);

    return matchesSearch && matchesProject && matchesStatus;
  });

  const allSelected =
    filteredShares.length > 0 &&
    filteredShares.every((share) => selectedIds.has(share._id));
  const someSelected = selectedIds.size > 0;

  function handleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds(new Set([...selectedIds, ...filteredShares.map((s) => s._id)]));
    } else {
      const next = new Set(selectedIds);
      filteredShares.forEach((s) => next.delete(s._id));
      setSelectedIds(next);
    }
  }

  function handleSelect(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (
      !confirm(
        `Are you sure you want to delete ${selectedIds.size} shared links? This action cannot be undone.`
      )
    )
      return;

    try {
      await bulkRemove({ ids: Array.from(selectedIds) as Id<"sharedSecrets">[] });
      toast.success(`${selectedIds.size} links deleted`);
      setSelectedIds(new Set());
    } catch (err: any) {
      console.error("Bulk delete failed:", err);
      toast.error(getErrorMessage(err, "Failed to delete links"));
    }
  }

  async function handleBulkToggleDisabled(isDisabled: boolean) {
    if (selectedIds.size === 0) return;

    try {
      await bulkToggleDisabled({
        ids: Array.from(selectedIds) as Id<"sharedSecrets">[],
        isDisabled,
      });
      toast.success(`${selectedIds.size} links ${isDisabled ? "disabled" : "enabled"}`);
      setSelectedIds(new Set());
    } catch (err: any) {
      console.error("Bulk toggle failed:", err);
      toast.error(getErrorMessage(err, `Failed to ${isDisabled ? "disable" : "enable"} links`));
    }
  }

  async function togglePasscode(share: SharedSecret) {
    const id = share._id;
    if (revealedPasscodes.has(id)) {
      setRevealedPasscodes((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return;
    }

    // Attempt to reveal
    if (share.encryptedPasscode && share.passcodeIv && share.passcodeAuthTag) {
      const projectKey = keyStore.getKey(share.projectId);
      if (!projectKey) {
        alert(`Please unlock project "${share.projectName}" first to view its shared passcodes.`);
        return;
      }

      try {
        const decrypted = await decrypt(
          share.encryptedPasscode,
          share.passcodeIv,
          share.passcodeAuthTag,
          projectKey
        );
        setDecryptedPasscodes((prev) => ({ ...prev, [id]: decrypted }));
        setRevealedPasscodes((prev) => new Set(prev).add(id));
      } catch (err) {
        console.error("Failed to decrypt passcode:", err);
        alert(getErrorMessage(err, "Failed to decrypt passcode. Is the project key correct?"));
      }
    }
  }

  async function handleCopyLink(id: string) {
    const url = `${window.location.origin}/share/${id}`;
    await navigator.clipboard.writeText(url);
  }

  async function handleExtendExpiry(id: string, value: ShareExpiryValue) {
    let expiresAt: number | undefined;
    const isIndefinite = value === "never";
    if (!isIndefinite) {
      const option = SHARE_EXPIRY_OPTIONS.find((o) => o.value === value);
      if (option?.ms) {
        expiresAt = Date.now() + option.ms;
      }
    }

    await updateExpiry({
      id: id as Id<"sharedSecrets">,
      expiresAt,
      isIndefinite,
    });
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Shared Secrets</h1>
          <p className="text-muted-foreground">
            Manage your shared environment variable links and track their usage.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by project or environment..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {someSelected && (
          <div className="flex items-center gap-3 px-4 py-2 bg-muted/50 border rounded-lg animate-in fade-in slide-in-from-top-2">
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  Bulk Actions
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => handleBulkToggleDisabled(true)}>
                  <Lock className="h-4 w-4 mr-2" />
                  Disable selected
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkToggleDisabled(false)}>
                  <Unlock className="h-4 w-4 mr-2" />
                  Enable selected
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                  onClick={handleBulkDelete}
                >
                  <Trash2 className="h-4 w-4 mr-2 text-destructive" />
                  Delete selected
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              className="text-muted-foreground h-8"
            >
              Deselect All
            </Button>
          </div>
        )}

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Environment / Project</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead>Passcode</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Views</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredShares.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    No shared secrets found
                  </TableCell>
                </TableRow>
              ) : (
                filteredShares.map((share) => (
                  <TableRow key={share._id} data-state={selectedIds.has(share._id) && "selected"}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(share._id)}
                        onCheckedChange={(checked) => handleSelect(share._id, !!checked)}
                        aria-label={`Select ${share.name || "secret"}`}
                      />
                    </TableCell>
                    <TableCell>
                      {share.name ? (
                        <span className="font-medium text-sm">{share.name}</span>
                      ) : (
                        <span className="text-muted-foreground text-xs italic">No label</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{share.environmentName}</span>
                        <span className="text-xs text-muted-foreground">{share.projectName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UserAvatar
                          src={share.creatorImage}
                          name={share.creatorName}
                          size="sm"
                          showTooltip={true}
                          tooltipContent={
                            <p className="text-xs font-medium">{share.creatorName}</p>
                          }
                        />
                        <span className="text-sm text-muted-foreground">
                          {share.creatorName?.split(" ")[0] || "Unknown"}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
                          {revealedPasscodes.has(share._id)
                            ? decryptedPasscodes[share._id] || "••••••"
                            : "••••••"}
                        </code>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => togglePasscode(share as SharedSecret)}
                            >
                              {!keyStore.getKey(share.projectId) ? (
                                <Lock className="h-3 w-3 text-muted-foreground" />
                              ) : revealedPasscodes.has(share._id) ? (
                                <EyeOff className="h-3 w-3" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {!keyStore.getKey(share.projectId)
                              ? `Unlock project "${share.projectName}" to view passcode`
                              : revealedPasscodes.has(share._id)
                                ? "Hide passcode"
                                : "Reveal passcode"}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-xs">
                        <span>
                          {share.isIndefinite ? "Never" : formatRelativeTime(share.expiresAt!)}
                        </span>
                        {!share.isIndefinite && share.expiresAt && (
                          <span className="text-[10px] text-muted-foreground">
                            {formatDateTime(share.expiresAt)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono ">
                        {share.views}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {share.isDisabled ? (
                        <Badge variant="disabled">Disabled</Badge>
                      ) : share.isExpired ? (
                        <Badge variant="expired">Expired</Badge>
                      ) : (
                        <Badge variant="active">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleCopyLink(share._id)}>
                            <Copy className="h-4 w-4 mr-2 text-primary" />
                            Copy link
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => window.open(`/share/${share._id}`, "_blank")}
                          >
                            <ExternalLink className="h-4 w-4 mr-2 text-primary" />
                            View public page
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {!share.canManage ? (
                            <DropdownMenuItem disabled className="text-muted-foreground">
                              <Lock className="h-4 w-4 mr-2 text-primary" />
                              View Only
                            </DropdownMenuItem>
                          ) : !keyStore.getKey(share.projectId) ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  <DropdownMenuItem disabled>
                                    <Lock className="h-4 w-4 mr-2 text-primary" />
                                    Unlock to Manage
                                  </DropdownMenuItem>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                Unlock project "{share.projectName}" to manage this share
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <>
                              <DropdownMenuItem onClick={() => toggleDisabled({ id: share._id })}>
                                {share.isDisabled ? (
                                  <>
                                    <Unlock className="h-4 w-4 mr-2 text-primary" />
                                    Enable link
                                  </>
                                ) : (
                                  <>
                                    <Lock className="h-4 w-4 mr-2 text-primary" />
                                    Disable link
                                  </>
                                )}
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />
                              <DropdownMenuLabel className="text-[10px] font-normal text-muted-foreground">
                                Extend Expiry
                              </DropdownMenuLabel>
                              {SHARE_EXPIRY_OPTIONS.filter(
                                (o) => o.value !== "never" || !share.isIndefinite
                              ).map((opt) => (
                                <DropdownMenuItem
                                  key={opt.value}
                                  onClick={() => handleExtendExpiry(share._id, opt.value)}
                                >
                                  <Clock className="h-3 w-3 mr-2 text-primary" />
                                  {opt.label}
                                </DropdownMenuItem>
                              ))}

                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                onClick={() => {
                                  if (
                                    confirm(
                                      "Are you sure you want to delete this shared link? This action cannot be undone."
                                    )
                                  ) {
                                    removeShare({ id: share._id });
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2 text-destructive" />
                                Delete link
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {paginationStatus === "CanLoadMore" && (
          <div className="flex justify-center mt-4">
            <Button variant="outline" onClick={() => loadMore(10)}>
              Load More
            </Button>
          </div>
        )}

        {paginationStatus === "LoadingMore" && (
          <div className="flex justify-center mt-4">
            <Badge variant="secondary" className="animate-pulse">
              Loading more...
            </Badge>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
