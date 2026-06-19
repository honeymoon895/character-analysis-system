"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { Header } from "@/components/Header";
import { httpGet, httpPost } from "@/lib/http";

export default function VideoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#6c63ff]" />
      </div>
    }>
      <VideoGenerateContent />
    </Suspense>
  );
}

// ─── 场景类型预设 ─────────────────────────────
const SCENE_TYPES = [
  { id: "daily", label: "💬 日常对话", icon: "☕", desc: "日常聊天、相处的温馨场景" },
  { id: "conflict", label: "⚡ 冲突时刻", icon: "💥", desc: "观点冲突、情绪波动的场景" },
  { id: "warm", label: "🌅 温馨时刻", icon: "🌟", desc: "感动、温暖、治愈的瞬间" },
  { id: "custom", label: "✍️ 自定义", icon: "🎬", desc: "自由描述你想要的场景" },
];

const SCENE_PROMPTS: Record<string, string> = {
  daily: "请生成一段日常对话场景的视频，氛围轻松自然，人物表情温和",
  conflict: "请生成一段冲突场景的视频，情绪张力强，人物表情严肃",
  warm: "请生成一段温馨感人的视频，光线柔和，人物表情温暖",
};

const DURATION_OPTIONS = [5, 10, 15, 30, 60];

function VideoGenerateContent() {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const characterId = searchParams.get("characterId");

  // ── 步骤状态 ──
  const [step, setStep] = useState(1);
  const [sceneType, setSceneType] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [includeMe, setIncludeMe] = useState(true);
  const [includeTa, setIncludeTa] = useState(true);
  const [duration, setDuration] = useState(5);

  // ── 生成状态 ──
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState("");
  const [progressDetail, setProgressDetail] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [stitched, setStitched] = useState(false);
  const [segments, setSegments] = useState(0);
  const [error, setError] = useState("");

  // ── 角色数据 ──
  const [character, setCharacter] = useState<any>(null);

  useEffect(() => {
    if (!isAuthenticated()) { router.push("/login"); return; }
    if (characterId) loadCharacter();
  }, []);

  const loadCharacter = async () => {
    try {
      const res = await httpGet(`/api/character/${characterId}`);
      setCharacter(res.character);
    } catch {}
  };

  // ── 获取最终 prompt ──
  const buildFinalPrompt = (): string => {
    if (sceneType === "custom") return customPrompt;
    const base = SCENE_PROMPTS[sceneType] || "";
    const charName = character?.name || "TA";
    const mePart = includeMe ? "（画面中包括「我」）" : "";
    const taPart = includeTa ? `（画面中包括「${charName}」）` : "";
    return `${base}，场景中有${charName}${mePart}${taPart}。电影级画质，自然光线，细腻情感表达。`;
  };

  // ── 提交生成 ──
  const handleGenerate = async () => {
    setGenerating(true);
    setProgress("正在准备...");
    setVideoUrl("");
    setError("");

    try {
      const finalPrompt = buildFinalPrompt();
      setProgress("正在创建视频任务...");

      // 获取图片 URL（只传公网可访问的，本地 localhost 的跳过）
      const toPublicUrl = (url: string | undefined): string | undefined => {
        if (!url) return undefined;
        if (url.startsWith("http")) return url; // 已经是公网 URL（dicebear 等）
        if (url.startsWith("/uploads/")) return undefined; // 本地文件，跳过
        return undefined;
      };

      const res = await httpPost("/api/video/generate", {
        characterId: characterId ? parseInt(characterId) : undefined,
        prompt: finalPrompt,
        duration,
        imageUrl: toPublicUrl(user?.avatar),
        characterImageUrl: toPublicUrl(character?.portraitUrl),
      });

      if (res.videoUrl) {
        setVideoUrl(res.videoUrl);
        setStitched(res.stitched);
        setSegments(res.segments);
        setProgress("✅ 生成完成！");
      }
    } catch (err: any) {
      setError(err.message || "生成失败");
      setProgress("❌ 生成失败");
    } finally {
      setGenerating(false);
    }
  };

  // ── 重置 ──
  const handleReset = () => {
    setStep(1);
    setSceneType("");
    setCustomPrompt("");
    setIncludeMe(true);
    setIncludeTa(true);
    setDuration(5);
    setVideoUrl("");
    setProgress("");
    setError("");
  };

  if (!isAuthenticated()) return null;

  // ── 查看当前角色头像URL格式 ──
  const getFullUrl = (url: string) => {
    if (url.startsWith("http")) return url;
    return window.location.origin + url;
  };

  return (
    <>
      <Header />
      <main className="flex-1 py-8">
        <div className="page-container max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => router.back()}
              className="text-gray-400 hover:text-gray-600"
            >
              ← 返回
            </button>
            <h1 className="text-2xl font-bold text-gray-900">🎬 AI 视频生成</h1>
          </div>

          {/* 进度条 */}
          <div className="flex gap-1 mb-6">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`flex-1 h-1.5 rounded-full transition-all ${
                  s <= step ? "bg-[#6c63ff]" : "bg-gray-200"
                }`}
              />
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            {character && (
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-50">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6c63ff] to-[#8b85ff] flex items-center justify-center text-white text-sm font-bold overflow-hidden">
                  {character.portraitUrl?.includes("dicebear.com") ? (
                    character.name.charAt(0)
                  ) : (
                    <img src={character.portraitUrl} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <span className="text-sm text-gray-600">
                  生成关于 <strong>{character.name}</strong> 的视频
                </span>
              </div>
            )}

            {!character && characterId && (
              <div className="text-center py-8 text-gray-400">
                加载角色信息中...
              </div>
            )}

            {/* ══════ Step 1: 场景类型 ══════ */}
            {step === 1 && (
              <div className="animate-fade-in-up">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">选择场景类型</h2>
                <div className="grid grid-cols-2 gap-3">
                  {SCENE_TYPES.map((st) => (
                    <button
                      key={st.id}
                      onClick={() => setSceneType(st.id)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        sceneType === st.id
                          ? "border-[#6c63ff] bg-[#6c63ff]/5"
                          : "border-gray-100 hover:border-gray-200"
                      }`}
                    >
                      <div className="text-2xl mb-2">{st.icon}</div>
                      <div className="font-medium text-sm text-gray-800">{st.label}</div>
                      <div className="text-xs text-gray-400 mt-1">{st.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ══════ Step 2: 场景描述 ══════ */}
            {step === 2 && (
              <div className="animate-fade-in-up">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                  {sceneType === "custom" ? "详细描述你想要的场景" : "补充场景细节（可选）"}
                </h2>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder={
                    sceneType === "custom"
                      ? "请详细描述视频的场景、人物、氛围、动作等..."
                      : "可以补充更多细节，例如：傍晚的咖啡厅、柔和的灯光..."
                  }
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#6c63ff] focus:ring-2 focus:ring-[#6c63ff]/20 outline-none transition-all resize-none"
                />
                {sceneType !== "custom" && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-500">基础描述：</p>
                    <p className="text-sm text-gray-700 mt-1">{buildFinalPrompt()}</p>
                  </div>
                )}
              </div>
            )}

            {/* ══════ Step 3: 角色设定 ══════ */}
            {step === 3 && (
              <div className="animate-fade-in-up">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">画面角色</h2>
                <p className="text-sm text-gray-500 mb-6">
                  选择哪些角色出现在视频中，系统会自动使用对应头像作为参考
                </p>

                <div className="space-y-4">
                  <label className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-gray-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeMe}
                      onChange={(e) => setIncludeMe(e.target.checked)}
                      className="w-5 h-5 rounded text-[#6c63ff] focus:ring-[#6c63ff]"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4a90d9] to-[#6cb4ee] flex items-center justify-center text-white text-xs font-bold overflow-hidden">
                          {user?.avatar ? (
                            <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            "我"
                          )}
                        </div>
                        <span className="font-medium text-gray-800">我</span>
                      </div>
                      {user?.avatar && (
                        <p className="text-xs text-gray-400 mt-1">将使用当前头像作为人物参考</p>
                      )}
                    </div>
                  </label>

                  {character && (
                    <label className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-gray-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeTa}
                        onChange={(e) => setIncludeTa(e.target.checked)}
                        className="w-5 h-5 rounded text-[#6c63ff] focus:ring-[#6c63ff]"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6c63ff] to-[#8b85ff] flex items-center justify-center text-white text-xs font-bold overflow-hidden">
                            {character.portraitUrl?.includes("dicebear.com") ? (
                              character.name.charAt(0)
                            ) : (
                              <img src={character.portraitUrl} alt="" className="w-full h-full object-cover" />
                            )}
                          </div>
                          <span className="font-medium text-gray-800">{character.name}</span>
                        </div>
                        {character.portraitUrl && (
                          <p className="text-xs text-gray-400 mt-1">将使用角色头像作为人物参考</p>
                        )}
                      </div>
                    </label>
                  )}

                  {!includeMe && !includeTa && (
                    <p className="text-xs text-amber-500">
                      提示：未选择任何角色，将根据场景描述纯文本生成
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ══════ Step 4: 时长 + 生成 ══════ */}
            {step === 4 && (
              <div className="animate-fade-in-up">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">视频时长</h2>
                <p className="text-sm text-gray-500 mb-6">
                  {duration > 18
                    ? `超过 18 秒的视频将自动分段生成后拼接`
                    : `单段生成，无需拼接`}
                </p>

                <div className="flex gap-2 mb-6 flex-wrap">
                  {DURATION_OPTIONS.map((d) => (
                    <button
                      key={d}
                      onClick={() => setDuration(d)}
                      className={`px-5 py-3 rounded-xl border-2 transition-all ${
                        duration === d
                          ? "border-[#6c63ff] bg-[#6c63ff]/5 text-[#6c63ff] font-medium"
                          : "border-gray-100 text-gray-600 hover:border-gray-200"
                      }`}
                    >
                      {d < 60 ? `${d}秒` : `${Math.floor(d / 60)}分${d % 60}秒`}
                      {d > 18 && <span className="block text-[10px] text-gray-400">等待时间较长</span>}
                    </button>
                  ))}
                </div>

                {/* 最终预览 */}
                <div className="bg-gray-50 rounded-xl p-4 mb-6">
                  <p className="text-xs text-gray-500 mb-2">📋 最终描述：</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{buildFinalPrompt()}</p>
                  <div className="flex gap-4 mt-3 text-xs text-gray-400">
                    <span>⏱ {duration}秒</span>
                    {includeMe && <span>👤 包含"我"</span>}
                    {character && includeTa && <span>👥 包含"{character.name}"</span>}
                    {duration > 18 && <span>🔗 将拼接 {Math.ceil(duration / 18)} 段</span>}
                  </div>
                </div>
              </div>
            )}

            {/* ══════ Step 导航按钮 ══════ */}
            <div className="flex justify-between mt-6 pt-4 border-t border-gray-100">
              {step > 1 ? (
                <button
                  onClick={() => setStep(step - 1)}
                  className="px-6 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
                >
                  上一步
                </button>
              ) : (
                <div />
              )}

              {step < 4 ? (
                <button
                  onClick={() => {
                    if (step === 1 && !sceneType) { alert("请选择场景类型"); return; }
                    if (step === 2 && sceneType === "custom" && !customPrompt.trim()) { alert("请输入场景描述"); return; }
                    setStep(step + 1);
                  }}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#6c63ff] to-[#8b85ff] text-white font-medium hover:shadow-md transition-all"
                >
                  下一步
                </button>
              ) : (
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-[#6c63ff] to-[#8b85ff] text-white font-medium hover:shadow-md transition-all disabled:opacity-50"
                >
                  {generating ? "生成中..." : "🎬 开始生成"}
                </button>
              )}
            </div>
          </div>

          {/* ══════ 生成进度 ══════ */}
          {progress && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-6 animate-fade-in-up">
              <div className="flex items-center gap-3">
                {generating && (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#6c63ff]" />
                )}
                <span className="text-sm text-gray-700">{progress}</span>
              </div>
              {progressDetail && (
                <p className="text-xs text-gray-400 mt-2">{progressDetail}</p>
              )}
              {generating && (
                <div className="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#6c63ff] to-[#8b85ff] animate-pulse w-2/3" />
                </div>
              )}
            </div>
          )}

          {/* ══════ 错误提示 ══════ */}
          {error && (
            <div className="bg-red-50 rounded-xl p-4 border border-red-100 mb-6 animate-fade-in-up">
              <p className="text-sm text-red-600">❌ {error}</p>
            </div>
          )}

          {/* ══════ 视频播放 ══════ */}
          {videoUrl && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 animate-fade-in-up">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-800">🎬 生成结果</h2>
                <div className="flex gap-2">
                  {stitched && (
                    <span className="text-xs px-2 py-1 rounded-full bg-[#6c63ff]/5 text-[#6c63ff]">
                      已拼接 {segments} 段
                    </span>
                  )}
                  <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-600">
                    {duration}秒
                  </span>
                </div>
              </div>

              <video
                controls
                autoPlay
                className="w-full rounded-xl bg-black"
                style={{ maxHeight: "500px" }}
              >
                <source src={videoUrl.startsWith("http") ? videoUrl : getFullUrl(videoUrl)} type="video/mp4" />
                您的浏览器不支持视频播放
              </video>

              <div className="flex gap-3 mt-4">
                <a
                  href={videoUrl.startsWith("http") ? videoUrl : getFullUrl(videoUrl)}
                  download
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#6c63ff] to-[#8b85ff] text-white font-medium text-center hover:shadow-md transition-all"
                >
                  ⬇️ 下载视频
                </a>
                <button
                  onClick={handleReset}
                  className="px-6 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
                >
                  再做一个
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
