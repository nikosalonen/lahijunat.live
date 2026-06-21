# Share with a friend (QR code) — Design

**Date:** 2026-06-21
**Status:** Approved

## Overview

Add a "Share with a friend" feature to the site header. A share icon button opens a
modal containing a QR code that points to the site homepage, so a user can let a
friend scan it for instant access. The modal also offers a copy-link button and the
native share sheet on supported devices.

## Decisions

- **Share target:** User-selectable between the homepage (site root) and the current
  view (full current URL, including the selected stations). On a route page the modal
  shows a toggle and defaults to the current view; on the homepage the toggle is hidden
  and only the homepage URL is shared.
- **QR generation:** Bundled client-side library, lazy-loaded on first modal open.
  Works offline (PWA), no external requests, privacy-friendly. The QR is regenerated
  when the selected target changes.
- **Share actions:** QR code + Copy link + Native share (Web Share API where available).

## Components & files

- **New: `src/components/ShareButton.tsx`** (`client:load`) — self-contained component
  holding the header icon button, the modal, QR generation, and share actions.
- **`src/layouts/Layout.astro`** — mount `<ShareButton client:load />` in the nav's
  control cluster alongside `DebugToggle` / `LanguageSwitcher` / theme toggle, matching
  their ghost-icon styling and 40/44px touch targets.
- **`src/utils/translations.ts`** — new keys for fi/en/sv (see i18n below).
- **New dependency: `qrcode-generator`** (tiny, zero-dependency), dynamically imported
  on first modal open so it stays out of the initial bundle.
- **New: `src/components/__tests__/ShareButton.test.tsx`**.

## Behavior

- Icon button (share glyph SVG, white, hover/active states matching siblings),
  `aria-label={t("shareButtonLabel")}`. `hapticLight()` on open.
- Click → daisyUI modal built on the native `<dialog>` element (provides ESC-to-close,
  backdrop click, and focus handling).
- Modal contents:
  - Heading `t("shareModalTitle")` (e.g. "Jaa kaverille") + short
    `t("shareModalDescription")`.
  - **Share-target toggle** (only when viewing a route): a `<fieldset class="join">`
    with a visually-hidden `<legend>` (`t("shareTargetLabel")`) and two toggle buttons —
    `t("shareCurrentView")` ("Nykyiset valinnat") and `t("shareHomepage")`
    ("Perusnäkymä"). Selecting one updates the QR, displayed URL, copy, and native share.
  - **QR code:** inline SVG rendered on a white rounded panel (stays scannable in dark
    mode), ~200px, `alt` / `aria-label` = `t("qrCodeAlt")`.
  - The URL shown as selectable monospace text.
  - **Copy link** button → `navigator.clipboard.writeText`, fires the existing Toast
    success event with `t("linkCopied")`, plus haptic.
  - **Share…** button → `navigator.share({ title, url })`, rendered only when
    `navigator.share` exists. User-cancel `AbortError` is swallowed.
  - Close button.

## URL source

Computed at runtime (environment-correct for dev/prod):

- **Homepage:** `window.location.origin + "/"`.
- **Current view:** `window.location.href`.

`window.location.pathname !== "/"` determines whether a route is being viewed (and thus
whether the toggle is shown and "current view" is the default).

## Error handling

- Clipboard and share calls wrapped in try/catch. Clipboard failure → error Toast
  (`t("copyLinkFailed")`); the URL remains selectable as a fallback. `AbortError` from
  share is ignored.
- QR library import failure → show the URL and a working copy button, with a small
  fallback message instead of the QR code.

## Accessibility

- `<dialog>` with `aria-labelledby` referencing the heading; focus enters the dialog on
  open; ESC and backdrop close it; all buttons use `type="button"` with labels; the QR
  has descriptive alt text.

## Internationalization

New keys for fi / en / sv:

- `shareButtonLabel`
- `shareModalTitle`
- `shareModalDescription`
- `shareTargetLabel`
- `shareHomepage` (fi: "Perusnäkymä")
- `shareCurrentView` (fi: "Nykyiset valinnat")
- `copyLink`
- `linkCopied`
- `copyLinkFailed`
- `nativeShare`
- `shareFailed`
- `qrCodeAlt`
- `closeShareModal`

Reuse an existing close/dismiss key if one is present. The modal uses
`useLanguageChange()` so text updates live when the language changes.

## Testing (Vitest + @testing-library/preact)

- Button renders with the correct `aria-label`; modal opens on click and closes on
  close button / ESC.
- Native-share button is hidden when `navigator.share` is undefined; when present it is
  called with `{ url, title }`; `AbortError` is handled gracefully.
- Copy button calls `clipboard.writeText` with the origin URL and dispatches the success
  toast.
- QR: mock the dynamic `qrcode-generator` import → assert an SVG renders; assert the
  fallback renders when the import rejects.

## Performance

- The QR library is lazy-loaded via dynamic import, keeping it out of the critical path.
- The component itself is small and adds negligible weight to the initial bundle.
