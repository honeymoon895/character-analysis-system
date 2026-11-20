import type { NextConfig } from "next";

/**
 * 两种构建：
 * - 默认：完整云端版（Next 服务 + API 路由 + 数据库）
 * - NEXT_PUBLIC_OFFLINE=1：单机版，静态导出到 out/，被打进 APK
 */
const offline = process.env.NEXT_PUBLIC_OFFLINE === "1";

const nextConfig: NextConfig = offline
  ? {
      output: "export",
      // 静态托管下 /a/b 需要落成 a/b/index.html，Capacitor 才能正确命中
      trailingSlash: true,
      images: { unoptimized: true },
      // 单机版没有服务端，导出时不需要额外产物
      cleanDistDir: true,
    }
  : {};

export default nextConfig;
