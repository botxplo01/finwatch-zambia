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

import React, { InputHTMLAttributes, memo } from 'react'
import { cn } from '@/lib/utils'

interface FloatingLabelInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Must be unique on the page — wires <label htmlFor> */
  id: string
  /** Visible label text; acts as the visual placeholder when unfocused + empty */
  label: string
}

export const FloatingLabelInput = memo(({
  id,
  label,
  type = 'text',
  className,
  disabled,
  ...props
}: FloatingLabelInputProps) => {
  return (
    <div className="relative pb-1 pt-6">
      <input
        id={id}
        type={type}
        placeholder=" "
        disabled={disabled}
        className={cn(
          'peer w-full bg-transparent pb-2 pt-0',
          'text-sm text-gray-900 dark:text-zinc-100',
          'border-b border-[#C8C8C8] dark:border-zinc-800',
          'focus:outline-none',
          'focus:border-primary',
          'placeholder:text-transparent',
          'transition-colors duration-200',
          disabled && 'cursor-not-allowed opacity-50',
          className
        )}
        aria-label={label}
        {...props}
      />

      <label
        htmlFor={id}
        className={cn(
          'pointer-events-none absolute left-0 top-6',
          'text-sm text-[#888888] dark:text-zinc-500',
          'select-none',
          'transition-all duration-200 ease-in-out',

          'peer-focus:top-0',
          'peer-focus:text-xs',
          'peer-focus:text-primary',

          'peer-[&:not(:placeholder-shown)]:top-0',
          'peer-[&:not(:placeholder-shown)]:text-xs',
          'peer-[&:not(:placeholder-shown)]:text-[#888888] dark:peer-[&:not(:placeholder-shown)]:text-zinc-500'
        )}
      >
        {label}
      </label>
    </div>
  )
})

FloatingLabelInput.displayName = 'FloatingLabelInput'
