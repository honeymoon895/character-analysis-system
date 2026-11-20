"use client";

import { useEffect, useState } from "react";

/**
 * 软键盘与可视视口
 *
 * 手机弹出键盘时，WebView 有两种表现：
 *   1. 布局视口被压缩（adjustResize）——position: fixed 的底部栏会被顶到键盘上方
 *   2. 整体被平移（adjustPan）——底部栏跟着往上跑
 * 两种都很难看。判断键盘是否打开后，底部导航直接收起，
 * 需要输入的页面（对话）则改用 visualViewport 的真实高度，避免输入框被盖住。
 */
export interface VisualViewportState {
  /** 键盘是否打开 */
  keyboardOpen: boolean;
  /** 当前真实可见高度（px）；不支持 visualViewport 时为 null */
  height: number | null;
}

export function useVisualViewport(threshold = 120): VisualViewportState {
  const [state, setState] = useState<VisualViewportState>({
    keyboardOpen: false,
    height: null,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;

    const check = () => {
      // 布局视口 vs 可视视口的差值，就是键盘占掉的高度
      const diff = window.innerHeight - vv.height;
      setState({
        keyboardOpen: diff > threshold,
        height: Math.round(vv.height),
      });
    };

    check();
    vv.addEventListener("resize", check);
    vv.addEventListener("scroll", check);
    window.addEventListener("orientationchange", check);

    return () => {
      vv.removeEventListener("resize", check);
      vv.removeEventListener("scroll", check);
      window.removeEventListener("orientationchange", check);
    };
  }, [threshold]);

  return state;
}
