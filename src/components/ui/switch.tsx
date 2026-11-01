import * as React from "react"

import { cn } from "@/lib/utils"

export interface SwitchProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked = false, onCheckedChange, onClick, role = "switch", type = "button", ...props }, ref) => (
    <button
      {...props}
      ref={ref}
      type={type}
      role={role}
      aria-checked={checked}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-muted",
        className,
      )}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) onCheckedChange?.(!checked)
      }}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
          checked ? "translate-x-4" : "translate-x-0",
        )}
      />
    </button>
  ),
)
Switch.displayName = "Switch"

export { Switch }
