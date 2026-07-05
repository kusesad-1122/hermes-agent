/*
 * Hermes Agent — self-retiring service worker.
 *
 * The previous version cached static assets, which caused stale UI during
 * rapid on-device iteration (rebuild → reload still served the old build).
 * This replacement does the opposite: whenever the browser picks it up (it
 * checks for SW updates on navigation), it clears every Hermes cache and
 * unregisters itself, then reloads open clients so they fetch fresh from the
 * server. index.html also no longer registers a worker.
 *
 * Net effect: any device that still has the old caching worker heals itself
 * on the next visit, and no new worker is installed.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch {
        // ignore
      }
      try {
        await self.registration.unregister();
      } catch {
        // ignore
      }
      try {
        const clients = await self.clients.matchAll({ type: "window" });
        for (const client of clients) client.navigate(client.url);
      } catch {
        // ignore
      }
    })(),
  );
});

// Pass every request straight to the network — never serve from cache.
self.addEventListener("fetch", () => {});
