/**
 * 新旧数据结构兼容层
 *
 * 新的研判档案（AnalysisProfile）信息量远大于旧的九维分数数组，
 * 但列表页、雷达图等既有组件仍依赖旧结构。这里做单向转换，
 * 保证界面升级可以分步进行，不会一次性打断所有页面。
 */
import type { AnalysisProfile, TraitScore } from "./types";

export interface LegacyTrait {
  code: string;
  name: string;
  score: number;
  confidence: number;
  evidence: string[];
  /** 是否真实测出。false 时前端应显示"证据不足"而非 0 分 */
  measured: boolean;
}

/** 从研判档案提取九维评分数组（供雷达图 / 卡片使用） */
export function toLegacyTraits(profile: AnalysisProfile): LegacyTrait[] {
  const ordered = [
    "OPENNESS",
    "CONSCIENTIOUSNESS",
    "EXTRAVERSION",
    "AGREEABLENESS",
    "NEUROTICISM",
    "DECISIVENESS",
    "RISK_TENDENCY",
    "EMPATHY",
    "LEADERSHIP",
  ];
  const byCode = new Map<string, TraitScore>(
    profile.traits.map((t) => [t.code, t])
  );

  const result: LegacyTrait[] = [];
  for (const code of ordered) {
    const t = byCode.get(code);
    if (!t) continue;
    result.push({
      code: t.code,
      name: t.name,
      // 未测出的维度不伪造分数，雷达图会跳过或显示为低置信
      score: t.score ?? 0,
      confidence: t.confidence,
      evidence: t.evidence.map((e) => e.statement).filter(Boolean),
      measured: t.score !== null && t.confidence >= 30,
    });
  }
  return result;
}

/** 从档案生成一段可直接展示的摘要，替代旧的"一句话性格总结" */
export function toSummary(profile: AnalysisProfile): string {
  return profile.formulation?.coreThesis || "";
}

/** 从档案提取价值观列表（旧字段 values 是 string[]） */
export function toLegacyValues(profile: AnalysisProfile): string[] {
  return (profile.motivation?.values || [])
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .map((v) => v.value)
    .filter(Boolean);
}

/** 从档案提取行为模式（旧字段 behaviorPatterns 是 {scenario, description}[]） */
export function toLegacyBehaviorPatterns(profile: AnalysisProfile) {
  const patterns: { scenario: string; description: string }[] = [];

  if (profile.formulation?.coreConflict) {
    patterns.push({ scenario: "核心冲突", description: profile.formulation.coreConflict });
  }
  if (profile.regulation?.stressCoping) {
    patterns.push({ scenario: "压力之下", description: profile.regulation.stressCoping });
  }
  if (profile.relational?.underThreat) {
    patterns.push({ scenario: "感到不安时", description: profile.relational.underThreat });
  }
  if (profile.relational?.repeatingPattern) {
    patterns.push({ scenario: "关系模式", description: profile.relational.repeatingPattern });
  }

  return patterns;
}

/** 把旧的九维数组解析出来（用于旧数据回填） */
export function parseStoredTraits(raw: any): LegacyTrait[] {
  if (!raw) return [];
  try {
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(arr)) return [];
    return arr.map((t: any) => ({
      code: String(t.code || ""),
      name: String(t.name || t.code || ""),
      score: typeof t.score === "number" ? t.score : 0,
      confidence: typeof t.confidence === "number" ? t.confidence : 0,
      evidence: Array.isArray(t.evidence) ? t.evidence : [],
      // 旧数据没有该标记；confidence 为 0 视为未测出
      measured: typeof t.measured === "boolean" ? t.measured : (t.confidence ?? 0) >= 30,
    }));
  } catch {
    return [];
  }
}
