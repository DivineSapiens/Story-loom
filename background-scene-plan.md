# Background Scene — Animated Landing Screen

## Overview

Add a `BackgroundScene` component that renders decorative animated SVG creatures
(birds drifting across the upper third, bunnies hopping across the lower portion)
absolutely positioned behind the landing screen's form content. All shapes are
low-opacity amber/gray to match the existing dark theme. The component renders
nothing (or a static single frame) when `prefers-reduced-motion` is active.

**Scope:** landing screen only (`!hasTree` branch in `app/page.tsx`). The tree
canvas screen is untouched for now.

**No new dependencies.** Pure SVG + CSS keyframe animations, assembled in one
new file (`components/BackgroundScene.tsx`) plus additions to `app/globals.css`.

---

## Sub-Task 1 — CSS keyframes in `globals.css`

**Intent**
Define the four animation keyframes the creatures need, keeping them alongside
the existing keyframe block in `app/globals.css`.

**Expected Outcomes**
- `@keyframes bird-drift` — slow horizontal translate (0 → 110vw) for the
  left-to-right crossing motion.
- `@keyframes wing-flap` — subtle scaleY oscillation on the bird wing elements
  (0.7 → 1.2 → 0.7) creating a flap effect independent of the drift.
- `@keyframes bunny-hop` — combined translateX (0 → 110vw) AND translateY arc
  composed of 6-8 keyframe stops that create a series of parabolic hops
  (e.g. 0%: Y=0, 6%: Y=-28px, 12%: Y=0, 18%: Y=-20px, 24%: Y=0 … repeat with
  slight rhythm variation until 100%).
- All four keyframes sit inside the existing `/* KEYFRAMES */` section.
- The existing `prefers-reduced-motion` guard at the bottom of the file already
  kills all animations globally — no changes needed there.

**Todo List**
1. Open `app/globals.css`.
2. Below the `ink-drip` keyframe block, add `@keyframes bird-drift` (translateX
   from `-10vw` to `110vw` so the bird enters from off-screen left).
3. Add `@keyframes wing-flap` (scaleY 0.7 → 1.2 → 0.7, 2-beat).
4. Add `@keyframes bunny-hop` with ≥6 stops that produce a convincing hop-series
   arc over a full left-to-right crossing (~100% translateX travel).
5. Do **not** add utility classes in CSS — the `BackgroundScene` component will
   apply `animation:` inline via `style` props (easier to parameterise
   per-instance delay/duration without generating many Tailwind variants).

**Relevant Context**
- Existing keyframes in `app/globals.css` lines 14-46.
- `prefers-reduced-motion` guard: `app/globals.css` lines 164-172.

**Status:** [ ] pending

---

## Sub-Task 2 — `BackgroundScene` component

**Intent**
Create `components/BackgroundScene.tsx` — a fully self-contained presentational
component. It renders an `absolute inset-0` SVG viewport containing all creature
instances, wired up with the keyframes from Sub-Task 1.

**Expected Outcomes**
- File `components/BackgroundScene.tsx` exists and exports `BackgroundScene` as default.
- Renders nothing when `window.matchMedia('(prefers-reduced-motion: reduce)').matches`
  — detected via a `useReducedMotion` hook (a tiny `useEffect`/`useState` inside
  the component, no external library needed).
- **Birds:** 3 bird instances. Each bird is a single SVG `<g>` containing:
    - A body path (simple "W"-like flying-V silhouette, ~20×10 px viewBox).
    - Two wing sub-paths styled with `wing-flap` animation (different `animation-delay`
      on each wing so they alternate slightly).
  Each bird `<g>` sits at a different fixed `top` (8%, 15%, 22% of viewport height)
  and uses `bird-drift` with durations of 22 s, 27 s, 32 s respectively and
  staggered `animation-delay` (0 s, −8 s, −16 s so they start mid-journey).
  All birds: `opacity: 0.18`, `fill: #fbbf24` (amber-400).
- **Bunnies:** 2 bunny instances. Each bunny is a small SVG `<g>` containing a
  simple line-art bunny outline (body ellipse, head circle, ear pair, tail dot —
  all as `<path>` or primitive shapes, ~24×30 px).
  Each bunny uses `bunny-hop` with durations ~18 s and ~22 s, delays −4 s and
  −12 s (so one is already mid-crossing on page load). Fixed `bottom` placement:
  12% and 20% from bottom.
  Both bunnies: `opacity: 0.20`, `stroke: #a8a29e` (stone-400), `fill: none`,
  `strokeWidth: 1.5`.
- The outer container is `<div aria-hidden="true">` with inline style:
  `position: absolute, inset: 0, pointerEvents: none, zIndex: 0, overflow: hidden`.
- The landing screen's foreground form `<div>` gets `position: relative, zIndex: 1`
  to sit above the scene.

**Todo List**
1. Create `components/BackgroundScene.tsx`.
2. Add `useReducedMotion()` hook — `useState(false)`, `useEffect` reads
   `window.matchMedia('(prefers-reduced-motion: reduce)').matches` and sets state.
   Return `null` early if `reducedMotion` is true.
3. Define a `BirdSVG` sub-component that accepts `{ top, duration, delay }` and
   renders a positioned `<g>` with the bird silhouette + `wing-flap` on its wings,
   `bird-drift` on the outer `<g>`.
4. Define a `BunnySVG` sub-component that accepts `{ bottom, duration, delay }` and
   renders a positioned `<g>` with the line-art bunny silhouette + `bunny-hop`.
5. Compose the `BackgroundScene` default export with a wrapping `<div aria-hidden>`,
   an `<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">` filling
   it, containing 3 × `BirdSVG` + 2 × `BunnySVG`.
6. Keep the SVG shapes small and minimal — the goal is texture, not illustration.

**Relevant Context**
- No existing background component to reference; follow the existing `"use client"`
  pattern used in all `components/` files.
- Keyframes defined in Sub-Task 1.
- `QuillLoader` in `StoryNodeCard.tsx` is a good reference for inline SVG style.

**Status:** [ ] pending

---

## Sub-Task 3 — Wire into `app/page.tsx`

**Intent**
Mount `BackgroundScene` inside the landing screen div, making that div `relative`
and ensuring the foreground card stays above `z-0`.

**Expected Outcomes**
- The landing screen outer `<div>` (`app/page.tsx` line ~663) gains
  `relative overflow-hidden` Tailwind classes.
- `<BackgroundScene />` is inserted as the **first child** of that div, before the
  `flex flex-col gap-6` form card.
- The form card `<div className="w-full max-w-xl flex flex-col gap-6">` gains
  `relative z-10` so it sits above the scene.
- `import BackgroundScene from "@/components/BackgroundScene"` added at the top of
  `app/page.tsx`.
- The tree-canvas branch (`hasTree ? <StoryTree … /> : …`) is not changed — scene
  only shows on landing.

**Todo List**
1. Open `app/page.tsx`.
2. Add `import BackgroundScene from "@/components/BackgroundScene"` near the other
   component imports.
3. On the landing screen outer `<div>` (around line 663), add `relative overflow-hidden`
   to its className (it currently has only inline `style` for the gradient).
4. Insert `<BackgroundScene />` as the first child of that div.
5. Add `relative z-10` to the `"w-full max-w-xl flex flex-col gap-6"` div.

**Relevant Context**
- Landing screen div: `app/page.tsx` lines 662-737.
- All other component imports at the top of `app/page.tsx` lines 7-9.

**Status:** [ ] pending

---

## Sub-Task 4 — Validate

**Intent**
Confirm the feature builds cleanly, renders correctly, and respects
`prefers-reduced-motion`.

**Expected Outcomes**
- `npx tsc --noEmit` passes with no new errors.
- `npx next build` completes successfully.
- (Manual) Landing screen shows drifting birds and hopping bunnies.
- (Manual) Setting OS reduced-motion preference hides all creatures.

**Todo List**
1. Run `npx tsc --noEmit` — fix any type errors.
2. Run `npx next build` — fix any build errors.
3. Confirm no regressions to the tree canvas screen.

**Status:** [ ] pending
