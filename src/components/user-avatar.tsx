import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface UserAvatarProps {
  /** URL to the user's profile image */
  src?: string;
  /** Full name of the user (used for alt text and fallback) */
  name?: string;
  /** Size variant for the avatar */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Whether to show a tooltip with the user's name on hover */
  showTooltip?: boolean;
  /** Custom tooltip content (defaults to first name) */
  tooltipContent?: React.ReactNode;
  /** Additional class names for the avatar container */
  className?: string;
  /** Whether to show a border around the avatar */
  bordered?: boolean;
  /** Whether to show a ring effect on hover */
  hoverRing?: boolean;
}

const sizeClasses = {
  xs: "h-5 w-5",
  sm: "h-6 w-6",
  md: "h-7 w-7",
  lg: "h-8 w-8",
  xl: "h-10 w-10",
} as const;

const textSizeClasses = {
  xs: "text-[8px]",
  sm: "text-[9px]",
  md: "text-[10px]",
  lg: "text-[11px]",
  xl: "text-xs",
} as const;

/**
 * A reusable user avatar component with optional tooltip.
 * Displays the user's profile image with a fallback to initials.
 */
export function UserAvatar({
  src,
  name,
  size = "md",
  showTooltip = true,
  tooltipContent,
  className,
  bordered = true,
  hoverRing = true,
}: UserAvatarProps) {
  const firstName = name?.split(" ")[0] || "Unknown";
  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  const avatarElement = (
    <Avatar
      className={cn(
        sizeClasses[size],
        bordered && "border",
        hoverRing && "ring-offset-background transition-all hover:ring-2 hover:ring-accent",
        className
      )}
    >
      <AvatarImage src={src} alt={name} />
      <AvatarFallback className={cn(textSizeClasses[size], "bg-muted/50 font-bold")}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );

  if (!showTooltip) {
    return avatarElement;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{avatarElement}</TooltipTrigger>
        <TooltipContent>
          {tooltipContent || <p className="text-xs font-medium">{firstName}</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
