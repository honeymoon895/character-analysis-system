"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { httpGet, httpPost } from "@/lib/http";

const SCENE_TYPES = [
  { id: "daily", label: "日常相处", desc: "轻松的聊天与陪伴" },
  { id: "conflict", label: "冲突时刻", desc: "观点冲撞、情绪张力" },
  { id: "warm", label: "温暖瞬间", desc: "被看见、被接住的时刻" },
  { id: "custom", label: "自由描述", desc: "写下你想要的场景" },
];

const SCENE_PROMPTS: Record<string, string> = {
  daily: "日常对话场景，氛围轻松自然，人物表情温和",
  conflict: "两人对话场景，氛围紧张，人物表情专注严肃",
  warm: "温馨感人的画面，光线柔和，人物表情温暖",
};

const DURATIONS = [5, 10, 15, 30, 60];

export default function VideoPage() {
  return (
    <Suspense
      fallback={
        <div className="shell pt-10">
          <div className="h-32 rounded-2xl bg-white/[0.03] animate-pulse" />
        </div>
      }
    >
      <VideoContent />
    </Suspense>
  );
}

function VideoContent() {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const characterId = searchParams.get("characterId");

  const [step, setStep] = useState(1);
  const [sceneType, setSceneType] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [includeMe, setIncludeMe] = useState(true);
  const [includeTa, setIncludeTa] = useState(true);
  const [duration, setDuration] = useState(5);

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [stitched, setStitched] = useState(false);
  const [segments, setSegments] = useState(0);
  const [error, setError] = useState("");

  const [character, setCharacter] = useState<any>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    if (characterId) loadCharacter();
  }, []);

  async function loadCharacter() {
    try {
      const res = await httpGet(`/api/character/${characterId}`);
      setCharacter(res.character);
    } catch {}
  }

  function buildFinalPrompt(): string {
    if (sceneType === "custom") return customPrompt;
    const base = SCENE_PROMPTS[sceneType] || "";
    const name = character?.name || "TA";
    const parts = [base, `画面中有${name}`];
    if (includeMe) parts.push("（也包括「我」）");
    parts.push("电影级画面，自然光，细腻情绪");
    return parts.join("，");
  }

  const publicUrl = (url?: string) =>
    url && url.startsWith("http") ? url : undefined;

  async function generate() {
    setGenerating(true);
    setProgress("正在创建任务……");
    setVideoUrl("");
    setError("");
    try {
      const res = await httpPost("/api/video/generate", {
        characterId: characterId ? parseInt(characterId) : undefined,
        prompt: buildFinalPrompt(),
        duration,
        imageUrl: publicUrl(user?.avatar),
        characterImageUrl: publicUrl(character?.portraitUrl),
      });
      if (res.videoUrl) {
        setVideoUrl(res.videoUrl);
        setStitched(Boolean(res.stitched));
        setSegments(res.segments || 0);
        setProgress("生成完成");
      }
    } catch (e: any) {
      setError(e.message || "生成失败");
      setProgress("");
    } finally {
      setGenerating(false);
    }
  }

  function reset() {
    setStep(1);
    setSceneType("");
    setCustomPrompt("");
    setIncludeMe(true);
    setIncludeTa(true);
    setDuration(5);
    setVideoUrl("");
    setProgress("");
    setError("");
  }

  const fullUrl = (u: string) =>
    u.startsWith("http") ? u : window.location.origin + u;

  return (
    <div className="shell pt-5 md:pt-8 pb-10 max-w-2xl">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-[12px] text-bone-500 hover:text-bone-200 transition-colors mb-5 -ml-1 min-h-[32px]"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="m15 6-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        返回
      </button>

      <header className="mb-6 rise">
        <div className="text-[11px] tracking-[0.22em] uppercase text-bone-500 mb-2">
          情景短片
        </div>
        <h1 className="font-display text-[24px] md:text-[28px] text-bone-50">
          {character ? `把与「${character.name}」的互动演出来` : "生成情景短片"}
        </h1>
        <p className="text-[12.5px] text-bone-500 mt-2 leading-relaxed">
          用画面回看你们的相处方式，有时比文字分析更直观。
        </p>
      </header>

      {/* 步骤指示 */}
      <div className="flex gap-1 mb-5">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className="flex-1 h-[2px] rounded-full transition-colors"
            style={{
              background:
                s <= step ? "rgba(217,167,92,0.7)" : "rgba(255,255,255,0.07)",
            }}
          />
        ))}
      </div>

      <div className="surface-raised p-5 md:p-6 mb-4">
        {character && (
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/[0.07]">
            <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 border border-white/10 bg-ink-750 flex items-center justify-center">
              {character.portraitUrl &&
              !character.portraitUrl.includes("dicebear.com") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={character.portraitUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="font-display text-[13px] text-bone-200">
                  {character.name.charAt(0)}
                </span>
              )}
            </div>
            <span className="text-[13px] text-bone-300">
              关于 <span className="text-bone-50">{character.name}</span>
            </span>
          </div>
        )}

        {step === 1 && (
          <div className="rise">
            <h2 className="text-[14px] text-bone-50 mb-4">选择场景</h2>
            <div className="grid grid-cols-2 gap-2.5">
              {SCENE_TYPES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSceneType(s.id)}
                  className={`p-4 rounded-xl border text-left transition-colors ${
                    sceneType === s.id
                      ? "border-amber/40 bg-amber/[0.06]"
                      : "border-white/[0.07] hover:border-white/[0.12]"
                  }`}
                >
                  <div className="text-[13.5px] text-bone-50 mb-1">{s.label}</div>
                  <div className="text-[11px] text-bone-500 leading-relaxed">
                    {s.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="rise">
            <h2 className="text-[14px] text-bone-50 mb-1">
              {sceneType === "custom" ? "描述场景" : "补充细节"}
            </h2>
            <p className="text-[12px] text-bone-500 mb-4">
              {sceneType === "custom"
                ? "写清楚地点、时间、人物动作与氛围"
                : "可以留空，也可以用一句话限定场景"}
            </p>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder={
                sceneType === "custom"
                  ? "比如：深夜的厨房，只有一盏灯亮着，两个人背对背站着，谁也没开口。"
                  : "比如：傍晚的咖啡店，靠窗的位置，外面在下雨。"
              }
              rows={5}
              className="field"
            />
            {sceneType !== "custom" && (
              <div className="mt-3 bg-white/[0.025] rounded-xl px-3.5 py-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-bone-600 mb-1.5">
                  将用于生成
                </div>
                <p className="text-[12px] text-bone-400 leading-relaxed">
                  {buildFinalPrompt()}
                </p>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="rise">
            <h2 className="text-[14px] text-bone-50 mb-1">画面里有谁</h2>
            <p className="text-[12px] text-bone-500 mb-4">
              有头像的会作为人物参考
            </p>

            <div className="space-y-2">
              <Toggle
                checked={includeMe}
                onChange={setIncludeMe}
                label="我"
                avatar={user?.avatar}
                initial={(user?.username || "我").charAt(0)}
              />
              {character && (
                <Toggle
                  checked={includeTa}
                  onChange={setIncludeTa}
                  label={character.name}
                  avatar={
                    character.portraitUrl?.includes("dicebear.com")
                      ? undefined
                      : character.portraitUrl
                  }
                  initial={character.name.charAt(0)}
                />
              )}
            </div>

            {!includeMe && !includeTa && (
              <p className="text-[11.5px] text-amber/80 mt-3">
                没有选择角色，将仅按场景描述生成
              </p>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="rise">
            <h2 className="text-[14px] text-bone-50 mb-1">时长</h2>
            <p className="text-[12px] text-bone-500 mb-4">
              超过 18 秒会自动分段生成再拼接，耗时更长
            </p>

            <div className="flex gap-2 flex-wrap mb-5">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`px-4 min-h-[44px] rounded-xl border text-[13px] transition-colors ${
                    duration === d
                      ? "border-amber/40 bg-amber/[0.06] text-amber-bright"
                      : "border-white/[0.07] text-bone-400"
                  }`}
                >
                  {d}秒
                </button>
              ))}
            </div>

            <div className="bg-white/[0.025] rounded-xl px-3.5 py-3">
              <div className="text-[10px] uppercase tracking-[0.14em] text-bone-600 mb-1.5">
                最终描述
              </div>
              <p className="text-[12px] text-bone-400 leading-relaxed">
                {buildFinalPrompt()}
              </p>
              <div className="flex flex-wrap gap-3 mt-2.5 text-[11px] text-bone-600">
                <span>{duration} 秒</span>
                {includeMe && <span>包含「我」</span>}
                {character && includeTa && <span>包含「{character.name}」</span>}
                {duration > 18 && <span>分 {Math.ceil(duration / 18)} 段生成</span>}
              </div>
            </div>
          </div>
        )}

        {/* 导航 */}
        <div className="flex gap-2 mt-6 pt-4 border-t border-white/[0.07]">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="btn-ghost px-5"
            >
              上一步
            </button>
          )}
          <div className="flex-1" />
          {step < 4 ? (
            <button
              onClick={() => {
                if (step === 1 && !sceneType) return;
                if (step === 2 && sceneType === "custom" && !customPrompt.trim())
                  return;
                setStep(step + 1);
              }}
              disabled={
                (step === 1 && !sceneType) ||
                (step === 2 && sceneType === "custom" && !customPrompt.trim())
              }
              className="btn-primary px-6"
            >
              下一步
            </button>
          ) : (
            <button
              onClick={generate}
              disabled={generating}
              className="btn-primary px-6"
            >
              {generating ? "生成中……" : "开始生成"}
            </button>
          )}
        </div>
      </div>

      {progress && (
        <div className="surface p-4 mb-4 rise">
          <div className="flex items-center gap-2.5">
            {generating && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber blink shrink-0" />
            )}
            <span className="text-[13px] text-bone-200">{progress}</span>
          </div>
          {generating && (
            <div className="mt-3 h-0.5 rounded-full bg-white/[0.07] overflow-hidden relative">
              <div className="absolute inset-0 sweep" />
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="text-[12.5px] text-rose bg-rose/[0.08] border border-rose/20 rounded-xl px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {videoUrl && (
        <div className="surface-raised p-4 md:p-5 rise">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] text-bone-50">生成结果</h2>
            <div className="flex gap-2">
              {stitched && (
                <span className="chip">{segments} 段拼接</span>
              )}
              <span className="chip chip-jade">{duration} 秒</span>
            </div>
          </div>

          <video
            controls
            autoPlay
            className="w-full rounded-xl bg-black"
            style={{ maxHeight: 500 }}
          >
            <source src={fullUrl(videoUrl)} type="video/mp4" />
          </video>

          <div className="flex gap-2 mt-3">
            <a
              href={fullUrl(videoUrl)}
              download
              className="btn-primary flex-1"
            >
              下载
            </a>
            <button onClick={reset} className="btn-ghost px-5">
              再做一个
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  avatar,
  initial,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  avatar?: string;
  initial: string;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-colors ${
        checked
          ? "border-amber/35 bg-amber/[0.05]"
          : "border-white/[0.07]"
      }`}
    >
      <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 border border-white/10 bg-ink-750 flex items-center justify-center">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-[12px] text-bone-300">{initial}</span>
        )}
      </div>
      <span className="text-[13.5px] text-bone-100 flex-1 text-left">
        {label}
      </span>
      <span
        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
          checked
            ? "border-amber/60 bg-amber/20"
            : "border-white/15"
        }`}
      >
        {checked && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-amber-bright">
            <path d="m5 12.5 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </button>
  );
}
