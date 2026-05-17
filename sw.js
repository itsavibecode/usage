/* Usage Tracker — service worker (v0.23.0)
 *
 * Adds PWA installability. Chrome / Edge / Android Chrome require an
 * active service worker with a fetch handler before they'll surface
 * the install prompt. iOS Safari already accepts "Add to Home Screen"
 * via the share menu without an SW; this file unlocks the rest.
 *
 * Strategy:
 *   - Cache-first for same-origin app shell (HTML / CSS / JS / icons /
 *     manifest). Updates land via cache versioning — when SHELL_VERSION
 *     changes, the install handler caches a fresh shell and the activate
 *     handler deletes any older cache buckets.
 *   - Passthrough for everything cross-origin. Firebase (gstatic), Chart.js
 *     (jsdelivr), FDA (api.fda.gov), logo.dev, Identity Toolkit, the UPC
 *     Apps Script proxy — all live, never cached.
 *   - Passthrough for non-GET requests (Firestore writes, etc.).
 *   - Offline fallback: if the network fetch for a same-origin GET
 *     fails entirely, fall back to the cached index.html so the SPA
 *     can boot. Demo mode (?demo=1) then works fully offline since it
 *     never needs network beyond the shell.
 *
 * Update flow: skipWaiting + clients.claim on install/activate so a new
 * deploy takes effect on the user's next navigation without manual reload.
 * (Trade-off: in-flight tabs may briefly run a mixed-version state. For
 * a single-user personal tool this is acceptable; the alternative is a
 * toast prompting the user to refresh, which is more polish than needed.)
 *
 * The mirror workflow copies this file unchanged from the primary
 * deployment to the secondary one. Relative paths throughout so the
 * same SW works at both origins — scope is inferred from the SW's own
 * URL (/usage/sw.js → /usage/ scope), no edits needed.
 */

const SHELL_VERSION = 'usage-shell-v0.26.1';

// Files cached on SW install. Listed as relative paths so the same SW
// works at both deployments (primary + secondary) without edits.
// Keep this list tight — adding too many files just to "be thorough"
// bloats the install step and slows the install / update.
const SHELL_URLS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './firebase-init.js',
  './manifest.webmanifest',
  './favicon.svg',
  './favicon-32.png',
  './favicon-180.png',
  './favicon-192.png',
  './favicon-512.png',
  './og-image.svg',
  './og-image.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_VERSION)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        // If any shell file fails to fetch during install (e.g. one of
        // the icons hasn't deployed yet), don't abort the whole SW —
        // log + skip the failed entry. Browser will still install us
        // with whatever made it into the cache.
        console.warn('[sw] shell precache partial:', err);
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== SHELL_VERSION).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Passthrough for non-GET (writes, OPTIONS, etc.) and cross-origin
  // requests (Firebase, jsdelivr, FDA, logo.dev, Apps Script proxy).
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Cache-first for same-origin shell. Network fallback updates the
  // cache so future loads are fresh. Total failure → cached index.html.
  event.respondWith((async () => {
    const cache = await caches.open(SHELL_VERSION);
    const cached = await cache.match(req);
    if (cached) {
      // Background revalidate so the cache stays current without
      // blocking the response.
      event.waitUntil((async () => {
        try {
          const fresh = await fetch(req);
          if (fresh.ok && fresh.type === 'basic') {
            await cache.put(req, fresh);
          }
        } catch { /* offline — keep the cached copy */ }
      })());
      return cached;
    }
    try {
      const resp = await fetch(req);
      if (resp.ok && resp.type === 'basic') {
        // Write through so subsequent reads are cache-first.
        cache.put(req, resp.clone());
      }
      return resp;
    } catch {
      // Total offline. Fall back to the cached index.html so the
      // SPA at least boots — works especially well in demo mode.
      const indexFallback = await cache.match('./index.html');
      if (indexFallback) return indexFallback;
      // No cached index either — give the browser its default error.
      throw new Error('offline, no cached fallback');
    }
  })());
});
