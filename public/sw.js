const CACHE_NAME     = 'aguia-manuals-v1';   // mantido do original
const OFFLINE_CACHE  = 'aguia-florestal-v1'; // novo — assets e dados

const MANUALS_URL_PATTERN = /.*\.pdf.*/; // original — detecta PDFs ou links de storage

// ─── Install ──────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// ─── Activate ─────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      clients.claim(),
      // Limpar caches antigos que não sejam os dois nomes acima
      caches.keys().then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME && key !== OFFLINE_CACHE)
            .map(key => caches.delete(key))
        )
      )
    ])
  );
});

// ─── Fetch ────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar não-GET
  if (request.method !== 'GET') return;

  // Ignorar esquemas não-http
  if (!url.protocol.startsWith('http')) return;

  // ── 1. PDFs de manuais (comportamento original preservado) ───
  // Cache First: retorna do cache se existir, senão busca na rede e salva
  if (MANUALS_URL_PATTERN.test(request.url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        return cached || fetch(request).then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // ── 2. Assets estáticos (JS, CSS, fontes, imagens) ───────────
  // Cache First com atualização em background
  if (url.pathname.match(/\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|svg|ico|webp)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request).then((response) => {
          if (response.ok) {
            caches.open(OFFLINE_CACHE).then(cache => cache.put(request, response.clone()));
          }
          return response;
        });
        return cached || networkFetch;
      })
    );
    return;
  }

  // ── 3. Requisições GET ao Supabase (dados) ───────────────────
  // Network First: tenta rede, cai para cache se offline
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            caches.open(OFFLINE_CACHE).then(cache => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => {
            if (cached) return cached;
            // Resposta vazia válida para não quebrar o app
            return new Response(JSON.stringify([]), {
              headers: { 'Content-Type': 'application/json' }
            });
          })
        )
    );
    return;
  }

  // ── 4. Navegação (SPA) ───────────────────────────────────────
  // Sempre serve o index.html para rotas do React Router funcionarem offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }
});
