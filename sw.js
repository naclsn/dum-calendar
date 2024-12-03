const CACHE_NAME = 'dum-calendar-1';
const APP_STATIC_RESOURCES = [
    "/",
    "/database.js",
    "/index.html",
    "/script.js",
];

self.addEventListener('install', ev => {
    ev.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_STATIC_RESOURCES)));
});

self.addEventListener('activate', ev => {
    ev.waitUntil(caches.keys().then(names => Promise.all(names.map((name) => CACHE_NAME != name ? caches.delete(name) : 0))).then(_ => clients.claim()));
});

self.addEventListener('fetch', ev => {
    ev.respondWith('navigate' == ev.request.mode
        ? caches.match("/")
        : caches.open(CACHE_NAME).then(cache => cache.match(ev.request)).then(r => r || new Response(null, { status: 404 })));
});
