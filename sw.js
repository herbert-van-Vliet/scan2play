// sw.js
// scan2play service worker
// (c) 2026, info@remark.no
// v1.8.0

const CACHE_NAME = 'scan2play-v9';
const ASSETS = [
  'style.css',
  'js/scan2play.js',
  'js/jsQR/jsQR.js',
  'js/qrcodejs/qrcode.min.js',
  'manifest.json',
  'favicon.svg',
  'scan2play_icon_192x192.png',
  'scan2play_icon_512x512.png',
  'icons/nfc-symbol-brands-solid-full.svg',
  'icons/qrcode-solid-full.svg',
  'icons/play-solid-full.svg',
  'icons/pause-solid-full.svg',
  'icons/backward-step-solid-full.svg',
  'icons/forward-step-solid-full.svg',
  'icons/shuffle-solid-full.svg',
  'icons/repeat-solid-full.svg',
  'icons/arrow-up-right-from-square-solid-full.svg',
  'icons/share-nodes-solid-full.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
