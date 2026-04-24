# Usage Tracker

**Version:** v0.2.0

A personal product usage tracker. Log everyday products (shampoo, toothpaste, deodorant, etc.), when you start and finish them, and what they cost — then get a clear picture of per-unit and per-day cost, total spend, and which items are still active.

Hosted as a static site on GitHub Pages. Phases 1–2 are complete; later phases add Google Sign-In, cloud storage, and a dashboard.

---

## Current status (v0.2.0)

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

### 🔜 Phase 3 — Authentication
Google Sign-In via Firebase. Scopes kept minimal — only `profile` + `email`, pulling:
- `uid` (unique Google account identifier — used as the primary key for per-user data)
- `email`
- `displayName`
- `photoURL`

No access to Gmail, Drive, contacts, or other Google services.

### 🔜 Phase 4 — Data storage
Firestore, with security rules scoped to `request.auth.uid` so each account can only read/write its own products.

### 🔜 Phase 5 — Dashboard
Charts (usage over time, cost breakdown by category/store) and summary panels (avg $/day, days tracked, most/least expensive categories).

### 🔜 Phase 6 — Deployment
Published via GitHub Pages from the `main` branch.

### 🔭 Future discovery
- Amazon purchase history autofill
- UPC scanning via phone camera (Safari/Chrome on iPhone)

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

Data is stored in `localStorage`:
- `usage.products.v1` — product entries
- `usage.customTypes.v1` — user-added product types

Phase 4 will swap the storage layer for Firestore.

---

## File layout

```
usage/
├── index.html     # markup + form + table
├── style.css      # styling
├── app.js         # logic: storage, calculations, form, sort, import/export
├── favicon.svg    # site icon
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
