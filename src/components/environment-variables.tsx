import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { 
  Check, 
  Clock, 
  Copy, 
  Eye, 
  EyeOff, 
  KeyRound, 
  Loader2, 
  Plus, 
  Trash2 
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
import { decrypt, encrypt } from "@/lib/crypto";
import { formatRelativeTime } from "@/lib/time";

export interface EnvironmentVariablesProps {
  environment: Environment;
  derivedKey: CryptoKey | null;
  userRole: "owner" | "admin" | "member";
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

  // Reset sensitive state when derivedKey is locked (becomes null)
  useEffect(() => {
    if (!derivedKey) {
      setRevealedVars(new Set());
      setDecryptedValues({});
      setNewName("");
      setNewValue("");
      setShowNewVar(false);
    }
  }, [derivedKey]);

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
      // If decryption fails, it's likely due to a salt mismatch (e.g. after a bad Master Key rotation)
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

  async function handleDelete(varId: Id<"variables">) {
    if (!confirm("Are you sure you want to delete this variable?")) return;
    await removeVariable({ id: varId });
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
            {(userRole === "owner" || userRole === "admin") && (
              <ShareDialog
                variables={variables}
                environment={environment}
                derivedKey={derivedKey}
                createShare={createShare}
              />
            )}

            {/* Only owners and admins can add variables */}
            {(userRole === "owner" || userRole === "admin") && (
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
              {/* Only owners and admins can delete */}
              {(userRole === "owner" || userRole === "admin") && (
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
          </div>
        ))}

          {variables.length === 0 && !showNewVar && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No variables in this environment</p>
            {derivedKey && (userRole === "owner" || userRole === "admin") && (
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
