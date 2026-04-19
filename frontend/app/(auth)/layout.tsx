/**
 * (auth)/layout.tsx
 *
 * Shared layout for all routes inside the (auth) route group
 * (i.e. /login and /register).
 *
 * Structure:
 *   ┌──────────────────────┬──────────────────────┐
 *   │   Form panel (white) │   Brand panel        │
 *   │   Left-aligned form  │   Diagonal gradient  │
 *   │   content via        │   near-black → purple│
 *   │   {children}         │   "FinWatch Zambia"  │
 *   │                      │   pinned to bottom   │
 *   └──────────────────────┴──────────────────────┘
 *
 * Responsive behaviour:
 *   - md+ : 50 / 50 split, both panels visible, full viewport height
 *   - <md  : right brand panel hidden; form panel fills the full screen
 */

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FinWatch Zambia — Auth',
  description: 'Sign in or create your FinWatch Zambia account.',
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    /*
     * Root container
     * min-h-screen ensures the split always fills the full viewport height.
     * flex row — left panel + right panel side by side on md+.
     */
    <div className="flex min-h-screen">

      {/* ── Left — Form panel ───────────────────────────────────────────── */}
      {/*
       * w-full on mobile (brand panel hidden) → md:w-1/2 on desktop.
       * Padding: generous on desktop, slightly tighter on mobile.
       * Content is top-left aligned (no centering).
       */}
      <div className="flex w-full flex-col bg-white px-8 pt-12 md:w-1/2 md:px-16 md:pt-20">
        {children}
      </div>

      {/* ── Right — Brand panel ─────────────────────────────────────────── */}
      {/*
       * Hidden on mobile (hidden md:flex).
       * Diagonal gradient: near-black (bottom-left) → vibrant purple (top-right)
       * with a lighter lavender feather at the far top-right corner — matching
       * the design mockup exactly.
       *
       * No inline styles: all expressed via Tailwind's bg-gradient-to-tr and
       * arbitrary colour stops.
       *
       * "FinWatch Zambia" + "by David & Denise" are horizontally centred and
       * pinned to the bottom of this panel via justify-end + pb-16.
       */}
      <div
        className={[
          'relative hidden md:flex md:w-1/2',
          'flex-col items-center justify-end pb-16',
          'bg-gradient-to-tr from-[#070010] via-[#3d0d9a] to-[#8b5cf6]',
        ].join(' ')}
        aria-hidden="true"
      >
        {/* Brand text block */}
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-3xl font-bold tracking-tight text-white">
            FinWatch Zambia
          </span>
          <span className="text-sm font-normal text-white/75">
            by David &amp; Denise
          </span>
        </div>
      </div>

    </div>
  )
}
