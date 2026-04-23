import { ChevronDown, MoreHorizontal, Search } from "lucide-react";
import type { PreviewPanelProps } from "@/lib/types";
import { PREVIEW_SHARED } from "@/lib/preview-data";

export function SharedPanel({ isVisible, stagger }: PreviewPanelProps) {
  return (
    <div className="p-6">
      {/* Header */}
      <div className={`mb-5 dshb-fade-in ${isVisible ? "dshb-animate" : ""}`} style={stagger(1)}>
        <h3 className="text-base font-bold leading-tight">Shared Secrets</h3>
        <p className="text-[10px] text-muted-foreground mt-1">
          Manage your shared environment variable links and track their usage.
        </p>
      </div>

      {/* Search */}
      <div
        className={`flex items-center gap-2.5 mb-4 dshb-fade-in ${isVisible ? "dshb-animate" : ""}`}
        style={stagger(2)}
      >
        <div className="flex-1 flex items-center gap-2 text-[10px] border border-border/30 rounded-lg px-3 py-2 bg-muted/5">
          <Search className="size-3 text-muted-foreground/40" />
          <span className="text-muted-foreground/40">Search by project or environment...</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground border border-border/30 rounded-lg px-2.5 py-1.5">
          All Status <ChevronDown className="size-2.5" />
        </div>
      </div>

      {/* Table */}
      <div
        className={`rounded-xl border border-border/20 overflow-hidden dshb-fade-in ${isVisible ? "dshb-animate" : ""}`}
        style={stagger(3)}
      >
        {/* Table header */}
        <div className="grid grid-cols-[1.4fr_1.6fr_1fr_0.7fr_0.5fr_0.6fr_0.3fr] gap-3 px-4 py-2.5 bg-muted/[0.04] border-b border-border/20 text-[9px] font-semibold text-muted-foreground/70 uppercase tracking-wider items-center">
          <span>Label</span>
          <span>Env / Project</span>
          <span>Created By</span>
          <span className="text-center">Expiry</span>
          <span className="text-center">Views</span>
          <span className="text-center">Status</span>
          <span />
        </div>

        {/* Table rows */}
        {PREVIEW_SHARED.map((item, i) => (
          <div
            key={item.label}
            className={`grid grid-cols-[1.4fr_1.6fr_1fr_0.7fr_0.5fr_0.6fr_0.3fr] gap-3 px-4 py-3 border-b border-border/10 items-center hover:bg-muted/[0.03] transition-colors dshb-fade-in ${
              isVisible ? "dshb-animate" : ""
            }`}
            style={stagger(4 + i)}
          >
            <span className="text-[10px] font-semibold truncate">{item.label}</span>
            <span className="text-[9px] text-muted-foreground truncate">{item.envProject}</span>
            <div className="flex items-center gap-1.5">
              <div className="h-4 w-4 rounded-full bg-gradient-to-br from-primary/60 to-primary/30 flex items-center justify-center">
                <span className="text-[6px] font-bold text-primary-foreground">
                  {item.createdBy[0]}
                </span>
              </div>
              <span className="text-[9px] text-muted-foreground">{item.createdBy}</span>
            </div>
            <span className="text-[9px] text-muted-foreground text-center">{item.expiry}</span>
            <div className="flex items-center justify-center">
              <div className="h-4 w-4 rounded-full bg-muted/20 flex items-center justify-center">
                <span className="text-[7px] font-bold text-muted-foreground">{item.views}</span>
              </div>
            </div>
            <span className="text-[8px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-600/10 dark:bg-emerald-400/10 px-2 py-0.5 rounded-full w-fit mx-auto">
              {item.status}
            </span>
            <button className="text-muted-foreground/40 justify-self-end" tabIndex={-1}>
              <MoreHorizontal className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
