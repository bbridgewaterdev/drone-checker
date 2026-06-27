importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// Keep in sync with FIREBASE_CONFIG in app.html
firebase.initializeApp({
  apiKey:'AIzaSyB701OaJgb68Kct39Y7rfgQkw4fHSFsUb8',
  authDomain:'dronechecker.co.uk',
  projectId:'dronechecker',
  storageBucket:'dronechecker.firebasestorage.app',
  messagingSenderId:'62546050100',
  appId:'1:62546050100:web:2236074e078a8eb4cbde61'
});
const messaging = firebase.messaging();

// Background push — app not in foreground
messaging.onBackgroundMessage(function(payload) {
  const d = payload.data || {};
  self.registration.showNotification(d.title || 'DroneChecker', {
    body: d.body || 'A fly window has opened at your alert location.',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    data: {url: d.url || '/app.html'}
  });
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  // Defence-in-depth: only ever open a same-origin/relative path, never an
  // absolute cross-origin (or javascript:) URL, regardless of payload.
  const raw = (e.notification.data && e.notification.data.url) || '/app.html';
  let url = '/app.html';
  try {
    const u = new URL(raw, self.location.origin);
    if (u.origin === self.location.origin) url = u.pathname + u.search + u.hash;
  } catch (err) {}
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(wcs) {
      for (var i = 0; i < wcs.length; i++) {
        if (wcs[i].url.includes('dronechecker') && 'focus' in wcs[i]) return wcs[i].focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

const CACHE = 'dronechecker-v106';

const STATIC = [
  '/',
  '/index.html',
  '/app.html',
  '/app.js',
  '/faq.html',
  '/privacy.html',
  '/terms.html',
  '/manifest.json',
  '/drone-thresholds.json',
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

  // Never cache the version probe — must always reflect the live deploy
  if (url.endsWith('/version.json')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json' } })));
    return;
  }

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
