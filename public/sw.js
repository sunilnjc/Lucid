// Only build-owned public files belong in this cache. Learning/auth/SSR responses never do.
const CACHE_NAME = "lucid-public-v4-dev";
const PRECACHE_URLS = ["/app-shell.html", "/manifest.webmanifest", "/icons/lucid-192.png", "/icons/lucid-512.png", "/icons/lucid-maskable-512.png", "/icons/apple-touch-icon.png"];
const PUBLIC_PATHS = new Set(PRECACHE_URLS);
function publicRequest(request) {
  const url = new URL(request.url);
  return request.method === "GET" && url.origin === self.location.origin && !url.search &&
    !request.headers.has("authorization") && PUBLIC_PATHS.has(url.pathname);
}
function safePublicResponse(path, response) {
  if (!response.ok || response.type === "opaque" || /no-store|private/i.test(response.headers.get("cache-control") ?? "")) return false;
  const type = response.headers.get("content-type") ?? "";
  if (path === "/app-shell.html") return type.includes("text/html");
  return !type.includes("text/html");
}
// Static hosts can canonicalize .html with a followed redirect. Navigation
// requests use redirect:manual, so store a fresh public response without that
// network redirect metadata; keep the original network response out of caches.
async function publicCacheCopy(path, response) {
  if (path !== "/app-shell.html") return response;
  const copy = new Response(await response.text(), { status: response.status, statusText: response.statusText, headers: response.headers });
  for (const header of ["content-encoding", "content-length", "transfer-encoding"]) copy.headers.delete(header);
  return copy;
}
self.addEventListener("install", (event) => {
  // A failed precache leaves the previous version usable. Updates wait for a safe user action.
  event.waitUntil(caches.open(CACHE_NAME).then(async (cache) => {
    await Promise.all(PRECACHE_URLS.map(async (path) => {
      const response = await fetch(new Request(new URL(path, self.location.origin), { credentials: "omit", cache: "reload" }));
      if (!safePublicResponse(path, response)) throw new Error("Lucid could not cache its public app file: " + path);
      if (path === "/app-shell.html" && !(await response.clone().text()).includes('name="lucid-public-shell"')) throw new Error("Refusing to cache a dynamic document.");
      await cache.put(path, await publicCacheCopy(path, response));
    }));
  }).catch(async (error) => { await caches.delete(CACHE_NAME); throw error; }));
});
self.addEventListener("message", (event) => {
  if (!event.source?.id || !["LUCID_ACTIVATE_UPDATE", "LUCID_OFFLINE_STATUS"].includes(event.data?.type)) return;
  event.waitUntil(self.clients.get(event.source.id).then(async (client) => {
    if (!client || new URL(client.url).origin !== self.location.origin) return;
    if (event.data.type === "LUCID_ACTIVATE_UPDATE") return self.skipWaiting();
    const port = event.ports?.[0]; if (!port) return;
    try {
      const cache = await caches.open(CACHE_NAME);
      // Development's transformed source graph is not a complete offline build.
      const hasClientGraph = PRECACHE_URLS.some((path) => path.endsWith(".js")) && PRECACHE_URLS.some((path) => path.endsWith(".css"));
      const complete = await Promise.all(PRECACHE_URLS.map(async (path) => {
        const response = await cache.match(path);
        return Boolean(response && safePublicResponse(path, response) && (path !== "/app-shell.html" || !response.redirected && (await response.clone().text()).includes('name="lucid-public-shell"')));
      }));
      port.postMessage({ type: "LUCID_OFFLINE_STATUS", ready: hasClientGraph && complete.every(Boolean) });
    } catch { port.postMessage({ type: "LUCID_OFFLINE_STATUS", ready: false }); }
  }));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((names) => {
    // Keep the previous public release for a still-open tab; purge legacy/shared caches.
    const previous = names.filter((name) => name.startsWith("lucid-public-v4-") && name !== CACHE_NAME).at(-1);
    return Promise.all(names.filter((name) => name.startsWith("lucid-") && name !== CACHE_NAME && name !== previous).map((name) => caches.delete(name)));
  }).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/") || request.headers.has("authorization")) return;
  if (request.mode === "navigate") {
    // Only supported app queries may use the public shell. Never cache a navigation response.
    const languages = url.searchParams.getAll("lang");
    if (!["/", "/app-shell.html"].includes(url.pathname) || [...url.searchParams.keys()].some((key) => !["view", "source", "lang"].includes(key)) ||
      languages.length > 1 || languages.some((language) => !["en", "ko"].includes(language))) return;
    event.respondWith(fetch(request).catch(async () => (await caches.open(CACHE_NAME)).match("/app-shell.html").then((shell) => shell ?? new Response("Lucid needs one online visit to prepare offline practice.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } }))));
    return;
  }
  if (!publicRequest(request)) return;
  event.respondWith(fetch(new Request(request.url, { credentials: "omit" })).then((response) => {
    if (safePublicResponse(url.pathname, response)) { const copy = response.clone(); event.waitUntil(publicCacheCopy(url.pathname, copy).then((publicCopy) => caches.open(CACHE_NAME).then((cache) => cache.put(url.pathname, publicCopy)))); }
    return response;
  }).catch(async () => (await caches.match(url.pathname)) ?? Response.error()));
});
