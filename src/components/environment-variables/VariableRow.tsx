import { memo } from "react";
import { Check, Copy, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";

import type { Variable } from "@/lib/types";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";

export interface VariableRowProps {
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

/**
 * Single variable row in view mode.
 * Wrapped in React.memo since it receives many props and renders in a list.
 */
export const VariableRow = memo(function VariableRow({
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
              onClick={() => onDelete(variable._id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
});
