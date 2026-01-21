import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "./ui/button";
import { useSidebar } from "./ui/sidebar";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

export function SidebarThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { state } = useSidebar();

  const renderButton = (themeType: typeof theme) => {
    const icons = {
      system: <Monitor className="h-4 w-4" />,
      light: <Sun className="h-4 w-4" />,
      dark: <Moon className="h-4 w-4" />,
    };
    const titles = {
      system: "System theme",
      light: "Light theme",
      dark: "Dark theme",
    };
    return (
      <Button
        onClick={() => setTheme(themeType)}
        variant={"ghost"}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
          theme === themeType
            ? "bg-sidebar-primary text-sidebar-primary-foreground"
            : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent-foreground/10"
        )}
        title={titles[themeType]}
      >
        {icons[themeType]}
      </Button>
    );
  };

  return (
    <div className="flex justify-center">
      <div className="flex items-center justify-center gap-1 rounded-lg bg-sidebar-accent p-1 ">
        {state === "collapsed" ? (
          renderButton(theme)
        ) : (
          <>
            {renderButton("system")}
            {renderButton("light")}
            {renderButton("dark")}
          </>
        )}
      </div>
    </div>
  );
}
