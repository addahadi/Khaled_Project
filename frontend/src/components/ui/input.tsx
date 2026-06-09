import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * DiagInfect Modern SaaS text input
 * - White bg, rounded corners, slate border
 * - Focus: brand blue ring with offset
 * - Height: 40px (h-10), comfortable and compact
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full",
          "rounded-[var(--radius)]",
          "bg-card text-foreground",
          "border border-input px-3 py-2",
          "text-sm placeholder:text-muted-foreground",
          "transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:border-transparent",
          "disabled:cursor-not-allowed disabled:opacity-50",
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
