"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * PWA 注册与安装提示
 *
 * 注册时机：页面加载完成后再注册，避免和首屏渲染争抢带宽。
 * 安装提示：只在浏览器真的触发 beforeinstallprompt 时出现（Android/Chrome 支持），
 * iOS Safari 不支持该事件，所以 iOS 走「分享 → 添加到主屏幕」的手动路径，
 * 这里给出文字引导而不是假装能一键装。
 */

export function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      // 开发环境不注册，避免缓存干扰热更新
      return;
    }

    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((e) => console.warn("SW 注册失败", e));
    };

    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad);

    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}

/** 底部的「添加到主屏幕」提示条 */
export function InstallPrompt() {
  const pathname = usePathname() || "/";
  const [deferred, setDeferred] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 已经是独立窗口（已安装）就不再提示
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (standalone) return;

    // 用户选过「不再提示」
    if (localStorage.getItem("mindscape-install-dismissed") === "true") return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
      // 稍等再出现，避免一进页面就弹东西
      setTimeout(() => setVisible(true), 4000);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS 不支持 beforeinstallprompt，用文字引导
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as any).MSStream;
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isIOS && isSafari) {
      setIosHint(true);
      setTimeout(() => setVisible(true), 6000);
    }

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    setVisible(false);
    localStorage.setItem("mindscape-install-dismissed", "true");
  }

  async function install() {
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
    }
    setDeferred(null);
  }

  // 对话页底部是输入框，提示卡会压在上面，看起来像导航坏了
  const inConversation =
    pathname.startsWith("/chat/") || pathname.startsWith("/simulate");

  if (!visible || inConversation) return null;

  return (
    <div
      className="fixed left-3 right-3 z-30 md:left-auto md:right-6 md:w-[340px]"
      style={{ bottom: "calc(104px + var(--safe-bottom))" }}
    >
      <div className="surface-raised p-4 rise">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-[12px] shrink-0"
            style={{
              background:
                "linear-gradient(135deg, #5ef0e0 0%, #2ed3c4 55%, #8b5cf6 100%)",
            }}
          >
            <div className="w-full h-full flex items-center justify-center">
              <span
                className="w-4 h-4 rounded-full"
                style={{ background: "var(--bg-base)" }}
              />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] text-bone-50 font-medium">
              添加到主屏幕
            </div>
            <p className="text-[11.5px] text-bone-400 leading-relaxed mt-1">
              {iosHint
                ? "点击 Safari 底部分享按钮，选择「添加到主屏幕」，像 App 一样打开。"
                : "装到桌面，全屏打开，不用每次输网址。"}
            </p>

            <div className="flex gap-2 mt-2.5">
              {!iosHint && (
                <button
                  onClick={install}
                  className="px-3.5 min-h-[34px] rounded-lg text-[12px] font-medium"
                  style={{
                    color: "#041210",
                    background:
                      "linear-gradient(135deg, #7ef7ea, #2ed3c4)",
                  }}
                >
                  立即添加
                </button>
              )}
              <button
                onClick={dismiss}
                className="px-3 min-h-[34px] rounded-lg text-[12px] text-bone-500"
              >
                {iosHint ? "知道了" : "以后再说"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
