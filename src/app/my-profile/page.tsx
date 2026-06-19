"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { Header } from "@/components/Header";
import { RadarChart } from "@/components/RadarChart";
import { TagCloud } from "@/components/TagCloud";
import { httpGet, httpPost } from "@/lib/http";

export default function MyProfilePage() {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [diaryInput, setDiaryInput] = useState("");
  const [diaryEntries, setDiaryEntries] = useState<Array<{ content: string; timestamp: string }>>([]);
  const [traits, setTraits] = useState<any[]>([]);
  const [summary, setSummary] = useState("");
  const [behaviorPatterns, setBehaviorPatterns] = useState<any[]>([]);
  const [values, setValues] = useState<string[]>([]);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [diaryCount, setDiaryCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated()) { router.push("/login"); return; }
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await httpGet("/api/user/self");
      const p = res.profile;
      setAvatarUrl(p.selfAvatarUrl || null);
      setDiaryEntries(p.selfDiary || []);
      setTraits(p.selfTraits || []);
      setSummary(p.selfPersonalitySummary || "");
      setBehaviorPatterns(p.selfBehaviorPatterns || []);
      setValues(p.selfValues || []);
      setAnalysisComplete(p.selfAnalysisComplete || false);
      setDiaryCount((p.selfDiary || []).length);
    } catch {
      // 首次使用，没有数据也正常
    } finally {
      setLoading(false);
    }
  };

  // ── 上传头像 ──
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await fetch("/api/user/self/upload-avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: formData,
      });
      const data = await res.json();
      if (data.avatarUrl) {
        setAvatarUrl(data.avatarUrl);
        // 同步更新 auth store，让全站头像立即生效
        if (data.user) {
          const token = localStorage.getItem("token") || "";
          useAuthStore.getState().setAuth(data.user, token);
        }
      }
    } catch (err: any) {
      alert("上传失败：" + err.message);
    }
  };

  // ── 提交日记 ──
  const handleSubmitDiary = async () => {
    if (!diaryInput.trim() || saving) return;
    setSaving(true);
    try {
      const res = await httpPost("/api/user/self", { content: diaryInput });
      if (res.traits) setTraits(res.traits);
      if (res.summary) setSummary(res.summary);
      if (res.behaviorPatterns) setBehaviorPatterns(res.behaviorPatterns);
      if (res.values) setValues(res.values);
      setDiaryEntries((prev) => [...prev, res.entry]);
      setDiaryCount(res.diaryCount);
      setAnalysisComplete(res.analysisComplete);
      setDiaryInput("");
    } catch (err: any) {
      alert("分析失败：" + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── 导出数据 ──
  const handleExport = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/user/self/export", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("导出失败");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `self-cognition-${user?.username || "user"}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("导出失败：" + err.message);
    }
  };

  // ── 重置 ──
  const handleReset = async () => {
    if (!confirm("确定清除所有自我分析数据吗？")) return;
    try {
      await httpPost("/api/user/self", { content: "reset", action: "reset" });
      setDiaryEntries([]);
      setTraits([]);
      setSummary("");
      setBehaviorPatterns([]);
      setValues([]);
      setAnalysisComplete(false);
      setDiaryCount(0);
    } catch {}
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#6c63ff]" />
      </div>
    );
  }

  return (
    <>
      <Header />
      <main className="flex-1 py-8">
        <div className="page-container max-w-3xl mx-auto">
          {/* ── 头部区域 ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-6">
            <div className="flex items-start gap-6 flex-wrap">
              {/* 头像 */}
              <div className="relative group">
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#6c63ff] to-[#8b85ff] flex items-center justify-center text-white text-4xl font-bold shadow-md overflow-hidden">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    user?.username.charAt(0).toUpperCase()
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-[#6c63ff] text-white text-xs flex items-center justify-center shadow-md hover:bg-[#5a52e0] transition-all opacity-0 group-hover:opacity-100"
                >
                  📷
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-gray-900">{user?.username}</h1>
                <p className="text-sm text-gray-400 mt-1">
                  {analysisComplete
                    ? "✅ 已建立自我认知档案"
                    : `📝 已记录 ${diaryCount}/3 条日记，继续完善档案`}
                </p>
                <div className="flex gap-2 mt-3">
                  <span className="text-xs px-2 py-1 rounded-full bg-[#6c63ff]/5 text-[#6c63ff] border border-[#6c63ff]/10">
                    自我认知
                  </span>
                  {analysisComplete && (
                    <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-600 border border-green-100">
                      已完成
                    </span>
                  )}
                  {(traits.length > 0 || diaryEntries.length > 0) && (
                    <button
                      onClick={handleExport}
                      className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100 hover:bg-amber-100 transition-colors"
                    >
                      📤 导出
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── 性格总结 ── */}
          {summary && (
            <div className="bg-white rounded-xl p-5 mb-6 shadow-sm border border-gray-100">
              <p className="text-gray-700 text-lg leading-relaxed">💡 {summary}</p>
            </div>
          )}

          {/* ── 雷达图 + 标签 ── */}
          {traits.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-800 mb-4">📊 九维心理特征</h2>
                <RadarChart data={traits} />
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-800 mb-4">🏷️ 性格标签</h2>
                <TagCloud traits={traits} />

                {behaviorPatterns.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">📋 行为模式</h3>
                    <div className="space-y-2">
                      {behaviorPatterns.map((bp: any, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-gray-400 min-w-[60px] font-medium">{bp.scenario}:</span>
                          <span className="text-gray-600">{bp.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {values.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">💎 核心价值观</h3>
                    <div className="flex flex-wrap gap-2">
                      {values.map((v: string, i: number) => (
                        <span key={i} className="text-sm px-3 py-1 rounded-full bg-[#6c63ff]/5 text-[#6c63ff] border border-[#6c63ff]/10">{v}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── 日记区域 ── */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">📝 自我探索日记</h2>
            <p className="text-sm text-gray-400 mb-4">
              写下关于你自己的经历、感受、想法。每条日记 AI 都会分析并更新你的性格档案。
              {!analysisComplete && <span className="text-[#6c63ff]"> 完成 3 条即可建立完整档案。</span>}
            </p>

            <div className="flex gap-2 mb-6">
              <textarea
                value={diaryInput}
                onChange={(e) => setDiaryInput(e.target.value)}
                placeholder="例如：今天在工作中遇到了一个挑战，我的第一反应是..."
                rows={3}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:border-[#6c63ff] focus:ring-2 focus:ring-[#6c63ff]/20 outline-none transition-all resize-none"
              />
            </div>
            <div className="flex gap-2 mb-6">
              <button
                onClick={handleSubmitDiary}
                disabled={saving || !diaryInput.trim()}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#6c63ff] to-[#8b85ff] text-white font-medium hover:shadow-md transition-all disabled:opacity-50"
              >
                {saving ? "分析中..." : "✍️ 提交并分析"}
              </button>
              {(diaryEntries.length > 0 || traits.length > 0) && (
                <>
                  <button
                    onClick={handleExport}
                    className="px-4 py-2.5 rounded-xl border border-amber-200 text-amber-500 text-sm hover:bg-amber-50 transition-all"
                  >
                    📤 导出
                  </button>
                  <button
                    onClick={handleReset}
                    className="px-4 py-2.5 rounded-xl border border-red-200 text-red-400 text-sm hover:bg-red-50 transition-all"
                  >
                    重置
                  </button>
                </>
              )}
            </div>

            {/* 日记列表 */}
            {diaryEntries.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-500">历史记录（{diaryEntries.length} 条）</h3>
                {[...diaryEntries].reverse().map((entry, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-xs text-gray-400">
                        {new Date(entry.timestamp).toLocaleString("zh-CN")}
                      </span>
                      <span className="text-xs text-gray-300">#{diaryEntries.length - i}</span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{entry.content}</p>
                  </div>
                ))}
              </div>
            )}

            {/* 空状态 */}
            {diaryEntries.length === 0 && (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">📖</div>
                <p className="text-sm text-gray-400">还没有日记记录，开始写第一条吧</p>
              </div>
            )}
          </div>

          {/* ── 回到首页 ── */}
          <div className="text-center py-4">
            <button
              onClick={() => router.push("/")}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              ← 返回首页
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
