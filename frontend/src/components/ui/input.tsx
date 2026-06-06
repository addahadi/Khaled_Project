import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * IBM Carbon text-input
 * - Background: surface-1 (#f4f4f4)
 * - Border: 1px hairline all sides, no radius
 * - Focus: 2px IBM Blue ring (no offset — Carbon spec)
 * - Height: 48px (Carbon touch target)
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full",
          "bg-muted text-foreground",
          "border border-input px-4 py-3",
          "text-sm tracking-[0.16px] placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0",
          "disabled:cursor-not-allowed disabled:opacity-40",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
