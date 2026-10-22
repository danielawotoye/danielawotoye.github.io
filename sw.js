/* Haul service worker
   Network-first: when you're online, you always get the newest version
   from GitHub. Every successful response is also saved to a cache, and
   when you're offline the app loads from that saved copy instead. */

const CACHE = "haul-v1"; // bump this (haul-v2, ...) if you ever need to wipe old caches

// Files saved the moment the app is installed, so it works offline right away.
const CORE = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)));
  self.skipWaiting(); // use the new worker immediately instead of waiting for tabs to close
});

self.addEventListener("activate", (event) => {
  // delete caches from older versions
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        // save a copy of anything that loaded (including the Google Fonts files)
        if (res && (res.ok || res.type === "opaque")) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => {
          if (hit) return hit;
          // offline and never saved: for a page load, fall back to the app itself
          if (req.mode === "navigate") return caches.match("./index.html");
          return Response.error();
        })
      )
  );
});
