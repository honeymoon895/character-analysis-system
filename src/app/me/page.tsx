"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";
import { httpGet, httpPost } from "@/lib/http";
import type { AnalysisProfile } from "@/lib/analysis/types";
import { ProfileView } from "@/components/profile/ProfileView";
import { RadarChart } from "@/components/profile/RadarChart";
import { AISettingsPanel } from "@/components/settings/AISettingsPanel";
import { useTheme, type ThemeMode } from "@/components/theme/ThemeProvider";

/**
 * 「我的」——自我认知 + 账号 + 设置
 *
 * 「设置」并入此处而不是单占一个底部入口：
 * 底部栏位置应留给高频动作（人物库 / 新建 / 对话），
 * 设置属于低频但必须找得到的配置，放在个人页最合适。
 */

type Tab = "self" | "account" | "ai";

export default function MePage() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<Tab>("self");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [diary, setDiary] = useState("");
  const [entries, setEntries] = useState<{ content: string; timestamp: string }[]>([]);
  const [profile, setProfile] = useState<AnalysisProfile | null>(null);
  const [traits, setTraits] = useState<any[]>([]);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [stats, setStats] = useState({ characters: 0, measured: 0 });

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    load();
  }, []);

  async function load() {
    try {
      const [self, list] = await Promise.all([
        httpGet<any>("/api/user/self").catch(() => null),
        httpGet<any>("/api/character/list").catch(() => null),
      ]);
      const p = self?.profile || {};
      setAvatarUrl(p.selfAvatarUrl || null);
      setEntries(p.selfDiary || []);
      setTraits(p.selfTraits || []);
      setProfile(p.selfAnalysisProfile || null);
      setComplete(Boolean(p.selfAnalysisComplete));

      const chars = list?.characters || [];
      const measured = chars.filter((c: any) => {
        let arr: any[] = [];
        try {
          arr = typeof c.traits === "string" ? JSON.parse(c.traits) : c.traits || [];
        } catch {}
        return arr.some(
          (t: any) => t.measured !== false && (t.confidence ?? 0) >= 30
        );
      }).length;
      setStats({ characters: chars.length, measured });
    } finally {
      setLoading(false);
    }
  }

  async function uploadAvatar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      const res = await fetch("/api/user/self/upload-avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: fd,
      });
      const data = await res.json();
      if (data.avatarUrl) {
        setAvatarUrl(data.avatarUrl);
        if (data.user) {
          useAuthStore
            .getState()
            .setAuth(data.user, localStorage.getItem("token") || "");
        }
      }
    } catch (e: any) {
      alert("上传失败：" + e.message);
    }
  }

  async function submitDiary() {
    const text = diary.trim();
    if (!text || saving) return;
    setError("");
    setSaving(true);
    try {
      await httpPost("/api/user/self", { content: text });
      setDiary("");
      await load();
    } catch (e: any) {
      setError(e.message || "提交失败");
    } finally {
      setSaving(false);
    }
  }

  async function exportData() {
    try {
      const res = await fetch("/api/user/self/export", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
      });
      if (!res.ok) throw new Error("导出失败");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mindscape-${user?.username || "me"}-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function resetSelf() {
    if (!confirm("清除全部自我认知记录？不可撤销。")) return;
    try {
      await httpPost("/api/user/self", { content: "reset", action: "reset" });
      setEntries([]);
      setTraits([]);
      setProfile(null);
      setComplete(false);
    } catch {}
  }

  if (loading) {
    return (
      <div className="shell pt-12">
        <div className="h-20 rounded-3xl bg-[var(--glass-2)] animate-pulse" />
      </div>
    );
  }

  const measuredTraits = traits.filter(
    (t: any) => t.measured !== false && (t.confidence ?? 0) >= 30
  );

  return (
    <div className="shell pt-6 md:pt-10 pb-10 max-w-2xl">
      {/* ═══ 身份 ═══ */}
      <header className="flex items-center gap-4 mb-7 rise">
        <button
          onClick={() => fileRef.current?.click()}
          className="relative w-16 h-16 rounded-[20px] overflow-hidden shrink-0 border border-[var(--border-2)] group"
          style={{ background: "linear-gradient(150deg, color-mix(in srgb, var(--accent) 14%, var(--bg-base)), var(--bg-base))" }}
          aria-label="更换头像"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="font-display text-[24px] text-bone-200">
              {(user?.username || "?").charAt(0).toUpperCase()}
            </span>
          )}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />

        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[22px] text-bone-50 truncate">
            {user?.username}
          </h1>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="chip">
              <span className="numeral text-bone-100">{stats.characters}</span> 档案
            </span>
            <span className="chip">
              <span className="numeral text-bone-100">{stats.measured}</span> 已研判
            </span>
          </div>
        </div>
      </header>

      {/* ═══ 分段 ═══ */}
      <div className="flex gap-1 p-1 rounded-2xl border border-[var(--border-1)] bg-[var(--glass-2)] mb-6">
        {(
          [
            ["self", "自我认知"],
            ["ai", "AI 引擎"],
            ["account", "账号"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 min-h-[42px] rounded-[13px] text-[13px] font-medium transition-all ${
              tab === key
                ? "text-bone-50"
                : "text-bone-500 hover:text-bone-300"
            }`}
            style={
              tab === key
                ? {
                    background:
                      "linear-gradient(135deg, rgba(94,240,224,0.16), rgba(139,92,246,0.12))",
                    border: "1px solid rgba(94,240,224,0.2)",
                  }
                : undefined
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* ═══ 自我认知 ═══ */}
      {tab === "self" && (
        <div className="rise space-y-5">
          <div className="surface-raised p-5">
            <h2 className="font-display text-[17px] text-bone-50 mb-1.5">
              写点真实的
            </h2>
            <p className="text-[12.5px] text-bone-400 leading-relaxed mb-4">
              写你在什么情境下怎么反应、事后怎么想。越具体，越能看见自己没注意到的模式。
            </p>
            <textarea
              value={diary}
              onChange={(e) => setDiary(e.target.value)}
              placeholder="比如：今天开会方案被否，我第一反应是笑着说没关系，回家路上却一直在想是不是自己能力不行。其实我在意的不是方案，是别人怎么看我。"
              rows={6}
              className="field mb-3"
            />
            {error && <p className="text-[12px] text-rose mb-2">{error}</p>}
            <button
              onClick={submitDiary}
              disabled={!diary.trim() || saving}
              className="btn-primary w-full"
            >
              {saving ? "重新研判中……" : "记录并研判"}
            </button>
          </div>

          {profile ? (
            <div className="space-y-6">
              {measuredTraits.length >= 3 && (
                <div className="surface p-4">
                  <div className="flex items-baseline gap-2 mb-3">
                    <h2 className="font-display text-[16px] text-bone-50">自我轮廓</h2>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-bone-600">
                      Shape
                    </span>
                  </div>
                  <RadarChart data={measuredTraits} />
                </div>
              )}
              <ProfileView profile={profile} />
            </div>
          ) : (
            entries.length > 0 && (
              <p className="text-[12px] text-bone-500 text-center">
                记录已保存，等待研判
              </p>
            )
          )}

          {entries.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] tracking-[0.2em] uppercase text-bone-500">
                  {entries.length} 条记录
                </span>
                <div className="flex gap-2">
                  <button onClick={exportData} className="text-[11.5px] text-bone-400 hover:text-bone-100 px-2 py-1">
                    导出
                  </button>
                  <button onClick={resetSelf} className="text-[11.5px] text-bone-600 hover:text-rose px-2 py-1">
                    清空
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {[...entries].reverse().map((e, i) => (
                  <div key={i} className="surface p-4">
                    <div className="text-[10px] text-bone-600 mb-1.5">
                      {new Date(e.timestamp).toLocaleDateString("zh-CN")}
                    </div>
                    <p className="text-[13px] text-bone-200 leading-[1.75] whitespace-pre-wrap">
                      {e.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ AI 引擎 ═══ */}
      {tab === "ai" && (
        <div className="rise">
          <AISettingsPanel />
        </div>
      )}

      {/* ═══ 账号 ═══ */}
      {tab === "account" && (
        <div className="rise space-y-3">
          {/* 外观：主题切换 */}
          <div className="surface p-5">
            <div className="flex items-center justify-between gap-3 mb-1">
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
            <div className="h-px bg-white/[0.06] my-3" />
            <Row label="邮箱" value={user?.email || "未设置"} />
          </div>

          <Link
            href="/explore"
            className="surface p-4 flex items-center gap-3 press block"
          >
            <span className="text-[14px] text-bone-100 flex-1">新建研判</span>
            <Chevron />
          </Link>

          <div className="surface p-5">
            <div className="text-[11px] tracking-[0.16em] uppercase text-bone-500 mb-2">
              隐私
            </div>
            <p className="text-[12.5px] text-bone-400 leading-[1.8]">
              所有档案只保存在你的账号下，其他用户无法访问。AI 密钥仅存在服务端，
              不会下发到浏览器。
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
      )}
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

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-bone-600">
      <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
