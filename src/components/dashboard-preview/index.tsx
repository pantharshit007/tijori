import { useCallback, useEffect, useRef, useState } from "react";
import { Sidebar } from "./sidebar";
import { VariablesPanel } from "./variables-panel";
import { SharedPanel } from "./shared-panel";
import { ProjectsPanel } from "./projects-panel";
import type { PreviewPanelId } from "@/lib/types";

/** Animated, interactive dashboard preview for the landing page hero section. */
export function DashboardPreview() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [activePanel, setActivePanel] = useState<PreviewPanelId>("dashboard");
  const hasAnimatedRef = useRef(false);

  // Intersection observer for scroll-triggered entrance
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          setTimeout(() => {
            hasAnimatedRef.current = true;
          }, 1400);
          obs.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // On first load use stagger; on panel switch use instant (no delay)
  const stagger = useCallback(
    (i: number) =>
      hasAnimatedRef.current ? { animationDelay: "0ms" } : { animationDelay: `${400 + i * 100}ms` },
    []
  );

  return (
    <div ref={containerRef} className="mt-16 relative mx-auto max-w-6xl">
      {/* Ambient glow behind the preview */}
      <div className="absolute -inset-6 bg-primary/[0.03] rounded-3xl blur-3xl pointer-events-none" />

      <div
        className={`relative rounded-2xl border border-border/40 bg-background/80 shadow-2xl shadow-black/10 dark:shadow-black/30 p-1.5 backdrop-blur-xl transition-all duration-1000 ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        {/* ── Browser chrome ── */}
        <div className="rounded-xl border border-border/30 bg-background overflow-hidden">
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

          {/* ── App layout: sidebar + main ── */}
          <div className="flex" style={{ minHeight: "520px" }}>
            <Sidebar
              isVisible={isVisible}
              activePanel={activePanel}
              onPanelChange={setActivePanel}
              stagger={stagger}
            />

            {/* ── Main content ── */}
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
    </div>
  );
}
