const CACHE_NAME = 'cadencia-v6';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(
        /* cacheia cada arquivo separadamente: se um falhar (404, offline, etc.)
           os demais ainda são salvos — evita que o precache inteiro quebre */
        ASSETS.map((url) => cache.add(url).catch((err) => console.warn('[SW] falhou ao cachear', url, err)))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const isHTML = e.request.mode === 'navigate' || e.request.url.endsWith('/') || e.request.url.endsWith('index.html');
  if (isHTML) {
    /* HTML principal: busca a versão mais nova na rede primeiro.
       Só usa o cache se estiver offline. Assim, cada atualização aparece
       direto, sem precisar recarregar duas vezes. */
    e.respondWith(
      fetch(e.request)
        .then((networkResp) => {
          if (networkResp && networkResp.status === 200) {
            const respClone = networkResp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, respClone));
          }
          return networkResp;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }
  /* demais arquivos (ícones, manifest): cache primeiro, atualiza em segundo plano */
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchPromise = fetch(e.request)
        .then((networkResp) => {
          if (networkResp && networkResp.status === 200) {
            const respClone = networkResp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, respClone));
          }
          return networkResp;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
