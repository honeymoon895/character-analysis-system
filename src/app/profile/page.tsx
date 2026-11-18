"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";
import { httpGet } from "@/lib/http";

/** 设置 / 个人中心：账号信息与数据出口，保持极简 */
export default function ProfilePage() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const router = useRouter();
  const [stats, setStats] = useState({ characters: 0, measured: 0 });
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    load();
  }, []);

  async function load() {
    try {
      const res = await httpGet("/api/character/list");
      const list = res.characters || [];
      const measured = list.filter((c: any) => {
        const raw = c.traits;
        let arr: any[] = [];
        try {
          arr = typeof raw === "string" ? JSON.parse(raw) : raw || [];
        } catch {
          arr = [];
        }
        return arr.some(
          (t: any) => t.measured !== false && (t.confidence ?? 0) >= 30
        );
      }).length;
      setStats({ characters: list.length, measured });
    } catch {}
  }

  if (!user) return null;

  return (
    <div className="shell pt-6 md:pt-10 pb-10 max-w-xl">
      <header className="mb-7 rise">
        <div className="text-[11px] tracking-[0.22em] uppercase text-bone-500 mb-2">
          账号
        </div>
        <h1 className="font-display text-[24px] md:text-[28px] text-bone-50">
          {user.username}
        </h1>
        <p className="text-[13px] text-bone-500 mt-1">
          {user.email || "未设置邮箱"}
        </p>
      </header>

      {/* 概览 */}
      <div className="grid grid-cols-2 gap-2.5 mb-6 rise">
        <div className="surface p-4">
          <div className="numeral text-[26px] text-bone-50 leading-none">
            {stats.characters}
          </div>
          <div className="text-[11.5px] text-bone-500 mt-1.5">人物档案</div>
        </div>
        <div className="surface p-4">
          <div className="numeral text-[26px] text-bone-50 leading-none">
            {stats.measured}
          </div>
          <div className="text-[11.5px] text-bone-500 mt-1.5">已完成研判</div>
        </div>
      </div>

      {/* 入口 */}
      <div className="space-y-2 mb-6">
        <RowLink href="/my-profile" label="自我认知" hint="记录并研判你自己" />
        <RowLink href="/explore" label="新建研判" hint="分析一个公众人物或身边的人" />
      </div>

      {/* 说明 */}
      <div className="surface p-4 mb-6">
        <div className="text-[11px] tracking-[0.16em] uppercase text-bone-500 mb-2">
          关于隐私
        </div>
        <p className="text-[12.5px] text-bone-300 leading-[1.8]">
          所有档案只保存在你自己的账号下，其他用户无法访问。
          你可以随时在自我认知页导出或清空数据。
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
        <div className="surface p-4 rise">
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
  );
}

function RowLink({
  href,
  label,
  hint,
}: {
  href: string;
  label: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="surface p-4 flex items-center gap-3 press hover:border-white/[0.12] transition-colors block"
    >
      <div className="min-w-0 flex-1">
        <div className="text-[14px] text-bone-50">{label}</div>
        <div className="text-[11.5px] text-bone-500 mt-0.5">{hint}</div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-bone-600 shrink-0">
        <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}
