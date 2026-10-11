// Red primero, caché como respaldo: mientras iteramos el prototipo siempre se ve la última versión,
// y si no hay conexión la App abre igual con lo último que se descargó.
const CACHE = 'pievivo-proto-v2';
const BASE = [
  './', 'index.html', 'panel.html', 'estilos.css', 'panel.css',
  'contenido.js', 'datos.js', 'config.js', 'nube.js', 'app.js', 'panel.js', 'manifest.webmanifest',
  'img/logo.png', 'img/isotipo.png', 'img/icon-192.png', 'img/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(BASE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (claves) { return Promise.all(claves.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(function (respuesta) {
        const copia = respuesta.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copia); });
        return respuesta;
      })
      .catch(function () { return caches.match(e.request, { ignoreSearch: true }); })
  );
});
