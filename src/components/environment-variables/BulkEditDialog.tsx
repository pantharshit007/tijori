import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

import type { BulkEditVariable, Variable } from "@/lib/types";
import { parseBulkInput, variablesToExport } from "@/lib/utils";
import { decrypt } from "@/lib/crypto";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
} from "@/components/ui/dialog";

export interface BulkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variables: Variable[];
  derivedKey: CryptoKey;
  onSave: (
    updates: { id?: string; name: string; value: string; originalName?: string }[],
    deletes: string[]
  ) => Promise<void>;
  isSaving: boolean;
}

/**
 * Bulk Edit Dialog Component.
 * Allows editing multiple variables with either a table or raw text mode.
 */
export function BulkEditDialog({ open, onOpenChange, variables, derivedKey, onSave, isSaving }: BulkEditDialogProps) {
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
    
    const newEditVars: BulkEditVariable[] = parsed
      .filter(p => !p.error && (p.name.trim() || p.value.trim()))
      .map((p, i) => {
        const existingIdx = currentVars.findIndex(e => e.name === p.name && !e.toDelete);
        if (existingIdx !== -1) {
          const existing = currentVars[existingIdx];
          currentVars.splice(existingIdx, 1);
          return { ...existing, value: p.value };
        }
        
        return {
          id: `new-${Date.now()}-${i}`,
          originalName: "",
          name: p.name,
          value: p.value,
          isNew: true
        };
      });
    
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
        return prev.map((item, i) => i === index ? { ...item, toDelete: true } : item);
      }
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleSave() {
    const updates = editVars
      .filter((v) => !v.toDelete && v.name.trim() && v.value.trim())
      .map((v) => ({
        id: v.isNew ? undefined : v.id,
        name: v.name,
        value: v.value,
        originalName: v.originalName || undefined,
      }));

    const deletes = editVars
      .filter((v) => v.toDelete && v.originalName && !v.isNew)
      .map((v) => v.id);

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

        <DialogFooter className="flex items-center justify-between pt-4 border-t">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
