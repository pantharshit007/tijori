import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { 
  Check, 
  ClipboardCopy, 
  Clock,
  Copy, 
  Eye, 
  EyeOff, 
  FileEdit,
  FileText,
  KeyRound, 
  Loader2, 
  MoreVertical,
  Pencil,
  Plus, 
  Save,
  Trash2,
  X
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import { ShareDialog } from "./share-dialog";
import type { Id } from "../../convex/_generated/dataModel";

import type { Environment } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { decrypt, encrypt } from "@/lib/crypto";
import { formatRelativeTime } from "@/lib/time";

// ============================================================================
// Types
// ============================================================================

export interface EnvironmentVariablesProps {
  environment: Environment;
  derivedKey: CryptoKey | null;
  userRole: "owner" | "admin" | "member";
}

interface Variable {
  _id: string;
  name: string;
  encryptedValue: string;
  iv: string;
  authTag: string;
}

interface ParsedVariable {
  name: string;
  value: string;
  error?: string;
}

interface BulkEditVariable {
  id: string;
  originalName: string;
  name: string;
  value: string;
  isNew?: boolean;
  toDelete?: boolean;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parse bulk input text into variable name-value pairs.
 */
function parseBulkInput(input: string): ParsedVariable[] {
  const lines = input.split("\n").filter(line => line.trim());
  const results: ParsedVariable[] = [];

  for (const line of lines) {
    let trimmed = line.trim();
    if (trimmed.startsWith("#")) continue;
    if (trimmed.toLowerCase().startsWith("export ")) {
      trimmed = trimmed.slice(7).trim();
    }
    
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) {
      results.push({ name: trimmed, value: "", error: "Missing '=' separator" });
      continue;
    }
    
    const name = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    
    if (!name) {
      results.push({ name: "", value, error: "Empty variable name" });
      continue;
    }
    
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      results.push({ name, value, error: "Invalid variable name format" });
      continue;
    }
    
    results.push({ name, value });
  }
  
  return results;
}

/**
 * Convert variables to exportable format
 */
function variablesToExport(vars: { name: string; value: string }[]): string {
  return vars
    .filter(v => v.name.trim() || v.value.trim())
    .map(v => `${v.name}="${v.value}"`)
    .join("\n");
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Single variable row in view mode
 */
interface VariableRowProps {
  variable: Variable;
  derivedKey: CryptoKey | null;
  canEdit: boolean;
  revealedVars: Set<string>;
  decryptedValues: Record<string, string>;
  decryptErrors: Record<string, string>;
  copied: string | null;
  onReveal: (varId: string, encryptedValue: string, iv: string, authTag: string) => void;
  onCopy: (varId: string, encryptedValue: string, iv: string, authTag: string) => void;
  onEdit: (varId: string, encryptedValue: string, iv: string, authTag: string) => void;
  onDelete: (varId: Id<"variables">) => void;
}

function VariableRow({
  variable,
  derivedKey,
  canEdit,
  revealedVars,
  decryptedValues,
  decryptErrors,
  copied,
  onReveal,
  onCopy,
  onEdit,
  onDelete,
}: VariableRowProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
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
          onClick={() => onReveal(variable._id, variable.encryptedValue, variable.iv, variable.authTag)}
        >
          {revealedVars.has(variable._id) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={!derivedKey}
          onClick={() => onCopy(variable._id, variable.encryptedValue, variable.iv, variable.authTag)}
        >
          {copied === variable._id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </Button>
        {canEdit && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={!derivedKey}
              onClick={() => onEdit(variable._id, variable.encryptedValue, variable.iv, variable.authTag)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              disabled={!derivedKey}
              onClick={() => onDelete(variable._id as Id<"variables">)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Variable edit row (inline or in bulk edit mode)
 */
interface VariableEditRowProps {
  name: string;
  value: string;
  onNameChange: (name: string) => void;
  onValueChange: (value: string) => void;
  onSave?: () => void;
  onCancel?: () => void;
  isSaving?: boolean;
  showActions?: boolean;
  isNew?: boolean;
  onDelete?: () => void;
}

function VariableEditRow({
  name,
  value,
  onNameChange,
  onValueChange,
  onSave,
  onCancel,
  isSaving,
  showActions = true,
  isNew = false,
  onDelete,
}: VariableEditRowProps) {
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape" && onCancel) {
      e.preventDefault();
      onCancel();
    } else if (e.key === "Enter" && onSave && !e.shiftKey) {
      e.preventDefault();
      onSave();
    }
  }, [onCancel, onSave]);

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card border-primary/50">
      <div className="flex-1 grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Name</Label>
          <Input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="font-mono text-sm"
            placeholder="VARIABLE_NAME"
            autoFocus={isNew}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Value</Label>
          <Input
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="font-mono text-sm"
            placeholder="value"
          />
        </div>
      </div>
      {showActions && (
        <div className="flex items-center gap-1 shrink-0">
          {onDelete && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          {onCancel && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onCancel}>
              <X className="h-4 w-4" />
            </Button>
          )}
          {onSave && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-green-600 hover:text-green-700"
              onClick={onSave}
              disabled={isSaving || !name.trim()}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Bulk Add Dialog Component
 */
interface BulkAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (variables: ParsedVariable[]) => Promise<void>;
  isSaving: boolean;
  progress: number;
}

function BulkAddDialog({ open, onOpenChange, onAdd, isSaving, progress }: BulkAddDialogProps) {
  const [bulkInput, setBulkInput] = useState("");
  const [parsedVars, setParsedVars] = useState<ParsedVariable[]>([]);

  useEffect(() => {
    if (bulkInput.trim()) {
      setParsedVars(parseBulkInput(bulkInput));
    } else {
      setParsedVars([]);
    }
  }, [bulkInput]);

  useEffect(() => {
    if (!open) {
      setBulkInput("");
      setParsedVars([]);
    }
  }, [open]);

  const validVars = parsedVars.filter(v => !v.error && v.value);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Add Variables</DialogTitle>
          <DialogDescription>
            Paste multiple environment variables. Supports <code>KEY=VALUE</code>, <code>export KEY=VALUE</code>, or quoted values.
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
              <Label>Preview ({validVars.length} valid)</Label>
              <div className="max-h-40 overflow-y-auto space-y-1 rounded-md border p-2 bg-muted/30">
                {parsedVars.map((v, i) => (
                  <div 
                    key={i} 
                    className={`text-xs font-mono flex items-center gap-2 py-1 px-2 rounded ${
                      v.error ? "bg-destructive/10 text-destructive" : "bg-green-500/10 text-green-700 dark:text-green-400"
                    }`}
                  >
                    {v.error ? <X className="h-3 w-3 shrink-0" /> : <Check className="h-3 w-3 shrink-0" />}
                    <span className="font-semibold">{v.name || "(empty)"}</span>
                    {!v.error && <span className="text-muted-foreground">= ••••••••</span>}
                    {v.error && <span className="text-xs">({v.error})</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {isSaving && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Adding variables... {Math.round(progress)}%</div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onAdd(validVars)} disabled={isSaving || validVars.length === 0}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add {validVars.length} Variable{validVars.length !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Bulk Edit Dialog Component
 */
interface BulkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variables: Variable[];
  derivedKey: CryptoKey;
  onSave: (updates: { name: string; value: string; originalName?: string }[], deletes: string[]) => Promise<void>;
  isSaving: boolean;
}

function BulkEditDialog({ open, onOpenChange, variables, derivedKey, onSave, isSaving }: BulkEditDialogProps) {
  const [editVars, setEditVars] = useState<BulkEditVariable[]>([]);
  const [isRawMode, setIsRawMode] = useState(false);
  const [rawText, setRawText] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Decrypt all variables when dialog opens
  useEffect(() => {
    if (open && derivedKey) {
      setIsLoading(true);
      setIsRawMode(false); // Always start in key-value mode
      Promise.all(
        variables.map(async (v) => {
          try {
            const decrypted = await decrypt(v.encryptedValue, v.iv, v.authTag, derivedKey);
            return { id: v._id, originalName: v.name, name: v.name, value: decrypted };
          } catch {
            return { id: v._id, originalName: v.name, name: v.name, value: "" };
          }
        })
      ).then((decrypted) => {
        setEditVars(decrypted);
        setRawText(variablesToExport(decrypted));
        setIsLoading(false);
      });
    }
  }, [open, variables, derivedKey]);

  // Sync raw text with edit vars when switching modes
  useEffect(() => {
    if (!isRawMode && editVars.length > 0) {
      setRawText(variablesToExport(editVars.filter(v => !v.toDelete)));
    }
  }, [isRawMode, editVars]);

  function handleRawTextChange(text: string) {
    setRawText(text);
    const parsed = parseBulkInput(text);
    
    // Create a shadow copy of existing state vars to match against
    const currentVars = [...editVars];
    
    // We try to match parsed lines to existing variables by name.
    // If name doesn't match, it's a new variable.
    const newEditVars: BulkEditVariable[] = parsed
      .filter(p => !p.error && (p.name.trim() || p.value.trim()))
      .map((p, i) => {
        // Try to find if this name exists in our current state list
        const existingIdx = currentVars.findIndex(e => e.name === p.name && !e.toDelete);
        if (existingIdx !== -1) {
          const existing = currentVars[existingIdx];
          // Remove from shadow copy so we don't match it again
          currentVars.splice(existingIdx, 1);
          return {
            ...existing,
            value: p.value
          };
        }
        
        // If not found by name, it's a new entry
        return {
          id: `new-${Date.now()}-${i}`,
          originalName: "",
          name: p.name,
          value: p.value,
          isNew: true
        };
      });
    
    // Any remaining original vars that were NOT matched by name in the raw text 
    // should be marked as toDelete if they were originally from the server.
    const deletedVars = editVars
      .filter(e => e.originalName && !newEditVars.some(n => n.originalName === e.originalName))
      .map(e => ({ ...e, toDelete: true }));
    
    setEditVars([...newEditVars, ...deletedVars]);
  }

  function updateVar(index: number, field: "name" | "value", val: string) {
    setEditVars(prev => prev.map((v, i) => 
      i === index ? { ...v, [field]: val } : v
    ));
  }

  function addNewVar() {
    setEditVars(prev => [...prev, { 
      id: `new-${Date.now()}`, 
      originalName: "", 
      name: "", 
      value: "", 
      isNew: true 
    }]);
  }

  function removeVar(index: number) {
    setEditVars(prev => {
      const v = prev[index];
      if (v.originalName) {
        // Mark for deletion
        return prev.map((item, i) => i === index ? { ...item, toDelete: true } : item);
      }
      // Remove new item entirely
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleSave() {
    const updates = editVars
      .filter(v => !v.toDelete && v.name.trim() && v.value.trim())
      .map(v => ({ name: v.name, value: v.value, originalName: v.originalName || undefined }));
    
    const deletes = editVars
      .filter(v => v.toDelete && v.originalName)
      .map(v => v.originalName);
    
    await onSave(updates, deletes);
    onOpenChange(false);
  }

  const activeVars = editVars.filter(v => !v.toDelete);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Edit Variables</DialogTitle>
          <DialogDescription>
            Edit multiple variables at once. Changes are saved when you click Save All.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : isRawMode ? (
            <div className="space-y-2">
              <Label>Raw Edit (KEY="VALUE" format)</Label>
              <Textarea
                value={rawText}
                onChange={(e) => handleRawTextChange(e.target.value)}
                rows={15}
                className="font-mono text-sm"
              />
            </div>
          ) : (
            <div className="space-y-2">
              {activeVars.map((v) => (
                <div key={v.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Name</Label>
                      <Input
                        value={v.name}
                        onChange={(e) => updateVar(editVars.indexOf(v), "name", e.target.value)}
                        className="font-mono text-sm"
                        placeholder="VARIABLE_NAME"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Value</Label>
                      <Input
                        value={v.value}
                        onChange={(e) => updateVar(editVars.indexOf(v), "value", e.target.value)}
                        className="font-mono text-sm"
                        placeholder="value"
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                    onClick={() => removeVar(editVars.indexOf(v))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={addNewVar} 
                className="w-full gap-1"
                disabled={activeVars.length > 0 && (!activeVars[activeVars.length-1].name.trim() || !activeVars[activeVars.length-1].value.trim())}
              >
                <Plus className="h-3 w-3" /> Add Variable
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2">
            <Checkbox 
              id="rawMode" 
              checked={isRawMode} 
              onCheckedChange={(checked) => setIsRawMode(!!checked)} 
            />
            <Label htmlFor="rawMode" className="text-sm cursor-pointer">Raw text edit</Label>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button 
              onClick={handleSave} 
              disabled={isSaving || activeVars.some(v => !v.name.trim())}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save All
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Main Component
// ============================================================================

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

  const canEdit = userRole === "owner" || userRole === "admin";

  // Reset state when locked
  useEffect(() => {
    if (!derivedKey) {
      setRevealedVars(new Set());
      setDecryptedValues({});
      setNewName("");
      setNewValue("");
      setShowNewVar(false);
      setEditingVarId(null);
    }
  }, [derivedKey]);

  // ==================== Handlers ====================

  async function handleReveal(varId: string, encryptedValue: string, iv: string, authTag: string) {
    if (!derivedKey) return;

    if (revealedVars.has(varId)) {
      setRevealedVars(prev => { const next = new Set(prev); next.delete(varId); return next; });
      return;
    }

    try {
      setDecryptErrors(prev => ({ ...prev, [varId]: "" }));
      const decrypted = await decrypt(encryptedValue, iv, authTag, derivedKey);
      setDecryptedValues(prev => ({ ...prev, [varId]: decrypted }));
      setRevealedVars(prev => new Set(prev).add(varId));
    } catch (err) {
      console.error("Failed to decrypt:", err);
      setDecryptErrors(prev => ({ ...prev, [varId]: "Decryption failed." }));
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
    }
  }

  async function handleCopyAll() {
    if (!derivedKey || !variables) return;

    try {
      const decrypted = await Promise.all(
        variables.map(async (v) => {
          const value = decryptedValues[v._id] || await decrypt(v.encryptedValue, v.iv, v.authTag, derivedKey);
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
      await saveVariable({ environmentId: environment._id, name: newName.trim(), encryptedValue, iv, authTag });
      setNewName("");
      setNewValue("");
      setShowNewVar(false);
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setIsSaving(false);
    }
  }

  async function startEdit(varId: string, varName: string, encryptedValue: string, iv: string, authTag: string) {
    if (!derivedKey) return;

    try {
      let value = decryptedValues[varId];
      if (value === undefined) {
        value = await decrypt(encryptedValue, iv, authTag, derivedKey);
        setDecryptedValues(prev => ({ ...prev, [varId]: value }));
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
      // If name changed, delete old and create new
      if (editOriginalName !== editName.trim()) {
        // Find the old variable to delete
        const oldVar = variables?.find(v => v.name === editOriginalName);
        if (oldVar) {
          await removeVariable({ id: oldVar._id as Id<"variables"> });
        }
      }
      
      const { encryptedValue, iv, authTag } = await encrypt(editValue, derivedKey);
      await saveVariable({ environmentId: environment._id, name: editName.trim(), encryptedValue, iv, authTag });
      
      if (editingVarId) {
        setDecryptedValues(prev => ({ ...prev, [editingVarId]: editValue }));
      }
      setEditingVarId(null);
      setEditName("");
      setEditValue("");
      setEditOriginalName("");
    } catch (err) {
      console.error("Failed to update:", err);
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
    await removeVariable({ id: varId });
  }

  async function handleBulkAdd(vars: ParsedVariable[]) {
    if (!derivedKey || vars.length === 0) return;

    setIsBulkSaving(true);
    setBulkProgress(0);

    try {
      for (let i = 0; i < vars.length; i++) {
        const v = vars[i];
        const { encryptedValue, iv, authTag } = await encrypt(v.value, derivedKey);
        await saveVariable({ environmentId: environment._id, name: v.name, encryptedValue, iv, authTag });
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
      // Delete removed variables
      for (const name of deletes) {
        const v = variables?.find(v => v.name === name);
        if (v) await removeVariable({ id: v._id as Id<"variables"> });
      }

      // Save all updates
      for (const u of updates) {
        // If name changed, delete old first
        if (u.originalName && u.originalName !== u.name) {
          const oldVar = variables?.find(v => v.name === u.originalName);
          if (oldVar) await removeVariable({ id: oldVar._id as Id<"variables"> });
        }
        
        const { encryptedValue, iv, authTag } = await encrypt(u.value, derivedKey);
        await saveVariable({ environmentId: environment._id, name: u.name, encryptedValue, iv, authTag });
      }
    } catch (err) {
      console.error("Failed to bulk edit:", err);
    } finally {
      setIsBulkEditSaving(false);
    }
  }

  // ==================== Render ====================

  if (variables === undefined) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
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
            {canEdit && (
              <Button size="sm" onClick={() => setShowNewVar(true)} disabled={showNewVar} className="gap-1">
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
              <DropdownMenuContent align="end" className="w-48">
                {variables.length > 0 && (
                  <DropdownMenuItem onClick={handleCopyAll} className="gap-2">
                    {copied === "all" ? <Check className="h-4 w-4 text-green-500" /> : <ClipboardCopy className="h-4 w-4" />}
                    Copy All Variables
                  </DropdownMenuItem>
                )}
                
                {canEdit && (
                  <>
                    <DropdownMenuItem onClick={() => setShowBulkAdd(true)} className="gap-2">
                      <FileText className="h-4 w-4" />
                      Bulk Add Variables
                    </DropdownMenuItem>
                    
                    {variables.length > 0 && (
                      <DropdownMenuItem onClick={() => setShowBulkEdit(true)} className="gap-2">
                        <FileEdit className="h-4 w-4" />
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
                          <Copy className="h-4 w-4" />
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
          <p className="text-sm text-muted-foreground">Unlock the project to view or edit variables</p>
        </div>
      )}

      {/* New variable form */}
      {showNewVar && derivedKey && (
        <VariableEditRow
          name={newName}
          value={newValue}
          onNameChange={setNewName}
          onValueChange={setNewValue}
          onSave={handleAddVariable}
          onCancel={() => { setShowNewVar(false); setNewName(""); setNewValue(""); }}
          isSaving={isSaving}
          isNew
        />
      )}

      {/* Variables list */}
      <div className="space-y-2">
        {variables.map((variable) => (
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
