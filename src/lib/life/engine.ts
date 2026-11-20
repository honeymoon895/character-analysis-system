/**
 * 模拟人生 —— 推演内核
 *
 * 与"算命"的区别，全在这几条硬规则里：
 * 1. 每条分支必须能指回一条具体依据（知识库编号），指不回去就只能降级为通用经验。
 * 2. 概率必须承认不确定性，且随依据充分度变化——依据少时概率要往中间收。
 * 3. 每条分支都带"可观察信号"和证伪条件，现实中能验证，不是说完就完。
 * 4. 不预测具体事件（"你会在三月遇到贵人"），只预测行为倾向与连锁反应。
 */

import { callAI, extractJson } from "@/lib/analysis/engine";
import type { AIConfig } from "@/lib/ai/config";
import { buildKnowledgeDigest, type DigestOptions } from "@/lib/knowledge/store";
import type { KnowledgeCoverage, MemoryEntry } from "@/lib/knowledge/types";
import {
  normalizeProbabilities,
  type LifeBasis,
  type LifeBranch,
  type LifeNode,
} from "./types";

const RULES = `你是「情境推演」引擎。你的任务不是预测命运，而是把一个人当下的处境拆成几条可能的路，并诚实标注每条路的把握有多大。

【硬性规则】
1. 每条分支都必须尽可能引用知识库编号（如 K3）。引用格式写在 refs 数组里，如 ["K3","K7"]；正文里也可以出现 [K3]。
2. refs 为空的分支，basis 必须写成 "general"（通用经验）或 "guess"（纯推测），不得写 "knowledge"。
3. 分支数量 3–5 条，概率是 0–100 的整数，合计约等于 100。
4. 概率必须反映真实判断：如果两条路同样可能，就给接近的数；不要为了好看排成 80/10/10。
5. outcome 必须具体到"什么时候、以什么方式、能观察到什么"，禁止"可能会有变化""顺其自然"这类空话。
6. 不写道德评价，不给"你应该……"式的建议。只描述会发生什么、以及为什么。
7. 依据充分度低于 40 时：概率必须整体向中间收（不要出现 80 以上的数），并在 unknowns 里老实写出缺什么。
8. 只推演行为倾向与连锁反应，不预测无法验证的具体事件（不写"你会中彩票""你会遇到贵人"）。
9. 全部用中文输出，直接给 JSON，不要解释文字。`;

interface RawBranch {
  label?: unknown;
  probability?: unknown;
  outcome?: unknown;
  signals?: unknown;
  basis?: unknown;
  refs?: unknown;
  ifWrong?: unknown;
}

function str(v: unknown, max = 800): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function strArray(v: unknown, max = 6, itemMax = 200): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => str(x, itemMax)).filter(Boolean).slice(0, max);
}

function pickBasis(v: unknown, refs: string[]): LifeBasis {
  const b = str(v, 20).toLowerCase();
  const valid: LifeBasis[] = ["knowledge", "general", "guess"];
  if (valid.includes(b as LifeBasis)) return b as LifeBasis;
  return refs.length ? "knowledge" : "general";
}

function newId(prefix: string): string {
  try {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  } catch {
    return `${prefix}_${Date.now().toString(36)}`;
  }
}

function normalizeBranch(raw: RawBranch, coverageScore: number): LifeBranch | null {
  const label = str(raw.label, 120);
  const outcome = str(raw.outcome, 900);
  if (!label || !outcome) return null;

  const refs = strArray(raw.refs, 6, 12).map((r) =>
    r.toUpperCase().replace(/[^K0-9]/g, "")
  );

  let probability = Number(raw.probability);
  if (!Number.isFinite(probability)) probability = 20;
  probability = Math.max(1, Math.min(99, Math.round(probability)));

  // 依据越少，概率越不能是极端值——这是"没把握就别装"的机械保证
  if (coverageScore < 40) probability = Math.max(12, Math.min(55, probability));
  if (coverageScore < 20) probability = Math.max(20, Math.min(40, probability));

  return {
    id: newId("b"),
    label,
    probability,
    outcome,
    signals: strArray(raw.signals, 4, 160),
    basis: pickBasis(raw.basis, refs),
    refs,
    ifWrong: str(raw.ifWrong, 400),
  };
}

function normalizeNode(raw: any, coverageScore: number): LifeNode | null {
  if (!raw || typeof raw !== "object") return null;

  const situation = str(raw.situation, 1200);
  const question = str(raw.question, 300);
  if (!situation || !question) return null;

  const rawBranches = Array.isArray(raw.branches) ? raw.branches : [];
  const branches = rawBranches
    .map((b: RawBranch) => normalizeBranch(b, coverageScore))
    .filter((b: LifeBranch | null): b is LifeBranch => b !== null)
    .slice(0, 5);

  if (branches.length < 2) return null;

  return {
    id: newId("n"),
    situation,
    question,
    readOfYou: str(raw.readOfYou, 800),
    branches: normalizeProbabilities(branches),
    unknowns: strArray(raw.unknowns, 5, 200),
    coverage: coverageScore,
    createdAt: new Date().toISOString(),
  };
}

export interface SimSeedInput {
  title: string;
  premise: string;
  /** 想模拟的方向：工作 / 感情 / 家庭 / 金钱 / 自我 */
  focus: string;
  /** 时间跨度：3个月 / 1年 / 3年 */
  horizon: string;
}

export interface SimContext {
  entries: MemoryEntry[];
  coverage: KnowledgeCoverage;
}

function contextBlock(
  entries: MemoryEntry[],
  coverage: KnowledgeCoverage,
  query: string
): string {
  const digest = buildKnowledgeDigest(entries, coverage, {
    limit: 36,
    query,
    maxChars: 300,
  });
  return digest.text;
}

/**
 * 开局：给一个处境，产出第一个决策节点
 */
export async function startLifeSim(
  input: SimSeedInput,
  ctx: SimContext,
  config: AIConfig | null
): Promise<LifeNode | null> {
  const kb = contextBlock(
    ctx.entries,
    ctx.coverage,
    `${input.focus} ${input.premise} ${input.title}`
  );

  const raw = await callAI(
    [
      { role: "system", content: RULES },
      {
        role: "user",
        content: `${kb}

【推演对象】用户本人，时间为现在。时间跨度：${input.horizon}。关注方向：${input.focus}。
【用户自述的处境】
${input.premise}
【本次推演的标题】${input.title}

请输出这一处境下 TA 此刻真正的分岔口。要求：
- situation：用第二人称把这个处境写清楚，包含 TA 自己可能没明说的那层张力。
- question：此刻真正需要决定的是什么（一句话）。
- readOfYou：基于知识库，TA 在这类处境下通常是什么反应（2–4 句，必须引用 [K编号]；知识库为空就直接说明没有依据）。
- branches：TA 分别可能怎么走，概率合计约 100。
- unknowns：要让这个推演更准，还需要知道什么。

输出 JSON：
{
  "situation": "…",
  "question": "…",
  "readOfYou": "…",
  "branches": [
    {
      "label": "你可能会做的事（第二人称，一句话）",
      "probability": 40,
      "outcome": "如果这么做，接下来 ${input.horizon} 内会发生什么，具体到可观察的行为与结果",
      "signals": ["出现这个说明这条路正在成真", "…"],
      "basis": "knowledge | general | guess",
      "refs": ["K1"],
      "ifWrong": "如果现实没有这样发展，说明什么"
    }
  ],
  "unknowns": ["…"]
}`,
      },
    ],
    config,
    { temperature: 0.55, maxTokens: 4000 }
  );

  return normalizeNode(extractJson(raw), ctx.coverage.score);
}

/**
 * 推进：用户选了某条路（或补充了实际发生的事），生成下一个节点
 */
export async function advanceLifeSim(
  params: {
    sim: { title: string; premise: string; focus: string; horizon: string };
    nodes: LifeNode[];
    choice: { branchId: string; actual?: string };
    ctx: SimContext;
  },
  config: AIConfig | null
): Promise<LifeNode | null> {
  const { sim, nodes, choice, ctx } = params;

  const last = nodes[nodes.length - 1];
  if (!last) return null;

  const chosen = last.branches.find((b) => b.id === choice.branchId);

  const kb = contextBlock(
    ctx.entries,
    ctx.coverage,
    `${sim.focus} ${sim.premise} ${chosen?.label || ""}`
  );

  // 只带最近 4 个节点的梗概，避免上下文膨胀
  const trail = nodes
    .slice(-4)
    .map(
      (n, i) =>
        `第${nodes.length - Math.min(nodes.length, 4) + i + 1}步｜处境：${n.situation.slice(
          0,
          120
        )}\n→ 选择：${
          n.choice
            ? n.branches.find((b) => b.id === n.choice!.branchId)?.label || "（未知）"
            : "（未记录）"
        }`
    )
    .join("\n");

  const raw = await callAI(
    [
      { role: "system", content: RULES },
      {
        role: "user",
        content: `${kb}

【推演主题】${sim.title}（关注：${sim.focus}，跨度：${sim.horizon}）
【原始处境】${sim.premise}
【已经走过的路】
${trail || "（刚开始）"}

【刚刚这一步】
处境：${last.situation}
问题：${last.question}
用户走了这条路：${chosen ? `${chosen.label}（当时给出的概率 ${chosen.probability}%）` : "（未知）"}
${chosen ? `当时对这条路的推断：${chosen.outcome}` : ""}
${choice.actual ? `【用户补充：实际发生的是】\n${choice.actual}` : ""}

请推演下一步：
- situation：这一步之后 TA 现在的处境（要吸收"实际发生的事"，如果和当初推断不符，必须点明偏差）。
- question：新的分岔口。
- readOfYou：结合知识库，TA 下一步最可能受什么驱动。
- branches：新的 3–5 条路径，概率合计约 100。不要重复已经走过的选项。
- unknowns：还需要知道什么。

输出与上一步相同的 JSON 结构。`,
      },
    ],
    config,
    { temperature: 0.55, maxTokens: 4000 }
  );

  const node = normalizeNode(extractJson(raw), ctx.coverage.score);
  if (node) node.fromBranchId = choice.branchId;
  return node;
}
