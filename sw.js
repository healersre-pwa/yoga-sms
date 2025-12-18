
const CACHE_NAME = 'zenflow-v10';
const urlsToCache = [
  '/',
  '/index.html',
  '/index.tsx'
];

// 監聽來自頁面的消息，用來更新動態 Manifest 的內容
let dynamicManifest = null;

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'UPDATE_MANIFEST') {
    dynamicManifest = event.data.manifest;
  }
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) return caches.delete(name);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. 攔截 manifest.json 請求，動態回傳最新的 JSON
  if (url.pathname.endsWith('manifest.json') && dynamicManifest) {
    event.respondWith(
      new Response(JSON.stringify(dynamicManifest), {
        headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' }
      })
    );
    return;
  }

  // 2. 正常快取策略
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') return response;
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      }).catch(() => {
        // 離線降級處理
      });
    })
  );
});
