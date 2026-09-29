const CACHE_NAME = 'livingdex-static-v3.6.58';
const STATIC_EXT = /\.(?:js|css|json|webp|png|svg|woff2?)$/i;
self.addEventListener('install', event => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const url = new URL(req.url);
  if (url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')) {
    event.respondWith(fetch(req).then(res => { const copy=res.clone(); if (res && res.ok) caches.open(CACHE_NAME).then(c=>c.put(req,copy)); return res; }).catch(()=>caches.match(req)));
    return;
  }
  if (!STATIC_EXT.test(url.pathname)) return;
  event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { const copy=res.clone(); if (res && res.ok) caches.open(CACHE_NAME).then(c=>c.put(req,copy)); return res; })));
});
