const CACHE_NAME = 'ufoq-v2';
const ASSETS = [
  './',
  './index.html',
  './about.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon.svg'
];
const EXTERNAL = [
  'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600&display=swap',
  'https://unpkg.com/three@0.160.0/build/three.module.js',
  'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js',
  'https://unpkg.com/three@0.160.0/examples/jsm/environments/RoomEnvironment.js',
  'https://unpkg.com/three@0.160.0/examples/jsm/geometries/RoundedBoxGeometry.js'
];

// Install: cache core assets (resilient — one failure must not break install)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      const urls = [...ASSETS, ...EXTERNAL];
      await Promise.allSettled(urls.map(url =>
        fetch(url, { mode: 'cors' })
          .then(res => { if (res && (res.ok || res.type === 'opaque')) return cache.put(url, res); })
          .catch(() => {})
      ));
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean all old caches, take control immediately
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for assets, network-first for navigation
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (!request.url.startsWith('http')) return;

  // Navigation: network first, fall back to cached page, then offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', clone));
          return response;
        })
        .catch(() =>
          caches.match(request)
            .then(cached => cached || caches.match('./index.html'))
            .then(cached => cached || new Response(
              '<meta charset="utf-8"><body style="background:#0a1a14;color:#f5efe0;font-family:sans-serif;text-align:center;padding:60px">لا يوجد اتصال بالإنترنت — افتح مرة أخرى عند عودة الشبكة.</body>',
              { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            ))
        )
    );
    return;
  }

  // Assets: cache first, update cache in background
  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request)
        .then(response => {
          if (response && (response.ok || response.type === 'opaque')) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
