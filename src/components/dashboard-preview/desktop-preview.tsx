import type { PreviewPanelId, PreviewStaggerFn } from "@/lib/types";
import { Sidebar } from "./sidebar";
import { VariablesPanel } from "./variables-panel";
import { SharedPanel } from "./shared-panel";
import { ProjectsPanel } from "./projects-panel";

interface DesktopPreviewProps {
  isVisible: boolean;
  activePanel: PreviewPanelId;
  onPanelChange: (id: PreviewPanelId) => void;
  stagger: PreviewStaggerFn;
}

export function DesktopPreview({
  isVisible,
  activePanel,
  onPanelChange,
  stagger,
}: DesktopPreviewProps) {
  return (
    <div
      className={`hidden md:block relative rounded-2xl border border-border/40 bg-background/80 shadow-2xl shadow-black/10 dark:shadow-black/30 p-1.5 backdrop-blur-xl transition-all duration-1000 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
    >
      <div className="rounded-xl border border-border/30 bg-background overflow-hidden">
        {/* Browser Chrome */}
        <div className="h-10 bg-muted/20 border-b border-border/30 flex items-center px-4 gap-2">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]/70" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="bg-muted/40 rounded-md h-5.5 w-64 flex items-center justify-center">
              <span className="text-[10px] text-muted-foreground/80 tracking-wider font-mono">
                tijori.hrshit.in/d/
                {activePanel === "dashboard"
                  ? "project/acme"
                  : activePanel === "shared"
                    ? "shared"
                    : "dashboard"}
              </span>
            </div>
          </div>
          <div className="w-14" />
        </div>

        {/* App Layout */}
        <div className="flex" style={{ minHeight: "520px" }}>
          <Sidebar
            isVisible={isVisible}
            activePanel={activePanel}
            onPanelChange={onPanelChange}
            stagger={stagger}
          />

          <div className="flex-1 min-w-0 overflow-hidden">
            {activePanel === "dashboard" && (
              <VariablesPanel isVisible={isVisible} stagger={stagger} />
            )}
            {activePanel === "shared" && <SharedPanel isVisible={isVisible} stagger={stagger} />}
            {activePanel === "allProjects" && (
              <ProjectsPanel isVisible={isVisible} stagger={stagger} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
