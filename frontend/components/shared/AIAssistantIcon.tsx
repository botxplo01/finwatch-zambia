"use client";

/**
 * FinWatch Zambia - AIAssistantIcon Component
 *
 * Symmetrical, high-fidelity React component representing the custom AI Assistant.
 * Uses exact vector coordinates from Adobe Illustrator.
 * Uses viewBox="380 268 24 24" to crop and center the icon perfectly.
 * Supports dynamic size scaling, color inheritance (currentColor), and GPU-accelerated blinking.
 */

import React from "react";
import { cn } from "@/lib/utils";

interface AIAssistantIconProps {
  className?: string;
  size?: number | string;
  animate?: boolean;
}

export function AIAssistantIcon({
  className,
  size = 24,
  animate = false,
}: AIAssistantIconProps) {
  return (
    <svg
      id="AIAssistantIcon"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="380 268 24 24"
      width={size}
      height={size}
      className={cn("flex-shrink-0 select-none", className)}
    >
      {/* Outer face outline - Transparent interior, color adaptive stroke */}
      <path
        d="M401.4,281.99c0,5.14-3.87,5.14-9.01,5.14s-9.6,0-9.6-5.14,4.17-9.86,9.3-9.86,9.3,4.72,9.3,9.86Z"
        fill="none"
        stroke="currentColor"
        strokeMiterlimit={10}
        strokeWidth={2}
      />
      {/* Eyes Group - Filled with currentColor, optionally animated */}
      <g id="Eyes_Group">
        <rect
          x="388.33"
          y="277.87"
          width="1.71"
          height="4.65"
          rx=".85"
          ry=".85"
          fill="currentColor"
          className={cn(animate && "animate-eye-blink-left")}
        />
        <rect
          x="394.15"
          y="277.87"
          width="1.71"
          height="4.65"
          rx=".85"
          ry=".85"
          fill="currentColor"
          className={cn(animate && "animate-eye-blink-right")}
        />
      </g>
    </svg>
  );
}
