# Push Alerts v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send a Web Push notification to a device when a train it marked as a favorite gets a new Digitraffic announcement or is cancelled, even while the app is closed.

**Architecture:** The client subscribes the device with the Push API and registers each favorited train at a Netlify function (`/api/alerts`). The function stores one record per device per train in Netlify Blobs. A scheduled Netlify function runs every minute. It reads the records and fetches Digitraffic announcements (REST) and train status (one batched GraphQL query). A pure `decideAlerts` function works out what is news, and the job sends pushes with `web-push`. The service worker shows the notification and opens the route when it is tapped.

**Tech Stack:** Astro 7, Preact, TypeScript, Tailwind/daisyUI, Vitest (jsdom, `vmThreads`), Netlify Functions (Node 24) with `@netlify/functions`, `@netlify/blobs`, and `web-push`. The service worker is Workbox `generateSW` plus `src/sw-utils.js`.

**Spec:** `docs/superpowers/specs/2026-10-27-push-alerts-design.md` (v1 only). Read it before starting any task.

## Global Constraints

- Work on a new branch from up-to-date `main`, not on `chore/release-1.20.0`.
- Node `>=24`, pnpm. Biome: tabs, double quotes. Conventional commits. **No `Co-Authored-By` trailer** (project CLAUDE.md).
- Blobs store: `getStore({ name: "push-alerts", region: "eu-central-1", consistency: "strong" })`, with the same options everywhere.
- Record key: `sub/<first 16 hex chars of sha256(endpoint)>/<departureDate>-<trainNumber>`. Meta key: `meta/last-run`.
- Caps:
  - 300 records in total
  - 40 distinct trains
  - 20 records per endpoint
- Rate limit on `/api/alerts`: `{ windowLimit: 30, windowSize: 60, aggregateBy: ["ip", "domain"] }`.
- Job schedule: `"* * * * *"`. It must finish well inside 30 s.
- Env vars:
  - `PUBLIC_VAPID_PUBLIC_KEY` (build and functions)
  - `VAPID_PRIVATE_KEY` (functions only)
  - `PUBLIC_PUSH_ALERTS_ENABLED` (default on; only the string `"false"` turns it off)
- Site URL: `process.env.URL ?? "https://www.lahijunat.live"` (`astro.config.mjs` uses the `www` host).
- Digitraffic requests always send `Accept-Encoding: gzip` and `Digitraffic-User: lahijunat.live/push-alerts`.
- Allowed push hosts:
  - `fcm.googleapis.com`
  - `updates.push.services.mozilla.com`
  - any host ending in `.push.apple.com`
  - any host ending in `.notify.windows.com`
- Pushes: `urgency: "high"`. TTL is the seconds until `removeAfter`, at least 60. Payload is Declarative Web Push: `{ web_push: 8030, notification: { title, body, navigate, lang, tag } }`.
- Body text: collapse runs of whitespace, then trim to 1000 characters, ending in `…` when cut.
- "Not now" snoozes the opt-in prompt for 14 days.
- Never log push endpoints, keys or titles. Log only counts, train numbers and HTTP status codes.

## Deviation from the spec (flagged for the user)

The spec fetches a baseline of live announcements inside the subscribe call. This plan works the baseline out in the job instead, from the record's `createdAt`:

- A message the record hasn't seen counts as already seen only if the card could have shown it when the train was marked. All of these must hold (`isBaseline` in `netlify/lib/messages.ts`):
  - its version time (`creationDateTime ?? startValidity`) is at or before `createdAt − 2 minutes`
  - it was valid at `createdAt` (`startValidity <= createdAt < endValidity`)
  - it lists the record's `from` or `to` station
  - it has video text, and `createdAt` is inside its video display hours
- Every other message is pushed.

Why:
- The subscribe call then never calls Digitraffic, and a failed Digitraffic call can't lose the baseline.
- The 2-minute grace covers the app's own polling lag, like `ARRIVAL_GRACE_MS` in `src/utils/announcementArrivals.ts`.

**Accepted trade-off:** a message that went live less than 2 minutes before the mark is pushed, even if the card had already fetched it. The card may not have fetched it yet, and we can't tell which. A repeated alert costs less than a missed one, so the anti-goal ("no announcements the user already saw") holds except for this 2-minute window. The `isBaseline` tests pin the boundary (`06:21:00Z` is baseline and `06:20:59Z` is not, for a message created at `06:19:00Z`).

## Review Focus

1. **Midnight-crossing trains.** `departureDate` is the train's origin date in Helsinki and can be yesterday's date. The subscribe call must accept yesterday, and the record key and matching must use the origin date. Tests: Task 6 (`accepts yesterday's origin date`) and Task 9 (`buildAlertTarget uses originDepartureTime date`).
2. **Station codes with Ä/Ö** (`KÄP`, `MÄK`). Validation must accept them, and the tap URL must encode them. Tests: Task 6 (`accepts KÄP`) and Task 2 (`url encodes lowercase station codes`).
3. **The same train favorited again from another route** on one device. The record is upserted: the latest route and title win, while `sent`, `cancelSent` and `createdAt` are kept. Test: Task 6 (`re-POST keeps sent marks and updates route`).
4. **Permission revoked in iOS Settings** after alerts were on. Re-sync must not call the API, and the toggle must show off. Test: Task 9 (`resyncAlerts does nothing when permission is not granted`).
5. **One Digitraffic call fails while the other works.** For example, announcements return 429 but the train lookup succeeds. Cancellations and expiry must still run. Test: Task 7 (`still checks cancellations when announcements fail`).

---

### Task 1: Server setup, shared types and message rules

**Files:**
- Modify: `package.json`
  - dependencies: `web-push`, `@netlify/blobs`, `@netlify/functions`
  - devDependencies: `@types/web-push`
  - scripts `lint` and `lint:check`: run `biome` on `src netlify`
- Modify: `vitest.config.ts`: add `"netlify/**/*.{test,spec}.ts"` to `test.include`.
- Create: `netlify/lib/types.ts`, `netlify/lib/config.ts`, `netlify/lib/messages.ts`
- Test: `netlify/lib/__tests__/messages.test.ts` (first line `// @vitest-environment node`)

**Interfaces:**
- Produces, in `netlify/lib/types.ts`:
  ```ts
  export type AlertLang = "fi" | "sv" | "en";
  export interface PushKeys { p256dh: string; auth: string }
  export interface AlertRecord {
    endpoint: string; keys: PushKeys;
    trainNumber: number; departureDate: string; // Helsinki origin date, YYYY-MM-DD
    from: string; to: string;                     // uppercase station codes
    fromName: string; toName: string; title: string; lang: AlertLang;
    removeAfter: string;                          // ISO
    sent: Record<string, string>;                 // message id -> textHash
    cancelSent: boolean;
    createdAt: string;                            // ISO, server time of first POST
  }
  export interface DigitrafficText { fi: string | null; sv: string | null; en: string | null }
  export interface DigitrafficMessage {
    id: string; version?: number; creationDateTime?: string;
    startValidity: string; endValidity: string;
    trainNumber: number | null; trainDepartureDate: string | null; stations: string[];
    video?: { text: DigitrafficText }; audio?: { text: DigitrafficText };
  }
  export interface TrainRow {
    station: string; type: "ARRIVAL" | "DEPARTURE"; cancelled: boolean;
    scheduledTime: string; liveEstimateTime: string | null; actualTime: string | null;
  }
  export interface TrainStatus { trainNumber: number; departureDate: string; cancelled: boolean; rows: TrainRow[] }
  export interface TrainRef { trainNumber: number; departureDate: string }
  export type PushMark = { kind: "message"; id: string; hash: string } | { kind: "cancel" };
  export interface AlertPush {
    recordKey: string; tag: string; title: string; body: string; url: string;
    lang: AlertLang; ttlSeconds: number; mark: PushMark;
  }
  export interface StoredRecord { key: string; etag: string; record: AlertRecord }
  ```
- Produces, in `netlify/lib/config.ts`:
  - `MAX_RECORDS = 300`, `MAX_TRAINS = 40`, `MAX_PER_ENDPOINT = 20`
  - `MAX_BODY_CHARS = 1000`, `BASELINE_GRACE_MS = 2 * 60_000`
  - `alertsEnabled(env = process.env): boolean` (false only when `PUBLIC_PUSH_ALERTS_ENABLED === "false"`)
  - `siteUrl(env = process.env): string`
- Produces, in `netlify/lib/messages.ts`:
  - `pickAlertText(msg: DigitrafficMessage, lang: AlertLang): string | null`. Order: video then audio; within each channel `lang` → `fi` → `en` → `sv`. Whitespace normalized and trimmed to `MAX_BODY_CHARS`.
  - `textHash(text: string): string`: sha256 hex, first 16 characters (`node:crypto`).
  - `messagesForTrain(messages: DigitrafficMessage[], ref: TrainRef): DigitrafficMessage[]`
  - `isBaseline(msg: DigitrafficMessage, createdAt: string): boolean`

- [ ] **Step 1: Install dependencies and update config**

Run: `pnpm add web-push @netlify/blobs @netlify/functions && pnpm add -D @types/web-push`. Then edit the `vitest.config.ts` include list and the lint scripts as listed above.

- [ ] **Step 2: Write the failing tests** in `netlify/lib/__tests__/messages.test.ts`

```ts
const msg = (over: Partial<DigitrafficMessage> = {}): DigitrafficMessage => ({
  id: "MVM1", version: 1, creationDateTime: "2026-10-27T06:19:00Z",
  startValidity: "2026-10-27T06:19:00Z", endValidity: "2026-10-29T00:00:00Z",
  trainNumber: 9638, trainDepartureDate: "2026-10-27", stations: ["RI", "HKI"],
  video: { text: { fi: "Ajetaan poikkeuksellisesti  vain yhdellä junayksiköllä.", sv: null, en: "Exceptionally, there will be only one train unit running today." } },
  ...over,
});

it("picks the record language and collapses whitespace", () => {
  expect(pickAlertText(msg(), "fi")).toBe("Ajetaan poikkeuksellisesti vain yhdellä junayksiköllä.");
});
it("falls back to fi when sv is missing", () => {
  expect(pickAlertText(msg(), "sv")).toBe("Ajetaan poikkeuksellisesti vain yhdellä junayksiköllä.");
});
it("uses audio text when there is no video text", () => {
  expect(pickAlertText(msg({ video: undefined, audio: { text: { fi: "Ääni", sv: null, en: null } } }), "en")).toBe("Ääni");
});
it("returns null when no channel has text", () => {
  expect(pickAlertText(msg({ video: undefined }), "fi")).toBeNull();
});
it("trims long text to 1000 characters ending in …", () => {
  const text = pickAlertText(msg({ video: { text: { fi: "a".repeat(1500), sv: null, en: null } } }), "fi");
  expect(text).toHaveLength(1000);
  expect(text?.endsWith("…")).toBe(true);
});
it("hashes text to 16 hex characters, stable per input", () => {
  expect(textHash("x")).toMatch(/^[0-9a-f]{16}$/);
  expect(textHash("x")).toBe(textHash("x"));
  expect(textHash("x")).not.toBe(textHash("y"));
});
it("keeps only messages for the train and origin date", () => {
  const list = [msg(), msg({ id: "B", trainNumber: 9640 }), msg({ id: "C", trainDepartureDate: "2026-10-26" }), msg({ id: "D", trainNumber: null })];
  expect(messagesForTrain(list, { trainNumber: 9638, departureDate: "2026-10-27" }).map((m) => m.id)).toEqual(["MVM1"]);
});
it("treats a message as baseline when its version is 2+ minutes older than createdAt", () => {
  expect(isBaseline(msg(), "2026-10-27T06:21:00Z")).toBe(true);
  expect(isBaseline(msg(), "2026-10-27T06:20:59Z")).toBe(false);
});
it("falls back to startValidity when creationDateTime is missing", () => {
  expect(isBaseline(msg({ creationDateTime: undefined }), "2026-10-27T06:21:00Z")).toBe(true);
});
```

Also test `alertsEnabled({})` → `true`, `alertsEnabled({ PUBLIC_PUSH_ALERTS_ENABLED: "false" })` → `false`, and `siteUrl({})` → `"https://www.lahijunat.live"`.

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `pnpm run test -- netlify/lib/__tests__/messages.test.ts`
Expected: FAIL (modules missing).

- [ ] **Step 4: Implement `types.ts`, `config.ts` and `messages.ts`** with the signatures above.

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `pnpm run test -- netlify/lib/__tests__/messages.test.ts`, then `pnpm run lint:check`.
Expected: PASS, no lint errors.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts netlify/lib
git commit -m "feat(alerts): add server types and announcement text rules"
```

---

### Task 2: `decideAlerts`, the pure decision function

**Files:**
- Create: `netlify/lib/decideAlerts.ts`, `netlify/lib/i18n.ts`
- Test: `netlify/lib/__tests__/decideAlerts.test.ts` (node environment)

**Interfaces:**
- Consumes (Task 1):
  - types
  - `pickAlertText`, `textHash`, `messagesForTrain`, `isBaseline`
  - `helsinkiParts` from `src/utils/helsinkiTime.ts` (import it by relative path)
- Produces:
  ```ts
  export interface AlertDecision {
    pushes: AlertPush[];
    updates: StoredRecord[];   // records whose content changed, with the etag they were read with
    deletes: string[];         // record keys
  }
  export function decideAlerts(input: {
    records: StoredRecord[]; messages: DigitrafficMessage[] | null; trains: TrainStatus[] | null;
    now: Date; siteUrl: string;
  }): AlertDecision;
  export function withoutMark(record: AlertRecord, mark: PushMark): AlertRecord;
  ```
- Produces, in `netlify/lib/i18n.ts`: `cancelledText(lang: AlertLang): string` and `doesNotStopText(lang: AlertLang, station: string): string`. The exact copy:

  | Lang | `cancelledText` | `doesNotStopText` |
  |---|---|---|
  | fi | `Juna on peruttu.` | `Juna ei pysähdy asemalla {station}.` |
  | sv | `Tåget är inställt.` | `Tåget stannar inte vid {station}.` |
  | en | `Train cancelled.` | `Train does not stop at {station}.` |

**Rules, in this order for each record** (`null` messages or trains means "skip the checks that need them"):

1. **Follow the live estimate.** If trains are present: take the `DEPARTURE` row at `record.from`. Use `actualTime ?? liveEstimateTime ?? scheduledTime`, plus 10 minutes. If that differs from `removeAfter` by more than 1 minute, update `removeAfter`.
2. **Expire.** Delete the record if `removeAfter <= now`, or if `departureDate` is before yesterday's Helsinki date. Skip the remaining steps for it.
3. **Cancellation.** If trains are present and `!cancelSent`, the train is cancelled when any of these is true:
   - `status.cancelled`
   - the `DEPARTURE` row at `from` is cancelled
   - the `ARRIVAL` row at `to` is cancelled

   When it is, push:
   - body: `cancelledText`, or `doesNotStopText` with `fromName` (or `toName`) for a partial cancellation
   - tag: `cancel-<trainNumber>-<departureDate>`
   - mark: `{ kind: "cancel" }`
   - set `cancelSent = true`
4. **Announcements.** If messages are present, go through `messagesForTrain`:
   - text: `pickAlertText(msg, lang)`. Skip the message when it is null.
   - hash: `textHash(text)`. Skip when `sent[id] === hash`.
   - If the id is not in `sent` and `isBaseline(msg, createdAt)`, set `sent[id] = hash` without pushing.
   - Otherwise push: tag `msg.id`, mark `{ kind: "message", id, hash }`, and set `sent[id] = hash`.
5. **Fields of every push:**
   - title: `record.title`
   - url: `` `${siteUrl}/${encodeURIComponent(from.toLowerCase())}/${encodeURIComponent(to.toLowerCase())}` ``
   - ttlSeconds: `max(60, floor((removeAfter − now) / 1000))`
   - recordKey: the record's key

- [ ] **Step 1: Write the failing tests**

Build records with a `rec(over)` helper and trains with a `train(over)` helper. Use `now = new Date("2026-10-27T06:20:00Z")` and `siteUrl = "https://www.lahijunat.live"`. Tests and key assertions:

- `pushes a new message once`: a record created at 06:00Z, and the 9638 message created at 06:19Z.
  - First call: one push with `tag "MVM1"`, the `fi` body and url `https://www.lahijunat.live/ri/hki`.
  - Second call with the updated record: zero pushes.
- `does not push a message that was live when the train was marked`: createdAt 06:30Z, message 06:19Z → no push; `sent.MVM1` is set.
- `pushes again when the text changes, not when only the version changes`.
- `pushes a whole-train cancellation once with cancelledText`, then nothing on the second call.
- `pushes doesNotStopText(fromName) when only the from-row is cancelled`.
- `moves removeAfter to live estimate + 10 min when drift > 1 min`.
- `deletes a record past removeAfter` and `deletes a record whose departureDate is before yesterday`.
- `skips cancellations but still checks messages when trains is null` (and the reverse).
- `url encodes lowercase station codes`: from `KÄP` → url contains `/k%C3%A4p/`.
- `ttlSeconds is at least 60`.
- `withoutMark removes a message mark and resets cancelSent`.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm run test -- netlify/lib/__tests__/decideAlerts.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `decideAlerts.ts` and `i18n.ts`.** Clone each record before changing it; never mutate the input.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm run test -- netlify/lib/__tests__/decideAlerts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add netlify/lib
git commit -m "feat(alerts): decide which pushes to send for watched trains"
```

---

### Task 3: Digitraffic client

**Files:**
- Create: `netlify/lib/digitraffic.ts`
- Test: `netlify/lib/__tests__/digitraffic.test.ts` (node environment, `fetchImpl` stubbed)

**Interfaces:**
- Produces:
  ```ts
  export const DIGITRAFFIC_HEADERS: Record<string, string>;
  export function fetchActiveMessages(fetchImpl?: typeof fetch): Promise<DigitrafficMessage[]>;
  export function buildTrainStatusQuery(trains: TrainRef[]): string;
  export function fetchTrainStatuses(trains: TrainRef[], fetchImpl?: typeof fetch): Promise<TrainStatus[]>;
  ```
  - `DIGITRAFFIC_HEADERS` is `{ "Accept-Encoding": "gzip", "Digitraffic-User": "lahijunat.live/push-alerts" }`.
  - `fetchActiveMessages` sends a `GET` to `https://rata.digitraffic.fi/api/v1/passenger-information/active`. It throws on a non-2xx response.
  - `fetchTrainStatuses` sends a `POST` to `https://rata.digitraffic.fi/api/v2/graphql/graphql`. It throws on a non-2xx response or a GraphQL `errors` field, and returns `[]` for an empty list without calling fetch.

Query shape (checked live on 2026-10-27; `train(...)` returns an array):

```graphql
{ t0: train(trainNumber: 9638, departureDate: "2026-10-27") {
    trainNumber cancelled
    timeTableRows { type cancelled scheduledTime liveEstimateTime actualTime station { shortCode } } } }
```

Map each alias `tN` back to `trains[N]` for `departureDate`. Skip aliases whose array is empty.

- [ ] **Step 1: Write the failing tests**
  - `sends gzip and Digitraffic-User headers`: assert on the stub's init.
  - `throws on HTTP 429`.
  - `buildTrainStatusQuery aliases each train as t0, t1…`: snapshot, or `toContain` for both aliases.
  - `maps GraphQL rows to TrainStatus`: feed the live response shape above; expect `rows[0]` to be `{ station: "RI", type: "DEPARTURE", cancelled: false, … }`.
  - `returns [] without calling fetch for no trains`.
- [ ] **Step 2: Run** `pnpm run test -- netlify/lib/__tests__/digitraffic.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `digitraffic.ts`.**
- [ ] **Step 4: Run the same command.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(alerts): fetch announcements and batched train status from Digitraffic`.

---

### Task 4: Alert store

**Files:**
- Create: `netlify/lib/store.ts`, `netlify/lib/memoryStore.ts` (in-memory store used by tests)
- Test: `netlify/lib/__tests__/store.test.ts` (node environment)

**Interfaces:**
- Produces:
  ```ts
  export interface AlertStore {
    list(prefix: string): Promise<Array<{ key: string; etag: string }>>;
    get(key: string): Promise<StoredRecord | null>;
    put(key: string, record: AlertRecord, opts?: { onlyIfMatch?: string }): Promise<boolean>; // false on etag mismatch
    delete(key: string): Promise<void>;
    setMeta(key: string, value: unknown): Promise<void>;
  }
  export function endpointPrefix(endpoint: string): string; // "sub/<16 hex>/"
  export function recordKey(endpoint: string, ref: TrainRef): string; // endpointPrefix + "<date>-<number>"
  export function trainOfKey(key: string): string; // "<date>-<number>"
  export function createBlobAlertStore(): AlertStore;
  // memoryStore.ts
  export function createMemoryAlertStore(): AlertStore; // etag = incrementing counter as string
  ```
- `createBlobAlertStore` wraps `getStore({ name: "push-alerts", region: "eu-central-1", consistency: "strong" })`:
  - `list({ prefix })` → `blobs`
  - `getWithMetadata(key, { type: "json" })`
  - `setJSON(key, value, { onlyIfMatch })`: map a result where it wasn't modified to `false`. Check the exact return type in the installed `@netlify/blobs` typings.
  - `delete`

- [ ] **Step 1: Write the failing tests** against `createMemoryAlertStore`:
  - `recordKey` format: `/^sub\/[0-9a-f]{16}\/2026-10-27-9638$/`
  - the same endpoint always gives the same prefix
  - `put` with a stale `onlyIfMatch` returns `false` and keeps the old record
  - `put` after `delete` with the old etag returns `false`
  - `list("sub/")` returns every record key
- [ ] **Step 2: Run** `pnpm run test -- netlify/lib/__tests__/store.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `store.ts` and `memoryStore.ts`.** The Blobs adapter is not unit-tested; the manual check is in Task 11.
- [ ] **Step 4: Run the same command.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(alerts): store alert records in Netlify Blobs`.

---

### Task 5: Sending pushes

**Files:**
- Create: `netlify/lib/sendPush.ts`
- Test: `netlify/lib/__tests__/sendPush.test.ts` (node environment, `vi.mock("web-push")`)

**Interfaces:**
- Produces:
  ```ts
  export interface DeclarativePushPayload {
    web_push: 8030;
    notification: { title: string; body: string; navigate: string; lang: AlertLang; tag: string };
  }
  export function buildPushPayload(push: AlertPush): DeclarativePushPayload;
  export type SendResult = "sent" | "gone" | "dropped" | "failed";
  export function sendAlertPush(record: AlertRecord, push: AlertPush, env?: NodeJS.ProcessEnv): Promise<SendResult>;
  ```
- `sendAlertPush` calls `webpush.sendNotification({ endpoint, keys }, JSON.stringify(buildPushPayload(push)), { TTL: push.ttlSeconds, urgency: "high", vapidDetails: { subject: siteUrl(env), publicKey: env.PUBLIC_VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY } })`.
- Result mapping:
  - `statusCode` 404 or 410 → `"gone"`
  - 413 → `"dropped"`. Per the spec: log it and drop the push; never retry.
  - any other error → `"failed"`
  - log `statusCode` and `push.tag` only

- [ ] **Step 1: Write the failing tests:**
  - `builds the declarative payload`: exact object equality.
  - `sends with TTL and high urgency`: assert the mocked call's third argument.
  - `maps 410 to gone`, `maps 404 to gone`, `maps 413 to dropped`, `maps 500 to failed`.
  - `does not log the endpoint`: spy on `console`, and assert no call contains `record.endpoint`.
- [ ] **Step 2: Run** `pnpm run test -- netlify/lib/__tests__/sendPush.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `sendPush.ts`.**
- [ ] **Step 4: Run the same command.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(alerts): send declarative web push messages`.

---

### Task 6: Subscribe API (`/api/alerts`)

**Files:**
- Create:
  - `netlify/lib/validate.ts`
  - `netlify/lib/handleAlertsRequest.ts`
  - `netlify/functions/alerts.mts`
- Test: `netlify/lib/__tests__/validate.test.ts`, `netlify/lib/__tests__/handleAlertsRequest.test.ts` (node environment)

**Interfaces:**
- Consumes: `AlertStore`, `recordKey`, `endpointPrefix`, `trainOfKey`, and `createMemoryAlertStore` (Task 4); config caps and `alertsEnabled` (Task 1); `helsinkiParts`.
- Produces:
  ```ts
  export interface SubscribeInput {
    subscription: { endpoint: string; keys: PushKeys };
    trainNumber: number; departureDate: string; from: string; to: string;
    fromName: string; toName: string; title: string; lang: AlertLang; removeAfter: string;
  }
  export interface DeleteInput { endpoint: string; trainNumber?: number; departureDate?: string }
  export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };
  export function isAllowedPushEndpoint(endpoint: string): boolean;
  export function parseSubscribeBody(body: unknown, now: Date): Parsed<SubscribeInput>;
  export function parseDeleteBody(body: unknown): Parsed<DeleteInput>;
  export function handleAlertsRequest(request: Request, deps: { store: AlertStore; now: Date; enabled: boolean }): Promise<Response>;
  ```
- Validation rules:

  | Field | Rule |
  |---|---|
  | `subscription.endpoint` | `https:` URL on an allowed host (Global Constraints) |
  | `keys.p256dh`, `keys.auth` | match `/^[A-Za-z0-9_-]+={0,2}$/`, at most 200 characters |
  | `trainNumber` | integer 1–99999 |
  | `departureDate` | `YYYY-MM-DD`, equal to yesterday, today or tomorrow in Helsinki |
  | `from`, `to` | match `/^[A-ZÄÖÅ]{1,5}$/` |
  | `fromName`, `toName` | 1–60 characters |
  | `title` | 1–120 characters |
  | `lang` | `fi`, `sv` or `en` |
  | `removeAfter` | ISO time after `now` and at most 36 h after it |

- Handler behaviour:

  | Request | Response |
  |---|---|
  | Feature disabled | 503 `{"error":"disabled"}` |
  | Invalid body | 400 `{"error":"<reason>"}` |
  | Method other than POST or DELETE | 405 |
  | Valid POST or DELETE | 204 |

  - **POST, record doesn't exist yet:**
    - `list("sub/")` has 300 or more keys → 503 `{"error":"full"}`.
    - The distinct `trainOfKey` values are 40 or more and don't include this train → 503 `{"error":"full"}`.
    - `list(endpointPrefix)` has 20 or more keys → 429 `{"error":"too-many"}`.
  - **POST, record exists:** keep its `sent`, `cancelSent` and `createdAt`; replace every other field. A new record starts with `sent: {}`, `cancelSent: false` and `createdAt: now`.
  - **DELETE with `trainNumber` and `departureDate`:** delete that one key.
  - **DELETE with the endpoint only:** delete every key under `endpointPrefix(endpoint)`.
- `alerts.mts`:
  ```ts
  export default (req: Request) => handleAlertsRequest(req, { store: createBlobAlertStore(), now: new Date(), enabled: alertsEnabled() });
  export const config: Config = { path: "/api/alerts", rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ["ip", "domain"] } };
  ```

- [ ] **Step 1: Write the failing tests**
  - `validate.test.ts`:
    - `accepts web.push.apple.com and fcm.googleapis.com`
    - `rejects http: and example.com endpoints`
    - `accepts yesterday's origin date`, `rejects a date two days ago`
    - `accepts KÄP`, `rejects lowercase codes`
    - `rejects removeAfter more than 36 h ahead`
    - `rejects a 121-character title`
  - `handleAlertsRequest.test.ts` (memory store, fixed `now`):
    - `POST creates a record and returns 204`
    - `re-POST keeps sent marks and updates route`
    - `returns 503 full at 300 records`
    - `returns 503 full for a 41st distinct train`
    - `returns 429 at 20 records for one endpoint`
    - `DELETE one train`, `DELETE all for endpoint`
    - `returns 503 disabled when enabled is false`
    - `returns 405 for GET`
- [ ] **Step 2: Run** `pnpm run test -- netlify/lib/__tests__/validate.test.ts netlify/lib/__tests__/handleAlertsRequest.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `validate.ts`, `handleAlertsRequest.ts` and `alerts.mts`.**
- [ ] **Step 4: Run the same command, then `pnpm run typecheck`.** Expected: PASS, no type errors.
- [ ] **Step 5: Commit** with `feat(alerts): add /api/alerts subscribe endpoint with caps and rate limit`.

---

### Task 7: Check job

**Files:**
- Create: `netlify/lib/runAlertCheck.ts`, `netlify/functions/check-alerts.mts`
- Test: `netlify/lib/__tests__/runAlertCheck.test.ts` (node environment, memory store, stub fetchers and sender)

**Interfaces:**
- Consumes:
  - `decideAlerts`, `withoutMark` (Task 2)
  - `fetchActiveMessages`, `fetchTrainStatuses` (Task 3)
  - `AlertStore`, `endpointPrefix`, `trainOfKey` (Task 4)
  - `sendAlertPush`, `SendResult` (Task 5)
  - `MAX_TRAINS`, `alertsEnabled`, `siteUrl` (Task 1)
- Produces:
  ```ts
  export interface RunSummary {
    skipped?: "disabled" | "empty";
    records: number; pushesSent: number; pushesFailed: number; deleted: number;
    messagesOk: boolean; trainsOk: boolean;
  }
  export function runAlertCheck(deps: {
    store: AlertStore; now: Date; enabled: boolean; siteUrl: string;
    fetchMessages: () => Promise<DigitrafficMessage[]>;
    fetchTrains: (trains: TrainRef[]) => Promise<TrainStatus[]>;
    send: (record: AlertRecord, push: AlertPush) => Promise<SendResult>;
  }): Promise<RunSummary>;
  ```

**Flow:**

1. If disabled: list the records, delete the expired ones (`isExpired`: past `removeAfter`, or past the hard cap), then return `{ skipped: "disabled" }`. Do not fetch Digitraffic, send pushes or write meta. The privacy promise holds while alerts are off.
2. Call `list("sub/")`. If it is empty, return `{ skipped: "empty" }` without writing meta.
3. `get` every record.
4. Fetch messages and trains with `Promise.allSettled`; a rejected call becomes `null`. Train refs are the distinct records' trains, the first `MAX_TRAINS` of them in key order.
5. Call `decideAlerts`.
6. Send pushes in parallel (`allSettled`):
   - `"gone"`: add every listed key under that endpoint's prefix to the deletes.
   - `"failed"`: apply `withoutMark` to that record's update, so the next run retries it.
   - `"dropped"`: keep the mark, so it is never retried. Count it in `pushesFailed`.
7. Apply deletes, then updates with `onlyIfMatch` (an update for a deleted key is dropped).
8. `setMeta("meta/last-run", { at: now.toISOString(), ...summary })`.

`check-alerts.mts` wires in the real dependencies, logs `JSON.stringify(summary)`, and exports `config: Config = { schedule: "* * * * *" }`.

- [ ] **Step 1: Write the failing tests:**
  - `skips without fetching when there are no records`: the fetch stubs are not called and no meta is written.
  - `still deletes expired records when disabled`: one live record, one past `removeAfter` and one from before yesterday; only the live one is kept, and the summary says `skipped: "disabled"`.
  - `fetches, sends and writes meta for nothing when disabled`: the fetch and send stubs are not called and no meta is written.
  - `sends a push and stores the sent mark`.
  - `deletes all records of an endpoint that returns gone`: two trains on one endpoint, both deleted.
  - `keeps the mark off after a failed send so the next run retries`: run twice; the second run sends again.
  - `still checks cancellations when announcements fail`: the messages stub rejects, the trains stub reports cancelled, so one push is sent and `messagesOk` is false.
  - `does not resurrect a record deleted during the run`: delete the key inside the `send` stub, and expect it to be absent after the run.
  - `asks for at most 40 trains`: 45 distinct trains, and the `fetchTrains` argument has length 40.
  - `writes meta/last-run after work`.
- [ ] **Step 2: Run** `pnpm run test -- netlify/lib/__tests__/runAlertCheck.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `runAlertCheck.ts` and `check-alerts.mts`.**
- [ ] **Step 4: Run the same command, then `pnpm run typecheck`.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(alerts): add every-minute check job`.

---

### Task 8: Service worker push handling

**Files:**
- Modify: `src/sw-utils.js` (add two listeners below the existing `message` listener)
- Test: `src/__tests__/swUtils.test.ts` (node environment)

**Interfaces:**
- Consumes the payload from Task 5: `{ web_push: 8030, notification: { title, body, navigate, lang, tag } }`.
- Behaviour:
  - **`push`:** `event.waitUntil(self.registration.showNotification(title, { body, tag, lang, icon: "/icons/icon-192-maskable.png", data: { url: navigate } }))`.
    - On bad or missing JSON, still show a notification: title `"Lähijunat"`, body `""`, `data.url` `"/"`.
  - **`notificationclick`:**
    1. `event.notification.close()`.
    2. `event.waitUntil(...)`: find a window client (`clients.matchAll({ type: "window", includeUncontrolled: true })`).
    3. If one exists, `focus()` it, then `navigate(url)`; otherwise `clients.openWindow(url)`.

- [ ] **Step 1: Write the failing tests.** Load the file's text with `fs`. Run it with `vm.runInNewContext` in a context whose `self` collects the `addEventListener` handlers and stubs `registration.showNotification`, `clients.matchAll` and `clients.openWindow`. Tests:
  - `push shows the notification from the payload`: assert the title and options, `data.url` included.
  - `push shows a fallback notification for invalid JSON`.
  - `click focuses and navigates an open window`.
  - `click opens a new window when none is open`.
- [ ] **Step 2: Run** `pnpm run test -- src/__tests__/swUtils.test.ts`. Expected: FAIL.
- [ ] **Step 3: Add the two listeners to `src/sw-utils.js`.** Keep the `__APP_VERSION__` placeholder: `scripts/stampSwVersion.mjs` fails the build without it.
- [ ] **Step 4: Run the test again, then `pnpm run build`.**
  Expected: PASS. The build prints `Stamped sw-utils.js with version …`, and `dist/sw-utils.js` contains `addEventListener("push"`.
- [ ] **Step 5: Commit** with `feat(alerts): show push notifications and open the route on tap`.

---

### Task 9: Client alerts module and favorite target

**Files:**
- Create: `src/utils/pushAlerts.ts`
- Modify: `src/utils/storage.ts` (add `alertTarget?: AlertTarget` to `FavoriteTrainData`, as a type-only import)
- Test: `src/utils/__tests__/pushAlerts.test.ts` (jsdom; stub `navigator.serviceWorker`, `PushManager`, `Notification` and `fetch`)

**Interfaces:**
- Consumes:
  - `getFavorites`, `updateFavorite` (storage)
  - `getCurrentLanguage` (language)
  - `getLocalizedStationName` (stationNames)
  - `helsinkiParts` (helsinkiTime)
  - `showToast` (toast)
  - `t` (translations)
  - `Train` (types)
- Produces:
  ```ts
  export interface AlertTarget {
    trainNumber: number; departureDate: string; from: string; to: string;
    fromName: string; toName: string; title: string;
    lang: string; // the language the title's station names are in
  }
  export type PushSupport = "supported" | "needs-home-screen" | "unsupported";
  export const ALERT_OPT_IN_EVENT = "alert-opt-in"; // CustomEvent detail: { target: AlertTarget; removeAfter: string }
  export function isAlertsFeatureEnabled(): boolean;
  export function getPushSupport(): PushSupport;
  export function buildAlertTarget(train: Train, from: string, to: string): AlertTarget | null;
  export function getAlertsPreference(): "on" | "off" | null;
  export function setAlertsPreference(value: "on" | "off"): void;
  export function snoozeOptIn(now?: Date): void;
  export function enableAlerts(): Promise<"granted" | "denied" | "error">;
  export function subscribeTrainAlerts(target: AlertTarget, removeAfter: string): Promise<"ok" | "full" | "error">;
  export function unsubscribeTrainAlerts(ref: { trainNumber: number; departureDate: string }): Promise<void>;
  export function disableAllAlerts(): Promise<void>;
  export function resyncAlerts(): Promise<void>;
  export function onFavoriteAdded(target: AlertTarget, removeAfter: string): Promise<void>;
  ```

**Behaviour:**

- `isAlertsFeatureEnabled`: `import.meta.env.PUBLIC_PUSH_ALERTS_ENABLED !== "false"` and `PUBLIC_VAPID_PUBLIC_KEY` is set.
- `getPushSupport`:
  - `"supported"` when the service worker, `PushManager` and `Notification` all exist.
  - `"needs-home-screen"` on iOS without them. iOS means `/iPhone|iPad|iPod/` in the user agent, or `Macintosh` with `navigator.maxTouchPoints > 1`.
  - `"unsupported"` otherwise.
- `buildAlertTarget` takes `trainNumber` from `Number(train.trainNumber)` (`Train.trainNumber` is a string) and `departureDate` from `helsinkiParts(new Date(train.originDepartureTime ?? train.timeTableRows[0].scheduledTime)).date`.
  - **title:** `` `${line} ${hh:mm} ${fromName} → ${toName}` ``, where:
    - `line` is `commuterLineID`, or `` `${trainType} ${trainNumber}` `` when that is empty
    - the time is the Helsinki `scheduledTime` of the `DEPARTURE` row at `from`
    - names come from `getLocalizedStationName(row.station.name, code)` for the `from` departure row and the `to` arrival row
  - **lang:** `getCurrentLanguage()` at build time, the language of those names.
  - Returns `null` when either row is missing.
- localStorage keys: `pushAlerts` (`"on"`/`"off"`), `pushAlertsSnoozeUntil` (ISO), `pushAlertsHomeScreenHintShown` (`"1"`). Wrap every access in try/catch.
- `enableAlerts`: calls `Notification.requestPermission()`. On `"granted"`, it gets or creates the subscription with `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: <PUBLIC_VAPID_PUBLIC_KEY as Uint8Array> })` and sets the preference to `"on"`.
- `subscribeTrainAlerts`: POSTs `{ subscription: sub.toJSON(), ...target, removeAfter }` to `/api/alerts`. The `lang` comes from the target, not the current language. A re-sync after a language switch then keeps the stored title and the pushed body in the same language.
  - 204 → `"ok"`.
  - 503 with `{error:"full"}` → `"full"` and `showToast(t("alertsFull"), "info")`.
  - Anything else → `"error"`. Never throw.
- `unsubscribeTrainAlerts` and `disableAllAlerts`: DELETE with `{ endpoint, trainNumber?, departureDate? }`. `disableAllAlerts` also calls `sub.unsubscribe()` and sets the preference to `"off"`.
- `resyncAlerts`: does nothing unless all of these hold:
  - the feature is enabled
  - support is `"supported"`
  - the preference is not `"off"`
  - `Notification.permission === "granted"`

  When they hold, it recreates a missing subscription, then POSTs every favorite that has an `alertTarget` and a future `removeAfter`.
- `onFavoriteAdded` returns early when the feature is disabled or the preference is `"off"`. Otherwise:

  | Situation | Action |
  |---|---|
  | Support is `"unsupported"` | Do nothing |
  | Support is `"needs-home-screen"` | Show `t("alertsHomeScreenHint")` once (`pushAlertsHomeScreenHintShown`) |
  | Permission `"granted"` | `subscribeTrainAlerts` |
  | Permission `"denied"` | Do nothing |
  | Permission `"default"`, not snoozed | Dispatch `ALERT_OPT_IN_EVENT` |

- [ ] **Step 1: Write the failing tests:**
  - `buildAlertTarget uses originDepartureTime date`: a train whose `originDepartureTime` is `2026-10-26T21:50:00Z` gets departureDate `2026-10-26`, even with a `from` row on the 27th.
  - `buildAlertTarget builds "R 08:25 Riihimäki → Helsinki"`.
  - `buildAlertTarget falls back to trainType and number without a line ID`.
  - `getPushSupport returns needs-home-screen on iPhone Safari without PushManager`.
  - `onFavoriteAdded dispatches the opt-in event when permission is default`.
  - `onFavoriteAdded does not dispatch while snoozed`: snooze, then advance 13 days → no event; at 15 days → event.
  - `onFavoriteAdded subscribes directly when permission is granted`.
  - `onFavoriteAdded shows the home screen hint once`.
  - `subscribeTrainAlerts returns full and shows a toast on 503 full`.
  - `resyncAlerts does nothing when permission is not granted`: fetch is not called.
  - `resyncAlerts posts every live favorite with an alertTarget`.
  - `disableAllAlerts deletes all, unsubscribes and sets preference off`.
- [ ] **Step 2: Run** `pnpm run test -- src/utils/__tests__/pushAlerts.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `pushAlerts.ts` and the storage type change.**
- [ ] **Step 4: Run the same command, then `pnpm run typecheck`.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(alerts): add client module for push subscriptions`.

---

### Task 10: UI: opt-in prompt, header toggle and favorite wiring

**Files:**
- Create: `src/components/PushAlerts.tsx`, `src/components/AlertsToggle.tsx`
- Modify:
  - `src/components/TrainCard.tsx` (`handleFavorite`, around line 681)
  - `src/layouts/Layout.astro`: put `<AlertsToggle client:idle />` next to `<LanguageSwitcher client:load />` (around line 302), and `<PushAlerts client:idle />` next to `<Toast client:load />` (around line 365)
  - `src/utils/translations.ts`: add new keys for fi, sv and en
- Test:
  - `src/components/__tests__/PushAlerts.test.tsx`
  - `src/components/__tests__/AlertsToggle.test.tsx`
  - `src/components/__tests__/TrainCard.test.tsx` (add cases; mock `@/utils/pushAlerts`)

**Interfaces:**
- Consumes everything Task 9 produces.

**Behaviour:**

- **`PushAlerts`** renders nothing until the opt-in event arrives.
  - On mount: `resyncAlerts()`.
  - On `ALERT_OPT_IN_EVENT`: open a daisyUI modal on a native `<dialog>` (like `ShareButton.tsx`). It shows `alertsPromptTitle`, `alertsPromptBody`, `alertsPromptPrivacy` and the buttons `alertsPromptYes` and `alertsPromptNotNow`.
  - **Yes:** `enableAlerts()`; on `"granted"`, `subscribeTrainAlerts(target, removeAfter)`. Close in all cases.
  - **Not now:** `snoozeOptIn()`, then close.
- **`AlertsToggle`** renders only when `isAlertsFeatureEnabled()` and `getPushSupport() === "supported"`.
  - It is a ghost icon button matching its header neighbours, with `aria-pressed` and `aria-label` = `alertsToggleOn` / `alertsToggleOff`.
  - It shows on when the preference is not `"off"` and the permission is `"granted"`.
  - **Clicking while on:** `disableAllAlerts()`.
  - **Clicking while off:** `enableAlerts()`. On `"granted"`, `resyncAlerts()`. On `"denied"`, `showToast(t("alertsBlocked"), "warning")`.
- **`TrainCard.handleFavorite`:**
  - **Add branch:** compute `alertTarget = buildAlertTarget(train, stationCode, destinationCode)`. Include it in the `setFavorite` data, and once `setFavorite` resolves, call `void onFavoriteAdded(alertTarget, removeAfter)` (only when it is non-null).
  - **Remove branch:** read `getFavoritesSync()[train.trainNumber]?.alertTarget` before calling `removeFavorite`. After it resolves, call `void unsubscribeTrainAlerts(alertTarget)`.
- **Translation keys:**

| Key | fi | sv | en |
|---|---|---|---|
| `alertsPromptTitle` | Ilmoitukset junan muutoksista? | Få aviseringar om tåget ändras? | Get alerts if this train changes? |
| `alertsPromptBody` | Saat ilmoituksen, jos suosikkijunastasi tulee tiedote tai se perutaan. | Du får en avisering om ett favorittåg får ett meddelande eller ställs in. | You'll get a notification if a favorite train gets an announcement or is cancelled. |
| `alertsPromptPrivacy` | Palvelimelle tallentuu laitteesi ilmoitusosoite ja tämä juna. Tiedot poistetaan 10 minuuttia lähdön jälkeen. | Servern sparar enhetens aviseringsadress och detta tåg. Uppgifterna raderas 10 minuter efter avgång. | The server stores your device's notification address and this train. It is deleted 10 minutes after departure. |
| `alertsPromptYes` | Kyllä | Ja | Yes |
| `alertsPromptNotNow` | Ei nyt | Inte nu | Not now |
| `alertsToggleOn` | Junailmoitukset päällä | Tågaviseringar på | Train alerts on |
| `alertsToggleOff` | Junailmoitukset pois | Tågaviseringar av | Train alerts off |
| `alertsBlocked` | Ilmoitukset on estetty. Salli ne laitteen asetuksista. | Aviseringar är blockerade. Tillåt dem i enhetens inställningar. | Notifications are blocked. Allow them in your device settings. |
| `alertsHomeScreenHint` | Lisää Lähijunat Koti-valikkoon, niin saat ilmoitukset junista. | Lägg till Lähijunat på hemskärmen för att få aviseringar. | Add Lähijunat to your Home Screen to get alerts. |
| `alertsFull` | Ilmoituksia ei juuri nyt voi lisätä. Suosikki tallennettiin. | Aviseringar kan inte läggas till just nu. Favoriten sparades. | Alerts are full right now. Your favorite was saved. |

- [ ] **Step 1: Write the failing tests:**
  - `PushAlerts`:
    - `opens the prompt on the opt-in event`
    - `Yes enables alerts and subscribes the train`
    - `Not now snoozes and closes`
    - `resyncs on mount`
  - `AlertsToggle`:
    - `is hidden when push is unsupported`
    - `turns alerts off when on`
    - `shows the blocked toast when permission is denied`
  - `TrainCard`:
    - `hearting a train calls onFavoriteAdded with its alert target`
    - `un-hearting calls unsubscribeTrainAlerts with the saved target`
- [ ] **Step 2: Run** `pnpm run test -- src/components/__tests__/PushAlerts.test.tsx src/components/__tests__/AlertsToggle.test.tsx src/components/__tests__/TrainCard.test.tsx`. Expected: the new cases FAIL.
- [ ] **Step 3: Implement the components, the TrainCard wiring, the Layout mounts and the translations.**
- [ ] **Step 4: Run the full suite and checks:** `pnpm run test && pnpm run typecheck && pnpm run lint:check`.
  Expected: all pass. Update the snapshots in `src/components/__tests__/__snapshots__/` only if the Layout or Toast output changed on purpose.
- [ ] **Step 5: Commit** with `feat(alerts): ask for alerts on first favorite and add header toggle`.

---

### Task 11: Configuration, docs and end-to-end check

**Files:**
- Create: `.env.example`, listing `PUBLIC_VAPID_PUBLIC_KEY=`, `VAPID_PRIVATE_KEY=` and `PUBLIC_PUSH_ALERTS_ENABLED=true`, each with a one-line comment.
- Modify: `README.md`. Add a short "Push alerts" section covering:
  - generating the keys (`pnpm dlx web-push generate-vapid-keys`)
  - the three Netlify env vars and their scopes
  - the off switch (set `PUBLIC_PUSH_ALERTS_ENABLED=false` and redeploy; to stop the schedule too, remove `schedule` from `check-alerts.mts`)
  - checking `meta/last-run` and the Netlify usage page

- [ ] **Step 1: Write `.env.example` and the README section.**
- [ ] **Step 2: Check the build.**
  Run: `pnpm run build`.
  Expected: success. `dist/sw-utils.js` contains the push listener. Netlify detects functions in `netlify/functions/` at deploy time, and `netlify.toml` is not needed.
- [ ] **Step 3: Commit** with `docs(alerts): document push alert setup and off switch`.
- [ ] **Step 4: The user sets the Netlify env vars.** Hand over to the user; this step is not done by an agent. Generate the VAPID keys locally, then set `PUBLIC_VAPID_PUBLIC_KEY` (all scopes), `VAPID_PRIVATE_KEY` (Functions scope) and `PUBLIC_PUSH_ALERTS_ENABLED=true` in the Netlify UI.
- [ ] **Step 5: Check on a deploy preview.**
  1. Open the preview on the iPhone, add it to the Home Screen, open it from there, heart a train and accept the prompt.
  2. Expected: `/api/alerts` returns 204, and the Netlify Blobs UI shows a `sub/…` key in `push-alerts`.
  3. Scheduled functions don't run on previews, so check the push path by hand. Copy the stored subscription and send a declarative payload with `pnpm dlx web-push send-notification` using the VAPID keys.
  4. Expected: the notification appears on the locked phone, and tapping it opens the route.
- [ ] **Step 6: Check on production after merge.**
  1. Confirm the Netlify Functions tab lists `check-alerts` with schedule `* * * * *`, and that `meta/last-run` updates once a train is hearted.
  2. Heart a train that has an announcement coming up, or watch for one, and confirm the push arrives within about 2 minutes of the announcement appearing.
  3. Remove the heart and confirm the `sub/…` key disappears.
  4. Check the usage page a week later: about 1,440 function calls a day.
