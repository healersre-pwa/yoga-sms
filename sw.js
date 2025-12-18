
const CACHE_NAME = 'zenflow-pwa-v12';
const MANIFEST_CACHE_KEY = 'dynamic-manifest-cache';

// 預設 Manifest (防止實體檔案遺失導致無法安裝)
const DEFAULT_MANIFEST = {
  "name": "ZenFlow 瑜伽訂課系統",
  "short_name": "ZenFlow",
  "start_url": "/index.html",
  "display": "standalone",
  "background_color": "#f4f7f6",
  "theme_color": "#568479",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" }
  ]
};

let currentManifest = null;

// 取得快取的 Manifest
const getCachedManifest = async () => {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(MANIFEST_CACHE_KEY);
    return response ? await response.json() : null;
  } catch (e) {
    return null;
  }
};

self.addEventListener('message', async (event) => {
  if (event.data && event.data.type === 'UPDATE_MANIFEST') {
    currentManifest = event.data.manifest;
    const cache = await caches.open(CACHE_NAME);
    await cache.put(
      MANIFEST_CACHE_KEY, 
      new Response(JSON.stringify(currentManifest), {
        headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' }
      })
    );
  }
});

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 攔截 Manifest 請求
  if (url.pathname.endsWith('manifest.json')) {
    event.respondWith(
      (async () => {
        // 1. 嘗試從伺服器抓取 (Network First)
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse.ok) return networkResponse;
        } catch (e) {
          // 網路失敗或 404，進入降級邏輯
        }

        // 2. 嘗試從記憶體或 Cache 回傳
        const manifest = currentManifest || (await getCachedManifest()) || DEFAULT_MANIFEST;
        
        return new Response(JSON.stringify(manifest), {
          headers: { 
            'Content-Type': 'application/manifest+json; charset=utf-8',
            'X-PWA-Fallback': 'true'
          }
        });
      })()
    );
    return;
  }

  // 一般快取策略
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
