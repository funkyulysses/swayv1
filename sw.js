/* Service worker de Gastos.
   - Navegación (index.html): network-first -> siempre la versión nueva; si no hay red, la copia guardada.
   - Resto de archivos: cache-first + actualización en segundo plano.
   - Solo precachea lo que existe de verdad (allSettled), así el install nunca falla. */
const V = 'v6';
const CACHE = 'gastos-' + V;
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-maskable.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];
const put = (cache, req, res) => {
  if (res && res.ok && (res.type === 'basic' || res.type === 'default')) cache.put(req, res.clone());
  return res;
};

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.allSettled(SHELL.map(u => c.add(new Request(u, { cache: 'reload' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => { if (e.data === 'skip-waiting') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const net = await fetch(req);
        const c = await caches.open(CACHE);
        put(c, './index.html', net);
        return net;
      } catch {
        const c = await caches.open(CACHE);
        return (await c.match('./index.html')) || (await c.match('./')) || Response.error();
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) {
      fetch(req).then(n => put(c, req, n)).catch(() => {});
      return hit;
    }
    try { return put(c, req, await fetch(req)); }
    catch { return Response.error(); }
  })());
});
