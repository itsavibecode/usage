/* Usage Tracker — v0.7.23
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

const APP_VERSION = '0.7.23';

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
  'purchaseDate', 'notes', 'upc', 'imageUrl', 'createdAt'
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

// Active = user has started using it and hasn't finished.
// Inventory = bought but not yet in use (no startDate).
// Finished = has an endDate.
// These three categories partition the product set.
function isActive(p) { return !!p.startDate && !p.endDate; }
function isInventory(p) { return !p.startDate; }
function isFinished(p) { return !!p.endDate; }

/* ---------- formatting ---------- */

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD',
  minimumFractionDigits: 2, maximumFractionDigits: 2
});
const usdFineFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD',
  minimumFractionDigits: 2, maximumFractionDigits: 4
});

const money = n => (n == null || !isFinite(Number(n))) ? '—' : usdFormatter.format(Number(n));
const moneyFine = n => (n == null || !isFinite(Number(n))) ? '—' : usdFineFormatter.format(Number(n));

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
  return products.filter(p => p.bundleId === bundleId);
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
}

// v0.7.17 activity log helpers ----------------------------------------------

function activityKey() {
  return currentUser ? ACTIVITY_KEY_PREFIX + currentUser.uid : null;
}

function loadActivity() {
  const k = activityKey();
  if (!k) return [];
  try {
    const raw = localStorage.getItem(k);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function logActivity(action, p, summary = '') {
  const k = activityKey();
  if (!k) return;
  const entry = {
    ts: new Date().toISOString(),
    action,
    productId: p?.id || '',
    productName: p?.productName || '(unnamed)',
    productType: p?.productType || '',
    summary
  };
  const list = loadActivity();
  list.unshift(entry); // newest first
  if (list.length > ACTIVITY_MAX) list.length = ACTIVITY_MAX;
  try {
    localStorage.setItem(k, JSON.stringify(list));
  } catch {
    // Storage quota or access denied — fail silently; activity log is best-effort.
  }
  // If the user is currently viewing the activity page, refresh it.
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
    if (!p.bundleStatus) continue;
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
    default: return (p[column] ?? '').toString().toLowerCase();
  }
}

function filteredProducts() {
  let list = products;
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
  renderTable();
  renderStats();
  renderDashboard();
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

  // v0.7.22: Buyer and Card render as `.cell-chip` filter buttons on mobile,
  // matching the desktop table behavior. Size and store stay as plain text —
  // they aren't filterable columns. Existing click delegation in
  // attachTableHandlers picks up `.cell-chip` clicks regardless of viewport.
  const metaParts = [];
  if (p.size && p.unit) metaParts.push(`<span class="mc-meta-text">${escapeHtml(p.size)} ${escapeHtml(p.unit)}</span>`);
  if (p.store) metaParts.push(`<span class="mc-meta-text">${escapeHtml(p.store)}</span>`);
  if (p.buyer) metaParts.push(`<button type="button" class="cell-chip mc-meta-chip" data-filter-col="buyer" data-filter-val="${escapeHtml(p.buyer)}" title="Filter to ${escapeHtml(p.buyer)}">${escapeHtml(p.buyer)}</button>`);
  if (p.cardLast4) metaParts.push(`<button type="button" class="cell-chip mc-meta-chip" data-filter-col="cardLast4" data-filter-val="${escapeHtml(p.cardLast4)}" title="Filter to card &bull;&bull;&bull;&bull; ${escapeHtml(p.cardLast4)}">&bull;&bull; ${escapeHtml(p.cardLast4)}</button>`);
  const meta = metaParts.join(' <span class="mc-meta-sep">&middot;</span> ');

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
  const hasExtras = !!(meta || p.notes);

  return `
    <div class="mc${expanded ? ' mc-expanded' : ''}">
      <div class="mc-head">
        ${p.imageUrl ? `<img class="mc-thumb" src="${escapeHtml(p.imageUrl)}" alt="" loading="lazy" onerror="this.remove()">` : ''}
        ${p.productType ? `<button type="button" class="cell-chip mc-type-chip" data-filter-col="productType" data-filter-val="${escapeHtml(p.productType)}" title="Filter to ${escapeHtml(p.productType)}">${escapeHtml(p.productType)}</button>` : '<span class="mc-type">—</span>'}
        <span class="mc-status">${endLabel}</span>
      </div>
      <button type="button" class="mc-name name-link" data-id="${p.id}" title="Edit product">${escapeHtml(p.productName)}</button>
      <dl class="mc-grid">
        <div class="mc-row"><dt>Started</dt><dd>${startLabel}${durationStr}</dd></div>
        <div class="mc-row"><dt>Cost</dt><dd>${costPrimary}${perDayStr}</dd></div>
        ${bundleChip ? `<div class="mc-row"><dt>Bundle</dt><dd>${bundleChip}</dd></div>` : ''}
        ${meta ? `<div class="mc-row mc-row-extra"><dt>Where</dt><dd>${meta}</dd></div>` : ''}
        ${p.notes ? `<div class="mc-row mc-row-extra mc-row-notes"><dt>Notes</dt><dd>${escapeHtml(p.notes)}</dd></div>` : ''}
      </dl>
      ${hasExtras ? `<button type="button" class="mc-more-btn" data-id="${p.id}">${expanded ? 'Show less' : 'Show more'}</button>` : ''}
      ${(p.bundleId && expandedBundleRow === p.id) ? renderBundleSiblingsInline(p) : ''}
      <div class="mc-actions">
        <button type="button" class="edit-btn" data-id="${p.id}">Edit</button>
        <button type="button" class="duplicate-btn" data-id="${p.id}">Duplicate</button>
        <button type="button" class="export-btn" data-id="${p.id}" title="Export 4:3 PNG">PNG</button>
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
    <td>${p.productType ? `<button type="button" class="cell-chip" data-filter-col="productType" data-filter-val="${escapeHtml(p.productType)}" title="Filter to ${escapeHtml(p.productType)}">${escapeHtml(p.productType)}</button>` : '—'}</td>
    <td class="name-cell">${p.imageUrl ? `<img class="name-thumb" src="${escapeHtml(p.imageUrl)}" alt="" loading="lazy" onerror="this.remove()">` : ''}<button type="button" class="name-link" data-id="${p.id}" title="Edit product">${escapeHtml(p.productName)}</button></td>
    <td class="num">${escapeHtml(p.size)} ${escapeHtml(p.unit)}</td>
    <td>${formatDate(p.startDate)}</td>
    <td>${p.endDate ? formatDate(p.endDate) : (isInventory(p) ? '<span class="badge badge-inventory">inventory</span>' : '<span class="badge badge-active">active</span>')}</td>
    <td class="num">${formatDuration(p)}</td>
    <td class="num">${money(p.cost)}</td>
    <td class="num cell-with-tax">${p.costWithTax ? money(p.costWithTax) : '—'}</td>
    <td class="num">${moneyFine(calcCostPerUnit(p))}</td>
    <td class="num">${moneyFine(calcCostPerDay(p))}</td>
    <td>${(() => {
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
    <td>${escapeHtml(p.store) || '—'}</td>
    <td>${p.buyer ? `<button type="button" class="cell-chip" data-filter-col="buyer" data-filter-val="${escapeHtml(p.buyer)}" title="Filter to ${escapeHtml(p.buyer)}">${escapeHtml(p.buyer)}</button>` : '—'}</td>
    <td>${p.cardLast4 ? `<button type="button" class="cell-chip" data-filter-col="cardLast4" data-filter-val="${escapeHtml(p.cardLast4)}" title="Filter to card •••• ${escapeHtml(p.cardLast4)}">•••• ${escapeHtml(p.cardLast4)}</button>` : '—'}</td>
    <td>${formatDate(p.purchaseDate)}</td>
    <td><code>${escapeHtml(p.upc)}</code></td>
    <td class="notes-cell">${(() => {
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
    <td class="actions-cell">
      <button type="button" class="edit-btn" data-id="${p.id}">Edit</button>
      <button type="button" class="duplicate-btn" data-id="${p.id}" title="Duplicate this product as a new entry">Duplicate</button>
      <button type="button" class="export-btn" data-id="${p.id}" title="Export this product as a 4:3 PNG card">PNG</button>
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
// table width (18 desktop columns + 1 mobile-card-cell = 19 total).
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
  // colspan=19: 18 desktop columns + 1 mobile-card-cell. The cell spans the
  // full table width so the panel reads as detail belonging to the row above.
  tr.innerHTML = `<td colspan="19" class="bundle-siblings-cell">${renderBundleSiblingsInner(p)}</td>`;
  return tr;
}

function renderStats() {
  const count = products.length;
  const active = products.filter(isActive).length;
  const inventory = products.filter(isInventory).length;
  const finished = products.filter(isFinished).length;
  // v0.7.7: spend tiles exclude inventory. Rationale: until you start using
  // a product, treating it as "spent" mixes accounting cash-flow with the
  // app's usage-tracking purpose. Inventory items only contribute to spend
  // metrics once they get a startDate (active or finished). Same exclusion
  // applies to YTD spend and to the dashboard groupAllocatedSpend below.
  const total = products
    .filter(p => !isInventory(p))
    .reduce((s, p) => s + (allocatedCost(p) || 0), 0);

  // Year-to-date metrics
  const now = new Date();
  const currentYear = now.getFullYear();
  const yearStart = new Date(currentYear, 0, 1);

  // YTD spend: products purchased AND started using in the current calendar
  // year. Inventory excluded — see comment on `total` above. Falls back to
  // startDate if purchaseDate is missing (legacy rows).
  const ytdSpend = products.reduce((s, p) => {
    if (isInventory(p)) return s;
    const purchase = parseLocalDate(p.purchaseDate || p.startDate);
    if (!purchase || purchase.getFullYear() !== currentYear) return s;
    return s + (allocatedCost(p) || 0);
  }, 0);

  // YTD $/day: sum of per-day burn for products that were in use at any
  // point during this year — i.e. startDate <= today AND (endDate blank
  // OR endDate >= Jan 1 of this year).
  const ytdPerDay = products.reduce((s, p) => {
    const start = parseLocalDate(p.startDate);
    if (!start || start > now) return s;
    const end = p.endDate ? parseLocalDate(p.endDate) : now;
    if (!end || end < yearStart) return s;
    const perDay = calcCostPerDay(p);
    return s + (perDay != null && isFinite(perDay) ? perDay : 0);
  }, 0);

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
  // comment for rationale). This drives the dashboard's "Top category by
  // spend" / "Top store by spend" cards and the two donut/bar charts.
  const map = new Map();
  for (const p of products) {
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
    const finished = ps.filter(isFinished);
    if (finished.length < 3) return null;
    const map = new Map();
    for (const p of finished) {
      const v = calcCostPerDay(p);
      if (v == null || !isFinite(v) || v <= 0) continue;
      const k = p.productType || 'Unknown';
      map.set(k, (map.get(k) || 0) + v);
    }
    const top = topEntry(map);
    if (!top || top[1] <= 0) return null;
    return `${top[0]} is your highest daily-cost category, burning ${moneyFine(top[1])} per day.`;
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
  const real = pickRealInsight(products);
  if (real) return { kind: 'real', text: real };
  const cold = pickColdStartFact(products);
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

// v0.7.11 charts ---------------------------------------------------------

// $/day by product type — sum of calcCostPerDay across rows in each type.
// Inventory rows have null cost-per-day so they fall through naturally;
// finished rows still contribute (their per-day rate over their lifespan).
function renderChartPerDayByType() {
  const map = new Map();
  for (const p of products) {
    const v = calcCostPerDay(p);
    if (v == null || !isFinite(v) || v <= 0) continue;
    const k = p.productType || 'Unknown';
    map.set(k, (map.get(k) || 0) + v);
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
  for (const p of products) {
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
  const rows = products
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
  // Reset both axes: row-filter tabs back to "all" and any cell-click chips
  // cleared. setFilter calls renderTable; clearChipFilters does too, so we
  // get a redundant render here — fine, cheap.
  activeFilters = {};
  persistActiveFilters();
  setFilter('all');
  toast('Filters reset');
}

function setView(view) {
  if (view !== 'table' && view !== 'dashboard' && view !== 'activity') return;
  currentView = view;
  document.getElementById('view-table').hidden = view !== 'table';
  document.getElementById('view-dashboard').hidden = view !== 'dashboard';
  document.getElementById('view-activity').hidden = view !== 'activity';
  for (const btn of document.querySelectorAll('.view-tab')) {
    const isActive = btn.dataset.view === view;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  }
  // Dashboard charts must render after the container is visible so Chart.js measures width correctly.
  if (view === 'dashboard') renderDashboard();
  if (view === 'activity') renderActivity();
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

function openAddDialog() {
  editingId = null;
  document.getElementById('dialog-title').textContent = 'Add product';
  const f = form();
  f.reset();
  populateFormSelects();
  populateBundleSelect(document.getElementById('continue-bundle'));
  document.getElementById('continue-bundle-wrap').hidden = false;
  const today = new Date().toISOString().slice(0, 10);
  // startDate intentionally left blank — leaving it blank records this as
  // inventory (bought but not yet in use). User sets a start date when they
  // actually begin using the product.
  f.elements.purchaseDate.value = today;
  setBundleSizeVisibility();
  setUpcStatus('');
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
  dialog().showModal();
}

function closeDialog() {
  dialog().close();
  editingId = null;
  pendingDuplicateSourceId = null; // v0.7.17 — clear duplicate flag on cancel
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
  // v0.7.13: if the source is bundled, the duplicate inherits the same
  // bundleId so it becomes another sibling rather than starting a separate
  // bundle. Position is intentionally NOT copied — siblings need unique
  // positions; the user picks the next number when filling out the dialog.
  if (source.bundleStatus && source.bundleId && f.elements.bundleId) {
    f.elements.bundleId.value = source.bundleId;
  }
  // Today's purchaseDate is a sensible default for "I just bought another";
  // user can correct it if they're back-filling history.
  f.elements.purchaseDate.value = new Date().toISOString().slice(0, 10);
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

  if (!data.productType || data.productType === ADD_NEW) {
    toast('Product type is required'); return;
  }
  if (data.store === ADD_NEW) data.store = '';
  if (data.buyer === ADD_NEW) data.buyer = '';
  if (data.cardLast4 === ADD_NEW) data.cardLast4 = '';

  if (!data.upc) { toast('UPC is required'); return; }
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
  const count = products.length;
  const active = products.filter(isActive).length;
  const inventory = products.filter(isInventory).length;
  const finished = products.filter(isFinished).length;
  const total = products.filter(p => !isInventory(p)).reduce((s, p) => s + (allocatedCost(p) || 0), 0);
  const now = new Date();
  const yr = now.getFullYear();
  const ytdSpend = products.reduce((s, p) => {
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
    const res = await fetch(`${UPCITEMDB_URL}?upc=${encodeURIComponent(code)}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) return { error: 'HTTP', status: res.status };
    let data;
    try { data = await res.json(); }
    catch { return { error: 'PARSE' }; }
    if (data && data.code && data.code !== 'OK') {
      return { error: data.code, message: data.message };
    }
    const item = (data.items && data.items[0]) || null;
    return { item };
  } catch (e) {
    console.error('UPCitemdb call failed:', e);
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

async function lookupUpc(rawCode) {
  const code = normalizeUpc(rawCode);
  if (code.length < 8) return null;

  // L1: in-memory
  if (upcCache.has(code)) return upcCache.get(code);

  // L2: Firestore persistent cache
  setUpcStatus('Looking up product…', 'busy');
  const cached = await readPersistedUpc(code);
  if (cached) {
    const item = cached.item || null;
    upcCache.set(code, item);
    if (cached.source === 'miss') {
      setUpcStatus('No match (cached) — enter details manually.', '');
    }
    return item;
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
async function lookupAndOfferUpc(rawCode, { fromScan = false } = {}) {
  const code = normalizeUpc(rawCode);
  if (!code) { setUpcStatus(''); return; }
  if (code.length < 8) { setUpcStatus('UPC too short to look up.', 'error'); return; }

  pendingUpcLookup = code;
  const item = await lookupUpc(code);

  // Abort if the user changed the UPC while the request was in flight
  if (pendingUpcLookup !== code) return;
  pendingUpcLookup = null;

  if (!item) {
    if (fromScan) setUpcStatus('No match in UPC database — enter details manually.', '');
    else setUpcStatus('No match — enter details manually.', '');
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

  // Product type from category
  const guessedType = guessProductTypeFromCategory(item.category || '');
  if (guessedType) setIfEmpty('productType', guessedType);

  // Size + unit from "4.8 oz" style string
  const parsed = parseSizeString(item.size || '');
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

/* ---------- toast ---------- */

let toastTimer = null;
function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2800);
}

/* ---------- cost input → $0.00 on blur ---------- */

function formatCostInput(e) {
  const el = e.target;
  if (el.value === '' || el.value == null) return;
  const n = Number(el.value);
  if (!isFinite(n)) return;
  el.value = n.toFixed(2);
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
  f.elements.bundleSize.addEventListener('input', updateBundlePositionMax);

  document.getElementById('btn-scan-upc').addEventListener('click', openScanner);
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

  // v0.7.16: dashboard PNG export buttons
  document.getElementById('btn-export-dashboard')?.addEventListener('click', exportDashboardPng);
  document.getElementById('btn-export-overview')?.addEventListener('click', exportOverviewPng);

  // v0.7.17: activity log controls
  document.getElementById('activity-pagesize')?.addEventListener('change', e => {
    const v = Number(e.target.value);
    if ([25, 50, 100, 150].includes(v)) {
      activityPageSize = v;
      try { localStorage.setItem('usage.activityPageSize.v1', String(v)); } catch {}
      renderActivity();
    }
  });
  document.getElementById('btn-clear-activity')?.addEventListener('click', () => {
    if (!confirm('Clear all activity entries from this browser? This cannot be undone.')) return;
    const k = activityKey();
    if (k) try { localStorage.removeItem(k); } catch {}
    renderActivity();
    toast('Activity log cleared');
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
