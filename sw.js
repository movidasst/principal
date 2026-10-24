/* La Movida SST+: solo respaldo de navegación cuando no hay Internet. */
const CACHE_NAME = 'movida-hub-offline-v1';
const OFFLINE_PAGE = '/offline.html';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.add(OFFLINE_PAGE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('movida-hub-offline-') && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.mode !== 'navigate' || request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(request).catch(async () =>
    await caches.match(OFFLINE_PAGE) || Response.error()
  ));
});
