const SHELL_CACHE = "nilestock-shell-v10-3-3";
const STATIC_CACHE = "nilestock-static-v10-3-3";

const CORE = [
  "/",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        Promise.all(
          CORE.map((url) =>
            cache.add(url).catch(() => undefined),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("nilestock-") &&
                key !== SHELL_CACHE &&
                key !== STATIC_CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) return;

  // Navigation: prefer latest online page.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(SHELL_CACHE);
            await cache.put(event.request, response.clone());

            if (url.pathname === "/") {
              await cache.put("/", response.clone());
            }
          }

          return response;
        })
        .catch(async () => {
          return (
            (await caches.match(event.request, {
              ignoreSearch: true,
            })) ||
            (await caches.match("/")) ||
            Response.error()
          );
        }),
    );

    return;
  }

  const staticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname.startsWith("/icon-") ||
    url.pathname === "/apple-touch-icon.png" ||
    url.pathname === "/og-image.png";

  if (!staticAsset) return;

  // Network first prevents old PWA chunks from surviving deployments.
  event.respondWith(
    fetch(event.request)
      .then(async (response) => {
        if (response.ok) {
          const cache = await caches.open(STATIC_CACHE);
          await cache.put(event.request, response.clone());
        }

        return response;
      })
      .catch(async () => {
        return (
          (await caches.match(event.request)) ||
          Response.error()
        );
      }),
  );
});
