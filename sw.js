
const CACHE_NAME = 'zenflow-pwa-v15'; // 每次重大更新建議提升版本號

self.addEventListener('install', (event) => {
  // 強制讓新的 Service Worker 立即進入 active 狀態
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // 清理舊版本的快取，釋放空間並避免衝突
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Cleaning old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // 只處理 GET 請求，且排除 Firebase Firestore 的 API 請求（由 SDK 自行處理離線）
  if (event.request.method !== 'GET' || 
      event.request.url.includes('firestore.googleapis.com') ||
      event.request.url.includes('identitytoolkit.googleapis.com') ||
      event.request.url.includes('googleSearch')) {
    return;
  }

  event.respondWith(
    // 網路優先策略 (Network First)
    fetch(event.request)
      .then((response) => {
        // 如果網路請求成功 (status 200)，則更新快取並回傳結果
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // 如果網路失敗（離線），則回傳快取中的資源
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // 如果快取也沒有，這裡可以回傳一個預設的離線頁面或錯誤
        });
      })
  );
});
