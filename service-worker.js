const CACHE_NAME = "claudia-perez-pilates-v3";
const APP_SHELL = [
  "./",
  "./index.html",
  "./client.html",
  "./admin.html",
  "./styles.css",
  "./src/main.js",
  "./src/features/client.js",
  "./src/features/admin.js",
  "./src/core/store.js",
  "./src/core/calendar.js",
  "./src/utils/dom.js",
  "./src/utils/date.js",
  "./src/components/index.js",
  "./src/pwa/index.js",
  "./manifest.webmanifest",
  "./icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return null;
        })
      )
    )
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => caches.match("./index.html"));
    })
  );
});
