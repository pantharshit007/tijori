import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { 
  Check, 
  Clock, 
  Copy, 
  Eye, 
  EyeOff, 
  FileText,
  KeyRound, 
  Loader2, 
  Pencil,
  Plus, 
  Save,
  Trash2,
  X
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import { ShareDialog } from "./share-dialog";
import type { Id } from "../../convex/_generated/dataModel";

import type {Environment} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { decrypt, encrypt } from "@/lib/crypto";
import { formatRelativeTime } from "@/lib/time";

export interface EnvironmentVariablesProps {
  environment: Environment;
  derivedKey: CryptoKey | null;
  userRole: "owner" | "admin" | "member";
}

interface ParsedVariable {
  name: string;
  value: string;
  error?: string;
}

/**
 * Parse bulk input text into variable name-value pairs.
 * Supports formats:
 * - KEY=VALUE
 * - KEY="VALUE"
 * - KEY='VALUE'
 * - export KEY=VALUE
 */
function parseBulkInput(input: string): ParsedVariable[] {
  const lines = input.split("\n").filter(line => line.trim());
  const results: ParsedVariable[] = [];

  for (const line of lines) {
    let trimmed = line.trim();
    
    // Skip comments
    if (trimmed.startsWith("#")) continue;
    
    // Remove 'export ' prefix if present
    if (trimmed.toLowerCase().startsWith("export ")) {
      trimmed = trimmed.slice(7).trim();
    }
    
    // Find the first '=' sign
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) {
      results.push({ name: trimmed, value: "", error: "Missing '=' separator" });
      continue;
    }
    
    const name = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    
    // Remove surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    
    if (!name) {
      results.push({ name: "", value, error: "Empty variable name" });
      continue;
    }
    
    // Validate name format (alphanumeric + underscore, start with letter or underscore)
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      results.push({ name, value, error: "Invalid variable name format" });
      continue;
    }
    
    results.push({ name: name.toUpperCase(), value });
  }
  
  return results;
}

export function EnvironmentVariables({
  environment,
  derivedKey,
  userRole,
}: EnvironmentVariablesProps) {
  const variables = useQuery(api.variables.list, { environmentId: environment._id });
  const saveVariable = useMutation(api.variables.save);
  const removeVariable = useMutation(api.variables.remove);
  const createShare = useMutation(api.sharedSecrets.create);

  const [revealedVars, setRevealedVars] = useState<Set<string>>(new Set());
  const [decryptedValues, setDecryptedValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [decryptErrors, setDecryptErrors] = useState<Record<string, string>>({});

  // New variable form
  const [showNewVar, setShowNewVar] = useState(false);
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Bulk add state
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkInput, setBulkInput] = useState("");
  const [parsedVars, setParsedVars] = useState<ParsedVariable[]>([]);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);

  // Edit variable state
  const [editingVarId, setEditingVarId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isEditSaving, setIsEditSaving] = useState(false);

  // Reset sensitive state when derivedKey is locked (becomes null)
  useEffect(() => {
    if (!derivedKey) {
      setRevealedVars(new Set());
      setDecryptedValues({});
      setNewName("");
      setNewValue("");
      setShowNewVar(false);
      setEditingVarId(null);
      setEditValue("");
    }
  }, [derivedKey]);

  // Parse bulk input when it changes
  useEffect(() => {
    if (bulkInput.trim()) {
      setParsedVars(parseBulkInput(bulkInput));
    } else {
      setParsedVars([]);
    }
  }, [bulkInput]);

  async function handleReveal(varId: string, encryptedValue: string, iv: string, authTag: string) {
    if (!derivedKey) return;

    if (revealedVars.has(varId)) {
      // Hide
      setRevealedVars((prev) => {
        const next = new Set(prev);
        next.delete(varId);
        return next;
      });
      return;
    }

    try {
      setDecryptErrors((prev) => ({ ...prev, [varId]: "" }));
      const decrypted = await decrypt(encryptedValue, iv, authTag, derivedKey);
      setDecryptedValues((prev) => ({ ...prev, [varId]: decrypted }));
      setRevealedVars((prev) => new Set(prev).add(varId));
    } catch (err) {
      console.error("Failed to decrypt:", err);
      setDecryptErrors((prev) => ({ 
        ...prev, 
        [varId]: "Decryption failed. This can happen if the master key was rotated incorrectly." 
      }));
    }
  }

  async function handleCopy(varId: string, encryptedValue: string, iv: string, authTag: string) {
    if (!derivedKey) return;

    try {
      let value = decryptedValues[varId];
      if (value === undefined) {
        value = await decrypt(encryptedValue, iv, authTag, derivedKey);
      }
      await navigator.clipboard.writeText(value);
      setCopied(varId);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      setDecryptErrors((prev) => ({ 
        ...prev, 
        [varId]: "Failed to copy value. Decryption error." 
      }));
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
    } catch (err) {
      console.error("Failed to save variable:", err);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleBulkAdd() {
    if (!derivedKey || parsedVars.length === 0) return;

    const validVars = parsedVars.filter(v => !v.error && v.name && v.value);
    if (validVars.length === 0) return;

    setIsBulkSaving(true);
    setBulkProgress(0);

    try {
      for (let i = 0; i < validVars.length; i++) {
        const v = validVars[i];
        const { encryptedValue, iv, authTag } = await encrypt(v.value, derivedKey);
        await saveVariable({
          environmentId: environment._id,
          name: v.name,
          encryptedValue,
          iv,
          authTag,
        });
        setBulkProgress(((i + 1) / validVars.length) * 100);
      }
      
      setBulkInput("");
      setParsedVars([]);
      setShowBulkAdd(false);
    } catch (err) {
      console.error("Failed to bulk add variables:", err);
    } finally {
      setIsBulkSaving(false);
      setBulkProgress(0);
    }
  }

  async function startEdit(varId: string, encryptedValue: string, iv: string, authTag: string) {
    if (!derivedKey) return;

    try {
      let value = decryptedValues[varId];
      if (value === undefined) {
        value = await decrypt(encryptedValue, iv, authTag, derivedKey);
        setDecryptedValues((prev) => ({ ...prev, [varId]: value }));
      }
      setEditValue(value);
      setEditingVarId(varId);
    } catch (err) {
      console.error("Failed to decrypt for edit:", err);
    }
  }

  async function handleSaveEdit(varName: string) {
    if (!derivedKey || !editValue.trim()) return;

    setIsEditSaving(true);
    try {
      const { encryptedValue, iv, authTag } = await encrypt(editValue, derivedKey);
      await saveVariable({
        environmentId: environment._id,
        name: varName,
        encryptedValue,
        iv,
        authTag,
      });
      // Update cached decrypted value
      if (editingVarId) {
        setDecryptedValues((prev) => ({ ...prev, [editingVarId]: editValue }));
      }
      setEditingVarId(null);
      setEditValue("");
    } catch (err) {
      console.error("Failed to update variable:", err);
    } finally {
      setIsEditSaving(false);
    }
  }

  async function handleDelete(varId: Id<"variables">) {
    if (!confirm("Are you sure you want to delete this variable?")) return;
    await removeVariable({ id: varId });
  }

  const canEdit = userRole === "owner" || userRole === "admin";

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">
            {variables.length} variable{variables.length !== 1 ? "s" : ""}
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
            {/* Only owners and admins can share */}
            {canEdit && (
              <ShareDialog
                variables={variables}
                environment={environment}
                derivedKey={derivedKey}
                createShare={createShare}
              />
            )}

            {/* Bulk Add Dialog */}
            {canEdit && (
              <Dialog open={showBulkAdd} onOpenChange={setShowBulkAdd}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1">
                    <FileText className="h-3 w-3" />
                    Bulk Add
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Bulk Add Variables</DialogTitle>
                    <DialogDescription>
                      Paste multiple environment variables at once. Supports formats like <code>KEY=VALUE</code>, <code>export KEY=VALUE</code>, or <code>KEY="VALUE"</code>.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="bulkInput">Variables</Label>
                      <Textarea
                        id="bulkInput"
                        placeholder={`API_KEY=sk_live_abc123
DATABASE_URL="postgres://user:pass@host/db"
export SECRET_TOKEN=my_secret_value`}
                        value={bulkInput}
                        onChange={(e) => setBulkInput(e.target.value)}
                        rows={8}
                        className="font-mono text-sm"
                      />
                    </div>
                    
                    {parsedVars.length > 0 && (
                      <div className="space-y-2">
                        <Label>Preview ({parsedVars.filter(v => !v.error).length} valid)</Label>
                        <div className="max-h-40 overflow-y-auto space-y-1 rounded-md border p-2 bg-muted/30">
                          {parsedVars.map((v, i) => (
                            <div 
                              key={i} 
                              className={`text-xs font-mono flex items-center gap-2 py-1 px-2 rounded ${
                                v.error ? "bg-destructive/10 text-destructive" : "bg-green-500/10 text-green-700 dark:text-green-400"
                              }`}
                            >
                              {v.error ? (
                                <X className="h-3 w-3 shrink-0" />
                              ) : (
                                <Check className="h-3 w-3 shrink-0" />
                              )}
                              <span className="font-semibold">{v.name || "(empty)"}</span>
                              {!v.error && <span className="text-muted-foreground">= ••••••••</span>}
                              {v.error && <span className="text-xs">({v.error})</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {isBulkSaving && (
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">
                          Adding variables... {Math.round(bulkProgress)}%
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${bulkProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowBulkAdd(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleBulkAdd}
                      disabled={isBulkSaving || parsedVars.filter(v => !v.error && v.value).length === 0}
                    >
                      {isBulkSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Add {parsedVars.filter(v => !v.error && v.value).length} Variable{parsedVars.filter(v => !v.error && v.value).length !== 1 ? "s" : ""}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            {/* Only owners and admins can add variables */}
            {canEdit && (
              <Button
                size="sm"
                onClick={() => setShowNewVar(true)}
                disabled={showNewVar}
                className="gap-1"
              >
                <Plus className="h-3 w-3" />
                Add Variable
              </Button>
            )}
          </div>
        )}
      </div>

      {!derivedKey && variables.length > 0 && (
        <div className="rounded-lg bg-muted/50 border p-4 text-center">
          <KeyRound className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Unlock the project to view or edit variables
          </p>
        </div>
      )}

      {showNewVar && derivedKey && (
        <Card className="border-primary/50">
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="newName" className="text-xs">
                  Name
                </Label>
                <Input
                  id="newName"
                  placeholder="VARIABLE_NAME"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleAddVariable()}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="newValue" className="text-xs">
                  Value
                </Label>
                <Input
                  id="newValue"
                  placeholder="secret_value"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddVariable()}
                  type="password"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowNewVar(false);
                  setNewName("");
                  setNewValue("");
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAddVariable}
                disabled={isSaving || !newName.trim() || !newValue.trim()}
              >
                {isSaving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                Add
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {variables.map((variable) => (
          <div
            key={variable._id}
            className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
          >
            {editingVarId === variable._id ? (
              // Edit mode
              <div className="flex-1 flex items-center gap-3">
                <code className="text-sm font-semibold font-mono shrink-0">{variable.name}</code>
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveEdit(variable.name)}
                  className="font-mono text-sm flex-1"
                  autoFocus
                />
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setEditingVarId(null);
                      setEditValue("");
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-green-600 hover:text-green-700"
                    onClick={() => handleSaveEdit(variable.name)}
                    disabled={isEditSaving || !editValue.trim()}
                  >
                    {isEditSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              // View mode
              <>
                <div className="flex-1 min-w-0">
                  <code className="text-sm font-semibold font-mono">{variable.name}</code>
                  <div className="text-sm text-muted-foreground font-mono truncate mt-0.5">
                    {revealedVars.has(variable._id) && decryptedValues[variable._id] !== undefined
                      ? decryptedValues[variable._id]
                      : decryptErrors[variable._id]
                      ? <span className="text-destructive text-xs">{decryptErrors[variable._id]}</span>
                      : "••••••••••••••••"}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={!derivedKey}
                    onClick={() =>
                      handleReveal(variable._id, variable.encryptedValue, variable.iv, variable.authTag)
                    }
                  >
                    {revealedVars.has(variable._id) ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={!derivedKey}
                    onClick={() =>
                      handleCopy(variable._id, variable.encryptedValue, variable.iv, variable.authTag)
                    }
                  >
                    {copied === variable._id ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  {/* Edit button - owners and admins only */}
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={!derivedKey}
                      onClick={() =>
                        startEdit(variable._id, variable.encryptedValue, variable.iv, variable.authTag)
                      }
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {/* Only owners and admins can delete */}
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      disabled={!derivedKey}
                      onClick={() => handleDelete(variable._id as Id<"variables">)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}

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
    </div>
  );
}
