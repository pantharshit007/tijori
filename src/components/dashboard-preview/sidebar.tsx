import {
  FolderOpen,
  KeyRound,
  LayoutDashboard,
  Settings,
  Share2,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PreviewPanelId, PreviewSidebarItem, PreviewStaggerFn } from "@/lib/types";

const SIDEBAR_NAV: PreviewSidebarItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", panelId: "dashboard" },
  { icon: Share2, label: "Shared", panelId: "shared" },
  { icon: FolderOpen, label: "All Projects", panelId: "allProjects" },
];

export function Sidebar({
  isVisible,
  activePanel,
  onPanelChange,
  stagger,
}: {
  isVisible: boolean;
  activePanel: PreviewPanelId;
  onPanelChange: (p: PreviewPanelId) => void;
  stagger: PreviewStaggerFn;
}) {
  return (
    <div
      className={`w-52 shrink-0 border-r border-border/30 bg-muted/[0.04] flex flex-col justify-between dshb-slide-in-left ${
        isVisible ? "dshb-animate" : ""
      }`}
    >
      <div>
        {/* Logo */}
        <div className="px-4 py-3.5 flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center shadow-sm shadow-primary/20">
            <KeyRound className="size-4 text-primary-foreground" />
          </div>
          <div>
            <div className="text-xs font-bold leading-none">Tijori</div>
            <div className="text-[9px] text-muted-foreground leading-none mt-0.5">
              Secure Vault
            </div>
          </div>
        </div>

        {/* Nav */}
        <div className="px-2.5 mt-1">
          <div className="text-[9px] font-semibold text-muted-foreground/70 uppercase tracking-widest px-2 mb-2">
            Navigation
          </div>
          {SIDEBAR_NAV.map((item, i) => (
            <button
              key={item.label}
              onClick={() => onPanelChange(item.panelId)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[11px] mb-0.5 transition-all cursor-pointer ${
                activePanel === item.panelId
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:bg-muted/20"
              } dshb-fade-in ${isVisible ? "dshb-animate" : ""}`}
              style={stagger(i)}
            >
              <item.icon className="size-3.5" />
              {item.label}
            </button>
          ))}
        </div>

        {/* Usage */}
        <div className="px-2.5 mt-5">
          <div className="text-[9px] font-semibold text-muted-foreground/70 uppercase tracking-widest px-2 mb-2">
            Usage
          </div>
          <div
            className={`px-2.5 py-1.5 dshb-fade-in ${isVisible ? "dshb-animate" : ""}`}
            style={stagger(4)}
          >
            <div className="flex justify-between text-[9px] text-muted-foreground mb-1.5">
              <span>PROJECTS</span>
              <span>3 / ∞</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary/60 transition-all duration-1000"
                style={{ width: isVisible ? "25%" : "0%", transitionDelay: "800ms" }}
              />
            </div>
          </div>
          <div
            className={`px-2.5 py-1.5 mt-1 dshb-fade-in ${isVisible ? "dshb-animate" : ""}`}
            style={stagger(5)}
          >
            <div className="flex justify-between text-[9px] text-muted-foreground mb-1.5">
              <span>SHARED SECRETS</span>
              <span>NO LIMIT</span>
            </div>
          </div>
        </div>

        {/* Account */}
        <div className="px-2.5 mt-5">
          <div className="text-[9px] font-semibold text-muted-foreground/70 uppercase tracking-widest px-2 mb-2">
            Account
          </div>
          {[
            { label: "Profile", Icon: User },
            { label: "Settings", Icon: Settings },
          ].map(({ label, Icon }, i) => (
            <div
              key={label}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[11px] text-muted-foreground mb-0.5 dshb-fade-in ${
                isVisible ? "dshb-animate" : ""
              }`}
              style={stagger(6 + i)}
            >
              <Icon className="size-3.5" />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* User card */}
      <div
        className={cn(
          "border-t border-border/20 px-3.5 py-3 flex items-center gap-2.5 dshb-fade-in",
          isVisible && "dshb-animate",
        )}
        style={stagger(9)}
      >
        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/80 to-primary/40 flex items-center justify-center shadow-sm">
          <span className="text-[9px] font-bold text-primary-foreground">JD</span>
        </div>
        <div>
          <div className="text-[12px] text-left font-semibold leading-none">Jane Doe</div>
          <div className="text-[9px] text-muted-foreground leading-none mt-0.5">
            jane@acme.dev
          </div>
        </div>
      </div>
    </div>
  );
}
