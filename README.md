# Usage Tracker

**Version:** v0.17.0

A personal product usage tracker. Log everyday products (shampoo, toothpaste, deodorant, etc.), when you start and finish them, and what they cost — then get a clear picture of per-unit and per-day cost, total spend, and which items are still active.

Hosted as a static site on GitHub Pages with a Firebase Firestore backend. Phases 1–6 are complete. UPC camera scanning added in v0.5.0; UPC database lookup with auto-fill added in v0.6.0.

---

## Current status (v0.17.0)

### ✅ Phase 1 — Data structure
Data schema and calculations are in place. Each product stores:

| Field | Type | Notes |
|---|---|---|
| `id` | string | Internal UUID, auto-generated |
| `productType` | enum | Seeded: Underarm, Toothbrush, Toothpaste, Floss, Mouthwash, Facewash, Shampoo, Soap. You can add more via **+ Add new type…** at the bottom of the dropdown. Custom types persist in `localStorage`. |
| `productName` | string | |
| `size` | number | |
| `unit` | enum | count, oz, fl oz, lb, g, kg, mL, L, gal, ft, m, pack, roll, sheet, load, serving |
| `startDate` | date | When you started using the product |
| `endDate` | date | Empty = still in use |
| `cost` | number | Pre-tax price — required |
| `costWithTax` | number | Optional. If not set, cost calculations fall back to `cost`. |
| `bundleStatus` | boolean | Part of a bundle purchase |
| `bundleSize` | number | Total units in the bundle (only when `bundleStatus = true`) |
| `store` | string | Dropdown of recently-used stores + **+ Add new…** |
| `buyer` | string | Same pattern |
| `cardLast4` | string | Same pattern, displayed as `•••• 1234` |
| `purchaseDate` | date | |
| `notes` | string | Free-form |
| `upc` | string | **Required** |

**Calculated fields** (derived on the fly, not stored):

- **Duration (days)** = `endDate − startDate` (or `today − startDate` if still in use)
- **Effective cost** = `costWithTax` if set, otherwise `cost`
- **Allocated cost** = `effectiveCost / bundleSize` if bundled, else `effectiveCost`
- **Cost per unit** = `allocatedCost / size`
- **Cost per day** = `allocatedCost / duration`
- **Total spend** (stats bar) = sum of `allocatedCost` across all products — this prevents double-counting bundles (three bundled items at $15 total count as $15, not $45).

### ✅ Phase 2 — Input form
- Full add/edit dialog covering every field
- Delete with confirmation
- Import JSON (merges custom types from the export too)
- Export JSON and CSV (CSV includes calculated fields)
- Summary stats bar: tracked count, active, finished, total spend
- **Sortable table** — click any column header to sort; click again to reverse.
- **Continue bundle** — when adding a new product, a selector at the top of the dialog lists all existing bundles. Picking one pre-fills product name, cost, UPC, bundle size, and the rest of the purchase details so you can just set a new start date and save.
- **Cost fields** show a `$` prefix and auto-format to two decimals on blur (`5` → `5.00`).

### ✅ Phase 3 — Authentication
Google Sign-In via Firebase. Scopes kept minimal — only `profile` + `email`, pulling:
- `uid` (unique Google account identifier — used as the primary key for per-user data)
- `email`
- `displayName`
- `photoURL`

No access to Gmail, Drive, contacts, or other Google services. When signed out, the app shows a sign-in card and nothing else. When signed in, the header shows the user's avatar, name, and a Sign out button.

### ✅ Phase 4 — Data storage
Firestore, with security rules scoped to `request.auth.uid` so each account can only read/write its own products. Documents:

- `/users/{uid}/products/{productId}` — one doc per tracked product
- `/users/{uid}/meta/customTypes` — the user's custom product types list

All reads use `onSnapshot` so changes propagate live across tabs and devices. On first sign-in, any leftover localStorage data is detected and the app offers to migrate it into Firestore (archived locally as `.migrated` after upload, not deleted).

### ✅ Phase 5 — Dashboard
A **Dashboard** tab beside the Table view (toggle in the page body). Extras on the dashboard:

- Summary cards: avg $/day across active products, avg lifespan of finished products, top category by spend, top store by spend.
- **Allocated spend by product type** — donut chart.
- **Allocated spend by store** — horizontal bar chart.
- **Products finished per month** — last 12 months bar chart.

All charts re-render live as Firestore data changes. Charts are rendered with [Chart.js v4](https://www.chartjs.org/) via ES module import from jsDelivr — no build step.

### ✅ Phase 6 — Deployment
Published via GitHub Pages from the `main` branch since v0.1.0.

### ✅ UPC scanning via phone camera (v0.5.0)
Tap **Scan** next to the UPC field in the Add/Edit dialog to open the camera. Works on iPhone Safari and Android Chrome; also on desktop browsers with a webcam. Uses [@zxing/browser](https://github.com/zxing-js/browser) via ESM from jsDelivr — lazy-loaded on first tap so desktop users who never scan don't pay the bundle cost. Back camera (`facingMode: environment`) is preferred on phones. On first successful decode, the UPC input is filled and the scanner closes.

Camera access requires HTTPS (✅ via GitHub Pages) and a permission grant. If the grant is blocked, the scanner dialog shows a friendly error with instructions.

### 🔭 Future discovery
- Amazon purchase history autofill

---

## Bundle workflow — worked example

You buy a 3-pack of deodorant for $15.99 + tax ($17.30 total) on 2026-04-15.

**First unit:**
1. Click **+ Add product**
2. Product type: **Underarm**
3. Product name: `Degree Cool Rush` · Size: `2.7` · Unit: `oz`
4. Start date: today (when you open the first stick)
5. Cost (pre-tax): `15.99` · Cost with tax: `17.30`
6. Purchase date: `2026-04-15` · UPC: `079400453402`
7. Check **Part of a bundle purchase** → Bundle size: `3`
8. Save.

The table now shows this product with `Bundle × 3` and `$/unit` based on `$17.30 / 3 / 2.7 oz ≈ $2.14/oz`.

**Second unit (a month later):**
1. Click **+ Add product**
2. At the top of the dialog, pick the bundle from **Continue existing bundle** → everything pre-fills.
3. Change only the Start date to today.
4. Save.

Both entries track their own start/end dates independently, but share the allocated cost.

---

## Running locally

It's a static site — no build step.

```bash
# Any static server works
python -m http.server 8080
# or
npx serve .
```

Then open http://localhost:8080.

Because the app uses Firebase Google Sign-In, your local origin needs to be whitelisted in the Firebase Console once: **Authentication → Settings → Authorized domains → Add `localhost`**. The live GitHub Pages domain `itsavibecode.github.io` must also be added there.

After signing in with Google, data lives in Firestore under `/users/{uid}/`:
- `/users/{uid}/products/{id}` — product entries
- `/users/{uid}/meta/customTypes` — custom product types

Legacy localStorage data (from v0.2.0 or earlier) is automatically offered for one-time migration on first sign-in.

---

## Firebase setup (one-time, already done for this project)

If you fork this or stand up your own instance:

1. **Create a Firebase project**, then add a Web app. Paste the resulting `firebaseConfig` into `firebase-init.js`.
2. **Enable Google Sign-In**: Firebase Console → Authentication → Sign-in method → Google → Enable.
3. **Create Firestore** (Native mode, any region).
4. **Paste `firestore.rules`** from this repo into Firebase Console → Firestore → Rules → Publish. These rules enforce per-user isolation (`request.auth.uid == userId` on everything under `/users/{uid}/…`).
5. **Authorized domains**: Authentication → Settings → Authorized domains → add your hosting domain(s) — e.g. `itsavibecode.github.io` and `localhost` for local dev.

The `apiKey` in `firebase-init.js` is safe to commit — Firebase Web API keys identify the project, they don't authenticate it. Security is enforced entirely through Firestore rules and the authorized-domains list.

---

## File layout

```
usage/
├── index.html          # markup + form + table + auth gate
├── style.css           # styling
├── app.js              # ES module: Firestore, auth, calculations, form, sort, import/export
├── firebase-init.js    # ES module: Firebase app/auth/db/analytics singletons
├── firestore.rules     # security rules (paste into Firebase Console)
├── favicon.svg         # site icon
└── README.md
```

---

## Version

Version is displayed in the site header next to the logo. It's defined in four places that must stay in sync on each release:

- `APP_VERSION` constant in `app.js`
- `<meta name="version">` in `index.html`
- Visible version text in the header (`#version` span)
- This README

## Changelog

### v0.17.0 — 2026-05-03
- **Desktop table consolidation.** The product table was 18 columns wide and forced horizontal scrolling on most monitors. Four changes shipped together:
  1. **Store + Buyer + Card merged into one Bought by column.** Each piece keeps its filter-chip behavior; missing pieces are skipped, so a row that only has a store still reads cleanly. Sort by *Bought by* orders by store first, then buyer, then card. Saves two columns of horizontal width.
  2. **New Density toggle (Comfortable / Compact)** in the display-controls bar above the stats. Compact tightens row padding and shrinks the table font, fitting ~15% more rows per screen on the same monitor. Persists per browser.
  3. **Notes column auto-hides** when nothing in the current view actually has notes. Independent of the manual columns preference — if you turn Notes on but no current row has any, the column still hides itself for now and reappears the moment a visible row gets a note.
  4. **New Columns dropdown** in the display-controls bar lets you toggle any non-essential column on or off (everything except Name and Actions). State persists per browser. *Reset* clears the override and shows everything again.
- Combined effect on the live table: 18 columns → 16 columns by default, and you can drop further from there if you want a tighter view (e.g. hide UPC + Duration + Purchased on a 1080p screen). Compact density on top of column hiding gets the same data into a fraction of the original horizontal space, and nothing's lost — every value is still on the row, you're just choosing which to display.

### v0.16.1 — 2026-05-03
- **$/unit and $/day columns now show 2 decimal places instead of 4.** The 4-decimal precision (`$1.0412/oz`) was forcing horizontal table scrolling on reasonable-sized monitors, and at personal-tracker scale ($1–2 per oz, a few cents per day) the extra digits were noise rather than signal. Affects every place `moneyFine()` is called: table cells, dashboard cards, mobile card subtitles, chart axes/tooltips, trends-panel insight sentences, and PNG export labels.

### v0.16.0 — 2026-05-03
- **New: email reorder reminders.** A daily digest emails you when active products are approaching their average lifespan, so you can reorder before they run out. Opt in via the new **Settings** button in the user-chip toolbar — tick the box, optionally point reminders at a different email, save. The in-app reorder reminders panel is unchanged; the email is just a push version of the same algorithm so you don't have to open the app to know it's time. Backed by a small Cloudflare Worker (`usage-worker`) that runs at 8am US Eastern, computes which actives are at ≥85% of their type's average lifespan, and sends one Resend email — capped at one per week so persistent reminders don't spam. Worker source and deploy steps live in [`usage-worker/`](https://github.com/itsavibecode/usage-worker).

### v0.15.5 — 2026-04-30
- **Fixed: Duplicate button text wrapping on mobile cards.** With 5+ action buttons (Edit / Duplicate / History / Share / Delete, plus Finish for active rows), the row was forcing every button to a `min-width: 64px` while "Duplicate" needed ~100px. Result: the label wrapped to two lines mid-button, breaking text centering and stretching the row vertically. Fixed by dropping `min-width`, adding `flex-wrap: wrap` on the actions row, and `white-space: nowrap` on the buttons. Each button now sizes to its label, and if the row can't fit them all on one line, they wrap to a second line cleanly.

### v0.15.4 — 2026-04-30
- **Fixed: UPC lookup wasn't auto-filling size for many products.** UPCitemdb's dedicated `size` field is empty for a lot of records (e.g. the Old Spice deodorant has `size:""` while the actual `6 oz` is embedded in the title). New title-fallback parser scans for `<number> <unit>` patterns and uses the LAST match — titles almost always end with the size (`"... - 6 oz"`, `"... 4.7 oz"`). Validated against real titles: Old Spice 6 oz, Crest 4.7 oz, Pantene 12 fl oz, "Pack of 3 - 8 oz bottles" (correctly picks 8 oz, not the bare 3). Falls through to the same canonical-unit normalization as the `size` field.

### v0.15.3 — 2026-04-30
- **Fixed: Duplicate of a bundled product threw "Position already taken."** Was inheriting the source row's `bundleId` from v0.7.13, which made the duplicate a sibling of the original physical bundle. When you actually bought a *separate* physical bundle (e.g. a second 2-pack of the same deodorant), Duplicate is now what you want and starts a fresh bundleId. If you want a sibling within the same physical bundle, use the **Continue existing bundle** picker at the top of the dialog instead.
- **Fixed: toast notifications appeared underneath modal dialogs.** The browser's modal-dialog top layer beats CSS `z-index`, so a toast in the regular DOM was always behind. Toast is now a `<dialog>` element that uses `.show()` (non-modal) — same top layer as the modals, so it floats above everything. Also moved to top-of-viewport instead of bottom.
- **Fixed: UPC lookup error messages getting overwritten.** When `lookupUpc` set a specific error like "Lookup failed — check connection" or "UPC database busy," the wrapping `lookupAndOfferUpc` would immediately overwrite it with the generic "No match — enter details manually." Specific errors now stick.
- **Diagnostic: UPC fetch + console logging.** Added `cache: 'no-store'` to the proxy fetch (defeats any browser HTTP cache between attempts) plus `console.warn` / `console.info` for HTTP errors, parse failures, and OK-but-empty responses. If a lookup fails again, open the browser console — there'll be a clear breadcrumb explaining what came back.
- **Type chips on desktop now color-coded** per product category (matching mobile). Toothpaste always renders the same blue; Underarm always renders its color, etc. Click still adds the filter chip exactly as before.
- **Share + PNG combined into one button.** Each row now has a single **Share** button instead of separate Share and PNG. Clicking it opens the share dialog with three actions: Copy link, Open link in new tab, and Export PNG. Mobile cards too. Cleaner action row.
- **Size auto-decimals on blur** for measurement units (oz, fl oz, lb, g, kg, mL, L, gal, ft, m). Type `5` for an oz product, blur the field, it becomes `5.0` — keeps the decimal-formatted look consistent. Count / pack / roll / sheet / load / serving are integer units and stay as integers.

### v0.15.2 — 2026-04-30
- **New: company logos via logo.dev.** Each product now shows a small circular brand-logo icon (Crest, Old Spice, Pantene, etc.) in the desktop table, mobile card head, and Edit dialog. The brand name is auto-captured from UPCitemdb when you scan/lookup a UPC; you can also type or edit it manually in the new **Brand** field in the dialog. Domain is guessed from the brand (`Crest` → `crest.com`, `Old Spice` → `oldspice.com`); when the guess misses, the icon silently hides. Same `pk_` publishable token used by the stocks repo — safe to commit per logo.dev's convention.
- **Brand is also indexed by search** so you can type "crest" or "p&g" and get matching products in the autocomplete dropdown.

### v0.15.1 — 2026-04-29
- **Fixed: purchase date defaulted to tomorrow when adding a product late at night.** `new Date().toISOString().slice(0, 10)` returns the UTC date — at 10:55pm Eastern that's already 2:55am UTC the next day. Now uses a local-date helper. Also fixes the same bug in the Finish dialog and the duplicate flow.
- **Fixed: mobile save button silently failing.** HTML5 `required` validation tooltips can be invisible in scrolled mobile dialogs, so Save would do nothing without explanation. Form is now `novalidate`; JS validates explicitly and toasts the specific issue (`"Size is required"`, `"Cost is required"`, etc.).
- **New: manual "Look up" button** next to the UPC field. Forces a fresh fetch bypassing the L1 in-memory and L2 Firestore caches — useful when a previous lookup got cached as a miss (rate limit / transient error) and you want to retry now that things are working.
- **New: rolling 30-day cost stat tile** — shows total product-usage cost over the last 30 days. Math correctly attributes each product's cost proportionally to the days of its lifespan that fall within the window, so two $5 products used sequentially over 30 days correctly totals $10, not $20. Updates as the window rolls forward each day.
- **Mobile: "Where" row split into separate rows.** Was one cramped line with size · store · buyer · card all squished together; now each is its own labeled row, easier to read and tap.
- **Edit dialog: product image preview** appears near the UPC status when one's set (after lookup or for existing products with stored imageUrl).

### v0.15.0 — 2026-04-29
- **New: Favorites view.** A new top-level tab alongside Table / Dashboard / Activity. Favorites are products you remember and want to keep handy — even if you didn't formally track them. They live in their own catalog and **don't affect any stats, charts, reorder reminders, daily-cost calcs, or dashboard cards.** Each card shows the type chip (color-coded, same hash as mobile chips), product name, optional 1–5 star rating, your "why I liked it" note, the image (from UPC lookup), and — if you have a UPC and any tracked products that share it — a *"Last used Mar 14 · tracked 3 times"* line.
- **+ Add favorite** opens the existing Add dialog in a simplified mode (the date/cost/store/buyer/bundle fields are hidden via CSS; rating + "why" fields appear). Same UPC lookup auto-fills name/type/image. Same scanner. Same image thumbnail.
- **Track new** button on each favorite pre-fills the Add dialog with the catalog data so you can start tracking a new instance of a remembered product in one tap. The favorite stays in the catalog; cross-reference stats refresh automatically once you add the new tracked row.
- **Edit / Remove** per favorite, same look as elsewhere. Remove only deletes the catalog entry; tracked instances of the same product (if any) are NOT affected.
- **Filtering:** every existing aggregate (`renderStats`, `groupAllocatedSpend`, `categoryDailyRate`, all charts, reorder reminders, trends panel, search dropdown, bundle helpers, price history) now goes through a `trackedOnly()` helper that excludes favorites. `isInventory` / `isActive` / `isFinished` also got a `!p.favorite` guard at the source so favorites can never accidentally be classified as inventory items.

### v0.14.4 — 2026-04-29
- **Full favicon coverage.** v0.13.0 had only `favicon.svg` declared, which works on modern desktop browsers but doesn't cover iOS home-screen icons, Android Add-to-Home, browser-chrome tinting, or legacy fallbacks. Added: 32×32 PNG (browser tab fallback), 180×180 apple-touch-icon (iOS home-screen), 192×192 + 512×512 PNGs (Android adaptive icons / PWA install). All generated from the existing SVG via `npx sharp-cli` so the design is consistent across every output.
- **PWA manifest** at `manifest.webmanifest` — name, short_name, icons array, theme_color (`#2b5fd9`), background_color, display:standalone, scope `/usage/`. Means Android users can "Add to Home Screen" and get a real installable app icon, not a screenshot. Linked from `index.html` only — share.html and 404.html are not PWA entry points.
- **`theme-color` meta tag** (`#2b5fd9`) on all three pages — tints the browser chrome on Android Chrome, iOS PWA top bar, and other mobile browsers that respect it.
- **iOS PWA meta tags** on index.html (`apple-mobile-web-app-capable`, `-status-bar-style`, `-title`) so when iOS users add the app to their home screen, it opens in standalone mode with the right title.

### v0.14.3 — 2026-04-29
- **OG image: PNG version added.** Twitter/X, Facebook, and LinkedIn all reject SVG og-images, so v0.13.0's SVG-only setup meant those platforms fell back to a text-only embed. Generated a 1200×630 PNG (35KB) from the existing SVG and committed it. The PNG is now the primary `og:image`, with the SVG kept as a secondary entry for platforms that prefer it (Discord/Telegram render SVG fine). Result: full image-embed coverage across every major social/messaging platform.
- **Filled in smaller OG gaps:** `og:url` was missing on `share.html` and `404.html` (only set on `index.html`); added. `og:locale` set to `en_US` on all three pages.
- **Twitter Cards refinement:** `twitter:image` now points to the PNG; added `twitter:image:alt` for accessibility.

### v0.14.2 — 2026-04-27
- **Fixed: `$/day` math no longer double-counts sequential products.** The "$/day by product type" chart and the "YTD daily cost" stat tile previously summed each product's individual `$/day` rate within a category. That double-counted when you used multiple products of the same type sequentially — two $5 underarms used in succession over 30 days showed as `$0.67/day` (each product's `$5/15 = $0.33` summed) when reality is `$10 / 30 = $0.33/day`.
- **New per-category math:** total spend on that category ÷ span its products covered (earliest start to latest end-or-today). Single-product categories give the same answer as before; multi-product categories now match intuition.
- **YTD daily cost** is now the *sum* of per-category rates (correct, because categories are typically used in parallel — toothbrush + soap + shampoo all run concurrently — and summing across categories doesn't double-count). Tooltip on the tile updated to explain the math.
- **Trends panel "highest daily-cost category" insight** also uses the new math.

### v0.14.1 — 2026-04-27
- **New: One-tap Finish button on active products.** A green **Finish** button appears next to Edit on every active row (and prominently as a primary green button on every active mobile card). Tap it → a tiny dialog opens with the end date pre-filled to today; confirm and the product is marked finished. The date input enforces "can't end before start" and "can't end in the future." Replaces the old multi-step path of opening the full Edit dialog just to set the end date.

### v0.14.0 — 2026-04-27
- **New: Product search.** A search input above the row-filter tabs lets you live-filter the table across product name, type, store, buyer, notes, UPC, and card-last-4 — case-insensitive substring match. AND-combines with the existing row-filter tabs (All / Active / Inventory) and chip filters above. Reset clears search alongside everything else. Empty state explicitly says when zero products match the typed query.
- **New: Search autocomplete.** As you type, a dropdown appears below the input with up to 8 matching products. Each shows the thumbnail, name, color-coded type, and status badge. Click any suggestion to jump straight to its Edit dialog. Keyboard nav: **↑/↓** to highlight, **Enter** to open, **Escape** to clear and close.
- **Mobile: type chips are bigger and color-coded.** The Type chip in each mobile card now uses a deterministic color from the chart palette per product type (Toothpaste always renders one color, Shampoo always another, etc., based on a stable hash of the type name) — makes categories scannable at a glance. Bumped from 11px / tight padding to 13px / 5×12 padding so they're easier to tap. Custom types you add get colors automatically.
- **Re-discovery hint:** the chip-click filtering has been there since v0.7.10 desktop / v0.7.22 mobile — tap any Type / Buyer / Card chip on a row to filter to just that value, with the active filter showing as a dismissible chip above the table.

### v0.13.1 — 2026-04-27
- **Fixed: Activity log now syncs across devices.** It was localStorage-only since v0.7.17, so signing in on another device meant a blank activity page even though the products themselves synced. Now stored at `/users/{uid}/activity/{logId}` in Firestore — same per-user isolation as everything else, no security rules change required (existing wildcard match already covers any subcollection). One-time migration on first sign-in after this update copies any localStorage entries into Firestore (and archives the local key to `usage.activity.v1.<uid>.migrated` rather than deleting). The Clear button now wipes the synced log everywhere, with a clearer confirm message reflecting that.

### v0.13.0 — 2026-04-27
- **New: Open Graph + Twitter Card meta tags.** When you paste a link to the app into Slack, Discord, iMessage, Twitter/X, etc., the embed now renders a clean branded preview — Usage Tracker name, one-line description, and a 1200×630 SVG image with the wordmark, instead of the bare URL plain-text. `index.html`, `share.html`, and `404.html` each have appropriate tags. Caveat for share links: because the shared product data lives in the URL hash (`#d=...`) which crawlers can't see, the embed always shows generic share-page metadata — not the specific product. A future v0.13.x could add product-specific embeds via a parallel `?title=...&img=...` query that crawlers do see.
- The OG image is an SVG (`og-image.svg`); platforms that require raster (notably Twitter/X) will fall back to no image but still render the title/description text. Adding a parallel `og-image.png` for full coverage is a follow-up — easiest path is to screenshot the SVG at 1200×630 in a browser, save as PNG, commit, and add a second `og:image` tag.

### v0.12.0 — 2026-04-26
- **New: Multi-currency display.** A currency selector appears in the display-controls bar above the stats with 15 common options — USD, EUR, GBP, CAD, AUD, JPY, INR, MXN, CHF, CNY, BRL, KRW, NZD, SEK, NOK. Pick one and every dollar value across the table, stats, dashboard, charts, mobile cards, and exports renders in that currency, using your browser's locale conventions for symbol placement and decimals (so `$1,234.56` becomes `1.234,56 €` for a European visitor selecting EUR, `¥1,234` for JPY's no-decimal rendering, etc.). The cost-input prefix in the Add/Edit dialog updates to match. Choice persists per browser. Note: this is a display setting only — underlying stored numbers don't convert. If you bought toothpaste for $3.99 USD and switch to EUR, it'll show as €3.99 (not converted). Suitable for users who track in one currency at a time, including travelers who switch when they relocate.

### v0.11.0 — 2026-04-26
- **New: Read-only share links.** Every row and mobile card now has a **Share** button. Click it to get a public URL that anyone can open to see a clean read-only card view of just that product — its image, name, type, status, dates, duration, size, cost, store, bundle position, and UPC. The recipient can't edit anything, can't see your other products, and doesn't need a Google account. The shared data lives entirely in the URL itself (base64-encoded after `share.html#d=...`), so nothing is stored server-side and the link can't outlive your control of it. Sensitive fields (buyer, card-last-4, notes, internal IDs) are deliberately NOT included. The dialog has a "Copy link" button (plus an "Open in new tab" button to preview what the recipient will see).

### v0.10.1 — 2026-04-26
- **Fixed: Amazon "Check current price" link returning no results.** Amazon's search-by-UPC indexing is sparse — many products that DO sell on Amazon don't have their UPC in the indexed metadata, so a search for the bare UPC misses. The link now uses the **product name** when one's been entered (the most reliable Amazon search input), falling back to UPC only when the name field is blank. The link's `href` updates as you type the name so the search is always current.

### v0.10.0 — 2026-04-26
- **New: Reorder reminders.** When you have at least two finished products of a given type, the app learns your average lifespan for that category. Whenever an active product gets within 15% of (or past) that average, it shows up in a small panel above the stats bar with a one-click link to its Edit dialog. *"Crest 3D White: 28d of ~32d avg, ~4d left."* Once you mark it finished and start a new one, the reminder clears. Top 5 most-urgent shown so the panel stays compact.

### v0.9.0 — 2026-04-26
- **New: "Check current price on Amazon" link.** When you've entered a UPC of 8+ digits in the Add or Edit dialog, a small chip-link appears below the UPC field. Click it and Amazon's search page for that UPC opens in a new tab — useful for sanity-checking your purchase price against current market when adding or editing a product. Closes the v0.9.0 roadmap item (manual market-price tracking field is intentionally not included; the link gives 90% of the value with no extra data shape).

### v0.8.0 — 2026-04-26
- **New: Price history per UPC.** Whenever two or more of your products share the same UPC (e.g. recurring purchases of the same toothpaste), a **History** button appears on the row (and on the mobile card) next to Edit / Duplicate / PNG. Click it to see a line chart of cost over time across every purchase of that UPC, plus a table beneath showing each purchase, its store, buyer, and the delta vs the first purchase. Color-coded: rises in red, drops in green. Uses your current pre-tax / with-tax preference (the toggle above the stats bar) and labels which mode it's showing.
- Helps answer "is this getting more expensive over time?" without scanning the table by hand.

### v0.7.23 — 2026-04-26
- **QoL trio.**
  - **UPC field autofocuses when Add dialog opens** — start typing or scanning immediately, no extra tap.
  - **`n` keyboard shortcut opens Add product** — works anywhere on the page when no input/dialog has focus, no modifier-key conflicts (Ctrl-N still opens a new browser window).
  - **Spinner during UPC lookup** — small spinning ring in the status text while the request is in flight, so you know something is happening (especially useful with the Apps Script proxy hop).

### v0.7.22 — 2026-04-26
- **Mobile filter chips.** On desktop, tapping a Type / Buyer / Card cell in the table has filtered the view since v0.7.10. Mobile cards previously rendered those values as plain text in the *Where* line, so the same filter shortcut wasn't available. Now: Type renders as a tappable chip in each card's head, and Buyer + Card render as inline chips in the *Where* line — same look and feel as the desktop chips, same active-filter bar above the cards. Closes the deferred mobile-parity item from v0.7.10.

### v0.7.21 — 2026-04-26
- **New: persistent UPC cache.** Every successful UPCitemdb / OpenFoodFacts lookup is now saved to `/users/{uid}/upcCache/{upc}` in Firestore. Subsequent lookups of the same UPC — on any device, in any session — skip the live API entirely. **You'll never burn quota for the same product twice.** Even cache *misses* are stored (with `source: 'miss'`) so dead UPCs don't keep retrying when the rate limit resets.
- **New: OpenFoodFacts as a backup database.** When UPCitemdb misses, returns `EXCEED_LIMIT`, or has a network blip, the app now tries OpenFoodFacts as a second source. Their database is open, free, has wide-open CORS, and has grown to include personal-care products (toothpaste, soap, shampoo, deodorant) alongside food. Coverage isn't as broad as paid databases, but combining UPCitemdb + OFF significantly raises the hit rate. The cached doc records which source provided the data so we can debug coverage later.

### v0.7.20 — 2026-04-26
- **Fixed: UPC lookup actually works now.** Since v0.6.0 the auto-fill from UPCitemdb has been silently broken — UPCitemdb's free trial endpoint sends `Access-Control-Allow-Origin: https://www.upcitemdb.com`, so every fetch from `itsavibecode.github.io` was rejected by the browser before our code ever saw a response. The catch block tucked a tiny "Lookup failed — check connection" message under the field; easy to miss. Routed through a Google Apps Script web app (server-to-server, no CORS) so the request now actually reaches UPCitemdb and returns. The trial database is still rate-limited (100/day per Google Apps Script IP, shared across many users), so EXCEED_LIMIT failures still happen — but they're now clearly surfaced with the message *"UPC database busy — try again in a minute, or enter manually."*
- **More visible UPC status feedback.** The status text under the UPC field bumped from 12px muted-grey to 13px medium-weight, and error / OK states now show as tinted pills (red and green respectively) instead of inline-color-only text. Less easy to miss when the lookup fails or succeeds.

### v0.7.19 — 2026-04-26
- **New: custom 404 page.** Until now, anyone hitting a typo'd or stale URL under `itsavibecode.github.io/usage/...` saw GitHub's generic black-bar "There isn't a GitHub Pages site here" message — looked like the site itself was broken. Replaced with a clean self-contained `404.html` that matches the rest of the site (favicon, primary blue, system fonts, version footer) and offers a one-click button back to the working app. Standalone — no app.js, Firebase, or auth dependency, so it renders even for signed-out visitors and even if the main bundle has issues.

### v0.7.18 — 2026-04-26
- **Trend panel fix: "highest daily-cost category" insight now uses finished products only.** Previously this generator summed `$/day` across both finished and currently-active products. Active products use today's date as a preliminary endpoint, so their rate is a moving target — including them inflated the "burn rate" with not-yet-final data. The insight now waits until you have at least three finished products of any type before it'll fire, then reports the category with the highest combined real (finished) burn rate.

### v0.7.17 — 2026-04-26
- **New: Activity log.** A new **Activity** tab sits alongside Table and Dashboard. Every product save records a timestamped entry — `Add`, `Edit`, `Duplicate`, or `Delete` — with the product name and type. Each entry has a clickable name link that opens the product's Edit dialog (or shows the name struck-through if the product has since been deleted). Dropdown selector lets you choose how many recent entries to show — **25 / 50 / 100 / 150**. A Clear button wipes the local log.
- **Storage choice:** activity entries are kept in `localStorage` per signed-in account (capped at 500, rolling). The product timestamps themselves (`createdAt`) live durably in Firestore so the moment a product was added is preserved even if you clear the browser. Existing products from before this update get a one-time `createdAt` backfill on first sign-in (inferred from `purchaseDate` / `startDate`, falling back to a 1970 sentinel for rows with neither).
- The activity log is private to your browser — sharing the same Google account on another device starts a fresh log there.

### v0.7.16 — 2026-04-26
- **New: PNG export — three formats.** Each product row now has a **PNG** button next to Edit / Duplicate / Delete that downloads a clean **4:3 product card** (1200×900) showing the product's image, type, name, status badge, started/ended dates, duration, cost, $/day, $/unit, size, and store. The Dashboard view also has two new buttons: **Export dashboard PNG** (4:3, 1600×1200) which captures every chart plus a stats strip, and **Export overview PNG** (5:7 portrait, 1000×1400) for share-friendly mobile-shaped output. All three exports are clean rendered cards — not screenshots of the live UI — so they don't include the toolbar, scroll bars, or any other page chrome.
- The PNG library (`html2canvas`) is lazy-loaded the first time you click an export button — no impact on initial page load.

### v0.7.15 — 2026-04-26
- **New: product thumbnails next to the name.** When a UPC lookup against UPCitemdb returns one or more product images, the first HTTPS image is now stored with the product and rendered as a small square thumbnail to the left of the product name — both in the desktop table and at the top of every mobile card. Existing products without an image just show the name as before; running a fresh UPC lookup on them (clear and re-enter the UPC, then accept the prefill prompt) populates the thumbnail. HTTP-only image URLs are skipped to avoid mixed-content blocks on the HTTPS-served site, and a broken-image fallback removes the `<img>` cleanly if the host ever fails.

### v0.7.14 — 2026-04-26
- **Bundle guardrails: Continue-bundle dropdown shows fill state and disables full bundles.** Each option in **Continue existing bundle** now reads e.g. `Crest Toothpaste — Apr 12 (× 3) — 2/3` so you can see at a glance which bundles still have room. When all slots are filled, the option says `3/3 (full)` and is disabled (greyed by the browser, unselectable) so you can't accidentally try to continue a full bundle.
- **Bundle guardrails: position uniqueness on save.** If you try to save a bundle row with a position already claimed by another sibling, you get a clear toast: *"Position 2 is already taken by 'Crest 3D'. Try position 3 — that slot is open."* Editing the current row to its existing position still works fine (a row doesn't conflict with itself).

### v0.7.13 — 2026-04-26
- **New: bundle slide-out panel.** Bundle chips in the table (and on mobile cards) are now buttons. Click one and a panel reveals below the row listing every product that's part of the same bundle — each sibling shows its position number, product name, and a status badge (active / inventory / finished). Click any sibling to jump to its Edit dialog. The current row is highlighted so you can tell where you started. The panel also shows how many slots are still unfilled (e.g. "1 slot unfilled"). On mobile, the same panel renders inline at the bottom of the card. Click the chip again, the × button, or another bundle's chip to close.
- **Under the hood: shared `bundleId` field.** Every bundled product now carries a shared `bundleId` so the slide-out can find siblings without guessing. Brand new bundles get a fresh ID at save time. **Continue existing bundle** copies the source's bundleId, and **Duplicate** of a bundled row inherits its bundleId so the duplicate becomes another sibling rather than starting a separate bundle (position is intentionally NOT copied — siblings need unique numbers).
- **One-time migration runs in the background** the first time a user with legacy bundled rows signs in after this update. It groups bundled rows by `(productName, purchaseDate, bundleSize)` and assigns shared bundleIds plus sequential positions where missing. A small toast confirms how many rows were grouped. Edge case: two separate same-day same-size purchases of the same product would be merged — accepted trade-off for a personal usage tracker.

### v0.7.12 — 2026-04-25
- **New: trends panel above the stats bar.** Shows one rotating insight about your data — "You've spent the most on Toothpaste so far ($24.30 across 6 items)", "Your Crest Toothpaste has been going for 14 days — your longest active product right now", "You've finished 3 products in the last 30 days", and a few others. Five generators total, shuffled per page load so reloads surface different angles. When there's not enough data for a real insight (new accounts, or just one or two products), the panel falls back to a curated "Did you know" fact tied to a product type you actually have (toothbrush replacement timing, deodorant lifespan, shampoo water content, and so on — eight categories × three facts each). The panel hides itself entirely when there are zero products. Computed once per page load and frozen for the session, so Firestore snapshot updates don't reshuffle the line under you mid-glance.

### v0.7.11 — 2026-04-25
- **New: three dashboard charts.**
  - **$/day by product type** — horizontal bar chart of summed cost-per-day per category. Tells you which categories burn the most cash per day. Inventory rows fall through (their $/day is null until they're started).
  - **Purchases by product type** — count of all rows per category, including inventory. Tells you what you're buying most often.
  - **Longest-running products** — combined active + finished, top 10 by duration. Active products colored primary; finished colored slate so you can tell at a glance which ones are still running. Tooltips show "X days running" or "X days used" depending on status.

### v0.7.10 — 2026-04-25
- **New: clickable filter chips on Type / Buyer / Card cells.** Tap any of those table cells to drill into "only rows where this column equals this value." A new bar appears above the table showing each active filter as a dismissible chip (`Buyer: Frank ×`). Tap a chip's × to remove it, or use the **Clear all** link when two or more filters are active. Multiple filters AND together (e.g. `Buyer: Frank` + `Type: Toothpaste`). Selection persists per browser via `localStorage`. The existing **Reset** button now clears both the row-filter tabs and any active chip filters in one go.

### v0.7.9 — 2026-04-25
- **Desktop: Notes column no longer expands the table.** Long notes (>40 chars) render as a small pill-shaped chip showing the first 40 characters and an ellipsis. Click the chip to expand the cell inline (full text wraps; the row grows to fit). Click the expanded text to collapse again. Short notes still render as plain inline text — no chip overhead. Expansion state is shared with the mobile show-more state, so opening a row's detail on phone and switching to desktop keeps it open.

### v0.7.8 — 2026-04-25
- **Mobile: sort dropdown above the cards.** Desktop has clickable column headers, but on mobile the table renders as a stack of cards with no visible headers. The new dropdown (visible only at viewport ≤720px) offers Newest first / Oldest first / Name (A → Z) / Highest $/day / Highest cost — each option sets the same `sortState` the desktop headers use, so the underlying sort logic is shared.
- **Mobile: "Show more / Show less" per card.** Cards now collapse the *Where* (size · store · buyer · card) and *Notes* rows by default to keep the visible card compact. Tap **Show more** to reveal them; tap again to collapse. Cards that have nothing to hide don't show the button at all. Expansion state is per-card, kept in memory while the page is open.

### v0.7.7 — 2026-04-25
- **Fixed: inventory items no longer count toward spend tiles.** Until you actually start using a product, it's just sitting on a shelf — counting it as "spent" mixed cash-flow accounting with the app's usage-tracking purpose. Affects: **Total spend** tile, **YTD spend** tile, **Top category by spend** dashboard card, **Top store by spend** dashboard card, and both dashboard charts (Allocated spend by product type, Allocated spend by store). Inventory items snap into all spend metrics the moment you set a Start date. Counts (Active / Inventory / Finished tiles) are unchanged. Tile tooltips updated to explain the rule.

### v0.7.6 — 2026-04-24
- **New: Pre-tax display toggle.** A small switch sits above the stats bar — flip it on and every dollar value in the app (stat tiles, table cells, dashboard charts, mobile cards, YTD totals) recomputes using `cost` only and ignores `costWithTax`. Single chokepoint: every monetary calculation flows through `effectiveCost()`, so one function change drives the whole UI. The "w/ Tax" table column is hidden entirely when the toggle is on (per user preference — no `—` placeholder rows). Choice persists per browser via `localStorage`.
- **CSV import template: bundle column shows `Y` / `N` instead of `true` / `false`.** Easier to read and write in a spreadsheet. The parser already accepted both.

### v0.7.5 — 2026-04-24
- **Fixed: "Continue existing bundle" was overwriting an empty Start date with today.** When the inventory concept landed in v0.7.3, the bundle-continue handler was missed — line 890 of `app.js` still wrote `new Date().toISOString().slice(0, 10)` into `startDate` every time you picked a bundle. So even though we'd told users "leave Start date blank for inventory," picking a bundle to continue silently filled today's date back in. Reported on both mobile and desktop. Now the handler clears both `startDate` and `endDate`; the toast message changed to "Bundle details filled — leave start date blank to record as inventory."
- **New: Duplicate button** next to Edit and Delete in every row (and in the bottom of every mobile card). It opens an Add dialog pre-filled with the source row's metadata — name, type, size, unit, cost, store, buyer, card, UPC, bundle status + size — but **leaves both dates blank** so the new entry registers as inventory until you actually start using it. Bundle position is intentionally NOT carried over (siblings within a bundle should have unique positions). Title bar of the dialog reads "Duplicate product" so you can tell it apart from a fresh Add.

### v0.7.4 — 2026-04-24
- **Mobile: the table now becomes a stacked card view on phones.** Below 720px viewport width, the 1400px-min horizontal scroll is gone — each product renders as a self-contained card showing the type, name, status badge, start date + duration, cost + $/day, size/store/buyer/card, bundle position (if any), and notes. Edit/Delete buttons live at the bottom of the card with touch-friendly hit targets. Same DOM as desktop — CSS just flips the layout — so the existing event handlers and live-update plumbing keep working without changes.
- The stats bar squeezes to two columns on phones; row-filter tabs already wrap.

### v0.7.3 — 2026-04-24
- **New: Inventory concept.** A product without a `startDate` is now treated as **inventory** — purchased but not yet in use. The form's *Start date* is no longer required, and a hint under it explains the inventory behavior. Inventory items don't affect any daily-cost calculations until you set a start date.
- **New: filter tabs above the table** — *All / Active / Inventory*. Choice persists in `localStorage` per browser, and a **Reset** button clears it back to *All*. Empty-state messages are filter-aware ("No active products right now…", "No products in inventory…").
- **New: Inventory stat card** in the summary bar, between Active and Finished. Active now means "started, not yet finished" (was previously "no end date", which conflated active with inventory).
- **New: end-date column shows status badges** — `inventory` (gold) for items without a startDate, `active` (green) for items started but not finished, or the actual end date for finished items.
- **New: CSV import** alongside JSON. The Import dropdown now offers **Import from file…**, **Download CSV template**, and **Download JSON template**. CSV opens cleanly in Excel/Numbers/Sheets. Parser is RFC-4180 compliant (handles quoted fields, embedded commas/quotes/newlines, and strips Excel's UTF-8 BOM).
- The CSV template includes one example active row and one example inventory row (blank `startDate`) so the difference is immediately visible.

### v0.7.2 — 2026-04-24
- **Stat cards cap at 2 decimals** for all money values. The YTD daily cost card was rendering with 4 decimals (e.g. `$1.8597`) because it was using the fine-grained `moneyFine` formatter; swapped it to the standard `money` formatter.
- **"in use" indicator reformatted** in the Duration column — now a smaller, uppercase-muted suffix on its own line under the day count, instead of inline on the same line.
- **Bundle badge distinguishes originator from members.** The row that introduced a bundle purchase keeps the deeper-tinted "bundle × N" chip; sibling rows recorded via **Continue existing bundle** show the lighter "N of M" chip. Makes it easy to spot the canonical bundle row.

### v0.7.1 — 2026-04-24
- **Fixed: bundle fields were still showing when "Part of a bundle" was unchecked.** The HTML `hidden` attribute was being overridden by the component-level `.field { display: flex; }` rule — a classic CSS specificity gotcha. Added a global `[hidden] { display: none !important; }` rule so `hidden` works reliably on any element.
- **New: Year-to-date (YTD) summary cards** in the stats bar — **YTD spend** (sum of allocated cost for products purchased in the current calendar year) and **YTD daily cost** (sum of $/day for products that were in use at any point this year). Legacy rows without a `purchaseDate` fall back to `startDate` for the spend calculation.
- **Audit (no code change)**: verified there is no code path that can overwrite one product's UPC when another product with the same name is saved. Every Firestore write goes to `users/{uid}/products/{product.id}`, and every Add generates a fresh `crypto.randomUUID()`. If you see two rows with the same UPC, the most likely cause is the **Continue existing bundle** dropdown, which intentionally copies UPC + other fields from the source row — so you end up with a new row that shares the source's UPC, not the source being overwritten.

### v0.7.0 — 2026-04-24
- **Fixed off-by-one date display** in the table. Dates coming from `<input type="date">` are `YYYY-MM-DD` strings; `new Date("2026-04-20")` parses those as UTC midnight, which in any negative-offset timezone renders as the day before. New `parseLocalDate()` helper parses date-only strings as local dates, fixing both `formatDate()` (table display) and `daysBetween()` (duration math). The edit dialog already showed the correct value because `<input type="date">` reads the string directly.
- **New: bundle position field.** When **Part of a bundle** is checked, the form now asks two questions: how many are in the bundle, and *which number* of the bundle this row represents (e.g., #2 of 3). Enforced in validation: must be an integer between 1 and the bundle size. Table badge now reads **"2 of 3"** instead of **"bundle × 3"** when a position is known. Older rows without a position still render as before.
- **Fixed: bundle size field never cleared when unchecking.** Unchecking **Part of a bundle** now also clears `bundlePosition` alongside `bundleSize`. The size + position inputs are required only while the checkbox is on.
- **New: Import template download.** The **Import** button is now a dropdown with two options: **Import from file…** (existing behavior) and **Download template**. The template is a self-documenting JSON file with one placeholder product, a `_help` block explaining each field, and sensible today's-date defaults — edit in any text editor and re-import.

### v0.6.1 — 2026-04-24
- **Hotfix for v0.6.0 regression**: the initialization of the product form (`const f = form()`) was declared *after* the UPC field's `blur` listener tried to reference it, triggering a `const` temporal-dead-zone `ReferenceError` during `DOMContentLoaded`. That error aborted the rest of the init handler, so the auth listener never attached — which is why the sign-in UI, data table, and dashboard all appeared blank, and why scanning a UPC filled the input but never kicked off a database lookup.
- Fix: reordered the init so the form reference and its submit/bundle-size listeners are wired up *before* the UPC + scanner handlers that depend on it. No behavior changes beyond the fix.

### v0.6.0 — 2026-04-24
- **UPC field is now first** in the Add/Edit dialog and visually highlighted — fill this in first and the rest of the form can auto-populate.
- **UPC database lookup**: after a scan or manual UPC entry, we call the free [UPCitemdb](https://www.upcitemdb.com/) trial endpoint. On a hit, a **Match found** confirmation dialog shows the brand, title, category, and size from the database.
  - Choosing **Yes, use this** pre-fills product name, product type (mapped from category), and size + unit (parsed from the database's size string).
  - Fields you've already typed into are **never overwritten** — the lookup only fills blanks.
- **Click product name to edit** — on the table, the product name is now a link that opens the Edit dialog. Much easier to reach on narrow screens than the Edit button at the far right.
- UPC status line under the field tells you what happened ("Looking up product…", "Match: Colgate — …", "No match — enter details manually"). Lookups are cached in memory so re-scanning the same UPC doesn't burn another API call.
- Trial endpoint limits are 100 requests/day per IP. If you hit it, the status line tells you and you can still enter details manually.

### v0.5.0 — 2026-04-24
- **UPC camera scanning**: new **Scan** button next to the UPC field in Add/Edit. Opens a modal with a live camera preview and a reticle overlay; decodes the barcode with `@zxing/browser` and fills the UPC input on first valid read.
- Back camera (`environment`) preferred on phones; falls back to the default camera elsewhere.
- ZXing loaded as ESM from `https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm` and **lazy-loaded** — the ~100 KB bundle only downloads the first time you tap Scan.
- Friendly error states for denied permission, missing camera, and camera-in-use.
- Scanner cleanly releases the camera on close / Esc / `dialog.close`.

### v0.4.0 — 2026-04-24
- **Phase 5 — Dashboard**: new **Table / Dashboard** view tabs below the stats bar.
  - Dashboard adds four summary cards: avg $/day (active), avg lifespan of finished products (days), top category by spend, top store by spend.
  - Three Chart.js v4 charts: donut of allocated spend by product type, horizontal bar of allocated spend by store, 12-month bar of products finished per month.
  - All dashboard metrics and charts refresh live from the Firestore `onSnapshot` stream.
- Chart.js imported as ESM from `https://cdn.jsdelivr.net/npm/chart.js@4.4.0/+esm` — no build step, no new dev dependency.
- Chart instances are torn down on sign-out to avoid leaking canvases across sessions.

### v0.3.0 — 2026-04-24
- **Phase 3 — Google Sign-In**: full-page sign-in card when signed out; after sign-in the header shows avatar, name, and a Sign out button. Only `profile` + `email` scopes requested.
- **Phase 4 — Firestore backend**: product data and custom types moved from `localStorage` to `/users/{uid}/products/{id}` and `/users/{uid}/meta/customTypes`. Reads use `onSnapshot` for live cross-device sync.
- **Security rules** (`firestore.rules`): per-user isolation enforced by `request.auth.uid == userId`.
- **One-time migration**: any pre-existing localStorage entries are detected on first sign-in, the user is prompted, and the data is copied to Firestore. Local entries are suffix-archived as `.migrated` — never deleted.
- App script is now an ES module importing the Firebase v12.12.1 modular SDK from `gstatic.com`.
- New files: `firebase-init.js`, `firestore.rules`.

### v0.2.0 — 2026-04-23
- **Product type** dropdown: replaced generic list with specific seed (Underarm, Toothbrush, Toothpaste, Floss, Mouthwash, Facewash, Shampoo, Soap); added **+ Add new type…** at the bottom, custom types persist in `localStorage`.
- **Store / Buyer / Card** fields converted to recently-used dropdowns with **+ Add new…** at the bottom.
- **Cost with tax** is no longer required. When empty, calculations fall back to pre-tax cost.
- **Cost fields** display `$` prefix and auto-format to two decimals on blur.
- **Bundle purchases**: when "Part of a bundle" is checked, a `Bundle size` field appears. Allocated cost is `cost / bundleSize`, and the stats bar sums allocated costs so bundles aren't double-counted.
- **Continue existing bundle** selector at the top of the Add dialog — pick an existing bundle to pre-fill all product details for the next unit.
- **Sortable table headers** — click to sort, click again to reverse. Default sort is `startDate desc`.
- CSV export now includes `allocatedCost` and `bundleSize` columns.
- JSON export/import round-trips custom product types.

### v0.1.0 — 2026-04-23
- Initial release
- Phase 1: full data schema with 16 product fields + 3 calculated fields
- Phase 2: add/edit/delete form, localStorage persistence, JSON import, JSON + CSV export, summary stats bar
- Custom SVG favicon
- Responsive layout
