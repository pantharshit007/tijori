import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import {  cva } from "class-variance-authority"
import type {VariantProps} from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        expired:
          "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground text-amber-500 font-bold dark:font-normal border-amber-500/60 dark:border-amber-500/30",
        active: 
          "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground text-emerald-500 font-bold dark:font-normal border-emerald-500/60 dark:border-emerald-500/30",
        disabled:
          "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground text-zinc-500 font-bold dark:font-normal border-zinc-500/60 dark:border-zinc-500/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
