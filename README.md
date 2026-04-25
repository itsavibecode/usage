# Usage Tracker

**Version:** v0.7.11

A personal product usage tracker. Log everyday products (shampoo, toothpaste, deodorant, etc.), when you start and finish them, and what they cost — then get a clear picture of per-unit and per-day cost, total spend, and which items are still active.

Hosted as a static site on GitHub Pages with a Firebase Firestore backend. Phases 1–6 are complete. UPC camera scanning added in v0.5.0; UPC database lookup with auto-fill added in v0.6.0.

---

## Current status (v0.7.11)

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
