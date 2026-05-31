"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void;
}

/**
 * Switch Component
 *
 * A custom, accessible toggle switch for form controls.
 * Adheres to the platform's minimalist design system.
 */
const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, checked, onCheckedChange, ...props }, ref) => {
    return (
      <label className="relative inline-flex items-center cursor-pointer group">
        <input
          type="checkbox"
          className="sr-only peer"
          ref={ref}
          checked={checked}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          {...props}
        />
        <div
          className={cn(
            "w-9 h-5 bg-gray-200 dark:bg-zinc-800 rounded-full peer transition-all duration-200",
            "peer-focus:ring-2 peer-focus:ring-purple-100 dark:peer-focus:ring-purple-900/40",
            "peer-checked:bg-purple-600",
            "after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all after:duration-200",
            "peer-checked:after:translate-x-full peer-checked:after:border-white",
            "group-active:scale-95 transition-transform",
            className
          )}
        />
      </label>
    );
  }
);

Switch.displayName = "Switch";

export { Switch };
