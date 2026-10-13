const CACHE_NAME = "life-hub-web-shell-0347426cde2b2963";
const CACHE_FAMILY_PREFIX = 'life-hub-web-';
const PRECACHE = [
  "./_expo/static/js/web/AppEntry-4deebf0f1e390cce5b61a3b8b19debd5.js",
  "./index.html",
  "./life-hub-192.png",
  "./life-hub-512.png",
  "./manifest.json"
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith(CACHE_FAMILY_PREFIX) && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    // The installed PWA must never wait on a slow/hung network request before
    // showing its already-verified local shell. Serve the precached shell
    // immediately and refresh it in the background when the network responds.
    const refreshController = new AbortController();
    const refreshTimeout = setTimeout(() => refreshController.abort(), 5000);
    const networkRefresh = fetch(request, { signal: refreshController.signal })
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          return caches.open(CACHE_NAME)
            .then(cache => cache.put('./index.html', copy))
            .then(() => response);
        }
        return response;
      })
      .catch(() => undefined)
      .finally(() => clearTimeout(refreshTimeout));

    event.waitUntil(networkRefresh.then(() => undefined));
    event.respondWith(
      caches.open(CACHE_NAME)
        .then(cache => cache.match('./index.html'))
        .then(cached => cached || networkRefresh)
        .then(response => response || Response.error())
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(cache => cache.match(request)).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok && url.pathname.includes('/_expo/')) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
