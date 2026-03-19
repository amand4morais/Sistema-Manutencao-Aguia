const CACHE_NAME = 'aguia-manuals-v1';
const MANUALS_URL_PATTERN = /.*\.pdf.*/; // Detecta PDFs ou links de storage

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Só intercepta requisições de manuais (PDFs)
  if (MANUALS_URL_PATTERN.test(event.request.url)) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        // Retorna do cache se existir, senão busca na rede e salva
        return response || fetch(event.request).then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
  }
});
