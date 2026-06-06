import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * IBM Carbon button system
 * Corners: 0px (square) — enforced by --radius: 0rem
 * Padding: 12px 64px 12px 16px (Carbon spec: extra right padding for the arrow icon space)
 * Font: 14px weight-400 letter-spacing 0.16px
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "text-sm font-normal tracking-[0.16px]",
    "transition-colors duration-100",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        /* button-primary: IBM Blue solid */
        default:
          "bg-primary text-primary-foreground hover:bg-[#0050e6] active:bg-[#002d9c]",

        /* button-danger: Carbon red-60 */
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-[#ba1b23] active:bg-[#750e13]",

        /* button-tertiary: white bg, IBM Blue border + text */
        outline:
          "border border-primary bg-background text-primary hover:bg-primary hover:text-primary-foreground active:bg-[#002d9c]",

        /* button-secondary: charcoal */
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[#393939] active:bg-[#262626]",

        /* button-ghost: transparent until hover */
        ghost:
          "text-primary bg-transparent hover:bg-primary/10 active:bg-primary/20",

        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        /* Carbon default: 48px touch target */
        default: "h-12 px-4 py-3",
        /* Carbon small: 32px */
        sm:      "h-8 px-3 text-xs",
        /* Carbon large: 64px */
        lg:      "h-16 px-6 text-base",
        icon:    "h-12 w-12",
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
