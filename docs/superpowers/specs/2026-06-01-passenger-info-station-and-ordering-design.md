# Passenger info: affected station + time-critical ordering

**Date:** 2026-06-01
**Branch:** `feat/passenger-info-messages`
**Status:** Approved design — pending spec review

## Problem

A general passenger-information announcement like *"Raide on suljettu."* (Track is closed) is
terse and gives no context about **which station** it concerns. Separately, when several
announcements are active, they appear in arbitrary API order — a one-day track closure can sit
behind a months-long track-work notice, even though the short-lived one is more time-critical.

## Goals

1. Show the affected station name(s) in the **general announcements banner**.
2. Order active messages so **shorter validity windows come first** (more time-critical).

## Non-goals

- Per-train message panels are **out of scope** for the station line (they already carry train
  context). Ordering, however, applies everywhere for consistency.
- No track-number / reason / category enrichment — the Digitraffic
  `passenger-information/active` schema has **no structured field** for these; that detail only
  ever exists inside the free text. Confirmed against the OpenAPI schema.

## Data background

A raw `PassengerInformationMessage` carries `stations: string[]` — short codes (e.g. `["PSL"]`).
The OpenAPI schema describes these as *"List of stations where message is delivered"* — i.e.
broadcast locations, not a guaranteed single pinpoint. We accept that nuance and use the simple
`Asema:` label (user decision). Our fetch already scopes messages to the user's route
(`stationCodes: [origin, destination]`), so the listed codes are relevant to what's on screen.

## Design

### 1. Affected station name in the banner

**Where resolution happens:** in `TrainList` (it already holds the `stations: Station[]` prop and
imports `getLocalizedStationName`). Keeping resolution there avoids threading station metadata into
the presentational carousel.

**Mechanism:** extend `partitionActiveMessages` with an optional resolver parameter and attach
resolved names to each `ActiveMessage`.

- `src/utils/passengerInfo.ts`
  - `ActiveMessage` gains `stationNames?: string[]`.
  - `partitionActiveMessages(messages, now, lang, displayedTrainKeys, resolveStationName?)`
    — new **optional** 5th param `resolveStationName?: (code: string) => string`.
    For each message, if a resolver is given, map `msg.stations` through it to build
    `stationNames`; otherwise omit the field. Empty `stations` → omit.
  - Backward compatible: existing 4-arg test calls keep working.

- `src/components/TrainList.tsx`
  - Build a code→name resolver from the `stations` prop:
    `const station = stations.find(s => s.shortCode === code);`
    `return station ? getLocalizedStationName(station.name, station.shortCode) || code : code;`
    (mirrors the existing header pattern; unknown code falls back to the raw code).
  - Memoize a `Map<string, string>` (code → Station) so the resolver is O(1) and stable.
  - Pass the resolver as the 5th arg to `partitionActiveMessages`. Add `stations` to the
    `useMemo` dependency list.

- `src/components/PassengerInfoCarousel.tsx`
  - New optional prop `showStations?: boolean` (default `false`).
  - When `showStations` and `current.stationNames?.length`, render a line **above the validity
    line**: `{t("passengerInfoStation")}: {current.stationNames.join(", ")}`,
    styled like the validity line (`text-xs text-gray-500 dark:text-gray-400`).

- `src/components/PassengerInfoBanner.tsx`
  - Pass `showStations` to its `<PassengerInfoCarousel>` (banner is general-only, satisfying the
    "general banner only" scope). Per-train usage (`TrainMessagePanel`) leaves it `false`.

- `src/utils/translations.ts`
  - New key `passengerInfoStation`: `fi: "Asema"`, `sv: "Station"`, `en: "Station"`.

### 2. Time-critical ordering

In `partitionActiveMessages`, sort the `general` array and each `perTrain` array by validity
duration ascending before returning.

- Sort key: `endValidity − startValidity` (ms), ascending → shortest first.
- Tie-break: earlier `startValidity` first.
- Invalid/missing dates (`NaN`) sort **last** so malformed entries never jump to the front.
- A small pure helper `validityDurationMs(msg): number` keeps the comparator readable and testable.
- Sorting once here means both the carousel render order and its auto-advance honour it; no
  component changes needed for ordering.

### 3. Chores

- **Version:** `package.json` `1.15.0 → 1.16.0` (user-facing feature → minor bump, consistent with
  the prior `chore: bump to 1.15.0`).
- **Package upgrades:** `pnpm update` within current semver ranges (minor/patch only). Verify
  green, then **list any available major-version upgrades and ask** before taking them (user
  decision: safe-only, ask on majors). Majors are not applied in this change.

## Testing

`src/utils/__tests__/passengerInfo.test.ts` (extend the existing `partitionActiveMessages` block):

- **Station names:** with a resolver, `stationNames` is populated and localized; without a
  resolver the field is absent; empty `stations` → absent; unknown code → raw code retained.
- **Ordering:** given messages with mixed validity spans, `general` is ordered shortest-first;
  equal spans tie-break by earlier `startValidity`; a `NaN`-duration message sorts last.

Existing 4-arg `partitionActiveMessages` tests must continue to pass unchanged (proves backward
compatibility).

Full gate before done: `pnpm run typecheck`, `pnpm run test`, `pnpm run lint:check`.

## Risks / trade-offs

- "Shorter validity = more urgent" is a heuristic, not a guarantee — but it is predictable and
  matches intent. Documented in code via the helper's comment.
- `stations` being delivery locations (not a strict pinpoint) is accepted under the plain `Asema:`
  label per the user's choice.
