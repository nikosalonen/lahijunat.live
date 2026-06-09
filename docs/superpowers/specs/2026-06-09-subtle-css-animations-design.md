# Subtle CSS Animations — Design

**Date:** 2026-06-09
**Status:** Approved scope, pending spec review

## Goal

Add stylish but subtle CSS animations across the app. All animations are
one-shot or interaction-triggered — the existing `soft-blink` remains the only
looping attention animation so it keeps its meaning. Everything is covered by
the existing global `prefers-reduced-motion` override in `src/styles/global.css`.

## Scope

### Pack A — Live-data feedback

**A1. Time-change pulse** (`src/components/TimeRow.tsx`)
When the displayed time changes (live estimate updated), the `<time>` element
plays a one-shot highlight: text color flashes to primary then settles
(~600ms). Implementation: track the previous displayed string with a ref;
when it changes, re-render with a changing `key` so the CSS animation
restarts. New keyframe `time-update` (color + slight opacity dip).

**A2. Track-change flash** (`src/components/TrainCard.tsx`, track badge ~line 991)
When the track value changes after initial render, the badge plays one soft
amber `box-shadow` ring pulse (~800ms, one-shot). Same previous-value-ref
technique as A1. New keyframe `track-change-flash`. No flash on first render.

**A3. Departed-train exit** (`src/components/TrainList.tsx` ~line 816)
Departed trains currently collapse via a `max-h` transition. Replace the
plain collapse with the already-defined but unused `train-depart` keyframe
(slide right + fade), followed by the height collapse. The unmount delay mechanism that
already exists in TrainList is reused; only the classes change.

### Pack B — Loading & entrance polish

**B4. Skeleton shimmer** (`TrainCardSkeleton.tsx`, `TrainListSkeleton.tsx`,
`StationListSkeleton.tsx`)
Replace static `animate-pulse` blocks with the existing unused `shimmer`
keyframe: a gradient sweep (`background-position` animation over a
200%-width gradient). Works in light and dark mode via semi-transparent
white/black stops.

**B5. Staggered card entrance** (`src/components/TrainList.tsx`)
Train cards entering on initial load animate with the existing `scale-in`,
each delayed by `animation-delay: calc(var(--card-index) * 40ms)`, index
capped at 6 so late cards don't lag. `--card-index` set via inline style.
Applies on list (re)load, not on every refresh re-render.

### Pack C — Micro-interactions

**C6. Swap-button rotation** (`src/components/StationManager.tsx`, swap
buttons ~lines 662 and 742)
The swap-direction button's icon rotates 180° each press
(`transition-transform`, 300ms, rotation state toggles between 0 and 180).

**C7. Favorite pop** (`src/components/TrainCard.tsx`, favorite badge ~line 877)
When the heart indicator appears (train favorited), it plays a spring pop:
scale 0 → 1.15 → 1 (~250ms). Uses `linear()` spring easing (M3) with an
`ease-out` fallback.

**C8. Card hover lift** (`src/components/TrainCard.tsx`)
Desktop only, inside `@media (hover: hover)` (matching the existing
`station-option` pattern in global.css): train cards get
`translateY(-1px)` + one shadow step up, 150ms. Must not fight the
existing swipe-to-favorite transform on the inner element — applied to the
outer card wrapper.

### Modern CSS (progressive enhancement)

**M1. `@starting-style` entries** — Toast (`Toast.tsx`) and the station
dropdown (`StationList.tsx` ~line 261) animate in via transitions from
`@starting-style` instead of keyframe classes. Older browsers
(pre Chrome 117 / Safari 17.5 / Firefox 129) show them instantly.

**M2. `transition-behavior: allow-discrete` exits** — dropdown close and
toast dismiss transition out before `display: none` takes effect, removing
the need for JS unmount timers where the element is display-toggled (not
unmounted). Where Preact unmounts the node (toasts), keep the existing
state-delay approach; allow-discrete is applied only to display-toggled
elements.

**M3. `linear()` spring easing** — a CSS custom property
`--ease-spring: linear(0, 1.2 60%, 0.95 80%, 1)` defined in global.css,
used by C6 and C7. Wrapped in `@supports (transition-timing-function:
linear(0, 1))` with `ease-out` as the declared fallback.

## Out of scope (explicitly deferred)

- View Transitions API for list reshuffles
- `interpolate-size: allow-keywords` height-auto animation
- Scroll-driven header shadow (`animation-timeline: scroll()`)

## Architecture notes

- New keyframes live in `tailwind.config.mjs` alongside the existing ones
  when they're simple transform/opacity (`time-update`,
  `track-change-flash`, `favorite-pop`); gradient-based shimmer styling and
  `@starting-style` / `@supports` blocks live in `src/styles/global.css`
  (Tailwind config can't express those).
- A1/A2 share a tiny `usePrevious`-style hook (new
  `src/hooks/useValueChanged.ts`): returns true for one render cycle when
  the watched value changes after mount. Unit-testable in isolation.
- Cleanup: delete the unused `fade-out` and `train-arrive` keyframes from
  `tailwind.config.mjs` (`train-depart` becomes used by A3; the others stay
  dead). If `train-arrive` proves useful for B5 it may be used instead of
  deleted — decided at implementation time, but no unused keyframes remain
  at the end.

## Error handling

Pure CSS — no runtime failure modes. The only logic is change detection
(`useValueChanged`), which defaults to "no animation" when in doubt (first
render, undefined values, cancelled rows).

## Testing

- Unit tests (Vitest) for `useValueChanged` and for the class-toggle logic
  in TimeRow/TrainCard (assert the one-shot animation class appears on
  value change and not on first render).
- Existing component tests must keep passing (`pnpm run test`).
- Visual verification of each animation in the dev server, light + dark
  mode, plus a `prefers-reduced-motion` spot check.
