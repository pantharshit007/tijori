import { useCallback } from "react";
import { Loader2, Save, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface VariableEditRowProps {
  name: string;
  value: string;
  onNameChange: (name: string) => void;
  onValueChange: (value: string) => void;
  onSave?: () => void;
  onCancel?: () => void;
  isSaving?: boolean;
  isNew?: boolean;
  onDelete?: () => void;
  onBulkPaste?: (text: string) => void;
}

/**
 * Variable edit row (inline or in bulk edit mode).
 * Supports smart paste: pasting KEY=VALUE will auto-split into name and value fields.
 * Pasting multiple lines will trigger bulk add mode if onBulkPaste is provided.
 */
export function VariableEditRow({
  name,
  value,
  onNameChange,
  onValueChange,
  onSave,
  onCancel,
  isSaving,
  isNew = false,
  onDelete,
  onBulkPaste,
}: VariableEditRowProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && onCancel) {
        e.preventDefault();
        onCancel();
      } else if (e.key === "Enter" && onSave && !e.shiftKey && name.trim()) {
        e.preventDefault();
        onSave();
      }
    },
    [onCancel, onSave, name]
  );

  // Handle paste on name input - detect KEY=VALUE format
  const handleNamePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const pastedText = e.clipboardData.getData("text");

      // Check if it contains multiple lines with = signs
      const lines = pastedText.split(/[\r\n]+/).filter((line) => line.trim());
      const hasMultipleKeyValues =
        lines.length > 1 && lines.filter((l) => l.includes("=")).length > 1;

      if (hasMultipleKeyValues && onBulkPaste) {
        e.preventDefault();
        onBulkPaste(pastedText);
        return;
      }

      // Check if it's a single KEY=VALUE format
      if (lines.length === 1 && lines[0].includes("=")) {
        const line = lines[0];
        const firstEqualsIdx = line.indexOf("=");
        if (firstEqualsIdx > 0) {
          e.preventDefault();
          const key = line.substring(0, firstEqualsIdx).trim();
          let val = line.substring(firstEqualsIdx + 1).trim();

          // Remove quotes if present
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1);
          }

          onNameChange(key);
          onValueChange(val);
        }
      }
    },
    [onNameChange, onValueChange, onBulkPaste]
  );

  // Handle paste on value input - also detect KEY=VALUE format
  const handleValuePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const pastedText = e.clipboardData.getData("text");

      // Check if it contains multiple lines with = signs
      const lines = pastedText.split(/[\r\n]+/).filter((line) => line.trim());
      const hasMultipleKeyValues =
        lines.length > 1 && lines.filter((l) => l.includes("=")).length > 1;

      if (hasMultipleKeyValues && onBulkPaste) {
        e.preventDefault();
        onBulkPaste(pastedText);
        return;
      }

      // If name is empty and paste looks like KEY=VALUE, split it
      if (!name.trim() && lines.length === 1 && lines[0].includes("=")) {
        const line = lines[0];
        const firstEqualsIdx = line.indexOf("=");
        if (firstEqualsIdx > 0) {
          e.preventDefault();
          const key = line.substring(0, firstEqualsIdx).trim();
          let val = line.substring(firstEqualsIdx + 1).trim();

          // Remove quotes if present
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1);
          }

          onNameChange(key);
          onValueChange(val);
        }
      }
    },
    [name, onNameChange, onValueChange, onBulkPaste]
  );

  return (
    <div className="grid grid-cols-12 items-center gap-4 py-3 px-4 bg-accent/5 transition-colors">
      <div className="col-span-4 flex items-start gap-4">
        <div className="mt-1 p-2 rounded border bg-muted/30">
          <Loader2 className={`h-4 w-4 text-muted-foreground ${isSaving ? "animate-spin" : ""}`} />
        </div>
        <div className="flex-1 space-y-1">
          <Input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handleNamePaste}
            className="font-mono text-[13px] h-9 bg-background uppercase"
            placeholder="VARIABLE_NAME"
            autoFocus={isNew}
          />
        </div>
      </div>

      <div className="col-span-5">
        <Input
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handleValuePaste}
          className="font-mono text-[13px] h-9 bg-background"
          placeholder="value"
        />
      </div>

      <div className="col-span-3 flex items-center justify-end gap-2">
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-destructive hover:bg-destructive/10"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
        {onCancel && (
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        )}
        {onSave && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-green-600 hover:text-green-700 hover:bg-green-500/10"
            onClick={onSave}
            disabled={isSaving || !name.trim()}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </div>
  );
}
