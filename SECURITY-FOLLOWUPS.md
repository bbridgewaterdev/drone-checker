# Security & Performance — follow-ups

This file tracks the parts of the June 2026 security/performance hardening that need a
**manual step** (console config) or a **deliberate, separately-tested change**. The
code-level fixes (security headers, SRI, Stripe redirect allowlist, email validation,
durable rate limiting, payment-failed revocation, visibility-aware timers, fetch
coalescing, and the JS extraction) are already in the repo.

---

## 1. Content-Security-Policy — currently Report-Only

`firebase.json` ships `Content-Security-Policy-Report-Only`, so violations are **logged
in the browser console but nothing is blocked**. To roll out:

1. Deploy, then use the app normally (sign in, checkout, open the map/restrictions tab,
   golden hour, push alerts). Watch DevTools console for `[Report Only]` CSP violations.
2. Add any missing origins to the policy in `firebase.json`.
3. When the console is clean, rename the header key from
   `Content-Security-Policy-Report-Only` to `Content-Security-Policy` to enforce it.

Note: `script-src` keeps `'unsafe-inline'` because the app uses inline `onclick=`/`onchange=`
handlers and a few inline `<script>` blocks; removing those would let you drop
`'unsafe-inline'` for a much stronger policy (large refactor — optional).

---

## 2. Firebase App Check — wire-up done, console step required

The client code is wired but **inert** (`APPCHECK_SITE_KEY=''` in `app.html`). To turn on:

1. Firebase Console → **App Check** → Apps → your Web app → register a **reCAPTCHA v3**
   provider; copy the site key.
2. Paste it into `var APPCHECK_SITE_KEY='...'` in `app.html` (near `FIREBASE_CONFIG`).
   This makes the loader pull `firebase-app-check-compat.js` (SRI already pinned) and
   activate App Check right after `initializeApp`.
3. In the App Check console, **enable enforcement** for **Cloud Functions** and **Cloud
   Firestore** (start in monitoring mode for a day to confirm legit traffic passes).

This blocks abuse from clients that don't run your real app (automated account creation,
Functions-quota abuse, spurious checkout sessions) — the main residual backend exposure.

---

## 3. Deploy ritual update (JS extraction)

The big inline `<script>` is now an external **`/app.js`**. `app.js` is served
`Cache-Control: no-cache` (browser revalidates → 304, no re-download; never stale), and
the service worker precaches it (`STATIC` + `CACHE` bump) for offline.

On each deploy that changes app code, bump **all three** as before — just note
`APP_VERSION` now lives in `app.js`:
- `APP_VERSION` in `app.js`
- `version.json`
- `CACHE` string in `sw.js`

---

## 4. ✅ DONE (v1.7.5, 2026-06-18) — duplicate map-library loads

`app.html` previously loaded the map libraries **twice** — a head block and a footer block —
parsing/executing Leaflet + maplibre-gl (~800 KB) twice per load, with
`@maplibre/maplibre-gl-leaflet` pinned to two versions (0.0.22 head, 0.0.20 footer; footer won).

**Resolved:** removed the three footer `<script>` tags, consolidating on the head block's
**0.0.22**. The 0.0.20 → 0.0.22 diff is a single defensive null-guard in `_update`
(`if(!this._map)return;`) — strictly safer, no behavior removed/changed. The only
`L.maplibreGL` consumer is the **wind map** (`app.js`); the restrictions map uses plain
`L.tileLayer`, so it was unaffected by the version switch. Verified live (dronechecker.co.uk):
each map lib loads exactly once, `maplibre-gl-leaflet@0.0.22` only, `L.maplibreGL` binds and
constructs a valid `L.Layer`, no console errors.

---

## 5. Deferred — render-function refactor (P2)

`renderDash()`, `renderBestTimeCard()`, and `renderFlightWindowCard()` rebuild large HTML
strings and replace `innerHTML` wholesale on every refresh/unit-toggle/threshold change
(full reparse, layout thrash, listener re-attach, lost scroll/focus). Recommended
incremental approach (verify after each step): (a) preserve scroll/focus and guard
redundant re-renders; (b) update only changed text/nodes; (c) split into components.
Deferred because the highest-cost paths (`renderBestTimeCard`) are Pro-gated and need
Pro-account testing to verify no regression.

---

## 6. Note — service worker importScripts cannot use SRI

`sw.js` loads Firebase via `importScripts('https://www.gstatic.com/.../firebase-*-compat.js')`,
which has no integrity option. If you want SRI coverage there too, self-host those two
files. Low priority (gstatic is Google-operated, lower supply-chain risk than unpkg).
