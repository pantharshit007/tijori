interface MobilePreviewProps {
  isVisible: boolean;
}

export function MobilePreview({ isVisible }: MobilePreviewProps) {
  return (
    <div
      className={`md:hidden transition-all duration-1000 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
    >
      <div className="relative mx-auto max-w-5xl rounded-xl border border-border/50 bg-background/50 shadow-2xl p-1.5 backdrop-blur-md">
        <div className="rounded-lg border bg-background overflow-hidden shadow-inner">
          {/* Chrome header */}
          <div className="h-8 bg-muted/30 border-b flex items-center px-3 gap-2">
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-destructive/40" />
              <div className="w-2 h-2 rounded-full bg-amber-500/40" />
              <div className="w-2 h-2 rounded-full bg-green-500/40" />
            </div>
            <div className="flex-1 bg-muted/50 rounded h-4 max-w-[120px] mx-auto" />
          </div>

          {/* Content Skeleton */}
          <div className="p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="h-6 w-24 bg-muted/40 rounded animate-pulse" />
              <div className="h-6 w-16 bg-primary/20 rounded animate-pulse" />
            </div>

            {/* Stack cards on mobile instead of 3-col grid */}
            <div className="grid grid-cols-1 gap-3">
              <div className="h-24 bg-muted/20 rounded-lg border border-border/50" />
              <div className="h-24 bg-muted/20 rounded-lg border border-border/50" />
            </div>

            <div className="h-32 bg-muted/10 rounded-lg border border-border/50 border-dashed flex items-center justify-center">
              <div className="h-4 w-32 bg-muted/20 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
