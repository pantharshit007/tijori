import { memo } from "react";
import { Check, Code2, Copy, Eye, EyeOff, MoreVertical, Pencil, Trash2 } from "lucide-react";

import type { Variable } from "@/lib/types";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface VariableRowProps {
  variable: Variable;
  environmentName: string;
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
 */
export const VariableRow = memo(function VariableRow({
  variable,
  environmentName,
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
  const isRevealed = revealedVars.has(variable._id);
  const decryptedValue = decryptedValues[variable._id];
  const hasError = decryptErrors[variable._id];
  const isCopied = copied === variable._id;

  // Format revealed value: show first 10 chars + ellipsis
  const displayValue = isRevealed && decryptedValue !== undefined
    ? decryptedValue.length > 10 ? `${decryptedValue.slice(0, 10)}…` : decryptedValue
    : null;

  // Determine if added or updated (threshold of 5 seconds)
  const isUpdated = variable.updatedAt && variable._creationTime 
    ? (variable.updatedAt - variable._creationTime) > 5000 
    : false;


  return (
    <div className="grid grid-cols-12 items-center gap-4 py-4 px-4 hover:bg-accent/10 transition-colors group">
      {/* 1. Icon + Name + Subtext (Col 1-4) */}
      <div className="col-span-4 flex items-start gap-4 min-w-0">
        <div className="mt-1 p-2 rounded border bg-muted/30 group-hover:bg-background transition-colors">
          <Code2 className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
        <div className="flex flex-col min-w-0">
          <code className="text-[13px] font-bold font-mono tracking-tight text-foreground truncate">
            {variable.name}
          </code>
          <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
            {environmentName}
          </span>
        </div>
      </div>

      {/* 2. Value Display (Col 5-9) */}
      <div className="col-span-5 flex items-center gap-3">
        <TooltipProvider>
          <div className="flex items-center gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-accent shrink-0"
                  disabled={!derivedKey}
                  onClick={() => onReveal(variable._id, variable.encryptedValue, variable.iv, variable.authTag)}
                >
                  {isRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isRevealed ? "Hide value" : "Click to reveal"}
              </TooltipContent>
            </Tooltip>

            <div className="flex-1 overflow-hidden">
              {isRevealed && displayValue !== null ? (
                <Tooltip key={isCopied ? "copied" : "reveal"}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onCopy(variable._id, variable.encryptedValue, variable.iv, variable.authTag)}
                      className="font-mono text-[13px] text-foreground tracking-widest cursor-pointer hover:bg-accent/50 px-2 py-0.5 rounded transition-colors"
                    >
                      {displayValue}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isCopied ? "Copied!" : "Click to copy"}
                  </TooltipContent>
                </Tooltip>
              ) : hasError ? (
                <span className="text-destructive text-xs font-medium">{hasError}</span>
              ) : (
                <span className="text-muted-foreground/60 text-sm font-mono tracking-widest select-none">
                  ••••••••••••
                </span>
              )}
            </div>
          </div>
        </TooltipProvider>
      </div>

      {/* 3. Meta Data + Actions (Col 10-12) */}
      <div className="col-span-3 flex items-center justify-end gap-4 text-[13px] text-muted-foreground">
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-medium whitespace-nowrap">
            {isUpdated 
              ? `Updated ${new Date(variable.updatedAt).toLocaleDateString()}` 
              : `Added ${new Date(variable._creationTime).toLocaleDateString()}`}
          </span>
          
          <UserAvatar
            src={variable.creatorImage}
            name={variable.creatorName}
            size="md"
            showTooltip={true}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent transition-opacity">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {canEdit && (
                <DropdownMenuItem
                  onClick={() => onEdit(variable._id, variable.encryptedValue, variable.iv, variable.authTag)}
                  disabled={!derivedKey}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => onCopy(variable._id, variable.encryptedValue, variable.iv, variable.authTag)}
                disabled={!derivedKey}
              >
                {isCopied ? <Check className="h-4 w-4 mr-2 text-green-500" /> : <Copy className="h-4 w-4 mr-2" />}
                Copy Value
              </DropdownMenuItem>
              {canEdit && (
                <DropdownMenuItem
                  onClick={() => onDelete(variable._id)}
                  disabled={!derivedKey}
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
});
