# Usage Tracker

**Version:** v0.1.0

A personal product usage tracker. Log everyday products you buy (food, toiletries, cleaning supplies, etc.), when you start and finish them, and what they cost — then get a clear picture of per-unit and per-day cost, total spend, and which items are still active.

Hosted as a static site on GitHub Pages. Phases 1–2 are complete; later phases add Google Sign-In, cloud storage, and a dashboard.

---

## Current status (v0.1.0)

### ✅ Phase 1 — Data structure
Data schema and calculations are in place. Each product stores:

| Field | Type | Notes |
|---|---|---|
| `id` | string | Internal UUID, auto-generated |
| `productType` | enum | Food, Beverage, Personal Care, Cleaning, Health/Medicine, Pet, Household, Office, Other |
| `productName` | string | |
| `size` | number | |
| `unit` | enum | count, oz, fl oz, lb, g, kg, mL, L, gal, ft, m, pack, roll, sheet, load, serving |
| `startDate` | date | When you started using the product |
| `endDate` | date | Empty = still in use |
| `cost` | number | Pre-tax price |
| `costWithTax` | number | Total paid |
| `bundleStatus` | boolean | Part of a bundle purchase |
| `store` | string | |
| `buyer` | string | |
| `cardLast4` | string | Last 4 digits of payment card |
| `purchaseDate` | date | |
| `notes` | string | Free-form |
| `upc` | string | **Required** |

**Calculated fields** (derived on the fly, not stored):

- **Duration (days)** = `endDate − startDate` (or `today − startDate` if still in use)
- **Cost per unit** = `costWithTax / size`
- **Cost per day** = `costWithTax / duration`

### ✅ Phase 2 — Input form
- Full add/edit dialog covering every field
- Delete with confirmation
- Import JSON
- Export JSON and CSV (CSV includes calculated fields)
- Summary stats bar: tracked count, active, finished, total spend

### 🔜 Phase 3 — Authentication
Google Sign-In via Firebase. Scopes will be kept minimal — only `profile` + `email`, pulling:
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

## Running locally

It's a static site — no build step. Two ways to run it:

```bash
# Option 1: just open the file
open index.html

# Option 2: any static server (recommended for future service-worker / Firebase work)
python -m http.server 8080
# then visit http://localhost:8080
```

Data is stored in `localStorage` under the key `usage.products.v1` until Phase 4 wires in Firestore.

---

## File layout

```
usage/
├── index.html     # markup + form + table
├── style.css      # styling
├── app.js         # logic: storage, calculations, form, import/export
├── favicon.svg    # site icon
└── README.md
```

---

## Version

Version is displayed in the site header next to the logo. It's defined in three places that must stay in sync on each release:

- `APP_VERSION` constant in `app.js`
- `<meta name="version">` in `index.html`
- Visible `v0.1.0` text in the header (`#version` span)
- This README

## Changelog

### v0.1.0 — 2026-04-23
- Initial release
- Phase 1: full data schema with 16 product fields + 3 calculated fields
- Phase 2: add/edit/delete form, localStorage persistence, JSON import, JSON + CSV export, summary stats bar
- Custom SVG favicon
- Responsive layout
