const CACHE = "cpbar-v12";
const FILES = ["./", "index.html", "app.js?v=2", "rules.js", "species-list.js", "sprite-map.js", "style.css?v=2", "logo.svg", "manifest.webmanifest"];
self.addEventListener("install", (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))));
self.addEventListener("activate", (e) =>
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))));
// Network first so updates show up; fall back to cache offline.
self.addEventListener("fetch", (e) =>
  e.respondWith(fetch(e.request).then((r) => {
    const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r;
  }).catch(() => caches.match(e.request))));
