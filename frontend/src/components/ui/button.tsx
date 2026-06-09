import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * DiagInfect Modern SaaS button system
 * Corners: var(--radius) = 10px
 * Font: 14px weight-500 Inter
 * Shadows on primary for depth
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "text-sm font-medium",
    "rounded-[var(--radius)]",
    "transition-all duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        /* Primary — brand blue with shadow */
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-[#0a5f9e] active:bg-[#085490] shadow-primary/20",

        /* Danger */
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-[#a01f26] active:bg-[#8a1a20]",

        /* Outlined — border + brand text */
        outline:
          "border border-primary bg-transparent text-primary hover:bg-primary/8 active:bg-primary/15",

        /* Secondary — dark slate */
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-[#2d3d56] active:bg-[#151f2e]",

        /* Ghost — subtle hover tint */
        ghost:
          "text-foreground bg-transparent hover:bg-muted hover:text-foreground active:bg-muted/80",

        link: "text-primary underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm:      "h-8 px-3 text-xs",
        lg:      "h-11 px-6 text-base",
        icon:    "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
