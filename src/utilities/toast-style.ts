import type { CSSProperties } from "react";
import type { ExternalToast } from "sonner";

type ToastStyleOptions = Pick<ExternalToast, "style" | "classNames" | "duration">;

const baseDuration = 3500;

const baseClassNames: NonNullable<ToastStyleOptions["classNames"]> = {
  toast: "toast-elevated",
  title: "font-semibold tracking-tight",
  description: "text-muted-foreground text-[13px]",
  closeButton:
    "bg-transparent border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
};

const baseStyle: CSSProperties = {
  background: "var(--card)",
  color: "var(--card-foreground)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  boxShadow: "0 4px 24px -4px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.03)",
  backdropFilter: "blur(8px)",
  padding: "14px 16px",
};

const makeVariant = (
  accentColor: string,
  glowColor: string,
  iconClass: string,
  duration = baseDuration
): ToastStyleOptions => ({
  duration,
  style: {
    ...baseStyle,
    borderLeft: `4px solid ${accentColor}`,
    backgroundImage: `radial-gradient(ellipse 120% 80% at 0% 50%, ${glowColor} 0%, transparent 60%)`,
  },
  classNames: {
    ...baseClassNames,
    icon: iconClass,
  },
});

export const toastStyle = {
  base: {
    duration: baseDuration,
    style: baseStyle,
    classNames: baseClassNames,
  } satisfies ToastStyleOptions,

  success: makeVariant("oklch(0.72 0.19 152)", "oklch(0.72 0.19 152 / 5%)", "text-emerald-500"),

  error: makeVariant("oklch(0.63 0.21 25)", "oklch(0.63 0.21 25 / 5%)", "text-red-500", 5000),

  info: makeVariant("oklch(0.62 0.16 250)", "oklch(0.62 0.16 250 / 5%)", "text-sky-500"),

  warning: makeVariant("oklch(0.80 0.18 84)", "oklch(0.80 0.18 84 / 5%)", "text-amber-500"),
};
