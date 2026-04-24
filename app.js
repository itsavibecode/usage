/* Usage Tracker — v0.4.0
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

const APP_VERSION = '0.4.0';

const LEGACY_PRODUCTS_KEY = 'usage.products.v1';
const LEGACY_TYPES_KEY = 'usage.customTypes.v1';

const SEED_PRODUCT_TYPES = [
  'Underarm', 'Toothbrush', 'Toothpaste', 'Floss',
  'Mouthwash', 'Facewash', 'Shampoo', 'Soap'
];

const FIELDS = [
  'id', 'productType', 'productName', 'size', 'unit',
  'startDate', 'endDate', 'cost', 'costWithTax',
  'bundleStatus', 'bundleSize',
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
let charts = { byType: null, byStore: null, finishedByMonth: null };

// Palette used for donut/category coloring — colorblind-friendly-ish and consistent across renders.
const CHART_PALETTE = [
  '#2b5fd9', '#2d8a5f', '#c23b3b', '#d98f2b', '#7a4ad9',
  '#2b9fd9', '#d92b8f', '#4a9e4a', '#b97020', '#5b6b8a',
  '#08697d', '#b03b8a'
];

/* ---------- calculations ---------- */

function daysBetween(startStr, endStr) {
  if (!startStr) return null;
  const start = new Date(startStr);
  const end = endStr ? new Date(endStr) : new Date();
  if (isNaN(start) || isNaN(end)) return null;
  return Math.max(1, Math.round((end - start) / 86400000));
}

function calcDuration(p) { return daysBetween(p.startDate, p.endDate); }

function effectiveCost(p) {
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

function isActive(p) { return !p.endDate; }

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
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDuration(p) {
  const d = calcDuration(p);
  if (d == null) return '—';
  return `${d}d${isActive(p) ? ' (in use)' : ''}`;
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

function sortedProducts() {
  const { column, dir } = sortState;
  const list = [...products];
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

  if (products.length === 0) {
    empty.hidden = false;
  } else {
    empty.hidden = true;
    for (const p of sortedProducts()) body.appendChild(renderRow(p));
  }

  document.querySelectorAll('#products-table thead th[data-sort]').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.sort === sortState.column) {
      th.classList.add(sortState.dir === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });
}

function renderRow(p) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${escapeHtml(p.productType)}</td>
    <td><strong>${escapeHtml(p.productName)}</strong></td>
    <td class="num">${escapeHtml(p.size)} ${escapeHtml(p.unit)}</td>
    <td>${formatDate(p.startDate)}</td>
    <td>${p.endDate ? formatDate(p.endDate) : '<span class="badge badge-active">active</span>'}</td>
    <td class="num">${formatDuration(p)}</td>
    <td class="num">${money(p.cost)}</td>
    <td class="num">${p.costWithTax ? money(p.costWithTax) : '—'}</td>
    <td class="num">${moneyFine(calcCostPerUnit(p))}</td>
    <td class="num">${moneyFine(calcCostPerDay(p))}</td>
    <td>${p.bundleStatus ? `<span class="badge">bundle × ${escapeHtml(p.bundleSize || '?')}</span>` : '—'}</td>
    <td>${escapeHtml(p.store) || '—'}</td>
    <td>${escapeHtml(p.buyer) || '—'}</td>
    <td>${p.cardLast4 ? '•••• ' + escapeHtml(p.cardLast4) : '—'}</td>
    <td>${formatDate(p.purchaseDate)}</td>
    <td><code>${escapeHtml(p.upc)}</code></td>
    <td class="notes-cell">${escapeHtml(p.notes) || ''}</td>
    <td class="actions-cell">
      <button type="button" class="edit-btn" data-id="${p.id}">Edit</button>
      <button type="button" class="delete-btn" data-id="${p.id}">Delete</button>
    </td>
  `;
  return tr;
}

function renderStats() {
  const count = products.length;
  const active = products.filter(isActive).length;
  const finished = count - active;
  const total = products.reduce((s, p) => s + (allocatedCost(p) || 0), 0);
  document.getElementById('stat-count').textContent = count;
  document.getElementById('stat-active').textContent = active;
  document.getElementById('stat-finished').textContent = finished;
  document.getElementById('stat-total').textContent = money(total);
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
  const map = new Map();
  for (const p of products) {
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

/* ---------- view switching ---------- */

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
  const wrap = document.getElementById('bundle-size-wrap');
  wrap.hidden = !bundled;
  f.elements.bundleSize.required = bundled;
  if (!bundled) f.elements.bundleSize.value = '';
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
  f.elements.startDate.value = today;
  f.elements.purchaseDate.value = today;
  setBundleSizeVisibility();
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
  f.elements.startDate.value = new Date().toISOString().slice(0, 10);
  f.elements.endDate.value = '';
  setBundleSizeVisibility();
  toast('Bundle details filled in — set your start date and save');
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
  } else {
    data.bundleSize = '';
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
    'bundleStatus', 'bundleSize',
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

async function handleImportFile(file) {
  if (!currentUser) { toast('Please sign in first'); return; }
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result);
      const incoming = Array.isArray(data) ? data : data.products;
      if (!Array.isArray(incoming)) throw new Error('Invalid file: no products array found');

      const cleaned = incoming.map(item => {
        const out = { id: item.id || newId() };
        for (const key of FIELDS) {
          if (key === 'id') continue;
          out[key] = item[key] ?? (key === 'bundleStatus' ? false : '');
        }
        return out;
      });

      let added = 0;
      for (const item of cleaned) {
        await setDoc(productDoc(item.id), item);
        added++;
      }

      if (Array.isArray(data.customTypes) && data.customTypes.length) {
        const merged = [...new Set([...customTypesCache, ...data.customTypes])];
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
    const delBtn = e.target.closest('.delete-btn');
    if (editBtn) openEditDialog(editBtn.dataset.id);
    if (delBtn) confirmDelete(delBtn.dataset.id);
  });

  document.querySelectorAll('#products-table thead th[data-sort]').forEach(th => {
    th.addEventListener('click', () => handleHeaderClick(th));
  });

  document.querySelectorAll('.view-tab').forEach(btn => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });

  const exportBtn = document.getElementById('btn-export');
  const exportMenu = document.getElementById('export-menu');
  exportBtn.addEventListener('click', e => {
    e.stopPropagation();
    exportMenu.classList.toggle('open');
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
  document.getElementById('btn-import').addEventListener('click', () => fileInput.click());
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
