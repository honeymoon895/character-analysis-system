/*
 * Service Worker
 *
 * 策略刻意保守：
 * - 只缓存静态资源（JS/CSS/字体/图标），它们文件名带 hash，可以放心长期缓存。
 * - 页面导航用 network-first，离线时回退到缓存，绝不把旧的分析结果顶给用户。
 * - **所有 /api 请求一律不缓存**：人格研判、对话、密钥校验都依赖实时数据，
 *   缓存它们会造成"看起来有结果其实是旧的"这种最糟糕的体验。
 */

const VERSION = "v1";
const STATIC_CACHE = `mindscape-static-${VERSION}`;
const PAGES_CACHE = `mindscape-pages-${VERSION}`;

/** 安装后立刻接管，跳过 waiting */
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(["/manifest.webmanifest"]).catch(() => {})
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.endsWith(VERSION))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:css|js|woff2?|ttf|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // 只处理 GET；POST（分析、对话）直接走网络，不拦截
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // 跨域一律不碰
  if (url.origin !== self.location.origin) return;

  // API 永不缓存
  if (url.pathname.startsWith("/api/")) return;

  // 静态资源：cache-first
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (res.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(req, res.clone());
          }
          return res;
        } catch {
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // 页面导航：network-first，离线回退缓存
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok) {
            const cache = await caches.open(PAGES_CACHE);
            cache.put(req, res.clone());
          }
          return res;
        } catch {
          const cached = await caches.match(req);
          if (cached) return cached;
          // 兜底：任何已缓存的页面都比浏览器的断网页好
          const any = await caches.match("/");
          return any || Response.error();
        }
      })()
    );
  }
});
