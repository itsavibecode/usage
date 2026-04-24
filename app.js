/* Usage Tracker — v0.1.0
 * Phase 1 + 2: data schema, calculations, form CRUD, import/export (localStorage).
 * Storage layer is abstracted so it can be swapped for Firestore in Phase 4. */

const APP_VERSION = '0.1.0';

const STORAGE_KEY = 'usage.products.v1';

const FIELDS = [
  'id', 'productType', 'productName', 'size', 'unit',
  'startDate', 'endDate', 'cost', 'costWithTax',
  'bundleStatus', 'store', 'buyer', 'cardLast4',
  'purchaseDate', 'notes', 'upc'
];

const storage = {
  load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  },
  save(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }
};

let products = storage.load();
let editingId = null;

/* ---------- calculations ---------- */

function daysBetween(startStr, endStr) {
  if (!startStr) return null;
  const start = new Date(startStr);
  const end = endStr ? new Date(endStr) : new Date();
  if (isNaN(start) || isNaN(end)) return null;
  const ms = end - start;
  const days = Math.max(1, Math.round(ms / 86400000));
  return days;
}

function calcDuration(p) {
  return daysBetween(p.startDate, p.endDate);
}

function calcCostPerUnit(p) {
  const size = Number(p.size);
  const cost = Number(p.costWithTax);
  if (!size || !isFinite(cost)) return null;
  return cost / size;
}

function calcCostPerDay(p) {
  const duration = calcDuration(p);
  const cost = Number(p.costWithTax);
  if (!duration || !isFinite(cost)) return null;
  return cost / duration;
}

function isActive(p) {
  return !p.endDate;
}

/* ---------- formatting ---------- */

const money = n => n == null || !isFinite(n) ? '—' : `$${Number(n).toFixed(2)}`;
const moneyFine = n => n == null || !isFinite(n) ? '—' : `$${Number(n).toFixed(3)}`;

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
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/* ---------- ID generation ---------- */

function newId() {
  if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
}

/* ---------- rendering ---------- */

function render() {
  const body = document.getElementById('products-body');
  const empty = document.getElementById('empty-state');
  body.innerHTML = '';

  if (products.length === 0) {
    empty.hidden = false;
  } else {
    empty.hidden = true;
    const rows = [...products].sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
    for (const p of rows) {
      body.appendChild(renderRow(p));
    }
  }

  renderStats();
}

function renderRow(p) {
  const tr = document.createElement('tr');
  const active = isActive(p);
  tr.innerHTML = `
    <td>${escapeHtml(p.productType)}</td>
    <td><strong>${escapeHtml(p.productName)}</strong></td>
    <td class="num">${escapeHtml(p.size)} ${escapeHtml(p.unit)}</td>
    <td>${formatDate(p.startDate)}</td>
    <td>${p.endDate ? formatDate(p.endDate) : '<span class="badge badge-active">active</span>'}</td>
    <td class="num">${formatDuration(p)}</td>
    <td class="num">${money(p.cost)}</td>
    <td class="num">${money(p.costWithTax)}</td>
    <td class="num">${moneyFine(calcCostPerUnit(p))}</td>
    <td class="num">${moneyFine(calcCostPerDay(p))}</td>
    <td>${p.bundleStatus ? '<span class="badge">bundle</span>' : '—'}</td>
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
  const total = products.reduce((sum, p) => sum + (Number(p.costWithTax) || 0), 0);
  document.getElementById('stat-count').textContent = count;
  document.getElementById('stat-active').textContent = active;
  document.getElementById('stat-finished').textContent = finished;
  document.getElementById('stat-total').textContent = money(total);
}

/* ---------- dialog / form ---------- */

const dialog = () => document.getElementById('product-dialog');
const form = () => document.getElementById('product-form');

function openAddDialog() {
  editingId = null;
  document.getElementById('dialog-title').textContent = 'Add product';
  form().reset();
  const today = new Date().toISOString().slice(0, 10);
  form().elements.startDate.value = today;
  form().elements.purchaseDate.value = today;
  dialog().showModal();
}

function openEditDialog(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  editingId = id;
  document.getElementById('dialog-title').textContent = 'Edit product';
  const f = form();
  f.reset();
  for (const key of FIELDS) {
    if (key === 'id') continue;
    const el = f.elements[key];
    if (!el) continue;
    if (el.type === 'checkbox') el.checked = !!p[key];
    else el.value = p[key] ?? '';
  }
  dialog().showModal();
}

function closeDialog() {
  dialog().close();
  editingId = null;
}

function handleSubmit(e) {
  e.preventDefault();
  const f = form();
  const data = {};
  for (const key of FIELDS) {
    if (key === 'id') continue;
    const el = f.elements[key];
    if (!el) continue;
    if (el.type === 'checkbox') data[key] = el.checked;
    else data[key] = el.value.trim();
  }

  if (!data.upc) {
    toast('UPC is required');
    return;
  }
  if (data.endDate && data.startDate && data.endDate < data.startDate) {
    toast('End date cannot be before start date');
    return;
  }

  if (editingId) {
    const idx = products.findIndex(p => p.id === editingId);
    if (idx >= 0) products[idx] = { id: editingId, ...data };
    toast('Product updated');
  } else {
    products.push({ id: newId(), ...data });
    toast('Product added');
  }

  storage.save(products);
  render();
  closeDialog();
}

/* ---------- delete confirm ---------- */

function confirmDelete(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const msg = document.getElementById('confirm-message');
  msg.textContent = `Delete "${p.productName}"? This cannot be undone.`;
  const cd = document.getElementById('confirm-dialog');
  cd.showModal();

  const yes = document.getElementById('confirm-yes');
  const no = document.getElementById('confirm-no');
  const cleanup = () => { yes.onclick = null; no.onclick = null; };
  yes.onclick = () => {
    products = products.filter(x => x.id !== id);
    storage.save(products);
    render();
    toast('Product deleted');
    cd.close();
    cleanup();
  };
  no.onclick = () => { cd.close(); cleanup(); };
}

/* ---------- import / export ---------- */

function exportJSON() {
  const payload = {
    app: 'usage-tracker',
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    products
  };
  download(JSON.stringify(payload, null, 2), `usage-export-${dateStamp()}.json`, 'application/json');
  toast(`Exported ${products.length} product${products.length === 1 ? '' : 's'}`);
}

function exportCSV() {
  const cols = [
    'id', 'productType', 'productName', 'size', 'unit',
    'startDate', 'endDate', 'durationDays',
    'cost', 'costWithTax', 'costPerUnit', 'costPerDay',
    'bundleStatus', 'store', 'buyer', 'cardLast4',
    'purchaseDate', 'upc', 'notes'
  ];
  const header = cols.join(',');
  const rows = products.map(p => cols.map(c => {
    let v;
    if (c === 'durationDays') v = calcDuration(p) ?? '';
    else if (c === 'costPerUnit') v = calcCostPerUnit(p) ?? '';
    else if (c === 'costPerDay') v = calcCostPerDay(p) ?? '';
    else v = p[c] ?? '';
    return csvCell(v);
  }).join(','));
  download([header, ...rows].join('\n'), `usage-export-${dateStamp()}.csv`, 'text/csv');
  toast(`Exported ${products.length} product${products.length === 1 ? '' : 's'}`);
}

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return '"' + s.replaceAll('"', '""') + '"';
  return s;
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function download(text, filename, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function handleImportFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
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

      const existingIds = new Set(products.map(p => p.id));
      let added = 0, updated = 0;
      for (const item of cleaned) {
        if (existingIds.has(item.id)) {
          products = products.map(p => p.id === item.id ? item : p);
          updated++;
        } else {
          products.push(item);
          added++;
        }
      }
      storage.save(products);
      render();
      toast(`Imported: ${added} added, ${updated} updated`);
    } catch (err) {
      toast('Import failed: ' + err.message);
    }
  };
  reader.onerror = () => toast('Could not read file');
  reader.readAsText(file);
}

/* ---------- toast ---------- */

let toastTimer = null;
function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2400);
}

/* ---------- init ---------- */

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('version').textContent = `v${APP_VERSION}`;
  document.querySelector('meta[name="version"]')?.setAttribute('content', APP_VERSION);

  document.getElementById('btn-add').addEventListener('click', openAddDialog);
  document.getElementById('dialog-close').addEventListener('click', closeDialog);
  document.getElementById('dialog-cancel').addEventListener('click', closeDialog);
  form().addEventListener('submit', handleSubmit);

  document.getElementById('products-body').addEventListener('click', e => {
    const editBtn = e.target.closest('.edit-btn');
    const delBtn = e.target.closest('.delete-btn');
    if (editBtn) openEditDialog(editBtn.dataset.id);
    if (delBtn) confirmDelete(delBtn.dataset.id);
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

  render();
});
