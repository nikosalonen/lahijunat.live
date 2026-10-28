# Push alerts for favorite trains — Design

**Date:** 2026-10-27
**Status:** Draft, waiting for approval

## Summary

When a user marks a train as a favorite (the heart), lahijunat.live sends a push
notification to that device if Digitraffic publishes a new announcement for the
train or cancels it. The alert works while the app is closed and the phone is
locked. It uses standard Web Push, a Netlify scheduled function that checks
Digitraffic every minute, and Netlify Blobs to store subscriptions. It stays on the
free Netlify plan and needs no other service.

## Why

On 2026-10-27 the user missed that commuter train R 9638 (Riihimäki → Helsinki)
ran with only one unit. Had they known before leaving home, they would have stayed
home.

| Time (Helsinki) | What happened |
|---|---|
| 07:10 at the latest | Digitraffic composition data shows 9638 as 1 unit, 54 m (the day before: 2 units, 108 m) |
| 08:19 | Passenger-information announcement: "Exceptionally, there will be only one train unit running today." |
| 08:25 | Departure from Riihimäki |

The app already shows announcements on the train card and pulses new ones, but
only while the page is open and visible. Polling stops when the page is hidden
(`isPageVisible` in `src/components/TrainList.tsx`), and phones suspend background
pages, so a locked phone hears nothing. Only real push notifications can fix that.

The 07:10 time comes from the composition's `version` field, which decodes to a
millisecond timestamp. Digitraffic does not document it as one, so treat it as
likely, not certain.

## Goals

- Reach the user's phone, locked or not, when something changes about a train they
  marked as a favorite, early enough to change plans.
- Work on iPhone first (the user's phone, app on the Home Screen). Android Chrome
  and desktop browsers come with it.
- Turning alerts on is part of marking a favorite. No separate setup screen.
- Stay on the free Netlify Legacy Starter plan, in this repo, with no new accounts.

## Non-goals (first version)

- The early "shorter than usual" warning from composition data. It is the most
  valuable follow-up (see Phasing), but it is not in v1.
- Station-wide announcements (messages without a train number). Today they mix real
  disruptions with multi-day track-work notices and system test messages.
- Recurring subscriptions such as "my 08:25 every weekday". Users mark the train
  before leaving home, as they do now.
- Delay or track-change alerts.
- User accounts, sign-in, or syncing favorites across devices.

## Anti-goals (would make this a failure even if it works)

- Alerts for trains the user did not mark. No broadcast to everyone.
- Pushing announcements the user already saw on the card when they marked the train.
- A surprise bill, or a paused site, because the alert job used up the plan.
- Keeping travel data on a server after the trip is over.

## User experience

### Turning alerts on

1. The user taps the heart on a train card, as today.
2. If this is the first heart on a device that can receive push, and notification
   permission has not been decided yet, an in-app prompt appears: "Get alerts if
   this train changes?" with **Yes** and **Not now**.
3. **Yes** calls `Notification.requestPermission()` from that tap. iOS only shows the
   system permission dialog after a direct user gesture, so the prompt's button is
   what makes the dialog possible.
4. Once permission is granted, every heart subscribes that train to alerts with no
   further question. Removing the heart unsubscribes it.

*My calls:*

- **Not now** suppresses the prompt for 14 days (stored in `localStorage`).
- If the user denied permission in the system dialog, the app does not ask again.
  The settings toggle (below) explains how to allow it in system settings.
- A settings toggle, "Alerts for favorite trains", turns alerts off for all trains on
  the device. Off removes all of this device's records on the server and calls
  `subscription.unsubscribe()`. The builder picks where the toggle lives, next to
  the existing header controls (language, theme) if it fits.
- In Safari on iPhone without the Home Screen app, push is not available. The first
  heart there shows a one-time hint: "Add Lähijunat to your Home Screen to get
  alerts." On browsers with no push support at all, nothing changes.

### The alert

*My calls:*

- **Title:** line, scheduled time and route, e.g. `R 08:25 Riihimäki → Helsinki`.
- **Body:** the announcement text in the app's language at subscribe time (`fi`,
  `sv` or `en`, falling back to `fi`). For a cancellation: "Train cancelled" or
  "Train does not stop at Riihimäki" (partial cancellation of the user's station or
  destination), in the same language.
- **Tag:** one per announcement id, one per train for cancellations, so a repeated
  push replaces the old one instead of stacking.
- **Tap:** opens the route the train was favorited from, e.g.
  `https://lahijunat.live/ri/hki`. If the app is already open, it focuses that
  window and navigates it there.

## How it works

```
 Phone / browser                         Netlify (this repo)                  Digitraffic
 ───────────────                         ───────────────────                  ───────────
 TrainCard heart ──POST /api/alerts──▶  alerts function ──write──▶ Blobs
                 ──DELETE /api/alerts─▶                  ──delete─▶ (store "push-alerts",
                                                                     region eu-central-1)
                                         check-alerts (every minute)
                                           1. list records ◀─────────┘   (none → stop)
                                           2. GET passenger-information/active ──▶
                                           3. GET trains/{date}/{number} per train ──▶
                                           4. decide what is new
 Service worker ◀── push service ◀────── 5. send Web Push (VAPID)
 (push → showNotification,                6. update / delete records
  notificationclick → open route)
```

### 1. Client (`src/utils/pushAlerts.ts`, new)

- Feature check: `"serviceWorker" in navigator && "PushManager" in window &&
  "Notification" in window`. On iPhone, `PushManager` only exists for the Home
  Screen app, which is how "Safari without Home Screen" is detected (together with
  an iOS user-agent check for showing the hint).
- `enableAlerts()`: requests permission, then
  `registration.pushManager.subscribe({ userVisibleOnly: true,
  applicationServerKey })`. The key comes from `PUBLIC_VAPID_PUBLIC_KEY` at build
  time (`import.meta.env`).
- `subscribeTrain(train)` / `unsubscribeTrain(trainNumber)`: called from
  `handleFavorite` in `src/components/TrainCard.tsx`, right next to `setFavorite` /
  `removeFavorite`. The request body carries:
  - the `PushSubscription` (`endpoint`, `keys.p256dh`, `keys.auth`)
  - `trainNumber`
  - `departureDate`: the Helsinki date of the train's first origin departure
    (`train.originDepartureTime`), the date Digitraffic keys train messages and
    trains by. See `trainMessageKey` in `src/utils/passengerInfo.ts`.
  - `from` and `to` station codes (the route the user is on)
  - `removeAfter`: the same value saved to the favorite (departure + 10 min)
  - `lang` and a ready-made `title` (line, time, station names in that language),
    so the server needs no station list
- **Re-sync on app open:** after `initStorage()`, while alerts are on for the
  device, POST every live favorite that has an `alertTarget` again with the
  current subscription (the server upserts). This
  covers endpoint rotation and iOS silently dropping subscriptions (WebKit bug
  273063). It also pushes the client's drift-corrected `removeAfter`
  (TrainCard already updates it when the departure estimate moves).
- `FavoriteTrainData` in `src/utils/storage.ts` gets an optional `alertTarget`
  with the fields the POST needs: `trainNumber`, `departureDate`, `from`, `to`,
  the station names, `title`, the title's `lang`, and whether the train was
  already cancelled. Re-sync posts it as stored, so it needs no train data.
  - It is saved with every new favorite whose route is found in the timetable,
    whether alerts are on or not. Alerts are on or off for the whole device, not
    per favorite.
  - A favorite without one (saved before this feature, or with a route that
    wasn't found) is never posted. Removing the heart and adding it again
    subscribes it.
- Opt-in prompt: a small new component (`AlertOptInPrompt.tsx`), built on daisyUI
  like the rest of the app. New strings go in `src/utils/translations.ts` for fi, sv
  and en.

### 2. Service worker

The service worker is generated by `workbox generateSW` from `workbox-config.cjs`,
which already loads custom code with `importScripts: ["sw-utils.js"]`. That custom
code lives in **`src/sw-utils.js`**, not `public/`.
`scripts/stampSwVersion.mjs` copies it to `dist/sw-utils.js` with the version
stamped in. Add two listeners there:

- `push`: parse `event.data.json()`, then
  `event.waitUntil(self.registration.showNotification(title, options))`. Every push
  must show a notification (`userVisibleOnly`). Skipping one risks Safari revoking
  the subscription.
- `notificationclick`: close the notification, then focus an open window and
  navigate it to the alert's URL, or `clients.openWindow(url)` if none is open.

No switch to `injectManifest` is needed; Workbox documents `importScripts` for
exactly this. Because `sw-utils.js` changes, the browser installs the new worker on
its next update check (`skipWaiting` and `clientsClaim` are already on).

**Payload format (my call):** send the Declarative Web Push JSON
(`{"web_push": 8030, "notification": {"title", "body", "navigate", "lang", "tag"}}`).
On iOS 18.4 or later, Safari can show it even if the service worker fails. Older
iOS, Android and desktop deliver it to the `push` listener above, which reads the
same `notification` object. Check on a real iPhone that a service-worker
subscription still gets the declarative fallback.

The browser spots a declarative message by the `web_push: 8030` key in the
decrypted payload (the Push API spec's declarative push message parser, and
Safari's shipping version). It does not look at the request's `Content-Type`, so
the `application/octet-stream` that `web-push` always sends is fine.

### 3. Subscribe API (`netlify/functions/alerts.mts`, new)

- `config = { path: "/api/alerts" }`. `POST` upserts a record; `DELETE` removes one
  train, or every record for the endpoint when called with no train number (used by
  the settings toggle).
- Validation:
  - `trainNumber` is 1–5 digits.
  - `departureDate` is yesterday, today or tomorrow by the Helsinki calendar.
    Yesterday is needed for a train that left its first station before
    midnight.
  - `removeAfter` is within the next 36 hours.
  - Station codes are short uppercase letters.
  - `title` is capped at 120 characters.
  - The endpoint host must be a known push service: `fcm.googleapis.com`,
    `*.push.apple.com`, `updates.push.services.mozilla.com`, `*.notify.windows.com`.
    This stops the function from being used to make requests to arbitrary URLs.
- At most 20 records per endpoint.
- **Baseline at subscribe time:** fetch
  `passenger-information/active?train_number=…&train_departure_date=…`. Pick
  messages by the same rule as the job (step 3 below), and store their ids and
  text as "already sent". The user had the app open when they marked the train,
  so these count as seen and are never pushed (anti-goal). A re-sync POST keeps
  the existing record's sent list rather than resetting it.

### 4. Check job (`netlify/functions/check-alerts.mts`, new)

`config = { schedule: "* * * * *" }`. Each run:

1. **List records** (`store.list({ prefix: "sub/" })`). If none, return right away.
   This is the "only when needed" behaviour: the function still wakes every minute,
   but with no active favorites it makes no Digitraffic calls and finishes in
   milliseconds.
2. **Expire:** delete records whose `removeAfter` has passed, or whose
   `departureDate` is before yesterday (hard cap).
3. **Announcements:** one `GET /api/v1/passenger-information/active`. Keep every
   message whose `trainNumber` and `trainDepartureDate` match a record. This is
   the user's rule: any announcement about the train. Unlike the card, the job:
   - does not filter by station. The card only asks for messages that list the
     user's `from` or `to` station (`fetchActivePassengerMessages` in
     `src/utils/api.ts`).
   - ignores the display hours in `video.deliveryRules`. The card hides a message
     outside them, which could hold a 07:10 message back until 08:00.
   - takes the text from `video.text`, or from `audio.text` when there is no video
     text. `pickDisplay` drops audio-only messages.

   A message is news when its id is not in the record's sent list, or its text in
   the record's language has changed. A version bump with the same text is not
   news (my call).

   **Push and card can differ (my call, accepted for v1):** a pushed message may
   not show on the card, for example outside its display hours. The notification
   carries the full text, so nothing is lost. If that confuses people, a follow-up
   can make the card show watched trains' messages by the same rule.
4. **Cancellations:** for each distinct `(departureDate, trainNumber)`,
   `GET /api/v1/trains/{date}/{number}`. News is `cancelled: true` on the train, or
   on the user's `from` or `to` timetable row. Push once per record. The same
   response gives the live departure estimate at `from`; move `removeAfter` to
   estimate + 10 min so a late train stays watched.
5. **Send** each push (see below). Add sent ids to the record.
6. **Write back** changed records. Write a small `meta/last-run` blob with the time
   and counts, for checking that the job is alive.

All Digitraffic requests send `Accept-Encoding: gzip` (required; otherwise 406) and
`Digitraffic-User: lahijunat.live/<version>`. On a 429 or a network error, skip
only the checks that depend on the failed request; the rest of the run continues,
and the next minute tries again. Never fail loudly. The job must finish well inside
the 30-second scheduled-function limit (see Limits below).

**Shape of the code (my call):** keep steps 2–4 in a pure function
(`netlify/lib/decideAlerts.ts`: records + messages + trains + now → pushes to send
and record changes). That makes it unit-testable with the fixtures in
`src/__tests__/fixtures/passengerInfo.ts`.

### Limits (my calls)

`/api/alerts` is public and needs no sign-in, and every watched train adds work to
each run. These caps keep the job short and the function count predictable:

- **Rate limit on `/api/alerts`:** `rateLimit: { windowLimit: 30, windowSize: 60,
  aggregateBy: ["ip", "domain"] }` in the function's `config`. This uses one of
  the two code-based rules Netlify allows on Starter. Netlify doesn't document
  whether blocked requests count as function calls.
- **Global caps:** at most 300 records and 40 distinct trains. Above that, the
  subscribe function answers 503. The client still saves the heart and shows a
  short "Alerts are full right now" toast.
- **Batch the train lookups:** either one Digitraffic GraphQL query for all watched
  trains (the app already uses GraphQL for station data), or one REST request per
  train under the cap. That's the builder's choice. With the caps, a run should
  take a few seconds at most.
- Fake endpoints on an allowed push host get a 404 or 410 on their first push and
  are deleted in that run.
- **Known risk, accepted for v1:** the endpoint can't prove that a subscription
  belongs to a real browser. Someone could post made-up subscriptions, within the
  rate limit, until the global caps are full. Real users would then see "Alerts
  are full right now" until those records expire (36 hours at most). The caps
  still bound the cost: at most 40 trains per run. The off switch stops it if it
  happens. A follow-up could cap records per client IP.

### 5. Storage (Netlify Blobs)

- Store `push-alerts`, `region: "eu-central-1"` (Frankfurt), `consistency:
  "strong"`. Pass the same options everywhere. Site-wide stores otherwise default to
  `us-east-2`, and eventual consistency would delay a new subscription by up to
  60 s.
- One blob per record:
  `sub/<sha256(endpoint), first 16 hex>/<departureDate>-<trainNumber>`. One blob per
  record, not one shared index, so the subscribe function and the job never
  overwrite each other's changes.
- Record:

```json
{
  "endpoint": "https://web.push.apple.com/…",
  "keys": { "p256dh": "…", "auth": "…" },
  "trainNumber": 9638,
  "departureDate": "2026-10-27",
  "from": "RI",
  "to": "HKI",
  "lang": "fi",
  "title": "R 08:25 Riihimäki → Helsinki",
  "removeAfter": "2026-10-27T06:35:00.000Z",
  "sent": { "MVM20261027619368810": "<hash of text>" },
  "cancelSent": false,
  "createdAt": "2026-10-27T05:50:12.000Z"
}
```

- When the job updates a record, it writes with `onlyIfMatch` (the etag it read).
  If the record was deleted in the meantime (user removed the heart), the write
  fails and the record stays deleted.

### 6. Sending pushes

- Library: `web-push` (npm, 3.6.7). Its last release was in January 2024, but it is
  stable and runs on Node; Netlify functions run Node 24. If it causes trouble, the
  builder can swap in a WebCrypto-based library such as `@pushforge/builder`.
- VAPID keys: generate once (`npx web-push generate-vapid-keys`).
  - `PUBLIC_VAPID_PUBLIC_KEY` goes in Netlify env for builds.
  - `VAPID_PRIVATE_KEY` goes in Netlify env, functions scope only.
  - Subject: `https://lahijunat.live`.
  - Rotating the keys breaks all subscriptions. That is acceptable, since each
    subscription lives less than a day.
- Headers: `Urgency: high`. `TTL` set to the seconds until `removeAfter`
  (at least 60): an alert that arrives after the train left is useless.
- Response codes:
  - 404 or 410: delete every record for that endpoint.
  - 413 (payload too large): log it and drop the push. Keep the body under about
    3 KB by trimming long announcement text.
  - Other errors: log them without the endpoint, and do not retry this run.

## Platform limits

| Platform | Works? | Notes |
|---|---|---|
| iPhone / iPad, iOS 16.4+ | Yes, for the Home Screen app only | `manifest.json` already has `display: standalone`. Permission needs a user gesture. iOS 18.4+ adds Declarative Web Push as a fallback. |
| iPhone in Safari, not on Home Screen | No | Show the one-time hint. |
| Android Chrome, desktop Chrome / Edge / Firefox | Yes, from a normal tab | Needs the service worker, which the site already has. |
| Firefox Android, Samsung Internet | Probably | Not checked. Feature detection decides. |

**iOS reliability:** forum reports and WebKit bug 273063 show iOS sometimes drops
subscriptions silently, and Apple's push service can return a success code for a
dead one. So a success response does not prove delivery. The re-sync on every app open is the
mitigation.

## Data sources

- **Announcements:** `GET /api/v1/passenger-information/active`. Digitraffic offers
  **no MQTT or WebSocket feed** for passenger information. Its MQTT topics cover
  trains, train locations, train tracking, routesets and compositions. So the job
  polls. `/passenger-information/updated-after/{time}` also exists and returns
  less data. The builder may use it instead, as long as the card-matching logic
  stays the same.
- **Cancellations:** `GET /api/v1/trains/{date}/{number}`, one request per watched
  train.
- **Rate limits:** 60 requests per minute per IP without the `Digitraffic-User`
  header; Digitraffic says the header raises the limit but gives no number. Netlify
  functions run on shared cloud IPs, so another site's traffic may count against
  the same limit (likely, not verified). Skipping a run on 429 handles it.
- **Latency:** the job runs once a minute. Digitraffic's CDN adds seconds to tens of
  seconds, and push delivery adds a few seconds. Expect 1–2 minutes from
  publication to the phone. For 9638 that means about 08:21, four minutes before
  departure.

## Cost and plan limits (Netlify Legacy Starter, free)

- Functions: 125,000 calls per site per month and 100 hours of run time. The site
  has no functions today.
- The job: one call a minute is 43,200 a month, about 35% of the limit. Runs with
  no records take milliseconds, and busy runs a second or two. Run time is a few
  hours a month at most.
- Subscribe and unsubscribe calls: one per heart, plus re-syncs on app open. With
  under 100 daily users that is a few thousand a month.
- Blobs: Netlify does not publish Blobs quotas for Legacy Starter. Usage here is a
  few hundred small objects at most.
- Going over the function limit: Netlify staff say a paid add-on (about $25) is
  applied automatically. The only realistic way over is someone spamming
  `/api/alerts`, and Netlify counts even rejected requests. So the guards are:
  - **Rate limit** on `/api/alerts` (see Limits).
  - **Manual off switch:** one env var, `PUBLIC_PUSH_ALERTS_ENABLED` (default
    `true`). Set it to `false` in Netlify and redeploy. Astro bakes it into the
    client, so the app stops showing the prompt and subscribing. Both functions
    read it at run time and return at once, without touching Blobs or Digitraffic.
    The schedule still fires, about 43,200 calls a month. To stop those too, remove
    `schedule` from the job's config and redeploy.
  - **Usage checks:** look at the Netlify usage page a week after launch and
    monthly after that. If calls grow toward 100,000, reduce the schedule, for
    example to every 2 minutes at night.
  - **No automatic shut-off** (the user's decision). A usage counter can't stop
    spam, which is the only realistic way over the limit.
- Before relying on it, test that Netlify accepts `* * * * *`. Netlify's own AI
  guidance says one minute is the minimum, but the main docs page doesn't state it.

## How a subscription ends

| Trigger | Who acts | Result |
|---|---|---|
| User removes the heart | Client `DELETE /api/alerts` | Record deleted |
| Favorite expires (`removeAfter`, departure + 10 min, kept in step with the live estimate) | Job | Record deleted |
| Record still there the day after `departureDate` | Job (hard cap) | Record deleted |
| Push service answers 404 or 410 | Job | All records for that endpoint deleted |
| User turns alerts off in settings | Client `DELETE` (all) + `unsubscribe()` | All records for the device deleted |
| Client is offline when the heart is removed | Nothing | The record ends at `removeAfter` anyway. One extra alert is possible. |

## Privacy

- **What the server stores, per device per train:**
  - the push endpoint and its two keys: random values made by the browser, with no
    name, email or account
  - train number and date
  - the user's two station codes
  - language and the ready-made title
  - which announcements were sent
  - the creation time
- **What it does not store:** IP addresses, user agents, names, or any history.
- **How long:** until 10 minutes after the train leaves, and never past the end of
  the next day.
- **Where:** Netlify Blobs in `eu-central-1` (Frankfurt).
- **Logs:** functions never log endpoints, keys or titles; only counts and train
  numbers.
- **Still personal data:** an endpoint plus a station pair and a time is
  pseudonymous personal data, so treat it that way. Add a short note to the app's
  info text saying what is stored and for how long. That text would be the
  builder's.
- **Push providers:** Apple, Google or Mozilla carry the payload (announcement text
  and train title). The payload is encrypted end to end with the subscription keys,
  so they cannot read it.

## Testing

- **Unit tests (Vitest):** `decideAlerts` (new message, text change, version bump
  with same text, baseline suppression, audio-only message, message outside its
  display hours, message not listing the user's stations, cancellation of whole
  train and of the user's stop, expiry, hard cap, global caps), request validation in `alerts.mts`, and the
  client's `pushAlerts.ts` with mocked `PushManager`.
- **Service worker:** a test or manual check that `push` shows a notification and
  `notificationclick` navigates.
- **End to end:** scheduled functions only run on the production deploy, not on
  previews. So test the job locally with `netlify dev` and
  `netlify functions:invoke check-alerts`, against a real subscription from a deploy
  preview installed on an iPhone Home Screen. Then do one live test on production
  with a real train.

## Phasing and recommendation

**Build v1 as described.** It is the smallest version that works with the phone
locked, and v2 needs all of its parts anyway.

Be clear about what v1 alone would have done on 2026-10-27: a push at about 08:21,
four minutes before departure. That is better than finding out on the platform, but
not early enough to stay home. That needs v2.

- **v1 (this design):** push for new train-specific announcements and cancellations
  of favorited trains. Includes the opt-in prompt, the settings toggle, the iPhone
  Home Screen hint, the Netlify job and Blobs.
- **v2 (recommended next):** the "shorter than usual" warning. Compare today's
  composition length for a watched train with its usual length (for example the
  same weekday last week, from `/api/v1/compositions/{date}/{number}`). Push when
  it is clearly shorter. For 9638 this would have fired by 07:10. It needs a rule
  for trains that are short every day, and checks against false alarms. Also check
  at subscribe time, since the short composition may already be known by then.
- **Later, if wanted:** station-wide disruption messages for the user's station,
  delay and track-change alerts, recurring weekday subscriptions.

## Decisions

**Made by the user:**

- Alerts only for trains the user marked as favorite.
- Triggers: any new Digitraffic announcement for the train, or its cancellation.
- Composition-based warning and station-wide messages are later work.
- iPhone with the Home Screen app is the main target.
- Free, in this repo, on Netlify (Legacy Starter plan). Do as little work as
  possible when nobody is watching a train.
- Tapping the heart is the whole flow. Permission is asked when needed, behind a
  short confirmation prompt.
- Near the free limit: a rate limit, a manual off switch and usage checks. No
  automatic shut-off.

**My calls (check these):**

- "Not now" waits 14 days; a denied permission is never asked again.
- Settings toggle to turn alerts off for the device.
- Announcements already live when the train is marked are not pushed. A version
  bump with unchanged text is not pushed either.
- Every message for the train counts, with no station filter and no display
  hours, so a push can show something the card doesn't.
- Rate limit on `/api/alerts`; caps of 300 records and 40 trains.
- Notification title, body, tag and tap target as described above.
- Declarative Web Push payload format, handled by the service worker too.
- One blob per record in `eu-central-1`, strong consistency.
- `removeAfter` follows the live departure estimate; hard cap at the end of the
  next day.
- `web-push` library; `Urgency: high`; TTL until `removeAfter`.

## Left to the builder

- Where the settings toggle sits and how the opt-in prompt looks.
- Exact wording in fi, sv and en.
- Whether the job reads `/active` or `/updated-after`.
- Whether the functions reuse helpers from `src/utils/passengerInfo.ts` (text
  picking, message keys), as long as the job follows the rule in step 3.
- Folder names under `netlify/`, and whether a `netlify.toml` is needed (none
  exists today; Netlify finds `netlify/functions/` by default).
