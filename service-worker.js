const CACHE_VERSION = "djmax-pwa-v1";
const STATIC_CACHE = `static-${CACHE_VERSION}`;

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./admin.html",
  "./styles.css",
  "./config.js",
  "./common.js",
  "./app.js",
  "./admin.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-maskable.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

async function networkFirst(request) {
  try {
    const freshResponse = await fetch(request);
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, freshResponse.clone());
    return freshResponse;
  } catch {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const fallback = await caches.match("./index.html");
    return fallback || Response.error();
  }
}

async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const freshResponse = await fetch(request);
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, freshResponse.clone());
    return freshResponse;
  } catch {
    return Response.error();
  }
}
