const CACHE_NAME = 'cyberpi-v1';
const ASSETS = [
    '/',
    '/static/index.html',
    '/static/style.css',
    '/static/app.js',
    '/static/manifest.json',
    '/static/icon.svg'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        fetch(e.request).catch(() => caches.match(e.request))
    );
});
