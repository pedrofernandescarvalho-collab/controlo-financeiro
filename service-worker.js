const CACHE_NAME = 'finance-control-v3.0.0';
const ASSETS = [
  'index.html',
  'dashboard.html',
  'investimentos.html',
  'configuracao.html',
  'extrato.html',
  'style.css',
  'script.js',
  'investimentos.js',
  'google-drive-sync.js'
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

