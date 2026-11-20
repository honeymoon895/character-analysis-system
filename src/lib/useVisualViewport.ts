"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 软键盘与可视视口
 *
 * 手机弹出键盘时，Android WebView 默认走 adjustResize：整个网页的可视区域被压缩。
 * 于是 `position: fixed; bottom: 0` 贴在的是**压缩后的底部**，也就是键盘上沿，
 * 底部导航看起来就像被"挤上去"了。
 *
 * 判断键盘是否打开不能只用「布局高度 − 可视高度」：
 * adjustResize 下两者同时变小，差值接近 0，永远判不出来。
 * 这里改为记住没有键盘时的最大高度作为基准，掉下去超过阈值才算键盘打开。
 */
export interface VisualViewportState {
  /** 键盘是否打开 */
  keyboardOpen: boolean;
  /** 当前真实可见高度（px）；不支持 visualViewport 时回落到 innerHeight */
  height: number | null;
}

export function useVisualViewport(threshold = 120): VisualViewportState {
  const [state, setState] = useState<VisualViewportState>({
    keyboardOpen: false,
    height: null,
  });

  // 没有键盘时的基准高度（取见过的最大值），以及宽度用于识别横竖屏切换
  const baseline = useRef(0);
  const lastWidth = useRef(0);
  // 某些机型不上报可视高度变化，焦点落在输入框时兜底判为键盘打开
  const inputFocused = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const vv = window.visualViewport;

    const currentHeight = () => {
      const vvHeight = vv ? vv.height : window.innerHeight;
      // 两者取小：任一被压缩，都说明可用高度变小了
      return Math.round(Math.min(window.innerHeight, vvHeight));
    };

    const check = () => {
      const h = currentHeight();
      const w = window.innerWidth;

      // 横竖屏切换时高度基准失效，重新起算
      if (w !== lastWidth.current) {
        lastWidth.current = w;
        baseline.current = h;
      }

      if (h > baseline.current) {
        baseline.current = h;
      }

      setState({
        keyboardOpen: inputFocused.current || baseline.current - h > threshold,
        height: h,
      });
    };

    const isEditable = (el: Element | null) => {
      if (!el) return false;
      const tag = el.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (el as HTMLElement).isContentEditable === true
      );
    };

    const onFocusIn = (e: FocusEvent) => {
      if (isEditable(e.target as Element)) {
        inputFocused.current = true;
        // 等键盘动画把高度带下来，再统一判定一次
        setTimeout(check, 50);
      }
    };

    const onFocusOut = () => {
      inputFocused.current = false;
      setTimeout(check, 120);
    };

    check();

    vv?.addEventListener("resize", check);
    vv?.addEventListener("scroll", check);
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);

    return () => {
      vv?.removeEventListener("resize", check);
      vv?.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, [threshold]);

  return state;
}
