import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";

import type { ParsedVariable } from "@/lib/types";
import { parseBulkInput } from "@/lib/utils";
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
