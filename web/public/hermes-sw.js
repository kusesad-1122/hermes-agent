/*
 * Hermes Agent — Progressive Web App service worker.
 *
 * PURPOSE
 *   The web dashboard is a normal browser SPA. Adding this (plus the
 *   manifest) makes it *installable* to an Android/iOS home screen so it
 *   opens in its own standalone window — an "app" without an app store or
 *   an APK build. See docs/android/使用指南.zh-CN.md.
 *
 * SAFETY (read before editing)
 *   This worker is deliberately conservative so it can NEVER serve a stale
 *   session token or cache live agent traffic:
 *     - It ONLY caches immutable, content-hashed static assets
 *       (/assets/, /fonts/, /fonts-terminal/, /ds-assets/, /icons/).
 *     - It NEVER intercepts /api/* (REST, auth tickets, SSE) — those pass
 *       straight to the network. WebSocket upgrades (/api/ws) are not seen
 *       by service workers at all, so the JSON-RPC gateway is untouched.
 *     - Navigations (the HTML shell, which carries the freshly-injected
 *       window.__HERMES_SESSION_TOKEN__) are always network-first; the
 *       cache is only a last-resort offline fallback.
 *   The net effect: online behaviour is byte-for-byte the same as no
 *   service worker; the only additions are faster repeat asset loads and
 *   installability.
 */

const CACHE_VERSION = "hermes-pwa-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;

// URL path prefixes that are safe to cache (immutable, content-hashed, or
// pure static brand assets). Everything outside this list is network-only.
const CACHEABLE_PREFIXES = [
  "/assets/",
  "/fonts/",
  "/fonts-terminal/",
  "/ds-assets/",
  "/icons/",
];

function isCacheable(url) {
  if (url.origin !== self.location.origin) return false;
  return CACHEABLE_PREFIXES.some((p) => url.pathname.includes(p));
}

self.addEventListener("install", (event) => {
  // Activate immediately; nothing to precache — assets are cached lazily on
  // first use so we never ship a hardcoded (and quickly-stale) asset list.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("hermes-pwa-") && k !== STATIC_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // never touch POST/PUT/DELETE

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  // API traffic is always live: auth tickets, session token, streaming.
  if (url.pathname.includes("/api/")) return;

  // Immutable static assets: cache-first, then populate the cache.
  if (isCacheable(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (res && res.ok && res.type === "basic") {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(req, res.clone());
          }
          return res;
        } catch (err) {
          const fallback = await caches.match(req);
          if (fallback) return fallback;
          throw err;
        }
      })(),
    );
    return;
  }

  // Navigations (the HTML shell with the fresh token): network-first, cache
  // only as an offline fallback so we never serve a stale token online.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          // Best-effort stash of the shell for offline opens only.
          if (res && res.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put("/__hermes_offline_shell__", res.clone());
          }
          return res;
        } catch (err) {
          const shell = await caches.match("/__hermes_offline_shell__");
          if (shell) return shell;
          throw err;
        }
      })(),
    );
    return;
  }

  // Everything else: straight to the network (no caching).
});
