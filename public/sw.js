const SHELL_CACHE = "nilestock-shell-v10-3-2";
const STATIC_CACHE = "nilestock-static-v10-3-2";
const CORE = [
  "/",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

async function precacheShell() {
  const shell = await caches.open(SHELL_CACHE);
  await Promise.all(CORE.slice(1).map((url) => shell.add(url).catch(() => undefined)));
  try {
    const response = await fetch("/", { cache: "reload" });
    if (!response.ok) return;
    await shell.put("/", response.clone());
    const html = await response.text();
    const urls = [...html.matchAll(/(?:src|href)=["']([^"']*\/_next\/static\/[^"']+)["']/g)]
      .map((match) => match[1])
      .filter((url, index, all) => all.indexOf(url) === index);
    const staticCache = await caches.open(STATIC_CACHE);
    await Promise.all(urls.map((url) => staticCache.add(url).catch(() => undefined)));
  } catch {}
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheShell().then(() => self.skipWaiting()));
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

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(SHELL_CACHE);
            await cache.put("/", response.clone());
          }
          return response;
        })
        .catch(async () => (await caches.match(event.request)) || (await caches.match("/")) || Response.error()),
    );
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname.startsWith("/icon-") ||
    url.pathname === "/apple-touch-icon.png" ||
    url.pathname === "/og-image.png"
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(STATIC_CACHE);
            await cache.put(event.request, response.clone());
          }
          return response;
        });
      }),
    );
  }
});
