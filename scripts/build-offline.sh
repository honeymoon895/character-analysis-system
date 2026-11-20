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
# 必须挪到 src 之外：留在 src 里仍会被类型检查扫到，
# 而单机构建环境可能没有生成 Prisma 客户端，服务端文件会报类型错误
STASH=".offline-stash/api"

restore() {
  if [ -d "$STASH" ]; then
    mv "$STASH" "$API"
  fi
}
trap restore EXIT

if [ -d "$API" ]; then
  mkdir -p "$(dirname "$STASH")"
  mv "$API" "$STASH"
fi

# 服务端工具文件（src/lib/db.ts 等）依赖 Prisma 生成的类型，
# 干净的 CI 机器上可能没生成过，类型检查会失败。生成不需要连数据库。
echo "→ 生成 Prisma 客户端类型"
npx prisma generate >/dev/null

echo "→ 开始静态导出（NEXT_PUBLIC_OFFLINE=1）"
NEXT_PUBLIC_OFFLINE=1 npx next build

if [ -d "out" ]; then
  echo "✓ 导出完成：out/"
else
  echo "✗ 没有生成 out/，请检查上面的构建日志"
  exit 1
fi
