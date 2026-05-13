const CACHE = 'dronechecker-v43';

const STATIC = [
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install — cache core files only
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(
        STATIC.map(url =>
          fetch(url).then(res => { if(res.ok) cache.put(url, res); }).catch(() => {})
        )
      )
    )
  );
  self.skipWaiting();
});

// Activate — clear ALL old caches immediately
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => {
        console.log('Clearing old cache:', k);
        return caches.delete(k);
      }))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - API calls: always network, never cache
// - index.html: network first, fall back to cache
// - Everything else: cache first, update in background
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Never cache API calls — always fetch fresh
  if (url.includes('open-meteo.com') ||
      url.includes('openweathermap.org') ||
      url.includes('postcodes.io') ||
      url.includes('swpc.noaa.gov') ||
      url.includes('nominatim.openstreetmap.org') ||
      url.includes('geocoding-api.open-meteo.com')) {
    e.respondWith(
      fetch(e.request).catch(() => new Response('{}', {headers:{'Content-Type':'application/json'}}))
    );
    return;
  }

  // index.html: network first so updates deploy immediately
  if (url.endsWith('/') || url.endsWith('index.html') || url.endsWith('dronechecker.co.uk/')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Static assets: cache first, update in background
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(res => {
        if(res.ok){
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});