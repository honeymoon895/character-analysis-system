/**
 * 个人知识库 —— 数据结构
 *
 * 定位：这是整个「读心术」的原料仓库。
 * 人物分析靠档案，自我研判靠日记，而"接下来会发生什么"只能靠
 * 对一个人生活细节的长期积累——也就是这里。
 *
 * 设计取舍：
 * - 不叫"日记"，因为日记默认是流水账。这里每条都是**可被检索的事实单元**，
 *   有类型、有标签、有重要度、有时间。写流水账也能用，但写得越结构化，
 *   后面推演时能被引用的依据就越多。
 * - 复用 User.selfDiary 这个既有 JSON 字段，旧数据（{content, timestamp}）
 *   自动升级成新结构，不需要迁移、不会丢。
 */

export type MemoryKind =
  | "diary" // 日记：某天发生了什么、我当时怎么想
  | "fact" // 事实：关于我或我的处境的客观信息
  | "preference" // 偏好：喜欢什么、讨厌什么
  | "relation" // 关系：某个人的情况、我跟 TA 的相处模式
  | "event" // 事件：已发生的重要节点
  | "decision" // 决定：做过什么选择、当时怎么权衡
  | "insight" // 洞察：对自己的新认识
  | "goal"; // 目标：想要达成什么

export const MEMORY_KINDS: {
  id: MemoryKind;
  label: string;
  hint: string;
}[] = [
  { id: "diary", label: "日记", hint: "今天发生了什么，我当时怎么反应" },
  { id: "fact", label: "事实", hint: "关于我的客观信息：年龄、职业、处境、身体状况" },
  { id: "preference", label: "偏好", hint: "我喜欢 / 讨厌什么，什么让我受不了" },
  { id: "relation", label: "关系", hint: "某个人是谁、我们之间是什么模式" },
  { id: "event", label: "事件", hint: "已经发生的重要节点，以及它的后续" },
  { id: "decision", label: "决定", hint: "我做过什么选择，当时在权衡什么" },
  { id: "insight", label: "洞察", hint: "我对自己有了什么新的认识" },
  { id: "goal", label: "目标", hint: "我想达成什么，愿意付出什么" },
];

export const MEMORY_KIND_MAP: Record<string, { label: string }> = Object.fromEntries(
  MEMORY_KINDS.map((k) => [k.id, k])
);

export interface MemoryEntry {
  id: string;
  kind: MemoryKind;
  title?: string;
  content: string;
  tags: string[];
  /** 0-100，越高越会被优先引用进推演 */
  importance: number;
  /** 事情发生的时间（可空，空则视为记录时间） */
  occurredAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CoverageDomain {
  key: string;
  label: string;
  count: number;
  covered: boolean;
}

/**
 * 依据充分度
 *
 * 注意措辞：这不是"AI 有多准"，而是"我对你了解多少"。
 * 分数低时推演的结论必须显式降级，不能装作有把握。
 */
export interface KnowledgeCoverage {
  /** 0-100 */
  score: number;
  entries: number;
  domains: CoverageDomain[];
  /** 完全没有记录的生活面向 */
  missing: string[];
  /** 补什么会让推演变准 */
  suggestions: string[];
  /** 最近 30 天内新增的条数，用于判断"是否还在更新" */
  recent: number;
}
