"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { Header } from "@/components/Header";
import { RadarChart } from "@/components/RadarChart";
import { TagCloud } from "@/components/TagCloud";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { httpGet, httpPost } from "@/lib/http";
import { detectContradictions } from "@/lib/dimensions";
import dynamic from "next/dynamic";

// 懒加载图像生成器（AI 响应慢，不随主页面一起加载）
const PortraitGenerator = dynamic(
  () => import("@/components/PortraitGenerator"),
  {
    loading: () => null, // 不显示 fallback，由组件内部按钮触发
    ssr: false,
  }
);

export default function CharacterDetailPage() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const params = useParams();
  const [character, setCharacter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [simulateMode, setSimulateMode] = useState<"analysis" | "dialogue" | "preview">("analysis");
  const [userAction, setUserAction] = useState("");
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);
  const [counterfactualInput, setCounterfactualInput] = useState("");
  const [counterfactualResult, setCounterfactualResult] = useState<any>(null);
  const [showBurnout, setShowBurnout] = useState(false);
  const [burnoutData, setBurnoutData] = useState<any>(null);
  const [feedback, setFeedback] = useState<"accurate" | "neutral" | "inaccurate" | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [showPerspective, setShowPerspective] = useState(false);

  // ── 持续更新：追加观察 ──
  const [newObservation, setNewObservation] = useState("");
  const [updatingObservation, setUpdatingObservation] = useState(false);
  const [showObservationInput, setShowObservationInput] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) { router.push("/login"); return; }
    loadCharacter();
  }, []);

  const loadCharacter = async () => {
    try {
      const res = await httpGet(`/api/character/${params.id}`);
      setCharacter(res.character);
    } catch (err: any) {
      alert(err.message || "加载失败");
      router.push("/");
    } finally {
      setLoading(false);
    }
  };

  const handlePortraitChange = (url: string) => {
    setCharacter((prev: any) => ({ ...prev, portraitUrl: url }));
  };

  // ── 追加观察 ──
  const handleAddObservation = async () => {
    if (!newObservation.trim()) return;
    setUpdatingObservation(true);
    try {
      const res = await httpPost("/api/character/build", {
        characterId: character.id,
        name: character.name,
        description: `追加观察：${newObservation}`,
      });
      // 更新页面数据
      setCharacter((prev: any) => ({
        ...prev,
        traits: res.traits || prev.traits,
        personalitySummary: res.summary || prev.personalitySummary,
        behaviorPatterns: res.behaviorPatterns || prev.behaviorPatterns,
        values: res.values || prev.values,
        buildSession: res.buildSession || prev.buildSession,
      }));
      setNewObservation("");
      setShowObservationInput(false);
    } catch (err: any) {
      alert("提交失败：" + err.message);
    } finally {
      setUpdatingObservation(false);
    }
  };

  const handleSimulate = async () => {
    if (!userAction.trim()) return;
    setSimulating(true);
    setSimResult(null);
    setCounterfactualResult(null);
    try {
      const res = await httpPost("/api/simulate", {
        characterId: character.id,
        userAction,
        mode: simulateMode,
      });
      if (res instanceof Response) {
        const reader = res.body?.getReader();
        if (reader) {
          const decoder = new TextDecoder();
          let done = false;
          while (!done) {
            const { done: d, value } = await reader.read();
            done = d;
            if (value) {
              const text = decoder.decode(value);
              const lines = text.split("\n").filter((l) => l.startsWith("data: "));
              for (const line of lines) {
                const data = line.slice(6);
                if (data === "[DONE]") break;
                try {
                  const parsed = JSON.parse(data);
                  setSimResult(parsed);
                } catch {}
              }
            }
          }
        }
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSimulating(false);
    }
  };

  const handleCounterfactual = async () => {
    if (!counterfactualInput.trim()) return;
    try {
      const res = await httpPost("/api/simulate/counterfactual", {
        characterId: character.id,
        originalAction: userAction || "当前行为",
        alternativeAction: counterfactualInput,
      });
      setCounterfactualResult(res);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleFeedback = async (type: "accurate" | "neutral" | "inaccurate") => {
    setFeedback(type);
    if (type === "inaccurate") {
      setShowFeedbackInput(true);
    } else {
      try {
        await httpPost("/api/feedback", { characterId: character.id, accuracy: type === "accurate" ? 5 : 3 });
      } catch {}
    }
  };

  const submitFeedbackComment = async () => {
    try {
      await httpPost("/api/feedback", { characterId: character.id, accuracy: 1, comment: feedbackComment });
      setShowFeedbackInput(false);
    } catch {}
  };

  const generateBurnoutRelief = () => {
    setShowBurnout(true);
    if (!burnoutData) {
      const contradictions = detectContradictions(character.traits || []);
      setBurnoutData({
        tips: [
          "TA这样反应不一定是你做错了什么，这与TA的性格特质有关",
          "根据分析，TA对冲突的容忍度可能较低，建议以更温和的方式沟通",
          "你已经在努力理解了，这本身就值得肯定",
        ],
        actionAdvice: {
          do: ["给TA足够的空间表达自己", "从小事开始建立信任", "保持耐心和一致性"],
          dont: ["不要在情绪激动时做重要决定", "避免在公共场合让对方难堪", "不要过度解读TA的沉默"],
        },
        perspective: contradictions.length > 0
          ? "基于TA的性格特征，TA可能自己也在面对一些内在矛盾。如果我是TA，我可能并不像表面看起来那么确定，内心也有不安和犹豫。"
          : "如果我是TA，我可能希望被理解而不是被评判，被接纳而不是被改变。",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#6c63ff]" />
      </div>
    );
  }
  if (!character) return null;

  const traits = character.traits || [];
  const contradictions = detectContradictions(traits);
  const analysisFailed = !traits.length || traits.every((t: any) => (t.score ?? 0) === 0);
  const modeLabels: Record<string, string> = { analysis: "🎭 冷静分析", preview: "🎬 情景预演" };

  return (
    <>
      <Header />
      <LoadingOverlay visible={simulating} />
      <main className="flex-1 py-8">
        <div className="page-container">
          <button onClick={() => router.push("/")} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-4 transition-colors">
            ← 返回首页
          </button>

          <div className="flex items-start gap-6 flex-wrap">
            {/* 角色头像 / 生成画像 */}
            <div className="flex flex-col items-center gap-2">
              {character.portraitUrl && !character.portraitUrl.includes("dicebear.com") ? (
                <img
                  src={character.portraitUrl}
                  alt={character.name}
                  className="w-20 h-20 rounded-2xl object-cover shadow-md border border-gray-100"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#6c63ff] to-[#8b85ff] flex items-center justify-center text-white text-3xl font-bold shadow-md">
                  {character.name.charAt(0)}
                </div>
              )}
              {/* 懒加载的画像生成器 — 点击按钮才加载并调用 API */}
              <PortraitGenerator
                characterId={character.id}
                characterName={character.name}
                existingPortraitUrl={character.portraitUrl}
                onPortraitChange={handlePortraitChange}
              />
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900">{character.name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-sm px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                  {character.source === "WEB" ? "🌐 网络采集" : "✍️ 用户构建"}
                </span>
                {character.source === "USER_BUILT" && character.basicInfo?.relationship && (
                  <span className="text-sm px-2 py-0.5 rounded-full bg-[#6c63ff]/5 text-[#6c63ff] border border-[#6c63ff]/10">
                    {character.basicInfo.relationship}
                  </span>
                )}
                <span className="text-xs text-gray-400">
                  创建于 {new Date(character.createdAt).toLocaleDateString("zh-CN")}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={generateBurnoutRelief} className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#ff6b6b] to-[#ffa94d] text-white text-sm font-medium hover:shadow-md transition-all">
                🧘 内耗缓解
              </button>
              <button onClick={() => router.push(`/simulate/${character.id}`)} className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#6c63ff] to-[#8b85ff] text-white text-sm font-medium hover:shadow-md transition-all">
                🧠 心理模拟
              </button>
              <button onClick={() => router.push(`/video?characterId=${character.id}`)} className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#ff6b6b] to-[#ffa94d] text-white text-sm font-medium hover:shadow-md transition-all">
                🎬 生成视频
              </button>
            </div>
          </div>

          {character.personalitySummary && (
            <div className="bg-white rounded-xl p-5 mb-6 shadow-sm border border-gray-100">
              <p className="text-gray-700 text-lg leading-relaxed">💡 {character.personalitySummary}</p>
            </div>
          )}

          {/* ── 持续更新（USER_BUILT 专用） ── */}
          {character.source === "USER_BUILT" && (
            <div className="bg-white rounded-xl p-5 mb-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-800">📝 持续完善档案</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    你对TA有了新的认识？追加描述让档案更准确
                    {character.buildSession && (
                      <span className="ml-1 text-[#6c63ff]">
                        （已完善 {character.buildSession.currentRound} 轮）
                      </span>
                    )}
                  </p>
                </div>
                {!showObservationInput && (
                  <button
                    onClick={() => setShowObservationInput(true)}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#6c63ff] to-[#8b85ff] text-white text-sm font-medium hover:shadow-md transition-all"
                  >
                    ✍️ 追加描述
                  </button>
                )}
              </div>

              {showObservationInput && (
                <div className="mt-4 animate-fade-in-up">
                  <textarea
                    value={newObservation}
                    onChange={(e) => setNewObservation(e.target.value)}
                    placeholder="描述你对TA的新观察、新认识…&#10;例如：今天我发现在压力下TA其实会…"
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#6c63ff] focus:ring-2 focus:ring-[#6c63ff]/20 outline-none transition-all resize-none"
                  />
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={handleAddObservation}
                      disabled={updatingObservation || !newObservation.trim()}
                      className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#6c63ff] to-[#8b85ff] text-white text-sm font-medium hover:shadow-md transition-all disabled:opacity-50"
                    >
                      {updatingObservation ? "分析中..." : "提交并更新档案"}
                    </button>
                    <button
                      onClick={() => { setShowObservationInput(false); setNewObservation(""); }}
                      className="px-4 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition-all"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}

              {/* 构建历史 */}
              {character.buildSession?.records?.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => setShowObservationInput(!showObservationInput)}
                    className="text-xs text-gray-400 hover:text-[#6c63ff] transition-colors"
                  >
                    查看构建历史（{character.buildSession.records.length} 轮）
                  </button>
                  <details className="mt-2">
                    <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">展开查看</summary>
                    <div className="mt-3 space-y-2">
                      {character.buildSession.records.map((record: any, i: number) => (
                        <div key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-[#6c63ff]">第 {record.roundNumber} 轮</span>
                            <span className="text-xs text-gray-400">
                              {new Date(record.createdAt).toLocaleString("zh-CN")}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">{record.userInput}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )}
            </div>
          )}

          {analysisFailed && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-5 mb-6 animate-fade-in-up">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">🚨</span>
                <div>
                  <span className="text-red-700 font-bold text-lg">分析失败</span>
                  <p className="text-sm text-red-600 mt-0.5">该人物的性格分析暂未成功生成，可能是 AI 服务异常或数据不足导致的。</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => router.push("/")}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors">
                  ← 返回重试
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-lg font-bold text-gray-800 mb-4">九维心理特征雷达图</h2>
              <RadarChart data={traits} />
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-lg font-bold text-gray-800 mb-4">人物画像卡片</h2>

              <div className="mb-5">
                <h3 className="text-sm font-medium text-gray-500 mb-2">🏷️ 性格标签</h3>
                <TagCloud traits={traits} />
              </div>

              {character.behaviorPatterns && character.behaviorPatterns.length > 0 && (
                <div className="mb-5">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">📋 行为模式</h3>
                  <div className="space-y-2">
                    {(Array.isArray(character.behaviorPatterns) ? character.behaviorPatterns : []).map((bp: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-gray-400 min-w-[60px] font-medium">{bp.scenario}:</span>
                        <span className="text-gray-600">{bp.description || bp}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {character.values && character.values.length > 0 && (
                <div className="mb-5">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">💎 核心价值观</h3>
                  <div className="flex flex-wrap gap-2">
                    {(Array.isArray(character.values) ? character.values : []).map((v: string, i: number) => (
                      <span key={i} className="text-sm px-3 py-1 rounded-full bg-[#6c63ff]/5 text-[#6c63ff] border border-[#6c63ff]/10">{v}</span>
                    ))}
                  </div>
                </div>
              )}

              {contradictions.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-amber-500 mb-2">⚠️ 矛盾点提示</h3>
                  <div className="space-y-2">
                    {contradictions.map((c: string, i: number) => (
                      <p key={i} className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">{c}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 🏆 主要成就 */}
          {character.achievements && Array.isArray(character.achievements) && character.achievements.length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-8 animate-fade-in-up">
              <h2 className="text-lg font-bold text-gray-800 mb-4">🏆 主要成就</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(Array.isArray(character.achievements) ? character.achievements : []).map((a: any, i: number) => (
                  <div key={i} className="rounded-xl p-4 border" style={{
                    backgroundColor: [ "#fef2f2", "#eff6ff", "#f0fdf4", "#fefce8", "#f5f3ff", "#fff7ed" ][i % 6],
                    borderColor: [ "#fecaca", "#bfdbfe", "#bbf7d0", "#fef08a", "#ddd6fe", "#fed7aa" ][i % 6],
                  }}>
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium mb-2" style={{
                      backgroundColor: [ "#fee2e2", "#dbeafe", "#dcfce7", "#fef9c3", "#ede9fe", "#ffedd5" ][i % 6],
                      color: [ "#b91c1c", "#1d4ed8", "#15803d", "#a16207", "#6d28d9", "#c2410c" ][i % 6],
                    }}>
                      {a.domain || "综合"}
                    </span>
                    <h4 className="font-semibold text-gray-900 text-sm mb-1">{a.title}</h4>
                    <p className="text-xs text-gray-600 leading-relaxed">{a.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 📜 生平大事 */}
          {character.keyEvents && Array.isArray(character.keyEvents) && character.keyEvents.length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-8 animate-fade-in-up">
              <h2 className="text-lg font-bold text-gray-800 mb-4">📜 生平大事</h2>
              <div className="space-y-4">
                {(Array.isArray(character.keyEvents) ? character.keyEvents : []).map((e: any, i: number) => (
                  <div key={i} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full bg-[#6c63ff] flex-shrink-0 mt-1.5" />
                      {i < (Array.isArray(character.keyEvents) ? character.keyEvents.length : 0) - 1 && (
                        <div className="w-0.5 flex-1 bg-[#6c63ff]/20 min-h-[2rem]" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-bold text-[#6c63ff]">{e.year}</span>
                        <span className="text-sm font-semibold text-gray-800">{e.event}</span>
                      </div>
                      {e.significance && (
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{e.significance}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showBurnout && burnoutData && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-8 animate-fade-in-up">
              <h2 className="text-lg font-bold text-gray-800 mb-4">🧘 内耗缓解助手</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {burnoutData.tips.map((tip: string, i: number) => (
                  <div key={i} className="bg-gradient-to-br from-[#fef2f2] to-[#fff7ed] rounded-xl p-4 border border-amber-100">
                    <span className="text-2xl mb-2 block">{["💡", "🌟", "❤️"][i]}</span>
                    <p className="text-sm text-gray-700">{tip}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                  <h4 className="text-sm font-medium text-green-700 mb-3">✅ 建议尝试</h4>
                  <ul className="space-y-2">
                    {burnoutData.actionAdvice.do.map((item: string, i: number) => (
                      <li key={i} className="text-sm text-green-600 flex items-start gap-2"><span>✅</span> {item}</li>
                    ))}
                  </ul>
                </div>
                <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                  <h4 className="text-sm font-medium text-red-700 mb-3">❌ 尽量避免</h4>
                  <ul className="space-y-2">
                    {burnoutData.actionAdvice.dont.map((item: string, i: number) => (
                      <li key={i} className="text-sm text-red-600 flex items-start gap-2"><span>❌</span> {item}</li>
                    ))}
                  </ul>
                </div>
              </div>
              {showPerspective ? (
                <div className="bg-gradient-to-br from-[#e8e6ff] to-[#f0edff] rounded-xl p-5 border border-[#6c63ff]/10">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-[#6c63ff]">🔄 换位思考 - TA的视角</h4>
                    <button onClick={() => setShowPerspective(false)} className="text-xs text-gray-400 hover:text-gray-600">收起</button>
                  </div>
                  <p className="text-gray-700 italic leading-relaxed">{burnoutData.perspective}</p>
                </div>
              ) : (
                <button onClick={() => setShowPerspective(true)} className="w-full py-3 rounded-xl bg-gradient-to-r from-[#6c63ff]/10 to-[#8b85ff]/10 text-[#6c63ff] font-medium hover:shadow-sm transition-all border border-[#6c63ff]/20">
                  🔄 换位思考 - 如果我是TA...
                </button>
              )}
            </div>
          )}

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-8">
            <h2 className="text-lg font-bold text-gray-800 mb-4">🧠 心理模拟</h2>
            <div className="flex gap-2 mb-4 flex-wrap">
              {(["analysis", "preview"] as const).map((m) => (
                <button key={m} onClick={() => m === "preview" ? router.push(`/video?characterId=${character.id}`) : setSimulateMode(m)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${simulateMode === m ? "bg-[#6c63ff] text-white shadow-sm" : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-100"}`}>
                  {modeLabels[m]}
                </button>
              ))}
              <button onClick={() => router.push(`/simulate/${character.id}`)}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all bg-gradient-to-r from-[#6c63ff] to-[#8b85ff] text-white shadow-sm hover:shadow-md">
                💬 对话模拟
              </button>
            </div>
            <div className="flex gap-2 mb-6">
              <input type="text" value={userAction} onChange={(e) => setUserAction(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSimulate()}
                placeholder={simulateMode === "analysis" ? "输入你想分析的行为或场景..." : "输入你的台词或行为..."}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:border-[#6c63ff] focus:ring-2 focus:ring-[#6c63ff]/20 outline-none transition-all" />
              <button onClick={handleSimulate} disabled={simulating || !userAction.trim()}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#6c63ff] to-[#8b85ff] text-white font-medium hover:shadow-md transition-all disabled:opacity-50">
                {simulating ? "分析中..." : "发送"}
              </button>
            </div>

            {simResult && (
              <div className="space-y-4 animate-fade-in-up">
                {simResult.reactions && simResult.reactions.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-3">📊 可能反应与概率分布</h3>
                    <div className="space-y-2">
                      {simResult.reactions.map((r: any, i: number) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-12 text-sm font-bold text-[#6c63ff] text-right">{r.probability}%</div>
                          <div className="flex-1">
                            <div className="h-6 rounded-full bg-gray-100 overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-[#6c63ff] to-[#8b85ff] transition-all duration-1000" style={{ width: `${r.probability}%` }} />
                            </div>
                          </div>
                          <span className="text-sm text-gray-600 flex-1">{r.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {simResult.psychologicalAnalysis && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">🧪 心理机制分析</h3>
                    <p className="text-sm text-gray-700 leading-relaxed">{simResult.psychologicalAnalysis}</p>
                  </div>
                )}
                {simResult.intentionInference && (
                  <div className="bg-[#e8e6ff]/50 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-[#6c63ff] mb-2">🎯 真实意图推测</h3>
                    <p className="text-sm text-gray-700 leading-relaxed">{simResult.intentionInference}</p>
                  </div>
                )}
                {simResult.adviceGiven && simResult.adviceGiven.length > 0 && (
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
                    <h3 className="text-sm font-medium text-green-700 mb-2">💡 行动建议</h3>
                    <ul className="space-y-1">
                      {simResult.adviceGiven.map((a: string, i: number) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2"><span>•</span> {a}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {simResult.simulatedResponse && (
                  <div className="bg-gradient-to-br from-[#f0edff] to-[#e8e6ff] rounded-xl p-4">
                    <h3 className="text-sm font-medium text-[#6c63ff] mb-2">💬 模拟话语</h3>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6c63ff] to-[#8b85ff] flex items-center justify-center text-white text-sm flex-shrink-0">{character.name.charAt(0)}</div>
                      <p className="text-gray-700 italic leading-relaxed">&ldquo;{simResult.simulatedResponse}&rdquo;</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-8">
            <h2 className="text-lg font-bold text-gray-800 mb-2">🔄 反事实模拟</h2>
            <p className="text-sm text-gray-400 mb-4">如果我当时没有...而是...，TA会怎么想？</p>
            <div className="flex gap-2 mb-4">
              <input type="text" value={counterfactualInput} onChange={(e) => setCounterfactualInput(e.target.value)}
                placeholder='例如："如果我当时没发那条消息"'
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:border-[#6c63ff] focus:ring-2 focus:ring-[#6c63ff]/20 outline-none transition-all" />
              <button onClick={handleCounterfactual} disabled={!counterfactualInput.trim()}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#ff6b6b] to-[#ffa94d] text-white font-medium hover:shadow-md transition-all disabled:opacity-50">
                推演
              </button>
            </div>
            {counterfactualResult && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-100 animate-fade-in-up">
                <div className="flex items-center gap-4 mb-3">
                  <span className="text-sm text-gray-500">预期改善概率</span>
                  <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden max-w-xs">
                    <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${counterfactualResult.probability}%` }} />
                  </div>
                  <span className="text-lg font-bold text-amber-600">{counterfactualResult.probability}%</span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{counterfactualResult.analysis}</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-8">
            <h2 className="text-lg font-bold text-gray-800 mb-4">📝 你觉得这次分析准吗？</h2>
            <div className="flex items-center gap-4">
              {(["accurate", "neutral", "inaccurate"] as const).map((t) => (
                <button key={t} onClick={() => handleFeedback(t)}
                  className={`px-6 py-3 rounded-xl text-lg transition-all ${
                    feedback === t
                      ? t === "accurate" ? "bg-green-100 border-2 border-green-400" : t === "neutral" ? "bg-gray-200 border-2 border-gray-400" : "bg-red-100 border-2 border-red-400"
                      : "bg-gray-50 border-2 border-transparent hover:bg-gray-100"
                  }`}>
                  {t === "accurate" ? "👍 很准" : t === "neutral" ? "🤔 一般" : "👎 不准"}
                </button>
              ))}
            </div>
            {showFeedbackInput && (
              <div className="mt-4 animate-fade-in-up">
                <textarea value={feedbackComment} onChange={(e) => setFeedbackComment(e.target.value)}
                  placeholder="哪些地方不对？TA实际上是怎样的？" rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#6c63ff] focus:ring-2 focus:ring-[#6c63ff]/20 outline-none transition-all resize-none" />
                <button onClick={submitFeedbackComment} className="mt-2 px-4 py-2 rounded-xl bg-[#6c63ff] text-white text-sm hover:shadow-md transition-all">提交反馈</button>
              </div>
            )}
          </div>

          <div className="text-center py-4">
            <p className="text-xs text-gray-400">AI分析仅供参考，真实的人是多变的</p>
            <p className="text-xs text-gray-400 mt-1">建议结合现实观察，不要完全依赖分析做决定</p>
          </div>
        </div>
      </main>
    </>
  );
}
