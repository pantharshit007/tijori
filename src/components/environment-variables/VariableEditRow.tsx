import { useCallback } from "react";
import { Loader2, Save, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface VariableEditRowProps {
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
