#!/usr/bin/env bash
#
# 构建单机版（APK 用的静态包）
#
# 为什么要搬走 src/app/api：
#   Next 的静态导出只支持 GET 形式的 Route Handler，
#   我们的接口里有大量 POST/PATCH/DELETE，直接导出会构建失败。
#   单机版本来就不需要这些接口（请求都走本地实现），
#   所以构建期间临时移出，结束后无论成功失败都恢复。
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

API="src/app/api"
STASH="src/app/__server_api"

restore() {
  if [ -d "$STASH" ]; then
    mv "$STASH" "$API"
  fi
}
trap restore EXIT

if [ -d "$API" ]; then
  mv "$API" "$STASH"
fi

echo "→ 开始静态导出（NEXT_PUBLIC_OFFLINE=1）"
NEXT_PUBLIC_OFFLINE=1 npx next build

if [ -d "out" ]; then
  echo "✓ 导出完成：out/"
else
  echo "✗ 没有生成 out/，请检查上面的构建日志"
  exit 1
fi
