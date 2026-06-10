# Subtle CSS Animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add subtle, one-shot CSS animations (live-data feedback, entrance polish, micro-interactions) per `docs/superpowers/specs/2026-06-09-subtle-css-animations-design.md`, on a repaired Tailwind v4 foundation.

**Architecture:** This project uses Tailwind v4 CSS-first config (`@import "tailwindcss"` + `@tailwindcss/vite`). The legacy `tailwind.config.mjs` is **dead config** — verified by grepping the production build: `animate-scale-in`, `animate-slide-down`, `animate-bounce-subtle`, `shadow-brand-*`, and the DaisyUI primary-color override produce **zero output**. Task 1 migrates the used parts into `@theme` in `src/styles/global.css` and deletes the config file. All new keyframes/easing live in `global.css`. Change-detection animations use a tiny `useValueChanged` Preact hook. The global `prefers-reduced-motion` override in `global.css` (lines 233–243) covers everything automatically.

**Tech Stack:** Astro + Preact + Tailwind v4 + DaisyUI 5, Vitest + @testing-library/preact (jsdom), Biome (tabs, double quotes).

**Deviations from spec (discovered during planning):**
- **B4 skeleton shimmer: DROPPED.** DaisyUI 5's `.skeleton` class already ships a gradient shimmer sweep (verified in built CSS: `animation:1.8s ease-in-out infinite skeleton` with `background-position` keyframes). The spec's premise (static pulse) was wrong.
- **A3 departed-train exit** uses the existing opacity-transition mechanism (which `TrainCard` relies on via `onTransitionEnd` → `onDepart`) extended with a `translateX` slide, instead of the `train-depart` keyframe. The keyframe approach would break the `transitionend` contract. `train-depart`, `train-arrive`, `fade-out`, `shimmer`, `slide-up`, `slide-down` keyframes all die with the config file (slide-up already has a working duplicate in global.css; slide-down's only consumer is converted to `@starting-style` in Task 9).
- **New foundation task (Task 1):** CSS-first migration, which also restores the DaisyUI brand primary `#8c4799` (production currently renders default indigo `oklch(45% .24 277.023)` for `checkbox-primary`, `bg-primary/5`, etc.).

**Conventions:** Tabs for indentation. Double quotes. Conventional commits. Do NOT add Co-Authored-By trailers. Run commands from the repo root `/Users/niko.salonen/Documents/GitHub/lahijunat.live`.

---

### Task 1: Migrate dead tailwind.config.mjs to CSS-first Tailwind v4

**Files:**
- Modify: `src/styles/global.css`
- Delete: `tailwind.config.mjs`

- [ ] **Step 1: Capture baseline build output for comparison**

Run: `pnpm run build && grep -c "scale-in" dist/_astro/*.css; grep -c "8c4799" dist/_astro/*.css`
Expected: `0` for scale-in (proves the config is dead today), some count (~31) for 8c4799 (hardcoded arbitrary values only).

- [ ] **Step 2: Add the `@theme` block, DaisyUI theme overrides, and easing custom properties to global.css**

In `src/styles/global.css`, insert directly after the `@custom-variant dark (&:where(.dark, .dark *));` line (line 4):

```css
/* DaisyUI built-in theme customization (brand primary) */
@plugin "daisyui/theme" {
	name: "light";
	default: true;
	--color-primary: #8c4799;
	--color-primary-content: #ffffff;
}

@plugin "daisyui/theme" {
	name: "dark";
	prefersdark: true;
	--color-primary: #8c4799;
	--color-primary-content: #ffffff;
}

/* Design tokens migrated from the former tailwind.config.mjs (dead under v4) */
@theme {
	--shadow-brand-soft: 0 2px 8px rgba(140, 71, 153, 0.08);
	--shadow-brand-medium: 0 4px 16px rgba(140, 71, 153, 0.12);
	--shadow-brand-strong: 0 8px 32px rgba(140, 71, 153, 0.16);

	--animate-scale-in: scale-in 0.2s ease-out;
	--animate-bounce-subtle: bounce-subtle 0.6s ease-in-out;
	--animate-time-update: time-update 0.6s ease-out;
	--animate-track-flash: track-flash 0.8s ease-out;
	--animate-favorite-pop: favorite-pop 0.25s var(--ease-spring) both;

	@keyframes scale-in {
		from {
			transform: scale(0.95);
			opacity: 0;
		}
		to {
			transform: scale(1);
			opacity: 1;
		}
	}
	@keyframes bounce-subtle {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-4px);
		}
	}
	/* No 100% frame: the element animates back to its natural styles */
	@keyframes time-update {
		0% {
			opacity: 0.3;
		}
		35% {
			color: var(--color-time-flash);
			opacity: 1;
		}
	}
	@keyframes track-flash {
		0% {
			box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7);
		}
		70% {
			box-shadow: 0 0 0 8px rgba(245, 158, 11, 0);
		}
		100% {
			box-shadow: 0 0 0 0 rgba(245, 158, 11, 0);
		}
	}
	@keyframes favorite-pop {
		from {
			transform: scale(0);
		}
		to {
			transform: scale(1);
		}
	}
}
```

Then inside the existing `:root { ... }` block (after the `--gradient-surface` line), add:

```css
	/* Spring easing: linear() where supported, overshoot cubic-bezier elsewhere */
	--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
	--color-time-flash: #8c4799;
```

Inside the existing `.dark { ... }` block, add:

```css
	--color-time-flash: #b388ff;
```

After the `.dark { ... }` block, add:

```css
@supports (transition-timing-function: linear(0, 1)) {
	:root {
		--ease-spring: linear(0, 1.06 35%, 1.2 60%, 0.95 80%, 1);
	}
}
```

- [ ] **Step 3: Delete the dead config**

Run: `rm tailwind.config.mjs`
(`darkMode: "class"` is already handled by the `@custom-variant dark` line; `content` is auto-detected by v4; DaisyUI loads via `@plugin "daisyui"`; the theme overrides moved to Step 2. The unused keyframes `fade-out`, `shimmer`, `train-arrive`, `train-depart` and the duplicated `slide-up` are intentionally not migrated. `slide-down` is not migrated either — its sole consumer is converted in Task 9.)

- [ ] **Step 4: Verify the build restores the utilities**

Run: `pnpm run build && grep -c "scale-in" dist/_astro/*.css && grep -c -- "--color-primary:#8c4799\|--color-primary: #8c4799" dist/_astro/*.css && grep -c "bounce-subtle" dist/_astro/*.css && grep -c "brand-medium" dist/_astro/*.css`
Expected: every count ≥ 1. Note: `animate-slide-down` (used in `StationList.tsx` until Task 9) will NOT be in the output — it was already broken before this change, so nothing regresses.

- [ ] **Step 5: Run checks and tests**

Run: `pnpm run lint && pnpm run typecheck && pnpm run test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/styles/global.css tailwind.config.mjs
git commit -m "fix: migrate dead tailwind.config.mjs to CSS-first v4 config

Restores animate-scale-in, animate-bounce-subtle, shadow-brand-* and
the DaisyUI brand primary, all silently dropped since the v4 migration.
Adds time-update, track-flash, favorite-pop keyframes and --ease-spring."
```

---

### Task 2: `useValueChanged` hook (TDD)

**Files:**
- Create: `src/hooks/useValueChanged.ts`
- Test: `src/hooks/__tests__/useValueChanged.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/__tests__/useValueChanged.test.ts`:

```ts
import { renderHook } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { useValueChanged } from "../useValueChanged";

describe("useValueChanged", () => {
	it("returns false on initial render", () => {
		const { result } = renderHook(({ value }) => useValueChanged(value), {
			initialProps: { value: "10:00" },
		});
		expect(result.current).toBe(false);
	});

	it("returns false when re-rendered with the same value", () => {
		const { result, rerender } = renderHook(
			({ value }) => useValueChanged(value),
			{ initialProps: { value: "10:00" } },
		);
		rerender({ value: "10:00" });
		expect(result.current).toBe(false);
	});

	it("returns true after the value changes", () => {
		const { result, rerender } = renderHook(
			({ value }) => useValueChanged(value),
			{ initialProps: { value: "10:00" } },
		);
		rerender({ value: "10:05" });
		expect(result.current).toBe(true);
	});

	it("stays true after changing back to the original value", () => {
		const { result, rerender } = renderHook(
			({ value }) => useValueChanged(value),
			{ initialProps: { value: "10:00" } },
		);
		rerender({ value: "10:05" });
		rerender({ value: "10:00" });
		expect(result.current).toBe(true);
	});

	it("treats undefined initial values correctly", () => {
		const { result, rerender } = renderHook(
			({ value }: { value?: string }) => useValueChanged(value),
			{ initialProps: { value: undefined as string | undefined } },
		);
		expect(result.current).toBe(false);
		rerender({ value: "10:05" });
		expect(result.current).toBe(true);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test -- src/hooks/__tests__/useValueChanged.test.ts`
Expected: FAIL — cannot resolve `../useValueChanged`.

- [ ] **Step 3: Write the implementation**

Create `src/hooks/useValueChanged.ts`:

```ts
import { useRef } from "preact/hooks";

/**
 * Returns false until the watched value changes after the initial render,
 * then true for the rest of the component's life. Used to gate one-shot
 * "value updated" animations so they never fire on first paint.
 */
export function useValueChanged<T>(value: T): boolean {
	const prevRef = useRef(value);
	const changedRef = useRef(false);
	if (prevRef.current !== value) {
		changedRef.current = true;
		prevRef.current = value;
	}
	return changedRef.current;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run test -- src/hooks/__tests__/useValueChanged.test.ts`
Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useValueChanged.ts src/hooks/__tests__/useValueChanged.test.ts
git commit -m "feat: add useValueChanged hook for one-shot change animations"
```

---

### Task 3: A1 — Time-change pulse in TimeRow (TDD)

**Files:**
- Modify: `src/components/TimeRow.tsx`
- Test: `src/components/__tests__/TimeRow.test.tsx`

- [ ] **Step 1: Add the failing test**

Append to the existing `describe` block in `src/components/__tests__/TimeRow.test.tsx` (reuse the file's existing row fixtures if present; otherwise this self-contained fixture works):

```tsx
describe("time-change pulse", () => {
	const baseRow = {
		stationShortCode: "HKI",
		type: "DEPARTURE",
		scheduledTime: "2026-06-09T10:00:00.000Z",
		cancelled: false,
		trainStopping: true,
		commercialTrack: "1",
	} as Train["timeTableRows"][0];

	it("does not animate on initial render", () => {
		const { container } = render(<TimeRow departureRow={baseRow} />);
		const time = container.querySelector("time");
		expect(time?.className ?? "").not.toContain("animate-time-update");
	});

	it("animates the departure time when the displayed time changes", () => {
		const { container, rerender } = render(<TimeRow departureRow={baseRow} />);
		rerender(
			<TimeRow
				departureRow={{
					...baseRow,
					liveEstimateTime: "2026-06-09T10:05:00.000Z",
					differenceInMinutes: 5,
				}}
			/>,
		);
		const time = container.querySelector("time");
		expect(time?.className ?? "").toContain("animate-time-update");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test -- src/components/__tests__/TimeRow.test.tsx`
Expected: the new "animates the departure time..." test FAILS (class missing); "does not animate" passes.

- [ ] **Step 3: Implement in TimeRow**

In `src/components/TimeRow.tsx`:

Add the import:

```ts
import { useValueChanged } from "../hooks/useValueChanged";
```

After the `arrivalDisplayedTime` declaration, add:

```ts
	const departureTimeChanged = useValueChanged(displayedTime);
	const arrivalTimeChanged = useValueChanged(arrivalDisplayedTime);
```

Replace the departure `<time>` element:

```tsx
			<time
				key={displayedTime}
				datetime={displayedTime}
				class={departureTimeChanged ? "animate-time-update" : undefined}
			>
				{formatTime(displayedTime)}
			</time>
```

Replace the arrival `<time>` element:

```tsx
					<time
						key={arrivalDisplayedTime}
						datetime={arrivalDisplayedTime}
						class={arrivalTimeChanged ? "animate-time-update" : undefined}
					>
						{formatTime(arrivalDisplayedTime)}
					</time>
```

(The `key` swap forces a fresh DOM node per displayed value so the one-shot animation re-runs on every subsequent change, not just the first.)

- [ ] **Step 4: Run the full test file**

Run: `pnpm run test -- src/components/__tests__/TimeRow.test.tsx`
Expected: all PASS (existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/components/TimeRow.tsx src/components/__tests__/TimeRow.test.tsx
git commit -m "feat: pulse departure/arrival times when live estimates change"
```

---

### Task 4: A2 — Track-change flash

**Files:**
- Modify: `src/components/TrainCard.tsx:531-534` (`getTrackBadgeClass`)

- [ ] **Step 1: Add the flash class to the changed-track badge**

In `src/components/TrainCard.tsx`, `getTrackBadgeClass` (line ~531) currently returns for the changed side:

```ts
	const getTrackBadgeClass = (side: "departure" | "arrival") =>
		trackChangeInfo.changedSide === side && isTrackChanged
			? "badge-error badge-outline group-hover:bg-error/20 dark:group-hover:bg-error/30 group-hover:scale-105"
			: "bg-gray-100 text-gray-700 border border-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 group-hover:bg-gray-200 dark:group-hover:bg-gray-600 group-hover:scale-105";
```

Change only the first branch to prepend the animation:

```ts
	const getTrackBadgeClass = (side: "departure" | "arrival") =>
		trackChangeInfo.changedSide === side && isTrackChanged
			? "animate-track-flash badge-error badge-outline group-hover:bg-error/20 dark:group-hover:bg-error/30 group-hover:scale-105"
			: "bg-gray-100 text-gray-700 border border-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 group-hover:bg-gray-200 dark:group-hover:bg-gray-600 group-hover:scale-105";
```

No change-detection code is needed: the class is added at the exact render where `trackMemory` disagrees with the live track, and a one-shot CSS animation plays once when its class first appears on the element. The class persisting afterwards is inert.

- [ ] **Step 2: Run TrainCard tests**

Run: `pnpm run test -- src/components/__tests__/TrainCard.test.tsx`
Expected: PASS (the badge keeps all pre-existing classes; only an additional class was prepended). If a test snapshot/class assertion fails listing the badge classes, update it to include `animate-track-flash`.

- [ ] **Step 3: Commit**

```bash
git add src/components/TrainCard.tsx src/components/__tests__/TrainCard.test.tsx
git commit -m "feat: flash track badge once when a track change is detected"
```

(Omit the test file from `git add` if it needed no changes.)

---

### Task 5: A3 — Departed-train exit slide

**Files:**
- Modify: `src/components/TrainCard.tsx:763-776` (outer wrapper)

- [ ] **Step 1: Add a horizontal slide to the existing departure fade**

The outer wrapper (line ~765) already drives the fade with `transition-all duration-700` plus an inline `opacity`, and `onTransitionEnd` fires `onDepart`. Extend the inline style:

```tsx
			<div
				class={`rounded-xl transition-all duration-700 ease-in-out ${wrapperHighlightStyle} ${hasDeparted ? "grayscale opacity-50" : ""}`}
				style={{
					// Only use inline opacity when actively fading (overrides the opacity-50 class)
					opacity: hasDeparted && opacity < 1 ? opacity : undefined,
					// Slide out to the right while fading, like a train leaving the board
					transform:
						hasDeparted && opacity < 1 ? "translateX(2rem)" : undefined,
				}}
				onTransitionEnd={(e) => {
					if (e.target !== e.currentTarget) return;
					if (e.propertyName === "opacity" && hasDeparted && opacity === 0) {
						onDepart?.();
					}
				}}
			>
```

Only the `transform` line is new — `transition-all` already animates it, and the `onTransitionEnd` guard on `propertyName === "opacity"` keeps the `onDepart` contract intact.

- [ ] **Step 2: Run tests**

Run: `pnpm run test -- src/components/__tests__/TrainCard.test.tsx`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/TrainCard.tsx
git commit -m "feat: slide departed trains out to the right while fading"
```

---

### Task 6: B5 — Stagger cap + fill-mode + skeleton stagger fix

**Files:**
- Modify: `src/components/TrainList.tsx:816-828`
- Modify: `src/components/TrainListSkeleton.tsx:30-38`
- Modify: `src/components/TrainCardSkeleton.tsx:6`

- [ ] **Step 1: Cap the TrainList stagger and add backwards fill**

Task 1 revived `animate-scale-in`, which makes the pre-existing stagger (`index * 0.05s`, uncapped) live for the first time. Without `animation-fill-mode: backwards`, delayed cards paint fully visible and then re-run their entrance — a flash. In `src/components/TrainList.tsx` (line ~816), update the class and delay:

```tsx
								class={`transition-all duration-300 ease-in-out ${
									departedTrains.has(journeyKey)
										? ""
										: isHiddenByFilter
											? "opacity-0 max-h-0 overflow-hidden scale-95 pointer-events-none -mt-4"
											: "animate-scale-in [animation-fill-mode:backwards] opacity-100 max-h-[500px]"
								}`}
								style={{
									animationDelay:
										departedTrains.has(journeyKey) || isHiddenByFilter
											? "0s"
											: `${Math.min(index, 6) * 0.04}s`,
								}}
```

(Two changes: `[animation-fill-mode:backwards]` added, and `index * 0.05` → `Math.min(index, 6) * 0.04`.)

- [ ] **Step 2: Fix the skeleton stagger (currently undefined `stagger-N` classes)**

`TrainListSkeleton.tsx` line 34 uses `stagger-${...}` classes that are defined nowhere — dead code. Move the entrance animation from the card to the staggered wrapper. In `src/components/TrainListSkeleton.tsx` replace the card loop:

```tsx
				{Array.from({ length: count }, (_, index) => (
					<div
						key={`train-skeleton-item-${index}`}
						class="animate-scale-in [animation-fill-mode:backwards]"
						style={{ animationDelay: `${Math.min(index, 6) * 0.04}s` }}
					>
						<TrainCardSkeleton />
					</div>
				))}
```

And in `src/components/TrainCardSkeleton.tsx` remove `animate-scale-in` from the root (it now animates via the parent wrapper):

```tsx
		<output
			class="card bg-base-100 shadow-xl border border-base-300 rounded-xl block"
			aria-label="Loading train information"
		>
```

- [ ] **Step 3: Run tests and verify visually**

Run: `pnpm run test`
Expected: PASS.
Run: `pnpm run dev`, load the page — train cards and skeletons cascade in with a quick 40ms-step stagger; no flash-then-animate.

- [ ] **Step 4: Commit**

```bash
git add src/components/TrainList.tsx src/components/TrainListSkeleton.tsx src/components/TrainCardSkeleton.tsx
git commit -m "feat: cap entrance stagger at 6 cards and fix skeleton stagger"
```

---

### Task 7: C6 — Swap-button rotation

**Files:**
- Modify: `src/components/StationManager.tsx` (state near other `useState` calls; `handleSwap` at line ~482; both swap-button SVGs at lines ~665 and ~745)

- [ ] **Step 1: Add rotation state**

In `StationManager.tsx`, next to the component's other `useState` declarations, add:

```tsx
	const [swapRotation, setSwapRotation] = useState(0);
```

At the very top of the `handleSwap` callback body (line ~482, before any guards that return early are fine to keep above it — place it after the existing early-return guards so a disabled swap doesn't spin):

```tsx
		setSwapRotation((prev) => prev + 180);
```

- [ ] **Step 2: Rotate both swap icons**

Both swap buttons (mobile, line ~665; desktop, line ~745) contain an identical `<svg>`. Add the same style prop to each:

```tsx
								<svg
									className="w-6 h-6"
									style={{
										transform: `rotate(${swapRotation}deg)`,
										transition: "transform 300ms var(--ease-spring)",
									}}
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
									aria-hidden="true"
								>
```

(Accumulating degrees instead of toggling 0/180 makes every press rotate the same direction. `--ease-spring` always resolves — Task 1 defines a cubic-bezier fallback.)

- [ ] **Step 3: Run tests**

Run: `pnpm run test -- src/components/__tests__/StationManager.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/StationManager.tsx
git commit -m "feat: rotate swap-direction icon with spring easing on press"
```

---

### Task 8: C7 — Favorite heart pop

**Files:**
- Modify: `src/components/TrainCard.tsx:878` (heart indicator)

- [ ] **Step 1: Add the pop animation to the heart badge**

In `src/components/TrainCard.tsx` (line ~878), the heart indicator renders when a train is favorited:

```tsx
											{isHighlighted && (
												<div class="absolute -top-0.5 -right-0.5 bg-error rounded-full p-1 shadow animate-favorite-pop">
```

Only `animate-favorite-pop` is added. It mounts with the element, so it pops every time a train becomes favorited (including the initial reveal of an already-favorited train on page load — an acceptable, charming touch). The `both` fill mode in `--animate-favorite-pop` prevents a flash at scale(1) before the animation starts.

- [ ] **Step 2: Run tests**

Run: `pnpm run test -- src/components/__tests__/TrainCard.test.tsx`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/TrainCard.tsx
git commit -m "feat: spring pop on favorite heart indicator"
```

---

### Task 9: M1 — `@starting-style` entries for toast and station dropdown

**Files:**
- Modify: `src/styles/global.css`
- Modify: `src/components/Toast.tsx:54`
- Modify: `src/components/StationList.tsx:261`

- [ ] **Step 1: Add entry-transition classes to global.css**

Append to `src/styles/global.css` (near the other animation utilities):

```css
/* Entry transitions via @starting-style (progressive enhancement).
   Unsupported browsers (pre Chrome 117 / Safari 17.5 / Firefox 129)
   simply show the element instantly. */
.toast-enter {
	transition:
		opacity 0.3s ease-out,
		transform 0.3s ease-out;
	@starting-style {
		opacity: 0;
		transform: translateY(1rem);
	}
}

.dropdown-enter {
	transition:
		opacity 0.25s ease-out,
		transform 0.25s ease-out;
	@starting-style {
		opacity: 0;
		transform: translateY(-0.5rem);
	}
}
```

- [ ] **Step 2: Use them**

`src/components/Toast.tsx` line 54 — replace `animate-slide-up` with `toast-enter`:

```tsx
						class={`alert ${alertClass[toast.type]} shadow-lg toast-enter text-sm py-2 px-4 min-h-0`}
```

`src/components/StationList.tsx` line 261 — replace `animate-slide-down` with `dropdown-enter`:

```tsx
						} max-h-[50vh] sm:max-h-60 overflow-y-auto flex-nowrap shadow-xl z-50 dropdown-enter`}
```

(`animate-slide-down` was a dead class before Task 1 and was deliberately not migrated; this removes its last reference. `animate-slide-up` in global.css stays — `TrainListSkeleton` still uses it.)

- [ ] **Step 3: Run tests**

Run: `pnpm run test -- src/components/__tests__/Toast.test.tsx src/components/__tests__/StationList.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/styles/global.css src/components/Toast.tsx src/components/StationList.tsx
git commit -m "feat: animate toast and dropdown entries via @starting-style"
```

---

### Task 10: M2 — `allow-discrete` display toggling for filtered train rows

**Files:**
- Modify: `src/styles/global.css`
- Modify: `src/components/TrainList.tsx:816-822`

- [ ] **Step 1: Add the row classes to global.css**

Append to `src/styles/global.css`:

```css
/* Train rows hidden by the slow-train filter. In browsers supporting
   transition-behavior: allow-discrete they reach display:none after the
   transition (removed from the a11y tree); elsewhere they collapse as before. */
.train-row {
	transition:
		opacity 0.3s ease-in-out,
		transform 0.3s ease-in-out,
		max-height 0.3s ease-in-out,
		margin 0.3s ease-in-out;
}

.train-row-hidden {
	opacity: 0;
	max-height: 0;
	transform: scale(0.95);
	margin-top: -1rem;
	overflow: hidden;
	pointer-events: none;
}

@supports (transition-behavior: allow-discrete) {
	.train-row {
		transition-property: opacity, transform, max-height, margin, display;
		transition-behavior: allow-discrete;
	}
	.train-row-hidden {
		display: none;
	}
	.train-row:not(.train-row-hidden) {
		@starting-style {
			opacity: 0;
			transform: scale(0.95);
		}
	}
}
```

- [ ] **Step 2: Switch TrainList rows to the new classes**

In `src/components/TrainList.tsx` (line ~816, as left by Task 6), replace the wrapper class expression:

```tsx
								class={`train-row ${
									departedTrains.has(journeyKey)
										? ""
										: isHiddenByFilter
											? "train-row-hidden"
											: "animate-scale-in [animation-fill-mode:backwards] max-h-[500px]"
								}`}
```

(`transition-all duration-300 ease-in-out` moves into `.train-row`; the Tailwind utility soup for the hidden state becomes `.train-row-hidden`; `opacity-100` was redundant. `max-h-[500px]` must stay on visible rows so `max-height` can transition.)

- [ ] **Step 3: Run tests and verify visually**

Run: `pnpm run test`
Expected: PASS.
Run: `pnpm run dev` — toggle the "hide slow trains" lightning-bolt filter: rows collapse smoothly; in Chrome they end at `display: none` (verify in DevTools); toggling back animates them in.

- [ ] **Step 4: Commit**

```bash
git add src/styles/global.css src/components/TrainList.tsx
git commit -m "feat: filtered train rows reach display:none via allow-discrete"
```

---

### Task 11: C8 — Desktop hover lift on train cards

**Files:**
- Modify: `src/styles/global.css`
- Modify: `src/components/TrainCard.tsx:779`

- [ ] **Step 1: Add the lift class inside the existing `@media (hover: hover)` block**

In `src/styles/global.css`, inside the existing `@media (hover: hover) { ... }` block (line ~192), append:

```css
	.train-card-lift {
		transition:
			transform 150ms ease-out,
			box-shadow 150ms ease-out;
	}
	.train-card-lift:hover {
		transform: translateY(-1px);
		box-shadow:
			0 4px 14px rgba(0, 0, 0, 0.12),
			0 2px 4px rgba(0, 0, 0, 0.06);
	}
	.dark .train-card-lift:hover {
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
	}
```

(Unlayered CSS wins over Tailwind's layered utilities, so the hover shadow overrides the wrapper's arbitrary-value base shadow without `!important`.)

- [ ] **Step 2: Apply to the inner card wrapper**

In `src/components/TrainCard.tsx` line ~779 — the inner wrapper that owns the card's shadow/border (NOT the outer fade wrapper, whose `transition-all duration-700` would make hover sluggish; and not the swiping content, whose transform it would fight):

```tsx
				<div class="train-card-lift relative overflow-hidden rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.06)] border border-gray-200 dark:border-gray-600 dark:shadow-[0_4px_16px_rgba(0,0,0,0.4)]">
```

- [ ] **Step 3: Run tests**

Run: `pnpm run test -- src/components/__tests__/TrainCard.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/styles/global.css src/components/TrainCard.tsx
git commit -m "feat: subtle hover lift on train cards (pointer devices only)"
```

---

### Task 12: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full check suite**

Run: `pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run build`
Expected: all green.

- [ ] **Step 2: Confirm the new CSS is in the build**

Run: `grep -c "time-update\|track-flash\|favorite-pop\|starting-style\|allow-discrete\|ease-spring" dist/_astro/*.css`
Expected: count ≥ 6.

- [ ] **Step 3: Manual visual checklist (dev server, light + dark mode)**

Run: `pnpm run dev` and verify:
1. Initial load: skeletons then cards cascade in (stagger, no flash).
2. Time pulse: hard to trigger live — temporarily verify by editing a liveEstimateTime in devtools-paused state or trust the unit test.
3. Swap button: icon spins 180° with a spring settle, both mobile and desktop layouts.
4. Favorite a train (swipe or tap line badge): heart pops in with overshoot.
5. Toggle slow-train filter: rows collapse out / spring back.
6. Hover a card on desktop: 1px lift + shadow.
7. Toast (e.g. trigger a favorite toast): slides up via @starting-style.
8. Station dropdown: eases down on open.
9. DaisyUI primary is purple again: the slow-train filter checkbox (`checkbox-primary`) renders #8c4799, not indigo.
10. System Settings → Accessibility → Reduce Motion ON: everything appears instantly, no animation.

- [ ] **Step 4: Verify no stray changes**

Run: `git status`
Expected: clean tree (everything committed in Tasks 1–11).
