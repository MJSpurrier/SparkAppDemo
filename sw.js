/* Now Mode service worker.
   Versioned cache: activate deletes Spark v5 (spark-v5-feedback-1) and any other cache.
   The app shell is network-first so a returning tester gets this build, not a stale page.
*/
const CACHE = "nowmode-v1";
const SHELL = [
  "/SparkAppDemo/",
  "/SparkAppDemo/index.html",
  "/SparkAppDemo/manifest.json",
  "/SparkAppDemo/icons/icon-192.png",
  "/SparkAppDemo/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isAppShell(request) {
  if (request.mode === "navigate") return true;
  const path = new URL(request.url).pathname;
  return (
    path === "/SparkAppDemo" ||
    path === "/SparkAppDemo/" ||
    path.endsWith("/index.html") ||
    path.endsWith("/sw.js")
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isAppShell(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && !response.redirected) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE);
          return (
            (await cache.match(request)) ||
            (await cache.match("/SparkAppDemo/index.html")) ||
            new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } })
          );
        })
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(request);
      if (hit) return hit;
      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone()).catch(() => {});
      return response;
    })
  );
});
