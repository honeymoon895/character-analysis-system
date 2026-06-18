"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { httpGet } from "@/lib/http";

const DISMISS_KEY = "self_prompt_dismissed";
const SESSION_KEY = "self_prompt_session_shown";

export function SelfPromptModal() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [dontRemind, setDontRemind] = useState(false);
  const [checking, setChecking] = useState(true);

  // 只在访问他人分析页面时触发
  const isCharacterPage =
    pathname?.startsWith("/character/") ||
    pathname?.startsWith("/simulate/") ||
    pathname === "/";

  useEffect(() => {
    if (!isAuthenticated() || !isCharacterPage || pathname === "/my-profile") {
      setShow(false);
      setChecking(false);
      return;
    }

    // 用户已永久关闭
    if (localStorage.getItem(DISMISS_KEY) === "true") {
      setChecking(false);
      return;
    }

    // 本次会话已显示过
    if (sessionStorage.getItem(SESSION_KEY) === "true") {
      setChecking(false);
      return;
    }

    // 检查是否已完成自我分析
    const check = async () => {
      try {
        const res = await httpGet("/api/user/self");
        if (res.profile?.selfAnalysisComplete) {
          setShow(false);
          return;
        }
        // 未完成，显示提示
        setShow(true);
        sessionStorage.setItem(SESSION_KEY, "true");
      } catch {
        // 出错不显示
      } finally {
        setChecking(false);
      }
    };
    check();
  }, [isAuthenticated, isCharacterPage, pathname]);

  const handleGoSelf = () => {
    setShow(false);
    router.push("/my-profile");
  };

  const handleSkip = () => {
    if (dontRemind) {
      localStorage.setItem(DISMISS_KEY, "true");
    }
    setShow(false);
  };

  const handleDismiss = () => {
    if (dontRemind) {
      localStorage.setItem(DISMISS_KEY, "true");
    }
    setShow(false);
  };

  if (!show || checking) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden animate-fade-in-up">
        {/* 装饰头 */}
        <div className="h-2 bg-gradient-to-r from-[#6c63ff] to-[#8b85ff]" />

        <div className="p-8 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#6c63ff]/10 to-[#8b85ff]/10 flex items-center justify-center text-4xl">
            🧠
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-2">
            先了解自己，再去了解别人
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            在分析他人之前，不妨先花点时间了解自己的性格特征。
            <br />
            通过日记的方式让 AI 认识你，建立你的专属性格档案。
          </p>

          <div className="space-y-3">
            <button
              onClick={handleGoSelf}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#6c63ff] to-[#8b85ff] text-white font-medium hover:shadow-md transition-all"
            >
              🚀 去了解自己
            </button>
            <button
              onClick={handleSkip}
              className="w-full py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
            >
              暂时跳过
            </button>
          </div>

          <label className="flex items-center justify-center gap-2 mt-4 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={dontRemind}
              onChange={(e) => setDontRemind(e.target.checked)}
              className="rounded border-gray-300 text-[#6c63ff] focus:ring-[#6c63ff]"
            />
            不再提示
          </label>
        </div>
      </div>
    </div>
  );
}
