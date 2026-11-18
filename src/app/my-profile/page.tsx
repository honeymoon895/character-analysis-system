"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { httpGet, httpPost } from "@/lib/http";
import type { AnalysisProfile } from "@/lib/analysis/types";
import { ProfileView } from "@/components/profile/ProfileView";
import { RadarChart } from "@/components/profile/RadarChart";

/**
 * 自我认知
 *
 * 与旧版的区别：
 * - 不再把每次日记做加权平均（那会把早期偏差固化）。
 *   现在每条新日记都用全部材料重新研判，档案会随新材料一起修正。
 * - 明确提示"自述存在自我服务偏差"，并把盲区作为独立板块突出，而不是藏在末尾。
 */

export default function MyProfilePage() {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [diary, setDiary] = useState("");
  const [entries, setEntries] = useState<{ content: string; timestamp: string }[]>([]);
  const [profile, setProfile] = useState<AnalysisProfile | null>(null);
  const [traits, setTraits] = useState<any[]>([]);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"write" | "profile">("write");

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    load();
  }, []);

  async function load() {
    try {
      const res = await httpGet("/api/user/self");
      const p = res.profile || {};
      setAvatarUrl(p.selfAvatarUrl || null);
      setEntries(p.selfDiary || []);
      setTraits(p.selfTraits || []);
      setProfile(p.selfAnalysisProfile || null);
      setComplete(Boolean(p.selfAnalysisComplete));
      if (p.selfAnalysisProfile) setTab("profile");
    } catch {
      // 首次使用无数据属正常
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
          useAuthStore.getState().setAuth(
            data.user,
            localStorage.getItem("token") || ""
          );
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
      setTab("profile");
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
      a.download = `self-${user?.username || "profile"}-${new Date()
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

  async function reset() {
    if (!confirm("清除全部自我认知记录？这不可撤销。")) return;
    try {
      await httpPost("/api/user/self", { content: "reset", action: "reset" });
      setEntries([]);
      setTraits([]);
      setProfile(null);
      setComplete(false);
      setTab("write");
    } catch {}
  }

  if (loading) {
    return (
      <div className="shell pt-10">
        <div className="h-20 rounded-2xl bg-white/[0.03] animate-pulse" />
      </div>
    );
  }

  const measuredTraits = traits.filter(
    (t: any) => t.measured !== false && (t.confidence ?? 0) >= 30
  );

  return (
    <div className="shell pt-6 md:pt-10 pb-10 max-w-2xl">
      {/* ═══ 身份区 ═══ */}
      <header className="flex items-center gap-4 mb-6 rise">
        <button
          onClick={() => fileRef.current?.click()}
          className="relative w-16 h-16 rounded-2xl overflow-hidden shrink-0 border border-white/10 bg-ink-750 flex items-center justify-center group"
          aria-label="更换头像"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="font-display text-[22px] text-bone-200">
              {(user?.username || "?").charAt(0).toUpperCase()}
            </span>
          )}
          <span className="absolute inset-0 bg-black/50 opacity-0 group-active:opacity-100 md:group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-bone-50">
              <path d="M12 16V8m0 0-3 3m3-3 3 3M5 19h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={uploadAvatar}
        />

        <div className="min-w-0">
          <h1 className="font-display text-[22px] text-bone-50 truncate">
            {user?.username}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`chip ${complete ? "chip-jade" : ""}`}>
              {complete ? "档案已建立" : entries.length > 0 ? `${entries.length} 条记录` : "尚未开始"}
            </span>
          </div>
        </div>
      </header>

      {/* ═══ 分段 ═══ */}
      <div className="flex gap-1 p-1 rounded-2xl bg-white/[0.035] border border-white/[0.06] mb-6">
        {(
          [
            ["write", "记录"],
            ["profile", "我的档案"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 min-h-[42px] rounded-xl text-[13px] font-medium transition-all ${
              tab === key ? "bg-ink-750 text-bone-50" : "text-bone-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ═══ 记录 ═══ */}
      {tab === "write" && (
        <div className="space-y-4 rise">
          <div className="surface-raised p-5">
            <h2 className="font-display text-[17px] text-bone-50 mb-1">
              写点真实的
            </h2>
            <p className="text-[12.5px] text-bone-400 leading-relaxed mb-4">
              不用写成日记体，写你在什么情境下怎么反应、事后怎么想都可以。
              越具体，越能看出你自己没注意到的模式。
            </p>

            <textarea
              value={diary}
              onChange={(e) => setDiary(e.target.value)}
              placeholder="比如：今天开会时我的方案被否了，我第一反应是笑着说没关系，但回家路上一直在想是不是自己能力不行。其实我更在意的不是方案，是别人怎么看我。"
              rows={7}
              className="field mb-3"
            />

            {error && (
              <p className="text-[12px] text-rose mb-2">{error}</p>
            )}

            <button
              onClick={submitDiary}
              disabled={!diary.trim() || saving}
              className="btn-primary w-full"
            >
              {saving ? "重新研判中……" : "记录并更新档案"}
            </button>

            <p className="text-[11px] text-bone-600 mt-3 leading-relaxed">
              每次提交都会用全部记录重新分析，之前的结论会被修正——包括改错的地方。
            </p>
          </div>

          {entries.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] tracking-[0.2em] uppercase text-bone-500">
                  {entries.length} 条记录
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={exportData}
                    className="text-[11.5px] text-bone-500 hover:text-bone-200 transition-colors px-2 py-1"
                  >
                    导出
                  </button>
                  <button
                    onClick={reset}
                    className="text-[11.5px] text-bone-600 hover:text-rose transition-colors px-2 py-1"
                  >
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

      {/* ═══ 档案 ═══ */}
      {tab === "profile" && (
        <div className="rise">
          {!profile ? (
            <div className="surface p-8 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full border border-white/10 flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-bone-600" />
              </div>
              <p className="text-[13px] text-bone-400 mb-1">还没有自我档案</p>
              <p className="text-[12px] text-bone-600 mb-4 leading-relaxed">
                写下第一条记录，就能看到初步的自我研判
              </p>
              <button onClick={() => setTab("write")} className="btn-ghost">
                去记录
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {measuredTraits.length >= 3 && (
                <div className="surface p-4">
                  <h2 className="font-display text-[16px] text-bone-50 mb-2">
                    自我轮廓
                  </h2>
                  <RadarChart data={measuredTraits} />
                </div>
              )}

              <div className="surface p-4 border-l-2" style={{ borderLeftColor: "rgba(127,148,173,0.4)" }}>
                <div className="text-[11px] tracking-[0.16em] uppercase text-steel mb-2">
                  关于这份档案
                </div>
                <p className="text-[12.5px] text-bone-300 leading-[1.8]">
                  以下结论来自你自己的叙述，因此存在一个结构性局限：
                  你能看到的自己，本身就是经过筛选的。
                  所以「盲区」一栏可能比结论更值得看。
                </p>
              </div>

              <ProfileView profile={profile} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
