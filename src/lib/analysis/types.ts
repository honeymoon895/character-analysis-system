/**
 * 心理研判模型 —— 分层人格评估的数据结构
 *
 * 设计原则（与"性格打分表"的本质区别）：
 * 1. 每个结论必须挂靠证据，证据分四级可信度（直接观察 / 本人陈述 / 第三方转述 / 推理）。
 * 2. 允许 "score = null"，即"证据不足"。宁可留白，不许编造。
 * 3. 模糊行为必须给出多个竞争假设，并附证伪条件——这是"读到真实意图"的唯一诚实做法。
 * 4. 结论要可被现实推翻：每份档案都带若干条可验证预测。
 */

/** 证据可信度层级 */
export type EvidenceKind =
  | "observed" // 你可直接观察到的行为
  | "reported" // TA 本人说过的话
  | "secondhand" // 他人转述
  | "inferred"; // 由行为反推的心理过程

export interface Evidence {
  kind: EvidenceKind;
  statement: string;
  /** strong 直接对应特质；moderate 需一步推理；weak 仅为线索 */
  weight: "strong" | "moderate" | "weak";
  /** 该证据在什么条件下失效 */
  caveat?: string;
}

/** 子面（facet）—— 大五人格的细颗粒度层 */
export interface FacetScore {
  name: string;
  score: number | null;
  evidence: string[];
  /** 与此子面相反的观察 */
  counter?: string[];
}

export interface TraitScore {
  /** 稳定编码，如 OPENNESS */
  code: string;
  name: string;
  /** 0-100；null 表示信息不足以判断，前端显示"未测出" */
  score: number | null;
  /** 0-100，置信度。低于 40 的结论前端应以弱化样式呈现 */
  confidence: number;
  /** 该高分端的典型表现，用于替换"性格标签"里的萌系文案 */
  anchor?: string;
  evidence: Evidence[];
  /** 反证：与主结论相冲突的观察。为空不代表没有，只代表未发现 */
  counterEvidence: Evidence[];
  /** 边界条件：这个判断在什么情境下不成立 */
  boundary?: string;
  facets?: FacetScore[];
  /** 是否为复合指标（由大五子面推导，而非独立维度） */
  composite?: boolean;
  /** 复合指标的推导说明 */
  derivedFrom?: string;
}

/** 需要 / 恐惧配对：这个人渴求什么，又怕什么 */
export interface NeedThreatPair {
  need: string;
  threat: string;
  evidence: string;
}

/** 防御机制 */
export interface DefenseMechanism {
  name: string;
  /** mature / neurotic / immature */
  maturity: "mature" | "neurotic" | "immature";
  description: string;
  evidence: string;
}

/** 依恋倾向（双维度，而不是贴单一标签） */
export interface AttachmentProfile {
  /** 依恋焦虑 0-100 */
  anxiety: number | null;
  /** 依恋回避 0-100 */
  avoidance: number | null;
  /** 安全型 / 焦虑型 / 回避型 / 恐惧型 / 未测出 */
  style: string;
  confidence: number;
  reasoning: string;
}

/** 人际环模型位置 */
export interface InterpersonalPosition {
  /** -100 服从 ← → +100 支配 */
  dominance: number | null;
  /** -100 疏远 ← → +100 亲近 */
  affiliation: number | null;
  note: string;
}

/** 动力层：这个人被什么驱动 */
export interface MotivationLayer {
  /** 需要结构，按重要性排序 */
  needs: NeedThreatPair[];
  /** 价值排序（从最重要到次重要） */
  values: { value: string; rank: number; evidence: string }[];
  /** 回避目标：TA 在极力避免什么 */
  avoidanceGoals: string[];
}

/** 调节层 */
export interface RegulationLayer {
  defenses: DefenseMechanism[];
  /** 归因风格，如"内归因-稳定-全局" */
  attributionStyle: string;
  /** 情绪调节策略 */
  emotionRegulation: string[];
  /** 压力下的典型应对 */
  stressCoping: string;
}

/** 关系层 */
export interface RelationalLayer {
  attachment: AttachmentProfile;
  interpersonal: InterpersonalPosition;
  /** 当 TA 感到不安全时的关系策略 */
  underThreat: string;
  /** TA 在关系中最容易重复的模式 */
  repeatingPattern: string;
}

/** 叙事层：自我概念 */
export interface NarrativeLayer {
  /** 核心图式 / 核心信念 */
  coreBeliefs: string[];
  /** 身份认同中的冲突 */
  identityConflict: string;
  /** TA 用来解释自己人生的主线故事 */
  selfStory: string;
  /** 盲区：TA 自己大概率没意识到的事 */
  blindSpots: string[];
}

/** 核心研判：把各层串起来 */
export interface Formulation {
  /** 一句话核心结论，必须是可错的判断，而不是"TA很复杂" */
  coreThesis: string;
  /** 核心冲突：两种互相拉扯的力 */
  coreConflict: string;
  /** 触发点 */
  triggers: string[];
  /** 维持循环：信念 → 情绪 → 防御 → 行为 → 他人反应 → 强化信念 */
  viciousCycle: string;
  /** 发展性推测：这种模式可能从何而来 */
  developmentalHypothesis: string;
}

/** 竞争假设：对同一行为的多种解释 */
export interface Hypothesis {
  statement: string;
  /** 0-100，主观概率，用于排序而非精确计算 */
  probability: number;
  /** 支持该假设的观察 */
  supporting: string[];
  /** 反对该假设的观察 */
  against: string[];
  /** 怎样才能证伪它——这是关键字段 */
  falsifier: string;
}

/** 可验证预测 */
export interface Prediction {
  /** 在什么情境下观察 */
  situation: string;
  /** 预测 TA 会怎么做 */
  prediction: string;
  confidence: number;
  /** 如果你观察到的是另一种结果，说明什么 */
  ifWrong: string;
}

/** 互动策略（取代原来泛泛的"给TA空间"） */
export interface InteractionGuidance {
  /** 有效做法，需说明为什么对这个人有效 */
  effective: { action: string; why: string }[];
  /** 无效甚至有害的做法，需说明为什么踩雷 */
  counterproductive: { action: string; why: string }[];
  /** 一句话点破：TA 真正想要的是什么 */
  whatTheyWant: string;
  /** 一句话提醒：TA 最怕被怎样对待 */
  whatTheyFear: string;
}

/** 画像来源与质量 */
export interface AnalysisMeta {
  /** 本次分析的证据来源说明 */
  sources: string[];
  /** 信息充分度 0-100 */
  sufficiency: number;
  /** 哪些方面目前完全无法判断 */
  unknowns: string[];
  /** 数据是否来自真实分析（false 表示未配置 AI，直接展示空档案） */
  isAnalyzed: boolean;
  modelVersion: string;
  generatedAt: string;
  /** 本次采用的评估域（人格 / 文学 / 军事 / …），决定维度集合 */
  domain?: string;
  /** 该域的展示名，如「文学气质」 */
  domainName?: string;
  /** 该域看什么 */
  domainTagline?: string;
  /** 维度是否来自实证心理测量（除人格域外均为分析工具） */
  empirical?: boolean;
}

/** 完整研判档案 */
export interface AnalysisProfile {
  meta: AnalysisMeta;
  traits: TraitScore[];
  motivation: MotivationLayer;
  regulation: RegulationLayer;
  relational: RelationalLayer;
  narrative: NarrativeLayer;
  formulation: Formulation;
  hypotheses: Hypothesis[];
  predictions: Prediction[];
  guidance: InteractionGuidance;
  /** 仅公众/历史人物：生平与成就 */
  keyEvents?: { year: string; event: string; significance: string }[];
  achievements?: { domain: string; title: string; description: string }[];
}

export const ANALYSIS_MODEL_VERSION = "formulation-v2";

/** 无数据时的空档案——明确表达"还不知道"，而不是给出假分数 */
export function emptyAnalysis(reason: string): AnalysisProfile {
  return {
    meta: {
      sources: [],
      sufficiency: 0,
      unknowns: [reason],
      isAnalyzed: false,
      modelVersion: ANALYSIS_MODEL_VERSION,
      generatedAt: new Date().toISOString(),
    },
    traits: [],
    motivation: { needs: [], values: [], avoidanceGoals: [] },
    regulation: {
      defenses: [],
      attributionStyle: "",
      emotionRegulation: [],
      stressCoping: "",
    },
    relational: {
      attachment: { anxiety: null, avoidance: null, style: "未测出", confidence: 0, reasoning: "" },
      interpersonal: { dominance: null, affiliation: null, note: "" },
      underThreat: "",
      repeatingPattern: "",
    },
    narrative: { coreBeliefs: [], identityConflict: "", selfStory: "", blindSpots: [] },
    formulation: {
      coreThesis: "",
      coreConflict: "",
      triggers: [],
      viciousCycle: "",
      developmentalHypothesis: "",
    },
    hypotheses: [],
    predictions: [],
    guidance: { effective: [], counterproductive: [], whatTheyWant: "", whatTheyFear: "" },
  };
}
