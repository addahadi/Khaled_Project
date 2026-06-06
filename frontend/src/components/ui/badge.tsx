import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * IBM Carbon badge / tag
 * - Square corners (2px only for small badges per Carbon spec)
 * - No border by default on colored variants
 */
const badgeVariants = cva(
  "inline-flex items-center px-2.5 py-0.5 text-xs font-normal tracking-[0.32px] transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border border-transparent",
        secondary:
          "bg-muted text-muted-foreground border border-border",
        destructive:
          "bg-destructive/10 text-destructive border border-destructive/20",
        outline:
          "border border-border text-foreground bg-transparent",
        success:
          "bg-[#defbe6] text-[#0e6027] border border-[#a7f0ba]",
        warning:
          "bg-[#fdf1da] text-[#a2680a] border border-[#fdd13a]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
