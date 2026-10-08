/* Liar's Call service worker: caches the game so it opens offline once installed.
   Online rooms still need an internet connection (PeerJS).
   Bump VERSION whenever you deploy changed files, so phones pick up the new version. */
var VERSION = 'liars-call-v3';
var FILES = [
  './', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png',
  'css/fonts.css', 'css/game.css',
  'js/peerjs.min.js', 'js/net.js', 'js/rules.js', 'js/bots.js', 'js/art.js', 'js/audio.js', 'js/game.js',
  'fonts/baloo-2-600-0.woff2', 'fonts/baloo-2-700-1.woff2', 'fonts/baloo-2-800-2.woff2', 'fonts/baloo-2-700-3.woff2', 'fonts/yatra-one-400-4.woff2'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES) }).then(function () { return self.skipWaiting() }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION }).map(function (k) { return caches.delete(k) }));
  }).then(function () { return self.clients.claim() }));
});

// Network first (so a new deploy shows up straight away), falling back to the cache offline.
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(function (res) {
    var copy = res.clone();
    caches.open(VERSION).then(function (c) { c.put(e.request, copy) });
    return res;
  }).catch(function () { return caches.match(e.request, { ignoreSearch: true }) }));
});
