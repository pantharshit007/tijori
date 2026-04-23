import { Clock, FolderOpen, Plus } from "lucide-react";
import { PREVIEW_PROJECTS } from "@/lib/preview-data";
import type { PreviewPanelProps } from "@/lib/types";

/** Grid of project cards — shown under "All Projects" sidebar tab. */
export function ProjectsPanel({ isVisible, stagger }: PreviewPanelProps) {
  return (
    <div className="p-6">
      {/* Header */}
      <div
        className={`flex items-start justify-between mb-6 dshb-fade-in ${isVisible ? "dshb-animate" : ""}`}
        style={stagger(1)}
      >
        <div>
          <h3 className="text-base font-bold leading-tight">Dashboard</h3>
          <p className="text-[10px] text-muted-foreground mt-1">
            Manage your secure project environment variables.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-border/30 rounded-lg overflow-hidden">
            <div className="p-1.5 bg-primary/10">
              <svg className="size-3 text-primary" viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="1" width="6" height="6" rx="1" />
                <rect x="9" y="1" width="6" height="6" rx="1" />
                <rect x="1" y="9" width="6" height="6" rx="1" />
                <rect x="9" y="9" width="6" height="6" rx="1" />
              </svg>
            </div>
            <div className="p-1.5 border-l border-border/30">
              <svg
                className="size-3 text-muted-foreground/40"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <rect x="1" y="2" width="14" height="2" rx="0.5" />
                <rect x="1" y="7" width="14" height="2" rx="0.5" />
                <rect x="1" y="12" width="14" height="2" rx="0.5" />
              </svg>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-semibold bg-primary text-primary-foreground px-3 py-1.5 rounded-lg shadow-sm shadow-primary/20">
            <Plus className="size-3" />
            New Project
          </div>
        </div>
      </div>

      {/* Section title */}
      <div
        className={`text-xs font-bold mb-3 dshb-fade-in ${isVisible ? "dshb-animate" : ""}`}
        style={stagger(2)}
      >
        Your Projects
      </div>

      {/* Project cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {PREVIEW_PROJECTS.map((proj, i) => (
          <div
            key={proj.name}
            className={`group rounded-xl border border-border/30 bg-muted/[0.03] p-4 hover:border-primary/30 hover:bg-muted/[0.06] transition-all cursor-default dshb-fade-in ${
              isVisible ? "dshb-animate" : ""
            }`}
            style={stagger(3 + i)}
          >
            <div className="flex items-start gap-2.5 mb-2">
              <div className="h-7 w-7 rounded-lg bg-primary/10 border border-border/20 flex items-center justify-center shrink-0">
                <FolderOpen className="size-3.5 text-primary/60" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold truncate group-hover:text-primary transition-colors">
                  {proj.name}
                </div>
                <span className="text-[8px] font-medium text-muted-foreground uppercase tracking-wider">
                  {proj.role}
                </span>
              </div>
            </div>
            <p className="text-[9px] text-muted-foreground mb-3 leading-relaxed">
              {proj.description}
            </p>
            <div className="flex items-center gap-1 text-[8px] text-muted-foreground">
              <Clock className="size-2.5" />
              {proj.updated}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
