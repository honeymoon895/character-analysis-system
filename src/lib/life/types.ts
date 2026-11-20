/**
 * 模拟人生 —— 数据结构
 *
 * 目标不是"算命"，而是：把一个人此刻的处境拆成几条可能的路，
 * 给每条路一个概率、一段可观察的后续，以及一组能被现实推翻的信号。
 *
 * 关键设计：每条分支都必须声明「依据等级」。
 *   knowledge —— 来自个人知识库的具体记录
 *   general   —— 来自普遍经验（年龄、职业、社会常规）
 *   guess     —— 纯推测
 * 依据越低，概率区间越宽，界面上也必须看得出来。
 */

export type LifeBasis = "knowledge" | "general" | "guess";

export const BASIS_LABEL: Record<LifeBasis, string> = {
  knowledge: "有你的记录支撑",
  general: "通用经验",
  guess: "推测",
};

export interface LifeBranch {
  id: string;
  /** 你可能会做的事，一句话，用第二人称 */
  label: string;
  /** 0-100 */
  probability: number;
  /** 选了这条，接下来会发生什么 */
  outcome: string;
  /** 可观察的信号：现实里出现这些，说明这条路正在成真 */
  signals: string[];
  basis: LifeBasis;
  /** 引用的知识库编号，如 K3 */
  refs: string[];
  /** 如果现实没这样发展，说明什么 */
  ifWrong: string;
}

export interface LifeChoice {
  branchId: string;
  chosenAt: string;
  /** 实际发生的情况（用户补充，可空） */
  actual?: string;
  /** 用户回填：预测的结果是否应验 */
  hit?: boolean;
  resolvedAt?: string;
}

export interface LifeNode {
  id: string;
  /** 此刻的处境 */
  situation: string;
  /** 需要决定的问题 */
  question: string;
  /** 基于知识库对这个人的判断 */
  readOfYou: string;
  branches: LifeBranch[];
  /** 这次推演里，知识库没覆盖到什么 */
  unknowns: string[];
  /** 生成这一节点时的依据充分度 */
  coverage: number;
  createdAt: string;
  /** 从上一节点的哪个分支走到这里 */
  fromBranchId?: string;
  choice?: LifeChoice;
}

export interface LifeSim {
  id: number;
  title: string;
  premise: string;
  focus: string;
  horizon: string;
  status: "active" | "done";
  nodes: LifeNode[];
  coverage: number;
  createdAt: string;
  updatedAt: string;
}

/** 预测校准：用已回填的结果衡量"这个人的推演有多准" */
export interface Calibration {
  /** 已结算的分支数 */
  resolved: number;
  /** 应验数 */
  hits: number;
  /** Brier 分数，0 为完美，1 为最差；无数据为 null */
  brier: number | null;
  /** 0-100 的校准分 */
  score: number | null;
}

export function computeCalibration(sims: LifeSim[]): Calibration {
  let resolved = 0;
  let hits = 0;
  let sum = 0;

  for (const sim of sims) {
    for (const node of sim.nodes || []) {
      if (!node.choice || typeof node.choice.hit !== "boolean") continue;
      const branch = node.branches.find((b) => b.id === node.choice!.branchId);
      const p = branch ? branch.probability / 100 : 0.5;
      const actual = node.choice.hit ? 1 : 0;
      sum += (p - actual) ** 2;
      resolved += 1;
      if (node.choice.hit) hits += 1;
    }
  }

  if (resolved === 0) {
    return { resolved: 0, hits: 0, brier: null, score: null };
  }

  const brier = sum / resolved;
  return {
    resolved,
    hits,
    brier: Math.round(brier * 1000) / 1000,
    // Brier 0 → 100 分；0.25 是"永远猜 50%"的水平
    score: Math.round(Math.max(0, 1 - brier) * 100),
  };
}

/** 概率归一化：模型给的数经常不加起来等于 100 */
export function normalizeProbabilities(branches: LifeBranch[]): LifeBranch[] {
  const sum = branches.reduce((s, b) => s + Math.max(0, b.probability), 0);
  if (sum === 0) {
    const even = Math.round(100 / Math.max(1, branches.length));
    return branches.map((b) => ({ ...b, probability: even }));
  }
  return branches.map((b) => ({
    ...b,
    probability: Math.round((Math.max(0, b.probability) / sum) * 100),
  }));
}
