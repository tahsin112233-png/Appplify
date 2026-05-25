// Applify Service Worker — enables background play & offline shell
const CACHE = 'applify-v1';
const SHELL = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Never intercept audio streams or API calls
  if (
    url.hostname.includes('ytimg.com') ||
    url.hostname.includes('googlevideo.com') ||
    url.hostname.includes('ytify.workers.dev') ||
    url.hostname.includes('omada.cafe') ||
    url.hostname.includes('lekker.gay') ||
    url.hostname.includes('melmac.space') ||
    url.hostname.includes('jing.rocks') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    return;
  }

  // Cache-first for app shell
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match('/index.html'));
    })
  );
});

// Keep alive for background audio — respond to message pings
self.addEventListener('message', e => {
  if (e.data === 'keepalive') {
    e.ports[0]?.postMessage('alive');
  }
});
