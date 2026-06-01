# Passenger Info: Affected Station + Time-Critical Ordering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show affected station name(s) in the general announcements banner and order active passenger-info messages shortest-validity-first (most time-critical), then bump version and upgrade safe packages.

**Architecture:** Resolve station codes → localized names in `TrainList` (which holds the station list) and pass a resolver into `partitionActiveMessages`, which attaches `stationNames` to each `ActiveMessage` and sorts both pools by validity duration. The carousel renders the station line behind a `showStations` prop the banner sets.

**Tech Stack:** Astro + Preact + TypeScript, Vitest, Biome (tabs, double quotes), pnpm.

---

## File Structure

- `src/utils/passengerInfo.ts` — type change (`ActiveMessage.stationNames`), resolver param + sorting in `partitionActiveMessages`, new `validityDurationMs` helper. (Modify)
- `src/utils/translations.ts` — new `passengerInfoStation` key in fi/en/sv. (Modify)
- `src/components/PassengerInfoCarousel.tsx` — `showStations` prop + station line render. (Modify)
- `src/components/PassengerInfoBanner.tsx` — pass `showStations` to carousel. (Modify)
- `src/components/TrainList.tsx` — build code→name resolver, pass to `partitionActiveMessages`. (Modify)
- `src/utils/__tests__/passengerInfo.test.ts` — new tests for station names + ordering. (Modify)
- `package.json` — version bump. (Modify)

---

## Task 1: Add `stationNames` to `ActiveMessage` and populate it via a resolver

**Files:**
- Modify: `src/utils/passengerInfo.ts:36-43` (type), `src/utils/passengerInfo.ts:180-227` (function)
- Test: `src/utils/__tests__/passengerInfo.test.ts` (extend `partitionActiveMessages` describe block)

- [ ] **Step 1: Write the failing tests**

Add these tests inside the existing `describe("partitionActiveMessages", …)` block in `src/utils/__tests__/passengerInfo.test.ts` (after the last `it(...)`, before the closing `});` at line 308):

```ts
it("resolves station codes to localized names when a resolver is given", () => {
	const msg = makeMessage({
		id: "s1",
		trainNumber: null,
		stations: ["PSL", "HKI"],
		video: { text: { fi: "Raide on suljettu.", sv: null, en: null } },
	});
	const resolve = (code: string) =>
		({ PSL: "Pasila", HKI: "Helsinki" })[code] ?? code;
	const { general: g } = partitionActiveMessages(
		[msg],
		now,
		"fi",
		displayedKeys,
		resolve,
	);
	expect(g[0].stationNames).toEqual(["Pasila", "Helsinki"]);
});

it("omits stationNames when no resolver is given", () => {
	const msg = makeMessage({
		id: "s2",
		trainNumber: null,
		stations: ["PSL"],
		video: { text: { fi: "Raide on suljettu.", sv: null, en: null } },
	});
	const { general: g } = partitionActiveMessages([msg], now, "fi", displayedKeys);
	expect(g[0].stationNames).toBeUndefined();
});

it("omits stationNames when the stations list is empty", () => {
	const msg = makeMessage({
		id: "s3",
		trainNumber: null,
		stations: [],
		video: { text: { fi: "Yleinen", sv: null, en: null } },
	});
	const { general: g } = partitionActiveMessages(
		[msg],
		now,
		"fi",
		displayedKeys,
		(c) => c,
	);
	expect(g[0].stationNames).toBeUndefined();
});

it("keeps the raw code when the resolver does not know it", () => {
	const msg = makeMessage({
		id: "s4",
		trainNumber: null,
		stations: ["ZZZ"],
		video: { text: { fi: "Yleinen", sv: null, en: null } },
	});
	const { general: g } = partitionActiveMessages(
		[msg],
		now,
		"fi",
		displayedKeys,
		(c) => ({ PSL: "Pasila" })[c] ?? c,
	);
	expect(g[0].stationNames).toEqual(["ZZZ"]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm run test -- src/utils/__tests__/passengerInfo.test.ts`
Expected: FAIL — the 4 new tests fail (resolver arg ignored; `stationNames` is `undefined` where expected to equal an array). Existing tests still pass.

- [ ] **Step 3: Update the `ActiveMessage` type**

In `src/utils/passengerInfo.ts`, change the `ActiveMessage` interface (lines 36-43) to add the optional field:

```ts
export interface ActiveMessage {
	id: string;
	text: string;
	trainNumber: number | null;
	trainDepartureDate: string | null;
	startValidity: string;
	endValidity: string;
	stationNames?: string[];
}
```

- [ ] **Step 4: Add the resolver param and populate `stationNames`**

In `src/utils/passengerInfo.ts`, change the `partitionActiveMessages` signature (line 180) to accept an optional resolver:

```ts
export function partitionActiveMessages(
	messages: PassengerInformationMessage[],
	now: Date,
	lang: string,
	displayedTrainKeys: Set<string>,
	resolveStationName?: (code: string) => string,
): {
	general: ActiveMessage[];
	perTrain: Map<string, ActiveMessage[]>;
} {
```

Then, where the `active` object is built (currently lines 201-208), replace it with:

```ts
		const stationNames =
			resolveStationName && msg.stations.length > 0
				? msg.stations.map(resolveStationName)
				: undefined;

		const active: ActiveMessage = {
			id: msg.id,
			text: display.text,
			trainNumber: msg.trainNumber,
			trainDepartureDate: msg.trainDepartureDate,
			startValidity: msg.startValidity,
			endValidity: msg.endValidity,
			stationNames,
		};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm run test -- src/utils/__tests__/passengerInfo.test.ts`
Expected: PASS — all tests in the file pass, including the 4 new ones.

- [ ] **Step 6: Commit**

```bash
git add src/utils/passengerInfo.ts src/utils/__tests__/passengerInfo.test.ts
git commit -m "feat: attach resolved station names to active passenger messages"
```

---

## Task 2: Order messages shortest-validity-first

**Files:**
- Modify: `src/utils/passengerInfo.ts` (add `validityDurationMs` helper + sort before return)
- Test: `src/utils/__tests__/passengerInfo.test.ts` (extend `partitionActiveMessages` block)

- [ ] **Step 1: Write the failing tests**

Add these tests inside the `describe("partitionActiveMessages", …)` block (alongside the Task 1 tests):

```ts
it("orders general messages shortest-validity-first", () => {
	const long = makeMessage({
		id: "long",
		trainNumber: null,
		startValidity: "2026-06-01T00:00:00Z",
		endValidity: "2026-09-01T00:00:00Z",
		video: { text: { fi: "Pitkä", sv: null, en: null } },
	});
	const short = makeMessage({
		id: "short",
		trainNumber: null,
		startValidity: "2026-06-03T00:00:00Z",
		endValidity: "2026-06-03T23:59:00Z",
		video: { text: { fi: "Lyhyt", sv: null, en: null } },
	});
	const { general: g } = partitionActiveMessages(
		[long, short],
		now,
		"fi",
		displayedKeys,
	);
	expect(g.map((m) => m.id)).toEqual(["short", "long"]);
});

it("breaks ties by earlier startValidity", () => {
	const later = makeMessage({
		id: "later",
		trainNumber: null,
		startValidity: "2026-06-03T06:00:00Z",
		endValidity: "2026-06-03T10:00:00Z",
		video: { text: { fi: "Myöhempi", sv: null, en: null } },
	});
	const earlier = makeMessage({
		id: "earlier",
		trainNumber: null,
		startValidity: "2026-06-03T05:00:00Z",
		endValidity: "2026-06-03T09:00:00Z",
		video: { text: { fi: "Aiempi", sv: null, en: null } },
	});
	const { general: g } = partitionActiveMessages(
		[later, earlier],
		now,
		"fi",
		displayedKeys,
	);
	expect(g.map((m) => m.id)).toEqual(["earlier", "later"]);
});

it("sorts messages with invalid validity dates last", () => {
	const good = makeMessage({
		id: "good",
		trainNumber: null,
		startValidity: "2026-06-03T05:00:00Z",
		endValidity: "2026-06-03T07:00:00Z",
		video: { text: { fi: "Kunnollinen", sv: null, en: null } },
	});
	const bad = makeMessage({
		id: "bad",
		trainNumber: null,
		startValidity: "not-a-date",
		endValidity: "also-bad",
		video: { text: { fi: "Rikki", sv: null, en: null } },
	});
	const { general: g } = partitionActiveMessages(
		[bad, good],
		now,
		"fi",
		displayedKeys,
	);
	expect(g.map((m) => m.id)).toEqual(["good", "bad"]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm run test -- src/utils/__tests__/passengerInfo.test.ts`
Expected: FAIL — the 3 ordering tests fail (messages stay in input order).

- [ ] **Step 3: Add the `validityDurationMs` helper**

In `src/utils/passengerInfo.ts`, add this helper just above `partitionActiveMessages` (before line 176's doc comment):

```ts
/**
 * Validity-window length in milliseconds. Shorter windows are treated as more
 * time-critical and sorted first. Returns Infinity for unparseable dates so
 * malformed entries sort last instead of jumping to the front.
 */
function validityDurationMs(msg: ActiveMessage): number {
	const start = new Date(msg.startValidity).getTime();
	const end = new Date(msg.endValidity).getTime();
	if (Number.isNaN(start) || Number.isNaN(end)) return Number.POSITIVE_INFINITY;
	return end - start;
}

/**
 * Compare two active messages: shortest validity first, ties broken by the
 * earlier start. Invalid-date messages (Infinity duration) fall to the end.
 */
function byTimeCriticality(a: ActiveMessage, b: ActiveMessage): number {
	const durationDiff = validityDurationMs(a) - validityDurationMs(b);
	if (durationDiff !== 0) return durationDiff;
	const startA = new Date(a.startValidity).getTime();
	const startB = new Date(b.startValidity).getTime();
	if (Number.isNaN(startA) || Number.isNaN(startB)) return 0;
	return startA - startB;
}
```

- [ ] **Step 4: Sort both pools before returning**

In `src/utils/passengerInfo.ts`, replace the final `return { general, perTrain };` (line 226) with:

```ts
	general.sort(byTimeCriticality);
	for (const arr of perTrain.values()) arr.sort(byTimeCriticality);

	return { general, perTrain };
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm run test -- src/utils/__tests__/passengerInfo.test.ts`
Expected: PASS — all tests pass, including the 3 ordering tests.

- [ ] **Step 6: Commit**

```bash
git add src/utils/passengerInfo.ts src/utils/__tests__/passengerInfo.test.ts
git commit -m "feat: order passenger messages shortest-validity-first"
```

---

## Task 3: Add the `passengerInfoStation` translation key

**Files:**
- Modify: `src/utils/translations.ts` (fi, en, sv blocks)

- [ ] **Step 1: Add the key to all three languages**

In `src/utils/translations.ts`, add `passengerInfoStation` next to the other `passengerInfo*` keys in each language object. Finnish (near line 112, beside `passengerInfoValidity`):

```ts
		passengerInfoStation: "Asema",
```

English block (same relative position):

```ts
		passengerInfoStation: "Station",
```

Swedish block (same relative position):

```ts
		passengerInfoStation: "Station",
```

- [ ] **Step 2: Verify types compile**

Run: `pnpm run typecheck`
Expected: PASS — no errors. (The `TranslationKey` type derives from the fi object, so adding to all three keeps them aligned.)

- [ ] **Step 3: Commit**

```bash
git add src/utils/translations.ts
git commit -m "feat: add passengerInfoStation translation key"
```

---

## Task 4: Render the station line in the carousel behind a `showStations` prop

**Files:**
- Modify: `src/components/PassengerInfoCarousel.tsx:8-12` (Props), `:24-28` (signature), `:117-127` (render)

- [ ] **Step 1: Add the prop to the `Props` interface**

In `src/components/PassengerInfoCarousel.tsx`, change the `Props` interface (lines 8-12):

```tsx
interface Props {
	messages: ActiveMessage[];
	compact?: boolean;
	showValidity?: boolean;
	showStations?: boolean;
}
```

- [ ] **Step 2: Destructure the prop with a default**

Change the component signature (lines 24-28):

```tsx
export default function PassengerInfoCarousel({
	messages,
	compact = false,
	showValidity = true,
	showStations = false,
}: Props) {
```

- [ ] **Step 3: Render the station line above the validity line**

In `src/components/PassengerInfoCarousel.tsx`, the message block currently renders the text `<p>` then the validity `<p>` (lines 117-126). Insert the station line between them so the block reads:

```tsx
				<p
					class={`${textSize} text-gray-800 dark:text-gray-100 leading-snug whitespace-pre-wrap`}
				>
					{current.text}
				</p>
				{showStations &&
					current.stationNames &&
					current.stationNames.length > 0 && (
						<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
							{t("passengerInfoStation")}: {current.stationNames.join(", ")}
						</p>
					)}
				{showValidity && validity && (
					<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
						{t("passengerInfoValidity")}: {validity}
					</p>
				)}
```

- [ ] **Step 4: Verify types compile**

Run: `pnpm run typecheck`
Expected: PASS — no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/PassengerInfoCarousel.tsx
git commit -m "feat: render affected station line in passenger info carousel"
```

---

## Task 5: Turn on `showStations` in the banner

**Files:**
- Modify: `src/components/PassengerInfoBanner.tsx:255` (carousel usage)

- [ ] **Step 1: Pass the prop**

In `src/components/PassengerInfoBanner.tsx`, change the carousel usage (line 255) from:

```tsx
					<PassengerInfoCarousel messages={messages} />
```

to:

```tsx
					<PassengerInfoCarousel messages={messages} showStations />
```

- [ ] **Step 2: Verify types compile**

Run: `pnpm run typecheck`
Expected: PASS — no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/PassengerInfoBanner.tsx
git commit -m "feat: show affected station in general announcements banner"
```

---

## Task 6: Wire the station-name resolver in TrainList

**Files:**
- Modify: `src/components/TrainList.tsx:794-803` (the `partitionActiveMessages` useMemo)

- [ ] **Step 1: Build a code→name resolver and pass it in**

In `src/components/TrainList.tsx`, replace the `generalMessages`/`perTrainMessages` `useMemo` (lines 794-803) with:

```tsx
	const stationsByCode = useMemo(() => {
		const map = new Map<string, Station>();
		for (const s of stations) map.set(s.shortCode, s);
		return map;
	}, [stations]);

	const { generalMessages, perTrainMessages } = useMemo(() => {
		const lang = getCurrentLanguage();
		const resolveStationName = (code: string) => {
			const station = stationsByCode.get(code);
			return station
				? getLocalizedStationName(station.name, station.shortCode) || code
				: code;
		};
		const { general, perTrain } = partitionActiveMessages(
			rawPassengerMessages,
			currentTime,
			lang,
			displayedTrainKeys,
			resolveStationName,
		);
		return { generalMessages: general, perTrainMessages: perTrain };
	}, [
		rawPassengerMessages,
		currentTime,
		languageVersion,
		displayedTrainKeys,
		stationsByCode,
	]);
```

(`Station` is already imported and `getLocalizedStationName`, `useMemo`, `getCurrentLanguage`, `partitionActiveMessages` are all already in scope — verify the imports at the top of the file; no new imports needed.)

- [ ] **Step 2: Verify types compile**

Run: `pnpm run typecheck`
Expected: PASS — no errors.

- [ ] **Step 3: Run the full test suite**

Run: `pnpm run test`
Expected: PASS — all tests green.

- [ ] **Step 4: Commit**

```bash
git add src/components/TrainList.tsx
git commit -m "feat: resolve passenger-message station names in TrainList"
```

---

## Task 7: Bump version to 1.16.0

**Files:**
- Modify: `package.json:4`

- [ ] **Step 1: Edit the version**

In `package.json`, change line 4 from `"version": "1.15.0",` to `"version": "1.16.0",`.

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "chore: bump to 1.16.0"
```

---

## Task 8: Upgrade safe packages (minor/patch only)

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: List what's outdated**

Run: `pnpm outdated`
Note which upgrades are within current semver ranges (minor/patch) vs major-version jumps.

- [ ] **Step 2: Apply in-range updates**

Run: `pnpm update`
This respects the `^` ranges in `package.json` and only takes minor/patch.

- [ ] **Step 3: Verify green**

Run: `pnpm run typecheck && pnpm run test && pnpm run lint:check`
Expected: PASS on all three.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: upgrade dependencies (minor/patch)"
```

- [ ] **Step 5: Report available majors and STOP**

Print the list of available major-version upgrades from Step 1. Do NOT apply them — ask the user which, if any, to take. (User decision: safe-only, ask on majors.)

---

## Final verification

- [ ] **Run the full gate**

Run: `pnpm run typecheck && pnpm run test && pnpm run lint:check`
Expected: all PASS.

- [ ] **Manual smoke (optional)**

Run: `pnpm run dev`, open a route with an active general announcement, expand the banner, confirm the `Asema: …` line shows and shorter-validity messages appear first in the carousel.
