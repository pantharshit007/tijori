import { useCallback, useState } from "react";
import {
  ChevronDown,
  Code2,
  Eye,
  EyeOff,
  Lock,
  MoreVertical,
  Plus,
  Search,
  Settings,
  Share2,
  Users,
} from "lucide-react";
import type { PreviewPanelProps } from "@/lib/types";
import { PREVIEW_VARIABLES } from "@/lib/preview-data";

/**
 * Project detail view with env variables — shown under "Dashboard" sidebar tab.
 *
 * The blinking cursor uses a pure CSS animation (`dshb-cursor-blink` keyframe
 * in styles.css) instead of a React `setInterval` to avoid re-renders every 530ms.
 */
export function VariablesPanel({ isVisible, stagger }: PreviewPanelProps) {
  const [revealedRows, setRevealedRows] = useState<Set<number>>(new Set());

  const toggleReveal = useCallback((idx: number) => {
    setRevealedRows((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  }, []);

  return (
    <div className="flex-1 min-w-0 overflow-hidden">
      {/* Project header */}
      <div
        className={`px-6 py-4 border-b border-border/20 dshb-fade-in ${
          isVisible ? "dshb-animate" : ""
        }`}
        style={stagger(1)}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold leading-tight">Acme Platform</h3>
              <span className="text-[8px] font-medium text-muted-foreground border border-border/30 px-1.5 py-0.5 rounded">
                owner
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Core infrastructure secrets</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground border border-border/30 rounded-lg px-2.5 py-1.5 hover:bg-muted/10 transition-colors">
              <Lock className="size-3" />
              Lock
            </div>
            <div className="h-6 w-6 rounded-lg border border-border/30 flex items-center justify-center hover:bg-muted/10 transition-colors">
              <Users className="size-3 text-muted-foreground" />
            </div>
            <div className="h-6 w-6 rounded-lg border border-border/30 flex items-center justify-center hover:bg-muted/10 transition-colors">
              <Settings className="size-3 text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-3 mt-3 transition-colors">
          <span className="text-[11px] font-semibold bg-primary text-primary-foreground px-3 py-1 rounded-lg cursor-pointer hover:bg-primary/90">
            Project
          </span>
          <span className="text-[11px] text-muted-foreground flex items-center gap-1.5 px-2 py-1 rounded-lg cursor-pointer hover:bg-accent/10">
            <Share2 className="size-3" /> Shared
          </span>
        </div>
      </div>

      {/* Toolbar */}
      <div
        className={`px-6 py-3 border-b border-border/10 flex items-center gap-3 dshb-fade-in ${
          isVisible ? "dshb-animate" : ""
        }`}
        style={stagger(2)}
      >
        <div className="flex items-center gap-1.5 text-[11px] border border-border/30 rounded-lg px-3 py-1.5 bg-muted/10">
          <span className="font-medium">Production</span>
          <ChevronDown className="size-3 text-muted-foreground" />
        </div>
        <span className="text-[11px] text-muted-foreground flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors">
          <Plus className="size-3" /> Add
        </span>
      </div>

      {/* Search bar */}
      <div
        className={`px-6 py-2.5 border-b border-border/10 flex items-center gap-3 dshb-fade-in ${
          isVisible ? "dshb-animate" : ""
        }`}
        style={stagger(3)}
      >
        <div className="flex-1 flex items-center gap-2 text-[11px] border border-border/30 rounded-lg px-3 py-2 bg-muted/5">
          <Search className="size-3.5 text-muted-foreground" />
          <span className="text-muted-foreground/50">
            Search variables...
            <span className="inline-block w-[1px] h-[11px] bg-primary ml-px align-middle dshb-cursor-blink" />
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="font-medium">{PREVIEW_VARIABLES.length} variables</span>
        </div>
      </div>

      {/* Variable rows */}
      <div className="divide-y divide-border/10">
        {PREVIEW_VARIABLES.map((v, i) => {
          const isRevealed = revealedRows.has(i);
          return (
            <div
              key={v.name}
              className={`group px-6 py-3 flex items-center gap-3.5 hover:bg-muted/[0.04] transition-colors dshb-fade-in ${
                isVisible ? "dshb-animate" : ""
              }`}
              style={stagger(4 + i)}
            >
              {/* Icon */}
              <div className="h-8 w-8 rounded-lg bg-muted/10 border border-border/20 flex items-center justify-center shrink-0">
                <Code2 className="size-4 text-muted-foreground" />
              </div>

              {/* Name + env */}
              <div className="min-w-0 w-28 sm:w-36">
                <div className="text-[12px] font-semibold truncate">{v.name}</div>
                <div
                  className={`text-[8px] font-bold uppercase tracking-widest mt-0.5 ${
                    v.env === "PRODUCTION"
                      ? "text-primary/70"
                      : v.env === "STAGING"
                        ? "text-blue-600/80 dark:text-blue-400/70"
                        : "text-emerald-600/80 dark:text-emerald-400/70"
                  }`}
                >
                  {v.env}
                </div>
              </div>

              {/* Eye icon — click to toggle */}
              <button
                onClick={() => toggleReveal(i)}
                className="shrink-0 text-muted-foreground/40 hover:text-primary transition-colors cursor-pointer p-0.5"
                tabIndex={-1}
                title={isRevealed ? "Hide value" : "Reveal value"}
              >
                {isRevealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>

              {/* Masked / revealed value */}
              <div className="min-w-0 overflow-hidden">
                {isRevealed ? (
                  <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 tracking-tight dshb-decrypt">
                    {v.value}
                  </span>
                ) : (
                  <div className="flex gap-[3px] items-center">
                    {Array.from({ length: 14 }).map((_, di) => (
                      <span
                        key={di}
                        className="inline-block w-[5px] h-[5px] rounded-full bg-muted-foreground/30"
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Spacer to push date & menu to right */}
              <div className="flex-1" />

              {/* Date */}
              <span className="hidden sm:block text-[9px] text-muted-foreground shrink-0 w-20 text-right">
                {v.date}
              </span>

              {/* Menu */}
              <button
                className="shrink-0 text-muted-foreground/20 hover:text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                tabIndex={-1}
              >
                <MoreVertical className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add row hint */}
      <div
        className={`px-6 py-4 flex items-center justify-center dshb-fade-in ${
          isVisible ? "dshb-animate" : ""
        }`}
        style={stagger(9)}
      >
        <div className="flex items-center gap-1.5 text-[10px] text-primary dark:text-primary/50 border border-dashed border-primary/40 dark:border-primary/20 rounded-lg px-5 py-2.5 hover:border-primary/40 hover:text-primary/70 transition-colors cursor-default">
          <Plus className="size-3.5" />
          Add variable
        </div>
      </div>
    </div>
  );
}
