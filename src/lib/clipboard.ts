/**
 * 读取剪贴板
 *
 * 三种运行环境，读取方式各不相同：
 * - 安卓 APK：WebView 里的 navigator.clipboard.readText 基本不可用（没有权限弹窗），
 *   必须走原生插件 @capacitor/clipboard。插件只装在 mobile 外壳里，
 *   这里通过 Capacitor 全局对象访问，网页端不需要额外依赖。
 * - 桌面 Electron / 浏览器：navigator.clipboard.readText（需要安全上下文）
 * - 都不行时返回 null，调用方提示用户长按输入框粘贴
 */
export async function readClipboard(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const native = (window as any).Capacitor?.Plugins?.Clipboard;
  if (native?.read) {
    try {
      const res = await native.read();
      if (typeof res?.value === "string") return res.value;
    } catch {
      // 落到下面的浏览器方案
    }
  }

  try {
    if (navigator.clipboard?.readText) {
      return await navigator.clipboard.readText();
    }
  } catch {
    // 用户拒绝授权或环境不支持
  }

  return null;
}

/** 密钥里不会有空白；复制时常带进来的空格、换行、零宽字符一并去掉 */
export function cleanSecret(raw: string): string {
  return raw.replace(/[\s​-‍﻿]+/g, "");
}
