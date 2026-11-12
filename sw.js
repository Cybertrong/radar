// Permet l'installation et un usage hors ligne de base.
var CACHE = 'radar-v2';
var FICHIERS = ['./', 'index.html', 'filtre.js', 'manifest.webmanifest', 'icone-192.png', 'icone-512.png', 'icone-180.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FICHIERS); }));
  self.skipWaiting();
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (cles) {
    return Promise.all(cles.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});
// Réseau d'abord (pour avoir les dernières aubaines), cache si hors ligne.
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(function (r) {
    var copie = r.clone();
    caches.open(CACHE).then(function (c) { c.put(e.request, copie); });
    return r;
  }).catch(function () { return caches.match(e.request, { ignoreSearch: true }); }));
});
