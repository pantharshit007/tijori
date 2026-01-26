import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { ROLE_LIMITS, type PlatformRole } from "../../../convex/lib/roleLimits";
import {
  ArrowUpDown,
  Check,
  ClipboardCopy,
  Clock,
  FileEdit,
  FileText,
  KeyRound,
  MoreVertical,
  Plus,
  Search,
  Share2,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { ShareDialog } from "../share-dialog";
import { VariableRow } from "./VariableRow";
import { VariableEditRow } from "./VariableEditRow";
import { BulkAddDialog } from "./BulkAddDialog";
import { BulkEditDialog } from "./BulkEditDialog";
import { useVariableActions } from "./useVariableActions";
import type { Id } from "../../../convex/_generated/dataModel";

import type { EnvironmentVariablesProps, ParsedVariable } from "@/lib/types";
import { variablesToExport } from "@/lib/utils";
import { decrypt, encrypt } from "@/lib/crypto";
import { formatRelativeTime } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

/**
 * Main EnvironmentVariables component.
 * Orchestrates subcomponents and hooks for viewing/editing environment variables.
 */
export function EnvironmentVariables({
  environment,
  derivedKey,
  userRole,
  platformRole,
}: EnvironmentVariablesProps) {
  const variables = useQuery(api.variables.list, { environmentId: environment._id });
  const saveVariable = useMutation(api.variables.save);
  const removeVariable = useMutation(api.variables.remove);
  const createShare = useMutation(api.sharedSecrets.create);

  // Use custom hook for reveal/copy logic
  const {
    revealedVars,
    decryptedValues,
    decryptErrors,
    copied,
    setCopied,
    setDecryptedValues,
    reset: resetVariableActions,
    handleReveal,
    handleCopy,
  } = useVariableActions({ derivedKey });

  // New variable form
  const [showNewVar, setShowNewVar] = useState(false);
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Edit single variable
  const [editingVarId, setEditingVarId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editOriginalName, setEditOriginalName] = useState("");
  const [isEditSaving, setIsEditSaving] = useState(false);

  // Bulk add
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);

  // Bulk edit
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [isBulkEditSaving, setIsBulkEditSaving] = useState(false);

  // Search and sort
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"updated" | "name-asc" | "name-desc">("updated");

  const canEdit = userRole === "owner" || userRole === "admin";

  // Filter and sort variables
  const filteredVariables = variables
    ?.filter((v) => v.name.toLowerCase().includes(searchQuery.toLowerCase()))
    ?.sort((a, b) => {
      if (sortBy === "name-asc") {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === "name-desc") {
        return b.name.localeCompare(a.name);
      }
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });

  // Reset state when locked
  useEffect(() => {
    if (!derivedKey) {
      resetVariableActions();
      setNewName("");
      setNewValue("");
      setShowNewVar(false);
      setEditingVarId(null);
    }
  }, [derivedKey, resetVariableActions]);

  // ==================== Handlers ====================

  async function handleCopyAll() {
    if (!derivedKey || !variables) return;

    try {
      const decrypted = await Promise.all(
        variables.map(async (v) => {
          const value =
            decryptedValues[v._id] ||
            (await decrypt(v.encryptedValue, v.iv, v.authTag, derivedKey));
          return { name: v.name, value };
        })
      );
      const exportText = variablesToExport(decrypted);
      await navigator.clipboard.writeText(exportText);
      setCopied("all");
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error("Failed to copy all:", err);
    }
  }

  async function handleAddVariable() {
    if (!derivedKey || !newName.trim() || !newValue.trim()) return;

    setIsSaving(true);
    try {
      const { encryptedValue, iv, authTag } = await encrypt(newValue, derivedKey);
      await saveVariable({
        environmentId: environment._id,
        name: newName.trim(),
        encryptedValue,
        iv,
        authTag,
      });
      setNewName("");
      setNewValue("");
      setShowNewVar(false);
      toast.success("Variable saved successfully");
    } catch (err: any) {
      console.error("Failed to save:", err);
      toast.error(err.data || "Failed to save variable");
    } finally {
      setIsSaving(false);
    }
  }

  async function startEdit(
    varId: string,
    varName: string,
    encryptedValue: string,
    iv: string,
    authTag: string
  ) {
    if (!derivedKey) return;

    setShowNewVar(false);
    try {
      let value = decryptedValues[varId];
      if (value === undefined) {
        value = await decrypt(encryptedValue, iv, authTag, derivedKey);
        setDecryptedValues((prev) => ({ ...prev, [varId]: value }));
      }
      setEditName(varName);
      setEditValue(value);
      setEditOriginalName(varName);
      setEditingVarId(varId);
    } catch (err) {
      console.error("Failed to decrypt for edit:", err);
    }
  }

  async function handleSaveEdit() {
    if (!derivedKey || !editName.trim() || !editValue.trim()) return;

    setIsEditSaving(true);
    try {
      // Save the new/updated variable first
      const { encryptedValue, iv, authTag } = await encrypt(editValue, derivedKey);
      await saveVariable({
        environmentId: environment._id,
        name: editName.trim(),
        encryptedValue,
        iv,
        authTag,
      });

      if (editOriginalName !== editName.trim()) {
        const oldVar = variables?.find((v) => v.name === editOriginalName);
        if (oldVar) {
          await removeVariable({ id: oldVar._id as Id<"variables"> });
        }
      }

      if (editingVarId) {
        setDecryptedValues((prev) => ({ ...prev, [editingVarId]: editValue }));
      }
      setEditingVarId(null);
      setEditName("");
      setEditValue("");
      setEditOriginalName("");
      toast.success("Variable updated successfully");
    } catch (err: any) {
      console.error("Failed to update:", err);
      toast.error(err.data || "Failed to update variable");
    } finally {
      setIsEditSaving(false);
    }
  }

  function cancelEdit() {
    setEditingVarId(null);
    setEditName("");
    setEditValue("");
    setEditOriginalName("");
  }

  async function handleDelete(varId: Id<"variables">) {
    if (!confirm("Delete this variable?")) return;
    try {
      await removeVariable({ id: varId });
      toast.success("Variable deleted");
    } catch (err: any) {
      console.error("Failed to delete variable:", err?.message);
      toast.error("Failed to delete variable");
    }
  }

  async function handleBulkAdd(vars: ParsedVariable[]) {
    if (!derivedKey || vars.length === 0) return;

    setIsBulkSaving(true);
    setBulkProgress(0);

    try {
      for (let i = 0; i < vars.length; i++) {
        const v = vars[i];
        const { encryptedValue, iv, authTag } = await encrypt(v.value, derivedKey);
        await saveVariable({
          environmentId: environment._id,
          name: v.name,
          encryptedValue,
          iv,
          authTag,
        });
        setBulkProgress(((i + 1) / vars.length) * 100);
      }
      setShowBulkAdd(false);
    } catch (err) {
      console.error("Failed to bulk add:", err);
    } finally {
      setIsBulkSaving(false);
      setBulkProgress(0);
    }
  }

  async function handleBulkEditSave(
    updates: { name: string; value: string; originalName?: string }[],
    deletes: string[]
  ) {
    if (!derivedKey) return;

    setIsBulkEditSaving(true);
    try {
      // Track which original names need deletion after saving new values
      const renamesToDelete: string[] = [];

      // First, save all updates (this preserves data if any save fails)
      for (const u of updates) {
        const { encryptedValue, iv, authTag } = await encrypt(u.value, derivedKey);
        await saveVariable({
          environmentId: environment._id,
          name: u.name,
          encryptedValue,
          iv,
          authTag,
        });

        // If name changed, mark old name for deletion
        if (u.originalName && u.originalName !== u.name) {
          renamesToDelete.push(u.originalName);
        }
      }

      // Now delete explicitly removed variables
      for (const name of deletes) {
        const v = variables?.find((v) => v.name === name);
        if (v) await removeVariable({ id: v._id as Id<"variables"> });
      }

      for (const oldName of renamesToDelete) {
        const oldVar = variables?.find((v) => v.name === oldName);
        if (oldVar) await removeVariable({ id: oldVar._id as Id<"variables"> });
      }
    } catch (err) {
      console.error("Failed to bulk edit:", err);
    } finally {
      setIsBulkEditSaving(false);
    }
  }

  if (variables === undefined) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Sort Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-50 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={sortBy}
          onValueChange={(v) => setSortBy(v as "updated" | "name-asc" | "name-desc")}
        >
          <SelectTrigger className="w-47.5">
            <ArrowUpDown className="h-3 w-3 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">Last Updated</SelectItem>
            <SelectItem value="name-asc">Name (A-Z)</SelectItem>
            <SelectItem value="name-desc">Name (Z-A)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">
            {filteredVariables?.length ?? 0} /{" "}
            {ROLE_LIMITS[(platformRole as PlatformRole) || "user"]?.maxVariablesPerEnvironment ||
              "∞"}{" "}
            variables
            {searchQuery && ` (filtered from ${variables.length})`}
          </p>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              {environment.updatedAt === environment._creationTime
                ? `Created ${formatRelativeTime(environment._creationTime)}`
                : `Updated ${formatRelativeTime(environment.updatedAt)}`}
            </span>
          </div>
        </div>
        {derivedKey && (
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button
                size="sm"
                onClick={() => {
                  cancelEdit();
                  setShowNewVar(true);
                }}
                disabled={showNewVar}
                className="gap-1"
              >
                <Plus className="h-3 w-3" />
                Add
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                {variables.length > 0 && (
                  <DropdownMenuItem onClick={handleCopyAll} className="gap-2">
                    {copied === "all" ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <ClipboardCopy className="h-4 w-4 text-primary" />
                    )}
                    Copy All Variables
                  </DropdownMenuItem>
                )}

                {canEdit && (
                  <>
                    <DropdownMenuItem onClick={() => setShowBulkAdd(true)} className="gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      Bulk Add Variables
                    </DropdownMenuItem>

                    {variables.length > 0 && (
                      <DropdownMenuItem onClick={() => setShowBulkEdit(true)} className="gap-2">
                        <FileEdit className="h-4 w-4 text-primary" />
                        Bulk Edit Variables
                      </DropdownMenuItem>
                    )}

                    <ShareDialog
                      variables={variables}
                      environment={environment}
                      derivedKey={derivedKey}
                      createShare={createShare}
                      trigger={
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="gap-2">
                          <Share2 className="h-4 w-4 text-primary" />
                          Share Secrets
                        </DropdownMenuItem>
                      }
                    />
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Locked state */}
      {!derivedKey && variables.length > 0 && (
        <div className="rounded-lg bg-muted/50 border p-4 text-center">
          <KeyRound className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Unlock the project to view or edit variables
          </p>
        </div>
      )}

      {/* Variables list */}
      <div className="rounded-xl border bg-card/30 divide-y divide-border/50 overflow-hidden">
        {showNewVar && derivedKey && (
          <VariableEditRow
            name={newName}
            value={newValue}
            onNameChange={setNewName}
            onValueChange={setNewValue}
            onSave={handleAddVariable}
            onCancel={() => {
              setShowNewVar(false);
              setNewName("");
              setNewValue("");
            }}
            isSaving={isSaving}
            isNew
          />
        )}
        {(filteredVariables ?? []).map((variable) =>
          editingVarId === variable._id ? (
            <VariableEditRow
              key={variable._id}
              name={editName}
              value={editValue}
              onNameChange={setEditName}
              onValueChange={setEditValue}
              onSave={handleSaveEdit}
              onCancel={cancelEdit}
              isSaving={isEditSaving}
            />
          ) : (
            <VariableRow
              key={variable._id}
              variable={variable}
              environmentName={environment.name}
              derivedKey={derivedKey}
              canEdit={canEdit}
              revealedVars={revealedVars}
              decryptedValues={decryptedValues}
              decryptErrors={decryptErrors}
              copied={copied}
              onReveal={handleReveal}
              onCopy={handleCopy}
              onEdit={(id, enc, iv, auth) => startEdit(id, variable.name, enc, iv, auth)}
              onDelete={handleDelete}
            />
          )
        )}

        {variables.length === 0 && !showNewVar && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No variables in this environment</p>
            {derivedKey && canEdit && (
              <Button variant="link" onClick={() => setShowNewVar(true)} className="mt-2">
                Add your first variable
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Bulk Add Dialog */}
      <BulkAddDialog
        open={showBulkAdd}
        onOpenChange={setShowBulkAdd}
        onAdd={handleBulkAdd}
        isSaving={isBulkSaving}
        progress={bulkProgress}
      />

      {/* Bulk Edit Dialog */}
      {derivedKey && (
        <BulkEditDialog
          open={showBulkEdit}
          onOpenChange={setShowBulkEdit}
          variables={variables}
          derivedKey={derivedKey}
          onSave={handleBulkEditSave}
          isSaving={isBulkEditSaving}
        />
      )}
    </div>
  );
}
