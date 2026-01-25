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
}

/**
 * Variable edit row (inline or in bulk edit mode).
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
}: VariableEditRowProps) {
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape" && onCancel) {
      e.preventDefault();
      onCancel();
    } else if (e.key === "Enter" && onSave && !e.shiftKey && name.trim()) {
      e.preventDefault();
      onSave();
    }
  }, [onCancel, onSave, name]);

  return (
    <div className="grid grid-cols-12 items-center gap-4 py-3 px-4 bg-accent/5 transition-colors">
      <div className="col-span-4 flex items-start gap-4">
        <div className="mt-1 p-2 rounded border bg-muted/30">
          <Loader2 className={`h-4 w-4 text-muted-foreground ${isSaving ? 'animate-spin' : ''}`} />
        </div>
        <div className="flex-1 space-y-1">
          <Input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            onKeyDown={handleKeyDown}
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
          className="font-mono text-[13px] h-9 bg-background"
          placeholder="value"
        />
      </div>

      <div className="col-span-3 flex items-center justify-end gap-2">
        {onDelete && (
          <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10" onClick={onDelete}>
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
