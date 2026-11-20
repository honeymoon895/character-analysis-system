/**
 * 个人知识库 —— 存取、覆盖度与提示词摘要
 *
 * 所有函数都是纯函数，方便在不连数据库的情况下测试。
 */
import type {
  KnowledgeCoverage,
  MemoryEntry,
  MemoryKind,
  CoverageDomain,
} from "./types";
import { MEMORY_KINDS } from "./types";

const VALID_KINDS = new Set<string>(MEMORY_KINDS.map((k) => k.id));

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.round(v)));
}

/**
 * 归一化
 *
 * 兼容三种历史形态：
 *   1. 旧日记 { content, timestamp }
 *   2. 新结构 MemoryEntry
 *   3. 模型/前端传来的不完整对象
 */
export function normalizeEntries(raw: unknown): MemoryEntry[] {
  const arr = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
    ? safeParseArray(raw)
    : [];

  const result = arr
    .map((e: any): MemoryEntry | null => {
      const content = asString(e?.content).trim();
      if (!content) return null;

      const kind: MemoryKind = VALID_KINDS.has(e?.kind)
        ? (e.kind as MemoryKind)
        : "diary";

      const createdAt =
        asString(e?.createdAt) ||
        asString(e?.timestamp) ||
        asString(e?.updatedAt) ||
        new Date(0).toISOString();

      // 旧数据没有 id：用时间 + 内容前缀稳定生成，避免每次读取都变化
      const id = asString(e?.id) || legacyId(createdAt, content);

      return {
        id,
        kind,
        title: asString(e?.title).trim() || undefined,
        content,
        tags: Array.isArray(e?.tags)
          ? e.tags.map((t: unknown) => asString(t).trim()).filter(Boolean).slice(0, 8)
          : [],
        importance: clampInt(e?.importance, 0, 100, kind === "diary" ? 45 : 60),
        occurredAt: asString(e?.occurredAt) || undefined,
        createdAt,
        updatedAt: asString(e?.updatedAt) || undefined,
      };
    })
    .filter((e): e is MemoryEntry => e !== null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  // 旧数据按"时间+内容前缀"生成 id，内容与时间都相同的两条会撞在一起。
  // 撞了就必须拆开，否则按 id 删除会删错那条。
  const seen = new Map<string, number>();
  return result.map((e) => {
    const n = seen.get(e.id) || 0;
    seen.set(e.id, n + 1);
    return n === 0 ? e : { ...e, id: `${e.id}_${n}` };
  });
}

function legacyId(createdAt: string, content: string): string {
  let h = 0;
  const s = `${createdAt}|${content.slice(0, 40)}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `old_${Math.abs(h).toString(36)}`;
}

function safeParseArray(str: string): any[] {
  try {
    const v = JSON.parse(str);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export interface MemoryInput {
  kind?: string;
  title?: string;
  content: string;
  tags?: string[];
  importance?: number;
  occurredAt?: string;
}

export function buildEntry(input: MemoryInput, now = new Date()): MemoryEntry {
  const iso = now.toISOString();
  return {
    id: newId(),
    kind: VALID_KINDS.has(input.kind || "") ? (input.kind as MemoryKind) : "diary",
    title: input.title?.trim() || undefined,
    content: input.content.trim(),
    tags: (input.tags || []).map((t) => t.trim()).filter(Boolean).slice(0, 8),
    importance: clampInt(input.importance, 0, 100, 50),
    occurredAt: input.occurredAt || undefined,
    createdAt: iso,
    updatedAt: iso,
  };
}

/* ══════════════════ 覆盖度 ══════════════════ */

/**
 * 九个生活面向。缺哪一块，模拟时哪一块就只能靠通用推断。
 * 关键词表刻意写得口语化——用户不会用书面语写自己的事。
 */
const DOMAINS: { key: string; label: string; words: string[] }[] = [
  {
    key: "work",
    label: "工作 / 学业",
    words: [
      "工作", "上班", "加班", "公司", "老板", "领导", "同事", "项目", "面试",
      "辞职", "离职", "跳槽", "offer", "创业", "客户", "升职", "绩效", "裁员", "上线", "产品",
      "学校", "考试", "论文", "导师", "老师", "同学", "专业", "实习", "毕业",
    ],
  },
  {
    key: "love",
    label: "亲密关系",
    words: [
      "男朋友", "女朋友", "对象", "伴侣", "老公", "老婆", "恋爱", "分手",
      "喜欢", "表白", "约会", "结婚", "相亲", "前任", "暧昧", "异地", "暗恋",
    ],
  },
  {
    key: "family",
    label: "家人 / 原生家庭",
    words: [
      "爸爸", "妈妈", "父母", "爸妈", "家里", "奶奶", "爷爷", "外公", "外婆",
      "哥哥", "姐姐", "弟弟", "妹妹", "亲戚", "回家", "原生", "爸妈", "父亲", "母亲",
    ],
  },
  {
    key: "emotion",
    label: "情绪 / 内在状态",
    words: [
      "焦虑", "难过", "开心", "抑郁", "崩溃", "害怕", "委屈", "孤独", "情绪",
      "失眠", "压力", "内耗", "自卑", "愤怒", "平静", "空", "麻木", "烦躁",
      "担心", "害怕", "怕", "抵触", "不想干", "撑不住",
    ],
  },
  {
    key: "goal",
    label: "目标 / 规划",
    words: [
      "目标", "计划", "想要", "打算", "未来", "理想", "梦想", "考研", "出国",
      "转行", "攒钱", "买房", "准备", "希望", "努力", "五年", "三年",
    ],
  },
  {
    key: "habit",
    label: "习惯 / 日常",
    words: [
      "早起", "健身", "跑步", "熬夜", "游戏", "手机", "饮食", "运动", "作息",
      "每天", "习惯", "刷", "睡眠", "咖啡", "抽烟", "喝酒", "减肥",
    ],
  },
  {
    key: "value",
    label: "价值观 / 信念",
    words: [
      "认为", "相信", "觉得", "原则", "意义", "价值", "应该", "不能接受",
      "底线", "自由", "公平", "诚实", "责任", "信仰",
    ],
  },
  {
    key: "conflict",
    label: "冲突 / 压力源",
    words: [
      "吵架", "冲突", "生气", "拒绝", "被否定", "误解", "争吵", "冷战",
      "误会", "冲突", "冲突", "争执", "翻脸", "撕破",
    ],
  },
  {
    key: "past",
    label: "过往经历",
    words: [
      "小时候", "以前", "那年", "高中", "初中", "大学", "经历", "曾经",
      "童年", "记忆", "记得", "后来", "那时候",
    ],
  },
];

function textOf(e: MemoryEntry): string {
  return `${e.title || ""} ${e.content} ${e.tags.join(" ")}`.toLowerCase();
}

export function computeCoverage(entries: MemoryEntry[], now = new Date()): KnowledgeCoverage {
  const domains: CoverageDomain[] = DOMAINS.map((d) => {
    const count = entries.filter((e) => {
      const t = textOf(e);
      return d.words.some((w) => t.includes(w));
    }).length;
    return { key: d.key, label: d.label, count, covered: count > 0 };
  });

  const covered = domains.filter((d) => d.covered).length;
  const total = entries.length;

  // 平均信息量：太短的条目几乎不提供判断依据
  const avgLen =
    total === 0
      ? 0
      : entries.reduce((s, e) => s + e.content.length, 0) / total;

  // 近期活跃度：知识库停更后，推演依据会过期
  const monthAgo = now.getTime() - 30 * 24 * 3600 * 1000;
  const recent = entries.filter(
    (e) => new Date(e.createdAt).getTime() >= monthAgo
  ).length;

  const score = Math.round(
    (covered / DOMAINS.length) * 55 +
      Math.min(total, 30) / 30 * 20 +
      Math.min(avgLen, 160) / 160 * 15 +
      Math.min(recent, 6) / 6 * 10
  );

  const missing = domains.filter((d) => !d.covered).map((d) => d.label);

  const suggestions: string[] = [];
  if (total === 0) {
    suggestions.push("先写三条：你现在在做什么、最近一次情绪波动是因为什么、你很想得到的东西。");
  }
  for (const d of domains.filter((x) => !x.covered).slice(0, 3)) {
    suggestions.push(`还没有关于「${d.label}」的记录，涉及这一块的推演只能靠通用经验。`);
  }
  if (total > 0 && avgLen < 60) {
    suggestions.push("记录偏短。补上当时的情境、你的第一反应、事后的想法，依据会扎实得多。");
  }
  if (total >= 6 && recent === 0) {
    suggestions.push("最近一个月没有新增记录，你已经变化的部分没有被记录下来。");
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    entries: total,
    domains,
    missing,
    suggestions: suggestions.slice(0, 4),
    recent,
  };
}

/* ══════════════════ 给模型的知识摘要 ══════════════════ */

export interface DigestOptions {
  /** 最多带多少条，默认 40 */
  limit?: number;
  /** 相关关键词，命中的条目优先 */
  query?: string;
  /** 单条截断长度 */
  maxChars?: number;
}

/** 简单的相关度排序：重要度 + 关键词命中 + 新鲜度 */
export function rankEntries(
  entries: MemoryEntry[],
  query = "",
  now = new Date()
): MemoryEntry[] {
  const terms = query
    .toLowerCase()
    .split(/[\s,，。、;；:：]+/)
    .filter((t) => t.length >= 2);

  const nowMs = now.getTime();

  return entries
    .map((e) => {
      const t = textOf(e);
      const hits = terms.filter((term) => t.includes(term)).length;
      const ageDays = (nowMs - new Date(e.createdAt).getTime()) / 86400000;
      const freshness = Math.max(0, 30 - ageDays) / 30;
      const score =
        e.importance * 0.6 + hits * 25 + freshness * 20 + Math.min(e.content.length, 300) / 30;
      return { e, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.e);
}

/**
 * 生成注入提示词的知识摘要。
 *
 * 每条都带编号，模型可以在输出里用 [K3] 这样的标记引用，
 * 前端据此把"依据"指回具体记录——这是让推演可追溯的关键。
 */
export function buildKnowledgeDigest(
  entries: MemoryEntry[],
  coverage: KnowledgeCoverage,
  opts: DigestOptions = {}
): { text: string; index: Map<string, MemoryEntry> } {
  const { limit = 40, query = "", maxChars = 320 } = opts;
  const picked = rankEntries(entries, query).slice(0, limit);
  const index = new Map<string, MemoryEntry>();

  if (picked.length === 0) {
    return {
      text: `【个人知识库】空。没有任何关于这个人的一手记录，所有概率都只能来自通用经验，必须在输出中明确标注依据不足。\n【依据充分度】${coverage.score}/100（记录 ${coverage.entries} 条）`,
      index,
    };
  }

  const lines = picked.map((e, i) => {
    const key = `K${i + 1}`;
    index.set(key, e);
    const date = (e.occurredAt || e.createdAt).slice(0, 10);
    const title = e.title ? `《${e.title}》` : "";
    const tags = e.tags.length ? ` #${e.tags.join(" #")}` : "";
    const body =
      e.content.length > maxChars ? `${e.content.slice(0, maxChars)}…` : e.content;
    return `[${key}] ${date} · ${e.kind} · 重要度${e.importance} ${title}${tags}\n${body}`;
  });

  const missing = coverage.missing.length
    ? `\n【完全没有记录的面向】${coverage.missing.join("、")}`
    : "";

  return {
    text: `【个人知识库】（共 ${entries.length} 条，按相关度与重要度选取 ${picked.length} 条）
${lines.join("\n\n")}
【依据充分度】${coverage.score}/100${missing}`,
    index,
  };
}

/** 引用标记 [K1] 还原成条目；找不到则返回 null */
export function resolveRef(
  ref: string,
  index: Map<string, MemoryEntry>
): MemoryEntry | null {
  const m = ref.match(/\[?(K\d+)\]?/i);
  if (!m) return null;
  return index.get(m[1].toUpperCase()) || null;
}
