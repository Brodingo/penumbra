const CACHE_NAME = "penumbra-v1";
const APP_SHELL = [
  new URL("./", self.location).href,
  new URL("./index.html", self.location).href,
  new URL("./styles.css", self.location).href,
  new URL("./app.js", self.location).href,
  new URL("./map-viewer.js", self.location).href,
  new URL("./manifest.webmanifest", self.location).href,
  new URL("./penumbra-icon.svg", self.location).href,
  new URL("./directions.json", self.location).href,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
    )).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
          return response;
        })
        .catch(() => caches.match("./index.html") ?? caches.match("./")),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(request).then((response) => {
        const cloned = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
        return response;
      }).catch(() => caches.match("./index.html") ?? caches.match("./"));
    }),
  );
});
