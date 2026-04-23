import { useCallback, useEffect, useRef, useState } from "react";
import type { PreviewPanelId } from "@/lib/types";
import { DesktopPreview } from "./desktop-preview";
import { MobilePreview } from "./mobile-preview";

export function DashboardPreview() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [activePanel, setActivePanel] = useState<PreviewPanelId>("dashboard");
  const hasAnimatedRef = useRef(false);

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

  const stagger = useCallback(
    (i: number) =>
      hasAnimatedRef.current ? { animationDelay: "0ms" } : { animationDelay: `${400 + i * 100}ms` },
    []
  );

  return (
    <div ref={containerRef} className="mt-16 relative mx-auto max-w-6xl px-4 md:px-0">
      {/* Ambient glow behind the preview */}
      <div className="absolute -inset-6 bg-primary/[0.03] rounded-3xl blur-3xl pointer-events-none" />

      <MobilePreview isVisible={isVisible} />

      <DesktopPreview
        isVisible={isVisible}
        activePanel={activePanel}
        onPanelChange={setActivePanel}
        stagger={stagger}
      />
    </div>
  );
}
