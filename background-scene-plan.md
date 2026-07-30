# fAIrytalee — Background Scene

Animated SVG landing screen background (`components/BackgroundScene.tsx`).

- **3 birds** drift left-to-right using `bird-drift` + `wing-flap` keyframes, opacity 0.18, amber-400 fill
- **2 bunnies** hop left-to-right using `bunny-hop` keyframe, opacity 0.20, stone-400 stroke
- All keyframes defined in `app/globals.css`
- Respects `prefers-reduced-motion` — renders nothing when reduced motion is active
- Mounted only on the landing screen (`!hasTree` branch in `app/page.tsx`)
- `aria-hidden="true"`, `pointerEvents: none` — purely decorative
