const CACHE = 'dronechecker-v75';

const STATIC = [
  '/',
  '/index.html',
  '/app.html',
  '/faq.html',
  '/privacy.html',
  '/terms.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
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
// - app.html: network first, fall back to cache
// - Everything else: cache first, update in background
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Never cache non-GET requests (POST etc. — Firebase auth, Stripe, etc.)
  if (e.request.method !== 'GET') return;

  // Never cache API calls — always fetch fresh
  if (url.includes('open-meteo.com') ||
      url.includes('postcodes.io') ||
      url.includes('swpc.noaa.gov') ||
      url.includes('nominatim.openstreetmap.org') ||
      url.includes('geocoding-api.open-meteo.com') ||
      url.includes('tiles.stadiamaps.com') ||
      url.includes('googletagmanager.com') ||
      url.includes('google-analytics.com') ||
      url.includes('firestore.googleapis.com') ||
      url.includes('firebase.googleapis.com') ||
      url.includes('identitytoolkit.googleapis.com') ||
      url.includes('securetoken.googleapis.com') ||
      url.includes('stripe.com')) {
    e.respondWith(
      fetch(e.request).catch(() => new Response(
        JSON.stringify({ error: 'offline', message: 'No live data — do not fly without checking current conditions.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      ))
    );
    return;
  }

  // HTML pages: network-first so updates deploy immediately
  if (e.request.mode === 'navigate' ||
      url.endsWith('.html') ||
      url.endsWith('/') ||
      url.endsWith('/app') ||
      url.endsWith('/faq') ||
      url.endsWith('/privacy') ||
      url.endsWith('/terms')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() =>
          caches.match(e.request).then(cached =>
            cached || caches.match('/app.html') || caches.match('/index.html')
          )
        )
    );
    return;
  }

  // Static assets: cache first, update in background
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});