# Usage Tracker

**Version:** v0.6.0

A personal product usage tracker. Log everyday products (shampoo, toothpaste, deodorant, etc.), when you start and finish them, and what they cost — then get a clear picture of per-unit and per-day cost, total spend, and which items are still active.

Hosted as a static site on GitHub Pages with a Firebase Firestore backend. Phases 1–6 are complete. UPC camera scanning added in v0.5.0; UPC database lookup with auto-fill added in v0.6.0.

---

## Current status (v0.6.0)

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
