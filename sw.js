// Timesheet Service Worker — handles caching and update detection
// Strategy: network-first for HTML, cache-first for static assets
// Increment CACHE_VERSION whenever you want to force a clean cache refresh

const CACHE_VERSION = 'timesheet-v1';
const CACHE_NAME = `${CACHE_VERSION}-cache`;

// Install: skip waiting so new SW activates immediately
self.addEventListener('install', event => {
  self.skipWaiting();
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
