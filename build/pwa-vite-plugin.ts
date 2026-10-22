import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";

const shell = (script: string, styles: string[] = []) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="lucid-public-shell" content="v1">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#062124"><meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Lucid"><link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<title>Lucid — Professional English</title>${styles.map((file) => `<link rel="stylesheet" href="/${file}">`).join("")}
</head><body><div id="lucid-offline-root"><p>Opening Lucid… If this view cannot load, reconnect and <a href="/">try again</a>. Your saved learning stays on this device.</p><noscript>Turn on JavaScript to open Lucid’s saved local practice.</noscript></div><script type="module" src="${script}"></script></body></html>`;

// The offline document is generated from public client code, never from an account request.
export function lucidPwa(): Plugin {
  let root = process.cwd();
  let isBuild = false;
  let clientBundle: Record<string, { type: string; fileName: string }> | null = null;
  return {
    name: "lucid-public-pwa", enforce: "post",
    configResolved(config) { root = config.root; isBuild = config.command === "build"; clientBundle = null; },
    configureServer(server) {
      server.middlewares.use("/app-shell.html", async (_request, response, next) => {
        try { response.setHeader("Content-Type", "text/html; charset=utf-8"); response.end(await server.transformIndexHtml("/app-shell.html", shell("/app/pwa-entry.tsx"))); }
        catch (error) { next(error); }
      });
    },
    buildStart() {
      if (isBuild && this.environment.name === "client") this.emitFile({ type: "chunk", id: resolve(root, "app/pwa-entry.tsx"), name: "lucid-pwa-app" });
    },
    generateBundle(_options, bundle) {
      if (!isBuild || this.environment.name !== "client") return;
      clientBundle = bundle;
      const entry = Object.values(bundle).find((file) => file.type === "chunk" && file.name === "lucid-pwa-app");
      if (!entry || entry.type !== "chunk") throw new Error("Lucid’s offline client entry was not emitted.");
      const styles = Object.values(bundle).filter((file) => file.type === "asset" && file.fileName.endsWith(".css")).map((file) => file.fileName);
      this.emitFile({ type: "asset", fileName: "app-shell.html", source: shell("/" + entry.fileName, styles) });
    },
    closeBundle: {
      sequential: true, order: "post",
      async handler() {
        if (!isBuild || this.environment.name !== "client" || !clientBundle) return;
        // All emitted client chunks are public code/assets. Eager caching also covers lazy feature imports.
        const paths = ["/app-shell.html", "/manifest.webmanifest", "/icons/lucid-192.png", "/icons/lucid-512.png", "/icons/lucid-maskable-512.png", "/icons/apple-touch-icon.png",
          ...Object.values(clientBundle).map((file) => "/" + file.fileName).filter((path) => path.startsWith("/_next/static/") && /\.(js|css|woff2?|png|svg)$/.test(path))];
        const source = await readFile(resolve(root, "public/sw.js"), "utf8");
        const version = createHash("sha256").update(source + paths.join("\n")).digest("hex").slice(0, 16);
        const worker = source.replace('const CACHE_NAME = "lucid-public-v4-dev";', `const CACHE_NAME = "lucid-public-v4-${version}";`)
          .replace(/const PRECACHE_URLS = \[[^;]+;/, `const PRECACHE_URLS = ${JSON.stringify([...new Set(paths)])};`);
        await writeFile(resolve(root, "dist/client/sw.js"), worker);
      },
    },
  };
}
