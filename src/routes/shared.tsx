import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
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
  Unlock
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

import type {ShareExpiryValue} from "@/lib/constants";
import type { SharedSecret } from "@/lib/types";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDateTime, formatRelativeTime } from "@/lib/time";
import { SHARE_EXPIRY_OPTIONS  } from "@/lib/constants";
import { keyStore } from "@/lib/key-store";
import { decrypt } from "@/lib/crypto";

export const Route = createFileRoute("/shared")({
  component: SharedDashboard,
});

function SharedDashboard() {
  const sharedSecrets = useQuery(api.sharedSecrets.listByUser);
  const toggleDisabled = useMutation(api.sharedSecrets.toggleDisabled);
  const removeShare = useMutation(api.sharedSecrets.remove);
  const updateExpiry = useMutation(api.sharedSecrets.updateExpiry);

  const [searchQuery, setSearchQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [revealedPasscodes, setRevealedPasscodes] = useState<Set<string>>(new Set());
  const [decryptedPasscodes, setDecryptedPasscodes] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (sharedSecrets === undefined) {
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
      share.environmentName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesProject = projectFilter === "all" || share.projectName === projectFilter;
    
    return matchesSearch && matchesProject;
  });

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
        alert("Failed to decrypt passcode. Is the project key correct?");
      }
    }
  }

  async function handleCopyLink(id: string) {
    const url = `${window.location.origin}/share/${id}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
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

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Environment / Project</TableHead>
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
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  No shared secrets found
                </TableCell>
              </TableRow>
            ) : (
              filteredShares.map((share) => (
                <TableRow key={share._id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{share.environmentName}</span>
                      <span className="text-xs text-muted-foreground">{share.projectName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
                        {revealedPasscodes.has(share._id) 
                          ? (decryptedPasscodes[share._id] || "••••••") 
                          : "••••••"}
                      </code>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => togglePasscode(share as any)}
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
                            : revealedPasscodes.has(share._id) ? "Hide passcode" : "Reveal passcode"}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-xs">
                      <span>{share.isIndefinite ? "Never" : formatRelativeTime(share.expiresAt!)}</span>
                      {!share.isIndefinite && share.expiresAt && (
                        <span className="text-[10px] text-muted-foreground">
                          {formatDateTime(share.expiresAt)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-mono">
                      {share.views}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {share.isDisabled ? (
                      <Badge variant="outline" className="text-destructive border-destructive/30">
                        Disabled
                      </Badge>
                    ) : share.isExpired ? (
                      <Badge variant="outline" className="text-amber-500 border-amber-500/30">
                        Expired
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-green-500 border-green-500/30">
                        Active
                      </Badge>
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
                          <Copy className="h-4 w-4 mr-2" />
                          {copiedId === share._id ? "Copied!" : "Copy link"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => window.open(`/share/${share._id}`, "_blank")}>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View public page
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {!keyStore.getKey(share.projectId) ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div>
                                <DropdownMenuItem disabled>
                                  <Lock className="h-4 w-4 mr-2" />
                                  Management Locked
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
                                  <Unlock className="h-4 w-4 mr-2" />
                                  Enable link
                                </>
                              ) : (
                                <>
                                  <Lock className="h-4 w-4 mr-2" />
                                  Disable link
                                </>
                              )}
                            </DropdownMenuItem>
                            
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-[10px] font-normal text-muted-foreground">
                              Extend Expiry
                            </DropdownMenuLabel>
                            {SHARE_EXPIRY_OPTIONS.filter(o => o.value !== "never" || !share.isIndefinite).map(opt => (
                              <DropdownMenuItem 
                                key={opt.value} 
                                onClick={() => handleExtendExpiry(share._id, opt.value)}
                              >
                                <Clock className="h-3 w-3 mr-2" />
                                {opt.label}
                              </DropdownMenuItem>
                            ))}

                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                              onClick={() => {
                                if (confirm("Are you sure you want to delete this shared link? This action cannot be undone.")) {
                                  removeShare({ id: share._id });
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
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
      </div>
    </TooltipProvider>
  );
}
