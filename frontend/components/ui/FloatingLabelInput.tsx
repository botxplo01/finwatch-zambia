/**
 * FloatingLabelInput
 *
 * A fully CSS-driven floating label input component.
 * Uses Tailwind's `peer`, `peer-focus`, and the arbitrary variant
 * `peer-[&:not(:placeholder-shown)]` to animate the label between its
 * four visual states without any JavaScript state:
 *
 *   1. Empty + unfocused  → label sits on the border line (full size, grey)
 *   2. Focused            → label floats up and shrinks (purple, border turns purple)
 *   3. Filled + unfocused → label stays floated and shrunk (grey label, grey border)
 *   4. Disabled           → reduced opacity, pointer events disabled
 *
 * The `placeholder=" "` (single space) is the CSS hook for :placeholder-shown.
 * It is made invisible via `placeholder:text-transparent`.
 *
 * Do NOT replace this with shadcn/ui's <Input> — it does not support
 * the floating label pattern.
 */

import React, { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface FloatingLabelInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Must be unique on the page — wires <label htmlFor> */
  id: string
  /** Visible label text; acts as the visual placeholder when unfocused + empty */
  label: string
}

export function FloatingLabelInput({
  id,
  label,
  type = 'text',
  className,
  disabled,
  ...props
}: FloatingLabelInputProps) {
  return (
    /*
     * Wrapper
     * pt-6  → reserves 24 px of vertical room above the input for the
     *          floated label to occupy without overlapping content above.
     * pb-1  → small clearance below the border so the focus ring is visible.
     */
    <div className="relative pb-1 pt-6">
      <input
        id={id}
        type={type}
        /*
         * Single-space placeholder is the CSS hook for :placeholder-shown.
         * `placeholder:text-transparent` ensures it is never visible.
         */
        placeholder=" "
        disabled={disabled}
        className={cn(
          // Layout
          'peer w-full bg-transparent pb-2 pt-0',
          // Typography
          'text-sm text-gray-900 dark:text-zinc-100',
          // Border — bottom only; no box border
          'border-b border-[#C8C8C8] dark:border-zinc-800',
          // Remove browser default outlines; we supply our own via border
          'focus:outline-none',
          // On focus, switch border to brand primary
          'focus:border-primary',
          // Hide the space-placeholder from the user
          'placeholder:text-transparent',
          // Smooth border-colour transition
          'transition-colors duration-200',
          // Disabled state
          disabled && 'cursor-not-allowed opacity-50',
          className
        )}
        aria-label={label}
        {...props}
      />

      {/*
       * Floating label
       *
       * Default position  : top-6  (24 px — vertically aligned with input text)
       * Default size      : text-sm
       * Default colour    : #888888
       *
       * Floated position  : top-0  (0 px — sits in the reserved pt-6 space)
       * Floated size      : text-xs
       * Focus colour      : text-primary  (#6B17E9)
       * Filled-unfocused  : text-[#888888] (colour reverts; position stays floated)
       *
       * Transition order matters: peer-focus runs before peer-[&:not(:placeholder-shown)]
       * so the colour correctly reverts to grey when the field is filled but not focused.
       */}
      <label
        htmlFor={id}
        className={cn(
          // Positioning
          'pointer-events-none absolute left-0 top-6',
          // Typography — default (unfloated) state
          'text-sm text-[#888888] dark:text-zinc-500',
          // Prevent text selection of the label
          'select-none',
          // Smooth float animation
          'transition-all duration-200 ease-in-out',

          // ── Focused (regardless of whether the field has a value) ──────────
          'peer-focus:top-0',
          'peer-focus:text-xs',
          'peer-focus:text-primary',

          // ── Filled + unfocused (keep label floated; revert to grey) ─────────
          'peer-[&:not(:placeholder-shown)]:top-0',
          'peer-[&:not(:placeholder-shown)]:text-xs',
          'peer-[&:not(:placeholder-shown)]:text-[#888888] dark:peer-[&:not(:placeholder-shown)]:text-zinc-500'
        )}
      >
        {label}
      </label>
    </div>
  )
}
