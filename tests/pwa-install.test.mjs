import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { createServer } from "node:http";

const root = new URL("../", import.meta.url);
const code = stripTypeScriptTypes(await readFile(new URL("lib/pwa-install.ts", root), "utf8"));
const install = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const sw = await readFile(new URL("public/sw.js", root), "utf8");
function device(options = {}) {
  const listeners = new Map(); let isStandalone = options.standalone ?? false, dismissed = false;
  const controller = install.createInstallController({
    userAgent: options.userAgent ?? "Chrome/140", platform: options.platform, maxTouchPoints: options.maxTouchPoints,
    standalone: () => isStandalone, getDismissed: () => dismissed, setDismissed: (value) => { dismissed = value; },
    listen(name, listener) { listeners.set(name, listener); return () => listeners.delete(name); },
  });
  return { controller, emit: (name, event = {}) => listeners.get(name)?.(event), setStandalone: (value) => { isStandalone = value; }, listeners };
}
function serviceWorker(source = sw, publicFetch) {
  const events = new Map(), records = new Map();
  const network = { offline: false, personal: "learner-A", failPath: null, calls: [] };
  const fixtures = {
    async fetch(request) {
      const url = new URL(typeof request === "string" ? request : request.url); network.calls.push({ path: url.pathname, url: url.href, credentials: request.credentials });
      if (network.offline || network.failPath === url.pathname) throw new Error("Fixture disconnected");
      if (url.pathname === "/app-shell.html") return new Response('<meta name="lucid-public-shell" content="v1"><main id="lucid-offline-root">PUBLIC-SHELL</main>', { headers: { "Content-Type": "text/html" } });
      if (url.pathname === "/") return new Response(network.personal, { headers: { "Content-Type": "text/html", "Cache-Control": "private, no-store" } });
      return new Response("PUBLIC-ASSET", { headers: { "Content-Type": url.pathname.endsWith(".png") ? "image/png" : "application/json" } });
    },
  };
  const cacheKey = (value) => new URL(typeof value === "string" ? value : value.url, "https://lucid.test").pathname;
  const caches = {
    async open(name) {
      if (!records.has(name)) records.set(name, new Map());
      const entries = records.get(name);
      return { async put(key, response) { entries.set(cacheKey(key), response.clone()); }, async match(key) { return entries.get(cacheKey(key))?.clone(); } };
    },
    async keys() { return [...records.keys()]; },
    async delete(name) { return records.delete(name); },
    async match(key) { for (const entries of records.values()) if (entries.has(cacheKey(key))) return entries.get(cacheKey(key)).clone(); },
  };
  let skipped = 0, claimed = 0;
  const self = {
    location: { origin: "https://lucid.test" },
    addEventListener: (name, callback) => events.set(name, callback),
    skipWaiting: async () => { skipped++; },
    clients: { claim: async () => { claimed++; }, get: async (id) => id === "same-origin" ? { url: "https://lucid.test/" } : { url: "https://unrelated.test/" } },
  };
  runInNewContext(source, { self, caches, fetch: publicFetch ?? fixtures.fetch, Request, Response, URL, Set, Promise });
  async function emit(name, fields = {}) {
    const pending = []; let response;
    events.get(name)({ ...fields, waitUntil: (promise) => pending.push(promise), respondWith: (promise) => { response = promise; } });
    if (response) response = await response;
    while (pending.length) await Promise.all(pending.splice(0));
    return response;
  }
  function request(path, overrides = {}) { return { url: new URL(path, "https://lucid.test").href, method: "GET", headers: new Headers(), mode: "cors", destination: "", ...overrides }; }
  return { emit, request, records, network, caches, skipped: () => skipped, claimed: () => claimed };
}

test("iPhone, iPad desktop UA and browser-specific install guidance are honest", () => {
  assert.equal(install.installPlatform("Mozilla iPhone CriOS/140"), "ios");
  assert.equal(install.installPlatform("Mozilla Macintosh Safari/26", "MacIntel", 5), "ios");
  assert.equal(install.installPlatform("Mozilla Macintosh Safari/26"), "mac-safari");
  assert.equal(install.installPlatform("Android Chrome/140"), "android");
  assert.equal(install.installPlatform("Windows Edg/140"), "chromium");
  assert.equal(install.installPlatform("Firefox/140"), "other");
  const guide = install.installGuidance("ios");
  assert.match(guide.steps.join(" "), /Share.*Add to Home Screen.*Open as Web App.*Add/);
  assert.match(guide.note, /cannot add an icon by itself/);
  assert.match(install.installGuidance("mac-safari").steps.join(" "), /File.*Add to Dock/);
  assert.match(install.installGuidance("other").note, /Installation is optional/);
});
test("install prompt needs the browser event and is consumed exactly once, including repeated taps", async () => {
  const fixture = device(); assert.equal(await fixture.controller.install(), "guidance");
  let prompts = 0, prevented = 0, resolve;
  const result = new Promise((done) => { resolve = done; });
  fixture.emit("beforeinstallprompt", { preventDefault() { prevented++; }, async prompt() { prompts++; return result; } });
  assert.equal(fixture.controller.snapshot().phase, "available");
  const pending = fixture.controller.install();
  assert.equal(await fixture.controller.install(), "busy");
  resolve({ outcome: "accepted" }); assert.equal(await pending, "accepted");
  assert.equal(fixture.controller.snapshot().phase, "requested", "accepting a prompt is not evidence the OS completed installation");
  assert.equal(await fixture.controller.install(), "guidance");
  assert.equal(prompts, 1); assert.equal(prevented, 1);
});
test("appinstalled and standalone evidence supersede pending prompt, suppressing another install", async () => {
  const fixture = device(); let resolve;
  fixture.emit("beforeinstallprompt", { preventDefault() {}, prompt: () => new Promise((done) => { resolve = done; }) });
  const pending = fixture.controller.install(); fixture.emit("appinstalled"); resolve({ outcome: "accepted" });
  assert.equal(await pending, "installed"); assert.equal(fixture.controller.snapshot().phase, "installed");
  assert.equal(await fixture.controller.install(), "installed");
  const homeScreen = device({ standalone: true }); assert.equal(homeScreen.controller.snapshot().phase, "installed");
  const displayChange = device(); displayChange.setStandalone(true); displayChange.emit("displaychange"); assert.equal(displayChange.controller.snapshot().phase, "installed");
});
test("dismissed or failed installation never blocks learning and a new browser event can retry", async () => {
  const fixture = device();
  fixture.emit("beforeinstallprompt", { preventDefault() {}, prompt: async () => undefined, userChoice: Promise.resolve({ outcome: "dismissed" }) });
  assert.equal(await fixture.controller.install(), "dismissed"); assert.equal(fixture.controller.snapshot().compact, true);
  fixture.emit("beforeinstallprompt", { preventDefault() {}, prompt: async () => { throw new Error("Browser policy"); } });
  assert.equal(await fixture.controller.install(), "guidance"); assert.match(fixture.controller.snapshot().error, /browser.*menu/);
  fixture.controller.dispose(); assert.equal(fixture.listeners.size, 0);
});
test("update reload rechecks local saving after asynchronous preparation and fails closed", async () => {
  let safe = true, resolve, preparations = 0;
  const pending = install.prepareAppReload(() => safe, () => { preparations++; return new Promise((done) => { resolve = done; }); });
  safe = false; resolve(true); assert.equal(await pending, false); assert.equal(preparations, 1);
  assert.equal(await install.prepareAppReload(() => false, () => { preparations++; return true; }), false);
  assert.equal(preparations, 1);
  assert.equal(await install.prepareAppReload(() => true, () => { throw new Error("Local disk full"); }), false);
  assert.equal(await install.prepareAppReload(() => true, () => true), true);
});
test("manifest has stable identity, standalone launch, full-size and genuinely padded maskable icons", async () => {
  const manifest = JSON.parse(await readFile(new URL("public/manifest.webmanifest", root), "utf8"));
  assert.equal(manifest.id, "/"); assert.equal(manifest.start_url, "/"); assert.equal(manifest.scope, "/"); assert.equal(manifest.display, "standalone");
  for (const size of [192, 512]) {
    const icon = manifest.icons.find((icon) => icon.sizes === `${size}x${size}` && icon.purpose === "any");
    assert.ok(icon); const png = await readFile(new URL("public" + icon.src, root));
    assert.equal(png.readUInt32BE(16), size); assert.equal(png.readUInt32BE(20), size);
  }
  const maskable = manifest.icons.find((icon) => icon.purpose === "maskable");
  assert.ok(maskable); const png = await readFile(new URL("public" + maskable.src, root)); assert.equal(png.readUInt32BE(16), 512);
  assert.notEqual(maskable.src, manifest.icons.find((icon) => icon.sizes === "512x512" && icon.purpose === "any").src);
});
test("actual React install UI renders an accessible action and guidance without claiming installation", async () => {
  let { outputText } = ts.transpileModule(await readFile(new URL("app/PWAInstall.tsx", root), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } });
  outputText = outputText.replaceAll('"../lib/pwa-install"', JSON.stringify(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`))
    .replaceAll('"react"', JSON.stringify(import.meta.resolve("react"))).replaceAll('"react/jsx-runtime"', JSON.stringify(import.meta.resolve("react/jsx-runtime")));
  const { default: Component } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
  const html = renderToStaticMarkup(React.createElement(Component, { canReload: true }));
  assert.match(html, /<button[^>]*>Install app<\/button>/);
  assert.match(html, /<dialog[^>]*aria-labelledby="pwa-guidance-title"/);
  assert.match(html, /Preparing this browser for offline practice/); assert.match(html, /data-offline-ready="false"/);
  assert.match(html, /same Lucid account/); assert.match(html, /separate local storage/);
  assert.doesNotMatch(html, /installed successfully|download complete|pushManager|requestPermission/);
});
test("service worker precaches only public assets without credentials and waits for a trusted update action", async () => {
  const fixture = serviceWorker(); await fixture.emit("install");
  assert.ok(fixture.network.calls.every((call) => call.credentials === "omit"));
  assert.equal(fixture.skipped(), 0, "install never forces a new version into an active session");
  await fixture.emit("message", { data: { type: "LUCID_ACTIVATE_UPDATE" }, source: { id: "unrelated" } }); assert.equal(fixture.skipped(), 0);
  await fixture.emit("message", { data: { type: "LUCID_ACTIVATE_UPDATE" }, source: { id: "same-origin" } }); assert.equal(fixture.skipped(), 1);
});
test("account switching and offline deep-link reload use the public shell, never cached learner HTML", async () => {
  const fixture = serviceWorker(); await fixture.emit("install");
  const a = await fixture.emit("fetch", { request: fixture.request("/", { mode: "navigate" }) }); assert.equal(await a.text(), "learner-A");
  fixture.network.personal = "learner-B";
  const b = await fixture.emit("fetch", { request: fixture.request("/", { mode: "navigate" }) }); assert.equal(await b.text(), "learner-B");
  fixture.network.offline = true;
  const shell = await fixture.emit("fetch", { request: fixture.request("/?view=express#notebook", { mode: "navigate" }) });
  assert.match(await shell.text(), /PUBLIC-SHELL/);
  for (const records of fixture.records.values()) for (const response of records.values()) assert.doesNotMatch(await response.clone().text(), /learner-A|learner-B/);
});
test("supported learning language URLs use only the public shell when offline", async () => {
  const fixture = serviceWorker(); await fixture.emit("install");
  fixture.network.offline = true;
  for (const path of ["/", "/app-shell.html"]) {
    for (const query of ["?lang=en", "?lang=ko", "?source=landing&lang=ko", "?view=practice&lang=en", "?lang=ko&source=landing&view=progress#saved", "?view=express&source=landing&lang=en"]) {
      const response = await fixture.emit("fetch", { request: fixture.request(path + query, { mode: "navigate" }) });
      assert.ok(response, path + query); assert.equal(response.status, 200);
      assert.match(await response.text(), /PUBLIC-SHELL/);
    }
  }
  for (const entries of fixture.records.values()) {
    assert.equal(entries.has("/"), false, "navigation is never written into the public cache");
    assert.ok([...entries.keys()].every((path) => !path.includes("?")));
  }
});
test("learning language navigation keeps the original online URL and never caches learner HTML", async () => {
  const fixture = serviceWorker(); await fixture.emit("install");
  for (const [path, learner] of [["/?lang=en&view=progress", "learner-A"], ["/?source=landing&lang=ko", "learner-B"]]) {
    fixture.network.personal = learner;
    const response = await fixture.emit("fetch", { request: fixture.request(path, { mode: "navigate" }) });
    assert.equal(await response.text(), learner);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(fixture.network.calls.at(-1).url, new URL(path, "https://lucid.test").href);
  }
  fixture.network.offline = true;
  const response = await fixture.emit("fetch", { request: fixture.request("/?lang=ko&view=progress", { mode: "navigate" }) });
  assert.match(await response.text(), /PUBLIC-SHELL/);
  for (const entries of fixture.records.values()) for (const cached of entries.values()) assert.doesNotMatch(await cached.clone().text(), /learner-A|learner-B/);
});
test("learning language queries never broaden private, malformed or unsupported navigation caching", async () => {
  const fixture = serviceWorker(); await fixture.emit("install");
  const calls = fixture.network.calls.length; fixture.network.offline = true;
  for (const path of [
    "/?lang=", "/?lang=fr", "/?lang=KO", "/?lang=ko%20", "/?lang=%20en", "/?lang=ko&lang=en", "/?lang=ko&lang=ko",
    "/?lang=en&lang=", "/?lang=ko&code=one-time", "/?lang=ko&token=private", "/?lang=en&access_token=private", "/?lang=ko&state=private",
    "/?lang=ko&_rsc=private", "/?lang=ko&unknown=value", "/?lang=ko&Lang=en", "/account/callback?lang=ko", "/api/state?lang=ko",
    "/api/account/status?lang=en", "/api/account/verify?lang=ko", "/start?lang=ko", "/ko?lang=ko", "/app-shell?lang=ko", "https://provider.test/?lang=ko",
  ]) {
    assert.equal(await fixture.emit("fetch", { request: fixture.request(path, { mode: "navigate" }) }), undefined, path);
  }
  for (const overrides of [{ method: "POST" }, { headers: new Headers({ Authorization: "Bearer fixture-only" }) }]) {
    assert.equal(await fixture.emit("fetch", { request: fixture.request("/?lang=ko", { mode: "navigate", ...overrides }) }), undefined);
  }
  assert.equal(await fixture.emit("fetch", { request: fixture.request("/icons/lucid-192.png?lang=ko") }), undefined);
  assert.equal(fixture.network.calls.length, calls, "excluded requests do not reach the worker's network or cache path");
});
test("fresh offline learning language URLs retain the no-store missing-shell explanation", async () => {
  const fixture = serviceWorker(); fixture.network.offline = true;
  for (const language of ["en", "ko"]) {
    const response = await fixture.emit("fetch", { request: fixture.request("/?lang=" + language, { mode: "navigate" }) });
    assert.equal(response.status, 503); assert.equal(response.headers.get("cache-control"), "no-store");
    assert.match(await response.text(), /one online visit/);
  }
});
test("authenticated APIs, token redirects, RSC documents and arbitrary images never enter SW caches", async () => {
  const fixture = serviceWorker(); await fixture.emit("install");
  for (const path of ["/api/state", "/api/account/status", "/api/account/verify", "/?code=one-time-token", "/?_rsc=private", "/account/callback", "/private-image.png", "https://provider.test/rest/v1/state"]) {
    const response = await fixture.emit("fetch", { request: fixture.request(path, { mode: "navigate" }) });
    assert.equal(response, undefined, path);
  }
  assert.equal(await fixture.emit("fetch", { request: fixture.request("/icons/lucid-192.png", { headers: new Headers({ Authorization: "Bearer fixture-only" }) }) }), undefined);
  assert.equal(await fixture.emit("fetch", { request: fixture.request("/api/state", { method: "POST" }) }), undefined);
  assert.equal(fixture.network.calls.length, 6);
});
test("interrupted SW installation retains the existing release and does not force activation", async () => {
  const fixture = serviceWorker();
  (await fixture.caches.open("lucid-public-v4-previous")).put("/app-shell.html", new Response("PREVIOUS"));
  fixture.network.failPath = "/icons/lucid-512.png";
  await assert.rejects(fixture.emit("install"), /disconnected/);
  assert.ok(fixture.records.has("lucid-public-v4-previous")); assert.equal(fixture.skipped(), 0);
});
test("SW activation removes legacy caches while preserving the previous public version for open tabs", async () => {
  const fixture = serviceWorker();
  await fixture.caches.open("lucid-old-account-pages"); await fixture.caches.open("unrelated-app-cache"); await fixture.caches.open("lucid-public-v4-previous");
  await fixture.emit("install"); await fixture.emit("activate");
  assert.equal(fixture.records.has("lucid-old-account-pages"), false); assert.equal(fixture.records.has("unrelated-app-cache"), true);
  assert.equal(fixture.records.has("lucid-public-v4-previous"), true); assert.equal(fixture.claimed(), 1);
});
test("fresh offline launch explains missing public shell instead of returning a learner page", async () => {
  const fixture = serviceWorker(); fixture.network.offline = true;
  const response = await fixture.emit("fetch", { request: fixture.request("/", { mode: "navigate" }) });
  assert.equal(response.status, 503); assert.match(await response.text(), /one online visit/);
});
test("production PWA shell and versioned precache cover emitted public client code", async (context) => {
  let source, shell;
  try { source = await readFile(new URL("dist/client/sw.js", root), "utf8"); shell = await readFile(new URL("dist/client/app-shell.html", root), "utf8"); }
  catch (error) { if (error.code === "ENOENT") { context.skip("Requires successful production build; source worker tests still run."); return; } throw error; }
  assert.match(source, /lucid-public-v4-[0-9a-f]{16}/);
  assert.match(shell, /name="lucid-public-shell"/);
  assert.match(shell, /viewport-fit=cover/);
  assert.doesNotMatch(shell, /__NEXT_DATA__|accessToken|learnerIdentity|lucid-learning-v3/);
  const script = shell.match(/<script type="module" src="([^"]+)"/)?.[1]; assert.ok(script);
  const precache = JSON.parse(source.match(/const PRECACHE_URLS = (\[[^;]+);/)[1]); assert.ok(precache.includes(script));
  assert.ok(precache.some((path) => path.endsWith(".css")));
  assert.ok(precache.every((path) => !path.includes("/api/") && !path.includes("?") && !path.includes(".map")));
  for (const path of precache) await readFile(new URL("dist/client" + path, root));
  const fixture = serviceWorker(source); await fixture.emit("install"); fixture.network.offline = true;
  for (const path of ["/?lang=en", "/?source=landing&lang=ko", "/?lang=ko&view=progress"]) {
    const response = await fixture.emit("fetch", { request: fixture.request(path, { mode: "navigate" }) });
    assert.ok(response, "the emitted production worker must handle " + path);
    assert.equal(response.status, 200); assert.match(await response.text(), /PUBLIC-SHELL/);
  }
});

// Generator-level fixtures are deliberately separate from the actual Vite build assertion above.
test("public shell generator excludes server environments and emits a versioned client-only offline build", async () => {
  const source = stripTypeScriptTypes(await readFile(new URL("build/pwa-vite-plugin.ts", root), "utf8"));
  const { lucidPwa } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
  const directory = await mkdtemp(join(tmpdir(), "lucid-pwa-generator-"));
  try {
    await mkdir(join(directory, "public")); await mkdir(join(directory, "dist/client"), { recursive: true });
    await writeFile(join(directory, "public/sw.js"), sw);
    const plugin = lucidPwa(); plugin.configResolved({ root: directory, command: "build" });
    const outputs = [];
    const context = { environment: { name: "rsc" }, emitFile(value) { outputs.push(value); } };
    plugin.buildStart.call(context); plugin.generateBundle.call(context, {}, {}); assert.equal(outputs.length, 0);
    context.environment.name = "client"; plugin.buildStart.call(context);
    assert.equal(outputs[0].id, join(directory, "app/pwa-entry.tsx"));
    const bundle = {
      "_next/static/pwa-fixed.js": { type: "chunk", name: "lucid-pwa-app", fileName: "_next/static/pwa-fixed.js" },
      "_next/static/common.css": { type: "asset", fileName: "_next/static/common.css" },
      "_next/static/pwa-fixed.js.map": { type: "asset", fileName: "_next/static/pwa-fixed.js.map" },
    };
    plugin.generateBundle.call(context, {}, bundle);
    const shell = outputs.find((value) => value.fileName === "app-shell.html");
    assert.ok(shell); assert.match(shell.source, /lucid-public-shell/); assert.match(shell.source, /pwa-fixed\.js/);
    assert.match(shell.source, /common\.css/); assert.doesNotMatch(shell.source, /learner|accessToken|__NEXT_DATA__/);
    await plugin.closeBundle.handler.call(context);
    const built = await readFile(join(directory, "dist/client/sw.js"), "utf8");
    assert.match(built, /lucid-public-v4-[0-9a-f]{16}/); assert.match(built, /pwa-fixed\.js/); assert.doesNotMatch(built, /pwa-fixed\.js\.map/);
    await plugin.closeBundle.handler.call(context);
    assert.equal(await readFile(join(directory, "dist/client/sw.js"), "utf8"), built, "same public inputs produce the same cache version");
    await writeFile(join(directory, "public/sw.js"), sw + "\n// Fixture: changed public worker.\n");
    await plugin.closeBundle.handler.call(context);
    const changed = await readFile(join(directory, "dist/client/sw.js"), "utf8");
    assert.notEqual(changed.match(/const CACHE_NAME = "([^"]+)"/)[1], built.match(/const CACHE_NAME = "([^"]+)"/)[1], "a worker correction must create a new release cache");
  } finally { await rm(directory, { recursive: true, force: true }); }
});


test("development serves the public shell without calling unsupported chunk/asset emission", async () => {
  const source = stripTypeScriptTypes(await readFile(new URL("build/pwa-vite-plugin.ts", root), "utf8"));
  const { lucidPwa } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
  const plugin = lucidPwa(); plugin.configResolved({ root: root.pathname, command: "serve" });
  const context = { environment: { name: "client" }, emitFile() { assert.fail("Vite serve must never emit build chunks or assets"); } };
  plugin.buildStart.call(context); plugin.generateBundle.call(context, {}, {}); await plugin.closeBundle.handler.call(context);
  let handler, transformed, output, error;
  plugin.configureServer({
    middlewares: { use(path, callback) { assert.equal(path, "/app-shell.html"); handler = callback; } },
    async transformIndexHtml(path, html) { transformed = { path, html }; return html; },
  });
  await handler({}, { setHeader(name, value) { assert.equal(name, "Content-Type"); assert.match(value, /text\/html/); }, end(value) { output = value; } }, (value) => { error = value; });
  assert.equal(error, undefined); assert.equal(transformed.path, "/app-shell.html");
  assert.match(output, /lucid-public-shell/); assert.match(output, /src="\/app\/pwa-entry\.tsx"/);
  assert.doesNotMatch(output, /accessToken|__NEXT_DATA__/);
});


test("offline readiness requires the current public client graph and every cached entry, rather than registration alone", async () => {
  const paths = ["/app-shell.html", "/manifest.webmanifest", "/icons/lucid-192.png", "/icons/lucid-512.png", "/icons/lucid-maskable-512.png", "/icons/apple-touch-icon.png", "/_next/static/chunks/app.js", "/_next/static/css/app.css"];
  const source = sw.replace(/const PRECACHE_URLS = \[[^;]+;/, `const PRECACHE_URLS = ${JSON.stringify(paths)};`);
  const fixture = serviceWorker(source), replies = [];
  const message = { data: { type: "LUCID_OFFLINE_STATUS" }, source: { id: "same-origin" }, ports: [{ postMessage(value) { replies.push(value); } }] };
  await fixture.emit("message", message); assert.equal(replies.at(-1).ready, false, "an empty cache cannot be ready");
  await fixture.emit("install"); await fixture.emit("activate"); await fixture.emit("message", message);
  assert.equal(replies.at(-1).ready, true);
  assert.deepEqual(Object.keys(replies.at(-1)).sort(), ["ready", "type"], "status exposes no account identity or cache contents");
  for (const entries of fixture.records.values()) entries.delete("/_next/static/chunks/app.js");
  await fixture.emit("message", message); assert.equal(replies.at(-1).ready, false, "an evicted app chunk must remove ready evidence");
  const count = replies.length;
  await fixture.emit("message", { ...message, source: { id: "unrelated" } }); assert.equal(replies.length, count);
});

test("a transformed development shell never advertises complete offline readiness without a bundled client graph", async () => {
  const fixture = serviceWorker(); await fixture.emit("install");
  let reply;
  await fixture.emit("message", { data: { type: "LUCID_OFFLINE_STATUS" }, source: { id: "same-origin" }, ports: [{ postMessage(value) { reply = value; } }] });
  assert.equal(reply.ready, false);
});


test("a real followed public-shell redirect is normalized before serving an offline manual navigation", async () => {
  const server = createServer((request, response) => {
    if (request.url === "/app-shell.html") { response.writeHead(307, { Location: "/app-shell" }); response.end(); return; }
    response.writeHead(200, { "Content-Type": request.url === "/app-shell" ? "text/html; charset=utf-8" : request.url.endsWith(".png") ? "image/png" : "application/json", "Cache-Control": "public, max-age=0, must-revalidate" });
    response.end(request.url === "/app-shell" ? '<meta name="lucid-public-shell" content="v1"><main>PUBLIC-OFFLINE-APP</main>' : "PUBLIC-ASSET");
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const raw = await fetch(origin + "/app-shell.html"); assert.equal(raw.redirected, true); assert.equal(raw.url, origin + "/app-shell");
    let offline = false;
    const fixture = serviceWorker(sw, async (request) => {
      if (offline) throw new Error("Synthetic server disconnected");
      return fetch(origin + new URL(typeof request === "string" ? request : request.url).pathname);
    });
    await fixture.emit("install"); await fixture.emit("activate"); offline = true;
    const result = await fixture.emit("fetch", { request: fixture.request("/?view=express", { mode: "navigate", redirect: "manual" }) });
    assert.equal(result.status, 200); assert.equal(result.redirected, false, "manual navigation must not receive followed-redirect metadata");
    assert.equal(result.url, ""); assert.match(await result.text(), /PUBLIC-OFFLINE-APP/);
    for (const entries of fixture.records.values()) for (const response of entries.values()) assert.doesNotMatch(await response.clone().text(), /learner-A|accessToken/);
  } finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
});
