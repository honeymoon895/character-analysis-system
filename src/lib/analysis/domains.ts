/**
 * 领域框架
 *
 * 问题：原先把所有人（诗人、将领、企业家）都套同一套大五人格九维，
 * 结果无论分析谁，雷达图长得都差不多——这不是分析，是模板填空。
 *
 * 做法：不同「评估域」用不同的维度集合。
 * - 对人（自己、身边的人）仍用大五，因为这是有人格心理学依据的。
 * - 对公众人物，按职业选域：诗人看意象与语言，将领看战略与决断。
 * - 虚构角色不谈人格，直接评估能力与战斗，避免把动漫角色硬套成人格量表。
 *
 * 注意：除人格域外，其余维度是**分析工具**，不是有信效度验证的心理量表。
 * 界面上必须标明这一点，不能让人以为是科学测量。
 */

export type DomainId =
  | "personality"
  | "literary"
  | "military"
  | "business"
  | "science"
  | "art"
  | "politics"
  | "thought"
  | "sports"
  | "fictional";

export interface DomainDimension {
  code: string;
  name: string;
  /** 这个维度到底在量什么，直接喂给模型，也显示给用户 */
  desc: string;
  /** 高分端的典型表现 */
  high?: string;
  /** 低分端的典型表现 */
  low?: string;
}

export interface DomainFramework {
  id: DomainId;
  /** 展示名 */
  name: string;
  /** 一句话说明这个框架看什么 */
  tagline: string;
  /** 是否基于实证心理测量 */
  empirical: boolean;
  /** 代表性的分析对象，帮助模型判断该选哪个域 */
  appliesTo: string[];
  dimensions: DomainDimension[];
}

export const FRAMEWORKS: Record<DomainId, DomainFramework> = {
  /* ══════════════ 人格（唯一有实证依据的域） ══════════════ */
  personality: {
    id: "personality",
    name: "人格结构",
    tagline: "基于大五人格模型，看稳定特质与防御方式",
    empirical: true,
    appliesTo: ["身边的人", "用户自己", "缺乏明确职业身份的普通人"],
    dimensions: [
      { code: "OPENNESS", name: "开放性", desc: "对新经验、新观念的接受度", high: "求新、好奇、观念开放", low: "务实、守成、偏好确定" },
      { code: "CONSCIENTIOUSNESS", name: "尽责性", desc: "自律、条理与目标坚持", high: "有条理、守承诺、能坚持", low: "随性、易拖延、重即兴" },
      { code: "EXTRAVERSION", name: "外向性", desc: "社交能量的投入与获取方式", high: "主动、话多、从人群获得能量", low: "内敛、独处恢复、慢热" },
      { code: "AGREEABLENESS", name: "宜人性", desc: "合作意愿与人际温度", high: "体贴、愿妥协、易信任", low: "竞争、质疑、直来直去" },
      { code: "NEUROTICISM", name: "情绪稳定性", desc: "压力下的情绪波动程度（分越高越稳定）", high: "抗压强、情绪平缓", low: "敏感、易焦虑、反应强烈" },
      { code: "DECISIVENESS", name: "决断力", desc: "在信息不全时做决定的能力", high: "迅速拍板、承担后果", low: "反复权衡、怕出错" },
      { code: "RISK_TENDENCY", name: "风险偏好", desc: "对不确定性的容忍与偏好", high: "敢押注、爱冒险", low: "先求稳、避免损失" },
      { code: "EMPATHY", name: "共情能力", desc: "读取并回应他人情绪的能力", high: "敏锐、善倾听", low: "理性、重事实轻感受" },
      { code: "LEADERSHIP", name: "领导力", desc: "组织他人并承担责任的倾向", high: "有号召力、敢担责", low: "更愿做执行者" },
    ],
  },

  /* ══════════════ 文学 ══════════════ */
  literary: {
    id: "literary",
    name: "文学气质",
    tagline: "看一个写作者如何感知世界、处理语言与痛苦",
    empirical: false,
    appliesTo: ["诗人", "作家", "小说家", "散文家", "剧作家", "歌词作者"],
    dimensions: [
      { code: "IMAGERY", name: "意象敏感", desc: "能否把抽象感受转化为具体可感的物象", high: "一眼抓住画面，细节密集", low: "偏思辨，少描写" },
      { code: "EMOTION_DEPTH", name: "情感浓度", desc: "情绪体验的强度与持久度", high: "大起大落，情绪即素材", low: "克制、疏离、淡写" },
      { code: "LANGUAGE_CRAFT", name: "语言自觉", desc: "对字词、节奏、句式的刻意经营", high: "字斟句酌，风格强烈", low: "以达意为主，不雕琢" },
      { code: "INTROSPECTION", name: "内省深度", desc: "向内的自我审视与剖析倾向", high: "反复拷问自己", low: "向外看，少自省" },
      { code: "METAPHOR", name: "隐喻思维", desc: "用类比与转义组织经验的能力", high: "万物皆可喻", low: "直陈其事" },
      { code: "DETACHMENT", name: "现实疏离", desc: "与世俗秩序、功名体系的距离", high: "不入仕、不经营、边缘化", low: "入世、擅应对、求认可" },
      { code: "AESTHETIC", name: "审美执念", desc: "为形式完美不惜代价的程度", high: "改到最后一刻", low: "完成即止" },
      { code: "EMPATHY_RANGE", name: "共情广度", desc: "能理解多少种与己不同的人", high: "写谁都像那个人", low: "声音单一，多为自我投射" },
    ],
  },

  /* ══════════════ 军事 ══════════════ */
  military: {
    id: "military",
    name: "军事才能",
    tagline: "看一个人如何在资源不足与信息不全中决胜负",
    empirical: false,
    appliesTo: ["将领", "军事家", "开国君主", "起义领袖", "战争中的指挥官"],
    dimensions: [
      { code: "STRATEGY", name: "战略视野", desc: "跨越时间尺度的全局布局能力", high: "谋十年，先定格局", low: "只顾眼前一役" },
      { code: "DECISION", name: "临机决断", desc: "战场瞬息间拍板的魄力", high: "当机立断，不疑", low: "犹豫，贻误战机" },
      { code: "RISK", name: "风险承受", desc: "敢不敢用险招、赌国运", high: "奇袭、背水、斩首", low: "稳扎稳打，不冒险" },
      { code: "MORALE", name: "军心凝聚", desc: "让士兵愿意为其赴死的能力", high: "同甘苦，士卒效死", low: "靠军法维持" },
      { code: "DISCIPLINE", name: "治军严整", desc: "组织、训练与执行的严密程度", high: "令行禁止，营伍肃然", low: "松散，靠个人勇武" },
      { code: "INTEL", name: "情报嗅觉", desc: "识破虚实、利用信息差的能力", high: "善用间，料敌先机", low: "易被欺敌" },
      { code: "PSYCH_OPS", name: "心理攻势", desc: "瓦解对手意志、争取人心的手段", high: "攻心为上", low: "只靠兵力硬拼" },
      { code: "POLITICS", name: "政治嗅觉", desc: "在朝堂与军权之间的平衡", high: "功高而能自保", low: "功成身死" },
    ],
  },

  /* ══════════════ 商业 ══════════════ */
  business: {
    id: "business",
    name: "商业能力",
    tagline: "看一个人如何识别机会、调动资源并把事做成",
    empirical: false,
    appliesTo: ["企业家", "创始人", "投资人", "职业经理人", "商人"],
    dimensions: [
      { code: "OPPORTUNITY", name: "机会识别", desc: "在别人看到麻烦的地方看到生意", high: "早半步看到需求", low: "跟随者，后知后觉" },
      { code: "EXECUTION", name: "执行力度", desc: "从想法到落地的推动力", high: "今天想到今天干", low: "方案多，落地少" },
      { code: "RESOURCE", name: "资源整合", desc: "把不属于自己的资源凑成局面", high: "空手套白狼", low: "只依赖自有资源" },
      { code: "RISK_APPETITE", name: "风险偏好", desc: "押注未来的意愿与尺度", high: "All in，敢负债", low: "保守，留有退路" },
      { code: "ORGANIZATION", name: "组织建设", desc: "搭班子、定规则、留人才", high: "体系化，可离开", low: "事事亲力亲为" },
      { code: "NEGOTIATION", name: "谈判能力", desc: "在博弈中为己方争取空间", high: "寸土必争且不失关系", low: "易让步或强硬化" },
      { code: "LONG_TERM", name: "长期主义", desc: "愿意为长远收益牺牲短期数字", high: "十年磨一剑", low: "追季度、追风口" },
      { code: "RESILIENCE", name: "抗压韧性", desc: "失败后重新站起来的次数", high: "连续失败仍能再起", low: "一次重挫即退场" },
    ],
  },

  /* ══════════════ 科学 ══════════════ */
  science: {
    id: "science",
    name: "科研特质",
    tagline: "看一个人如何提出问题、忍受不确定并逼近真相",
    empirical: false,
    appliesTo: ["科学家", "数学家", "工程师", "发明家", "学者"],
    dimensions: [
      { code: "CURIOSITY", name: "好奇驱动", desc: "对「为什么」的持久饥渴", high: "一辈子在问蠢问题", low: "解决问题导向，不追根究底" },
      { code: "ABSTRACTION", name: "抽象能力", desc: "从现象中提炼结构的能力", high: "一眼看到模型", low: "停留在具体经验" },
      { code: "SKEPTICISM", name: "怀疑精神", desc: "对权威与共识的挑战意愿", high: "敢于推翻定论", low: "尊重既有框架" },
      { code: "FOCUS", name: "长期专注", desc: "在单一问题上持续投入的耐力", high: "十年只做一件事", low: "兴趣转移快" },
      { code: "CROSS_DOMAIN", name: "跨域联想", desc: "把别处的结构借过来用", high: "类比迁移能力强", low: "深耕单一领域" },
      { code: "RIGOR", name: "实证严谨", desc: "对证据与误差的苛求程度", high: "宁可不发也不凑数", low: "重结论轻验证" },
      { code: "FAILURE_TOLERANCE", name: "失败耐受", desc: "面对长期无结果的心理承受", high: "把失败当数据", low: "需要正反馈维持" },
    ],
  },

  /* ══════════════ 艺术 ══════════════ */
  art: {
    id: "art",
    name: "艺术特质",
    tagline: "看一个人的感受力、表达欲与形式实验的胆量",
    empirical: false,
    appliesTo: ["画家", "音乐家", "导演", "演员", "设计师", "舞者", "建筑师"],
    dimensions: [
      { code: "PERCEPTION", name: "感知敏锐", desc: "对色彩、声音、身体细节的抓取", high: "看得见别人看不见的", low: "重概念轻感官" },
      { code: "EXPRESSION", name: "表达冲动", desc: "非把内心外化不可的冲动", high: "不表达会难受", low: "克制、可有可无" },
      { code: "FORM", name: "形式实验", desc: "打破既有形式边界的胆量", high: "推翻自己的风格", low: "在成熟范式内精进" },
      { code: "EMOTION_OUT", name: "情绪外化", desc: "把私人情绪转为公共作品", high: "作品即自传", low: "作品与作者分离" },
      { code: "CRAFT", name: "手艺精进", desc: "对技术基本功的投入", high: "苦练不辍", low: "重观念轻技法" },
      { code: "AUDIENCE", name: "受众直觉", desc: "知道什么能击中人的能力", high: "天然懂共鸣点", low: "自我表达优先" },
      { code: "DISCIPLINE_ART", name: "创作纪律", desc: "灵感之外日复一日的产出", high: "定量产出，不等灵感", low: "靠情绪驱动" },
    ],
  },

  /* ══════════════ 政治 ══════════════ */
  politics: {
    id: "politics",
    name: "政治手腕",
    tagline: "看一个人如何在多方博弈中积累并守住权力",
    empirical: false,
    appliesTo: ["政治家", "帝王", "改革者", "革命者", "外交家", "权臣"],
    dimensions: [
      { code: "POWER_SENSE", name: "权力敏感", desc: "对权力结构与利害关系的直觉", high: "一眼看清谁真正说了算", low: "重事理轻人事" },
      { code: "COALITION", name: "联盟构建", desc: "把敌友重新排列组合的能力", high: "今日之敌可为明日之友", low: "敌我分明，不留余地" },
      { code: "RHETORIC", name: "舆论动员", desc: "让人相信并追随的表达力", high: "能把私利说成天理", low: "不善宣传" },
      { code: "COMPROMISE", name: "妥协艺术", desc: "在原则与实效之间的分寸", high: "退一步换全局", low: "宁折不弯" },
      { code: "CRISIS", name: "危机处置", desc: "变局中的定力与应变", high: "越乱越稳", low: "顺境英雄" },
      { code: "IDEOLOGY", name: "理念感召", desc: "是否有能长期凝聚人的主张", high: "有一套被记住的话", low: "纯权术，无愿景" },
      { code: "PATIENCE", name: "忍耐力", desc: "长期蛰伏、等待时机的耐力", high: "可等十年", low: "急于求成" },
    ],
  },

  /* ══════════════ 思想 ══════════════ */
  thought: {
    id: "thought",
    name: "思想特质",
    tagline: "看一个人如何拆解常识、搭建体系并承受孤独",
    empirical: false,
    appliesTo: ["哲学家", "思想家", "宗教人物", "社会批评者", "理论家"],
    dimensions: [
      { code: "SYSTEM", name: "体系建构", desc: "把零散洞见组织成完整框架的能力", high: "自成一家", low: "格言式，碎片化" },
      { code: "CRITIQUE", name: "批判锋芒", desc: "敢于拆掉众人习以为常的前提", high: "直指根基", low: "修补式改进" },
      { code: "PARADOX", name: "悖论耐受", desc: "能同时握住两种相反真相而不崩溃", high: "以矛盾为方法", low: "必须二选一" },
      { code: "WORLDLY", name: "现世关切", desc: "思想是否指向真实的人间问题", high: "为时代而写", low: "纯思辨自娱" },
      { code: "CLARITY", name: "表达清晰", desc: "把复杂想法说清的能力", high: "深而能浅", low: "以晦涩自证深刻" },
      { code: "INDEPENDENCE", name: "独立判断", desc: "不依附任何阵营的定力", high: "谁都能得罪", low: "随派别摇摆" },
      { code: "LONELINESS", name: "孤独承受", desc: "思想超前于时代时的心理代价", high: "被误解仍坚持", low: "需要同道确认" },
    ],
  },

  /* ══════════════ 体育 ══════════════ */
  sports: {
    id: "sports",
    name: "竞技特质",
    tagline: "看一个人在极限压力下如何调动身体与意志",
    empirical: false,
    appliesTo: ["运动员", "教练", "格斗家", "棋手"],
    dimensions: [
      { code: "BODY", name: "身体控制", desc: "对力量、精度、节奏的掌控", high: "动作精确到毫厘", low: "依赖天赋，细节粗糙" },
      { code: "COMPETE", name: "竞争意志", desc: "面对强手时的攻击性", high: "越强越兴奋", low: "遇强则缩" },
      { code: "FOCUS_LIVE", name: "临场专注", desc: "关键时刻的心理稳定度", high: "越关键越冷静", low: "大赛失常" },
      { code: "TACTICS", name: "战术理解", desc: "读局、调整、针对对手的能力", high: "场上即教练", low: "只按套路执行" },
      { code: "RECOVERY", name: "恢复自律", desc: "训练之外的自律程度", high: "饮食作息精确管理", low: "靠天赋吃老本" },
      { code: "PRESSURE", name: "压力表现", desc: "压力对表现的增益或损害", high: "压力是燃料", low: "压力导致崩盘" },
      { code: "TEAM", name: "团队协作", desc: "在集体中承担与让位的能力", high: "能当核心也能当绿叶", low: "只适合个人项目" },
    ],
  },

  /* ══════════════ 虚构角色 ══════════════ */
  fictional: {
    id: "fictional",
    name: "能力评估",
    tagline: "虚构角色的战斗力、能力边界与战术风格（非人格测量）",
    empirical: false,
    appliesTo: ["动漫角色", "游戏角色", "小说人物", "电影角色", "神话人物"],
    dimensions: [
      { code: "POWER", name: "战斗力", desc: "正面交锋时的绝对强度", high: "单挑几乎无解", low: "需依托环境或队友" },
      { code: "CEILING", name: "能力上限", desc: "全盛状态或极限爆发的天花板", high: "有灭世级底牌", low: "稳定但无爆发" },
      { code: "TACTICS_F", name: "战术智力", desc: "临场判断与计谋运用", high: "把强敌引入自己的规则", low: "靠本能硬拼" },
      { code: "GROWTH", name: "成长潜力", desc: "随时间与战斗提升的空间", high: "每次濒死都变强", low: "定型，难有突破" },
      { code: "DEFENSE", name: "防御韧性", desc: "承受伤害与恢复的能力", high: "打不死，能再生", low: "攻高防低" },
      { code: "SPEED", name: "速度机动", desc: "位移、先手与追击能力", high: "快到无法反应", low: "慢但可怕" },
      { code: "SPIRIT", name: "精神力", desc: "意志、抗控与精神抗性", high: "宁死不屈", low: "易被动摇" },
      { code: "WEAKNESS", name: "弱点暴露", desc: "破绽的明显程度（分越高越容易被针对）", high: "弱点写在脸上", low: "几乎无解" },
    ],
  },
};

/** 从文字判断最可能的域（供模型参考，最终由模型决定） */
export function guessDomainHints(): string {
  return Object.values(FRAMEWORKS)
    .map((f) => `- ${f.id}（${f.name}）：适用于 ${f.appliesTo.join("、")}`)
    .join("\n");
}

/** 生成给模型的维度定义块 */
export function dimensionSpec(f: DomainFramework): string {
  return f.dimensions
    .map(
      (d) =>
        `  ${d.code}（${d.name}）：${d.desc}${
          d.high ? `；高分= ${d.high}` : ""
        }${d.low ? `；低分= ${d.low}` : ""}`
    )
    .join("\n");
}

export function getFramework(id: string | undefined | null): DomainFramework {
  if (id && id in FRAMEWORKS) return FRAMEWORKS[id as DomainId];
  return FRAMEWORKS.personality;
}
