import type { CapacitorConfig } from "@capacitor/cli";

/**
 * 单机版 App 外壳
 *
 * 打包内容来自 `next build` 的静态导出（../out），运行时：
 * - 页面与数据全部在本机，不联网也能打开
 * - 只有调用 AI 时才需要网络
 *
 * CapacitorHttp：把 fetch 换成原生请求，绕开浏览器的跨域限制。
 * 否则手机直连大模型服务商时，多数接口会被 CORS 拦掉。
 */
const config: CapacitorConfig = {
  appId: "com.mindscape.app",
  appName: "读心术",
  webDir: "../out",
  android: {
    // 允许 http 明文，便于在正式域名前用局域网地址调试
    allowMixedContent: true,
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
