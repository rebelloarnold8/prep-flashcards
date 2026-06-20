/* Offline-first service worker. Bump CACHE to force update after edits. */
const CACHE = 'prep-cards-v2';
const ASSETS = [
  './', './index.html', './style.css', './app.js',
  './manifest.webmanifest', './cards.json',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Never cache GitHub API (sync must hit network)
  if (url.hostname === 'api.github.com') return;
  // cards.json: network-first so deck updates land; fall back to cache offline
  if (url.pathname.endsWith('cards.json')){
    e.respondWith(fetch(e.request).then(r=>{ const c=r.clone(); caches.open(CACHE).then(x=>x.put(e.request,c)); return r; }).catch(()=>caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
