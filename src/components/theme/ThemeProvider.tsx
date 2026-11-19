"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

/**
 * 主题
 *
 * - 三种可选：跟随系统 / 浅色 / 深色
 * - 存在 localStorage，跨会话保持
 * - 首屏防闪烁：layout 里的内联脚本会在绘制前设好 data-theme
 */

export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "mindscape-theme";

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (m: ThemeMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function readStored(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === "light" || v === "dark" || v === "system") return v;
  return "system";
}

function apply(theme: ResolvedTheme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  // 让浏览器原生控件（滚动条、输入光标）跟着切换
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [resolved, setResolved] = useState<ResolvedTheme>("dark");
  const [ready, setReady] = useState(false);

  // 初始化：读取存储值
  useEffect(() => {
    const stored = readStored();
    const theme: ResolvedTheme =
      stored === "system" ? systemTheme() : stored;
    setModeState(stored);
    setResolved(theme);
    apply(theme);
    setReady(true);
  }, []);

  // 跟随系统变化（仅在 system 模式下）
  useEffect(() => {
    if (!ready) return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      if (mode !== "system") return;
      const theme = mq.matches ? "light" : "dark";
      setResolved(theme);
      apply(theme);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode, ready]);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    localStorage.setItem(STORAGE_KEY, m);
    const theme: ResolvedTheme = m === "system" ? systemTheme() : m;
    setResolved(theme);
    apply(theme);
  }, []);

  const toggle = useCallback(() => {
    setMode(resolved === "dark" ? "light" : "dark");
  }, [resolved, setMode]);

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // 在 Provider 之外调用时给出安全默认值，避免崩溃
    return {
      mode: "system",
      resolved: "dark",
      setMode: () => {},
      toggle: () => {},
    };
  }
  return ctx;
}

/**
 * 首屏脚本：在 React 水合之前就把主题设好，避免白闪 / 黑闪。
 * 以字符串形式注入 layout，不能引用任何外部变量。
 */
export const THEME_INIT_SCRIPT = `
(function(){
  try {
    var k = '${STORAGE_KEY}';
    var v = localStorage.getItem(k);
    var t = (v === 'light' || v === 'dark') ? v
      : (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.style.colorScheme = t;
  } catch (e) {}
})();
`;
