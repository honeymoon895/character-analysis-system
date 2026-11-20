"use client";

import { useEffect, useState } from "react";

/**
 * 读取 URL 查询参数
 *
 * 为什么不用 useSearchParams：静态导出（单机 APK）下它要求整页包在
 * Suspense 里，否则构建直接报错；而且首屏服务端拿不到真实查询串。
 * 这里等到挂载后再读，服务端与首屏都渲染 null，不会水合不一致。
 */
export function useQueryParam(name: string): string | null {
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    try {
      setValue(new URLSearchParams(window.location.search).get(name));
    } catch {
      setValue(null);
    }
  }, [name]);

  return value;
}
