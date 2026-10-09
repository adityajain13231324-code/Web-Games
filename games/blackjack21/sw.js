/* Blackjack 21: offline support. Bump VERSION when you deploy changes so players get the new files. */
var VERSION = 'bj21-v2';
var FILES = ['./', 'index.html', 'css/fonts.css', 'css/game.css', 'js/rules.js', 'js/bots.js', 'js/art.js', 'js/audio.js', 'js/game.js', 'icon.svg', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest',
  'fonts/cinzel-latin-600-normal.woff2', 'fonts/cinzel-latin-700-normal.woff2', 'fonts/inter-latin-500-normal.woff2', 'fonts/inter-latin-600-normal.woff2', 'fonts/inter-latin-700-normal.woff2',
  'fonts/playfair-display-latin-700-normal.woff2', 'fonts/playfair-display-latin-800-normal.woff2'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES) }).then(function () { return self.skipWaiting() })) });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== VERSION }).map(function (k) { return caches.delete(k) })) }).then(function () { return self.clients.claim() }));
});
// network first (so updates show up), cache as the fallback when offline
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(fetch(e.request).then(function (r) { var copy = r.clone(); caches.open(VERSION).then(function (c) { c.put(e.request, copy) }); return r }).catch(function () { return caches.match(e.request).then(function (m) { return m || caches.match('index.html') }) }));
});
