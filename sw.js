// Timesheet Service Worker — handles caching and update detection
// Strategy: network-first for HTML, cache-first for static assets
// Bump CACHE_VERSION whenever cached assets change, so a published update
// reliably replaces the pre-cached copy instead of serving a stale one.
// (The app version itself lives only in version.txt — see CLAUDE.md.)

const CACHE_VERSION = 'timesheet-v16';
const CACHE_NAME = `${CACHE_VERSION}-cache`;

// App-shell assets pre-cached at install so the app is reliably available
// offline (not just "after you've loaded it online once"). The CDN assets are
// best-effort: if any fail to fetch at install they're skipped, and the fetch
// handler will still cache them on first successful network load.
const PRECACHE_LOCAL = [
  './', './index.html', './sw.js', './version.txt',
  './manifest.json',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
  './icons/icon-maskable-192.png', './icons/icon-maskable-512.png',
  './icons/favicon.ico', './icons/favicon-32.png'
];
const PRECACHE_CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// Install: pre-cache the app shell, then skip waiting so the new SW activates.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      // Local assets must succeed; CDN assets are best-effort (ignore failures).
      cache.addAll(PRECACHE_LOCAL).then(() =>
        Promise.all(PRECACHE_CDN.map(u =>
          cache.add(u).catch(() => {/* offline at install — cached on first use */})
        ))
      )
    ).then(() => self.skipWaiting())
  );
});

// Activate: claim clients immediately, delete old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(names =>
        Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
      )
    ])
  );
});

// Fetch handler: network-first for HTML, cache-fallback for offline
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // version.txt is the app's update signal — it must always be fresh, never
  // served stale from cache. Network-first with a cache fallback only so the
  // version can still display offline.
  if (url.pathname.endsWith('version.txt')) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then(res => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  const isHTML = req.mode === 'navigate' ||
                 req.headers.get('accept')?.includes('text/html') ||
                 url.pathname.endsWith('.html') ||
                 url.pathname.endsWith('/');

  if (isHTML) {
    // Network-first for HTML: always try to get the latest
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then(res => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('/index.html')))
    );
    return;
  }

  // Cache-first for everything else (CDN scripts, fonts, etc.)
  event.respondWith(
    caches.match(req).then(cached => {
      return cached || fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return res;
      });
    })
  );
});

// Listen for messages from the page (e.g. force-reload command)
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
