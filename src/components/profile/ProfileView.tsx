"use client";

import { useMemo } from "react";
import type {
  AnalysisProfile,
  TraitScore,
  Evidence,
} from "@/lib/analysis/types";
import { getFramework } from "@/lib/analysis/domains";

/**
 * 研判档案展示组件
 *
 * 设计意图：新档案的信息量是旧版的 10 倍以上。如果不分层，用户会被淹没。
 * 因此按「结论 → 依据 → 应用」三段式组织，每段内部再做视觉分级：
 * 主结论用大字号衬线，证据用低对比度小字并可展开，概率用条状图。
 */

/** 复合指标的说明，帮助用户理解为什么这些维度不是独立人格维度 */
const COMPOSITE_HINT: Record<string, string> = {
  DECISIVENESS: "由尽责性（审慎）与稳定性推导",
  RISK_TENDENCY: "由开放性（求新）与外向性（寻求刺激）推导",
  EMPATHY: "由宜人性（共情关怀）与开放性（情感丰富）推导",
  LEADERSHIP: "由外向性（果断自信）与尽责性推导",
};

/**
 * 档案分区
 *
 * 拆成七块而不是一整条长页：
 * 用户反馈「页面很长，虽然都有用，但一直往下滑找东西很累」。
 * 现在每块独立可切换，模块之间不互相挤压。
 */
export type ProfilePart =
  | "thesis"
  | "traits"
  | "drives"
  | "relational"
  | "hypotheses"
  | "guidance"
  | "narrative";

export const PROFILE_PARTS: { key: ProfilePart; label: string; hint: string }[] = [
  { key: "thesis", label: "结论", hint: "核心判断与机制解释" },
  { key: "traits", label: "特质", hint: "各维度评分与证据" },
  { key: "drives", label: "驱动", hint: "需要、价值与防御方式" },
  { key: "relational", label: "关系", hint: "依恋与互动模式" },
  { key: "hypotheses", label: "假设", hint: "竞争解释与可验证预测" },
  { key: "guidance", label: "建议", hint: "怎么相处、怎么避免踩雷" },
  { key: "narrative", label: "叙事", hint: "自我认知与盲区" },
];

function useOrderedTraits(profile: AnalysisProfile) {
  /**
   * 维度顺序跟随评估域。
   * 不同职业的人用不同框架（诗人看意象与语言，将领看战略与决断），
   * 所以这里不能写死一套顺序——先按域的维度定义排，再补上库里多出来的。
   */
  return useMemo(() => {
    const fw = getFramework(profile.meta?.domain);
    const order = fw.dimensions.map((d) => d.code);
    const byCode = new Map(profile.traits.map((t) => [t.code, t]));

    const ordered = order
      .map((code) => byCode.get(code))
      .filter((t): t is TraitScore => Boolean(t));

    // 模型偶尔输出定义外的维度，追加在后面而不是丢弃
    const extra = profile.traits.filter((t) => !order.includes(t.code));

    return [...ordered, ...extra];
  }, [profile.traits, profile.meta?.domain]);
}

/** 只渲染指定的一个分区 */
export function ProfilePartView({
  profile,
  part,
}: {
  profile: AnalysisProfile;
  part: ProfilePart;
}) {
  const traits = useOrderedTraits(profile);

  switch (part) {
    case "thesis":
      return (
        <div className="space-y-10">
          <CoreThesis profile={profile} />
          <DomainBanner profile={profile} />
          <Formulation profile={profile} />
          <MetaFooter profile={profile} />
        </div>
      );
    case "traits":
      return (
        <TraitSection
          traits={traits}
          sufficiency={profile.meta.sufficiency}
        />
      );
    case "drives":
      return (
        <div className="space-y-10">
          <MotivationSection profile={profile} />
          <RegulationSection profile={profile} />
        </div>
      );
    case "relational":
      return <RelationalSection profile={profile} />;
    case "hypotheses":
      return (
        <div className="space-y-10">
          <HypothesesSection profile={profile} />
          <PredictionSection profile={profile} />
        </div>
      );
    case "guidance":
      return <GuidanceSection profile={profile} />;
    case "narrative":
      return <NarrativeSection profile={profile} />;
    default:
      return null;
  }
}

/** 一次性渲染全部（用于导出、打印等场景） */
export function ProfileView({ profile }: { profile: AnalysisProfile }) {
  const traits = useOrderedTraits(profile);

  return (
    <div className="space-y-10">
      <CoreThesis profile={profile} />
      <DomainBanner profile={profile} />
      <Formulation profile={profile} />
      <TraitSection traits={traits} sufficiency={profile.meta.sufficiency} />
      <MotivationSection profile={profile} />
      <RegulationSection profile={profile} />
      <RelationalSection profile={profile} />
      <HypothesesSection profile={profile} />
      <PredictionSection profile={profile} />
      <GuidanceSection profile={profile} />
      <NarrativeSection profile={profile} />
      <MetaFooter profile={profile} />
    </div>
  );
}

/* ══════════════ 评估域说明 ══════════════ */

/**
 * 告诉用户这次用的什么尺子。
 * 为什么需要：不同人用不同框架，不说清楚会让人以为结果不可比是系统出错。
 * 同时明确标注「非实证量表」，避免把分析工具当成科学测量。
 */
function DomainBanner({ profile }: { profile: AnalysisProfile }) {
  const m = profile.meta;
  if (!m?.domainName) return null;

  return (
    <section>
      <div className="surface p-4 flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center"
          style={{
            background: "color-mix(in srgb, var(--accent) 14%, transparent)",
            border: "1px solid color-mix(in srgb, var(--accent) 26%, transparent)",
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" style={{ color: "var(--accent)" }}>
            <path d="M4 19V5M4 19h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M7.5 15.5v-4M11.5 15.5v-7M15.5 15.5v-5.5M19 15.5v-9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13.5px] text-bone-50 font-medium">
              {m.domainName}
            </span>
            {m.empirical ? (
              <span className="chip chip-jade text-[10px] py-0.5">实证量表</span>
            ) : (
              <span className="chip text-[10px] py-0.5">分析框架</span>
            )}
          </div>
          {m.domainTagline && (
            <p className="text-[12px] text-bone-400 leading-relaxed mt-1">
              {m.domainTagline}
            </p>
          )}
          <p className="text-[11px] text-bone-600 leading-relaxed mt-1.5">
            {m.empirical
              ? "大五人格模型有实证基础，但基于间接材料推断仍有误差。"
              : "这套维度是为这类人物设计的观察框架，不是经过信效度检验的心理量表。"}
          </p>
        </div>
      </div>
    </section>
  );
}

/* ══════════════ 核心结论 ══════════════ */

function CoreThesis({ profile }: { profile: AnalysisProfile }) {
  const f = profile.formulation;
  if (!f.coreThesis && !f.coreConflict) return null;

  return (
    <section className="rise">
      <div className="surface-raised p-5 md:p-7">
        <div className="flex items-center gap-2.5 mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-amber" />
          <span className="text-[11px] tracking-[0.2em] uppercase text-amber/90">
            核心研判
          </span>
          <SufficiencyPill value={profile.meta.sufficiency} />
        </div>

        <h2 className="font-display text-[22px] md:text-[28px] leading-[1.5] text-bone-50 font-normal">
          {f.coreThesis || "证据尚不足以形成稳定结论"}
        </h2>

        {f.coreConflict && (
          <div className="mt-5 pt-5 border-t border-[var(--border-1)]">
            <div className="text-[11px] tracking-[0.16em] uppercase text-bone-500 mb-2">
              内在冲突
            </div>
            <p className="text-[15px] leading-[1.75] text-bone-200">
              {f.coreConflict}
            </p>
          </div>
        )}

        {f.triggers.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {f.triggers.map((t, i) => (
              <span key={i} className="chip chip-rose">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function SufficiencyPill({ value }: { value: number }) {
  const level =
    value >= 70 ? "充分" : value >= 40 ? "有限" : "不足";
  const cls =
    value >= 70
      ? "chip-jade"
      : value >= 40
        ? "chip-amber"
        : "chip-rose";
  return (
    <span className={`chip ${cls} ml-auto`}>
      信息{level} · <span className="numeral">{value}</span>
    </span>
  );
}

/* ══════════════ 形成性解释 ══════════════ */

function Formulation({ profile }: { profile: AnalysisProfile }) {
  const f = profile.formulation;
  if (!f.viciousCycle && !f.developmentalHypothesis) return null;

  return (
    <section>
      <SectionTitle en="Formulation" cn="机制解释" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {f.viciousCycle && (
          <div className="surface p-5">
            <div className="text-[11px] tracking-[0.16em] uppercase text-bone-500 mb-2.5">
              维持循环
            </div>
            <p className="text-[14px] leading-[1.8] text-bone-200">
              {f.viciousCycle}
            </p>
          </div>
        )}
        {f.developmentalHypothesis && (
          <div className="surface p-5">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="text-[11px] tracking-[0.16em] uppercase text-bone-500">
                发展性推测
              </div>
              <span className="chip text-[10px] py-0.5">推测</span>
            </div>
            <p className="text-[14px] leading-[1.8] text-bone-200">
              {f.developmentalHypothesis}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

/* ══════════════ 人格特质 ══════════════ */

function TraitSection({
  traits,
  sufficiency,
}: {
  traits: TraitScore[];
  sufficiency: number;
}) {
  if (traits.length === 0) return null;

  return (
    <section>
      <SectionTitle
        en="Traits"
        cn="人格特质"
        hint="分数为空表示证据不足，不做猜测"
      />
      <div className="space-y-2">
        {traits.map((t) => (
          <TraitRow key={t.code} trait={t} />
        ))}
      </div>
      {sufficiency < 40 && (
        <p className="mt-4 text-[12px] text-bone-500 leading-relaxed">
          当前信息量偏低，多数维度的置信度不足以作为结论使用。补充具体观察（尤其是压力下、
          冲突中的真实反应）能显著提升准确度。
        </p>
      )}
    </section>
  );
}

function TraitRow({ trait }: { trait: TraitScore }) {
  const measured = trait.score !== null;
  const lowConfidence = trait.confidence < 45;

  return (
    <details className="surface group overflow-hidden">
      <summary className="list-none cursor-pointer select-none px-4 md:px-5 py-3.5 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[14px] text-bone-100 font-medium">
              {trait.name}
            </span>
            {trait.composite && (
              <span className="text-[10px] text-bone-500 border border-[var(--border-2)] rounded px-1.5 py-0.5">
                复合
              </span>
            )}
            {!measured && (
              <span className="text-[11px] text-bone-500">证据不足</span>
            )}
            {measured && lowConfidence && (
              <span className="text-[11px] text-amber/70">置信偏低</span>
            )}
          </div>
          {measured && trait.anchor && (
            <div className="text-[12px] text-bone-400 mt-0.5 line-clamp-1">
              {trait.anchor}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Meter value={trait.score} confidence={trait.confidence} />
          <span className="numeral text-[15px] w-8 text-right text-bone-100">
            {measured ? trait.score : "—"}
          </span>
          <Chevron />
        </div>
      </summary>

      <div className="px-4 md:px-5 pb-5 pt-1 space-y-4 border-t border-[var(--hairline)]">
        {trait.boundary && (
          <div className="text-[12px] text-bone-400 leading-relaxed bg-[var(--glass-2)] rounded-lg px-3 py-2.5">
            <span className="text-bone-500">边界：</span>
            {trait.boundary}
          </div>
        )}

        {trait.composite && COMPOSITE_HINT[trait.code] && (
          <div className="text-[12px] text-bone-500">
            {COMPOSITE_HINT[trait.code]}
            {trait.derivedFrom && ` · ${trait.derivedFrom}`}
          </div>
        )}

        <EvidenceList title="支持证据" items={trait.evidence} />
        <EvidenceList
          title="反证"
          items={trait.counterEvidence}
          emptyHint="未发现相冲突的观察——可能确实没有，也可能是样本不足"
        />

        {trait.facets && trait.facets.length > 0 && (
          <div>
            <div className="text-[11px] tracking-[0.16em] uppercase text-bone-500 mb-2">
              子面
            </div>
            <div className="space-y-1.5">
              {trait.facets.map((f, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <span className="text-[12px] text-bone-300 w-20 shrink-0 truncate">
                    {f.name}
                  </span>
                  <div className="flex-1 h-1 rounded-full bg-white/[0.07] overflow-hidden">
                    {f.score !== null && (
                      <div
                        className="h-full rounded-full bg-bone-300/70"
                        style={{ width: `${f.score}%` }}
                      />
                    )}
                  </div>
                  <span className="numeral text-[11px] text-bone-400 w-6 text-right">
                    {f.score ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

function Meter({
  value,
  confidence,
}: {
  value: number | null;
  confidence: number;
}) {
  return (
    <div className="relative w-20 md:w-28 h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
      {value !== null && (
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${value}%`,
            background:
              confidence >= 70
                ? "linear-gradient(90deg, #6fa893, #93c4b1)"
                : confidence >= 45
                  ? "linear-gradient(90deg, #12867c, #5ef0e0)"
                  : "linear-gradient(90deg, #6d675c, #8f887a)",
          }}
        />
      )}
    </div>
  );
}

function EvidenceList({
  title,
  items,
  emptyHint,
}: {
  title: string;
  items: Evidence[];
  emptyHint?: string;
}) {
  if (!items || items.length === 0) {
    if (!emptyHint) return null;
    return (
      <div>
        <div className="text-[11px] tracking-[0.16em] uppercase text-bone-500 mb-2">
          {title}
        </div>
        <p className="text-[12px] text-bone-500 italic">{emptyHint}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="text-[11px] tracking-[0.16em] uppercase text-bone-500 mb-2">
        {title}
      </div>
      <ul className="space-y-2">
        {items.map((e, i) => (
          <li key={i} className="flex gap-2.5">
            <span
              className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 strength-${e.weight}`}
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-[13px] text-bone-200 leading-[1.7]">
                {e.statement}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                <span className="text-[10px] text-bone-500">
                  {kindLabel(e.kind)}
                </span>
                {e.caveat && (
                  <span className="text-[10px] text-bone-500">
                    · 失效条件：{e.caveat}
                  </span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function kindLabel(kind: string) {
  switch (kind) {
    case "observed":
      return "直接观察";
    case "reported":
      return "本人陈述";
    case "secondhand":
      return "他人转述";
    default:
      return "推理";
  }
}

/* ══════════════ 动机 ══════════════ */

function MotivationSection({ profile }: { profile: AnalysisProfile }) {
  const m = profile.motivation;
  const has =
    m.needs.length > 0 || m.values.length > 0 || m.avoidanceGoals.length > 0;
  if (!has) return null;

  return (
    <section>
      <SectionTitle en="Motivation" cn="驱动结构" hint="TA在追求什么，又在躲避什么" />
      <div className="space-y-3">
        {m.needs.length > 0 && (
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {m.needs.map((n, i) => (
              <div key={i} className="surface p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[13px] text-bone-50 font-medium">
                    {n.need}
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-bone-500 shrink-0">
                    <path d="M4 12h14m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-[13px] text-rose/90">{n.threat}</span>
                </div>
                {n.evidence && (
                  <p className="text-[12px] text-bone-400 leading-relaxed">
                    {n.evidence}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {m.values.length > 0 && (
          <div className="surface p-4">
            <div className="text-[11px] tracking-[0.16em] uppercase text-bone-500 mb-3">
              价值排序
            </div>
            <ol className="space-y-2">
              {[...m.values]
                .sort((a, b) => a.rank - b.rank)
                .map((v, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="numeral text-[11px] text-amber/80 w-4 shrink-0 mt-0.5">
                      {v.rank}
                    </span>
                    <div className="min-w-0">
                      <span className="text-[13px] text-bone-100">{v.value}</span>
                      {v.evidence && (
                        <span className="text-[12px] text-bone-500">
                          {" "}
                          — {v.evidence}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
            </ol>
          </div>
        )}

        {m.avoidanceGoals.length > 0 && (
          <div className="surface p-4">
            <div className="text-[11px] tracking-[0.16em] uppercase text-bone-500 mb-2.5">
              回避目标
            </div>
            <ul className="space-y-1.5">
              {m.avoidanceGoals.map((g, i) => (
                <li key={i} className="text-[13px] text-bone-200 flex gap-2">
                  <span className="text-rose/70 shrink-0">×</span>
                  {g}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

/* ══════════════ 调节 ══════════════ */

function RegulationSection({ profile }: { profile: AnalysisProfile }) {
  const r = profile.regulation;
  const has =
    r.defenses.length > 0 ||
    r.attributionStyle ||
    r.emotionRegulation.length > 0 ||
    r.stressCoping;
  if (!has) return null;

  const maturityCls: Record<string, string> = {
    mature: "chip-jade",
    neurotic: "chip-amber",
    immature: "chip-rose",
  };
  const maturityLabel: Record<string, string> = {
    mature: "成熟",
    neurotic: "神经症性",
    immature: "不成熟",
  };

  return (
    <section>
      <SectionTitle en="Regulation" cn="防御与调节" hint="压力来临时，TA如何保护自己" />
      <div className="space-y-3">
        {r.defenses.length > 0 && (
          <div className="surface p-4 md:p-5">
            <div className="text-[11px] tracking-[0.16em] uppercase text-bone-500 mb-3">
              防御机制
            </div>
            <div className="space-y-3">
              {r.defenses.map((d, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className={`chip ${maturityCls[d.maturity]} shrink-0 mt-0.5`}>
                    {maturityLabel[d.maturity]}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] text-bone-100 font-medium">
                      {d.name}
                    </div>
                    <p className="text-[13px] text-bone-300 leading-relaxed mt-0.5">
                      {d.description}
                    </p>
                    {d.evidence && (
                      <p className="text-[11px] text-bone-500 mt-1">
                        依据：{d.evidence}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {r.stressCoping && (
            <div className="surface p-4">
              <div className="text-[11px] tracking-[0.16em] uppercase text-bone-500 mb-2">
                压力应对
              </div>
              <p className="text-[13px] text-bone-200 leading-[1.75]">
                {r.stressCoping}
              </p>
            </div>
          )}
          {r.attributionStyle && (
            <div className="surface p-4">
              <div className="text-[11px] tracking-[0.16em] uppercase text-bone-500 mb-2">
                归因风格
              </div>
              <p className="text-[13px] text-bone-200 leading-[1.75]">
                {r.attributionStyle}
              </p>
            </div>
          )}
        </div>

        {r.emotionRegulation.length > 0 && (
          <div className="surface p-4">
            <div className="text-[11px] tracking-[0.16em] uppercase text-bone-500 mb-2.5">
              情绪调节策略
            </div>
            <div className="flex flex-wrap gap-2">
              {r.emotionRegulation.map((s, i) => (
                <span key={i} className="chip">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ══════════════ 关系 ══════════════ */

function RelationalSection({ profile }: { profile: AnalysisProfile }) {
  const rel = profile.relational;
  const a = rel.attachment;
  const ip = rel.interpersonal;
  const hasAttachment = a.anxiety !== null || a.style !== "未测出";
  const hasInterpersonal = ip.dominance !== null || ip.affiliation !== null;

  if (!hasAttachment && !hasInterpersonal && !rel.underThreat) return null;

  return (
    <section>
      <SectionTitle en="Relational" cn="关系模式" hint="亲密与冲突中，TA会如何行动" />
      <div className="space-y-3">
        {hasAttachment && (
          <div className="surface p-4 md:p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[11px] tracking-[0.16em] uppercase text-bone-500">
                依恋倾向
              </span>
              <span className="text-[13px] text-bone-50">{a.style}</span>
              <span className="chip text-[10px] py-0.5 ml-auto">
                置信 <span className="numeral">{a.confidence}</span>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <AxisBar label="依恋焦虑" value={a.anxiety} />
              <AxisBar label="依恋回避" value={a.avoidance} />
            </div>

            {a.reasoning && (
              <p className="text-[12px] text-bone-400 leading-relaxed mt-4 pt-3 border-t border-[var(--hairline)]">
                {a.reasoning}
              </p>
            )}
          </div>
        )}

        {hasInterpersonal && (
          <div className="surface p-4 md:p-5">
            <div className="text-[11px] tracking-[0.16em] uppercase text-bone-500 mb-3">
              人际环位置
            </div>
            <div className="grid grid-cols-2 gap-4">
              <AxisBar
                label="支配 ← → 顺从"
                value={ip.dominance}
                min={-100}
                max={100}
                invert
              />
              <AxisBar
                label="疏远 ← → 亲近"
                value={ip.affiliation}
                min={-100}
                max={100}
              />
            </div>
            {ip.note && (
              <p className="text-[12px] text-bone-400 leading-relaxed mt-3">
                {ip.note}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {rel.underThreat && (
            <div className="surface p-4">
              <div className="text-[11px] tracking-[0.16em] uppercase text-bone-500 mb-2">
                不安时的策略
              </div>
              <p className="text-[13px] text-bone-200 leading-[1.75]">
                {rel.underThreat}
              </p>
            </div>
          )}
          {rel.repeatingPattern && (
            <div className="surface p-4">
              <div className="text-[11px] tracking-[0.16em] uppercase text-bone-500 mb-2">
                重复的关系模式
              </div>
              <p className="text-[13px] text-bone-200 leading-[1.75]">
                {rel.repeatingPattern}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function AxisBar({
  label,
  value,
  min = 0,
  max = 100,
  invert = false,
}: {
  label: string;
  value: number | null;
  min?: number;
  max?: number;
  invert?: boolean;
}) {
  const pct =
    value === null ? null : ((value - min) / (max - min)) * 100;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[11px] text-bone-500">{label}</span>
        <span className="numeral text-[12px] text-bone-200">
          {value ?? "—"}
        </span>
      </div>
      <div className="relative h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
        {pct !== null && (
          <div
            className="absolute inset-y-0 rounded-full"
            style={{
              left: invert && pct < 50 ? `${pct}%` : "0%",
              width: `${Math.abs(pct - (invert ? 50 : 0))}%`,
              background: "linear-gradient(90deg, #7f94ad, #a9bdd4)",
            }}
          />
        )}
      </div>
    </div>
  );
}

/* ══════════════ 竞争假设 ══════════════ */

function HypothesesSection({ profile }: { profile: AnalysisProfile }) {
  if (profile.hypotheses.length === 0) return null;

  return (
    <section>
      <SectionTitle
        en="Hypotheses"
        cn="竞争解释"
        hint="同一个行为往往有多种解释，别急着认定最直觉的那个"
      />
      <div className="space-y-2.5">
        {profile.hypotheses.map((h, i) => (
          <details key={i} className="surface overflow-hidden">
            <summary className="list-none cursor-pointer px-4 md:px-5 py-4">
              <div className="flex items-start gap-3">
                <span className="numeral text-[11px] text-bone-500 mt-1 shrink-0 w-4">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] text-bone-50 leading-[1.65]">
                    {h.statement}
                  </p>
                  <div className="flex items-center gap-3 mt-2.5">
                    <div className="flex-1 h-1 rounded-full bg-white/[0.07] overflow-hidden max-w-[180px]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${h.probability}%`,
                          background:
                            h.probability >= 60
                              ? "linear-gradient(90deg,#12867c,#5ef0e0)"
                              : "linear-gradient(90deg,#3d3a34,#6d675c)",
                        }}
                      />
                    </div>
                    <span className="numeral text-[12px] text-bone-300">
                      {h.probability}%
                    </span>
                  </div>
                </div>
                <Chevron />
              </div>
            </summary>

            <div className="px-4 md:px-5 pb-5 pt-1 border-t border-[var(--hairline)] space-y-3">
              {h.supporting.length > 0 && (
                <div>
                  <div className="text-[11px] text-jade/80 mb-1.5">支持</div>
                  <ul className="space-y-1">
                    {h.supporting.map((s, j) => (
                      <li key={j} className="text-[12px] text-bone-300 leading-relaxed flex gap-2">
                        <span className="text-jade/60">+</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {h.against.length > 0 && (
                <div>
                  <div className="text-[11px] text-rose/80 mb-1.5">反对</div>
                  <ul className="space-y-1">
                    {h.against.map((s, j) => (
                      <li key={j} className="text-[12px] text-bone-300 leading-relaxed flex gap-2">
                        <span className="text-rose/60">−</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {h.falsifier && (
                <div className="bg-[var(--glass-2)] rounded-lg px-3 py-2.5">
                  <span className="text-[11px] text-amber/80">如何证伪：</span>
                  <span className="text-[12px] text-bone-300 leading-relaxed">
                    {h.falsifier}
                  </span>
                </div>
              )}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

/* ══════════════ 可验证预测 ══════════════ */

function PredictionSection({ profile }: { profile: AnalysisProfile }) {
  if (profile.predictions.length === 0) return null;

  return (
    <section>
      <SectionTitle
        en="Falsifiable Predictions"
        cn="可以验证的预测"
        hint="真正的分析应该能被现实推翻。拿去对照，比看标签有用"
      />
      <div className="space-y-2">
        {profile.predictions.map((p, i) => (
          <div key={i} className="surface p-4">
            <div className="text-[11px] text-bone-500 mb-1.5">{p.situation}</div>
            <p className="text-[14px] text-bone-50 leading-[1.7]">
              {p.prediction}
            </p>
            <div className="flex items-center gap-2 mt-2.5">
              <span className="text-[11px] text-bone-500">
                把握 <span className="numeral text-bone-300">{p.confidence}</span>%
              </span>
            </div>
            {p.ifWrong && (
              <details className="mt-2">
                <summary className="list-none cursor-pointer text-[11px] text-bone-500 hover:text-bone-300 transition-colors">
                  如果预测错了呢？
                </summary>
                <p className="text-[12px] text-bone-400 leading-relaxed mt-1.5">
                  {p.ifWrong}
                </p>
              </details>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ══════════════ 互动建议 ══════════════ */

function GuidanceSection({ profile }: { profile: AnalysisProfile }) {
  const g = profile.guidance;
  const has =
    g.effective.length > 0 ||
    g.counterproductive.length > 0 ||
    g.whatTheyWant ||
    g.whatTheyFear;
  if (!has) return null;

  return (
    <section>
      <SectionTitle en="Guidance" cn="怎么相处" hint="基于机制的建议，不是通用鸡汤" />

      {(g.whatTheyWant || g.whatTheyFear) && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 mb-3">
          {g.whatTheyWant && (
            <div className="surface p-4 border-l-2" style={{ borderLeftColor: "rgba(111,168,147,0.5)" }}>
              <div className="text-[11px] tracking-[0.16em] uppercase text-jade/80 mb-2">
                真正想要的
              </div>
              <p className="text-[14px] text-bone-50 leading-[1.75]">
                {g.whatTheyWant}
              </p>
            </div>
          )}
          {g.whatTheyFear && (
            <div className="surface p-4 border-l-2" style={{ borderLeftColor: "rgba(201,128,128,0.5)" }}>
              <div className="text-[11px] tracking-[0.16em] uppercase text-rose/80 mb-2">
                最怕被这样对待
              </div>
              <p className="text-[14px] text-bone-50 leading-[1.75]">
                {g.whatTheyFear}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {g.effective.length > 0 && (
          <div className="surface p-4 md:p-5">
            <div className="text-[11px] tracking-[0.16em] uppercase text-jade/80 mb-3">
              有效做法
            </div>
            <ul className="space-y-3">
              {g.effective.map((e, i) => (
                <li key={i}>
                  <div className="text-[13px] text-bone-50 leading-snug">
                    {e.action}
                  </div>
                  {e.why && (
                    <p className="text-[12px] text-bone-500 leading-relaxed mt-1">
                      {e.why}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {g.counterproductive.length > 0 && (
          <div className="surface p-4 md:p-5">
            <div className="text-[11px] tracking-[0.16em] uppercase text-rose/80 mb-3">
              容易踩雷
            </div>
            <ul className="space-y-3">
              {g.counterproductive.map((e, i) => (
                <li key={i}>
                  <div className="text-[13px] text-bone-50 leading-snug">
                    {e.action}
                  </div>
                  {e.why && (
                    <p className="text-[12px] text-bone-500 leading-relaxed mt-1">
                      {e.why}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

/* ══════════════ 自我叙事 ══════════════ */

function NarrativeSection({ profile }: { profile: AnalysisProfile }) {
  const n = profile.narrative;
  const has =
    n.coreBeliefs.length > 0 ||
    n.identityConflict ||
    n.selfStory ||
    n.blindSpots.length > 0;
  if (!has) return null;

  return (
    <section>
      <SectionTitle en="Narrative" cn="自我叙事" hint="TA如何解释自己，以及看不见的部分" />
      <div className="space-y-3">
        {n.selfStory && (
          <div className="surface-raised p-5">
            <p className="font-display text-[16px] leading-[1.85] text-bone-100 italic">
              「{n.selfStory}」
            </p>
          </div>
        )}

        {n.coreBeliefs.length > 0 && (
          <div className="surface p-4">
            <div className="text-[11px] tracking-[0.16em] uppercase text-bone-500 mb-2.5">
              核心信念
            </div>
            <ul className="space-y-1.5">
              {n.coreBeliefs.map((b, i) => (
                <li key={i} className="text-[13px] text-bone-200 flex gap-2 leading-relaxed">
                  <span className="text-amber/60 shrink-0">·</span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        )}

        {n.identityConflict && (
          <div className="surface p-4">
            <div className="text-[11px] tracking-[0.16em] uppercase text-bone-500 mb-2">
              身份冲突
            </div>
            <p className="text-[13px] text-bone-200 leading-[1.75]">
              {n.identityConflict}
            </p>
          </div>
        )}

        {n.blindSpots.length > 0 && (
          <div className="surface p-4 border-l-2" style={{ borderLeftColor: "rgba(94,240,224,0.42)" }}>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="text-[11px] tracking-[0.16em] uppercase text-amber/80">
                盲区
              </div>
              <span className="text-[10px] text-bone-500">
                TA 自己可能没意识到
              </span>
            </div>
            <ul className="space-y-2">
              {n.blindSpots.map((b, i) => (
                <li key={i} className="text-[13px] text-bone-200 leading-[1.7] flex gap-2">
                  <span className="text-amber/60 shrink-0 mt-0.5">◑</span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

/* ══════════════ 元信息 ══════════════ */

function MetaFooter({ profile }: { profile: AnalysisProfile }) {
  const m = profile.meta;
  if (!m.sources.length && !m.unknowns.length) return null;

  return (
    <section className="pt-6 border-t border-[var(--border-1)]">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {m.sources.length > 0 && (
          <div>
            <div className="text-[11px] tracking-[0.16em] uppercase text-bone-500 mb-2">
              证据来源
            </div>
            <ul className="space-y-1">
              {m.sources.map((s, i) => (
                <li key={i} className="text-[12px] text-bone-400 leading-relaxed">
                  · {s}
                </li>
              ))}
            </ul>
          </div>
        )}
        {m.unknowns.length > 0 && (
          <div>
            <div className="text-[11px] tracking-[0.16em] uppercase text-bone-500 mb-2">
              目前无法判断
            </div>
            <ul className="space-y-1">
              {m.unknowns.map((u, i) => (
                <li key={i} className="text-[12px] text-bone-500 leading-relaxed">
                  · {u}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <p className="mt-6 text-[11px] text-bone-600 leading-relaxed">
        本研判基于有限材料做出的概率性推断，不是对一个人的定论。真实的人会随情境与时间改变，
        任何结论都应当被新的观察推翻或修正。
      </p>
    </section>
  );
}

/* ══════════════ 通用小件 ══════════════ */

function SectionTitle({
  en,
  cn,
  hint,
}: {
  en: string;
  cn: string;
  hint?: string;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-baseline gap-2.5">
        <h2 className="font-display text-[19px] text-bone-50 font-normal">{cn}</h2>
        <span className="text-[10px] uppercase tracking-[0.2em] text-bone-600">
          {en}
        </span>
      </div>
      {hint && (
        <p className="text-[12px] text-bone-500 mt-1 leading-relaxed">{hint}</p>
      )}
      <div className="rule-amber mt-3 max-w-[64px]" />
    </div>
  );
}

function Chevron() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      className="text-bone-600 shrink-0"
      aria-hidden
    >
      <path
        d="m9 6 6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
