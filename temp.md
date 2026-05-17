Revise the institutional portal registration flow by converting the current single-page registration form into a structured multi-step onboarding experience with the following requirements:

1. Registration Flow Structure
   - Replace the current fully expanded registration form with a phased multi-step registration flow.
   - The flow should remain concise, professional, and efficient without becoming overly segmented or tedious.
   - Organize the registration process into the following logical phases:

   Step 1 — Access Verification
   - Invitation Code
   - Designated Role

   Step 2 — Professional Identity
   - Professional Title
   - Full Name
   - Email Address

   Step 3 — Account Security
   - Password
   - Confirm Password

2. Step Progression Logic
   - Users should only proceed to the next phase after the current step validates successfully.
   - Preserve entered values when navigating between steps.
   - Prevent accidental data loss during navigation, refreshes, or responsive layout changes while the session remains active.

3. Step Counter / Progress Indicator
   - Add a clean and modern step progress indicator that updates dynamically as the user advances through the registration flow.
   - The step counter must:
     - Clearly indicate the current active step
     - Show completed steps appropriately
     - Match the existing design system and visual language of the platform
     - Remain subtle, professional, and consistent with the institutional portal styling
   - Example structure:
     - Step 1 of 3 — Access Verification
     - Step 2 of 3 — Professional Identity
     - Step 3 of 3 — Account Security

4. Transition Animations
   - Implement smooth modern transitions between registration phases.
   - When progressing between steps:
     - The current phase should subtly slide left while fading out.
     - The incoming phase should smoothly fade in while slightly sliding in from the right.
   - Transitions should feel polished, lightweight, and professional rather than overly animated.
   - Ensure animations remain performant across desktop and mobile devices.
   - Avoid abrupt content replacement or jarring layout shifts.

5. Desktop Layout Requirements
   - On desktop view:
     - The multi-step registration flow must remain confined to the existing left-side registration/form section only.
     - Do not expand the registration flow to take over the entire screen.
     - Preserve the current split-screen layout and surrounding visual structure.
   - Ensure the right-side visual/content section remains intact and unaffected.

6. Mobile Layout Requirements
   - On mobile view:
     - The registration flow may occupy the full screen width for better usability and responsiveness.
   - Maintain clean spacing, proper vertical flow, and touch-friendly interactions across all steps.

7. Responsive Behavior
   - Ensure the multi-step registration experience adapts correctly across:
     - Desktop
     - Tablet
     - Mobile
   - Prevent overflow, clipping, compressed fields, broken spacing, or inconsistent alignment in any responsive state.

8. Validation and UX Behavior
   - Implement validation logically per step rather than validating the entire registration form at once.
   - Use smooth inline validation feedback without disrupting the layout.
   - Preserve accessibility, readability, and keyboard navigation behavior.

9. UI Preservation and Stability
   - Do not compact, collapse, break, or unnecessarily restructure the existing institutional portal registration UI.
   - Preserve:
     - Existing branding
     - Layout proportions
     - Design consistency
     - Typography
     - Spacing system
     - Theme compatibility
     - Responsive behavior
   - Ensure the new phased registration system integrates naturally into the current interface without introducing regressions or visual inconsistencies.
