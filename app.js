/* Usage Tracker — v0.7.9
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
  collection, doc, onSnapshot, setDoc, deleteDoc, getDocs
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { Chart, registerables } from "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/+esm";
Chart.register(...registerables);

const APP_VERSION = '0.7.9';

const LEGACY_PRODUCTS_KEY = 'usage.products.v1';
const LEGACY_TYPES_KEY = 'usage.customTypes.v1';

const SEED_PRODUCT_TYPES = [
  'Underarm', 'Toothbrush', 'Toothpaste', 'Floss',
  'Mouthwash', 'Facewash', 'Shampoo', 'Soap'
];

const FIELDS = [
  'id', 'productType', 'productName', 'size', 'unit',
  'startDate', 'endDate', 'cost', 'costWithTax',
  'bundleStatus', 'bundleSize', 'bundlePosition',
  'store', 'buyer', 'cardLast4',
  'purchaseDate', 'notes', 'upc'
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
let charts = { byType: null, byStore: null, finishedByMonth: null };
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
  if (currentFilter === 'active') return products.filter(isActive);
  if (currentFilter === 'inventory') return products.filter(isInventory);
  return products;
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

function render() {
  renderTable();
  renderStats();
  renderDashboard();
}

function renderTable() {
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
  if (visible.length === 0) {
    empty.hidden = false;
    if (products.length === 0) {
      empty.innerHTML = 'No products tracked yet. Click <strong>+ Add product</strong> to get started.';
    } else if (currentFilter === 'active') {
      empty.innerHTML = 'No <strong>active</strong> products right now. Switch to <strong>All</strong> or <strong>Inventory</strong> to see your other items.';
    } else if (currentFilter === 'inventory') {
      empty.innerHTML = 'No products in <strong>inventory</strong>. Add a product and leave the <em>Start date</em> blank to record items you\'ve bought but not started using.';
    }
  } else {
    empty.hidden = true;
    for (const p of visible) body.appendChild(renderRow(p));
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

  const meta = [
    p.size && p.unit ? `${escapeHtml(p.size)} ${escapeHtml(p.unit)}` : null,
    p.store ? escapeHtml(p.store) : null,
    p.buyer ? escapeHtml(p.buyer) : null,
    p.cardLast4 ? '&bull;&bull; ' + escapeHtml(p.cardLast4) : null
  ].filter(Boolean).join(' &middot; ');

  const bundleChip = p.bundleStatus
    ? (p.bundlePosition
        ? `<span class="badge badge-bundle-member">${escapeHtml(p.bundlePosition)} of ${escapeHtml(p.bundleSize || '?')}</span>`
        : `<span class="badge badge-bundle-origin">bundle &times; ${escapeHtml(p.bundleSize || '?')}</span>`)
    : '';

  // Show-more expander: Where + Notes are tagged with .mc-row-extra so the
  // CSS can hide them by default. The button only renders if there's anything
  // to hide — no point showing "Show more" on a card with no extra rows.
  const expanded = expandedCards.has(p.id);
  const hasExtras = !!(meta || p.notes);

  return `
    <div class="mc${expanded ? ' mc-expanded' : ''}">
      <div class="mc-head">
        <span class="mc-type">${escapeHtml(p.productType)}</span>
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
      <div class="mc-actions">
        <button type="button" class="edit-btn" data-id="${p.id}">Edit</button>
        <button type="button" class="duplicate-btn" data-id="${p.id}">Duplicate</button>
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
    <td>${escapeHtml(p.productType)}</td>
    <td class="name-cell"><button type="button" class="name-link" data-id="${p.id}" title="Edit product">${escapeHtml(p.productName)}</button></td>
    <td class="num">${escapeHtml(p.size)} ${escapeHtml(p.unit)}</td>
    <td>${formatDate(p.startDate)}</td>
    <td>${p.endDate ? formatDate(p.endDate) : (isInventory(p) ? '<span class="badge badge-inventory">inventory</span>' : '<span class="badge badge-active">active</span>')}</td>
    <td class="num">${formatDuration(p)}</td>
    <td class="num">${money(p.cost)}</td>
    <td class="num cell-with-tax">${p.costWithTax ? money(p.costWithTax) : '—'}</td>
    <td class="num">${moneyFine(calcCostPerUnit(p))}</td>
    <td class="num">${moneyFine(calcCostPerDay(p))}</td>
    <td>${p.bundleStatus ? (p.bundlePosition ? `<span class="badge badge-bundle-member">${escapeHtml(p.bundlePosition)} of ${escapeHtml(p.bundleSize || '?')}</span>` : `<span class="badge badge-bundle-origin">bundle × ${escapeHtml(p.bundleSize || '?')}</span>`) : '—'}</td>
    <td>${escapeHtml(p.store) || '—'}</td>
    <td>${escapeHtml(p.buyer) || '—'}</td>
    <td>${p.cardLast4 ? '•••• ' + escapeHtml(p.cardLast4) : '—'}</td>
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
      <button type="button" class="delete-btn" data-id="${p.id}">Delete</button>
    </td>
    <td class="mobile-card-cell">${renderMobileCard(p)}</td>
  `;
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
  setFilter('all');
  toast('Filters reset');
}

function setView(view) {
  if (view !== 'table' && view !== 'dashboard') return;
  currentView = view;
  document.getElementById('view-table').hidden = view !== 'table';
  document.getElementById('view-dashboard').hidden = view !== 'dashboard';
  for (const btn of document.querySelectorAll('.view-tab')) {
    const isActive = btn.dataset.view === view;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  }
  // Dashboard charts must render after the container is visible so Chart.js measures width correctly.
  if (view === 'dashboard') renderDashboard();
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
    const label = `${b.productName} — ${formatDate(b.purchaseDate)} (× ${b.bundleSize})`;
    el.append(new Option(label, b.id));
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
  } else {
    data.bundleSize = '';
    data.bundlePosition = '';
  }

  const id = editingId || newId();
  const saveBtn = document.getElementById('dialog-save');
  saveBtn.disabled = true;
  try {
    await saveProduct({ id, ...data });
    toast(editingId ? 'Product updated' : 'Product added');
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
    } catch {}
    finally { yes.disabled = false; }
    cd.close(); cleanup();
  };
  no.onclick = () => { cd.close(); cleanup(); };
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

/* ---------- UPC database lookup (UPCitemdb trial) ---------- */
// Free tier: 100 requests/day/IP. CORS-enabled. Response shape:
//   { code: "OK", total: N, items: [{ ean, upc, title, brand, category, size, offers: [...] }] }
// We cache hits in module state so repeated UPC scans within a session don't burn requests.

const UPCITEMDB_URL = 'https://api.upcitemdb.com/prod/trial/lookup';
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

async function lookupUpc(rawCode) {
  const code = normalizeUpc(rawCode);
  if (code.length < 8) return null;

  if (upcCache.has(code)) return upcCache.get(code);

  setUpcStatus('Looking up product…', 'busy');
  try {
    const res = await fetch(`${UPCITEMDB_URL}?upc=${encodeURIComponent(code)}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) {
      // 429 = trial rate-limit; other non-OK = generic network issue
      if (res.status === 429) {
        setUpcStatus('UPC lookup limit reached for today — enter details manually.', 'error');
      } else {
        setUpcStatus(`Lookup failed (${res.status}).`, 'error');
      }
      return null;
    }
    const data = await res.json();
    const item = (data.items && data.items[0]) || null;
    upcCache.set(code, item);
    return item;
  } catch (e) {
    console.error('UPC lookup failed:', e);
    setUpcStatus('Lookup failed — check connection.', 'error');
    return null;
  }
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
