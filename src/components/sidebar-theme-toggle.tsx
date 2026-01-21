import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

export function SidebarThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center justify-center gap-1 rounded-lg bg-sidebar-accent p-1">
      <button
        onClick={() => setTheme("system")}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
          theme === "system"
            ? "bg-sidebar-primary text-sidebar-primary-foreground"
            : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent-foreground/10"
        )}
        title="System theme"
      >
        <Monitor className="h-4 w-4" />
      </button>
      <button
        onClick={() => setTheme("light")}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
          theme === "light"
            ? "bg-sidebar-primary text-sidebar-primary-foreground"
            : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent-foreground/10"
        )}
        title="Light theme"
      >
        <Sun className="h-4 w-4" />
      </button>
      <button
        onClick={() => setTheme("dark")}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
          theme === "dark"
            ? "bg-sidebar-primary text-sidebar-primary-foreground"
            : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent-foreground/10"
        )}
        title="Dark theme"
      >
        <Moon className="h-4 w-4" />
      </button>
    </div>
  );
}
