import { useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";

import type { ParsedVariable } from "@/lib/types";
import { cn, parseBulkInput } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface BulkAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (variables: ParsedVariable[]) => Promise<void>;
  isSaving: boolean;
  progress: number;
}

/**
 * Bulk Add Dialog Component.
 * Allows pasting multiple environment variables at once.
 */
export function BulkAddDialog({ open, onOpenChange, onAdd, isSaving, progress }: BulkAddDialogProps) {
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
  
  // Detect duplicate names (case-insensitive)
  const nameCounts = validVars.reduce((acc, v) => {
    const name = v.name.trim().toUpperCase();
    if (name) {
      acc.set(name, (acc.get(name) || 0) + 1);
    }
    return acc;
  }, new Map<string, number>());
  
  const duplicateNames = new Set(
    Array.from(nameCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([name]) => name)
  );
  
  // Deduplicate: keep only the last occurrence of each name
  const deduplicatedVars = (() => {
    const seen = new Map<string, ParsedVariable>();
    for (const v of validVars) {
      seen.set(v.name.trim().toUpperCase(), v);
    }
    return Array.from(seen.values());
  })();

  const hasDuplicates = duplicateNames.size > 0;

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
              <div className="flex items-center justify-between">
                <Label>
                  Preview ({validVars.length} valid{hasDuplicates ? `, ${deduplicatedVars.length} unique` : ""})
                </Label>
                {hasDuplicates && (
                  <span className="text-xs text-yellow-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Duplicates will use last value
                  </span>
                )}
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1 rounded-md border p-2 bg-muted/30">
                {parsedVars.map((v, i) => {
                  const isDuplicate = !v.error && duplicateNames.has(v.name.trim().toUpperCase());
                  return (
                    <div 
                      key={i} 
                      className={cn(
                        "text-xs font-mono flex items-center gap-2 py-1 px-2 rounded",
                        v.error 
                          ? "bg-destructive/10 text-destructive" 
                          : isDuplicate 
                            ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
                            : "bg-green-500/10 text-green-700 dark:text-green-400"
                      )}
                    >
                      {v.error ? (
                        <X className="h-3 w-3 shrink-0" />
                      ) : isDuplicate ? (
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                      ) : (
                        <Check className="h-3 w-3 shrink-0" />
                      )}
                      <span className="font-semibold">{v.name || "(empty)"}</span>
                      {!v.error && <span className="text-muted-foreground">= ••••••••</span>}
                      {v.error && <span className="text-xs">({v.error})</span>}
                      {isDuplicate && <span className="text-xs">(duplicate)</span>}
                    </div>
                  );
                })}
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
          <Button onClick={() => onAdd(deduplicatedVars)} disabled={isSaving || deduplicatedVars.length === 0}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add {deduplicatedVars.length} Variable{deduplicatedVars.length !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
