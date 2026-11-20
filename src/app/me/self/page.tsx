"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";
import { httpGet, httpPost } from "@/lib/http";
import { IS_OFFLINE } from "@/lib/offline/flag";
import type { AnalysisProfile } from "@/lib/analysis/types";
import { ProfileView } from "@/components/profile/ProfileView";
import { RadarChart } from "@/components/profile/RadarChart";
import { SubPageHeader } from "@/components/me/SubPageHeader";

/** 自我认知：读取知识库全部记录做人格研判 */
export default function SelfPage() {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [entryCount, setEntryCount] = useState(0);
  const [profile, setProfile] = useState<AnalysisProfile | null>(null);
  const [traits, setTraits] = useState<any[]>([]);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    load();
  }, []);

  async function load() {
    try {
      const self = await httpGet<any>("/api/user/self").catch(() => null);
      const p = self?.profile || {};
      setEntryCount(Array.isArray(p.selfDiary) ? p.selfDiary.length : 0);
      setTraits(p.selfTraits || []);
      setProfile(p.selfAnalysisProfile || null);
    } finally {
      setLoading(false);
    }
  }

  async function reanalyze() {
    if (saving) return;
    setError("");
    setSaving(true);
    try {
      await httpPost("/api/user/self", { action: "reanalyze" });
      await load();
    } catch (e: any) {
      setError(e.message || "研判失败");
    } finally {
      setSaving(false);
    }
  }

  async function exportData() {
    try {
      if (IS_OFFLINE) {
        const { exportAll } = await import("@/lib/offline/api");
        const data = await exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `mindscape-${data.user?.username || "me"}-${new Date()
          .toISOString()
          .slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      }

      const res = await fetch("/api/user/self/export", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
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
    if (!confirm("清除全部自我认知结果和知识库记录？不可撤销。")) return;
    try {
      await httpPost("/api/user/self", { content: "reset", action: "reset" });
      setEntryCount(0);
      setTraits([]);
      setProfile(null);
    } catch {}
  }

  const measuredTraits = traits.filter(
    (t: any) => t.measured !== false && (t.confidence ?? 0) >= 30
  );

  return (
    <div className="shell pt-6 md:pt-10 pb-10 max-w-2xl">
      <SubPageHeader
        title="自我认知"
        en="Self"
        desc="用知识库里的全部记录做人格研判。写得越具体，结论越能落到证据上。"
      />

      {loading ? (
        <div className="h-28 rounded-3xl bg-[var(--glass-2)] animate-pulse" />
      ) : (
        <div className="rise space-y-5">
          <div className="surface-raised p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[13.5px] text-bone-50">研判材料</div>
                <div className="text-[11.5px] text-bone-500 mt-0.5">
                  知识库共 {entryCount} 条记录
                </div>
              </div>
              <span className="numeral text-[24px] text-bone-50">{entryCount}</span>
            </div>
            <div className="flex gap-2">
              <Link href="/me/knowledge" className="btn-ghost flex-1">
                去写记录
              </Link>
              <button
                onClick={reanalyze}
                disabled={saving || entryCount === 0}
                className="btn-primary flex-1"
              >
                {saving ? "研判中……" : profile ? "重新研判" : "开始研判"}
              </button>
            </div>
            {saving && (
              <p className="text-[11.5px] text-bone-500 text-center mt-3">
                正在读取全部记录，通常需要 20–60 秒，请不要离开
              </p>
            )}
            {error && <p className="text-[12px] text-rose mt-3">{error}</p>}
            {entryCount === 0 && (
              <p className="text-[11.5px] text-bone-600 mt-3">
                知识库为空，暂时没有可研判的材料。
              </p>
            )}
          </div>

          {profile && (
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
          )}

          {(entryCount > 0 || profile) && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={exportData}
                className="text-[12px] text-bone-400 hover:text-bone-100 px-3 py-2"
              >
                导出数据
              </button>
              <span className="w-px h-3 bg-[var(--hairline)]" />
              <button
                onClick={resetSelf}
                className="text-[12px] text-bone-600 hover:text-rose px-3 py-2"
              >
                全部清空
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
