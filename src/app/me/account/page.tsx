"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { useTheme, type ThemeMode } from "@/components/theme/ThemeProvider";
import { SubPageHeader } from "@/components/me/SubPageHeader";

/** 账号与外观 */
export default function AccountPage() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const router = useRouter();
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) router.push("/login");
  }, []);

  return (
    <div className="shell pt-6 md:pt-10 pb-10 max-w-2xl">
      <SubPageHeader title="账号与外观" en="Account" />

      <div className="rise space-y-3">
        <div className="surface p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[14px] text-bone-50">外观</div>
              <p className="text-[11.5px] text-bone-500 mt-0.5">
                白天用浅色，夜里用深色
              </p>
            </div>
            <ThemeSwitch />
          </div>
        </div>

        <div className="surface p-5">
          <Row label="用户名" value={user?.username || "—"} />
          <div className="h-px bg-[var(--hairline)] my-3" />
          <Row label="邮箱" value={user?.email || "未设置"} />
        </div>

        <div className="surface p-5">
          <div className="text-[11px] tracking-[0.16em] uppercase text-bone-500 mb-2">
            隐私
          </div>
          <p className="text-[12.5px] text-bone-400 leading-[1.8]">
            所有档案、知识库和推演只保存在你的账号下，其他用户无法访问。
            AI 密钥仅存在服务端，不会下发到浏览器。
          </p>
        </div>

        {!confirmLogout ? (
          <button
            onClick={() => setConfirmLogout(true)}
            className="btn-ghost w-full text-rose"
          >
            退出登录
          </button>
        ) : (
          <div className="surface p-4">
            <p className="text-[13px] text-bone-200 mb-3">确定退出？</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  logout();
                  router.push("/login");
                }}
                className="btn-primary flex-1"
              >
                退出
              </button>
              <button
                onClick={() => setConfirmLogout(false)}
                className="btn-ghost flex-1"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-bone-400">{label}</span>
      <span className="text-[13px] text-bone-100">{value}</span>
    </div>
  );
}

/** 三档切换：跟随系统 / 浅色 / 深色 */
function ThemeSwitch() {
  const { mode, setMode } = useTheme();
  const OPTIONS: { key: ThemeMode; label: string }[] = [
    { key: "system", label: "自动" },
    { key: "light", label: "浅色" },
    { key: "dark", label: "深色" },
  ];

  return (
    <div className="theme-switch" role="group" aria-label="外观主题">
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          data-on={mode === o.key}
          onClick={() => setMode(o.key)}
          aria-pressed={mode === o.key}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
