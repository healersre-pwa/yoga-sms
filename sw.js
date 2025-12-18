
const CACHE_NAME = 'zenflow-v8';
const urlsToCache = [
  '/',
  '/index.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Install event: cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
  self.skipWaiting(); // activate immediately
});

// Activate event: remove old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim(); // take control immediately
});

// Fetch event: cache first, network fallback
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Only handle http/https requests
  if (!requestUrl.protocol.startsWith('http')) return;
  
  // 讓 manifest 請求直接走網路，不要走快取
  if (requestUrl.pathname.endsWith('manifest.json')) {
      return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;

        return fetch(event.request).then((response) => {
          // Only cache valid responses
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }

          // Clone response and cache it
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        }).catch(() => {
          // Optional: fallback for offline
        });
      })
  );
});
