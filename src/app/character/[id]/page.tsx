"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";
import { httpGet, httpPost } from "@/lib/http";
import type { AnalysisProfile } from "@/lib/analysis/types";
import {
  ProfilePartView,
  PROFILE_PARTS,
  type ProfilePart,
} from "@/components/profile/ProfileView";
import { RadarChart } from "@/components/profile/RadarChart";

/**
 * 人物详情
 *
 * 页面结构按"回答三个问题"组织：
 * 1. 这个人是什么样的？（结论 + 特质）
 * 2. 为什么？（机制、假设、预测）
 * 3. 我该怎么办？（操作面板：读意图 / 预演 / 反事实）
 *
 * 移动端用横向分段导航，四个板块一屏可选，避免下拉几十屏找不到功能。
 */

const SECTIONS = [
  { key: "profile", label: "研判" },
  { key: "read", label: "读意图" },
  { key: "simulate", label: "行动" },
  { key: "history", label: "记录" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

export default function CharacterPage() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [character, setCharacter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<SectionKey>("profile");
  // 研判栏内再分 7 个模块，避免一条长页滚到底
  const [part, setPart] = useState<ProfilePart>("thesis");
  // 画像全屏预览
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    load();
  }, []);

  async function load() {
    try {
      const res = await httpGet(`/api/character/${id}`);
      setCharacter(res.character);
    } catch {
      router.push("/");
    } finally {
      setLoading(false);
    }
  }

  const profile: AnalysisProfile | null = useMemo(() => {
    const raw = character?.analysisProfile;
    if (!raw) return null;
    if (typeof raw === "object") return raw as AnalysisProfile;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, [character]);

  if (loading) {
    return (
      <div className="shell pt-10">
        <div className="h-6 w-32 rounded bg-[var(--chip-bg)] animate-pulse mb-4" />
        <div className="h-40 rounded-2xl bg-[var(--glass-2)] animate-pulse" />
      </div>
    );
  }

  if (!character) return null;

  const info = parse(character.basicInfo);
  const isPersonal = character.source === "USER_BUILT";
  const analyzed = Boolean(profile?.meta?.isAnalyzed);

  return (
    <div className="pb-6">
      {/* ═══ 头部 ═══ */}
      <header className="shell pt-5 md:pt-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-[12px] text-bone-500 hover:text-bone-200 transition-colors mb-4 -ml-1 min-h-[32px]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="m15 6-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          返回
        </button>

        <div className="flex items-start gap-4">
          <div className="shrink-0">
            <Avatar
              character={character}
              size={56}
              mdSize={68}
              onPreview={() => setPreviewing(true)}
            />
            <PortraitButton
              characterId={character.id}
              hasPortrait={Boolean(
                character.portraitUrl &&
                  !character.portraitUrl.includes("dicebear.com")
              )}
              onGenerated={(url) =>
                setCharacter((prev: any) => ({ ...prev, portraitUrl: url }))
              }
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-[24px] md:text-[30px] leading-tight text-bone-50">
                {character.name}
              </h1>
            </div>

            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {info?.relationship && (
                <span className="chip chip-jade">{info.relationship}</span>
              )}
              <span className="text-[11px] text-bone-500">
                {isPersonal ? "身边人" : "公众人物"}
              </span>
              {profile?.meta && (
                <>
                  <span className="text-bone-700 text-[11px]">·</span>
                  <span className="text-[11px] text-bone-500">
                    信息充分度{" "}
                    <span className="numeral text-bone-300">
                      {profile.meta.sufficiency}
                    </span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {!analyzed && (
          <div className="mt-4 surface p-4 border-l-2" style={{ borderLeftColor: "rgba(201,128,128,0.5)" }}>
            <div className="flex items-start gap-2.5">
              <span className="text-rose shrink-0 mt-0.5">!</span>
              <div>
                <div className="text-[13px] text-bone-100 mb-1">
                  这份档案还没有有效研判
                </div>
                <p className="text-[12px] text-bone-400 leading-relaxed">
                  {profile?.meta?.unknowns?.[0] ||
                    "AI 服务未配置或分析未完成。补充更多具体观察后可以重新研判。"}
                </p>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ═══ 分段导航 ═══ */}
      <div
        className="sticky z-20 mt-5 top-[calc(56px+var(--safe-top))] md:top-0"
        style={{
          background: "color-mix(in srgb, var(--bg-base) 88%, transparent)",
          borderTop: "1px solid var(--hairline)",
          borderBottom: "1px solid var(--hairline)",
          backdropFilter: "blur(18px) saturate(1.4)",
          WebkitBackdropFilter: "blur(18px) saturate(1.4)",
        }}
      >
        <div className="shell">
          <div className="flex scroll-x no-scrollbar -mx-1">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                className={`relative px-4 min-h-[48px] text-[13px] whitespace-nowrap transition-colors ${
                  section === s.key
                    ? "text-bone-50 font-medium"
                    : "text-bone-500"
                }`}
              >
                {s.label}
                {section === s.key && (
                  <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-amber rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ 内容 ═══ */}
      <div className="shell pt-6">
        {section === "profile" && (
          <ProfileSection
            character={character}
            profile={profile}
            part={part}
            onPartChange={setPart}
            onRetry={() => router.push("/explore")}
          />
        )}
        {section === "read" && (
          <ReadIntentSection character={character} profile={profile} />
        )}
        {section === "simulate" && <SimulateSection character={character} />}
        {section === "history" && (
          <HistorySection character={character} onUpdated={load} />
        )}
      </div>

      {previewing && (
        <PortraitLightbox
          src={character.portraitUrl}
          name={character.name}
          onClose={() => setPreviewing(false)}
        />
      )}
    </div>
  );
}

/**
 * 画像全屏预览
 *
 * 头像只有 56px，看不清细节。点击后铺满视口，
 * 支持点背景关闭、Esc 关闭，并阻止背景滚动。
 */
function PortraitLightbox({
  src,
  name,
  onClose,
}: {
  src: string;
  name: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    // 锁滚动，避免背景跟手滑动
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${name} 的画像`}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-white/80 hover:text-white press"
        style={{ background: "rgba(255,255,255,0.12)" }}
        aria-label="关闭"
        // 关闭按钮单独处理，避免和背景点击重复触发
        onClickCapture={(e) => e.stopPropagation()}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      <div
        className="max-w-full max-h-full flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={`${name} 的画像`}
          className="rounded-2xl object-contain rise"
          style={{
            maxWidth: "min(92vw, 560px)",
            maxHeight: "76vh",
            boxShadow: "0 30px 80px -20px rgba(0,0,0,0.9)",
          }}
        />
        <p className="text-[12px] text-white/55">{name}</p>
        <a
          href={src}
          download={`${name}.png`}
          target="_blank"
          rel="noreferrer"
          className="px-4 min-h-[36px] rounded-lg text-[12px] text-white/80 flex items-center"
          style={{ background: "rgba(255,255,255,0.12)" }}
        >
          保存图片
        </a>
      </div>
    </div>
  );
}

/* ══════════════ 研判板块 ══════════════ */

function ProfileSection({
  character,
  profile,
  part,
  onPartChange,
  onRetry,
}: {
  character: any;
  profile: AnalysisProfile | null;
  part: ProfilePart;
  onPartChange: (p: ProfilePart) => void;
  onRetry: () => void;
}) {
  const traits = useMemo(() => {
    const raw = character.traits;
    const arr = Array.isArray(raw) ? raw : parse(raw) || [];
    return arr.map((t: any) => ({
      code: t.code,
      name: t.name,
      score: t.score ?? 0,
      confidence: t.confidence ?? 0,
      measured: t.measured !== false && (t.confidence ?? 0) >= 30,
    }));
  }, [character.traits]);

  const hasMeasured = traits.some((t: any) => t.measured);

  if (!profile || !profile.meta?.isAnalyzed) {
    return (
      <div className="surface p-8 text-center">
        <p className="text-[14px] text-bone-300 mb-4">
          没有可展示的研判内容
        </p>
        <button onClick={onRetry} className="btn-primary">
          重新研判
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* ── 档案内分区导航 ── */}
      <div className="flex scroll-x no-scrollbar gap-1.5 pb-4 -mx-1 px-1">
        {PROFILE_PARTS.map((p) => {
          const active = part === p.key;
          return (
            <button
              key={p.key}
              onClick={() => onPartChange(p.key)}
              className={`shrink-0 px-3.5 min-h-[36px] rounded-full text-[12.5px] transition-all press ${
                active ? "font-medium" : ""
              }`}
              style={
                active
                  ? {
                      color: "var(--accent)",
                      background:
                        "color-mix(in srgb, var(--accent) 12%, transparent)",
                      border:
                        "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
                    }
                  : {
                      color: "var(--fg-4)",
                      background: "var(--chip-bg)",
                      border: "1px solid var(--border-1)",
                    }
              }
              aria-pressed={active}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* ── 分区标题 ── */}
      <p className="text-[11.5px] text-bone-500 mb-4 leading-relaxed">
        {PROFILE_PARTS.find((p) => p.key === part)?.hint}
      </p>

      <div className="space-y-8">
        {/* 雷达轮廓随「特质」板块一起看 */}
        {part === "traits" && hasMeasured && (
          <div className="surface p-4 md:p-6">
            <div className="flex items-baseline gap-2 mb-3">
              <h2 className="font-display text-[17px] text-bone-50">
                {profile?.meta?.domainName || "人格轮廓"}
              </h2>
              <span className="text-[10px] uppercase tracking-[0.2em] text-bone-600">
                Shape
              </span>
            </div>
            <RadarChart data={traits.filter((t: any) => t.measured)} />
          </div>
        )}

        <ProfilePartView profile={profile} part={part} />

        {/* 生平与成就只在「结论」板块展示，避免每页都拖长 */}
        {part === "thesis" &&
          profile.keyEvents &&
          profile.keyEvents.length > 0 && (
            <PublicBiography
              events={profile.keyEvents}
              achievements={profile.achievements || []}
            />
          )}

        {part === "thesis" && <FeedbackBar characterId={character.id} />}
      </div>
    </div>
  );
}

function PublicBiography({
  events,
  achievements,
}: {
  events: { year: string; event: string; significance: string }[];
  achievements: { domain: string; title: string; description: string }[];
}) {
  return (
    <section>
      <div className="flex items-baseline gap-2.5 mb-4">
        <h2 className="font-display text-[19px] text-bone-50">塑造 TA 的事件</h2>
        <span className="text-[10px] uppercase tracking-[0.2em] text-bone-600">
          Life
        </span>
      </div>

      <div className="space-y-0">
        {events.map((e, i) => (
          <div key={i} className="flex gap-4">
            <div className="flex flex-col items-center shrink-0 pt-1">
              <div className="w-1.5 h-1.5 rounded-full bg-amber/70" />
              {i < events.length - 1 && (
                <div className="w-px flex-1 bg-white/[0.08] my-1" />
              )}
            </div>
            <div className="pb-6 min-w-0">
              <div className="text-[11px] numeral text-amber/80">{e.year}</div>
              <div className="text-[14px] text-bone-50 mt-0.5">{e.event}</div>
              {e.significance && (
                <p className="text-[12.5px] text-bone-400 leading-relaxed mt-1">
                  {e.significance}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {achievements.length > 0 && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {achievements.map((a, i) => (
            <div key={i} className="surface p-4">
              <span className="chip text-[10px] mb-2">{a.domain}</span>
              <div className="text-[13.5px] text-bone-50 mt-1.5">{a.title}</div>
              <p className="text-[12px] text-bone-400 leading-relaxed mt-1">
                {a.description}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ══════════════ 读意图 ══════════════ */

function ReadIntentSection({
  character,
  profile,
}: {
  character: any;
  profile: AnalysisProfile | null;
}) {
  const [situation, setSituation] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const PRESETS = [
    "TA 最近回消息很慢，是不是不想理我了？",
    "我说想认真谈谈，TA 就找借口走开。",
    "TA 明明很在意我，却总说「随便你」。",
    "每次吵架后 TA 都当没发生过。",
  ];

  async function run(text?: string) {
    const q = (text ?? situation).trim();
    if (!q || loading) return;
    setSituation(q);
    setError("");
    setLoading(true);
    setResult(null);

    try {
      const res = await httpPost(`/api/character/${character.id}/read`, {
        situation: q,
      });
      setResult(res);
    } catch (e: any) {
      setError(e.message || "分析失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="surface-raised p-5">
        <h2 className="font-display text-[17px] text-bone-50 mb-1">
          这件事 TA 到底怎么想的
        </h2>
        <p className="text-[12.5px] text-bone-400 leading-relaxed mb-4">
          描述让你困惑的具体情境。会给出几种可能的解释并排序——不会假装能读心。
        </p>

        <textarea
          value={situation}
          onChange={(e) => setSituation(e.target.value)}
          placeholder="比如：我昨天说周末想见面，TA 说可能要加班，但晚上发了和朋友吃饭的照片。"
          rows={4}
          className="field mb-3"
        />

        <button
          onClick={() => run()}
          disabled={!situation.trim() || loading}
          className="btn-primary w-full"
        >
          {loading ? "正在推演……" : "分析"}
        </button>
      </div>

      {!result && !loading && (
        <div>
          <div className="text-[11px] tracking-[0.2em] uppercase text-bone-500 mb-2.5">
            常见困惑
          </div>
          <div className="space-y-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => run(p)}
                className="surface p-3.5 w-full text-left press hover:border-white/[0.12] transition-colors"
              >
                <span className="text-[13px] text-bone-200 leading-relaxed">
                  {p}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="text-[12px] text-rose bg-rose/[0.08] border border-rose/20 rounded-lg px-3 py-2.5">
          {error}
        </div>
      )}

      {loading && <IntentSkeleton />}

      {result && <IntentResult result={result} />}
    </div>
  );
}

function IntentResult({ result }: { result: any }) {
  return (
    <div className="space-y-4 rise">
      {result.mostLikely && (
        <div className="surface-raised p-5">
          <div className="text-[11px] tracking-[0.2em] uppercase text-amber/80 mb-2.5">
            最可能的解释
          </div>
          <p className="font-display text-[16px] leading-[1.8] text-bone-50">
            {result.mostLikely}
          </p>
        </div>
      )}

      {result.observedCues?.length > 0 && (
        <div className="surface p-4">
          <div className="text-[11px] tracking-[0.16em] uppercase text-bone-500 mb-2.5">
            情境里的线索
          </div>
          <ul className="space-y-1.5">
            {result.observedCues.map((c: string, i: number) => (
              <li key={i} className="text-[13px] text-bone-200 flex gap-2 leading-relaxed">
                <span className="text-bone-600 shrink-0">·</span>
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.hypotheses?.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] tracking-[0.2em] uppercase text-bone-500 mb-1">
            其他可能
          </div>
          {result.hypotheses.map((h: any, i: number) => (
            <details key={i} className="surface overflow-hidden">
              <summary className="list-none cursor-pointer p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] text-bone-100 leading-[1.65]">
                      {h.statement}
                    </p>
                    <div className="flex items-center gap-2.5 mt-2">
                      <div className="w-24 h-1 rounded-full bg-white/[0.07] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-bone-400/60"
                          style={{ width: `${h.probability}%` }}
                        />
                      </div>
                      <span className="numeral text-[11px] text-bone-400">
                        {h.probability}%
                      </span>
                    </div>
                  </div>
                </div>
              </summary>
              <div className="px-4 pb-4 space-y-2 border-t border-[var(--hairline)] pt-3">
                {h.supporting?.length > 0 && (
                  <div>
                    <div className="text-[10px] text-jade/70 mb-1">支持</div>
                    {h.supporting.map((s: string, j: number) => (
                      <p key={j} className="text-[12px] text-bone-300 leading-relaxed">
                        + {s}
                      </p>
                    ))}
                  </div>
                )}
                {h.against?.length > 0 && (
                  <div>
                    <div className="text-[10px] text-rose/70 mb-1">反对</div>
                    {h.against.map((s: string, j: number) => (
                      <p key={j} className="text-[12px] text-bone-300 leading-relaxed">
                        − {s}
                      </p>
                    ))}
                  </div>
                )}
                {h.falsifier && (
                  <p className="text-[11.5px] text-bone-400 bg-[var(--glass-2)] rounded px-2.5 py-2">
                    <span className="text-amber/70">证伪：</span>
                    {h.falsifier}
                  </p>
                )}
              </div>
            </details>
          ))}
        </div>
      )}

      {result.whatWouldTell && (
        <div className="surface p-4 border-l-2" style={{ borderLeftColor: "rgba(94,240,224,0.42)" }}>
          <div className="text-[11px] tracking-[0.16em] uppercase text-amber/80 mb-2">
            还需要观察什么
          </div>
          <p className="text-[13px] text-bone-200 leading-[1.75]">
            {result.whatWouldTell}
          </p>
        </div>
      )}

      {(result.doNext?.length > 0 || result.avoid?.length > 0) && (
        <div className="grid gap-2.5 md:grid-cols-2">
          {result.doNext?.length > 0 && (
            <div className="surface p-4">
              <div className="text-[11px] tracking-[0.16em] uppercase text-jade/80 mb-2.5">
                可以试试
              </div>
              <ul className="space-y-2.5">
                {result.doNext.map((d: any, i: number) => (
                  <li key={i}>
                    <div className="text-[13px] text-bone-100">{d.action}</div>
                    {d.why && (
                      <p className="text-[11.5px] text-bone-500 mt-0.5 leading-relaxed">
                        {d.why}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.avoid?.length > 0 && (
            <div className="surface p-4">
              <div className="text-[11px] tracking-[0.16em] uppercase text-rose/80 mb-2.5">
                别这样做
              </div>
              <ul className="space-y-2.5">
                {result.avoid.map((d: any, i: number) => (
                  <li key={i}>
                    <div className="text-[13px] text-bone-100">{d.action}</div>
                    {d.why && (
                      <p className="text-[11.5px] text-bone-500 mt-0.5 leading-relaxed">
                        {d.why}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {result.emotionalNote && (
        <div className="surface p-4 border-l-2" style={{ borderLeftColor: "rgba(127,148,173,0.4)" }}>
          <div className="text-[11px] tracking-[0.16em] uppercase text-steel mb-2">
            也说给你自己听
          </div>
          <p className="text-[13px] text-bone-200 leading-[1.8]">
            {result.emotionalNote}
          </p>
        </div>
      )}
    </div>
  );
}

function IntentSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="surface p-5 animate-pulse"
          style={{ animationDelay: `${i * 120}ms` }}
        >
          <div className="h-3 w-24 rounded bg-white/[0.06] mb-3" />
          <div className="h-3 w-full rounded bg-[var(--chip-bg)] mb-2" />
          <div className="h-3 w-4/5 rounded bg-[var(--chip-bg)]" />
        </div>
      ))}
    </div>
  );
}

/* ══════════════ 对话模拟 ══════════════ */

function SimulateSection({ character }: { character: any }) {
  const router = useRouter();

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="surface-raised p-5">
        <h2 className="font-display text-[17px] text-bone-50 mb-1.5">
          和「{character.name}」对话
        </h2>
        <p className="text-[12.5px] text-bone-400 leading-relaxed mb-5">
          以 TA 的思维方式回应你。同时可以展开看这句话背后的心理机制。
        </p>
        <Link href={`/chat/${character.id}`} className="btn-primary w-full">
          进入对话
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>

      <CounterfactualPanel character={character} />

      <div className="surface p-5">
        <h3 className="text-[14px] text-bone-50 mb-1.5">把这套理解演出来</h3>
        <p className="text-[12px] text-bone-500 leading-relaxed mb-4">
          根据研判结果生成一段情景短片，用于回看你们的互动方式。
        </p>
        <button
          onClick={() => router.push(`/video?characterId=${character.id}`)}
          className="btn-ghost w-full"
        >
          生成情景视频
        </button>
      </div>
    </div>
  );
}

function CounterfactualPanel({ character }: { character: any }) {
  const [original, setOriginal] = useState("");
  const [alternative, setAlternative] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    if (!original.trim() || !alternative.trim() || loading) return;
    setError("");
    setLoading(true);
    setResult(null);
    try {
      const res = await httpPost("/api/simulate/counterfactual", {
        characterId: character.id,
        originalAction: original,
        alternativeAction: alternative,
      });
      setResult(res);
    } catch (e: any) {
      setError(e.message || "推演失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="surface p-5">
      <h3 className="text-[14px] text-bone-50 mb-1">如果换一种做法</h3>
      <p className="text-[12px] text-bone-500 leading-relaxed mb-4">
        对比两种应对方式分别会触发对方什么机制。
      </p>

      <div className="space-y-2.5 mb-3">
        <div>
          <label className="block text-[11px] text-bone-500 mb-1.5">
            实际发生的
          </label>
          <input
            value={original}
            onChange={(e) => setOriginal(e.target.value)}
            placeholder="你当时做了什么"
            className="field"
          />
        </div>
        <div>
          <label className="block text-[11px] text-bone-500 mb-1.5">
            换成
          </label>
          <input
            value={alternative}
            onChange={(e) => setAlternative(e.target.value)}
            placeholder="如果当时那样做"
            className="field"
          />
        </div>
      </div>

      <button
        onClick={run}
        disabled={!original.trim() || !alternative.trim() || loading}
        className="btn-ghost w-full"
      >
        {loading ? "推演中……" : "推演"}
      </button>

      {error && (
        <p className="text-[12px] text-rose mt-3">{error}</p>
      )}

      {result && (
        <div className="mt-4 pt-4 border-t border-[var(--border-1)] space-y-3 rise">
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-bone-500">转变把握</span>
            <div className="flex-1 h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${result.probability}%`,
                  background: "linear-gradient(90deg,#12867c,#5ef0e0)",
                }}
              />
            </div>
            <span className="numeral text-[13px] text-bone-100">
              {result.probability}%
            </span>
          </div>
          <p className="text-[13px] text-bone-200 leading-[1.75]">
            {result.analysis}
          </p>
          {result.mechanism && (
            <p className="text-[12px] text-bone-400 leading-relaxed">
              <span className="text-bone-500">机制：</span>
              {result.mechanism}
            </p>
          )}
          {result.whatActuallyMatters && (
            <p className="text-[12.5px] text-amber/85 leading-relaxed bg-amber/[0.06] rounded-lg px-3 py-2.5">
              {result.whatActuallyMatters}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════ 观察记录 ══════════════ */

function HistorySection({
  character,
  onUpdated,
}: {
  character: any;
  onUpdated: () => void;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const records: any[] = character.buildSession?.records || [];

  async function add() {
    if (!text.trim() || saving) return;
    setError("");
    setSaving(true);
    try {
      await httpPost("/api/character/build", {
        characterId: character.id,
        name: character.name,
        description: `补充观察：${text.trim()}`,
      });
      setText("");
      setShowForm(false);
      onUpdated();
    } catch (e: any) {
      setError(e.message || "提交失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="surface-raised p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-[17px] text-bone-50 mb-1">
              持续修正
            </h2>
            <p className="text-[12.5px] text-bone-400 leading-relaxed">
              TA 做出让你意外的事时，把它记下来。研判会用新材料重新计算，
              而不是在旧结论上不断加固。
            </p>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="btn-ghost shrink-0 px-4 text-[13px]"
            >
              记一条
            </button>
          )}
        </div>

        {showForm && (
          <div className="mt-4 rise">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="具体发生了什么？TA 做了什么、说了什么，你当时怎么反应。"
              rows={4}
              className="field mb-3"
            />
            <div className="flex gap-2">
              <button
                onClick={add}
                disabled={!text.trim() || saving}
                className="btn-primary flex-1"
              >
                {saving ? "重新研判中……" : "提交并更新"}
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setText("");
                }}
                className="btn-ghost px-5"
              >
                取消
              </button>
            </div>
            {error && <p className="text-[12px] text-rose mt-2">{error}</p>}
          </div>
        )}
      </div>

      {records.length === 0 ? (
        <div className="surface p-8 text-center">
          <p className="text-[13px] text-bone-500">
            还没有观察记录
          </p>
        </div>
      ) : (
        <div>
          <div className="text-[11px] tracking-[0.2em] uppercase text-bone-500 mb-3">
            {records.length} 次观察
          </div>
          <div className="space-y-2">
            {[...records].reverse().map((r, i) => (
              <div key={i} className="surface p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-amber/70 numeral">
                    第 {records.length - i} 次
                  </span>
                  <span className="text-[10px] text-bone-600">
                    {new Date(r.createdAt).toLocaleDateString("zh-CN")}
                  </span>
                </div>
                <p className="text-[13px] text-bone-200 leading-[1.7] whitespace-pre-wrap">
                  {r.userInput}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 工具 ── */

function Avatar({
  character,
  size,
  mdSize,
  onPreview,
}: {
  character: any;
  size: number;
  mdSize?: number;
  onPreview?: () => void;
}) {
  const valid =
    character.portraitUrl && !character.portraitUrl.includes("dicebear.com");
  const s = mdSize || size;

  if (valid) {
    return (
      <button
        onClick={onPreview}
        className="relative rounded-2xl overflow-hidden shrink-0 press group"
        style={{ width: size, height: size }}
        aria-label="查看大图"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={character.portraitUrl}
          alt=""
          className="w-full h-full object-cover border border-[var(--border-2)] rounded-2xl"
        />
        {/* 放大提示：不点也能看出可以点 */}
        <span
          className="absolute inset-0 flex items-center justify-center rounded-2xl opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity"
          style={{ background: "rgba(0,0,0,0.42)" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-white">
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" />
            <path d="m16 16 4 4M11 8.5v5M8.5 11h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </span>
      </button>
    );
  }

  return (
    <div
      className="rounded-2xl shrink-0 flex items-center justify-center border border-[var(--border-2)] bg-ink-750 text-bone-200"
      style={{ width: size, height: size }}
    >
      <span className="font-display" style={{ fontSize: s * 0.42 }}>
        {character.name.charAt(0)}
      </span>
    </div>
  );
}

function parse(v: any) {
  if (!v) return null;
  if (typeof v === "object") return v;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

/**
 * 生成画像按钮
 *
 * 关键修复：画像生成要几十秒，旧版点击后只有按钮文字变化，用户看不到任何反馈，
 * 容易当成卡死而离开页面，结果生成白白中断。
 *
 * 现在：点击立即出现带进度条的面板 + 分阶段的提示语 + 预计耗时，
 * 并在生成期间拦截路由离开（beforeunload），避免误操作导致白等。
 */
function PortraitButton({
  characterId,
  hasPortrait,
  onGenerated,
}: {
  characterId: number;
  hasPortrait: boolean;
  onGenerated: (url: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");

  // 生成期间按秒计时，让用户知道系统在动
  useEffect(() => {
    if (!loading) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [loading]);

  // 生成期间离开页面会丢失结果，给出原生二次确认
  useEffect(() => {
    if (!loading) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [loading]);

  async function generate(force = false) {
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const res = await httpPost<{ portraitUrl: string }>(
        "/api/character/generate-portrait",
        // force 让服务端跳过缓存，否则已有画像时会直接返回旧的，
        // 用户改了画风也看不到变化
        { characterId, force }
      );
      if (res?.portraitUrl) onGenerated(res.portraitUrl);
    } catch (e: any) {
      setError(e.message || "生成失败，请重试");
    } finally {
      setLoading(false);
    }
  }

  const STAGES = [
    { at: 0, text: "正在读取人格档案……" },
    { at: 6, text: "正在构思视觉形象……" },
    { at: 18, text: "正在绘制细节……" },
    { at: 35, text: "即将完成，请稍候……" },
  ];
  const stage = [...STAGES].reverse().find((s) => elapsed >= s.at) || STAGES[0];
  // 20 秒左右通常出图；超过 60 秒就不敢再给了
  const pct = Math.min(94, Math.round((elapsed / 25) * 100));

  if (loading) {
    return (
      <div className="mt-2 w-40 md:w-44 rise">
        <div className="surface p-2.5">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="w-1.5 h-1.5 rounded-full blink shrink-0"
              style={{ background: "var(--accent)" }}
            />
            <span className="text-[10.5px] text-bone-300 truncate">
              {stage.text}
            </span>
          </div>
          <div className="h-[3px] rounded-full overflow-hidden relative" style={{ background: "var(--hairline)" }}>
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{
                width: `${pct}%`,
                background: "linear-gradient(90deg, var(--accent-deep), var(--accent))",
              }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[9.5px] text-bone-600 numeral">{elapsed}s</span>
            <span className="text-[9.5px] text-bone-600">请勿离开此页</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1.5 w-40 md:w-44">
      <button
        onClick={() => generate(hasPortrait)}
        className="w-full min-h-[34px] rounded-lg text-[10.5px] transition-colors flex items-center justify-center gap-1.5"
        style={{
          color: "var(--fg-4)",
          background: "var(--chip-bg)",
          border: "1px solid var(--border-1)",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M20 11a8 8 0 1 0-.9 4.2M20 5v6h-6"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {hasPortrait ? "重新生成" : "生成画像"}
      </button>
      {error && (
        <p className="text-[9.5px] text-rose leading-tight mt-0.5 text-center">
          {error}
        </p>
      )}
    </div>
  );
}

/** 研判准确度反馈 —— 只问一件事：这个判断对不对 */
function FeedbackBar({ characterId }: { characterId: number }) {
  const [sent, setSent] = useState<null | "yes" | "partly" | "no">(null);
  const [comment, setComment] = useState("");
  const [open, setOpen] = useState(false);

  async function submit(kind: "yes" | "partly" | "no", note?: string) {
    setSent(kind);
    const accuracy = kind === "yes" ? 5 : kind === "partly" ? 3 : 1;
    try {
      await httpPost("/api/feedback", {
        characterId,
        accuracy,
        comment: note || undefined,
      });
    } catch {}
  }

  if (sent) {
    return (
      <div className="surface p-4 text-center">
        <p className="text-[12.5px] text-bone-400">
          已记录。你的反馈会影响后续研判的取舍。
        </p>
      </div>
    );
  }

  return (
    <div className="surface p-4">
      <p className="text-[12.5px] text-bone-300 mb-3 text-center">
        这份研判贴近 TA 的真实样子吗？
      </p>

      {!open ? (
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["yes", "贴得住"],
              ["partly", "部分符合"],
              ["no", "不像"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => {
                if (key === "no") {
                  setOpen(true);
                  return;
                }
                submit(key);
              }}
              className="min-h-[44px] rounded-xl border border-[var(--border-2)] text-[12.5px] text-bone-300 hover:border-[var(--border-hi)] hover:text-bone-100 transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
      ) : (
        <div className="rise">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="哪里不像？TA 实际上是什么样的？具体例子最有帮助。"
            rows={3}
            className="field mb-2.5"
          />
          <div className="flex gap-2">
            <button
              onClick={() => submit("no", comment)}
              disabled={!comment.trim()}
              className="btn-ghost flex-1 text-[13px]"
            >
              提交
            </button>
            <button
              onClick={() => setOpen(false)}
              className="btn-ghost px-4 text-[13px]"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
