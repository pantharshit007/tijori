import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TutorialPlacement = "top" | "right" | "bottom" | "left";

type TutorialStep = {
  id: string;
  title: string;
  description: string;
  selector: string;
  placement?: TutorialPlacement;
};

type TutorialTour = {
  id: "dashboard" | "project";
  steps: TutorialStep[];
};

const DASHBOARD_STEPS: TutorialStep[] = [
  {
    id: "sidebar-nav",
    title: "Navigate Your Vault",
    description: "Use the sidebar to jump between Dashboard, Shared secrets, and all Projects.",
    selector: '[data-tutorial-id="sidebar-nav"]',
    placement: "right",
  },
  {
    id: "projects-section",
    title: "Your Projects",
    description: "Projects live here. Open one to manage environments and encrypted variables.",
    selector: '[data-tutorial-id="projects-section"]',
    placement: "bottom",
  },
  {
    id: "new-project",
    title: "Create Your First Project",
    description: "Start a new vault with a project, then add environments and keys.",
    selector: '[data-tutorial-id="new-project"]',
    placement: "left",
  },
  {
    id: "account-menu",
    title: "Account Settings",
    description: "Manage your profile and settings from this account section.",
    selector: '[data-tutorial-id="account-section"]',
    placement: "right",
  },
  {
    id: "tutorial-restart",
    title: "Restart This Tour Anytime",
    description: "Use this button in the top bar whenever you want a refresher.",
    selector: '[data-tutorial-id="tutorial-restart"]',
    placement: "bottom",
  },
];

const PROJECT_STEPS: TutorialStep[] = [
  {
    id: "project-unlock",
    title: "Unlock Secrets",
    description:
      "Click Unlock (or press U) to decrypt secrets. Your master key in Settings protects this passcode.",
    selector: '[data-tutorial-id="project-unlock"]',
    placement: "bottom",
  },
  {
    id: "project-tabs",
    title: "Project vs Shared",
    description: "Switch between this project's variables and any shared secrets.",
    selector: '[data-tutorial-id="project-tabs"]',
    placement: "bottom",
  },
  {
    id: "project-environments",
    title: "Multiple Environments",
    description: "Create and switch between environments for staging, prod, or custom setups.",
    selector: '[data-tutorial-id="project-environments"]',
    placement: "right",
  },
  {
    id: "project-collab",
    title: "Share & Invite",
    description: "Add teammates, manage settings, and share secrets from here.",
    selector: '[data-tutorial-id="project-collab"]',
    placement: "left",
  },
  {
    id: "tutorial-restart",
    title: "Restart This Tour Anytime",
    description: "Use this button in the top bar whenever you want a refresher.",
    selector: '[data-tutorial-id="tutorial-restart"]',
    placement: "bottom",
  },
];

function getTourForPath(pathname: string): TutorialTour | null {
  if (pathname === "/d/dashboard") {
    return { id: "dashboard", steps: DASHBOARD_STEPS };
  }
  if (pathname.startsWith("/d/project/")) {
    return { id: "project", steps: PROJECT_STEPS };
  }
  return null;
}

function getStoredCompletion(storageKey: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return Boolean(localStorage.getItem(storageKey));
  } catch {
    return true;
  }
}

function markCompleted(storageKey: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey, new Date().toISOString());
  } catch {
    // ignore storage failures
  }
}

type TutorialOverlayProps = {
  enabled?: boolean;
  restartSignal: number;
};

export function OnboardingTutorial({ enabled = true, restartSignal }: TutorialOverlayProps) {
  const location = useLocation();
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [popoverRect, setPopoverRect] = useState<DOMRect | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  const tour = useMemo(() => getTourForPath(location.pathname), [location.pathname]);
  const steps = useMemo(() => tour?.steps ?? [], [tour]);
  const storageKey = tour ? `tijori-onboarding-v1-${tour.id}` : "tijori-onboarding-v1";
  const step = steps[currentIndex];

  const findNextAvailable = (startIndex: number) => {
    for (let i = startIndex; i < steps.length; i += 1) {
      if (document.querySelector(steps[i].selector)) {
        return i;
      }
    }
    return -1;
  };

  const findPrevAvailable = (startIndex: number) => {
    for (let i = startIndex; i >= 0; i -= 1) {
      if (document.querySelector(steps[i].selector)) {
        return i;
      }
    }
    return -1;
  };

  const startTutorial = () => {
    if (!enabled || typeof window === "undefined") return;
    if (!tour || steps.length === 0) return;
    const nextIndex = findNextAvailable(0);
    if (nextIndex === -1) return;
    setCurrentIndex(nextIndex);
    setIsActive(true);
  };

  const stopTutorial = (completed: boolean) => {
    setIsActive(false);
    setCurrentIndex(0);
    setTargetRect(null);
    if (completed) {
      markCompleted(storageKey);
    }
  };

  const goToStep = (index: number) => {
    const nextIndex = findNextAvailable(index);
    if (nextIndex === -1) {
      stopTutorial(true);
      return;
    }
    setCurrentIndex(nextIndex);
  };

  const handleNext = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= steps.length) {
      stopTutorial(true);
      return;
    }
    goToStep(nextIndex);
  };

  const handleBack = () => {
    const prevIndex = findPrevAvailable(currentIndex - 1);
    if (prevIndex === -1) return;
    setCurrentIndex(prevIndex);
  };

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    if (!tour) return;
    if (getStoredCompletion(storageKey)) return;

    const isDev = typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV);
    if (isDev) {
      const sessionKey = `${storageKey}-session`;
      if (sessionStorage.getItem(sessionKey)) {
        return;
      }
      sessionStorage.setItem(sessionKey, "started");
    }

    startTutorial();
  }, [enabled, storageKey, tour]);

  useEffect(() => {
    if (!enabled || restartSignal === 0) return;
    if (!tour) return;
    startTutorial();
  }, [enabled, restartSignal, tour]);

  useEffect(() => {
    if (!isActive) return;
    if (!tour) {
      stopTutorial(false);
    }
  }, [tour, isActive]);

  useEffect(() => {
    if (!isActive) return;

    const updateMeasurements = () => {
      const target = step ? document.querySelector(step.selector) : null;
      if (!target) {
        const nextIndex = findNextAvailable(currentIndex + 1);
        if (nextIndex === -1) {
          stopTutorial(true);
        } else {
          setCurrentIndex(nextIndex);
        }
        return;
      }

      setTargetRect(target.getBoundingClientRect());
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };

    updateMeasurements();

    const handleKey = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        (event.target instanceof HTMLElement && event.target.isContentEditable)
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "escape") {
        stopTutorial(true);
      }
      if (key === "n") {
        event.preventDefault();
        handleNext();
      }
      if (key === "b") {
        event.preventDefault();
        handleBack();
      }
      if (key === "s") {
        event.preventDefault();
        stopTutorial(true);
      }
    };

    window.addEventListener("resize", updateMeasurements);
    window.addEventListener("scroll", updateMeasurements, true);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("resize", updateMeasurements);
      window.removeEventListener("scroll", updateMeasurements, true);
      window.removeEventListener("keydown", handleKey);
    };
  }, [isActive, step, currentIndex]);

  useEffect(() => {
    if (!isActive) return;
    if (!popoverRef.current) return;
    setPopoverRect(popoverRef.current.getBoundingClientRect());
  }, [isActive, currentIndex, targetRect, location.pathname]);

  if (!isActive || !step || typeof window === "undefined") {
    return null;
  }

  if (!targetRect) {
    return null;
  }

  const placement: TutorialPlacement = step.placement ?? "bottom";
  const popoverWidth = popoverRect?.width ?? 320;
  const popoverHeight = popoverRect?.height ?? 180;
  const offset = 14;

  let top = 0;
  let left = 0;

  if (placement === "top") {
    top = targetRect.top - popoverHeight - offset;
    left = targetRect.left + targetRect.width / 2 - popoverWidth / 2;
  }

  if (placement === "bottom") {
    top = targetRect.bottom + offset;
    left = targetRect.left + targetRect.width / 2 - popoverWidth / 2;
  }

  if (placement === "left") {
    top = targetRect.top + targetRect.height / 2 - popoverHeight / 2;
    left = targetRect.left - popoverWidth - offset;
  }

  if (placement === "right") {
    top = targetRect.top + targetRect.height / 2 - popoverHeight / 2;
    left = targetRect.right + offset;
  }

  const padding = 12;
  const clampedTop = Math.max(padding, Math.min(top, viewport.height - popoverHeight - padding));
  const clampedLeft = Math.max(padding, Math.min(left, viewport.width - popoverWidth - padding));

  const spotlightStyle = {
    top: Math.max(0, targetRect.top - 6),
    left: Math.max(0, targetRect.left - 6),
    width: Math.min(viewport.width, targetRect.width + 12),
    height: Math.min(viewport.height, targetRect.height + 12),
  };

  return createPortal(
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 bg-transparent" onClick={() => stopTutorial(true)} />
      <div
        className="absolute rounded-xl border border-white/20 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] ring-2 ring-white/60 pointer-events-none"
        style={spotlightStyle}
      />
      <div
        ref={popoverRef}
        role="dialog"
        aria-modal="true"
        className={cn(
          "absolute w-[320px] rounded-xl border border-border/60 bg-background/95 p-4 shadow-2xl",
          "backdrop-blur supports-[backdrop-filter]:bg-background/80"
        )}
        style={{ top: clampedTop, left: clampedLeft }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Step {currentIndex + 1} of {steps.length}
          </span>
          <button
            className="text-xs text-muted-foreground transition hover:text-foreground"
            onClick={() => stopTutorial(true)}
            type="button"
          >
            Skip
          </button>
        </div>
        <div className="mt-2 space-y-2">
          <h3 className="text-base font-semibold leading-tight text-foreground">{step.title}</h3>
          <p className="text-sm text-muted-foreground">{step.description}</p>
          <p className="text-[11px] text-muted-foreground">
            Shortcuts: <span className="font-mono">N</span> next,{" "}
            <span className="font-mono">B</span> back, <span className="font-mono">S</span> skip
          </p>
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={handleBack}
            disabled={currentIndex === 0}
            title="Previous step"
          >
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => stopTutorial(true)}
              title="End tutorial"
            >
              End
            </Button>
            <Button
              size="sm"
              className="h-8"
              onClick={handleNext}
              title={currentIndex === steps.length - 1 ? "Finish tutorial" : "Next step"}
            >
              {currentIndex === steps.length - 1 ? "Finish" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
