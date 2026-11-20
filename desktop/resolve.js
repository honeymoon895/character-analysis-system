/**
 * 把 app://local/xxx 映射到打包进来的静态文件
 *
 * Next 静态导出（trailingSlash）的产物规则：
 *   /            → index.html
 *   /me/         → me/index.html
 *   /me          → me/index.html（用户刷新、或链接没带斜杠时）
 *   /_next/...   → 原样
 * 查询串（?id=3、?_rsc=...）只给页面脚本用，找文件时忽略。
 *
 * 单独成文件是为了能脱离 Electron 做单元测试。
 */
const path = require("node:path");
const fs = require("node:fs");

function isFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

/**
 * @param {string} root   静态文件根目录
 * @param {string} rawUrl 完整请求地址
 * @returns {{ file: string, status: number }}
 */
function resolveRequest(root, rawUrl) {
  let pathname = "/";
  try {
    pathname = decodeURIComponent(new URL(rawUrl).pathname || "/");
  } catch {
    pathname = "/";
  }

  const base = path.resolve(root);
  const target = path.resolve(base, "." + pathname);

  // 防目录穿越：解析后必须仍在根目录内
  if (target !== base && !target.startsWith(base + path.sep)) {
    return { file: path.join(base, "404.html"), status: 404 };
  }

  const candidates = [];
  if (pathname.endsWith("/")) {
    candidates.push(path.join(target, "index.html"));
  } else {
    candidates.push(target);
    if (!path.extname(target)) {
      candidates.push(path.join(target, "index.html"));
      candidates.push(target + ".html");
    }
  }

  for (const c of candidates) {
    if (isFile(c)) return { file: c, status: 200 };
  }
  return { file: path.join(base, "404.html"), status: 404 };
}

module.exports = { resolveRequest };
