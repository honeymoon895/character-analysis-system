// 九维心理特征维度定义
export interface DimensionScore {
  code: string;
  name: string;
  score: number;       // 0-100
  confidence: number;  // 0-100%
  evidence?: string[];
}

export const DIMENSION_DEFINITIONS = [
  {
    code: "OPENNESS",
    name: "开放性",
    description: "反映个体对新事物、新体验的开放程度",
    highLabel: "好奇宝宝、探索者",
    mediumLabel: "愿意尝试",
    lowLabel: "恋旧、固守",
  },
  {
    code: "CONSCIENTIOUSNESS",
    name: "尽责性",
    description: "反映个体的自律性、责任感和条理性",
    highLabel: "自律达人、井井有条",
    mediumLabel: "靠得住",
    lowLabel: "随遇而安、拖延症",
  },
  {
    code: "EXTRAVERSION",
    name: "外向性",
    description: "反映个体对外部世界的投入程度",
    highLabel: "社交达人、话匣子",
    mediumLabel: "平衡者",
    lowLabel: "独行侠、安静",
  },
  {
    code: "AGREEABLENESS",
    name: "宜人性",
    description: "反映个体在人际合作中的友善程度",
    highLabel: "温暖、善解人意",
    mediumLabel: "友好",
    lowLabel: "竞争、挑剔",
  },
  {
    code: "NEUROTICISM",
    name: "情绪稳定性",
    description: "反映个体情绪的稳定性和抗压能力",
    highLabel: "稳如泰山、抗压",
    mediumLabel: "正常人",
    lowLabel: "敏感、焦虑",
  },
  {
    code: "DECISIVENESS",
    name: "决断力",
    description: "反映个体决策的速度和果断程度",
    highLabel: "雷厉风行、果断",
    mediumLabel: "权衡者",
    lowLabel: "犹豫、纠结",
  },
  {
    code: "RISK_TENDENCY",
    name: "风险偏好",
    description: "反映个体对风险和挑战的态度",
    highLabel: "冒险家、敢闯",
    mediumLabel: "稳健",
    lowLabel: "保守、安全第一",
  },
  {
    code: "EMPATHY",
    name: "共情能力",
    description: "反映个体理解和感受他人情感的能力",
    highLabel: "知心、善倾听",
    mediumLabel: "理解",
    lowLabel: "理性、分析",
  },
  {
    code: "LEADERSHIP",
    name: "领导力",
    description: "反映个体的领导魅力和组织能力",
    highLabel: "领袖、感染力",
    mediumLabel: "组织者",
    lowLabel: "执行者",
  },
];

export function generateTags(dimensions: DimensionScore[]): { emoji: string; tag: string; size: "lg" | "md" | "sm" }[] {
  const tags: { emoji: string; tag: string; size: "lg" | "md" | "sm" }[] = [];

  const tagMap: Record<string, { high: [string, string][]; mid: [string, string][]; low: [string, string][] }> = {
    OPENNESS: {
      high: [["🔥", "好奇宝宝"], ["🌍", "探索者"]],
      mid: [["🌱", "愿意尝试"]],
      low: [["🏠", "恋旧"], ["📦", "固守"]],
    },
    CONSCIENTIOUSNESS: {
      high: [["⏰", "自律达人"], ["🧹", "井井有条"]],
      mid: [["✅", "靠得住"]],
      low: [["🌊", "随遇而安"], ["📅", "拖延症"]],
    },
    EXTRAVERSION: {
      high: [["🎉", "社交达人"], ["🗣️", "话匣子"]],
      mid: [["⚖️", "平衡者"]],
      low: [["🌙", "独行侠"], ["🔇", "安静"]],
    },
    AGREEABLENESS: {
      high: [["🤝", "温暖"], ["💝", "善解人意"]],
      mid: [["👍", "友好"]],
      low: [["⚔️", "竞争"], ["🧐", "挑剔"]],
    },
    NEUROTICISM: {
      high: [["🧘", "稳如泰山"], ["💪", "抗压"]],
      mid: [["🎢", "正常人"]],
      low: [["🌪️", "敏感"], ["😰", "焦虑"]],
    },
    DECISIVENESS: {
      high: [["⚡", "雷厉风行"], ["🎯", "果断"]],
      mid: [["🤔", "权衡者"]],
      low: [["💭", "犹豫"], ["🔄", "纠结"]],
    },
    RISK_TENDENCY: {
      high: [["🚀", "冒险家"], ["🎲", "敢闯"]],
      mid: [["⚖️", "稳健"]],
      low: [["🛡️", "保守"], ["🏠", "安全第一"]],
    },
    EMPATHY: {
      high: [["❤️", "知心"], ["👂", "善倾听"]],
      mid: [["🤝", "理解"]],
      low: [["🧠", "理性"], ["🔬", "分析"]],
    },
    LEADERSHIP: {
      high: [["👑", "领袖"], ["📢", "感染力"]],
      mid: [["🗂️", "组织者"]],
      low: [["🏃", "执行者"]],
    },
  };

  for (const dim of dimensions) {
    const tagDef = tagMap[dim.code];
    if (!tagDef) continue;

    let selected: [string, string][];
    if (dim.score >= 70) {
      selected = tagDef.high;
    } else if (dim.score >= 40) {
      selected = tagDef.mid;
    } else {
      selected = tagDef.low;
    }

    const size = dim.score >= 70 || dim.score < 30 ? "lg" : dim.confidence >= 70 ? "md" : "sm";

    for (const [emoji, tag] of selected) {
      tags.push({ emoji, tag, size });
    }
  }

  return tags;
}

export function detectContradictions(dimensions: DimensionScore[]): string[] {
  const contradictions: string[] = [];
  const map = new Map(dimensions.map(d => [d.code, d]));

  const ext = map.get("EXTRAVERSION");
  const neu = map.get("NEUROTICISM");
  const dec = map.get("DECISIVENESS");
  const risk = map.get("RISK_TENDENCY");
  const agr = map.get("AGREEABLENESS");
  const lead = map.get("LEADERSHIP");
  const emp = map.get("EMPATHY");

  // 内外反差
  if (ext && ext.score > 70 && neu && neu.confidence > 70) {
    contradictions.push("TA在公共场合很外向，但私下可能是个需要独处充电的人");
  }

  // 认知失调
  if (dec && dec.score < 30 && risk && risk.score > 70) {
    contradictions.push("TA喜欢冒险却害怕做决定，可能是有想法但害怕承担后果");
  }

  // 价值冲突
  if (agr && agr.score > 80 && lead && lead.score > 80) {
    contradictions.push("TA既温暖又强势，可能是一个外柔内刚的管理者");
  }

  // 行为不一致
  if (emp && emp.score > 80 && neu && neu.score < 30) {
    contradictions.push("TA很敏感善于体察他人，但自己的情绪容易受到影响");
  }

  // 公开 vs 私下
  if (ext && ext.score > 70 && agr && agr.score < 30) {
    contradictions.push("TA在社交场合表现活跃，但可能实际上并不那么友善随和");
  }

  return contradictions;
}
