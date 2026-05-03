/* Usage Tracker — v0.17.0
 * v0.17.0: Desktop table consolidation pass. Four changes shipped together:
 *   1. STORE + BUYER + CARD merged into a single BOUGHT BY column. Each
 *      piece keeps its own filter-chip behavior; missing pieces are
 *      skipped. Sort by BOUGHT BY orders by store first, then buyer,
 *      then card. Saves two columns of horizontal width.
 *   2. New Density toggle (Comfortable / Compact) in the display-controls
 *      bar. Compact tightens row padding and shrinks the table font for
 *      ~15% more rows per screen. Persists per browser at
 *      usage.density.v1.
 *   3. NOTES column auto-hides when nothing in the current view has any
 *      note text. Manual columns preference still applies on top.
 *   4. New Columns dropdown lets the user toggle visibility of any
 *      non-essential column (everything except NAME and ACTIONS). State
 *      persists at usage.columns.v1; "Reset" clears the override and
 *      shows everything.
 *   Bundle siblings panel colspan adjusted 19 → 17 to match the new
 *   total column count (16 desktop + 1 mobile).
 * v0.16.1: $/unit and $/day columns now show 2 decimal places instead of 4.
 *   The 4-decimal precision was forcing horizontal table scrolling on
 *   reasonable-sized monitors, and at personal-tracker scale ($1-2 per oz,
 *   a few cents per day) the extra digits were noise rather than signal.
 *   Affects table cells, dashboard cards, mobile card subtitles, chart
 *   axes/tooltips, trends-panel insight sentences, and PNG export labels —
 *   wherever moneyFine() is called. (moneyFine and money now produce
 *   identical output; left as separate functions for now to keep the
 *   diff minimal.)
 * v0.16.0: Email reorder reminders. New Settings dialog (in the user-chip
 *   toolbar) toggles a daily digest email — the usage-worker Cloudflare
 *   Worker reads /users/{uid}/meta/emailPrefs every morning, computes which
 *   actives are at >=85% of their type's average lifespan, and sends one
 *   email through Resend (max one per week so persistent reminders don't
 *   spam). Email defaults to the signed-in Google account; an override
 *   field lets the user point reminders elsewhere. The in-app reorder
 *   reminders panel is unchanged — the email is just a push version of
 *   the same algorithm.
 * v0.15.5: Mobile card actions row wraps + buttons size to content.
 *   Duplicate button text was wrapping to 2 lines (broken centering,
 *   stretched height) because min-width:64 + padding:16 couldn't fit the
 *   9-char "Duplicate" label. Dropped min-width, allow flex-wrap.
 * v0.15.4: UPC lookup auto-fill now parses size from the product TITLE
 *   when item.size is empty (which is common — UPCitemdb's dedicated size
 *   field is unreliable). New findSizeInString helper scans for
 *   "<num> <unit>" patterns and uses the last match (titles typically end
 *   with the size). Verified against real titles.
 * v0.15.3: Bug fixes + UX polish.
 *   - Fixed: Duplicate of a bundled product was inheriting the source's
 *     bundleId, causing "Position N is already taken" when the user added
 *     a separate physical bundle. Duplicate now starts a fresh bundleId.
 *   - Fixed: toast notifications appeared UNDER modal dialogs because the
 *     dialog top-layer beats CSS z-index. Toast is now a <dialog>.show()
 *     so it lives in the same top layer.
 *   - Fixed: lookupAndOfferUpc was overwriting lookupUpc's specific error
 *     messages with generic "No match" — the user couldn't see what
 *     actually failed. Preserves the specific message now.
 *   - UPC fetch: cache: 'no-store' + console diagnostics to surface what
 *     the proxy actually returned when lookups appear to fail.
 *   - Desktop type chips now color-coded per category (matches mobile).
 *   - Share + PNG combined into one Share button → dialog has both
 *     options (link + PNG export).
 *   - Size auto-decimal on blur for oz/lb/etc.
 * v0.15.2: Brand company logos via logo.dev. Same publishable token used in
 *   the stocks repo. New `brand` field captured from UPCitemdb (and editable
 *   in the dialog). Renders as a circular logo icon in the desktop name
 *   cell, mobile card head, and Edit dialog preview. Falls back to the UPC
 *   product image when no brand is set; both can fail load and self-hide.
 * v0.15.1: Bug fixes + rolling 30-day cost + mobile polish.
 *   - Fixed: purchase date defaulted to tomorrow's UTC date late at night
 *     (off-by-one for negative-offset timezones). Now uses local date.
 *   - Fixed: mobile save button silently failed when HTML5 required
 *     validation tooltips weren't visible. Form is now novalidate; JS
 *     validates explicitly and toasts the specific issue.
 *   - New: rolling 30-day cost stat tile. Sums each tracked product's
 *     proportional cost contribution to the [today-30, today] window.
 *   - New: manual "Look up" button on UPC field bypasses cache so a past
 *     failed lookup can be retried fresh.
 *   - Mobile: "Where" row split into separate Size / Store / Buyer / Card
 *     rows for better visual rhythm and tappability.
 *   - Edit dialog: shows the product image thumbnail near the UPC field
 *     when imageUrl is set.
 * v0.15.0: Favorites — new top-level view alongside Table / Dashboard /
 *   Activity. Catalog of products you remember/liked but aren't necessarily
 *   tracking. Cross-references with tracked products by UPC for "last used /
 *   times used." Doesn't affect any stats, charts, reminders, or trends.
 *   "Track new" button on each favorite pre-fills the Add dialog so you can
 *   start tracking a new instance of a remembered product in one tap.
 * v0.14.4: Full favicon coverage — SVG (modern), 32px PNG fallback,
 *   180px apple-touch-icon, 192/512 PNGs for Android, manifest.webmanifest
 *   so the app is installable as a PWA, theme-color meta tag for mobile
 *   browser chrome.
 * v0.14.3: PNG og-image alongside the SVG (Twitter/X, Facebook, LinkedIn
 *   reject SVG OG images). Added og:url + og:locale on share/404 too.
 * v0.14.2: Honest $/day math. Per-category rate now = total spend on that
 *   category / span its products covered (was sum-of-per-product-rates which
 *   double-counted sequential products of the same type — two $5 items used
 *   over 30 consecutive days now correctly shows as $0.33/day, not $0.67).
 *   Affects: $/day-by-type chart, YTD daily-cost stat, "highest daily-cost
 *   category" insight in trends panel.
 * v0.14.1: One-tap Finish button on active products. Opens a small dialog
 *   with end-date pre-filled to today; confirm marks the product finished
 *   without going through the full Edit flow.
 * v0.14.0: Search & discovery — live search input above the row-filter tabs
 *   with autocomplete dropdown (keyboard nav: ↑↓ Enter Esc); mobile type
 *   chips bumped in size and color-coded per productType for fast visual
 *   scanning.
 * v0.13.1: Activity log moved from localStorage to Firestore so it syncs
 *   across devices (was per-browser before). One-time migration of legacy
 *   localStorage entries on first run after this version. Cleared via the
 *   Activity page's Clear button now wipes the synced log everywhere.
 * v0.13.0: Open Graph + Twitter Card meta tags so links render as branded
 *   embeds in Slack, Discord, iMessage, Twitter/X, etc. New og-image.svg
 *   at standard 1200x630. share.html and 404.html got tags too.
 * v0.12.0: Multi-currency display. User picks one of 15 common currencies in
 *   the display-controls bar; all $ rendering throughout the app routes
 *   through Intl.NumberFormat with that currency code. Cost-input prefix
 *   updates to the chosen symbol too. Underlying numbers don't convert —
 *   it's a display preference, suitable for personal trackers in one
 *   currency at a time.
 * v0.11.0: Read-only share link. New standalone share.html page renders
 *   a base64-encoded product payload as a clean public card. Share button
 *   per row + mobile card opens a dialog with the link + copy-to-clipboard.
 * v0.10.1: Amazon search now uses productName when available (UPC indexing
 *   on Amazon is too sparse to be reliable). Falls back to UPC only when
 *   no name has been entered.
 * v0.10.0: Reorder reminders panel. Surfaces active products approaching or
 *   past their type's average finished lifespan. Capped at 5 most-urgent;
 *   click to open the product for editing.
 * v0.9.0: "Check current price on Amazon" link below the UPC field in the
 *   Add/Edit dialog. Opens amazon.com/s?k={upc} in a new tab. Visible only
 *   when the UPC is at least 8 digits.
 * v0.8.0: Price history per UPC. When two or more products share the same
 *   UPC (recurring purchases of the same item), a "History" button appears
 *   on each row → modal with line chart of cost over time + entry table
 *   showing each purchase and its delta vs the first.
 * v0.7.23: QoL trio — UPC field autofocus on Add, `n` keyboard shortcut to
 *   open the Add dialog, and a small spinning indicator while a UPC lookup
 *   is in flight.
 * v0.7.22: Mobile filter chips — Type, Buyer, and Card cells in mobile cards
 *   are now tappable filter chips (parity with desktop). Closes the deferred
 *   item from v0.7.10.
 * v0.7.21: Persistent UPC cache in Firestore at /users/{uid}/upcCache/{upc} —
 *   once we've ever resolved a UPC, we never hit a live API for it again.
 *   Misses are cached too so dead UPCs don't keep burning quota. OpenFoodFacts
 *   added as a fallback source when UPCitemdb misses or hits EXCEED_LIMIT.
 * v0.7.20: UPC lookup actually works now. UPCitemdb's /trial endpoint sends
 *   `Access-Control-Allow-Origin: https://www.upcitemdb.com`, so every fetch
 *   from this site was being browser-blocked silently — that's why "I haven't
 *   had success with it at all" was the user's experience. Routes through a
 *   Google Apps Script web app (server-side, no CORS) the user deployed.
 *   Proper EXCEED_LIMIT handling + more visible error pills.
 * v0.7.19: Custom 404 page (standalone 404.html). GitHub Pages auto-serves
 *   it for any unknown URL; previously visitors saw GitHub's generic black
 *   error page.
 * v0.7.18: Trend panel fix — "highest daily-cost category" insight now uses
 *   finished products only (no preliminary running rates from active items).
 * v0.7.17: Activity log — `createdAt` durable on Firestore products with
 *   one-time backfill migration; per-action log (add/edit/duplicate/delete)
 *   stored in localStorage per uid. New "Activity" tab alongside Table /
 *   Dashboard with 25/50/100/150 page-size selector and a Clear button.
 * v0.7.16: PNG export — per-product card (4:3, 1200×900), dashboard
 *   (4:3, 1600×1200), and overview (5:7 portrait, 1000×1400). Lazy-loaded
 *   html2canvas + custom off-screen templates so the output is a clean
 *   shareable card, not a screenshot of the live UI chrome.
 * v0.7.15: Product thumbnails — UPCitemdb image URL captured on lookup,
 *   stored on the product, rendered as a small square next to the product
 *   name in the desktop table and mobile cards. HTTPS-only (skips http://
 *   to avoid mixed-content blocks); onerror handler removes broken images.
 * v0.7.14: Bundle guardrails — Continue-bundle dropdown shows fill state
 *   (e.g. "2/3" or "3/3 (full)") and disables full bundles. Position
 *   uniqueness is enforced on save with a helpful "try position N" suggestion.
 * v0.7.13: Bundle model refactor — every bundled product now carries a shared
 *   `bundleId` linking siblings from the same multi-pack purchase. Clicking
 *   a bundle chip slides out a panel listing all members. One-time migration
 *   groups legacy rows. Duplicate of a bundled row inherits its bundleId.
 * v0.7.12: Trends panel above the stats bar. Five real-data insight
 *   generators (most-spent category, longest active, recently finished,
 *   top per-day burn, inventory pile-up) shuffled per page load; falls
 *   back to a "Did you know" fact tied to a product type the user owns
 *   when no generator can fire. Cached once per session.
 * v0.7.11: Three new dashboard charts — $/day by product type (burn rate),
 *   purchases by product type (frequency), and combined longest-running
 *   chart (active + past finished, top 10).
 * v0.7.10: Filter chips — Type / Buyer / Card cells in the table are now
 *   clickable; clicking adds an active filter (AND logic across columns).
 *   Active filters render as dismissible chips above the table.
 * v0.7.9: Desktop notes column collapse — long notes render as a chip,
 *   click to expand inline. State shared with mobile expandedCards Set.
 * v0.7.8: Mobile follow-ups — sort dropdown above cards (Newest / Oldest /
 *   Name / Highest $/day / Highest cost), and a "Show more / Show less"
 *   expander per card that hides Where + Notes by default to save vertical
 *   space.
 * v0.7.7: Inventory excluded from spend aggregations. Total spend, YTD spend,
 *   "Top category by spend", "Top store by spend", and the two dashboard
 *   donut/bar charts now skip products without a startDate. Counts
 *   (Active / Inventory / Finished tiles) unchanged.
 * v0.7.6: Pre-tax display toggle (above stats bar). Single chokepoint:
 *   effectiveCost() respects the toggle so every $ value flips together.
 *   "w/ Tax" column hidden via body.pretax-mode CSS class. CSV template
 *   examples switched to Y/N for bundleStatus.
 * v0.7.5: Fix bundle-continue autofilling startDate (broke inventory mode).
 *   Add Duplicate button next to Edit/Delete.
 * v0.7.4: Mobile card view — at <=720px the table flips to a stacked card
 *   layout per product. No more 1400px-min horizontal scroll on phones.
 * v0.7.3: Inventory concept (blank startDate), filter tabs (All/Active/Inventory),
 *   CSV import + CSV/JSON template downloads.
 * v0.7.0–0.7.2: YTD stats, bundle field show/hide, duplicate-with-bundle,
 *   import templates, date TZ fix, decimal formatting.
 * UPC database lookup via UPCitemdb — populates the form after scan/entry
 *   with user confirmation. Free trial endpoint, 100 req/day/IP.
 * UPC camera scanning (ZXing) lazy-loaded on first tap.
 * Phase 5: Dashboard with Chart.js.
 * Phases 3 + 4: Google Sign-In + Firestore per-user storage.
 * Data lives at /users/{uid}/products/{id} and /users/{uid}/meta/customTypes.
 * Products are synced live via onSnapshot so multi-tab/multi-device stays in sync.
 * Dashboard re-renders on every snapshot (and on view switch). */

import { auth, db, googleProvider } from './firebase-init.js';
import {
  onAuthStateChanged, signInWithPopup, signOut
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import {
  collection, doc, onSnapshot, setDoc, deleteDoc, getDocs, getDoc
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { Chart, registerables } from "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/+esm";
Chart.register(...registerables);

const APP_VERSION = '0.17.0';

const LEGACY_PRODUCTS_KEY = 'usage.products.v1';
const LEGACY_TYPES_KEY = 'usage.customTypes.v1';

const SEED_PRODUCT_TYPES = [
  'Underarm', 'Toothbrush', 'Toothpaste', 'Floss',
  'Mouthwash', 'Facewash', 'Shampoo', 'Soap'
];

const FIELDS = [
  'id', 'productType', 'productName', 'size', 'unit',
  'startDate', 'endDate', 'cost', 'costWithTax',
  'bundleStatus', 'bundleSize', 'bundlePosition', 'bundleId',
  'store', 'buyer', 'cardLast4',
  'purchaseDate', 'notes', 'upc', 'imageUrl', 'createdAt',
  // v0.15.2: brand name (from UPCitemdb response) — drives the company-logo
  // icon via logo.dev. Editable in the dialog so users can correct or fill
  // it in for products without UPC lookups.
  'brand',
  // v0.15.0: favorite catalog entries. When `favorite: true`, the row is a
  // standalone reference (no dates, no cost, no stats impact) — purely a
  // remembered product. Shows up in the Favorites view, never in the main
  // table or any aggregate. Cross-referenced with tracked products via UPC.
  'favorite', 'favoriteRating', 'favoriteWhy'
];

const ADD_NEW = '__add_new__';

/* ---------- module state ---------- */

let currentUser = null;
let products = [];
let customTypesCache = [];
let editingId = null;
let sortState = { column: 'startDate', dir: 'desc' };
let unsubProducts = null;
let unsubTypes = null;
let firstSnapshotSeen = false;
let currentView = 'table'; // 'table' | 'dashboard'
// Row filter for the table view: 'all' | 'active' | 'inventory'.
// Persisted in localStorage so each user's preferred view survives reloads;
// reset via the "Reset filters" button.
const FILTER_KEY = 'usage.tableFilter.v1';
let currentFilter = (() => {
  try {
    const v = localStorage.getItem(FILTER_KEY);
    return ['all', 'active', 'inventory'].includes(v) ? v : 'all';
  } catch { return 'all'; }
})();
// Pre-tax display mode: when true, all cost calculations ignore costWithTax
// and use cost only. Affects effectiveCost (the canonical helper) and
// therefore allocatedCost / calcCostPerUnit / calcCostPerDay / totals / YTD —
// every dollar value in the UI flows through one function. The "w/ Tax"
// table column is also hidden when this is on. Persists per browser.
const PRETAX_KEY = 'usage.preTaxMode.v1';
let preTaxMode = (() => {
  try { return localStorage.getItem(PRETAX_KEY) === '1'; }
  catch { return false; }
})();

// v0.17.0: table density mode. 'comfortable' is the original layout;
// 'compact' tightens row padding and shrinks the font for users who
// want more rows per screen. Persists per browser.
const DENSITY_KEY = 'usage.density.v1';
let densityMode = (() => {
  try {
    const v = localStorage.getItem(DENSITY_KEY);
    return v === 'compact' ? 'compact' : 'comfortable';
  } catch { return 'comfortable'; }
})();

// v0.17.0: per-column visibility for the desktop table. Each entry maps
// a column key (matches data-sort on the th and col-X on the td) to a
// boolean — true = show, false = hide. NAME and ACTIONS are intentionally
// not toggleable (the row would be useless without them) so they're
// absent from this map.
const COLUMNS_KEY = 'usage.columns.v1';
const TOGGLEABLE_COLUMNS = [
  { key: 'productType',  label: 'Type' },
  { key: 'size',         label: 'Size' },
  { key: 'startDate',    label: 'Start' },
  { key: 'endDate',      label: 'End' },
  { key: 'duration',     label: 'Duration' },
  { key: 'cost',         label: 'Cost' },
  { key: 'costWithTax',  label: 'w/ Tax' },
  { key: 'costPerUnit',  label: '$/unit' },
  { key: 'costPerDay',   label: '$/day' },
  { key: 'bundleStatus', label: 'Bundle' },
  { key: 'boughtBy',     label: 'Bought by' },
  { key: 'purchaseDate', label: 'Purchased' },
  { key: 'upc',          label: 'UPC' },
  { key: 'notes',        label: 'Notes' },
];
let columnVisibility = (() => {
  // Default: everything visible. localStorage stores any user overrides.
  const defaults = Object.fromEntries(TOGGLEABLE_COLUMNS.map(c => [c.key, true]));
  try {
    const raw = localStorage.getItem(COLUMNS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch { return defaults; }
})();
// Mobile cards collapse Where + Notes by default to save vertical space.
// Per-product expansion state survives re-renders (in-memory only — no
// localStorage; users open detail temporarily, re-collapses on reload is fine).
const expandedCards = new Set();

// v0.7.13: only one row's bundle slide-out can be open at a time. Tracks the
// product.id whose siblings panel is currently visible. Clicking a different
// chip closes the prior one and opens the new one. Clicking the same chip
// twice collapses. Reset on sign-out via expandedCards.clear() block below.
let expandedBundleRow = null;

// v0.7.17 — Activity log. Stored in localStorage per uid (NOT in Firestore)
// because it doesn't need the same durability/sync guarantees as the product
// data, and avoiding a new subcollection means no firestore.rules change is
// required. Capped at 500 entries with a rolling window so the bucket stays
// small. createdAt timestamps for the products themselves DO live in Firestore
// (they're durable + synced); activity log entries are a derived view.
const ACTIVITY_KEY_PREFIX = 'usage.activity.v1.';
const ACTIVITY_MAX = 500;
// v0.7.17: tracks whether the currently open Add dialog was opened via the
// Duplicate button. Set by openDuplicateDialog, cleared on save or close.
// Used so handleSubmit can log the correct action — 'duplicate' instead of
// 'add' — when the user saves a duplicated row.
let pendingDuplicateSourceId = null;

let activityPageSize = (() => {
  try {
    const v = Number(localStorage.getItem('usage.activityPageSize.v1'));
    return [25, 50, 100, 150].includes(v) ? v : 25;
  } catch { return 25; }
})();

// Cell-click filters (v0.7.10). User clicks a Type / Buyer / Card cell to
// drill down to "only rows where this column equals this value." Multiple
// active filters AND together (e.g. Buyer=Me + Type=Toothpaste). Persisted
// in localStorage like the row-filter so per-user views survive reloads.
const CHIP_FILTER_KEY = 'usage.activeFilters.v1';
let activeFilters = (() => {
  try {
    const raw = localStorage.getItem(CHIP_FILTER_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
})();
function persistActiveFilters() {
  try { localStorage.setItem(CHIP_FILTER_KEY, JSON.stringify(activeFilters)); } catch {}
}
let charts = {
  byType: null, byStore: null, finishedByMonth: null,
  // v0.7.11
  perDayByType: null, countByType: null, longestRunning: null
};
let zxingModule = null;       // lazy-loaded on first Scan tap
let scannerControls = null;   // IScannerControls returned by @zxing/browser

// Palette used for donut/category coloring — colorblind-friendly-ish and consistent across renders.
const CHART_PALETTE = [
  '#2b5fd9', '#2d8a5f', '#c23b3b', '#d98f2b', '#7a4ad9',
  '#2b9fd9', '#d92b8f', '#4a9e4a', '#b97020', '#5b6b8a',
  '#08697d', '#b03b8a'
];

// v0.15.2: company logo via logo.dev. Same publishable token used in the
// stocks repo (`pk_` prefix = client-safe by logo.dev's convention).
// Brand-name → domain heuristic: lowercase, strip spaces, append .com. Works
// for most well-known consumer brands ("Crest" → crest.com, "Old Spice" →
// oldspice.com, "Pantene" → pantene.com). Misses are silent (the rendered
// <img> uses onerror to hide). For more reliability we'd need a brand→domain
// mapping table, but the simple guess is acceptable for an MVP.
const LOGO_DEV_TOKEN = 'pk_X-1ZO13GSgeOoUrIuJ6GMQ';
function brandToDomain(brand) {
  const s = String(brand || '').trim().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9.-]/g, '');
  if (!s) return '';
  return s.includes('.') ? s : s + '.com';
}
function brandLogoUrl(brand, size = 64) {
  const domain = brandToDomain(brand);
  if (!domain) return '';
  return `https://img.logo.dev/${encodeURIComponent(domain)}?token=${LOGO_DEV_TOKEN}&size=${size}&format=png`;
}

// v0.14.0: deterministic color per productType name. Same name always lands
// on the same palette slot, so "Toothpaste" is consistent across cards.
// Custom types fall through naturally — the hash works for any string.
function colorForType(name) {
  if (!name) return CHART_PALETTE[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) - h) + name.charCodeAt(i);
    h |= 0; // force int32
  }
  return CHART_PALETTE[Math.abs(h) % CHART_PALETTE.length];
}

/* ---------- calculations ---------- */

// Parse a date string as a LOCAL date (not UTC). Critical for `YYYY-MM-DD`
// inputs coming from <input type="date"> — `new Date("2026-04-20")` parses
// as UTC midnight, which in any negative-offset timezone renders as the day
// before. See v0.7.0 changelog.
function parseLocalDate(str) {
  if (!str) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str).trim());
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(str);
  return isNaN(d) ? null : d;
}

function daysBetween(startStr, endStr) {
  const start = parseLocalDate(startStr);
  if (!start) return null;
  const end = endStr ? parseLocalDate(endStr) : new Date();
  if (!end) return null;
  return Math.max(1, Math.round((end - start) / 86400000));
}

function calcDuration(p) { return daysBetween(p.startDate, p.endDate); }

function effectiveCost(p) {
  // Pre-tax mode: ignore costWithTax entirely, use the pre-tax cost only.
  // Single chokepoint — every downstream calc (allocated, $/unit, $/day,
  // totals, YTD) flows through this, so flipping the toggle re-renders the
  // entire UI's monetary values consistently.
  if (preTaxMode) {
    const pre = Number(p.cost);
    return isFinite(pre) ? pre : 0;
  }
  const withTax = Number(p.costWithTax);
  if (isFinite(withTax) && withTax > 0) return withTax;
  const pre = Number(p.cost);
  return isFinite(pre) ? pre : 0;
}

function bundleDivisor(p) {
  if (!p.bundleStatus) return 1;
  const n = Number(p.bundleSize);
  return (isFinite(n) && n > 0) ? n : 1;
}

function allocatedCost(p) { return effectiveCost(p) / bundleDivisor(p); }

function calcCostPerUnit(p) {
  const size = Number(p.size);
  if (!size) return null;
  const c = allocatedCost(p);
  return isFinite(c) ? c / size : null;
}

function calcCostPerDay(p) {
  const d = calcDuration(p);
  if (!d) return null;
  const c = allocatedCost(p);
  return isFinite(c) ? c / d : null;
}

// v0.14.2: category-level $/day. Honest version of "what's my daily burn
// rate for this productType." Computed as total spend on the category
// divided by the date span those products covered.
//
// Why this is needed: summing per-product $/day rates across products of
// the same type DOUBLE-COUNTS when products were used sequentially. E.g.
// two $5 underarms used over 30 consecutive days = $0.33/day in reality,
// but sum-of-rates would say $0.67/day (each product's $5/15 rate added).
//
// Span = (latest end or today) − (earliest start). Uses today as the
// endpoint for any active products in the category. Inventory excluded.
// If there's only one product, this reduces to the same answer as
// calcCostPerDay for it.
function categoryDailyRate(type, prods = products) {
  const items = prods.filter(p => !isFavorite(p) && (p.productType || '') === type && !isInventory(p));
  if (items.length === 0) return null;
  let totalCost = 0;
  let earliest = null;
  let latest = null;
  const now = new Date();
  for (const p of items) {
    const c = allocatedCost(p);
    if (isFinite(c)) totalCost += c;
    const s = parseLocalDate(p.startDate);
    const e = p.endDate ? parseLocalDate(p.endDate) : now;
    if (!s || !e) continue;
    if (!earliest || s < earliest) earliest = s;
    if (!latest || e > latest) latest = e;
  }
  if (!earliest || !latest || totalCost <= 0) return null;
  const days = Math.max(1, Math.round((latest - earliest) / 86400000));
  return totalCost / days;
}

// Active = user has started using it and hasn't finished.
// Inventory = bought but not yet in use (no startDate).
// Finished = has an endDate.
// These three categories partition the product set.
function isActive(p) { return !p.favorite && !!p.startDate && !p.endDate; }
// v0.15.0: a favorite has no startDate but is NOT inventory — it's a catalog
// entry. Adding the !p.favorite guard at the source of truth means every
// caller of isInventory is automatically correct. isActive / isFinished
// already return false for favorites since favorites have no dates.
function isInventory(p) { return !p.favorite && !p.startDate; }
function isFinished(p) { return !p.favorite && !!p.endDate; }

// v0.15.0: favorite = catalog entry, NOT a tracked usage. Filtered out of
// every stat / chart / aggregate. Lives in its own Favorites view.
function isFavorite(p) { return p.favorite === true; }

// Convenience wrapper used by every place that aggregates real tracked
// data — stats, charts, reminders, trends, bundles, price history. Calling
// `trackedOnly()` (with no args, defaults to module `products`) is the
// idiomatic way to get the not-favorite set anywhere in the file.
function trackedOnly(arr = products) { return arr.filter(p => !isFavorite(p)); }

/* ---------- formatting ---------- */

// v0.12.0 multi-currency. User picks one currency for display; all $/€/£
// rendering goes through Intl.NumberFormat with that ISO code. Underlying
// stored numbers don't change — only the formatting symbol + locale rules.
// Persisted in localStorage. Existing data is assumed to be in whichever
// currency is active when it was entered (we don't store per-product
// currency in v0.12.0; that's a future extension if the user travels often).
const CURRENCY_KEY = 'usage.currency.v1';
const SUPPORTED_CURRENCIES = [
  { code: 'USD', label: 'US Dollar' },
  { code: 'EUR', label: 'Euro' },
  { code: 'GBP', label: 'British Pound' },
  { code: 'CAD', label: 'Canadian Dollar' },
  { code: 'AUD', label: 'Australian Dollar' },
  { code: 'JPY', label: 'Japanese Yen' },
  { code: 'INR', label: 'Indian Rupee' },
  { code: 'MXN', label: 'Mexican Peso' },
  { code: 'CHF', label: 'Swiss Franc' },
  { code: 'CNY', label: 'Chinese Yuan' },
  { code: 'BRL', label: 'Brazilian Real' },
  { code: 'KRW', label: 'South Korean Won' },
  { code: 'NZD', label: 'New Zealand Dollar' },
  { code: 'SEK', label: 'Swedish Krona' },
  { code: 'NOK', label: 'Norwegian Krone' }
];
let userCurrency = (() => {
  try {
    const v = localStorage.getItem(CURRENCY_KEY);
    if (v && SUPPORTED_CURRENCIES.some(c => c.code === v)) return v;
  } catch {}
  return 'USD';
})();

// Cached formatters — rebuilt when currency changes. Map keyed by precision
// since the dashboard uses both 2-decimal and 4-decimal variants.
let _moneyFormatters = { code: '', coarse: null, fine: null };
function getMoneyFormatters() {
  if (_moneyFormatters.code === userCurrency) return _moneyFormatters;
  // For zero-decimal currencies (JPY, KRW), Intl ignores minimumFractionDigits
  // by default — that's fine, the formatter renders ¥1234 / ₩1234.
  _moneyFormatters = {
    code: userCurrency,
    coarse: new Intl.NumberFormat(undefined, {
      style: 'currency', currency: userCurrency,
      minimumFractionDigits: 2, maximumFractionDigits: 2
    }),
    // v0.16.1: dropped from 4→2 decimals. The 4-decimal precision was
    // making the $/unit and $/day table columns wide enough to force
    // horizontal scrolling — and at personal-tracker scale ($1-2/unit,
    // a few cents per day at most) the extra precision was noise.
    // moneyFine and money now produce identical output by design.
    fine: new Intl.NumberFormat(undefined, {
      style: 'currency', currency: userCurrency,
      minimumFractionDigits: 2, maximumFractionDigits: 2
    })
  };
  return _moneyFormatters;
}

const money = n => {
  if (n == null || !isFinite(Number(n))) return '—';
  return getMoneyFormatters().coarse.format(Number(n));
};
const moneyFine = n => {
  if (n == null || !isFinite(Number(n))) return '—';
  return getMoneyFormatters().fine.format(Number(n));
};

function formatDate(str) {
  const d = parseLocalDate(str);
  if (!d) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDuration(p) {
  const d = calcDuration(p);
  if (d == null) return '—';
  return isActive(p)
    ? `${d}d<span class="in-use-suffix">in use</span>`
    : `${d}d`;
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

/* ---------- id ---------- */

function newId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
}

// v0.7.13 — bundleId groups all sibling rows from the same multi-pack
// purchase. Different purpose from product `id`, distinct for clarity.
function newBundleId() { return 'b-' + newId(); }

// Look up sibling rows for a given bundle. The originator row is the one
// that started the bundle (bundlePosition unset OR === 1, the canonical
// "bundle × N" chip). Sibling rows are the rest.
function bundleSiblings(bundleId) {
  if (!bundleId) return [];
  // Favorites can't be bundle members — they have no bundle data — but
  // filter defensively so a future bug couldn't poison the panel.
  return products.filter(p => !isFavorite(p) && p.bundleId === bundleId);
}

/* ---------- Firestore storage ---------- */

function productsColl(uid = currentUser?.uid) {
  return collection(db, 'users', uid, 'products');
}
function productDoc(id, uid = currentUser?.uid) {
  return doc(db, 'users', uid, 'products', id);
}
function typesDoc(uid = currentUser?.uid) {
  return doc(db, 'users', uid, 'meta', 'customTypes');
}

async function saveProduct(product) {
  try { await setDoc(productDoc(product.id), product); }
  catch (e) { toast('Save failed: ' + e.message); throw e; }
}

async function deleteProduct(id) {
  try { await deleteDoc(productDoc(id)); }
  catch (e) { toast('Delete failed: ' + e.message); throw e; }
}

async function saveCustomTypes(list) {
  try { await setDoc(typesDoc(), { types: list }); }
  catch (e) { toast('Could not save custom types: ' + e.message); }
}

// v0.16.0: email reminder prefs. Read by usage-worker daily cron to decide
// whether to send the digest. Only the two user-controlled fields
// (reorderEmailsEnabled, notifyEmail) are written from the app — the worker
// owns lastReorderEmailSentAt / lastReorderEmailRecipientCount / lastResendId
// and we use { merge: true } to avoid clobbering them.
function emailPrefsDoc(uid = currentUser?.uid) {
  return doc(db, 'users', uid, 'meta', 'emailPrefs');
}
async function loadEmailPrefs() {
  if (!currentUser) return null;
  try {
    const snap = await getDoc(emailPrefsDoc());
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.warn('loadEmailPrefs failed', e);
    return null;
  }
}
async function saveEmailPrefs({ enabled, email }) {
  if (!currentUser) throw new Error('Not signed in');
  const payload = {
    reorderEmailsEnabled: !!enabled,
    notifyEmail: (email || '').trim() || null,
  };
  await setDoc(emailPrefsDoc(), payload, { merge: true });
  return payload;
}

function subscribeData(uid) {
  unsubscribeData();

  unsubProducts = onSnapshot(productsColl(uid), snap => {
    const next = [];
    snap.forEach(d => next.push({ id: d.id, ...d.data() }));
    products = next;
    firstSnapshotSeen = true;
    render();
    // v0.7.13: one-time migration to assign bundleId to legacy bundled rows.
    // Runs in the background after first render — non-blocking, idempotent
    // (guarded by a per-user localStorage flag).
    migrateBundleIds(uid);
    // v0.7.17: backfill createdAt on legacy products. Same pattern.
    migrateCreatedAt(uid);
    // v0.13.1: load activity from Firestore + migrate any legacy
    // localStorage entries on first run after this version. Guarded by
    // activityLoaded so it only runs once per session.
    if (!activityLoaded) initActivityForSession(uid);
  }, err => {
    console.error('Products subscription error:', err);
    toast('Sync error: ' + err.message);
  });

  unsubTypes = onSnapshot(typesDoc(uid), d => {
    customTypesCache = d.exists() ? (d.data().types || []) : [];
  }, err => {
    console.error('Types subscription error:', err);
  });
}

function unsubscribeData() {
  if (unsubProducts) { unsubProducts(); unsubProducts = null; }
  if (unsubTypes) { unsubTypes(); unsubTypes = null; }
  firstSnapshotSeen = false;
  destroyChart('byType');
  destroyChart('byStore');
  destroyChart('finishedByMonth');
  destroyChart('perDayByType');
  destroyChart('countByType');
  destroyChart('longestRunning');
  // v0.7.12: reset the trend-insight cache so next sign-in re-rolls fresh.
  trendInsightCache = undefined;
  // v0.7.13: reset bundle-row expansion state on sign-out so the next user
  // doesn't briefly see a stale expanded row id from the previous session.
  expandedBundleRow = null;
  expandedCards.clear();
  // v0.7.21: clear the in-memory UPC cache so different users signing in on
  // the same browser don't share L1 lookups (Firestore L2 is already
  // user-scoped via path, but this Map isn't).
  upcCache.clear();
  // v0.13.1: clear activity cache so a different user signing in doesn't
  // briefly see the prior user's entries before fetch resolves.
  activityEntries = [];
  activityLoaded = false;
}

// v0.13.1 activity log — Firestore-backed (was localStorage in v0.7.17–v0.13.0).
// Stored at /users/{uid}/activity/{logId}. The existing firestore.rules
// wildcard `match /users/{userId}/{document=**}` already covers this path.
// Per-user, syncs across devices, follows the same lifecycle as products.
//
// Legacy localStorage entries (`usage.activity.v1.<uid>`) are migrated once
// per user on the first snapshot of this version, then the localStorage key
// is left in place as a safety archive (NOT deleted) — same conservative
// pattern the legacy products migration used.

function activityKey() {
  return currentUser ? ACTIVITY_KEY_PREFIX + currentUser.uid : null;
}

function activityColl(uid = currentUser?.uid) {
  return collection(db, 'users', uid, 'activity');
}

// In-memory cache of activity entries so the page render stays sync. Refreshed
// after each logActivity write and on view switch / page-size change.
let activityEntries = [];
let activityLoaded = false;

async function fetchActivityFromFirestore() {
  if (!currentUser) { activityEntries = []; return; }
  try {
    const snap = await getDocs(activityColl());
    const list = [];
    snap.forEach(d => list.push({ _id: d.id, ...d.data() }));
    list.sort((a, b) => String(b.ts || '').localeCompare(String(a.ts || ''))); // newest first
    activityEntries = list;
    activityLoaded = true;
  } catch (e) {
    console.warn('Activity fetch failed:', e);
    activityEntries = [];
  }
}

// Sync accessor used by renderActivity (which is called from various paths
// that aren't async). Returns whatever's in the cache. The cache is filled
// initially by `fetchActivityFromFirestore` after sign-in / view switch.
function loadActivity() {
  return activityEntries;
}

async function logActivity(action, p, summary = '') {
  if (!currentUser) return;
  const entry = {
    ts: new Date().toISOString(),
    action,
    productId: p?.id || '',
    productName: p?.productName || '(unnamed)',
    productType: p?.productType || '',
    summary
  };
  // Write to Firestore (auto-id). doc(collection, ...) without id picks one.
  try {
    const ref = doc(activityColl());
    await setDoc(ref, entry);
    // Update in-memory cache so the activity page reflects the write
    // immediately, without a roundtrip read.
    activityEntries.unshift({ _id: ref.id, ...entry });
    if (activityEntries.length > ACTIVITY_MAX) activityEntries.length = ACTIVITY_MAX;
  } catch (e) {
    console.warn('Activity write failed:', e);
    // Fail silently — activity log is best-effort, not critical to the save.
    return;
  }
  // If the user is currently viewing the activity page, refresh it.
  if (currentView === 'activity') renderActivity();
}

// v0.13.1 — one-time migration of localStorage activity entries to Firestore.
// Runs idempotently (per-uid flag) the first time a user signs in after this
// version. Archives the legacy localStorage key as `.migrated` rather than
// deleting outright, matching the same conservative pattern used by the
// legacy products migration. Subsequent sessions short-circuit on the flag.
const ACTIVITY_MIGRATION_KEY = 'usage.activityToFirestore.v1';

async function migrateActivityFromLocalStorage(uid) {
  const flagKey = `${ACTIVITY_MIGRATION_KEY}.${uid}`;
  try { if (localStorage.getItem(flagKey) === '1') return; } catch {}
  const localKey = ACTIVITY_KEY_PREFIX + uid;
  let legacy = null;
  try {
    const raw = localStorage.getItem(localKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) legacy = parsed;
    }
  } catch {}
  if (!legacy) {
    // Nothing to migrate; set flag so we don't re-scan every session.
    try { localStorage.setItem(flagKey, '1'); } catch {}
    return;
  }
  try {
    for (const entry of legacy) {
      const ref = doc(activityColl(uid));
      await setDoc(ref, {
        ts: entry.ts || new Date(0).toISOString(),
        action: entry.action || 'unknown',
        productId: entry.productId || '',
        productName: entry.productName || '(unnamed)',
        productType: entry.productType || '',
        summary: entry.summary || ''
      });
    }
    try {
      localStorage.setItem(flagKey, '1');
      localStorage.setItem(localKey + '.migrated', localStorage.getItem(localKey));
      localStorage.removeItem(localKey);
    } catch {}
    if (legacy.length > 0) {
      toast(`Activity log moved to your account: ${legacy.length} entr${legacy.length === 1 ? 'y' : 'ies'}.`);
    }
  } catch (e) {
    console.error('Activity migration failed:', e);
    // Don't set flag — retry next session.
  }
}

// Kicks off both migration (if needed) and initial fetch into the cache.
// Called from the products onSnapshot handler so it runs once after sign-in.
// Re-renders the activity view if it's currently visible, so the page swaps
// from "Loading…" to populated content as soon as data arrives.
async function initActivityForSession(uid) {
  await migrateActivityFromLocalStorage(uid);
  await fetchActivityFromFirestore();
  if (currentView === 'activity') renderActivity();
}

// v0.7.17 — one-time migration that backfills `createdAt` on legacy products
// that were saved before this version. Uses purchaseDate || startDate || a
// sentinel so existing rows still show *some* timestamp on the activity log
// instead of "unknown". Per-user localStorage flag prevents re-running.
const CREATEDAT_MIGRATION_KEY = 'usage.createdAtMigrated.v1';
let createdAtMigrationRunning = false;

async function migrateCreatedAt(uid) {
  if (createdAtMigrationRunning) return;
  const flagKey = `${CREATEDAT_MIGRATION_KEY}.${uid}`;
  try {
    if (localStorage.getItem(flagKey) === '1') return;
  } catch {}
  const needs = products.filter(p => !p.createdAt);
  if (needs.length === 0) {
    try { localStorage.setItem(flagKey, '1'); } catch {}
    return;
  }

  createdAtMigrationRunning = true;
  try {
    let updated = 0;
    for (const p of needs) {
      // Best-effort timestamp inference. Convert YYYY-MM-DD to local-midnight
      // ISO string. If neither date is set, use a 1970 sentinel so sorting
      // still works without polluting "recent activity" displays.
      const seedDate = p.purchaseDate || p.startDate || '1970-01-01';
      const local = parseLocalDate(seedDate);
      const iso = local ? local.toISOString() : new Date(0).toISOString();
      await setDoc(productDoc(p.id, uid), { ...p, createdAt: iso });
      updated++;
    }
    try { localStorage.setItem(flagKey, '1'); } catch {}
    if (updated > 0) console.info(`createdAt backfilled on ${updated} legacy product${updated === 1 ? '' : 's'}.`);
  } catch (err) {
    console.error('createdAt migration failed:', err);
  } finally {
    createdAtMigrationRunning = false;
  }
}

// v0.7.13 — one-time migration that groups existing bundled rows (that lack
// a bundleId from before this version) and assigns shared bundleIds plus
// sequential positions. Heuristic: rows are siblings if they share the same
// productName + purchaseDate + bundleSize. Edge case: if a user bought two
// separate 3-packs of the same item on the same day, the migration merges
// them — accepted risk for a personal usage tracker. Per-user flag in
// localStorage so we don't re-run on subsequent sessions; flag is set even
// when there's nothing to migrate so we don't re-scan every load.
const BUNDLE_MIGRATION_KEY = 'usage.bundleIdMigrated.v1';
let bundleMigrationRunning = false;

async function migrateBundleIds(uid) {
  if (bundleMigrationRunning) return;
  const flagKey = `${BUNDLE_MIGRATION_KEY}.${uid}`;
  try {
    if (localStorage.getItem(flagKey) === '1') return;
  } catch {}
  const needs = products.filter(p => p.bundleStatus && !p.bundleId);
  if (needs.length === 0) {
    try { localStorage.setItem(flagKey, '1'); } catch {}
    return;
  }

  bundleMigrationRunning = true;
  try {
    // Group by (productName, purchaseDate, bundleSize)
    const groups = new Map();
    for (const p of needs) {
      const k = `${p.productName || ''}|${p.purchaseDate || ''}|${p.bundleSize || ''}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(p);
    }

    let updated = 0;
    for (const [, members] of groups) {
      const sharedBundleId = newBundleId();
      // Sort by existing bundlePosition (if set), then by id for stability.
      members.sort((a, b) => {
        const ap = Number(a.bundlePosition);
        const bp = Number(b.bundlePosition);
        const aOk = isFinite(ap) && ap > 0;
        const bOk = isFinite(bp) && bp > 0;
        if (aOk && bOk) return ap - bp;
        if (aOk) return -1;
        if (bOk) return 1;
        return String(a.id).localeCompare(String(b.id));
      });
      let nextPos = 1;
      for (const m of members) {
        const update = { ...m, bundleId: sharedBundleId };
        const pos = Number(m.bundlePosition);
        if (!isFinite(pos) || pos <= 0) {
          update.bundlePosition = nextPos;
          nextPos++;
        } else {
          nextPos = Math.max(nextPos, pos + 1);
        }
        await setDoc(productDoc(m.id, uid), update);
        updated++;
      }
    }
    try { localStorage.setItem(flagKey, '1'); } catch {}
    if (updated > 0) toast(`Bundles migrated: ${updated} row${updated === 1 ? '' : 's'} grouped.`);
  } catch (err) {
    console.error('Bundle migration failed:', err);
    // Don't set the flag on failure — retry next session.
  } finally {
    bundleMigrationRunning = false;
  }
}

/* ---------- recent-used helpers ---------- */

function uniqueValues(key) {
  const set = new Set();
  for (const p of products) {
    const v = (p[key] ?? '').toString().trim();
    if (v) set.add(v);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

function allProductTypes() {
  const combined = [...SEED_PRODUCT_TYPES];
  for (const c of customTypesCache) if (!combined.includes(c)) combined.push(c);
  return combined;
}

function bundlesList() {
  const seen = new Map();
  for (const p of products) {
    if (isFavorite(p) || !p.bundleStatus) continue;
    const key = `${p.productName}|${p.purchaseDate}|${p.bundleSize}`;
    if (!seen.has(key)) seen.set(key, p);
  }
  return [...seen.values()].sort((a, b) => (b.purchaseDate || '').localeCompare(a.purchaseDate || ''));
}

/* ---------- sort ---------- */

function getSortValue(p, column) {
  switch (column) {
    case 'size': return Number(p.size) || 0;
    case 'duration': return calcDuration(p) || 0;
    case 'cost': return Number(p.cost) || 0;
    case 'costWithTax': return effectiveCost(p);
    case 'costPerUnit': return calcCostPerUnit(p) ?? 0;
    case 'costPerDay': return calcCostPerDay(p) ?? 0;
    case 'bundleStatus': return p.bundleStatus ? 1 : 0;
    case 'endDate': return p.endDate || '\uffff';
    // v0.17.0: STORE / BUYER / CARD merged into one BOUGHT BY column. Sort
    // by store first, then buyer, then card \u2014 the leftmost piece dominates
    // ordering so click-the-header still feels like "sort by where I shop."
    case 'boughtBy': return [
      (p.store || '\uffff'),
      (p.buyer || '\uffff'),
      (p.cardLast4 || '\uffff'),
    ].join('|').toLowerCase();
    default: return (p[column] ?? '').toString().toLowerCase();
  }
}

// v0.14.0: live text search across the most-searched fields. Case-insensitive
// substring match; AND-combines with row-filter tabs and chip filters.
// Transient (not persisted) — search is meant to be momentary.
let searchQuery = '';
const SEARCH_FIELDS = ['productName', 'productType', 'brand', 'store', 'buyer', 'notes', 'upc', 'cardLast4'];

// v0.14.0 search-autocomplete state. activeSuggestionIndex tracks keyboard
// nav through the suggestion dropdown (arrow keys); -1 means no row is
// highlighted, so Enter would just blur without opening anything.
const SUGGESTION_MAX = 8;
let activeSuggestionIndex = -1;

function setSearchQuery(q) {
  searchQuery = String(q || '').trim();
  activeSuggestionIndex = -1;
  renderTable();
  renderSearchSuggestions();
}

function suggestionMatches() {
  if (!searchQuery) return [];
  // Search the FULL tracked product list (not filteredProducts) so suggestions
  // surface matches regardless of active row-filter / chip filters. v0.15.0:
  // favorites excluded — they have their own view and search there if needed.
  return trackedOnly()
    .filter(p => productMatchesSearch(p, searchQuery))
    .slice(0, SUGGESTION_MAX);
}

function renderSearchSuggestions() {
  const list = document.getElementById('row-search-suggestions');
  const input = document.getElementById('row-search');
  if (!list || !input) return;
  // Only show when the search input has focus AND there's a query —
  // anything else closes the dropdown.
  const isFocused = document.activeElement === input;
  if (!isFocused || !searchQuery) {
    list.hidden = true;
    list.innerHTML = '';
    input.setAttribute('aria-expanded', 'false');
    return;
  }
  const matches = suggestionMatches();
  if (matches.length === 0) {
    list.hidden = false;
    list.innerHTML = `<div class="row-search-empty">No products match &ldquo;${escapeHtml(searchQuery)}&rdquo;.</div>`;
    input.setAttribute('aria-expanded', 'true');
    return;
  }
  list.innerHTML = matches.map((p, i) => {
    const status = isFinished(p) ? 'finished' : isActive(p) ? 'active' : 'inventory';
    const thumb = p.imageUrl
      ? `<img class="row-search-thumb" src="${escapeHtml(p.imageUrl)}" alt="" loading="lazy" onerror="this.outerHTML='<span class=row-search-thumb-fallback></span>'">`
      : '<span class="row-search-thumb-fallback"></span>';
    return `<button type="button" class="row-search-suggestion${i === activeSuggestionIndex ? ' is-active' : ''}" role="option" aria-selected="${i === activeSuggestionIndex}" data-id="${p.id}">
      ${thumb}
      <span class="row-search-info">
        <span class="row-search-name">${escapeHtml(p.productName) || '(unnamed)'}</span>
        <span class="row-search-meta">
          <span class="row-search-type" style="color:${colorForType(p.productType)}">${escapeHtml(p.productType) || '—'}</span>
          <span class="badge badge-${status}">${status}</span>
        </span>
      </span>
    </button>`;
  }).join('');
  list.hidden = false;
  input.setAttribute('aria-expanded', 'true');
}

function moveSuggestionFocus(delta) {
  const matches = suggestionMatches();
  if (matches.length === 0) return;
  if (activeSuggestionIndex === -1) {
    activeSuggestionIndex = delta > 0 ? 0 : matches.length - 1;
  } else {
    activeSuggestionIndex = (activeSuggestionIndex + delta + matches.length) % matches.length;
  }
  renderSearchSuggestions();
  // Scroll the active suggestion into view if dropdown overflows
  const el = document.querySelector(`.row-search-suggestion.is-active`);
  if (el) el.scrollIntoView({ block: 'nearest' });
}

function pickActiveSuggestion() {
  const matches = suggestionMatches();
  if (activeSuggestionIndex < 0 || activeSuggestionIndex >= matches.length) return;
  const p = matches[activeSuggestionIndex];
  if (p) openSuggestion(p.id);
}

function openSuggestion(id) {
  const input = document.getElementById('row-search');
  if (input) input.blur();
  const list = document.getElementById('row-search-suggestions');
  if (list) list.hidden = true;
  openEditDialog(id);
}

function productMatchesSearch(p, q) {
  if (!q) return true;
  const needle = q.toLowerCase();
  for (const f of SEARCH_FIELDS) {
    const v = p[f];
    if (v && String(v).toLowerCase().includes(needle)) return true;
  }
  return false;
}

function filteredProducts() {
  // v0.15.0: favorites never appear in the main table — they live in the
  // dedicated Favorites view. Stats/charts/aggregates also exclude them.
  let list = trackedOnly();
  // Row-filter tabs (All / Active / Inventory) — applied first.
  if (currentFilter === 'active') list = list.filter(isActive);
  else if (currentFilter === 'inventory') list = list.filter(isInventory);
  // Cell-click chip filters (v0.7.10). AND across columns: a row must match
  // every active filter to survive. Empty-string filter values (defensive)
  // are treated as "no filter" for that column.
  for (const [col, val] of Object.entries(activeFilters)) {
    if (val === '' || val == null) continue;
    list = list.filter(p => String(p[col] ?? '') === String(val));
  }
  // v0.14.0: text search (last so it filters the already-narrowed list).
  if (searchQuery) list = list.filter(p => productMatchesSearch(p, searchQuery));
  return list;
}

// v0.7.10 helpers — manipulate activeFilters and re-render. Each filter is
// keyed by the column name (productType / buyer / cardLast4) with a single
// string value. Setting the same column twice just replaces the value.
function addFilter(col, val) {
  if (!col) return;
  activeFilters[col] = String(val ?? '');
  persistActiveFilters();
  renderTable();
}
function removeFilter(col) {
  delete activeFilters[col];
  persistActiveFilters();
  renderTable();
}
function clearChipFilters() {
  activeFilters = {};
  persistActiveFilters();
  renderTable();
}

// Human-friendly label for a filter column. Used in the active-filter bar.
function filterColLabel(col) {
  return ({ productType: 'Type', buyer: 'Buyer', cardLast4: 'Card' })[col] || col;
}

function sortedProducts() {
  const { column, dir } = sortState;
  const list = filteredProducts().slice();
  list.sort((a, b) => {
    const va = getSortValue(a, column);
    const vb = getSortValue(b, column);
    if (typeof va === 'number' && typeof vb === 'number') {
      return dir === 'asc' ? va - vb : vb - va;
    }
    return dir === 'asc'
      ? String(va).localeCompare(String(vb))
      : String(vb).localeCompare(String(va));
  });
  return list;
}

function defaultDirForColumn(col) {
  const descFirst = ['startDate', 'endDate', 'purchaseDate', 'cost', 'costWithTax',
    'costPerUnit', 'costPerDay', 'size', 'duration'];
  return descFirst.includes(col) ? 'desc' : 'asc';
}

function handleHeaderClick(th) {
  const col = th.dataset.sort;
  if (!col) return;
  if (sortState.column === col) {
    sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
  } else {
    sortState = { column: col, dir: defaultDirForColumn(col) };
  }
  render();
}

// Mobile sort dropdown — desktop has clickable column headers, but on mobile
// the table is a stack of cards with no headers visible. The dropdown encodes
// "column.dir" pairs (e.g. "productName.asc") that map directly into sortState.
function handleMobileSortChange(value) {
  const [column, dir] = String(value).split('.');
  if (!column || !dir) return;
  sortState = { column, dir };
  render();
}

/* ---------- rendering ---------- */

// v0.7.10 — show a strip of dismissible chips for any active cell-click
// filters. Hidden when no filters are active. Each chip shows
// "Type: Toothpaste ×" and clicking the × removes that filter. There's
// also a "Clear all" link when 2+ filters are active.
function renderActiveFilterBar() {
  const bar = document.getElementById('active-filter-bar');
  if (!bar) return;
  const entries = Object.entries(activeFilters).filter(([, v]) => v !== '' && v != null);
  if (entries.length === 0) {
    bar.hidden = true;
    bar.innerHTML = '';
    return;
  }
  bar.hidden = false;
  const chips = entries.map(([col, val]) =>
    `<button type="button" class="filter-chip" data-clear-col="${escapeHtml(col)}" title="Click to remove this filter">
      <span class="filter-chip-key">${escapeHtml(filterColLabel(col))}:</span>
      <span class="filter-chip-val">${escapeHtml(val)}</span>
      <span class="filter-chip-x" aria-hidden="true">&times;</span>
    </button>`
  ).join('');
  const clearAll = entries.length > 1
    ? `<button type="button" id="filter-chip-clear-all" class="btn btn-ghost">Clear all</button>`
    : '';
  bar.innerHTML = chips + clearAll;
}

function render() {
  renderTrendsPanel();
  renderReorderReminders();
  renderTable();
  renderStats();
  renderDashboard();
  // v0.15.0: refresh favorites view if it's currently active. Otherwise it
  // re-renders on view switch via setView.
  if (currentView === 'favorites') renderFavorites();
}

function renderTable() {
  renderActiveFilterBar();
  const body = document.getElementById('products-body');
  const empty = document.getElementById('empty-state');
  const loading = document.getElementById('loading-state');
  body.innerHTML = '';

  if (!firstSnapshotSeen && currentUser) {
    loading.hidden = false;
    empty.hidden = true;
    return;
  }
  loading.hidden = true;

  const visible = sortedProducts();
  const hasChipFilters = Object.values(activeFilters).some(v => v !== '' && v != null);
  if (visible.length === 0) {
    empty.hidden = false;
    if (products.length === 0) {
      empty.innerHTML = 'No products tracked yet. Click <strong>+ Add product</strong> to get started.';
    } else if (searchQuery) {
      // v0.14.0: search is the most-likely current source of zero results
      // when the user just typed something. Surface it first.
      empty.innerHTML = `No products match <strong>&ldquo;${escapeHtml(searchQuery)}&rdquo;</strong>. Try a different term, or <strong>Reset</strong> to clear all filters.`;
    } else if (hasChipFilters) {
      empty.innerHTML = 'No products match the active filters. Click the <strong>×</strong> on any chip above to remove it.';
    } else if (currentFilter === 'active') {
      empty.innerHTML = 'No <strong>active</strong> products right now. Switch to <strong>All</strong> or <strong>Inventory</strong> to see your other items.';
    } else if (currentFilter === 'inventory') {
      empty.innerHTML = 'No products in <strong>inventory</strong>. Add a product and leave the <em>Start date</em> blank to record items you\'ve bought but not started using.';
    }
  } else {
    empty.hidden = true;
    for (const p of visible) {
      body.appendChild(renderRow(p));
      // v0.7.13: when this row's bundle chip has been tapped, inject a
      // full-width sibling-list row immediately below it.
      if (expandedBundleRow === p.id && p.bundleId) {
        body.appendChild(renderBundleSiblingsRow(p));
      }
    }
  }

  // v0.17.0: auto-hide the Notes column when nothing in the current view
  // actually has notes — saves a column of width on tables of products
  // that aren't annotated. Independent of the user's manual columns
  // preference (which still applies on top via body.cols-hide-notes).
  const tableEl = document.getElementById('products-table');
  if (tableEl) {
    const anyNotes = visible.some(p => p.notes && p.notes.trim().length);
    tableEl.classList.toggle('no-notes-data', !anyNotes);
  }

  document.querySelectorAll('#products-table thead th[data-sort]').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.sort === sortState.column) {
      th.classList.add(sortState.dir === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });
}

// Mobile card layout — what each product looks like at viewport <= 720px.
// Reuses the .name-link / .edit-btn / .delete-btn classes so the existing
// table-wrap event delegation in attachTableHandlers picks up clicks here too.
function renderMobileCard(p) {
  const startLabel = p.startDate ? formatDate(p.startDate) : 'inventory';
  let endLabel;
  if (p.endDate) endLabel = `<span class="badge badge-finished">${formatDate(p.endDate)}</span>`;
  else if (isInventory(p)) endLabel = '<span class="badge badge-inventory">inventory</span>';
  else endLabel = '<span class="badge badge-active">active</span>';

  const dur = calcDuration(p);
  let durationStr = '';
  if (dur != null) {
    if (isActive(p)) durationStr = ` &middot; ${dur}d running`;
    else if (isFinished(p)) durationStr = ` &middot; ${dur}d total`;
  }

  // Route through effectiveCost so the mobile card respects the pre-tax toggle.
  const eff = effectiveCost(p);
  const costPrimary = eff > 0 ? money(eff) : '—';
  const costPerDay = calcCostPerDay(p);
  const perDayStr = costPerDay != null ? ` &middot; ${moneyFine(costPerDay)}/day` : '';

  // v0.15.1: each meta value gets its own labeled row instead of being
  // crammed onto a single line. Better use of card vertical space and
  // makes each value individually scannable. Buyer and Card render as
  // .cell-chip filter buttons (matching desktop); Size and Store render
  // as plain values.
  const sizeRow = (p.size && p.unit)
    ? `<div class="mc-row mc-row-extra"><dt>Size</dt><dd>${escapeHtml(p.size)} ${escapeHtml(p.unit)}</dd></div>`
    : '';
  const storeRow = p.store
    ? `<div class="mc-row mc-row-extra"><dt>Store</dt><dd>${escapeHtml(p.store)}</dd></div>`
    : '';
  const buyerRow = p.buyer
    ? `<div class="mc-row mc-row-extra"><dt>Buyer</dt><dd><button type="button" class="cell-chip mc-meta-chip" data-filter-col="buyer" data-filter-val="${escapeHtml(p.buyer)}" title="Filter to ${escapeHtml(p.buyer)}">${escapeHtml(p.buyer)}</button></dd></div>`
    : '';
  const cardRow = p.cardLast4
    ? `<div class="mc-row mc-row-extra"><dt>Card</dt><dd><button type="button" class="cell-chip mc-meta-chip" data-filter-col="cardLast4" data-filter-val="${escapeHtml(p.cardLast4)}" title="Filter to card &bull;&bull;&bull;&bull; ${escapeHtml(p.cardLast4)}">&bull;&bull; ${escapeHtml(p.cardLast4)}</button></dd></div>`
    : '';
  const metaRows = sizeRow + storeRow + buyerRow + cardRow;

  // v0.7.13: clickable bundle chip on mobile too, opens the same sibling
  // slide-out (rendered inline inside the card when expanded).
  const bundleChip = (() => {
    if (!p.bundleStatus) return '';
    const label = p.bundlePosition
      ? `${escapeHtml(p.bundlePosition)} of ${escapeHtml(p.bundleSize || '?')}`
      : `bundle &times; ${escapeHtml(p.bundleSize || '?')}`;
    const cls = p.bundlePosition ? 'badge-bundle-member' : 'badge-bundle-origin';
    if (p.bundleId) {
      return `<button type="button" class="badge bundle-chip ${cls}" data-bundle-id="${escapeHtml(p.bundleId)}" data-row-id="${p.id}" title="Tap to see all bundle members">${label}</button>`;
    }
    return `<span class="badge ${cls}">${label}</span>`;
  })();

  // Show-more expander: Where + Notes are tagged with .mc-row-extra so the
  // CSS can hide them by default. The button only renders if there's anything
  // to hide — no point showing "Show more" on a card with no extra rows.
  const expanded = expandedCards.has(p.id);
  const hasExtras = !!(metaRows || p.notes);

  return `
    <div class="mc${expanded ? ' mc-expanded' : ''}">
      <div class="mc-head">
        ${(() => {
          // v0.15.2: brand logo preferred; fallback to UPC product image.
          if (p.brand) return `<img class="mc-thumb mc-thumb-logo" src="${escapeHtml(brandLogoUrl(p.brand))}" alt="${escapeHtml(p.brand)} logo" loading="lazy" onerror="this.remove()">`;
          if (p.imageUrl) return `<img class="mc-thumb" src="${escapeHtml(p.imageUrl)}" alt="" loading="lazy" onerror="this.remove()">`;
          return '';
        })()}
        ${p.productType ? `<button type="button" class="cell-chip mc-type-chip" style="background:${colorForType(p.productType)};color:#fff;border-color:transparent" data-filter-col="productType" data-filter-val="${escapeHtml(p.productType)}" title="Tap to filter to ${escapeHtml(p.productType)}">${escapeHtml(p.productType)}</button>` : '<span class="mc-type">—</span>'}
        <span class="mc-status">${endLabel}</span>
      </div>
      <button type="button" class="mc-name name-link" data-id="${p.id}" title="Edit product">${escapeHtml(p.productName)}</button>
      <dl class="mc-grid">
        <div class="mc-row"><dt>Started</dt><dd>${startLabel}${durationStr}</dd></div>
        <div class="mc-row"><dt>Cost</dt><dd>${costPrimary}${perDayStr}</dd></div>
        ${bundleChip ? `<div class="mc-row"><dt>Bundle</dt><dd>${bundleChip}</dd></div>` : ''}
        ${metaRows}
        ${p.notes ? `<div class="mc-row mc-row-extra mc-row-notes"><dt>Notes</dt><dd>${escapeHtml(p.notes)}</dd></div>` : ''}
      </dl>
      ${hasExtras ? `<button type="button" class="mc-more-btn" data-id="${p.id}">${expanded ? 'Show less' : 'Show more'}</button>` : ''}
      ${(p.bundleId && expandedBundleRow === p.id) ? renderBundleSiblingsInline(p) : ''}
      <div class="mc-actions">
        <button type="button" class="edit-btn" data-id="${p.id}">Edit</button>
        ${isActive(p) ? `<button type="button" class="finish-btn finish-btn-primary" data-id="${p.id}" title="Mark as finished">Finish</button>` : ''}
        <button type="button" class="duplicate-btn" data-id="${p.id}">Duplicate</button>
        ${priceHistoryCount(p.upc) >= 2 ? `<button type="button" class="history-btn" data-id="${p.id}" title="Price history for this UPC">History</button>` : ''}
        <button type="button" class="share-btn" data-id="${p.id}" title="Share link or export PNG">Share</button>
        <button type="button" class="delete-btn" data-id="${p.id}">Delete</button>
      </div>
    </div>
  `;
}

function renderRow(p) {
  const tr = document.createElement('tr');
  // Each row carries BOTH the desktop cells (one td per column) and a single
  // .mobile-card-cell at the end. CSS toggles which set is visible based on
  // viewport — desktop hides .mobile-card-cell, mobile hides everything else
  // on the row and lets the card render as a block. Same DOM, two layouts,
  // no duplicated event-handler wiring.
  tr.innerHTML = `
    <td class="col-productType">${p.productType ? `<button type="button" class="cell-chip cell-chip-type" style="background:${colorForType(p.productType)};color:#fff;border-color:transparent" data-filter-col="productType" data-filter-val="${escapeHtml(p.productType)}" title="Filter to ${escapeHtml(p.productType)}">${escapeHtml(p.productType)}</button>` : '—'}</td>
    <td class="name-cell col-productName">${(() => {
      // v0.15.2: prefer brand company logo (consistent visual scanning by
      // brand). If no brand, fall back to UPC product image. Both onerror
      // handlers self-remove on load failure.
      if (p.brand) return `<img class="name-thumb name-thumb-logo" src="${escapeHtml(brandLogoUrl(p.brand))}" alt="${escapeHtml(p.brand)} logo" loading="lazy" onerror="this.remove()">`;
      if (p.imageUrl) return `<img class="name-thumb" src="${escapeHtml(p.imageUrl)}" alt="" loading="lazy" onerror="this.remove()">`;
      return '';
    })()}<button type="button" class="name-link" data-id="${p.id}" title="Edit product">${escapeHtml(p.productName)}</button></td>
    <td class="num col-size">${escapeHtml(p.size)} ${escapeHtml(p.unit)}</td>
    <td class="col-startDate">${formatDate(p.startDate)}</td>
    <td class="col-endDate">${p.endDate ? formatDate(p.endDate) : (isInventory(p) ? '<span class="badge badge-inventory">inventory</span>' : '<span class="badge badge-active">active</span>')}</td>
    <td class="num col-duration">${formatDuration(p)}</td>
    <td class="num col-cost">${money(p.cost)}</td>
    <td class="num cell-with-tax col-costWithTax">${p.costWithTax ? money(p.costWithTax) : '—'}</td>
    <td class="num col-costPerUnit">${moneyFine(calcCostPerUnit(p))}</td>
    <td class="num col-costPerDay">${moneyFine(calcCostPerDay(p))}</td>
    <td class="col-bundleStatus">${(() => {
      if (!p.bundleStatus) return '—';
      const label = p.bundlePosition
        ? `${escapeHtml(p.bundlePosition)} of ${escapeHtml(p.bundleSize || '?')}`
        : `bundle &times; ${escapeHtml(p.bundleSize || '?')}`;
      const cls = p.bundlePosition ? 'badge-bundle-member' : 'badge-bundle-origin';
      // v0.7.13: clickable when bundleId is set — opens the slide-out sibling
      // panel below the row. Pre-migration legacy rows (no bundleId yet) fall
      // back to the static span until the migration runs.
      if (p.bundleId) {
        return `<button type="button" class="badge bundle-chip ${cls}" data-bundle-id="${escapeHtml(p.bundleId)}" data-row-id="${p.id}" title="Click to see all bundle members">${label}</button>`;
      }
      return `<span class="badge ${cls}">${label}</span>`;
    })()}</td>
    <td class="col-boughtBy">${(() => {
      // v0.17.0: STORE + BUYER + CARD consolidated into one column to free
      // horizontal space. Each piece keeps its own filter-chip behavior so
      // clicking still narrows the table; missing pieces are skipped, and
      // an entirely empty cell renders as a single em-dash.
      const parts = [];
      if (p.store) parts.push(`<span class="bb-store">${escapeHtml(p.store)}</span>`);
      if (p.buyer) parts.push(`<button type="button" class="cell-chip bb-chip" data-filter-col="buyer" data-filter-val="${escapeHtml(p.buyer)}" title="Filter to ${escapeHtml(p.buyer)}">${escapeHtml(p.buyer)}</button>`);
      if (p.cardLast4) parts.push(`<button type="button" class="cell-chip bb-chip" data-filter-col="cardLast4" data-filter-val="${escapeHtml(p.cardLast4)}" title="Filter to card •••• ${escapeHtml(p.cardLast4)}">•••• ${escapeHtml(p.cardLast4)}</button>`);
      if (!parts.length) return '—';
      return `<div class="bought-by">${parts.join('<span class="bb-sep" aria-hidden="true">·</span>')}</div>`;
    })()}</td>
    <td class="col-purchaseDate">${formatDate(p.purchaseDate)}</td>
    <td class="col-upc"><code>${escapeHtml(p.upc)}</code></td>
    <td class="notes-cell col-notes">${(() => {
      // Notes column is space-hungry on a wide desktop table. Show a short
      // preview chip; click to expand inline. Reuses the .mc-more-btn click
      // handler? No — desktop has its own toggle (notes-chip class).
      // Expansion state shares the expandedCards Set so opening on mobile
      // and switching to desktop keeps it open.
      if (!p.notes) return '';
      const PREVIEW = 40;
      const expanded = expandedCards.has(p.id);
      const text = escapeHtml(p.notes);
      const truncated = p.notes.length > PREVIEW;
      if (!truncated) return `<span class="notes-text">${text}</span>`;
      const preview = escapeHtml(p.notes.slice(0, PREVIEW)) + '…';
      return expanded
        ? `<button type="button" class="notes-chip is-expanded" data-id="${p.id}" title="Click to collapse"><span class="notes-text">${text}</span></button>`
        : `<button type="button" class="notes-chip" data-id="${p.id}" title="Click to expand">${preview}</button>`;
    })()}</td>
    <td class="actions-cell col-actions">
      <button type="button" class="edit-btn" data-id="${p.id}">Edit</button>
      ${isActive(p) ? `<button type="button" class="finish-btn" data-id="${p.id}" title="Mark as finished — sets end date">Finish</button>` : ''}
      <button type="button" class="duplicate-btn" data-id="${p.id}" title="Duplicate this product as a new entry">Duplicate</button>
      ${priceHistoryCount(p.upc) >= 2 ? `<button type="button" class="history-btn" data-id="${p.id}" title="Price history for this UPC across all purchases">History</button>` : ''}
      <button type="button" class="share-btn" data-id="${p.id}" title="Share link or export PNG">Share</button>
      <button type="button" class="delete-btn" data-id="${p.id}">Delete</button>
    </td>
    <td class="mobile-card-cell">${renderMobileCard(p)}</td>
  `;
  return tr;
}

// v0.7.13 — full-width row inserted below an expanded bundle row, listing
// all sibling rows that share the same bundleId. Clicking a sibling jumps
// to its Edit dialog. The current row is highlighted via .is-current.
// Renders as a `<tr>` with a single colspan'd `<td>` so it spans the full
// table width. v0.17.0: 16 desktop columns + 1 mobile-card-cell = 17 total
// (was 19 pre-v0.17.0 when STORE/BUYER/CARD were three separate columns).
// Shared body of the slide-out panel — inner HTML only, used both for the
// desktop full-width row and the mobile inline-in-card variant.
function renderBundleSiblingsInner(p) {
  const siblings = bundleSiblings(p.bundleId);
  siblings.sort((a, b) => {
    const ap = Number(a.bundlePosition);
    const bp = Number(b.bundlePosition);
    const aOk = isFinite(ap) && ap > 0;
    const bOk = isFinite(bp) && bp > 0;
    if (aOk && bOk) return ap - bp;
    if (aOk) return -1;
    if (bOk) return 1;
    return 0;
  });
  const totalSlots = Number(p.bundleSize) || siblings.length;
  const filled = siblings.length;
  const remaining = Math.max(0, totalSlots - filled);
  const items = siblings.map(s => {
    const isCurrent = s.id === p.id;
    const status = isFinished(s) ? 'finished' : isActive(s) ? 'active' : 'inventory';
    const posLabel = s.bundlePosition ? `#${escapeHtml(s.bundlePosition)}` : '#?';
    return `<button type="button" class="bundle-sibling${isCurrent ? ' is-current' : ''}" data-id="${s.id}" title="Click to edit ${escapeHtml(s.productName)}">
      <span class="bundle-sibling-pos">${posLabel}</span>
      <span class="bundle-sibling-name">${escapeHtml(s.productName) || '(unnamed)'}</span>
      <span class="badge badge-${status}">${status}</span>
    </button>`;
  }).join('');
  const remainingNote = remaining > 0
    ? `<span class="bundle-siblings-remaining">${remaining} slot${remaining === 1 ? '' : 's'} unfilled — use <em>Continue existing bundle</em> in the Add dialog to fill the rest.</span>`
    : '';
  return `<div class="bundle-siblings">
    <div class="bundle-siblings-header">
      <span class="bundle-siblings-label">Bundle members <strong>${filled} of ${escapeHtml(String(totalSlots))}</strong></span>
      <button type="button" class="bundle-siblings-close" data-bundle-close="1" title="Close">&times;</button>
    </div>
    <div class="bundle-siblings-list">${items}</div>
    ${remainingNote}
  </div>`;
}

function renderBundleSiblingsInline(p) {
  return renderBundleSiblingsInner(p);
}

function renderBundleSiblingsRow(p) {
  const tr = document.createElement('tr');
  tr.className = 'bundle-siblings-row';
  // colspan=17: 16 desktop columns + 1 mobile-card-cell (post-v0.17.0). The
  // cell spans the full table width so the panel reads as detail belonging
  // to the row above.
  tr.innerHTML = `<td colspan="17" class="bundle-siblings-cell">${renderBundleSiblingsInner(p)}</td>`;
  return tr;
}

function renderStats() {
  // v0.15.0: every aggregate filters favorites out via trackedOnly().
  const tracked = trackedOnly();
  const count = tracked.length;
  const active = tracked.filter(isActive).length;
  const inventory = tracked.filter(isInventory).length;
  const finished = tracked.filter(isFinished).length;
  // v0.7.7: spend tiles exclude inventory. Rationale: until you start using
  // a product, treating it as "spent" mixes accounting cash-flow with the
  // app's usage-tracking purpose. Inventory items only contribute to spend
  // metrics once they get a startDate (active or finished). Same exclusion
  // applies to YTD spend and to the dashboard groupAllocatedSpend below.
  const total = tracked
    .filter(p => !isInventory(p))
    .reduce((s, p) => s + (allocatedCost(p) || 0), 0);

  // Year-to-date metrics
  const now = new Date();
  const currentYear = now.getFullYear();
  const yearStart = new Date(currentYear, 0, 1);

  // YTD spend: products purchased AND started using in the current calendar
  // year. Inventory excluded — see comment on `total` above. Falls back to
  // startDate if purchaseDate is missing (legacy rows).
  const ytdSpend = tracked.reduce((s, p) => {
    if (isInventory(p)) return s;
    const purchase = parseLocalDate(p.purchaseDate || p.startDate);
    if (!purchase || purchase.getFullYear() !== currentYear) return s;
    return s + (allocatedCost(p) || 0);
  }, 0);

  // YTD $/day — v0.14.2: was sum-of-per-product-rates which double-counted
  // sequential products (two $5 underarms used in succession over 30 days
  // showed as $0.67/day instead of the true $0.33/day). Now: sum of
  // category-level rates, where each category's rate is total spend on
  // that category divided by the date span its products covered. Summing
  // across categories is correct because categories are typically used in
  // parallel (toothpaste + soap + shampoo all run concurrently), so the
  // sum genuinely represents your daily burn rate across all tracked
  // products. Excludes inventory (no startDate → no rate).
  const typesActiveYTD = new Set();
  for (const p of tracked) {
    if (isInventory(p)) continue;
    const start = parseLocalDate(p.startDate);
    if (!start || start > now) continue;
    const end = p.endDate ? parseLocalDate(p.endDate) : now;
    if (!end || end < yearStart) continue;
    if (p.productType) typesActiveYTD.add(p.productType);
  }
  let ytdPerDay = 0;
  for (const t of typesActiveYTD) {
    const r = categoryDailyRate(t);
    if (r != null && isFinite(r)) ytdPerDay += r;
  }

  // v0.15.1: Rolling 30-day cost. Each tracked non-inventory product
  // contributes its allocatedCost prorated by how many of its lifespan
  // days fall in the [today-30, today] window. Correctly handles
  // sequential same-type products (two $5 underarms back-to-back over
  // 30 days = $10, not $20) and partial-window overlaps. Updates daily
  // as the window rolls forward.
  const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
  let rolling30 = 0;
  for (const p of tracked) {
    if (isInventory(p)) continue;
    const lifespanDays = calcDuration(p);
    if (lifespanDays == null || lifespanDays <= 0) continue;
    const start = parseLocalDate(p.startDate);
    const end = p.endDate ? parseLocalDate(p.endDate) : now;
    if (!start || !end) continue;
    const overlapStart = start > windowStart ? start : windowStart;
    const overlapEnd = end < now ? end : now;
    if (overlapEnd < overlapStart) continue;
    const overlapDays = Math.max(1, Math.round((overlapEnd - overlapStart) / 86400000) + 1);
    const cost = allocatedCost(p);
    if (!isFinite(cost) || cost <= 0) continue;
    rolling30 += (cost / lifespanDays) * Math.min(overlapDays, lifespanDays);
  }

  document.getElementById('stat-count').textContent = count;
  document.getElementById('stat-active').textContent = active;
  document.getElementById('stat-inventory').textContent = inventory;
  document.getElementById('stat-finished').textContent = finished;
  document.getElementById('stat-total').textContent = money(total);
  document.getElementById('stat-ytd-spend').textContent = money(ytdSpend);
  // Top-level stat cards stay at 2 decimals for readability. The dashboard
  // "avg $/day" card still uses moneyFine because it's comparing fine-grained
  // values. See user request v0.7.2.
  document.getElementById('stat-ytd-perday').textContent = money(ytdPerDay);
  // v0.15.1: rolling 30-day cost
  document.getElementById('stat-rolling30').textContent = money(rolling30);
}

/* ---------- dashboard ---------- */

function renderDashboard() {
  const emptyEl = document.getElementById('dash-empty');
  const chartsWrap = document.querySelector('.dash-charts');
  const cardsWrap = document.querySelector('.dash-cards');
  if (!emptyEl || !chartsWrap || !cardsWrap) return; // dashboard not in DOM (shouldn't happen, defensive)

  const hasData = products.length > 0;
  emptyEl.hidden = hasData;
  chartsWrap.hidden = !hasData;
  cardsWrap.hidden = !hasData;

  renderDashCards();

  // Only actually draw charts when dashboard is visible — avoids laying out into zero-height canvases
  // which causes Chart.js to render at odd sizes. We also re-render on tab switch.
  if (currentView === 'dashboard' && hasData) {
    renderChartByType();
    renderChartByStore();
    renderChartFinishedByMonth();
    renderChartPerDayByType();
    renderChartCountByType();
    renderChartLongestRunning();
  }
}

function renderDashCards() {
  // Avg $/day across active products that have a meaningful value
  const activePerDays = products
    .filter(isActive)
    .map(p => calcCostPerDay(p))
    .filter(v => v != null && isFinite(v) && v > 0);
  const avgPerDay = activePerDays.length
    ? activePerDays.reduce((s, v) => s + v, 0) / activePerDays.length
    : null;
  document.getElementById('dash-avg-per-day').textContent =
    avgPerDay != null ? moneyFine(avgPerDay) : '—';

  // Avg lifespan of finished products
  const finishedDurations = products
    .filter(p => p.endDate)
    .map(p => calcDuration(p))
    .filter(v => v != null && isFinite(v) && v > 0);
  const avgLifespan = finishedDurations.length
    ? finishedDurations.reduce((s, v) => s + v, 0) / finishedDurations.length
    : null;
  document.getElementById('dash-avg-lifespan').textContent =
    avgLifespan != null ? `${Math.round(avgLifespan)} day${Math.round(avgLifespan) === 1 ? '' : 's'}` : '—';

  // Top category + store by allocated spend
  const byType = groupAllocatedSpend(p => p.productType || 'Unknown');
  const byStore = groupAllocatedSpend(p => p.store || 'Unknown');
  const topType = topEntry(byType);
  const topStore = topEntry(byStore);
  document.getElementById('dash-top-category').textContent =
    topType ? `${topType[0]} (${money(topType[1])})` : '—';
  document.getElementById('dash-top-store').textContent =
    topStore ? `${topStore[0]} (${money(topStore[1])})` : '—';
}

function groupAllocatedSpend(keyFn) {
  // Inventory items are excluded from all spend aggregations (see renderStats
  // comment for rationale). v0.15.0: favorites also excluded.
  const map = new Map();
  for (const p of trackedOnly()) {
    if (isInventory(p)) continue;
    const k = keyFn(p);
    if (!k) continue;
    const v = allocatedCost(p) || 0;
    map.set(k, (map.get(k) || 0) + v);
  }
  return map;
}

function topEntry(map) {
  let best = null;
  for (const [k, v] of map) {
    if (v <= 0) continue;
    if (!best || v > best[1]) best = [k, v];
  }
  return best;
}

function sortedEntriesDesc(map) {
  return [...map.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
}

function destroyChart(key) {
  if (charts[key]) { charts[key].destroy(); charts[key] = null; }
}

function renderChartByType() {
  const entries = sortedEntriesDesc(groupAllocatedSpend(p => p.productType || 'Unknown'));
  destroyChart('byType');
  if (entries.length === 0) return;
  const labels = entries.map(([k]) => k);
  const values = entries.map(([, v]) => round2(v));
  const colors = labels.map((_, i) => CHART_PALETTE[i % CHART_PALETTE.length]);

  charts.byType = new Chart(document.getElementById('chart-by-type'), {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderColor: '#fff', borderWidth: 2 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 12, font: { size: 12 } } },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.label}: ${money(ctx.parsed)}`
          }
        }
      },
      cutout: '55%'
    }
  });
}

function renderChartByStore() {
  const entries = sortedEntriesDesc(groupAllocatedSpend(p => p.store || 'Unknown'));
  destroyChart('byStore');
  if (entries.length === 0) return;
  const labels = entries.map(([k]) => k);
  const values = entries.map(([, v]) => round2(v));

  charts.byStore = new Chart(document.getElementById('chart-by-store'), {
    type: 'bar',
    data: { labels, datasets: [{ data: values, backgroundColor: '#2b5fd9', borderRadius: 4 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => money(ctx.parsed.x) } }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { callback: v => money(v) },
          grid: { color: '#eef1f7' }
        },
        y: { grid: { display: false } }
      }
    }
  });
}

function renderChartFinishedByMonth() {
  // Last 12 months bucketed by endDate. Products without endDate are ignored.
  const now = new Date();
  const buckets = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleString(undefined, { month: 'short', year: '2-digit' }),
      count: 0
    });
  }
  const bucketIndex = new Map(buckets.map((b, i) => [b.key, i]));

  for (const p of products) {
    if (!p.endDate) continue;
    const d = new Date(p.endDate);
    if (isNaN(d)) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const idx = bucketIndex.get(key);
    if (idx != null) buckets[idx].count += 1;
  }

  destroyChart('finishedByMonth');
  charts.finishedByMonth = new Chart(document.getElementById('chart-finished-per-month'), {
    type: 'bar',
    data: {
      labels: buckets.map(b => b.label),
      datasets: [{ data: buckets.map(b => b.count), backgroundColor: '#2d8a5f', borderRadius: 4 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `${ctx.parsed.y} finished` } }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          ticks: { precision: 0, stepSize: 1 },
          grid: { color: '#eef1f7' }
        }
      }
    }
  });
}

function round2(v) { return Math.round((v + Number.EPSILON) * 100) / 100; }

/* ---------- v0.7.12 trends panel ----------
 * One rotating "insight" line above the stats bar. Two layers:
 *   1) Real-data insights computed from the user's products. Each generator
 *      returns a string when its conditions are met, otherwise null. We
 *      shuffle the order on each page load so different insights surface
 *      across reloads (per user batch-6 answer #2).
 *   2) Cold-start "Did you know" facts keyed by product type, used when no
 *      generator can fire (not enough data). Pulled from a static curated
 *      corpus tied to a product type the user actually has.
 * Computed once per page load and cached so Firestore snapshot updates
 * don't re-roll the insight mid-session. Reset on sign-out.
 */

const COLD_START_FACTS = {
  Underarm: [
    "Most antiperspirants take a few days of consistent use before they hit peak effectiveness.",
    "A standard stick deodorant lasts 2–3 months with daily use.",
    "Aluminum-free deodorants typically wear off faster — many users report 3–5 hours of coverage."
  ],
  Toothbrush: [
    "Toothbrushes should be replaced every 3 months — sooner if you've been sick.",
    "Frayed bristles clean up to 30% less effectively than fresh ones.",
    "An average person spends roughly 38 days of their life brushing their teeth."
  ],
  Toothpaste: [
    "A typical 4oz tube lasts about 30 days for one person brushing twice daily.",
    "Most dentists recommend a pea-sized amount per brush — about 0.25 grams.",
    "Whitening toothpastes generally need 2–6 weeks of consistent use to show visible results."
  ],
  Floss: [
    "A 50m roll is about 165 single-use lengths — roughly 2 months of daily flossing.",
    "Waxed floss glides between tight teeth more easily but may catch less plaque than unwaxed.",
    "Storing floss in a humid bathroom can degrade the wax coating faster than you'd expect."
  ],
  Mouthwash: [
    "Most mouthwashes have a 2–3 year unopened shelf life and about a year after opening.",
    "Alcohol-based rinses can dry out oral tissue with prolonged daily use — alternate days helps.",
    "Therapeutic mouthwashes work best 30 minutes after brushing, not immediately after."
  ],
  Facewash: [
    "A standard pump bottle delivers about 1.5–2ml per pump — roughly 150 uses per 8oz bottle.",
    "Most face washes are formulated to work in 30–60 seconds of contact time.",
    "Cleansers with active ingredients can lose potency 6–12 months after first opening."
  ],
  Shampoo: [
    "A 12oz bottle lasts about 2 months for daily use — longer for shorter hair.",
    "Most shampoos are 75–80% water by volume.",
    "Sulfate-free shampoos lather less but tend to last about the same number of washes."
  ],
  Soap: [
    "An 8oz bar lasts about 4 weeks for one person showering daily.",
    "A liquid soap pump is roughly 1.5ml — about 250 pumps per 8oz bottle.",
    "Glycerin soaps melt faster in humid bathrooms — store on a draining dish to extend life."
  ]
};

// Each generator: takes the products array, returns a string or null.
// Generators get shuffled per page load so the same one doesn't always win.
const INSIGHT_GENERATORS = [
  // Most-spent category
  function topSpendCategory(ps) {
    const used = ps.filter(p => !isInventory(p));
    if (used.length < 3) return null;
    const map = new Map();
    for (const p of used) {
      const k = p.productType || 'Unknown';
      map.set(k, (map.get(k) || 0) + (allocatedCost(p) || 0));
    }
    const top = topEntry(map);
    if (!top || top[1] <= 0) return null;
    const count = used.filter(p => p.productType === top[0]).length;
    return `You've spent the most on ${top[0]} so far — ${money(top[1])} across ${count} item${count === 1 ? '' : 's'}.`;
  },
  // Longest currently active product
  function longestActive(ps) {
    const active = ps.filter(isActive)
      .map(p => ({ p, dur: calcDuration(p) }))
      .filter(x => x.dur != null && x.dur >= 7)
      .sort((a, b) => b.dur - a.dur);
    if (active.length === 0) return null;
    const x = active[0];
    return `${x.p.productName} has been going for ${x.dur} days and counting — your longest active product right now.`;
  },
  // Recently finished products
  function recentlyFinished(ps) {
    const now = new Date();
    const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    const recent = ps.filter(p => {
      if (!p.endDate) return false;
      const d = parseLocalDate(p.endDate);
      return d && d >= cutoff;
    });
    if (recent.length < 2) return null;
    return `You've finished ${recent.length} products in the last 30 days.`;
  },
  // Highest per-day burn category — v0.7.18: finished products only.
  // Active products are still in progress; their `calcCostPerDay` uses today
  // as the endpoint, which inflates the rate with not-yet-final data.
  // Inventory has no startDate so it's already excluded by calcCostPerDay,
  // but we filter explicitly to keep the rule self-evident in the code.
  function topPerDayCategory(ps) {
    // v0.14.2: use categoryDailyRate (corrects sequential-product inflation)
    // instead of summing per-product rates. Still requires 3+ finished
    // products as the min-data threshold so this only fires when there's
    // real data to compute against.
    const finished = ps.filter(isFinished);
    if (finished.length < 3) return null;
    const types = new Set();
    for (const p of ps) {
      if (!isInventory(p) && p.productType) types.add(p.productType);
    }
    let bestType = null;
    let bestRate = 0;
    for (const t of types) {
      const r = categoryDailyRate(t, ps);
      if (r != null && isFinite(r) && r > bestRate) {
        bestRate = r;
        bestType = t;
      }
    }
    if (!bestType || bestRate <= 0) return null;
    return `${bestType} is your highest daily-cost category, burning ${moneyFine(bestRate)} per day.`;
  },
  // Inventory pile-up
  function inventoryPileUp(ps) {
    const inv = ps.filter(isInventory).length;
    if (inv < 3) return null;
    return `You have ${inv} item${inv === 1 ? '' : 's'} sitting in inventory — give one a Start date when you crack it open to start tracking its lifespan.`;
  }
];

function pickRealInsight(ps) {
  // Shuffle generator order each call so reloads surface different insights.
  const gens = [...INSIGHT_GENERATORS].sort(() => Math.random() - 0.5);
  for (const gen of gens) {
    const result = gen(ps);
    if (result) return result;
  }
  return null;
}

function pickColdStartFact(ps) {
  if (ps.length === 0) return null;
  const counts = new Map();
  for (const p of ps) {
    const t = p.productType;
    if (!t) continue;
    counts.set(t, (counts.get(t) || 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [type] of ranked) {
    const facts = COLD_START_FACTS[type];
    if (facts && facts.length) {
      return { type, fact: facts[Math.floor(Math.random() * facts.length)] };
    }
  }
  return null;
}

// Cache state: undefined = not yet computed (waiting for first non-empty
// products snapshot); null = computed and got nothing; object = result.
// Reset to undefined on sign-out so the next sign-in re-rolls a fresh
// insight rather than reusing a stale one.
let trendInsightCache;

function computeTrendInsight() {
  // v0.15.0: trends always operate on tracked products only — favorites are
  // catalog references, not data the user has insights about.
  const ps = trackedOnly();
  const real = pickRealInsight(ps);
  if (real) return { kind: 'real', text: real };
  const cold = pickColdStartFact(ps);
  if (cold) return { kind: 'cold', text: cold.fact };
  return null;
}

function renderTrendsPanel() {
  const panel = document.getElementById('trends-panel');
  if (!panel) return;
  // Compute the insight on the FIRST render that has products. Subsequent
  // renders (from snapshot updates, view switches, etc.) reuse the cached
  // value — the panel doesn't re-roll mid-session.
  if (trendInsightCache === undefined && products.length > 0) {
    trendInsightCache = computeTrendInsight();
  }
  const insight = trendInsightCache;
  if (!insight) {
    panel.hidden = true;
    panel.innerHTML = '';
    return;
  }
  panel.hidden = false;
  const tagLabel = insight.kind === 'real' ? 'Trend' : 'Did you know';
  const tagClass = insight.kind === 'real' ? 'trends-tag' : 'trends-tag trends-tag-cold';
  panel.innerHTML = `<span class="${tagClass}">${tagLabel}</span><span class="trends-text">${escapeHtml(insight.text)}</span>`;
}

/* v0.10.0 — Reorder reminders. For each active product, look at the average
 * lifespan of all finished products of the same productType. When the active
 * one is at or past ~85% of that average, surface it. Sorted by progress
 * descending so the most urgent show first; capped at 5 to keep the panel
 * compact. Hides entirely when no products meet the threshold. */
const REMINDER_THRESHOLD = 0.85;
const REMINDER_MAX = 5;

function computeReorderReminders() {
  // Build a map of productType → mean finished lifespan (in days). Skip types
  // with too few finished examples to be meaningful.
  const lifespans = new Map(); // type → [duration, ...]
  for (const p of products) {
    if (!isFinished(p)) continue;
    const d = calcDuration(p);
    if (d == null || !isFinite(d) || d <= 0) continue;
    const k = p.productType || '';
    if (!k) continue;
    if (!lifespans.has(k)) lifespans.set(k, []);
    lifespans.get(k).push(d);
  }
  const meanLifespan = new Map();
  for (const [k, arr] of lifespans) {
    if (arr.length < 2) continue; // need at least 2 finished examples
    const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
    meanLifespan.set(k, mean);
  }

  const reminders = [];
  for (const p of products) {
    if (!isActive(p)) continue;
    const k = p.productType || '';
    const mean = meanLifespan.get(k);
    if (mean == null) continue;
    const dur = calcDuration(p);
    if (dur == null) continue;
    const ratio = dur / mean;
    if (ratio < REMINDER_THRESHOLD) continue;
    reminders.push({
      product: p,
      currentDays: dur,
      meanDays: Math.round(mean),
      ratio,
      pastDue: ratio >= 1
    });
  }
  reminders.sort((a, b) => b.ratio - a.ratio);
  return reminders.slice(0, REMINDER_MAX);
}

function renderReorderReminders() {
  const panel = document.getElementById('reminders-panel');
  if (!panel) return;
  const reminders = computeReorderReminders();
  if (reminders.length === 0) {
    panel.hidden = true;
    panel.innerHTML = '';
    return;
  }
  const items = reminders.map(r => {
    const remaining = r.meanDays - r.currentDays;
    const status = r.pastDue
      ? `<span class="reminder-status reminder-status-past">${Math.abs(remaining)}d past avg</span>`
      : `<span class="reminder-status">~${remaining}d left</span>`;
    return `<button type="button" class="reminder-item" data-id="${r.product.id}" title="Click to open ${escapeHtml(r.product.productName)}">
      <span class="reminder-name">${escapeHtml(r.product.productName)}</span>
      <span class="reminder-progress">${r.currentDays}d of ~${r.meanDays}d avg</span>
      ${status}
    </button>`;
  }).join('');
  panel.hidden = false;
  panel.innerHTML = `
    <div class="reminders-head">
      <span class="reminders-tag">Reorder soon</span>
      <span class="reminders-sub">Based on your past lifespan averages</span>
    </div>
    <div class="reminders-list">${items}</div>
  `;
}

// v0.7.11 charts ---------------------------------------------------------

// $/day by product type — sum of calcCostPerDay across rows in each type.
// Inventory rows have null cost-per-day so they fall through naturally;
// finished rows still contribute (their per-day rate over their lifespan).
function renderChartPerDayByType() {
  // v0.14.2: was sum-of-per-product-rates which double-counted sequential
  // products of the same type. Now uses categoryDailyRate (total cost on
  // the type / span those products covered) — matches user intuition for
  // "$5 underarm × 2 over 30 days = $0.33/day."
  const types = new Set();
  for (const p of trackedOnly()) {
    if (!isInventory(p) && p.productType) types.add(p.productType);
  }
  const map = new Map();
  for (const t of types) {
    const r = categoryDailyRate(t);
    if (r != null && isFinite(r) && r > 0) map.set(t, r);
  }
  const entries = sortedEntriesDesc(map);
  destroyChart('perDayByType');
  if (entries.length === 0) return;
  const labels = entries.map(([k]) => k);
  const values = entries.map(([, v]) => round2(v));
  charts.perDayByType = new Chart(document.getElementById('chart-perday-by-type'), {
    type: 'bar',
    data: { labels, datasets: [{ data: values, backgroundColor: '#7a4ad9', borderRadius: 4 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `${moneyFine(ctx.parsed.x)}/day` } }
      },
      scales: {
        x: { beginAtZero: true, ticks: { callback: v => moneyFine(v) }, grid: { color: '#eef1f7' } },
        y: { grid: { display: false } }
      }
    }
  });
}

// Purchase count by product type — simple histogram, "how often do I buy
// these categories." All products count, including inventory (a purchase
// is a purchase whether or not you've started it).
function renderChartCountByType() {
  const map = new Map();
  for (const p of trackedOnly()) {
    const k = p.productType || 'Unknown';
    map.set(k, (map.get(k) || 0) + 1);
  }
  const entries = [...map.entries()].sort((a, b) => b[1] - a[1]);
  destroyChart('countByType');
  if (entries.length === 0) return;
  const labels = entries.map(([k]) => k);
  const values = entries.map(([, v]) => v);
  charts.countByType = new Chart(document.getElementById('chart-count-by-type'), {
    type: 'bar',
    data: { labels, datasets: [{ data: values, backgroundColor: '#d98f2b', borderRadius: 4 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `${ctx.parsed.x} purchase${ctx.parsed.x === 1 ? '' : 's'}` } }
      },
      scales: {
        x: { beginAtZero: true, ticks: { precision: 0, stepSize: 1 }, grid: { color: '#eef1f7' } },
        y: { grid: { display: false } }
      }
    }
  });
}

// Longest-running products — combined active + finished, sorted by duration
// descending, top 10. Active rows colored primary, finished rows slate so
// you can see at a glance which are still running. Inventory rows have no
// duration and are excluded.
function renderChartLongestRunning() {
  const rows = trackedOnly()
    .map(p => {
      const dur = calcDuration(p);
      if (dur == null || !isFinite(dur) || dur <= 0) return null;
      return { p, dur, status: isActive(p) ? 'active' : 'finished' };
    })
    .filter(Boolean)
    .sort((a, b) => b.dur - a.dur)
    .slice(0, 10);
  destroyChart('longestRunning');
  if (rows.length === 0) return;
  const labels = rows.map(r => {
    const tag = r.status === 'active' ? ' (active)' : '';
    // Truncate long names to keep the y-axis readable
    const name = r.p.productName || '(unnamed)';
    const trimmed = name.length > 32 ? name.slice(0, 32) + '…' : name;
    return trimmed + tag;
  });
  const values = rows.map(r => r.dur);
  const colors = rows.map(r => r.status === 'active' ? '#2b5fd9' : '#5b6b8a');
  charts.longestRunning = new Chart(document.getElementById('chart-longest-running'), {
    type: 'bar',
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderRadius: 4 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const r = rows[ctx.dataIndex];
              const noun = r.status === 'active' ? 'running' : 'used';
              return `${ctx.parsed.x} day${ctx.parsed.x === 1 ? '' : 's'} ${noun}`;
            }
          }
        }
      },
      scales: {
        x: { beginAtZero: true, ticks: { precision: 0, callback: v => `${v}d` }, grid: { color: '#eef1f7' } },
        y: { grid: { display: false } }
      }
    }
  });
}

/* ---------- view + filter switching ---------- */

// Apply preTaxMode to the DOM. Adds/removes a body class that the CSS uses
// to hide the "w/ Tax" column header + every w/ Tax cell. Renders are
// triggered separately by the caller — this is purely presentational.
function applyPreTaxMode() {
  document.body.classList.toggle('pretax-mode', preTaxMode);
}

// v0.17.0: density mode. CSS-only via body class — no re-render needed.
function applyDensityMode() {
  document.body.classList.toggle('density-compact', densityMode === 'compact');
}

// v0.17.0: column visibility. For each column the user has hidden, set a
// body class .cols-hide-<key> that the CSS uses to display:none both the
// <th> and matching <td>s. NAME and ACTIONS are not part of this set.
function applyColumnVisibility() {
  for (const col of TOGGLEABLE_COLUMNS) {
    document.body.classList.toggle(`cols-hide-${col.key}`, !columnVisibility[col.key]);
  }
}

// v0.17.0: persist column visibility to localStorage. Called on every
// checkbox change.
function saveColumnVisibility() {
  try { localStorage.setItem(COLUMNS_KEY, JSON.stringify(columnVisibility)); } catch {}
}

// v0.17.0: build the dropdown menu rows. One checkbox per toggleable
// column. Wiring is delegated to the parent on('change'). Called once on
// init and again whenever the menu is re-opened (cheap; <20 nodes).
function renderColumnsMenu() {
  const host = document.getElementById('columns-menu-rows');
  if (!host) return;
  host.innerHTML = TOGGLEABLE_COLUMNS.map(col => `
    <label class="columns-menu-row">
      <input type="checkbox" data-col-key="${col.key}" ${columnVisibility[col.key] ? 'checked' : ''}>
      <span>${col.label}</span>
    </label>
  `).join('');
}

// v0.12.0: derive the currency symbol from the active currency for use in
// the dialog's currency-prefix decoration. Intl.NumberFormat → formatToParts
// returns the symbol for the user's locale (so "$" for USD, "€" for EUR,
// "¥" for JPY, etc., respecting where the symbol normally appears).
function currentCurrencySymbol() {
  try {
    const parts = new Intl.NumberFormat(undefined, {
      style: 'currency', currency: userCurrency
    }).formatToParts(0);
    const sym = parts.find(p => p.type === 'currency');
    return sym ? sym.value : userCurrency;
  } catch {
    return userCurrency;
  }
}

function applyCurrencySymbol() {
  const sym = currentCurrencySymbol();
  for (const el of document.querySelectorAll('[data-currency-symbol]')) {
    el.textContent = sym;
  }
}

function populateCurrencySelect() {
  const sel = document.getElementById('currency-select');
  if (!sel) return;
  sel.innerHTML = '';
  for (const c of SUPPORTED_CURRENCIES) {
    const sym = (() => {
      try {
        const parts = new Intl.NumberFormat(undefined, {
          style: 'currency', currency: c.code
        }).formatToParts(0);
        const s = parts.find(p => p.type === 'currency');
        return s ? s.value : c.code;
      } catch { return c.code; }
    })();
    const opt = new Option(`${c.code} (${sym}) — ${c.label}`, c.code);
    sel.appendChild(opt);
  }
  sel.value = userCurrency;
}

function setFilter(filter) {
  if (!['all', 'active', 'inventory'].includes(filter)) return;
  currentFilter = filter;
  try { localStorage.setItem(FILTER_KEY, filter); } catch {}
  for (const btn of document.querySelectorAll('.row-filter-tab')) {
    const active = btn.dataset.filter === filter;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  }
  renderTable();
}

function resetFilters() {
  // Reset every axis: row-filter tabs back to "all", chip filters cleared,
  // and (v0.14.0) the search input cleared too. setFilter calls renderTable
  // so we get a redundant render here — fine, cheap.
  activeFilters = {};
  persistActiveFilters();
  searchQuery = '';
  const sb = document.getElementById('row-search');
  if (sb) sb.value = '';
  setFilter('all');
  toast('Filters reset');
}

function setView(view) {
  if (view !== 'table' && view !== 'dashboard' && view !== 'activity' && view !== 'favorites') return;
  currentView = view;
  document.getElementById('view-table').hidden = view !== 'table';
  document.getElementById('view-dashboard').hidden = view !== 'dashboard';
  document.getElementById('view-activity').hidden = view !== 'activity';
  document.getElementById('view-favorites').hidden = view !== 'favorites';
  for (const btn of document.querySelectorAll('.view-tab')) {
    const isActive = btn.dataset.view === view;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  }
  // Dashboard charts must render after the container is visible so Chart.js measures width correctly.
  if (view === 'dashboard') renderDashboard();
  if (view === 'activity') renderActivity();
  if (view === 'favorites') renderFavorites();
}

/* ---------- v0.15.0 Favorites view ---------- */

// Cross-reference: for a favorite, find tracked products that share its UPC
// and aggregate "last used" + "times used." UPC is the strongest match
// signal — name fuzzy-matching is too noisy. If the favorite has no UPC,
// returns zeros (still renders the card, just without usage stats).
function favoriteStats(fav) {
  const upc = (fav.upc || '').trim();
  if (!upc) return { timesUsed: 0, lastUsed: null };
  const usages = products.filter(p =>
    !isFavorite(p) &&
    (p.upc || '').trim() === upc &&
    !!p.startDate
  );
  if (usages.length === 0) return { timesUsed: 0, lastUsed: null };
  let lastUsed = null;
  for (const p of usages) {
    // "Last used" = most recent endDate (if finished) or startDate (if active).
    const candidate = p.endDate || p.startDate;
    if (candidate && (!lastUsed || candidate > lastUsed)) lastUsed = candidate;
  }
  return { timesUsed: usages.length, lastUsed };
}

function renderFavorites() {
  const grid = document.getElementById('favorites-grid');
  const empty = document.getElementById('favorites-empty');
  const count = document.getElementById('favorites-count');
  if (!grid || !empty || !count) return;
  const favs = products.filter(isFavorite);
  // Sort: highest rating first, then most recently created.
  favs.sort((a, b) => {
    const ra = Number(a.favoriteRating) || 0;
    const rb = Number(b.favoriteRating) || 0;
    if (ra !== rb) return rb - ra;
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  });
  count.textContent = favs.length === 0 ? '' : `${favs.length} ${favs.length === 1 ? 'item' : 'items'}`;
  if (favs.length === 0) {
    grid.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  grid.innerHTML = favs.map(f => {
    const stats = favoriteStats(f);
    const rating = Number(f.favoriteRating) || 0;
    const ratingDisplay = rating > 0
      ? `<span class="fav-rating" title="Rating: ${rating} of 5">${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}</span>`
      : '';
    const usageLine = stats.timesUsed > 0
      ? `<span class="fav-usage">Last used ${formatDate(stats.lastUsed)} &middot; tracked ${stats.timesUsed} time${stats.timesUsed === 1 ? '' : 's'}</span>`
      : (f.upc ? '<span class="fav-usage fav-usage-none">Not yet tracked</span>' : '<span class="fav-usage fav-usage-none">No UPC for cross-reference</span>');
    const why = f.favoriteWhy ? `<p class="fav-why">${escapeHtml(f.favoriteWhy)}</p>` : '';
    const thumb = f.imageUrl
      ? `<img class="fav-thumb" src="${escapeHtml(f.imageUrl)}" alt="" loading="lazy" onerror="this.outerHTML='<div class=fav-thumb-fallback></div>'">`
      : '<div class="fav-thumb-fallback"></div>';
    const typeStyle = f.productType ? `style="background:${colorForType(f.productType)};color:#fff"` : '';
    return `<article class="fav-card" data-id="${f.id}">
      ${thumb}
      <div class="fav-body">
        <header class="fav-head">
          ${f.productType ? `<span class="fav-type" ${typeStyle}>${escapeHtml(f.productType)}</span>` : ''}
          ${ratingDisplay}
        </header>
        <h3 class="fav-name">${escapeHtml(f.productName) || '(unnamed)'}</h3>
        ${why}
        ${usageLine}
        <div class="fav-actions">
          <button type="button" class="fav-edit-btn" data-id="${f.id}" title="Edit favorite">Edit</button>
          <button type="button" class="fav-promote-btn" data-id="${f.id}" title="Start tracking a new instance of this product">Track new</button>
          <button type="button" class="fav-delete-btn" data-id="${f.id}" title="Remove from favorites">Remove</button>
        </div>
      </div>
    </article>`;
  }).join('');
}

// v0.7.17 — render the activity log entries. Pulls from localStorage (newest
// first), slices to the user's chosen page size, and renders. Re-runs on
// view switch and after every logActivity write.
function renderActivity() {
  const list = document.getElementById('activity-list');
  const empty = document.getElementById('activity-empty');
  const sel = document.getElementById('activity-pagesize');
  if (!list || !empty || !sel) return;
  // Sync select to persisted size
  sel.value = String(activityPageSize);

  // v0.13.1: distinguish "cache not yet loaded" from "no entries yet". The
  // first happens before initActivityForSession resolves; the second after.
  if (!activityLoaded && currentUser) {
    list.innerHTML = '<p class="loading-state">Loading activity…</p>';
    empty.hidden = true;
    return;
  }

  const all = loadActivity();
  if (all.length === 0) {
    list.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  const visible = all.slice(0, activityPageSize);
  const shownText = visible.length < all.length
    ? `Showing ${visible.length} of ${all.length} entries`
    : `${all.length} ${all.length === 1 ? 'entry' : 'entries'}`;

  const rows = visible.map(e => {
    const date = new Date(e.ts);
    const when = isNaN(date)
      ? ''
      : date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    const actionClass = `activity-action activity-action-${e.action}`;
    const actionLabel = e.action.charAt(0).toUpperCase() + e.action.slice(1);
    const stillExists = !!products.find(p => p.id === e.productId);
    const nameMarkup = stillExists
      ? `<button type="button" class="activity-name-link" data-id="${e.productId}" title="Open this product">${escapeHtml(e.productName)}</button>`
      : `<span class="activity-name-gone">${escapeHtml(e.productName)}</span>`;
    return `<div class="activity-row">
      <span class="activity-when">${escapeHtml(when)}</span>
      <span class="${actionClass}">${actionLabel}</span>
      <span class="activity-product">${nameMarkup}${e.productType ? ` <span class="activity-type">· ${escapeHtml(e.productType)}</span>` : ''}</span>
    </div>`;
  }).join('');

  list.innerHTML = `<div class="activity-summary">${shownText}</div>${rows}`;
}

/* ---------- select population ---------- */

function populateTypeSelect(el, currentValue) {
  const all = allProductTypes();
  el.innerHTML = '';
  el.append(new Option('— Select —', ''));
  for (const v of all) el.append(new Option(v, v));
  if (currentValue && !all.includes(currentValue)) {
    el.append(new Option(currentValue, currentValue));
  }
  el.append(new Option('+ Add new type…', ADD_NEW));
  el.value = currentValue ?? '';
}

function populateRecentSelect(el, values, currentValue, labelFn) {
  el.innerHTML = '';
  el.append(new Option('— None —', ''));
  for (const v of values) el.append(new Option(labelFn ? labelFn(v) : v, v));
  if (currentValue && !values.includes(currentValue)) {
    el.append(new Option(labelFn ? labelFn(currentValue) : currentValue, currentValue));
  }
  el.append(new Option('+ Add new…', ADD_NEW));
  el.value = currentValue ?? '';
}

function populateBundleSelect(el) {
  el.innerHTML = '';
  el.append(new Option('— New product (not continuing a bundle) —', ''));
  for (const b of bundlesList()) {
    // v0.7.14: how many siblings already exist? Use bundleId when available
    // (post-migration); fall back to name+date+size match for legacy rows.
    const filled = b.bundleId
      ? bundleSiblings(b.bundleId).length
      : products.filter(p =>
          !isFavorite(p) &&
          p.bundleStatus &&
          p.productName === b.productName &&
          p.purchaseDate === b.purchaseDate &&
          String(p.bundleSize) === String(b.bundleSize)
        ).length;
    const total = Number(b.bundleSize) || 0;
    const isFull = total > 0 && filled >= total;
    const fillStr = total > 0 ? ` — ${filled}/${total}${isFull ? ' (full)' : ''}` : '';
    const label = `${b.productName} — ${formatDate(b.purchaseDate)} (× ${b.bundleSize})${fillStr}`;
    const opt = new Option(label, b.id);
    if (isFull) opt.disabled = true;
    el.append(opt);
  }
}

async function handleAddNew(selectEl, kind) {
  let value = prompt(`Add new ${kind}:`);
  if (value == null || !(value = value.trim())) {
    selectEl.value = '';
    return;
  }
  if (kind === 'card' && !/^\d{4}$/.test(value)) {
    toast('Card must be exactly 4 digits');
    selectEl.value = '';
    return;
  }
  if (kind === 'product type') {
    const list = [...customTypesCache];
    if (!SEED_PRODUCT_TYPES.includes(value) && !list.includes(value)) {
      list.push(value);
      await saveCustomTypes(list);
      customTypesCache = list; // optimistic — snapshot will confirm
    }
    populateTypeSelect(selectEl, value);
    return;
  }
  const addNewOpt = [...selectEl.options].find(o => o.value === ADD_NEW);
  if (![...selectEl.options].some(o => o.value === value)) {
    const label = kind === 'card' ? `•••• ${value}` : value;
    selectEl.insertBefore(new Option(label, value), addNewOpt);
  }
  selectEl.value = value;
}

/* ---------- dialog / form ---------- */

const dialog = () => document.getElementById('product-dialog');
const form = () => document.getElementById('product-form');

function setBundleSizeVisibility() {
  const f = form();
  const bundled = f.elements.bundleStatus.checked;
  const sizeWrap = document.getElementById('bundle-size-wrap');
  const posWrap = document.getElementById('bundle-position-wrap');
  sizeWrap.hidden = !bundled;
  if (posWrap) posWrap.hidden = !bundled;
  f.elements.bundleSize.required = bundled;
  if (f.elements.bundlePosition) f.elements.bundlePosition.required = bundled;
  if (!bundled) {
    f.elements.bundleSize.value = '';
    if (f.elements.bundlePosition) f.elements.bundlePosition.value = '';
  }
  updateBundlePositionMax();
}

function updateBundlePositionMax() {
  const f = form();
  const pos = f.elements.bundlePosition;
  if (!pos) return;
  const size = Number(f.elements.bundleSize.value);
  if (isFinite(size) && size > 0) {
    pos.max = String(size);
    if (Number(pos.value) > size) pos.value = '';
  } else {
    pos.removeAttribute('max');
  }
}

function populateFormSelects(current = {}) {
  const f = form();
  populateTypeSelect(f.elements.productType, current.productType || '');
  populateRecentSelect(f.elements.store, uniqueValues('store'), current.store || '');
  populateRecentSelect(f.elements.buyer, uniqueValues('buyer'), current.buyer || '');
  populateRecentSelect(f.elements.cardLast4, uniqueValues('cardLast4'),
    current.cardLast4 || '', v => `•••• ${v}`);
}

// v0.15.0: which mode is the product dialog currently in. Drives field
// visibility (data-tracked-only vs data-favorite-only) and validation
// branching in handleSubmit. Cleared in closeDialog.
let dialogMode = 'tracked'; // 'tracked' | 'favorite'

// v0.15.1: keep the dialog's product-image preview in sync with whatever
// imageUrl is in the form. Called after UPC lookup auto-fill, after
// openEditDialog populates fields, and after openDuplicateDialog/Track-new.
function syncDialogImagePreview() {
  const wrap = document.getElementById('upc-image-preview');
  const img = document.getElementById('upc-image-preview-img');
  const logoImg = document.getElementById('upc-brand-logo');
  if (!wrap || !img) return;
  const f = form();
  const url = (f.elements.imageUrl?.value || '').trim();
  const brand = (f.elements.brand?.value || '').trim();
  // v0.15.2: brand logo (left) + product image (right) — both shown when set.
  if (logoImg) {
    if (brand) {
      logoImg.src = brandLogoUrl(brand);
      logoImg.alt = `${brand} logo`;
      logoImg.hidden = false;
      logoImg.onerror = () => { logoImg.hidden = true; };
    } else {
      logoImg.hidden = true;
      logoImg.src = '';
    }
  }
  if (url && /^https:/i.test(url)) {
    img.src = url;
    img.hidden = false;
    img.onerror = () => { img.hidden = true; if (!brand) wrap.hidden = true; };
  } else {
    img.src = '';
    img.hidden = true;
  }
  // Show wrapper if either icon is showing; hide if neither
  wrap.hidden = !brand && !(url && /^https:/i.test(url));
}

function applyDialogMode(mode) {
  dialogMode = mode;
  const dlg = dialog();
  dlg.classList.toggle('is-favorite-mode', mode === 'favorite');
  // Required-attribute juggling: HTML `required` on a hidden input still
  // blocks form submit. So when we hide tracked-only inputs, also clear
  // their required flag — and remember the original so we can restore it
  // when switching back.
  for (const el of dlg.querySelectorAll('[data-tracked-only] input, [data-tracked-only] select')) {
    if (mode === 'favorite') {
      if (el.required) el.dataset.wasRequired = '1';
      el.required = false;
    } else {
      if (el.dataset.wasRequired === '1') el.required = true;
      delete el.dataset.wasRequired;
    }
  }
}

function openAddDialog() {
  editingId = null;
  applyDialogMode('tracked');
  document.getElementById('dialog-title').textContent = 'Add product';
  const f = form();
  f.reset();
  populateFormSelects();
  populateBundleSelect(document.getElementById('continue-bundle'));
  document.getElementById('continue-bundle-wrap').hidden = false;
  // v0.15.1: use local-date helper, not UTC. UTC was off-by-one for users
  // in negative-offset timezones late in the evening.
  f.elements.purchaseDate.value = todayLocalISODate();
  setBundleSizeVisibility();
  setUpcStatus('');
  syncAmazonCheckLink(''); // v0.9.0 — hide the Amazon link until UPC is entered
  syncDialogImagePreview(); // v0.15.1 — hide preview on fresh Add
  dialog().showModal();
  // v0.7.23: autofocus the UPC field on Add. The dialog opens for the
  // primary path (scan or paste a UPC), so the user shouldn't need an extra
  // tap to start typing. requestAnimationFrame because <dialog> needs a
  // tick to settle before focus() takes effect on iOS Safari.
  requestAnimationFrame(() => {
    const upc = f.elements.upc;
    if (upc) try { upc.focus(); } catch {}
  });
}

function openEditDialog(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  editingId = id;
  document.getElementById('dialog-title').textContent = 'Edit product';
  const f = form();
  f.reset();
  populateFormSelects(p);
  document.getElementById('continue-bundle-wrap').hidden = true;
  for (const key of FIELDS) {
    if (key === 'id') continue;
    const el = f.elements[key];
    if (!el) continue;
    if (el.type === 'checkbox') el.checked = !!p[key];
    else el.value = p[key] ?? '';
  }
  setBundleSizeVisibility();
  setUpcStatus('');
  syncAmazonCheckLink(p.upc); // v0.9.0 — show Amazon link if existing UPC is set
  syncDialogImagePreview(); // v0.15.1 — show existing image
  dialog().showModal();
}

function closeDialog() {
  dialog().close();
  editingId = null;
  pendingDuplicateSourceId = null; // v0.7.17 — clear duplicate flag on cancel
  applyDialogMode('tracked'); // v0.15.0 — reset to tracked default
}

// v0.15.0: open the dialog in favorite-add mode. Same form, different
// field visibility + validation. Hidden `favorite` input set to "true"
// so handleSubmit knows to skip date/cost/bundle validation.
function openAddFavoriteDialog() {
  editingId = null;
  applyDialogMode('favorite');
  document.getElementById('dialog-title').textContent = 'Add favorite';
  const f = form();
  f.reset();
  populateFormSelects();
  document.getElementById('continue-bundle-wrap').hidden = true;
  f.elements.favorite.value = 'true';
  syncRatingDisplay(0);
  setUpcStatus('');
  syncAmazonCheckLink('');
  dialog().showModal();
  requestAnimationFrame(() => {
    const upc = f.elements.upc;
    if (upc) try { upc.focus(); } catch {}
  });
}

// Edit an existing favorite. Reuses the populate-from-product loop the
// regular Edit dialog uses; the dialog mode flag handles the rest.
function openEditFavoriteDialog(id) {
  const p = products.find(x => x.id === id);
  if (!p || !isFavorite(p)) return;
  editingId = id;
  applyDialogMode('favorite');
  document.getElementById('dialog-title').textContent = 'Edit favorite';
  const f = form();
  f.reset();
  populateFormSelects(p);
  document.getElementById('continue-bundle-wrap').hidden = true;
  for (const key of FIELDS) {
    if (key === 'id') continue;
    const el = f.elements[key];
    if (!el) continue;
    if (el.type === 'checkbox') el.checked = !!p[key];
    else el.value = p[key] ?? '';
  }
  syncRatingDisplay(Number(p.favoriteRating) || 0);
  setUpcStatus('');
  syncAmazonCheckLink(p.upc);
  dialog().showModal();
}

// "Track new" — user wants to start tracking a new instance of a product
// they had favorited. Opens the standard Add dialog pre-filled with the
// favorite's catalog data (type/name/UPC/image). The favorite stays in
// the catalog; this just creates a separate tracked product.
function trackFromFavorite(id) {
  const fav = products.find(x => x.id === id);
  if (!fav || !isFavorite(fav)) return;
  openAddDialog();
  const f = form();
  // Carry over the catalog data; leave dates/cost/bundle blank for the user.
  const carry = ['productType', 'productName', 'size', 'unit', 'upc', 'imageUrl'];
  for (const key of carry) {
    const el = f.elements[key];
    if (el && fav[key] != null) el.value = fav[key];
  }
  document.getElementById('dialog-title').textContent = 'Track new (from favorite)';
  syncAmazonCheckLink(fav.upc || '');
  toast('Pre-filled from favorite — set start date and save');
}

function syncRatingDisplay(value) {
  const v = Number(value) || 0;
  const f = form();
  if (f.elements.favoriteRating) f.elements.favoriteRating.value = v > 0 ? String(v) : '';
  for (const star of document.querySelectorAll('#rating-input .rating-star')) {
    const sv = Number(star.dataset.value);
    star.classList.toggle('is-active', sv <= v && v > 0);
  }
}

function confirmDeleteFavorite(id) {
  const p = products.find(x => x.id === id);
  if (!p || !isFavorite(p)) return;
  if (!confirm(`Remove "${p.productName}" from favorites? Tracked instances of this product (if any) are NOT affected.`)) return;
  deleteProduct(id).then(() => {
    toast('Favorite removed');
    logActivity('delete', p);
  }).catch(() => {});
}

function handleContinueBundle(e) {
  const id = e.target.value;
  if (!id) return;
  const source = products.find(p => p.id === id);
  if (!source) return;
  const f = form();
  populateFormSelects(source);
  const prefill = ['productName', 'size', 'unit', 'cost', 'costWithTax',
    'purchaseDate', 'upc', 'bundleSize'];
  for (const key of prefill) {
    const el = f.elements[key];
    if (el) el.value = source[key] ?? '';
  }
  f.elements.bundleStatus.checked = true;
  // v0.7.13: copy the source's bundleId so this new row joins the same bundle.
  // If the source somehow lacks a bundleId (pre-migration row that hasn't been
  // migrated yet), generate a fresh one — and assign it to the source too on
  // its next save. handleSubmit also defends against missing bundleId.
  if (f.elements.bundleId) {
    f.elements.bundleId.value = source.bundleId || newBundleId();
  }
  // v0.7.5: do NOT autofill startDate. Pre-v0.7.3 we filled today's date here,
  // which fought the inventory concept introduced in v0.7.3 — users who left a
  // bundle row blank to mark it as inventory got today's date written over it
  // every time. Leave both date fields blank; user fills startDate when (and if)
  // they actually start using the item.
  f.elements.startDate.value = '';
  f.elements.endDate.value = '';
  setBundleSizeVisibility();
  toast('Bundle details filled — leave start date blank to record as inventory');
}

// Duplicate: copy a product's metadata into a fresh Add dialog, leaving dates
// blank so the new row reads as inventory until the user explicitly sets a
// startDate. Bundle membership is preserved (status + size) but the new row
// gets a clean position field — siblings within a bundle should have unique
// positions, so the user picks the next number.
function openDuplicateDialog(id) {
  const source = products.find(p => p.id === id);
  if (!source) return;
  openAddDialog();
  pendingDuplicateSourceId = id; // v0.7.17 — flagged for activity log
  const f = form();
  // Fields that should carry over from source. Excludes: id (new one assigned
  // on save), startDate/endDate (always blank — duplicate = new physical item),
  // bundlePosition (must be unique per bundle), notes (usually item-specific).
  const carryOver = [
    'productType', 'productName', 'size', 'unit',
    'cost', 'costWithTax',
    'bundleStatus', 'bundleSize',
    'store', 'buyer', 'cardLast4',
    'upc'
  ];
  populateFormSelects(source);
  for (const key of carryOver) {
    const el = f.elements[key];
    if (!el) continue;
    if (el.type === 'checkbox') el.checked = !!source[key];
    else el.value = source[key] ?? '';
  }
  // v0.15.3: Duplicate now starts a NEW bundle, not a sibling of the source.
  // Reverted v0.7.13 behavior — turned out it was wrong: the user reported
  // hitting "Position X is already taken" when adding a SECOND physical
  // 2-pack of the same product, because Duplicate kept reusing the source's
  // bundleId. If you actually want a sibling (continuing the same physical
  // bundle), the dialog has a dedicated **Continue existing bundle** picker.
  // Duplicate should mean "similar product, separate physical bundle."
  if (f.elements.bundleId) f.elements.bundleId.value = '';
  // Today's purchaseDate is a sensible default for "I just bought another";
  // user can correct it if they're back-filling history. v0.15.1: local date.
  f.elements.purchaseDate.value = todayLocalISODate();
  setBundleSizeVisibility();
  document.getElementById('dialog-title').textContent = 'Duplicate product';
  toast('Duplicated — set start date when you begin using it');
}

async function handleSubmit(e) {
  e.preventDefault();
  if (!currentUser) { toast('Please sign in first'); return; }
  const f = form();
  const data = {};
  for (const key of FIELDS) {
    if (key === 'id') continue;
    const el = f.elements[key];
    if (!el) continue;
    if (el.type === 'checkbox') data[key] = el.checked;
    else data[key] = (el.value ?? '').toString().trim();
  }

  // v0.15.0: favorite-mode shortcut. The hidden `favorite` input is "true"
  // when openAddFavoriteDialog set the dialog up. Validation skips
  // dates/cost/bundle since those don't apply to a catalog entry.
  const isFavoriteSubmit = data.favorite === 'true' || data.favorite === true;
  if (isFavoriteSubmit) {
    data.favorite = true;
    if (!data.productType || data.productType === ADD_NEW) {
      toast('Product type is required'); return;
    }
    if (!data.productName) { toast('Product name is required'); return; }
    // Clear all tracked-only fields so they don't bleed into the favorite doc.
    data.startDate = ''; data.endDate = '';
    data.cost = ''; data.costWithTax = '';
    data.bundleStatus = false; data.bundleSize = ''; data.bundlePosition = ''; data.bundleId = '';
    data.store = ''; data.buyer = ''; data.cardLast4 = '';
    data.purchaseDate = '';
    // Continue to id assignment + save below (reuses the same path).
    const id = editingId || newId();
    if (!editingId) data.createdAt = new Date().toISOString();
    else {
      const existing = products.find(p => p.id === editingId);
      data.createdAt = existing?.createdAt || new Date().toISOString();
    }
    const saveBtn = document.getElementById('dialog-save');
    saveBtn.disabled = true;
    try {
      const product = { id, ...data };
      await saveProduct(product);
      toast(editingId ? 'Favorite updated' : 'Added to favorites');
      logActivity(editingId ? 'edit' : 'add', product);
      closeDialog();
      // If we're already on the Favorites view, refresh it now.
      if (currentView === 'favorites') renderFavorites();
    } catch {} finally { saveBtn.disabled = false; }
    return;
  }

  // Tracked-mode validation continues below — favorite flag explicitly false.
  data.favorite = false;

  if (!data.productType || data.productType === ADD_NEW) {
    toast('Product type is required'); return;
  }
  if (data.store === ADD_NEW) data.store = '';
  if (data.buyer === ADD_NEW) data.buyer = '';
  if (data.cardLast4 === ADD_NEW) data.cardLast4 = '';

  if (!data.productName) { toast('Product name is required'); return; }
  if (!data.upc) { toast('UPC is required'); return; }
  // v0.15.1: explicit JS validation for size / unit / cost (form is novalidate
  // so HTML5 required attributes don't fire). Previously these silently failed
  // on mobile when the native validation tooltip wasn't visible.
  if (!data.size || !isFinite(Number(data.size)) || Number(data.size) <= 0) {
    toast('Size is required (a positive number)'); return;
  }
  if (!data.unit) { toast('Unit is required'); return; }
  if (!data.cost || !isFinite(Number(data.cost)) || Number(data.cost) < 0) {
    toast('Cost is required'); return;
  }
  if (data.endDate && data.startDate && data.endDate < data.startDate) {
    toast('End date cannot be before start date'); return;
  }
  if (data.bundleStatus) {
    const bs = Number(data.bundleSize);
    if (!isFinite(bs) || bs <= 0) {
      toast('Enter how many were in the bundle');
      return;
    }
    const bp = Number(data.bundlePosition);
    if (!isFinite(bp) || bp <= 0 || bp > bs || Math.floor(bp) !== bp) {
      toast(`Enter which number of the bundle this is (1 to ${bs})`);
      return;
    }
    // v0.7.13: ensure bundleId is set. The hidden input carries it through
    // for Continue/Duplicate/Edit; brand-new bundles get a fresh one here.
    if (!data.bundleId) data.bundleId = newBundleId();
    // v0.7.14: position uniqueness — no two siblings can claim the same
    // bundlePosition. Editing the current row to its existing position is
    // fine (the row IS itself, so it shouldn't conflict with itself). Only
    // run this check when bundleId is real (post-migration / new bundles).
    if (data.bundleId) {
      const conflict = products.find(p =>
        p.bundleId === data.bundleId &&
        p.id !== editingId &&
        Number(p.bundlePosition) === bp
      );
      if (conflict) {
        // Suggest the next available position.
        const taken = new Set(
          products
            .filter(p => p.bundleId === data.bundleId && p.id !== editingId)
            .map(p => Number(p.bundlePosition))
            .filter(n => isFinite(n) && n > 0)
        );
        let suggest = null;
        for (let i = 1; i <= bs; i++) {
          if (!taken.has(i)) { suggest = i; break; }
        }
        const suggestText = suggest != null
          ? ` Try position ${suggest} — that slot is open.`
          : ` All positions in this bundle are filled.`;
        toast(`Position ${bp} is already taken by "${conflict.productName}".${suggestText}`);
        return;
      }
    }
  } else {
    data.bundleSize = '';
    data.bundlePosition = '';
    data.bundleId = '';
  }

  const id = editingId || newId();

  // v0.7.17: createdAt — assign on first add, preserve on edit. Stored on the
  // Firestore product so timestamps are durable and synced across devices.
  if (!editingId) {
    data.createdAt = new Date().toISOString();
  } else {
    const existing = products.find(p => p.id === editingId);
    data.createdAt = existing?.createdAt || data.createdAt || new Date().toISOString();
  }

  const saveBtn = document.getElementById('dialog-save');
  saveBtn.disabled = true;
  try {
    const product = { id, ...data };
    await saveProduct(product);
    toast(editingId ? 'Product updated' : 'Product added');
    // v0.7.17: log to activity feed AFTER successful save. Differentiate
    // duplicate from plain add using the pendingDuplicateSourceId flag.
    let action = editingId ? 'edit' : 'add';
    if (!editingId && pendingDuplicateSourceId) action = 'duplicate';
    logActivity(action, product);
    pendingDuplicateSourceId = null;
    closeDialog();
  } catch {
    // toast already shown by saveProduct
  } finally {
    saveBtn.disabled = false;
  }
}

/* ---------- delete confirm ---------- */

function confirmDelete(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  document.getElementById('confirm-message').textContent =
    `Delete "${p.productName}"? This cannot be undone.`;
  const cd = document.getElementById('confirm-dialog');
  cd.showModal();
  const yes = document.getElementById('confirm-yes');
  const no = document.getElementById('confirm-no');
  const cleanup = () => { yes.onclick = null; no.onclick = null; };
  yes.onclick = async () => {
    yes.disabled = true;
    try {
      await deleteProduct(id);
      toast('Product deleted');
      // v0.7.17: log delete to activity feed.
      logActivity('delete', p);
    } catch {}
    finally { yes.disabled = false; }
    cd.close(); cleanup();
  };
  no.onclick = () => { cd.close(); cleanup(); };
}

/* ---------- v0.14.1 quick-finish dialog ---------- */
// Lightweight "mark this active product as finished" flow. The full Edit
// dialog works for this too, but on mobile especially the path is heavy
// (open dialog → scroll to End date field → date picker → save). This is
// one tap → confirm date → done. Defaults to today; user can change.

let pendingFinishId = null;

function openFinishDialog(productId) {
  const p = products.find(x => x.id === productId);
  if (!p) return;
  if (!isActive(p)) {
    // Defensive — the Finish button is only rendered for active rows, but
    // just in case it gets fired on something else, fall back to Edit.
    openEditDialog(productId);
    return;
  }
  pendingFinishId = productId;
  const dlg = document.getElementById('finish-dialog');
  const lead = document.getElementById('finish-lead');
  const dateInput = document.getElementById('finish-date');
  if (!dlg || !lead || !dateInput) return;
  lead.textContent = `When did you finish "${p.productName || 'this product'}"?`;
  dateInput.value = todayLocalISODate();
  dateInput.min = p.startDate || ''; // can't end before start
  dateInput.max = todayLocalISODate(); // can't end in the future
  if (!dlg.open) dlg.showModal();
  // Focus the date input so the user can immediately tap to change or just
  // confirm with Enter.
  requestAnimationFrame(() => { try { dateInput.focus(); } catch {} });
}

function closeFinishDialog() {
  pendingFinishId = null;
  const dlg = document.getElementById('finish-dialog');
  if (dlg && dlg.open) dlg.close();
}

async function confirmFinish() {
  const id = pendingFinishId;
  if (!id) return;
  const p = products.find(x => x.id === id);
  if (!p) { closeFinishDialog(); return; }
  const dateInput = document.getElementById('finish-date');
  const endDate = dateInput?.value || todayLocalISODate();
  if (p.startDate && endDate < p.startDate) {
    toast('End date can\'t be before the start date.');
    return;
  }
  const btn = document.getElementById('finish-confirm');
  if (btn) btn.disabled = true;
  try {
    const updated = { ...p, endDate };
    await saveProduct(updated);
    toast(`"${p.productName || 'Product'}" marked finished.`);
    logActivity('edit', updated, 'finished via quick-finish');
    closeFinishDialog();
  } catch {
    // toast already shown by saveProduct
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ---------- v0.11.0 read-only share link ---------- */

// Curated subset of product fields to include in the share payload. Skip
// PII (buyer, cardLast4) and internal-only fields (id, bundleId, createdAt,
// notes — could be private). Skip costWithTax — keep it simple.
const SHARE_FIELDS = [
  'productType', 'productName', 'size', 'unit',
  'startDate', 'endDate', 'cost', 'store',
  'upc', 'imageUrl',
  'bundleStatus', 'bundleSize', 'bundlePosition'
];

function encodeShareData(p) {
  const payload = {};
  for (const k of SHARE_FIELDS) {
    if (p[k] !== undefined && p[k] !== '' && p[k] !== null) payload[k] = p[k];
  }
  // UTF-8 safe base64. Use base64url variants (- _) instead of (+ /) so the
  // string is URL-safe without further escaping.
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function buildShareUrl(p) {
  const code = encodeShareData(p);
  // Use a relative path to share.html so the link works whether served from
  // GitHub Pages (https://itsavibecode.github.io/usage/) or a local file.
  // location.origin + pathname's directory + 'share.html#d=...'
  const base = location.origin + location.pathname.replace(/[^/]*$/, '');
  return `${base}share.html#d=${code}`;
}

function openShareDialog(productId) {
  const p = products.find(x => x.id === productId);
  if (!p) return;
  const url = buildShareUrl(p);
  const dlg = document.getElementById('share-dialog');
  const input = document.getElementById('share-url-input');
  const hint = document.getElementById('share-hint');
  if (!dlg || !input || !hint) return;
  input.value = url;
  hint.textContent = '';
  dlg._shareUrl = url;
  dlg._productId = productId; // v0.15.3 — for the PNG export button
  if (!dlg.open) dlg.showModal();
  // Select the URL so the user can quickly Cmd/Ctrl-C as a fallback.
  requestAnimationFrame(() => { try { input.select(); } catch {} });
}

function closeShareDialog() {
  const dlg = document.getElementById('share-dialog');
  if (dlg && dlg.open) dlg.close();
}

async function copyShareLink() {
  const dlg = document.getElementById('share-dialog');
  const hint = document.getElementById('share-hint');
  const url = dlg?._shareUrl;
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    hint.textContent = 'Link copied to clipboard.';
  } catch {
    // Clipboard API can fail on iOS in some contexts. The input is already
    // selected as a fallback; user can hit Cmd-C / long-press → Copy.
    hint.textContent = 'Couldn\'t auto-copy — the link is selected, copy manually.';
  }
}

function openShareInNewTab() {
  const dlg = document.getElementById('share-dialog');
  const url = dlg?._shareUrl;
  if (url) window.open(url, '_blank', 'noopener');
}

/* ---------- v0.16.0 Settings dialog (email reorder reminders) ---------- */

// Loads the current prefs from /users/{uid}/meta/emailPrefs and seeds the
// dialog inputs, then opens it. If no prefs doc exists yet, the toggle
// defaults to off and the email field defaults to the signed-in account
// email (visible in the placeholder hint, not pre-filled, so saving without
// touching the field cleanly omits the override).
async function openSettingsDialog() {
  if (!currentUser) { toast('Please sign in first'); return; }
  const dlg = document.getElementById('settings-dialog');
  const enabledInput = document.getElementById('settings-email-enabled');
  const emailInput = document.getElementById('settings-email-address');
  const hintEl = document.getElementById('settings-email-default-hint');
  const status = document.getElementById('settings-status');
  if (!dlg || !enabledInput || !emailInput) return;

  // Reset dialog state every open. Status line is also cleared.
  enabledInput.checked = false;
  emailInput.value = '';
  if (status) { status.textContent = ''; status.className = 'settings-status'; }

  const accountEmail = currentUser.email || '';
  if (hintEl) {
    hintEl.textContent = accountEmail
      ? `Leave blank to use ${accountEmail} (your Google account email).`
      : 'Leave blank to use the email on your Google account.';
  }

  // Seed from Firestore if present. Best-effort — failure just leaves
  // defaults so the user can still toggle/save.
  const prefs = await loadEmailPrefs();
  if (prefs) {
    enabledInput.checked = !!prefs.reorderEmailsEnabled;
    if (prefs.notifyEmail) emailInput.value = prefs.notifyEmail;
  }

  if (!dlg.open) dlg.showModal();
}

function closeSettingsDialog() {
  const dlg = document.getElementById('settings-dialog');
  if (dlg && dlg.open) dlg.close();
}

async function handleSettingsSave() {
  const enabledInput = document.getElementById('settings-email-enabled');
  const emailInput = document.getElementById('settings-email-address');
  const status = document.getElementById('settings-status');
  const saveBtn = document.getElementById('settings-save');
  if (!enabledInput || !emailInput) return;

  const enabled = enabledInput.checked;
  const email = (emailInput.value || '').trim();

  // Lightweight email validation. Empty is fine — the worker falls back to
  // the auth user's email via Identity Toolkit. If the user typed something,
  // it must look like an address.
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    if (status) { status.textContent = 'That email doesn\'t look right.'; status.className = 'settings-status is-error'; }
    return;
  }

  if (saveBtn) saveBtn.disabled = true;
  try {
    await saveEmailPrefs({ enabled, email });
    closeSettingsDialog();
    toast(enabled ? 'Email reminders on. We\'ll send when something\'s due.' : 'Email reminders off.');
  } catch (e) {
    if (status) { status.textContent = 'Save failed: ' + (e.message || e.code || 'unknown error'); status.className = 'settings-status is-error'; }
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

/* ---------- v0.8.0 price history per UPC ---------- */

let priceHistoryChart = null;

// Build the time-series for a given UPC. Returns sorted-ascending list of
// { product, date, cost, allocCost } points. Filters to entries with a
// usable purchase date and a positive cost. Uses effectiveCost so the
// pre-tax toggle (v0.7.6) carries through naturally.
function getPriceHistoryForUpc(upc) {
  if (!upc) return [];
  return products
    .filter(p => p.upc === upc)
    .map(p => {
      const d = parseLocalDate(p.purchaseDate || p.startDate);
      const eff = effectiveCost(p);
      const alloc = allocatedCost(p);
      return { product: p, date: d, cost: eff, allocCost: alloc };
    })
    .filter(x => x.date && isFinite(x.cost) && x.cost > 0)
    .sort((a, b) => a.date - b.date);
}

// How many same-UPC purchase entries exist? Used to decide whether to
// render the "Price history" button on a row.
function priceHistoryCount(upc) {
  if (!upc) return 0;
  // v0.15.0: favorites excluded — they're catalog refs, not purchase events.
  return products.reduce((n, p) => (!isFavorite(p) && p.upc === upc) ? n + 1 : n, 0);
}

function openPriceHistory(productId) {
  const p = products.find(x => x.id === productId);
  if (!p || !p.upc) return;
  const history = getPriceHistoryForUpc(p.upc);
  if (history.length < 2) {
    toast('Need at least 2 purchases of the same UPC to chart price history.');
    return;
  }

  const dlg = document.getElementById('price-history-dialog');
  document.getElementById('price-history-title').textContent =
    `${p.productName || 'Product'} — Price history`;

  const meta = document.getElementById('price-history-meta');
  const first = history[0];
  const last = history[history.length - 1];
  const change = last.cost - first.cost;
  const changePct = first.cost > 0 ? (change / first.cost) * 100 : 0;
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
  meta.innerHTML = `
    <div class="ph-meta-grid">
      <div><span class="ph-meta-label">UPC</span><code>${escapeHtml(p.upc)}</code></div>
      <div><span class="ph-meta-label">Purchases</span><strong>${history.length}</strong></div>
      <div><span class="ph-meta-label">First</span>${money(first.cost)} <span class="ph-meta-sub">on ${formatDate(first.date.toISOString().slice(0, 10))}</span></div>
      <div><span class="ph-meta-label">Latest</span>${money(last.cost)} <span class="ph-meta-sub">on ${formatDate(last.date.toISOString().slice(0, 10))}</span></div>
      <div class="ph-meta-change ph-change-${direction}">
        <span class="ph-meta-label">Change</span>
        <strong>${change > 0 ? '+' : ''}${money(change)}</strong>
        <span class="ph-meta-sub">(${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}%)</span>
      </div>
    </div>
    ${preTaxMode ? '<div class="ph-meta-note">Showing pre-tax prices.</div>' : '<div class="ph-meta-note">Showing prices with tax (where set).</div>'}
  `;

  // Table body: each entry with delta vs first purchase
  const tbody = document.getElementById('price-history-table').querySelector('tbody');
  tbody.innerHTML = history.map(h => {
    const diff = h.cost - first.cost;
    const cls = diff > 0 ? 'ph-row-up' : diff < 0 ? 'ph-row-down' : '';
    const sign = diff > 0 ? '+' : '';
    const diffText = h === first ? '—' : `${sign}${money(diff)}`;
    return `<tr class="${cls}">
      <td>${formatDate(h.date.toISOString().slice(0, 10))}</td>
      <td class="num">${money(h.cost)}</td>
      <td class="num ph-diff">${diffText}</td>
      <td>${escapeHtml(h.product.store) || '—'}</td>
      <td>${escapeHtml(h.product.buyer) || '—'}</td>
    </tr>`;
  }).join('');

  if (!dlg.open) dlg.showModal();
  // Render chart after dialog is visible so canvas has dimensions
  requestAnimationFrame(() => renderPriceHistoryChart(history));
}

function renderPriceHistoryChart(history) {
  if (priceHistoryChart) {
    try { priceHistoryChart.destroy(); } catch {}
    priceHistoryChart = null;
  }
  const canvas = document.getElementById('price-history-canvas');
  if (!canvas) return;
  const labels = history.map(h => formatDate(h.date.toISOString().slice(0, 10)));
  const values = history.map(h => round2(h.cost));
  priceHistoryChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: values,
        borderColor: '#2b5fd9',
        backgroundColor: 'rgba(43, 95, 217, 0.08)',
        borderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: '#2b5fd9',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        fill: true,
        tension: 0.15
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => money(ctx.parsed.y) } }
      },
      scales: {
        y: {
          beginAtZero: false,
          ticks: { callback: v => money(v) },
          grid: { color: '#eef1f7' }
        },
        x: { grid: { display: false } }
      }
    }
  });
}

function closePriceHistory() {
  const dlg = document.getElementById('price-history-dialog');
  if (dlg.open) dlg.close();
  if (priceHistoryChart) {
    try { priceHistoryChart.destroy(); } catch {}
    priceHistoryChart = null;
  }
}

/* ---------- v0.7.16 PNG export ---------- */

// html2canvas is ~80KB; lazy-load on first export click via the existing ESM
// CDN pattern the app uses for Chart.js. Cached after first load. Returns
// the html2canvas function (exposed as module default).
let html2canvasModule = null;
async function lazyLoadHtml2Canvas() {
  if (html2canvasModule) return html2canvasModule;
  try {
    const mod = await import('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm');
    html2canvasModule = mod.default || mod;
    return html2canvasModule;
  } catch (err) {
    toast('Could not load PNG export library: ' + err.message);
    throw err;
  }
}

// Renders a snippet of HTML at exact target dimensions into an off-screen
// container, captures it via html2canvas, downloads as PNG, then removes
// the container. Width/height are the canvas dimensions; the snippet's CSS
// inside should fit those dimensions exactly. We render at 2x device pixel
// ratio so the PNG is crisp on retina displays. Returns a Promise that
// resolves when the file has been triggered for download.
async function captureToPng(html, filename, width, height) {
  const html2canvas = await lazyLoadHtml2Canvas();
  const stage = document.createElement('div');
  stage.className = 'png-export-stage';
  // Off-screen positioning — visually hidden but laid out at full size so
  // the export captures real pixel content (display:none would skip layout).
  stage.style.cssText = `
    position: fixed; left: -10000px; top: 0;
    width: ${width}px; height: ${height}px;
    pointer-events: none;
    background: #ffffff;
  `;
  stage.innerHTML = html;
  document.body.appendChild(stage);
  try {
    // useCORS so the UPCitemdb thumbnails attempt cross-origin loading
    // properly. If CORS isn't supported by the host, the image fails silently
    // and the rest of the card still captures cleanly.
    const canvas = await html2canvas(stage, {
      width, height,
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false
    });
    await new Promise(resolve => {
      canvas.toBlob(blob => {
        if (!blob) { resolve(); return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
        resolve();
      }, 'image/png');
    });
  } finally {
    stage.remove();
  }
}

// Build the inner HTML for a 4:3 product card export. Mirrors the on-screen
// card's information density but with controlled padding, larger fonts, and
// a presentation-friendly layout.
function buildProductCardExportHtml(p) {
  const startLabel = p.startDate ? formatDate(p.startDate) : 'Inventory';
  let endLabel = p.endDate ? formatDate(p.endDate) : (isInventory(p) ? 'Inventory' : 'In use');
  const dur = calcDuration(p);
  const durationLine = (dur != null)
    ? (isActive(p) ? `${dur} days running` : isFinished(p) ? `${dur} days total` : '—')
    : '—';
  const eff = effectiveCost(p);
  const costLine = eff > 0 ? money(eff) : '—';
  const perDay = calcCostPerDay(p);
  const perDayLine = perDay != null ? `${moneyFine(perDay)}/day` : '—';
  const perUnit = calcCostPerUnit(p);
  const perUnitLine = perUnit != null ? `${moneyFine(perUnit)}/${escapeHtml(p.unit)}` : '—';
  const sizeLine = p.size && p.unit ? `${escapeHtml(p.size)} ${escapeHtml(p.unit)}` : '—';
  const status = isFinished(p) ? 'Finished' : isActive(p) ? 'Active' : 'Inventory';
  const statusColor = isFinished(p) ? '#5b3ba8' : isActive(p) ? '#2d8a5f' : '#8a5a00';
  const statusBg = isFinished(p) ? '#efe9fb' : isActive(p) ? '#e3f5ec' : '#fff3d6';

  const bundleLine = p.bundleStatus
    ? (p.bundlePosition ? `Bundle ${escapeHtml(p.bundlePosition)} of ${escapeHtml(p.bundleSize || '?')}` : `Bundle of ${escapeHtml(p.bundleSize || '?')}`)
    : '';

  return `
    <div class="exp-card">
      <div class="exp-card-head">
        ${p.imageUrl ? `<img class="exp-card-thumb" src="${escapeHtml(p.imageUrl)}" alt="" crossorigin="anonymous">` : '<div class="exp-card-thumb-fallback"></div>'}
        <div class="exp-card-head-text">
          <div class="exp-card-type">${escapeHtml(p.productType) || ''}</div>
          <div class="exp-card-name">${escapeHtml(p.productName) || '(unnamed)'}</div>
          ${bundleLine ? `<div class="exp-card-bundle">${bundleLine}</div>` : ''}
        </div>
        <div class="exp-card-status" style="background:${statusBg};color:${statusColor}">${status}</div>
      </div>
      <div class="exp-card-grid">
        <div class="exp-card-cell"><span class="exp-label">Started</span><span class="exp-val">${startLabel}</span></div>
        <div class="exp-card-cell"><span class="exp-label">${p.endDate ? 'Ended' : 'Status'}</span><span class="exp-val">${endLabel}</span></div>
        <div class="exp-card-cell"><span class="exp-label">Duration</span><span class="exp-val">${durationLine}</span></div>
        <div class="exp-card-cell"><span class="exp-label">Size</span><span class="exp-val">${sizeLine}</span></div>
        <div class="exp-card-cell"><span class="exp-label">Cost</span><span class="exp-val">${costLine}</span></div>
        <div class="exp-card-cell"><span class="exp-label">Per day</span><span class="exp-val">${perDayLine}</span></div>
        <div class="exp-card-cell"><span class="exp-label">Per unit</span><span class="exp-val">${perUnitLine}</span></div>
        <div class="exp-card-cell"><span class="exp-label">Store</span><span class="exp-val">${escapeHtml(p.store) || '—'}</span></div>
      </div>
      <div class="exp-card-foot">
        <span>Tracked with Usage Tracker</span>
        <span class="exp-card-foot-version">v${APP_VERSION}</span>
      </div>
    </div>
  `;
}

async function exportProductPng(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const safeName = (p.productName || 'product').replace(/[^a-z0-9-]+/gi, '-').slice(0, 40);
  toast('Generating PNG…');
  try {
    await captureToPng(buildProductCardExportHtml(p), `${safeName}-${dateStamp()}.png`, 1200, 900);
    toast('PNG saved');
  } catch (err) {
    toast('Export failed: ' + err.message);
  }
}

// Builds the dashboard export — stats bar + the existing chart canvases as
// images. Uses canvas.toDataURL() to snapshot each Chart.js canvas (since
// html2canvas can't fully reach into Chart.js internals).
function buildDashboardExportHtml({ portrait } = { portrait: false }) {
  const sb = renderStatsForExport();
  const charts = renderChartsForExport();
  const layoutClass = portrait ? 'exp-dash exp-dash-portrait' : 'exp-dash exp-dash-landscape';
  return `
    <div class="${layoutClass}">
      <div class="exp-dash-head">
        <div class="exp-dash-title">Usage Tracker</div>
        <div class="exp-dash-sub">${escapeHtml(currentUser?.displayName || '')} · ${dateStamp()}</div>
      </div>
      <div class="exp-dash-stats">${sb}</div>
      <div class="exp-dash-charts">${charts}</div>
      <div class="exp-dash-foot">
        <span>v${APP_VERSION}</span>
      </div>
    </div>
  `;
}

// Stats tiles for the export — pulls fresh values via the same calculations
// renderStats uses, but as plain divs instead of writing to existing DOM.
function renderStatsForExport() {
  const tracked = trackedOnly();
  const count = tracked.length;
  const active = tracked.filter(isActive).length;
  const inventory = tracked.filter(isInventory).length;
  const finished = tracked.filter(isFinished).length;
  const total = tracked.filter(p => !isInventory(p)).reduce((s, p) => s + (allocatedCost(p) || 0), 0);
  const now = new Date();
  const yr = now.getFullYear();
  const ytdSpend = tracked.reduce((s, p) => {
    if (isInventory(p)) return s;
    const d = parseLocalDate(p.purchaseDate || p.startDate);
    if (!d || d.getFullYear() !== yr) return s;
    return s + (allocatedCost(p) || 0);
  }, 0);
  const tile = (label, value) =>
    `<div class="exp-stat"><div class="exp-stat-label">${label}</div><div class="exp-stat-val">${value}</div></div>`;
  return [
    tile('Tracked', count),
    tile('Active', active),
    tile('Inventory', inventory),
    tile('Finished', finished),
    tile('Total spend', money(total)),
    tile('YTD spend', money(ytdSpend))
  ].join('');
}

// Snapshot each existing Chart.js canvas as a PNG data URL and embed.
// Charts must be rendered (dashboard view active) before this runs;
// the export functions call setView('dashboard') first if needed.
function renderChartsForExport() {
  const ids = ['chart-by-type', 'chart-by-store', 'chart-finished-per-month',
               'chart-perday-by-type', 'chart-count-by-type', 'chart-longest-running'];
  const titles = {
    'chart-by-type': 'Spend by product type',
    'chart-by-store': 'Spend by store',
    'chart-finished-per-month': 'Products finished per month',
    'chart-perday-by-type': '$/day by product type',
    'chart-count-by-type': 'Purchases by product type',
    'chart-longest-running': 'Longest-running products'
  };
  const blocks = [];
  for (const id of ids) {
    const c = document.getElementById(id);
    if (!c || !(c instanceof HTMLCanvasElement)) continue;
    let dataUrl = '';
    try { dataUrl = c.toDataURL('image/png'); } catch { continue; }
    if (!dataUrl) continue;
    blocks.push(`<div class="exp-chart-block">
      <div class="exp-chart-title">${titles[id] || id}</div>
      <img class="exp-chart-img" src="${dataUrl}" alt="">
    </div>`);
  }
  return blocks.join('');
}

async function exportDashboardPng() {
  if (currentView !== 'dashboard') {
    toast('Switch to Dashboard view first');
    return;
  }
  toast('Generating PNG…');
  try {
    await captureToPng(buildDashboardExportHtml({ portrait: false }),
      `dashboard-${dateStamp()}.png`, 1600, 1200);
    toast('Dashboard PNG saved');
  } catch (err) {
    toast('Export failed: ' + err.message);
  }
}

async function exportOverviewPng() {
  if (currentView !== 'dashboard') {
    toast('Switch to Dashboard view first');
    return;
  }
  toast('Generating PNG…');
  try {
    await captureToPng(buildDashboardExportHtml({ portrait: true }),
      `overview-${dateStamp()}.png`, 1000, 1400);
    toast('Overview PNG saved');
  } catch (err) {
    toast('Export failed: ' + err.message);
  }
}

/* ---------- import / export ---------- */

function exportJSON() {
  const payload = {
    app: 'usage-tracker', version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    customTypes: customTypesCache,
    products
  };
  download(JSON.stringify(payload, null, 2), `usage-export-${dateStamp()}.json`, 'application/json');
  toast(`Exported ${products.length} product${products.length === 1 ? '' : 's'}`);
}

function exportCSV() {
  const cols = [
    'id', 'productType', 'productName', 'size', 'unit',
    'startDate', 'endDate', 'durationDays',
    'cost', 'costWithTax', 'allocatedCost', 'costPerUnit', 'costPerDay',
    'bundleStatus', 'bundleSize', 'bundlePosition',
    'store', 'buyer', 'cardLast4',
    'purchaseDate', 'upc', 'notes'
  ];
  const rows = products.map(p => cols.map(c => {
    let v;
    if (c === 'durationDays') v = calcDuration(p) ?? '';
    else if (c === 'allocatedCost') v = allocatedCost(p) ?? '';
    else if (c === 'costPerUnit') v = calcCostPerUnit(p) ?? '';
    else if (c === 'costPerDay') v = calcCostPerDay(p) ?? '';
    else v = p[c] ?? '';
    return csvCell(v);
  }).join(','));
  download([cols.join(','), ...rows].join('\n'), `usage-export-${dateStamp()}.csv`, 'text/csv');
  toast(`Exported ${products.length} product${products.length === 1 ? '' : 's'}`);
}

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return '"' + s.replaceAll('"', '""') + '"';
  return s;
}

function dateStamp() { return new Date().toISOString().slice(0, 10); }

// v0.15.1: today's date in the LOCAL timezone, formatted YYYY-MM-DD. Critical
// for any user-facing date input — `new Date().toISOString().slice(0,10)`
// returns the UTC date, which can be tomorrow when the user is in a negative
// timezone late in the evening. (Reported bug: 4/29 at 10:55pm Eastern showed
// tomorrow's date as "today" for purchaseDate.)
function todayLocalISODate() {
  const d = new Date();
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${dy}`;
}

function download(text, filename, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// Columns the user is expected to fill in via CSV/JSON template — mirrors
// FIELDS minus `id` (auto-generated). Calculated columns from the CSV export
// (durationDays, allocatedCost, costPerUnit, costPerDay) are intentionally
// excluded since they're derived, not stored.
const IMPORT_COLS = [
  'productType', 'productName', 'size', 'unit',
  'startDate', 'endDate', 'cost', 'costWithTax',
  'bundleStatus', 'bundleSize', 'bundlePosition',
  'store', 'buyer', 'cardLast4',
  'purchaseDate', 'upc', 'notes'
];

function downloadJSONTemplate() {
  // Self-documenting import template. Mirrors the JSON export shape so a user
  // can export, edit in a text editor, and re-import. Placeholder values show
  // the expected format for each field.
  const today = new Date().toISOString().slice(0, 10);
  const template = {
    app: 'usage-tracker',
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    _help: {
      instructions: 'Edit the "products" array. Each object may omit "id" (a new one will be generated). All fields are optional except productType, productName, and upc. Dates use YYYY-MM-DD. Leave startDate blank to record an inventory item (purchased but not yet in use). Leave endDate blank for in-use products.',
      productType: 'Underarm | Toothbrush | Toothpaste | Floss | Mouthwash | Facewash | Shampoo | Soap | any custom type you have added',
      unit: 'count | oz | fl oz | lb | g | kg | mL | L | gal | ft | m | pack | roll | sheet | load | serving',
      bundleStatus: 'true if purchased as part of a multi-pack; requires bundleSize and bundlePosition',
      bundleSize: 'total count in the bundle (e.g. 3 for a 3-pack)',
      bundlePosition: 'which item of the bundle this row is (1..bundleSize)'
    },
    customTypes: [],
    products: [
      {
        productType: 'Toothpaste',
        productName: 'Example Toothpaste',
        size: 4.7,
        unit: 'oz',
        startDate: today,
        endDate: '',
        cost: 3.99,
        costWithTax: 4.29,
        bundleStatus: false,
        bundleSize: '',
        bundlePosition: '',
        store: 'Example Store',
        buyer: 'Me',
        cardLast4: '',
        purchaseDate: today,
        notes: 'Delete this example row before importing.',
        upc: '000000000000'
      }
    ]
  };
  download(JSON.stringify(template, null, 2), `usage-import-template.json`, 'application/json');
  toast('JSON template downloaded — edit and re-import');
}

function downloadCSVTemplate() {
  // CSV template opens cleanly in Excel/Numbers/Sheets. Two example rows show
  // an active product and an inventory product (blank startDate). Delete both
  // example rows and add your own before importing.
  const today = new Date().toISOString().slice(0, 10);
  const examples = [
    {
      productType: 'Toothpaste', productName: 'Example Active Toothpaste',
      size: 4.7, unit: 'oz',
      startDate: today, endDate: '',
      cost: 3.99, costWithTax: 4.29,
      bundleStatus: 'N', bundleSize: '', bundlePosition: '',
      store: 'Example Store', buyer: 'Me', cardLast4: '',
      purchaseDate: today, upc: '000000000000',
      notes: 'Delete this example row before importing.'
    },
    {
      productType: 'Underarm', productName: 'Example Inventory Item',
      size: 2.7, unit: 'oz',
      startDate: '', endDate: '',
      cost: 5.99, costWithTax: 6.44,
      bundleStatus: 'Y', bundleSize: 3, bundlePosition: 2,
      store: 'Example Store', buyer: 'Me', cardLast4: '1234',
      purchaseDate: today, upc: '000000000001',
      notes: 'Blank startDate = inventory (purchased, not in use yet).'
    }
  ];
  const rows = examples.map(ex => IMPORT_COLS.map(c => csvCell(ex[c] ?? '')).join(','));
  const csv = [IMPORT_COLS.join(','), ...rows].join('\n');
  download(csv, `usage-import-template.csv`, 'text/csv');
  toast('CSV template downloaded — open in Excel, edit, save, then re-import');
}

// Minimal RFC-4180 CSV parser. Handles quoted fields with embedded quotes
// (escaped by doubling: `""`), commas, and newlines. Returns an array of rows,
// each row an array of strings. Strips a leading UTF-8 BOM if present (Excel
// loves to add one when saving as CSV).
function parseCSV(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\r') { /* swallow; \n handles row break */ }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += ch;
    }
  }
  // Flush trailing field/row if file doesn't end with newline
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  // Drop trailing all-empty rows (common when a file ends with \n)
  while (rows.length && rows[rows.length - 1].every(c => c === '')) rows.pop();
  return rows;
}

// Coerce a CSV cell string to a JS value for a given field. The CSV parser
// only produces strings; the rest of the app expects numbers for size/cost
// and booleans for bundleStatus. Empty strings stay empty (blank = unset).
function coerceImportValue(key, raw) {
  const s = String(raw ?? '').trim();
  if (s === '') return key === 'bundleStatus' ? false : '';
  if (key === 'bundleStatus') {
    return /^(true|1|yes|y)$/i.test(s);
  }
  if (key === 'size' || key === 'cost' || key === 'costWithTax' ||
      key === 'bundleSize' || key === 'bundlePosition') {
    const n = Number(s);
    return isFinite(n) ? n : s;
  }
  return s;
}

// Turn a parsed CSV (rows-of-strings) into product objects. First row must be
// the header. Unknown columns are silently ignored so users can add their own
// notes columns without breaking the import.
function csvRowsToProducts(rows) {
  if (rows.length < 2) throw new Error('CSV has no data rows');
  const header = rows[0].map(h => h.trim());
  return rows.slice(1).map(cells => {
    const obj = {};
    header.forEach((col, i) => { obj[col] = cells[i] ?? ''; });
    return obj;
  });
}

async function handleImportFile(file) {
  if (!currentUser) { toast('Please sign in first'); return; }
  const isCSV = /\.csv$/i.test(file.name) || file.type === 'text/csv';
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      let incoming;
      let extraTypes = null;
      if (isCSV) {
        const rows = parseCSV(reader.result);
        incoming = csvRowsToProducts(rows);
      } else {
        const data = JSON.parse(reader.result);
        incoming = Array.isArray(data) ? data : data.products;
        if (!Array.isArray(incoming)) throw new Error('Invalid file: no products array found');
        if (Array.isArray(data.customTypes) && data.customTypes.length) extraTypes = data.customTypes;
      }

      const cleaned = incoming.map(item => {
        const out = { id: item.id || newId() };
        for (const key of FIELDS) {
          if (key === 'id') continue;
          // Only the JSON path produces native types; for CSV, every cell is a
          // string and needs coercing. coerceImportValue is a no-op on already-
          // typed values from JSON since they go straight through `?? ''`.
          const raw = item[key];
          if (raw === undefined || raw === null) {
            out[key] = key === 'bundleStatus' ? false : '';
          } else if (isCSV) {
            out[key] = coerceImportValue(key, raw);
          } else {
            out[key] = raw;
          }
        }
        return out;
      });

      let added = 0;
      for (const item of cleaned) {
        await setDoc(productDoc(item.id), item);
        added++;
      }

      if (extraTypes) {
        const merged = [...new Set([...customTypesCache, ...extraTypes])];
        await saveCustomTypes(merged);
      }

      toast(`Imported ${added} product${added === 1 ? '' : 's'}`);
    } catch (err) {
      toast('Import failed: ' + err.message);
    }
  };
  reader.onerror = () => toast('Could not read file');
  reader.readAsText(file);
}

/* ---------- legacy localStorage migration ---------- */

async function offerLegacyMigration(uid) {
  const legacyRaw = localStorage.getItem(LEGACY_PRODUCTS_KEY);
  if (!legacyRaw) return;
  let legacy;
  try { legacy = JSON.parse(legacyRaw); } catch { return; }
  if (!Array.isArray(legacy) || legacy.length === 0) return;

  // Only offer if this account's Firestore is empty
  const snap = await getDocs(productsColl(uid));
  if (!snap.empty) return;

  const n = legacy.length;
  if (!confirm(`Found ${n} product${n === 1 ? '' : 's'} saved locally from testing.\n\nUpload to your account so they sync across devices?`)) {
    return;
  }

  try {
    for (const p of legacy) {
      const id = p.id || newId();
      await setDoc(productDoc(id, uid), { ...p, id });
    }
    const legacyTypes = JSON.parse(localStorage.getItem(LEGACY_TYPES_KEY) || '[]');
    if (Array.isArray(legacyTypes) && legacyTypes.length) {
      await setDoc(typesDoc(uid), { types: legacyTypes });
    }
    // Archive, don't delete
    localStorage.setItem(LEGACY_PRODUCTS_KEY + '.migrated', legacyRaw);
    localStorage.removeItem(LEGACY_PRODUCTS_KEY);
    if (legacyTypes.length) {
      localStorage.setItem(LEGACY_TYPES_KEY + '.migrated', localStorage.getItem(LEGACY_TYPES_KEY));
      localStorage.removeItem(LEGACY_TYPES_KEY);
    }
    toast(`Migrated ${n} product${n === 1 ? '' : 's'} to your account`);
  } catch (e) {
    toast('Migration failed: ' + e.message);
  }
}

/* ---------- UPC camera scanner (ZXing, lazy-loaded) ---------- */

async function loadZXing() {
  if (!zxingModule) {
    zxingModule = await import("https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm");
  }
  return zxingModule;
}

function setScannerHint(text, isError = false) {
  const hint = document.getElementById('scanner-hint');
  hint.textContent = text;
  hint.classList.toggle('is-error', !!isError);
}

async function openScanner() {
  const dlg = document.getElementById('scanner-dialog');
  const video = document.getElementById('scanner-video');

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    toast('This browser does not support camera access.');
    return;
  }

  setScannerHint('Starting camera…');
  if (!dlg.open) dlg.showModal();

  try {
    const { BrowserMultiFormatReader } = await loadZXing();
    const reader = new BrowserMultiFormatReader();
    // decodeFromConstraints opens the camera with the given getUserMedia constraints
    // and calls the callback on each decode attempt. We stop on first valid result.
    scannerControls = await reader.decodeFromConstraints(
      { video: { facingMode: { ideal: 'environment' } } },
      video,
      (result, _err, controls) => {
        if (result) {
          try { controls.stop(); } catch {}
          scannerControls = null;
          handleScanResult(result.getText());
        }
      }
    );
    setScannerHint('Point your camera at the barcode.');
  } catch (e) {
    console.error('Scanner failed to start:', e);
    setScannerHint(describeCameraError(e), true);
  }
}

function handleScanResult(text) {
  closeScanner();
  const upcInput = form().elements.upc;
  if (upcInput) {
    upcInput.value = text;
    upcInput.dispatchEvent(new Event('input', { bubbles: true }));
    // The 'input' event listener already calls syncAmazonCheckLink(),
    // but explicit here too for clarity in case the listener was bypassed.
    syncAmazonCheckLink(text);
  }
  toast('Scanned UPC: ' + text);
  // Fire-and-forget — lookup will drive the confirm dialog when it resolves
  lookupAndOfferUpc(text, { fromScan: true });
}

function closeScanner() {
  if (scannerControls) {
    try { scannerControls.stop(); } catch {}
    scannerControls = null;
  }
  const video = document.getElementById('scanner-video');
  if (video && video.srcObject) {
    try { video.srcObject.getTracks().forEach(t => t.stop()); } catch {}
    video.srcObject = null;
  }
  const dlg = document.getElementById('scanner-dialog');
  if (dlg.open) dlg.close();
}

function describeCameraError(e) {
  const name = (e && e.name) || '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Camera permission denied. Enable camera access for this site in your browser settings and try again.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No camera found on this device.';
  }
  if (name === 'NotReadableError') {
    return 'Camera is in use by another app. Close it and try again.';
  }
  return 'Could not start camera: ' + ((e && e.message) || e);
}

/* ---------- UPC database lookup (UPCitemdb trial via Apps Script proxy) ----------
 * UPCitemdb's free `/prod/trial/lookup` endpoint serves
 *   `Access-Control-Allow-Origin: https://www.upcitemdb.com`
 * which means browsers refuse every fetch made from any other origin (including
 * itsavibecode.github.io). v0.7.20 routes the call through a Google Apps Script
 * Web App the user deployed; Apps Script makes the request server-to-server (no
 * CORS), wraps the JSON, and returns it with a permissive `Access-Control-Allow-
 * Origin: *` so the browser is happy.
 *
 * Response shape from proxy is the same as direct UPCitemdb:
 *   { code: "OK", total: N, items: [{ ean, upc, title, brand, category, size, ... }] }
 *   { code: "EXCEED_LIMIT", message: "Rate limit exceeded" }
 *   { code: "INVALID_QUERY" }   // not enough digits etc.
 *
 * Important: UPCitemdb rate-limits the trial endpoint per IP. Apps Script
 * shares its IPs across thousands of users, so the 100/day quota for whichever
 * Google IP we land on is often already burned by other users. Lookups fail
 * with EXCEED_LIMIT in those windows — we surface that clearly. The
 * upcCache below also caches OK results so repeats within a session are free.
 */

const UPCITEMDB_URL = 'https://script.google.com/macros/s/AKfycbxYQmtqVQIrXZa1w14pgCkfu54xJDQxH2PxlLVfJzVPAisVCU8hhxp0903701AmdaAp/exec';

// v0.7.21: OpenFoodFacts fallback. Free, open data, browser-friendly CORS
// (Access-Control-Allow-Origin: *). Coverage skews food/beverage but they
// have grown to include personal-care products (toothpaste, soap, shampoo,
// deodorant) over the years. Reasonable last-resort when UPCitemdb misses
// or returns EXCEED_LIMIT. The `fields` query trims their response from
// ~140KB to a few hundred bytes — they're generous about server load but
// no point in shipping all the metadata over the wire.
const OPENFOODFACTS_URL = 'https://world.openfoodfacts.org/api/v2/product';
const OPENFOODFACTS_FIELDS = 'code,product_name,product_name_en,brands,quantity,image_url,categories,categories_tags';
const upcCache = new Map(); // upc -> item (or null if no match)
let pendingUpcLookup = null;
let pendingUpcCode = null; // the UPC whose confirm dialog is currently open

function setUpcStatus(text, kind = '') {
  const el = document.getElementById('upc-status');
  if (!el) return;
  el.textContent = text || '';
  el.classList.remove('is-busy', 'is-error', 'is-ok');
  if (kind) el.classList.add(`is-${kind}`);
}

// v0.9.0 — Amazon search link below the UPC field. Hidden until the UPC
// reaches 8+ digits, then becomes a link to amazon.com search.
//
// v0.10.1 — Amazon's UPC indexing is sparse: searching by raw UPC alone
// often returns "no results" even for products that DO sell on Amazon,
// because the UPC isn't part of every listing's searchable text. The
// product *name* is far more reliable — Amazon's relevance search is
// built for natural language. We now prefer productName when the form
// has one, and fall back to UPC only if the name field is empty.
function syncAmazonCheckLink(rawUpc) {
  const a = document.getElementById('upc-check-amazon');
  if (!a) return;
  const code = normalizeUpc(rawUpc);
  if (code.length < 8) {
    a.hidden = true;
    a.href = '#';
    return;
  }
  // Prefer productName if available — much higher hit rate on Amazon than
  // raw UPC. The form may already have a name from UPC lookup auto-fill,
  // from continue-bundle, from edit-existing, or from manual entry.
  let query = code;
  try {
    const f = form();
    const name = (f.elements.productName?.value || '').trim();
    if (name) query = name;
  } catch {}
  a.hidden = false;
  a.href = `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
}

function normalizeUpc(code) {
  return String(code || '').replace(/\D/g, '');
}

/* v0.7.21: three-tier UPC lookup pipeline with persistent caching.
 *
 *   1. L1 in-memory `upcCache` Map — same-session repeat lookups are free.
 *   2. L2 Firestore `/users/{uid}/upcCache/{upc}` — cross-session, cross-device
 *      cache. Once we've ever resolved a UPC, we never hit a live API for it
 *      again unless the user signs out / clears their data.
 *   3. L3 live API chain — UPCitemdb (via Apps Script proxy) first, with
 *      OpenFoodFacts as a fallback when UPCitemdb misses or rate-limits.
 *      First successful lookup wins; result is written to both caches.
 *
 * The cached doc shape carries enough metadata to debug / re-source later:
 *   { upc, source: 'upcitemdb' | 'openfoodfacts' | 'miss', cachedAt, item }
 * `source: 'miss'` is also cached so we don't re-pound APIs for known dead UPCs.
 */

function upcCacheDoc(code, uid = currentUser?.uid) {
  return doc(db, 'users', uid, 'upcCache', code);
}

async function readPersistedUpc(code) {
  if (!currentUser) return null;
  try {
    const snap = await getDoc(upcCacheDoc(code));
    if (!snap.exists()) return null;
    return snap.data() || null;
  } catch (e) {
    console.warn('UPC cache read failed:', e);
    return null;
  }
}

async function writePersistedUpc(code, source, item) {
  if (!currentUser) return;
  try {
    await setDoc(upcCacheDoc(code), {
      upc: code,
      source,
      cachedAt: new Date().toISOString(),
      item: item || null
    });
  } catch (e) {
    // Non-fatal — fall back to in-memory cache for the rest of this session.
    console.warn('UPC cache write failed:', e);
  }
}

// Live UPCitemdb call via the Apps Script proxy. Returns:
//   { item: <usable item> }   on success
//   { error: 'EXCEED_LIMIT' | 'INVALID_QUERY' | 'NETWORK' | 'PARSE' | 'HTTP' }  on failure
//   { item: null }            on success-but-no-match
async function callUpcItemDb(code) {
  try {
    // v0.15.3: cache: 'no-store' bypasses any browser HTTP cache. The
    // Apps Script proxy returns no-cache headers, but defensive belt-and-
    // braces. Also helps when retrying after a transient failure.
    const res = await fetch(`${UPCITEMDB_URL}?upc=${encodeURIComponent(code)}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    });
    if (!res.ok) {
      console.warn('[UPC lookup] HTTP', res.status, 'for', code);
      return { error: 'HTTP', status: res.status };
    }
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); }
    catch (parseErr) {
      console.warn('[UPC lookup] PARSE failed for', code, '— body starts:', text.slice(0, 200));
      return { error: 'PARSE' };
    }
    if (data && data.code && data.code !== 'OK') {
      console.warn('[UPC lookup] non-OK code:', data.code, data.message || '', 'for', code);
      return { error: data.code, message: data.message };
    }
    const item = (data.items && data.items[0]) || null;
    if (!item) {
      console.info('[UPC lookup] OK but no items for', code, '— response:', data);
    }
    return { item };
  } catch (e) {
    console.error('[UPC lookup] NETWORK error for', code, e);
    return { error: 'NETWORK' };
  }
}

// OpenFoodFacts fallback. Different response shape — we map it to the
// UPCitemdb-style item the rest of the app expects.
async function callOpenFoodFacts(code) {
  try {
    const url = `${OPENFOODFACTS_URL}/${encodeURIComponent(code)}.json?fields=${OPENFOODFACTS_FIELDS}`;
    const res = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
    if (!res.ok) return { error: 'HTTP', status: res.status };
    const data = await res.json();
    // OFF returns status:1 if the product is found, status:0 if not
    if (!data || data.status === 0 || !data.product) return { item: null };
    const p = data.product;
    const title = (p.product_name_en || p.product_name || '').trim();
    if (!title) return { item: null };
    // Categories from OFF are comma-separated; take the most specific (last) one.
    const categoryParts = (p.categories || '').split(',').map(s => s.trim()).filter(Boolean);
    const category = categoryParts.length ? categoryParts[categoryParts.length - 1] : '';
    const item = {
      title,
      brand: (p.brands || '').split(',')[0].trim() || '',
      category,
      size: (p.quantity || '').trim(),
      images: p.image_url && /^https:/i.test(p.image_url) ? [p.image_url] : []
    };
    return { item };
  } catch (e) {
    console.error('OpenFoodFacts call failed:', e);
    return { error: 'NETWORK' };
  }
}

async function lookupUpc(rawCode, { forceFresh = false } = {}) {
  const code = normalizeUpc(rawCode);
  if (code.length < 8) return null;

  // L1: in-memory (skipped on forceFresh so explicit Look up always retries)
  if (!forceFresh && upcCache.has(code)) return upcCache.get(code);

  // L2: Firestore persistent cache (also skipped on forceFresh — that's the
  // whole point of the Look up button: bypass cached misses from prior
  // failed attempts and try a fresh API call).
  setUpcStatus('Looking up product…', 'busy');
  if (!forceFresh) {
    const cached = await readPersistedUpc(code);
    if (cached) {
      const item = cached.item || null;
      upcCache.set(code, item);
      if (cached.source === 'miss') {
        setUpcStatus('No match (cached) — tap Look up to retry.', '');
      }
      return item;
    }
  }

  // L3a: live UPCitemdb via proxy
  const primary = await callUpcItemDb(code);
  if (primary.item) {
    upcCache.set(code, primary.item);
    writePersistedUpc(code, 'upcitemdb', primary.item); // fire-and-forget
    return primary.item;
  }

  // L3b: fallback to OpenFoodFacts when UPCitemdb has no result OR
  // hits a recoverable error (rate limit, network blip). Hard parse/HTTP
  // errors aren't worth a fallback — usually means our proxy is broken.
  const shouldFallback = !primary.error || primary.error === 'EXCEED_LIMIT' || primary.error === 'NETWORK';
  if (shouldFallback) {
    const off = await callOpenFoodFacts(code);
    if (off.item) {
      upcCache.set(code, off.item);
      writePersistedUpc(code, 'openfoodfacts', off.item); // fire-and-forget
      return off.item;
    }
  }

  // Both sources exhausted — surface the most informative error.
  if (primary.error === 'EXCEED_LIMIT') {
    setUpcStatus('UPC database busy and fallback found nothing — try again later or enter manually.', 'error');
  } else if (primary.error === 'INVALID_QUERY') {
    setUpcStatus('UPC format not accepted by database — check the digits.', 'error');
  } else if (primary.error === 'PARSE') {
    setUpcStatus('Lookup proxy returned an unexpected response. Enter manually.', 'error');
  } else if (primary.error === 'HTTP' || primary.error === 'NETWORK') {
    setUpcStatus('Lookup failed — check connection or try again.', 'error');
  } else {
    // No error from primary, just no match → cache the miss so we don't
    // re-call the API for this UPC ever again. Reduces wasted quota over time.
    upcCache.set(code, null);
    writePersistedUpc(code, 'miss', null); // fire-and-forget
  }
  return null;
}

/* Kicks off a lookup for whatever is currently in the UPC input.
 * Called on scan result and on UPC input blur (when the value has changed). */
async function lookupAndOfferUpc(rawCode, { fromScan = false, forceFresh = false } = {}) {
  const code = normalizeUpc(rawCode);
  if (!code) { setUpcStatus(''); return; }
  if (code.length < 8) { setUpcStatus('UPC too short to look up.', 'error'); return; }

  pendingUpcLookup = code;
  const item = await lookupUpc(code, { forceFresh });

  // Abort if the user changed the UPC while the request was in flight
  if (pendingUpcLookup !== code) return;
  pendingUpcLookup = null;

  if (!item) {
    // v0.15.3: don't overwrite a more-specific error message that lookupUpc
    // may have already set (e.g. "Lookup failed — check connection",
    // "UPC database busy", "Lookup proxy returned an unexpected response").
    // Only show the generic "No match" message when the status pill is
    // currently neutral (no is-error class).
    const statusEl = document.getElementById('upc-status');
    const hasErrorAlready = statusEl?.classList.contains('is-error');
    if (!hasErrorAlready) {
      if (fromScan) setUpcStatus('No match in UPC database — enter details manually.', '');
      else setUpcStatus('No match — enter details manually.', '');
    }
    return;
  }

  setUpcStatus(`Match: ${item.brand ? item.brand + ' — ' : ''}${item.title || 'unknown'}`, 'ok');
  openUpcMatchDialog(code, item);
}

function openUpcMatchDialog(code, item) {
  pendingUpcCode = code;
  const dlg = document.getElementById('upc-match-dialog');
  document.getElementById('upc-match-code').textContent = code;
  const grid = document.getElementById('upc-match-grid');
  grid.innerHTML = '';

  const rows = [];
  if (item.brand) rows.push(['Brand', item.brand]);
  if (item.title) rows.push(['Title', item.title]);
  if (item.category) rows.push(['Category', item.category]);
  if (item.size) rows.push(['Size', item.size]);
  if (!rows.length) rows.push(['Match', 'Found in database, but no usable fields returned.']);

  for (const [k, v] of rows) {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v;
    grid.append(dt, dd);
  }

  // Stash the item on the dialog so the accept handler can read it
  dlg._upcItem = item;
  if (!dlg.open) dlg.showModal();
}

function closeUpcMatchDialog() {
  const dlg = document.getElementById('upc-match-dialog');
  if (dlg.open) dlg.close();
  pendingUpcCode = null;
}

function acceptUpcMatch() {
  const dlg = document.getElementById('upc-match-dialog');
  const item = dlg._upcItem;
  if (item) applyUpcItemToForm(item);
  closeUpcMatchDialog();
}

/* Fill product form from a UPCitemdb item. Only fills empty fields — never
 * overwrites values the user already entered. */
function applyUpcItemToForm(item) {
  const f = form();
  const setIfEmpty = (name, value) => {
    const el = f.elements[name];
    if (!el || value == null || value === '') return;
    if (!el.value) {
      el.value = value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  // Product name: prefer title; drop size suffix if present so it's not duplicated
  const title = (item.title || '').trim();
  if (title) setIfEmpty('productName', title);

  // v0.15.2: capture the brand for the company-logo icon
  const brand = (item.brand || '').trim();
  if (brand) setIfEmpty('brand', brand);

  // Product type from category
  const guessedType = guessProductTypeFromCategory(item.category || '');
  if (guessedType) setIfEmpty('productType', guessedType);

  // Size + unit. UPCitemdb's `size` field is unreliable — for many entries
  // it's empty (the user's Old Spice example has size:"" with the actual
  // "6 oz" embedded in the title). Try item.size first, then fall back to
  // parsing from the title. v0.15.4.
  let parsed = parseSizeString(item.size || '');
  if (!parsed && item.title) parsed = findSizeInString(item.title);
  if (parsed) {
    setIfEmpty('size', parsed.size);
    setIfEmpty('unit', parsed.unit);
  }

  // v0.7.15: capture the first HTTPS product image. Reject http:// because
  // GitHub Pages serves us over HTTPS — mixed-content blocks would silently
  // hide the thumbnail. Some UPCitemdb entries return zero images; that's
  // fine, the cell just falls back to no thumbnail.
  if (Array.isArray(item.images)) {
    const httpsImage = item.images.find(u => /^https:\/\//i.test(u || ''));
    if (httpsImage) setIfEmpty('imageUrl', httpsImage);
  }

  syncDialogImagePreview(); // v0.15.1 — show the image we just captured
  toast('Prefilled from UPC database');
}

function guessProductTypeFromCategory(category) {
  const c = (category || '').toLowerCase();
  if (!c) return null;
  const rules = [
    [['toothpaste'], 'Toothpaste'],
    [['toothbrush'], 'Toothbrush'],
    [['floss', 'dental floss'], 'Floss'],
    [['mouthwash'], 'Mouthwash'],
    [['face wash', 'facewash', 'facial cleanser'], 'Facewash'],
    [['shampoo'], 'Shampoo'],
    [['body wash', 'bar soap', 'hand soap', 'soap'], 'Soap'],
    [['deodorant', 'antiperspirant', 'underarm'], 'Underarm'],
  ];
  for (const [needles, type] of rules) {
    if (needles.some(n => c.includes(n))) {
      // Only return types that are currently in the user's list — if they've
      // removed the default types, we don't want to resurrect them.
      if (allProductTypes().includes(type)) return type;
    }
  }
  return null;
}

/* Parse "4.8 oz" / "12 fl oz" / "300 mL" into { size, unit } matching one of our supported units. */
function parseSizeString(raw) {
  const UNIT_SET = new Set([
    'count', 'oz', 'fl oz', 'lb', 'g', 'kg', 'mL', 'L',
    'gal', 'ft', 'm', 'pack', 'roll', 'sheet', 'load', 'serving'
  ]);
  // Lowercase alias → canonical unit in our list
  const ALIASES = {
    'oz': 'oz', 'ounce': 'oz', 'ounces': 'oz',
    'fl oz': 'fl oz', 'floz': 'fl oz', 'fluid ounce': 'fl oz', 'fluid ounces': 'fl oz',
    'lb': 'lb', 'lbs': 'lb', 'pound': 'lb', 'pounds': 'lb',
    'g': 'g', 'gram': 'g', 'grams': 'g',
    'kg': 'kg', 'kilogram': 'kg', 'kilograms': 'kg',
    'ml': 'mL', 'milliliter': 'mL', 'milliliters': 'mL',
    'l': 'L', 'liter': 'L', 'liters': 'L',
    'gal': 'gal', 'gallon': 'gal', 'gallons': 'gal',
    'ft': 'ft', 'foot': 'ft', 'feet': 'ft',
    'm': 'm', 'meter': 'm', 'meters': 'm',
    'ct': 'count', 'count': 'count',
    'pack': 'pack', 'packs': 'pack',
    'roll': 'roll', 'rolls': 'roll',
    'sheet': 'sheet', 'sheets': 'sheet',
    'load': 'load', 'loads': 'load',
    'serving': 'serving', 'servings': 'serving'
  };

  const s = String(raw || '').trim().toLowerCase();
  if (!s) return null;
  // "4.8 oz", "12 fl oz"
  const m = s.match(/^([\d.]+)\s*(fl\s*oz|[a-z]+)/i);
  if (!m) return null;
  const size = parseFloat(m[1]);
  if (!isFinite(size)) return null;
  const unitKey = m[2].replace(/\s+/g, ' ').trim();
  const unit = ALIASES[unitKey] || (UNIT_SET.has(unitKey) ? unitKey : null);
  if (!unit) return null;
  return { size, unit };
}

// v0.15.4: scan an arbitrary string (typically a UPCitemdb product title)
// for "<number> <unit>" patterns. Returns the LAST match — product titles
// almost always put the size at the end ("... - 6 oz", "... 4.7 oz").
// Falls through parseSizeString for the canonical-unit normalization. The
// unit alternation covers the same set parseSizeString does, but anchored
// loosely (with \b) instead of matching the whole string.
function findSizeInString(text) {
  if (!text) return null;
  const re = /(\d+(?:\.\d+)?)\s*(fl\s*oz|fluid\s*ounces?|ounces?|oz|lbs?|pounds?|kilograms?|grams?|kg|milliliters?|liters?|gallons?|mL|gal|ft|feet|foot|meters?|count|ct|packs?|rolls?|sheets?|loads?|servings?)\b/gi;
  let last = null;
  let m;
  while ((m = re.exec(text)) !== null) last = m;
  if (!last) return null;
  return parseSizeString(`${last[1]} ${last[2]}`);
}

/* ---------- toast ---------- */

let toastTimer = null;
function toast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  // v0.15.3: <dialog>.show() puts the toast in the browser top layer so it
  // appears ABOVE any modal dialog. show() is non-modal — doesn't block
  // background interaction. Reset open state if it was already showing so
  // the new message is the visible one.
  try {
    if (el.open) el.close();
    el.show();
  } catch {
    // Fallback: if <dialog> API isn't available for some reason, just
    // toggle visibility via the hidden attribute.
    el.removeAttribute('hidden');
  }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    try { el.close(); } catch { el.setAttribute('hidden', ''); }
  }, 2800);
}

/* ---------- cost input → $0.00 on blur ---------- */

function formatCostInput(e) {
  const el = e.target;
  if (el.value === '' || el.value == null) return;
  const n = Number(el.value);
  if (!isFinite(n)) return;
  el.value = n.toFixed(2);
}

// v0.15.3: format size input on blur for measurement units. "5" → "5.0",
// "4.7" → "4.7" (preserved). Only applies to weight/volume units where
// decimals make sense; count/pack/roll/sheet/load/serving stay as integers.
const SIZE_DECIMAL_UNITS = new Set(['oz', 'fl oz', 'lb', 'g', 'kg', 'mL', 'L', 'gal', 'ft', 'm']);
function formatSizeInput() {
  const f = form();
  const sizeEl = f.elements.size;
  const unitEl = f.elements.unit;
  if (!sizeEl || !unitEl) return;
  if (sizeEl.value === '' || sizeEl.value == null) return;
  const n = Number(sizeEl.value);
  if (!isFinite(n) || n <= 0) return;
  if (!SIZE_DECIMAL_UNITS.has(unitEl.value)) return;
  // Only reformat when the user typed a whole number (no decimal point) —
  // don't disturb someone who entered "4.7" or "0.5".
  if (Number.isInteger(n) && !sizeEl.value.includes('.')) {
    sizeEl.value = n.toFixed(1);
  }
}

/* ---------- auth UI ---------- */

function showSignedIn(user) {
  document.getElementById('auth-gate').hidden = true;
  document.getElementById('main-wrap').hidden = false;
  document.getElementById('toolbar').hidden = false;
  document.getElementById('user-chip').hidden = false;
  const avatar = document.getElementById('user-avatar');
  if (user.photoURL) { avatar.src = user.photoURL; avatar.hidden = false; }
  else { avatar.hidden = true; }
  document.getElementById('user-name').textContent = user.displayName || user.email || 'Signed in';
}

function showSignedOut() {
  document.getElementById('auth-gate').hidden = false;
  document.getElementById('main-wrap').hidden = true;
  document.getElementById('toolbar').hidden = true;
  document.getElementById('user-chip').hidden = true;
}

async function doSignIn() {
  const btn = document.getElementById('btn-signin');
  btn.disabled = true;
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (e) {
    if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
      toast('Sign-in failed: ' + (e.message || e.code));
    }
  } finally {
    btn.disabled = false;
  }
}

async function doSignOut() {
  try { await signOut(auth); }
  catch (e) { toast('Sign-out failed: ' + e.message); }
}

/* ---------- init ---------- */

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('version').textContent = `v${APP_VERSION}`;
  document.querySelector('meta[name="version"]')?.setAttribute('content', APP_VERSION);

  document.getElementById('btn-signin').addEventListener('click', doSignIn);
  document.getElementById('btn-signout').addEventListener('click', doSignOut);

  document.getElementById('btn-add').addEventListener('click', openAddDialog);
  document.getElementById('dialog-close').addEventListener('click', closeDialog);
  document.getElementById('dialog-cancel').addEventListener('click', closeDialog);

  // v0.7.23: keyboard shortcut — `n` opens the Add dialog. Only fires when
  // no text input is focused (so typing "n" in a search/text field stays
  // normal text), and not while modifier keys are held (Ctrl-N opens a new
  // browser window — don't hijack that). Disabled while any dialog is open
  // (the user is busy with a flow).
  document.addEventListener('keydown', e => {
    if (e.key !== 'n' && e.key !== 'N') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (document.querySelector('dialog[open]')) return;
    if (!currentUser) return; // not signed in — Add isn't relevant yet
    e.preventDefault();
    openAddDialog();
  });

  const f = form();
  f.addEventListener('submit', handleSubmit);
  f.elements.bundleStatus.addEventListener('change', setBundleSizeVisibility);
  // v0.10.1: keep the Amazon link in sync as the productName is edited —
  // the link prefers name over UPC, so updating as the user types gives a
  // more accurate search the moment they hit it.
  f.elements.productName.addEventListener('input', () => syncAmazonCheckLink(f.elements.upc.value));
  // v0.15.2: re-render the brand logo preview when the brand field is edited.
  if (f.elements.brand) f.elements.brand.addEventListener('input', syncDialogImagePreview);
  f.elements.bundleSize.addEventListener('input', updateBundlePositionMax);

  document.getElementById('btn-scan-upc').addEventListener('click', openScanner);
  // v0.15.1: explicit manual Look up button. Force-fresh fetch (bypasses
  // both L1 and L2 caches) so the user can retry past failures.
  document.getElementById('btn-lookup-upc')?.addEventListener('click', () => {
    const upc = form().elements.upc.value;
    lookupAndOfferUpc(upc, { fromScan: false, forceFresh: true });
  });
  document.getElementById('scanner-close').addEventListener('click', closeScanner);
  document.getElementById('scanner-cancel').addEventListener('click', closeScanner);
  // Browser Esc-closes dialogs by firing a "close" event — release the camera if that happens
  document.getElementById('scanner-dialog').addEventListener('close', closeScanner);

  // UPC blur → look up; skip if the value is unchanged from a prior lookup
  let lastLookedUpUpc = '';
  f.elements.upc.addEventListener('blur', () => {
    const code = normalizeUpc(f.elements.upc.value);
    if (!code || code === lastLookedUpUpc) return;
    lastLookedUpUpc = code;
    lookupAndOfferUpc(code, { fromScan: false });
  });
  f.elements.upc.addEventListener('input', () => {
    // If the user is editing, clear the "last looked up" so another blur re-triggers lookup
    if (normalizeUpc(f.elements.upc.value) !== lastLookedUpUpc) {
      setUpcStatus('');
    }
    // v0.9.0: keep the Amazon check link in sync with the current UPC value.
    syncAmazonCheckLink(f.elements.upc.value);
  });

  document.getElementById('upc-match-yes').addEventListener('click', acceptUpcMatch);
  document.getElementById('upc-match-no').addEventListener('click', closeUpcMatchDialog);
  document.getElementById('upc-match-close').addEventListener('click', closeUpcMatchDialog);
  document.getElementById('upc-match-dialog').addEventListener('close', () => { pendingUpcCode = null; });

  document.getElementById('continue-bundle').addEventListener('change', handleContinueBundle);

  for (const [name, kind] of [
    ['productType', 'product type'],
    ['store', 'store'],
    ['buyer', 'buyer'],
    ['cardLast4', 'card']
  ]) {
    const el = f.elements[name];
    el.addEventListener('change', () => {
      if (el.value === ADD_NEW) handleAddNew(el, kind);
    });
  }

  for (const name of ['cost', 'costWithTax']) {
    f.elements[name].addEventListener('blur', formatCostInput);
  }
  // v0.15.3: format size on blur ("5" → "5.0" for oz/lb/etc.).
  f.elements.size?.addEventListener('blur', formatSizeInput);
  // Re-run on unit change too — switching from "count" to "oz" should
  // immediately apply the decimal format if the size is a whole number.
  f.elements.unit?.addEventListener('change', formatSizeInput);

  document.getElementById('products-body').addEventListener('click', e => {
    const editBtn = e.target.closest('.edit-btn');
    const dupBtn = e.target.closest('.duplicate-btn');
    const delBtn = e.target.closest('.delete-btn');
    const nameLink = e.target.closest('.name-link');
    const moreBtn = e.target.closest('.mc-more-btn');
    const notesChip = e.target.closest('.notes-chip');
    const cellChip = e.target.closest('.cell-chip');
    const bundleChip = e.target.closest('.bundle-chip');
    const bundleSibling = e.target.closest('.bundle-sibling');
    const bundleClose = e.target.closest('.bundle-siblings-close');
    const exportBtn = e.target.closest('.export-btn');
    const historyBtn = e.target.closest('.history-btn');
    const shareBtn = e.target.closest('.share-btn');
    const finishBtn = e.target.closest('.finish-btn');
    if (cellChip) {
      addFilter(cellChip.dataset.filterCol, cellChip.dataset.filterVal);
      return;
    }
    if (bundleChip) {
      // Toggle the slide-out: clicking the same row's chip collapses;
      // clicking a different row's chip switches to that row's bundle.
      const rowId = bundleChip.dataset.rowId;
      expandedBundleRow = (expandedBundleRow === rowId) ? null : rowId;
      renderTable();
      return;
    }
    if (bundleClose) {
      expandedBundleRow = null;
      renderTable();
      return;
    }
    if (bundleSibling) {
      openEditDialog(bundleSibling.dataset.id);
      return;
    }
    if (exportBtn) { exportProductPng(exportBtn.dataset.id); return; }
    if (historyBtn) { openPriceHistory(historyBtn.dataset.id); return; }
    if (shareBtn) { openShareDialog(shareBtn.dataset.id); return; }
    if (finishBtn) { openFinishDialog(finishBtn.dataset.id); return; }
    if (editBtn) openEditDialog(editBtn.dataset.id);
    else if (dupBtn) openDuplicateDialog(dupBtn.dataset.id);
    else if (nameLink) openEditDialog(nameLink.dataset.id);
    else if (delBtn) confirmDelete(delBtn.dataset.id);
    else if (notesChip) {
      // Toggle expansion on the desktop notes chip. Re-renders this row
      // only — cheap — by re-rendering the whole table since we don't
      // track row → tr mapping. For the table sizes we expect (<200) this
      // is fine. Shares expandedCards with mobile so state is consistent.
      const id = notesChip.dataset.id;
      if (expandedCards.has(id)) expandedCards.delete(id);
      else expandedCards.add(id);
      renderTable();
    }
    else if (moreBtn) {
      // Toggle this card's expansion in-place — no full re-render needed.
      const id = moreBtn.dataset.id;
      const card = moreBtn.closest('.mc');
      if (expandedCards.has(id)) {
        expandedCards.delete(id);
        card.classList.remove('mc-expanded');
        moreBtn.textContent = 'Show more';
      } else {
        expandedCards.add(id);
        card.classList.add('mc-expanded');
        moreBtn.textContent = 'Show less';
      }
    }
  });

  // Mobile sort dropdown — encodes "column.dir" in option values.
  const mobileSort = document.getElementById('mobile-sort');
  if (mobileSort) {
    // Sync the dropdown to whatever sortState started at (default startDate.desc),
    // falling back to the first option if no exact match.
    const initial = `${sortState.column}.${sortState.dir}`;
    const match = Array.from(mobileSort.options).find(o => o.value === initial);
    if (match) mobileSort.value = initial;
    mobileSort.addEventListener('change', e => handleMobileSortChange(e.target.value));
  }

  document.querySelectorAll('#products-table thead th[data-sort]').forEach(th => {
    th.addEventListener('click', () => handleHeaderClick(th));
  });

  document.querySelectorAll('.view-tab').forEach(btn => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });

  document.querySelectorAll('.row-filter-tab').forEach(btn => {
    btn.addEventListener('click', () => setFilter(btn.dataset.filter));
  });
  // Sync the persisted filter onto the DOM (in case localStorage had a non-default value)
  setFilter(currentFilter);

  document.getElementById('btn-reset-filters')?.addEventListener('click', resetFilters);

  // v0.14.0: live search. `input` event fires on every keystroke; filter
  // logic is fast enough for thousands of products without lag.
  const searchInput = document.getElementById('row-search');
  if (searchInput) {
    searchInput.addEventListener('input', e => setSearchQuery(e.target.value));
    searchInput.addEventListener('focus', renderSearchSuggestions);
    searchInput.addEventListener('blur', () => {
      // Delay so a click on a suggestion registers before the dropdown
      // hides (mousedown on a suggestion fires blur on the input first).
      setTimeout(() => {
        const list = document.getElementById('row-search-suggestions');
        if (list && document.activeElement !== searchInput) {
          list.hidden = true;
          searchInput.setAttribute('aria-expanded', 'false');
        }
      }, 150);
    });
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); moveSuggestionFocus(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); moveSuggestionFocus(-1); }
      else if (e.key === 'Enter' && activeSuggestionIndex >= 0) { e.preventDefault(); pickActiveSuggestion(); }
      else if (e.key === 'Escape') {
        e.preventDefault();
        searchInput.value = '';
        setSearchQuery('');
        searchInput.blur();
      }
    });
  }
  document.getElementById('row-search-suggestions')?.addEventListener('click', e => {
    const btn = e.target.closest('.row-search-suggestion');
    if (btn) openSuggestion(btn.dataset.id);
  });

  // v0.7.16: dashboard PNG export buttons
  document.getElementById('btn-export-dashboard')?.addEventListener('click', exportDashboardPng);
  document.getElementById('btn-export-overview')?.addEventListener('click', exportOverviewPng);

  // v0.10.0: reorder reminder clicks → open the product for editing
  document.getElementById('reminders-panel')?.addEventListener('click', e => {
    const item = e.target.closest('.reminder-item');
    if (item) openEditDialog(item.dataset.id);
  });

  // v0.15.0: favorites view handlers
  document.getElementById('btn-add-favorite')?.addEventListener('click', openAddFavoriteDialog);
  document.getElementById('favorites-grid')?.addEventListener('click', e => {
    const editBtn = e.target.closest('.fav-edit-btn');
    const promoteBtn = e.target.closest('.fav-promote-btn');
    const deleteBtn = e.target.closest('.fav-delete-btn');
    if (editBtn) openEditFavoriteDialog(editBtn.dataset.id);
    else if (promoteBtn) trackFromFavorite(promoteBtn.dataset.id);
    else if (deleteBtn) confirmDeleteFavorite(deleteBtn.dataset.id);
  });
  // Rating star clicks (in the dialog when favorite mode is on)
  document.getElementById('rating-input')?.addEventListener('click', e => {
    const star = e.target.closest('.rating-star');
    if (star) syncRatingDisplay(Number(star.dataset.value) || 0);
    if (e.target.id === 'rating-clear') syncRatingDisplay(0);
  });

  // v0.11.0: share dialog handlers (v0.15.3: + PNG export)
  document.getElementById('share-close')?.addEventListener('click', closeShareDialog);
  document.getElementById('share-copy')?.addEventListener('click', copyShareLink);
  document.getElementById('share-open')?.addEventListener('click', openShareInNewTab);
  document.getElementById('share-png')?.addEventListener('click', () => {
    const dlg = document.getElementById('share-dialog');
    const id = dlg?._productId;
    if (id) exportProductPng(id);
  });

  // v0.14.1: finish dialog handlers
  document.getElementById('finish-close')?.addEventListener('click', closeFinishDialog);
  document.getElementById('finish-cancel')?.addEventListener('click', closeFinishDialog);
  document.getElementById('finish-confirm')?.addEventListener('click', confirmFinish);
  document.getElementById('finish-date')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); confirmFinish(); }
  });

  // v0.16.0: settings dialog (email reminder opt-in) handlers
  document.getElementById('btn-settings')?.addEventListener('click', openSettingsDialog);
  document.getElementById('settings-close')?.addEventListener('click', closeSettingsDialog);
  document.getElementById('settings-cancel')?.addEventListener('click', closeSettingsDialog);
  document.getElementById('settings-save')?.addEventListener('click', handleSettingsSave);

  // v0.8.0: price history dialog close handlers
  document.getElementById('price-history-close')?.addEventListener('click', closePriceHistory);
  document.getElementById('price-history-done')?.addEventListener('click', closePriceHistory);
  document.getElementById('price-history-dialog')?.addEventListener('close', () => {
    if (priceHistoryChart) {
      try { priceHistoryChart.destroy(); } catch {}
      priceHistoryChart = null;
    }
  });

  // v0.7.17: activity log controls
  document.getElementById('activity-pagesize')?.addEventListener('change', e => {
    const v = Number(e.target.value);
    if ([25, 50, 100, 150].includes(v)) {
      activityPageSize = v;
      try { localStorage.setItem('usage.activityPageSize.v1', String(v)); } catch {}
      renderActivity();
    }
  });
  document.getElementById('btn-clear-activity')?.addEventListener('click', async () => {
    if (!currentUser) return;
    if (!confirm('Clear all activity entries from your account? This cannot be undone and affects every device you sign in with.')) return;
    const btn = document.getElementById('btn-clear-activity');
    if (btn) btn.disabled = true;
    try {
      const snap = await getDocs(activityColl());
      const deletes = [];
      snap.forEach(d => deletes.push(deleteDoc(doc(db, 'users', currentUser.uid, 'activity', d.id))));
      await Promise.all(deletes);
      activityEntries = [];
      renderActivity();
      toast('Activity log cleared');
    } catch (e) {
      toast('Clear failed: ' + e.message);
    } finally {
      if (btn) btn.disabled = false;
    }
  });
  // Click-through to product on activity rows
  document.getElementById('activity-list')?.addEventListener('click', e => {
    const link = e.target.closest('.activity-name-link');
    if (link) openEditDialog(link.dataset.id);
  });

  // v0.7.10: active filter chips bar — clicking a chip removes that filter,
  // clicking "Clear all" wipes all chip filters at once.
  document.getElementById('active-filter-bar')?.addEventListener('click', e => {
    const clearAll = e.target.closest('#filter-chip-clear-all');
    if (clearAll) { clearChipFilters(); return; }
    const chip = e.target.closest('.filter-chip');
    if (chip) removeFilter(chip.dataset.clearCol);
  });

  // v0.12.0: currency selector. Populate with supported codes, sync to
  // persisted user choice, wire change handler that re-renders everything
  // monetary (which is most things).
  populateCurrencySelect();
  applyCurrencySymbol();
  const currencySel = document.getElementById('currency-select');
  if (currencySel) {
    currencySel.addEventListener('change', () => {
      const next = currencySel.value;
      if (!SUPPORTED_CURRENCIES.some(c => c.code === next)) return;
      userCurrency = next;
      try { localStorage.setItem(CURRENCY_KEY, next); } catch {}
      _moneyFormatters = { code: '', coarse: null, fine: null }; // invalidate
      applyCurrencySymbol();
      render();
      toast(`Currency set to ${next}`);
    });
  }

  // Pre-tax display toggle. Sync DOM to persisted state, then wire change.
  const preTaxToggle = document.getElementById('pretax-toggle');
  if (preTaxToggle) {
    preTaxToggle.checked = preTaxMode;
    applyPreTaxMode();
    preTaxToggle.addEventListener('change', () => {
      preTaxMode = preTaxToggle.checked;
      try { localStorage.setItem(PRETAX_KEY, preTaxMode ? '1' : '0'); } catch {}
      applyPreTaxMode();
      render();
      toast(preTaxMode ? 'Showing pre-tax prices' : 'Showing prices with tax');
    });
  }

  // v0.17.0: density toggle. CSS-only via body class — render() is not
  // needed since no data changes; the rules just re-style the existing
  // table cells.
  const densitySelect = document.getElementById('density-select');
  if (densitySelect) {
    densitySelect.value = densityMode;
    applyDensityMode();
    densitySelect.addEventListener('change', () => {
      densityMode = densitySelect.value === 'compact' ? 'compact' : 'comfortable';
      try { localStorage.setItem(DENSITY_KEY, densityMode); } catch {}
      applyDensityMode();
    });
  }

  // v0.17.0: column visibility dropdown. Per-column checkboxes; persists
  // to localStorage. The rows are rendered up-front and re-rendered when
  // the user clicks "Show all" or "Reset" so the checked states stay in
  // sync with the source-of-truth state object.
  applyColumnVisibility();
  renderColumnsMenu();
  const columnsBtn = document.getElementById('btn-columns');
  const columnsMenu = document.getElementById('columns-menu');
  if (columnsBtn && columnsMenu) {
    columnsBtn.addEventListener('click', e => {
      e.stopPropagation();
      const wasOpen = columnsMenu.classList.contains('open');
      // Close sibling dropdowns first.
      document.getElementById('export-menu')?.classList.remove('open');
      document.getElementById('import-menu')?.classList.remove('open');
      columnsMenu.classList.toggle('open', !wasOpen);
      columnsBtn.setAttribute('aria-expanded', String(!wasOpen));
    });
    // Close on outside click — mirrors the pattern used by Import/Export menus.
    document.addEventListener('click', e => {
      if (!columnsMenu.contains(e.target) && e.target !== columnsBtn) {
        columnsMenu.classList.remove('open');
        columnsBtn.setAttribute('aria-expanded', 'false');
      }
    });
    // Per-checkbox change.
    columnsMenu.addEventListener('change', e => {
      const cb = e.target.closest('input[type="checkbox"][data-col-key]');
      if (!cb) return;
      const key = cb.dataset.colKey;
      columnVisibility[key] = !!cb.checked;
      saveColumnVisibility();
      applyColumnVisibility();
    });
    // Show-all / Reset action buttons inside the dropdown footer.
    document.getElementById('columns-show-all')?.addEventListener('click', () => {
      for (const col of TOGGLEABLE_COLUMNS) columnVisibility[col.key] = true;
      saveColumnVisibility();
      applyColumnVisibility();
      renderColumnsMenu();
    });
    document.getElementById('columns-reset')?.addEventListener('click', () => {
      // Reset = same as Show all for now; if we ever introduce a
      // recommended default subset (e.g. hide UPC and Duration on
      // narrow screens), this is the place to apply it.
      for (const col of TOGGLEABLE_COLUMNS) columnVisibility[col.key] = true;
      try { localStorage.removeItem(COLUMNS_KEY); } catch {}
      applyColumnVisibility();
      renderColumnsMenu();
      toast('Columns reset to default');
    });
  }

  const exportBtn = document.getElementById('btn-export');
  const exportMenu = document.getElementById('export-menu');
  exportBtn.addEventListener('click', e => {
    e.stopPropagation();
    exportMenu.classList.toggle('open');
    document.getElementById('import-menu')?.classList.remove('open');
  });
  document.addEventListener('click', () => exportMenu.classList.remove('open'));
  exportMenu.addEventListener('click', e => {
    const btn = e.target.closest('button[data-export]');
    if (!btn) return;
    if (btn.dataset.export === 'json') exportJSON();
    if (btn.dataset.export === 'csv') exportCSV();
    exportMenu.classList.remove('open');
  });

  const fileInput = document.getElementById('file-import');
  const importBtn = document.getElementById('btn-import');
  const importMenu = document.getElementById('import-menu');
  importBtn.addEventListener('click', e => {
    e.stopPropagation();
    importMenu.classList.toggle('open');
    // close the sibling Export menu if it's open
    document.getElementById('export-menu')?.classList.remove('open');
  });
  document.addEventListener('click', () => importMenu.classList.remove('open'));
  importMenu.addEventListener('click', e => {
    const btn = e.target.closest('button[data-import]');
    if (!btn) return;
    if (btn.dataset.import === 'file') fileInput.click();
    if (btn.dataset.import === 'template-csv') downloadCSVTemplate();
    if (btn.dataset.import === 'template-json') downloadJSONTemplate();
    importMenu.classList.remove('open');
  });
  fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) handleImportFile(file);
    e.target.value = '';
  });

  // Auth state listener — drives everything
  onAuthStateChanged(auth, async user => {
    currentUser = user;
    if (user) {
      showSignedIn(user);
      subscribeData(user.uid);
      await offerLegacyMigration(user.uid);
    } else {
      showSignedOut();
      unsubscribeData();
      products = [];
      customTypesCache = [];
      render();
    }
  });
});
