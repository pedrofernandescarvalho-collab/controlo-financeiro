const CACHE_NAME = 'finance-control-v4.3.0';
const ASSETS = [
  'index.html',
  'dashboard.html',
  'pro360.html',
  'pro360.js',
  'configuracao.html',
  'extrato.html',
  'style.css',
  'core-engine.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      );
    })
  );
});

self.addEventListener('fetch', event => {
  // Estratégia Network First para garantir que as atualizações chegam rápido
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// REDIRECIONAMENTO NUCLEAR PARA BYPASS DE CACHE
// Adicionar ao arquivo investimentos.html:
// <script>
//   window.location.href = "pro360.html" + window.location.search;
// </script>
