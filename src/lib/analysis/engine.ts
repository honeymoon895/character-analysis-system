/**
 * 心理研判引擎
 *
 * 与旧版 `analyzeCharacter` 的区别：
 * - 旧版：让模型给 9 个维度打分 → 输出一堆"温暖、善解人意"式标签 → 看起来像那么回事，实则不可证伪。
 * - 新版：强制模型按"证据 → 推断 → 竞争假设 → 可证伪预测"的链条输出，并允许维度留空。
 *
 * 为什么这样设计：人格心理学的可靠结论建立在多源证据交叉验证上（观察 + 自陈 + 他人评价）。
 * 单凭一方描述就给出精确分数是不诚实的，因此这里显式建模"不知道"。
 */
import type {
  AnalysisProfile,
  TraitScore,
  Evidence,
  Hypothesis,
} from "./types";
import { emptyAnalysis, ANALYSIS_MODEL_VERSION } from "./types";

const AI_API_KEY =
  process.env.AI_API_KEY ||
  process.env.AGNES_API_KEY ||
  process.env.DEEPSEEK_API_KEY ||
  "";
const API_URL =
  process.env.AI_API_URL || "https://apihub.agnes-ai.com/v1/chat/completions";
const AI_MODEL = process.env.AI_MODEL || "agnes-2.0-flash";

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

/** 判断当前是否配置了真实 AI —— 未配置时应当明说，而不是伪造分析 */
export function isAIConfigured(): boolean {
  return Boolean(AI_API_KEY);
}

async function callAI(
  messages: Message[],
  opts: { temperature?: number; maxTokens?: number; json?: boolean } = {}
): Promise<string | null> {
  if (!AI_API_KEY) return null;

  const { temperature = 0.4, maxTokens = 8000, json = true } = opts;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages,
        temperature,
        max_tokens: maxTokens,
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    if (!response.ok) {
      console.error(`AI API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.error("AI call failed:", error);
    return null;
  }
}

/**
 * 从模型回复中提取 JSON。模型常见的三种包装：裸 JSON、```json 代码块、前后带说明文字。
 */
export function extractJson(text: string | null): any | null {
  if (!text) return null;

  try {
    const direct = JSON.parse(text);
    if (direct && typeof direct === "object") return direct;
  } catch {}

  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) {
    try {
      const parsed = JSON.parse(codeBlock[1].trim());
      if (parsed && typeof parsed === "object") return parsed;
    } catch {}
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(text.slice(start, end + 1));
      if (parsed && typeof parsed === "object") return parsed;
    } catch {}
  }

  return null;
}

/** 分析框架说明——这段决定了模型输出的专业度，直接写在 system prompt 里 */
const FRAMEWORK_PROMPT = `你是一位受过临床训练的人格心理学研究者，同时具备心理动力学与社会认知视角。你的任务不是讨好用户，而是给出一个**可被现实检验**的人格研判。

【硬性规则——违反任何一条，输出即不合格】
1. **不许空泛**。禁止"TA很复杂""TA敏感而坚强""需要被理解"这类放在谁身上都成立的句子。每一句结论都必须能回答："凭什么这么说？在什么情况下这句话会错？"
2. **证据先行**。每个判断必须引用输入中的具体行为、原话或事实。没有证据支撑的维度，score 必须为 null，并在 evidence 里写明"当前信息不足"。宁可留白，绝不编造。
3. **区分观察与推断**。看到的行为记为 observed；对方自述记为 reported；他人转述记为 secondhand；由行为反推的动机记为 inferred。不要把 inferred 写成 observed。
4. **必须给反证**。每个主结论都要主动寻找与之冲突的观察，写入 counterEvidence。找不到反证就如实写空数组，并说明样本偏差。
5. **动机必须多假设**。同一个行为至少给出 2-3 种竞争解释，给出各自概率与**证伪条件**。真实意图往往不是最直觉的那个。
6. **禁止道德评判**。描述机制，不评价好坏。不说"TA缺乏责任心"，而说"在高不确定情境下，TA倾向于推迟承诺以保留退出选项"。
7. **区分特质与状态**。一次行为可能是情境反应，不构成人格特质。若证据只来自单次事件，confidence 必须低于 45。
8. **承认文化与他人视角的局限**。你只有单侧信息，所有关于内心的结论都是概率性的。
9. **复合指标要标明推导**。决断力、风险偏好、共情、领导力不是大五的独立维度，必须由大五子面推导，并用 derivedFrom 说明依据。
10. **中文输出**，术语用规范译名，必要时括注英文。

【输出 JSON 结构】严格按此结构，不要增删顶层字段：
{
  "meta": {
    "sources": ["本次分析依据的信息来源，逐条列出"],
    "sufficiency": 0-100,
    "unknowns": ["目前完全无法判断的方面"]
  },
  "traits": [
    {
      "code": "OPENNESS|CONSCIENTIOUSNESS|EXTRAVERSION|AGREEABLENESS|NEUROTICISM|DECISIVENESS|RISK_TENDENCY|EMPATHY|LEADERSHIP",
      "name": "中文名",
      "score": 0-100 或 null,
      "confidence": 0-100,
      "anchor": "该分数段的典型行为描述（具体，不要形容词堆砌）",
      "evidence": [{"kind":"observed|reported|secondhand|inferred","statement":"具体证据","weight":"strong|moderate|weak","caveat":"何时失效"}],
      "counterEvidence": [同上结构],
      "boundary": "这个判断在什么情境下不成立",
      "facets": [{"name":"子面名","score":0-100或null,"evidence":["证据"],"counter":["反证"]}],
      "composite": true/false,
      "derivedFrom": "复合指标的推导依据"
    }
  ],
  "motivation": {
    "needs": [{"need":"核心需要","threat":"对应的恐惧","evidence":"依据"}],
    "values": [{"value":"价值","rank":1,"evidence":"依据"}],
    "avoidanceGoals": ["TA极力避免的事情"]
  },
  "regulation": {
    "defenses": [{"name":"防御机制名","maturity":"mature|neurotic|immature","description":"如何表现","evidence":"依据"}],
    "attributionStyle": "归因风格",
    "emotionRegulation": ["情绪调节策略"],
    "stressCoping": "压力下的典型应对"
  },
  "relational": {
    "attachment": {"anxiety":0-100或null,"avoidance":0-100或null,"style":"安全型|焦虑型|回避型|恐惧型|未测出","confidence":0-100,"reasoning":"依据"},
    "interpersonal": {"dominance":-100到100,"affiliation":-100到100,"note":"在人际环上的位置说明"},
    "underThreat": "感到不安全时的关系策略",
    "repeatingPattern": "在关系中最容易重复的模式"
  },
  "narrative": {
    "coreBeliefs": ["核心信念/图式"],
    "identityConflict": "身份认同中的冲突",
    "selfStory": "TA用来自我叙述的人生主线",
    "blindSpots": ["TA自己大概率没意识到的事"]
  },
  "formulation": {
    "coreThesis": "一句话核心结论——必须是可错的判断",
    "coreConflict": "核心冲突：两种互相拉扯的力",
    "triggers": ["触发点"],
    "viciousCycle": "维持循环：信念→情绪→防御→行为→他人反应→强化信念",
    "developmentalHypothesis": "这种模式可能从何而来（标明是推测）"
  },
  "hypotheses": [{"statement":"对关键行为的解释","probability":0-100,"supporting":["支持观察"],"against":["反对观察"],"falsifier":"怎样才能证明这个解释是错的"}],
  "predictions": [{"situation":"在什么情境","prediction":"预测TA会怎么做","confidence":0-100,"ifWrong":"若观察到相反结果，说明什么"}],
  "guidance": {
    "effective": [{"action":"有效做法","why":"为什么对这个人有效"}],
    "counterproductive": [{"action":"无效或有害做法","why":"为什么踩雷"}],
    "whatTheyWant": "TA真正想要的是什么",
    "whatTheyFear": "TA最怕被怎样对待"
  }
}`;

/** 大五子面参考，用于让模型输出更细颗粒度 */
const FACET_HINTS = `【子面参考（有证据才填）】
开放性：想象力 / 审美敏感 / 情感丰富度 / 求新求变 / 观念开放
尽责性：条理性 / 尽责程度 / 成就追求 / 自律性 / 审慎性
外向性：热情度 / 乐群性 / 果断自信 / 活跃度 / 寻求刺激 / 正性情绪
宜人性：信任 / 直率 / 利他 / 顺从合作 / 谦逊 / 共情关怀
情绪稳定性（神经质反向）：焦虑 / 愤怒敌意 / 抑郁 / 自我意识 / 冲动性 / 脆弱性`;

function buildPublicFigurePrompt(name: string): string {
  return `${FRAMEWORK_PROMPT}

${FACET_HINTS}

【本次任务】分析公众人物 / 历史人物：「${name}」

要求：
- 只使用有据可查的公开事实（言行记载、著作、他人评述、重大决策）。若你对这个人物的信息掌握不足，宁愿把 sufficiency 打低、把多数维度置为 null，并在 unknowns 里写清楚，也不要凭名字气质编造。
- 历史人物需纳入时代与文化背景，避免用现代个人主义标准评判其动机。
- 额外输出两个字段：
  "keyEvents": [{"year":"","event":"","significance":"对人格形成或印证的作用"}]
  "achievements": [{"domain":"","title":"","description":"反映出的能力或动机倾向"}]
  keyEvents 重点写**对人格有塑造或印证作用**的事件，不要写成履历表。`;
}

function buildPersonalPrompt(
  name: string,
  descriptions: string[],
  relationship?: string,
  scene?: string
): string {
  const descText = descriptions.filter(Boolean).join("\n---\n");

  return `${FRAMEWORK_PROMPT}

${FACET_HINTS}

【本次任务】分析用户身边的人物：「${name || "未命名"}」
${relationship ? `用户与TA的关系：${relationship}` : ""}
${scene ? `常见相处场景：${scene}` : ""}

【用户的观察材料】
${descText || "（无描述）"}

额外要求：
- 材料来自**单一视角**，存在天然的观察者偏差。必须在 meta.sources 中说明这一点，并将其体现在 confidence 上。
- 用户描述里往往夹杂自己的情绪与诉求（例如"TA根本不在乎我"）。要把**可观察行为**与**用户的解释**分开：前者可作证据，后者只作线索。
- 重点回答用户真正想知道的：TA 是怎么想的、那些让人费解的行为背后是什么、以及接下来怎么做会有用。
- 如果材料不足以支撑某层判断（例如完全无法推断依恋模式），该层字段留空或置 null，不要填写模板化内容。`;
}

/** 把模型返回的原始对象规整成 AnalysisProfile，容错并补齐缺失字段 */
function normalizeProfile(raw: any): AnalysisProfile {
  const traits: TraitScore[] = Array.isArray(raw?.traits)
    ? raw.traits.map((t: any) => ({
        code: String(t?.code || ""),
        name: String(t?.name || t?.code || ""),
        score: typeof t?.score === "number" ? clamp(t.score, 0, 100) : null,
        confidence:
          typeof t?.confidence === "number" ? clamp(t.confidence, 0, 100) : 0,
        anchor: t?.anchor || "",
        evidence: normalizeEvidence(t?.evidence),
        counterEvidence: normalizeEvidence(t?.counterEvidence),
        boundary: t?.boundary || "",
        facets: Array.isArray(t?.facets)
          ? t.facets.map((f: any) => ({
              name: String(f?.name || ""),
              score: typeof f?.score === "number" ? clamp(f.score, 0, 100) : null,
              evidence: toStringArray(f?.evidence),
              counter: toStringArray(f?.counter),
            }))
          : undefined,
        composite: Boolean(t?.composite),
        derivedFrom: t?.derivedFrom || "",
      }))
    : [];

  return {
    meta: {
      sources: toStringArray(raw?.meta?.sources),
      sufficiency:
        typeof raw?.meta?.sufficiency === "number"
          ? clamp(raw.meta.sufficiency, 0, 100)
          : 0,
      unknowns: toStringArray(raw?.meta?.unknowns),
      isAnalyzed: true,
      modelVersion: ANALYSIS_MODEL_VERSION,
      generatedAt: new Date().toISOString(),
    },
    traits,
    motivation: {
      needs: Array.isArray(raw?.motivation?.needs)
        ? raw.motivation.needs.map((n: any) => ({
            need: String(n?.need || ""),
            threat: String(n?.threat || ""),
            evidence: String(n?.evidence || ""),
          }))
        : [],
      values: Array.isArray(raw?.motivation?.values)
        ? raw.motivation.values.map((v: any, i: number) => ({
            value: String(v?.value || ""),
            rank: typeof v?.rank === "number" ? v.rank : i + 1,
            evidence: String(v?.evidence || ""),
          }))
        : [],
      avoidanceGoals: toStringArray(raw?.motivation?.avoidanceGoals),
    },
    regulation: {
      defenses: Array.isArray(raw?.regulation?.defenses)
        ? raw.regulation.defenses.map((d: any) => ({
            name: String(d?.name || ""),
            maturity: ["mature", "neurotic", "immature"].includes(d?.maturity)
              ? d.maturity
              : "neurotic",
            description: String(d?.description || ""),
            evidence: String(d?.evidence || ""),
          }))
        : [],
      attributionStyle: raw?.regulation?.attributionStyle || "",
      emotionRegulation: toStringArray(raw?.regulation?.emotionRegulation),
      stressCoping: raw?.regulation?.stressCoping || "",
    },
    relational: {
      attachment: {
        anxiety: numOrNull(raw?.relational?.attachment?.anxiety),
        avoidance: numOrNull(raw?.relational?.attachment?.avoidance),
        style: raw?.relational?.attachment?.style || "未测出",
        confidence:
          typeof raw?.relational?.attachment?.confidence === "number"
            ? clamp(raw.relational.attachment.confidence, 0, 100)
            : 0,
        reasoning: raw?.relational?.attachment?.reasoning || "",
      },
      interpersonal: {
        dominance: numOrNull(raw?.relational?.interpersonal?.dominance, -100, 100),
        affiliation: numOrNull(raw?.relational?.interpersonal?.affiliation, -100, 100),
        note: raw?.relational?.interpersonal?.note || "",
      },
      underThreat: raw?.relational?.underThreat || "",
      repeatingPattern: raw?.relational?.repeatingPattern || "",
    },
    narrative: {
      coreBeliefs: toStringArray(raw?.narrative?.coreBeliefs),
      identityConflict: raw?.narrative?.identityConflict || "",
      selfStory: raw?.narrative?.selfStory || "",
      blindSpots: toStringArray(raw?.narrative?.blindSpots),
    },
    formulation: {
      coreThesis: raw?.formulation?.coreThesis || "",
      coreConflict: raw?.formulation?.coreConflict || "",
      triggers: toStringArray(raw?.formulation?.triggers),
      viciousCycle: raw?.formulation?.viciousCycle || "",
      developmentalHypothesis: raw?.formulation?.developmentalHypothesis || "",
    },
    hypotheses: Array.isArray(raw?.hypotheses)
      ? raw.hypotheses.map((h: any) => ({
          statement: String(h?.statement || ""),
          probability:
            typeof h?.probability === "number" ? clamp(h.probability, 0, 100) : 0,
          supporting: toStringArray(h?.supporting),
          against: toStringArray(h?.against),
          falsifier: String(h?.falsifier || ""),
        }))
      : [],
    predictions: Array.isArray(raw?.predictions)
      ? raw.predictions.map((p: any) => ({
          situation: String(p?.situation || ""),
          prediction: String(p?.prediction || ""),
          confidence:
            typeof p?.confidence === "number" ? clamp(p.confidence, 0, 100) : 0,
          ifWrong: String(p?.ifWrong || ""),
        }))
      : [],
    guidance: {
      effective: Array.isArray(raw?.guidance?.effective)
        ? raw.guidance.effective.map((g: any) => ({
            action: String(g?.action || ""),
            why: String(g?.why || ""),
          }))
        : [],
      counterproductive: Array.isArray(raw?.guidance?.counterproductive)
        ? raw.guidance.counterproductive.map((g: any) => ({
            action: String(g?.action || ""),
            why: String(g?.why || ""),
          }))
        : [],
      whatTheyWant: raw?.guidance?.whatTheyWant || "",
      whatTheyFear: raw?.guidance?.whatTheyFear || "",
    },
    keyEvents: Array.isArray(raw?.keyEvents)
      ? raw.keyEvents.map((e: any) => ({
          year: String(e?.year || ""),
          event: String(e?.event || ""),
          significance: String(e?.significance || ""),
        }))
      : undefined,
    achievements: Array.isArray(raw?.achievements)
      ? raw.achievements.map((a: any) => ({
          domain: String(a?.domain || ""),
          title: String(a?.title || ""),
          description: String(a?.description || ""),
        }))
      : undefined,
  } as AnalysisProfile;
}

function normalizeEvidence(arr: any): Evidence[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((e) => e && typeof e === "object")
    .map((e) => ({
      kind: ["observed", "reported", "secondhand", "inferred"].includes(e.kind)
        ? e.kind
        : "inferred",
      statement: String(e.statement || e.description || ""),
      weight: ["strong", "moderate", "weak"].includes(e.weight)
        ? e.weight
        : "moderate",
      caveat: e.caveat || "",
    }))
    .filter((e) => e.statement);
}

function toStringArray(v: any): string[] {
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : String(x?.text ?? x?.name ?? ""))).filter(Boolean);
  if (typeof v === "string" && v.trim()) return [v];
  return [];
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function numOrNull(v: any, min = 0, max = 100): number | null {
  if (typeof v !== "number" || Number.isNaN(v)) return null;
  return clamp(v, min, max);
}

/** 分析公众/历史人物 */
export async function analyzePublicFigure(name: string): Promise<AnalysisProfile> {
  const raw = await callAI([
    { role: "system", content: "你是人格心理学研究者。严格按用户给出的 JSON 结构输出，不添加解释文字。" },
    { role: "user", content: buildPublicFigurePrompt(name) },
  ]);

  const parsed = extractJson(raw);
  if (!parsed) {
    const reason = isAIConfigured()
      ? "AI 分析未成功返回结构化结果，请稍后重试。"
      : "未配置 AI 服务，无法生成分析。";
    return emptyAnalysis(reason);
  }
  return normalizeProfile(parsed);
}

/** 分析身边人物（含多轮追加的描述） */
export async function analyzePerson(
  name: string,
  descriptions: string[],
  relationship?: string,
  scene?: string
): Promise<AnalysisProfile> {
  const raw = await callAI([
    { role: "system", content: "你是人格心理学研究者。严格按用户给出的 JSON 结构输出，不添加解释文字。" },
    { role: "user", content: buildPersonalPrompt(name, descriptions, relationship, scene) },
  ]);

  const parsed = extractJson(raw);
  if (!parsed) {
    const reason = isAIConfigured()
      ? "AI 分析未成功返回结构化结果，请稍后重试。"
      : "未配置 AI 服务，无法生成分析。";
    return emptyAnalysis(reason);
  }
  return normalizeProfile(parsed);
}

/**
 * 自我分析。
 *
 * 第一人称材料的特殊性：用户既是被观察者又是观察者，
 * 会系统性地过滤掉令自己不适的信息（自我服务偏差），
 * 因此这里额外要求模型指出"你可能没看见的自己"，而不是顺着用户自我叙述复述一遍。
 */
export async function analyzeSelf(
  entries: Array<{ content: string; timestamp: string }>,
  existingProfile?: AnalysisProfile | null
): Promise<AnalysisProfile> {
  const diaryText = entries
    .map((e, i) => `[${i + 1}] ${new Date(e.timestamp).toLocaleDateString("zh-CN")}\n${e.content}`)
    .join("\n\n");

  const prior = existingProfile?.formulation?.coreThesis
    ? `\n\n【此前的研判结论（供对照，可能有误，需用新材料检验）】\n${existingProfile.formulation.coreThesis}`
    : "";

  const raw = await callAI([
    {
      role: "system",
      content:
        "你是人格心理学研究者，正在帮助一个人通过日记认识自己。严格按用户给出的 JSON 结构输出，不添加解释文字。",
    },
    {
      role: "user",
      content: `${FRAMEWORK_PROMPT}

${FACET_HINTS}

【本次任务】这是一位用户的自我记录（日记 / 自我描述），请对 TA 本人做人格研判。

【用户的自述材料】
${diaryText || "（无材料）"}${prior}

额外要求：
- 这是**第一人称材料**，存在自我服务偏差：人倾向于把成功归因于自己、把失败归因于环境，也会回避令自己不适的自我认识。请在 narrative.blindSpots 中明确指出「从这些记录里能看出、但 TA 自己可能没意识到」的模式，语气要克制、具体、不冒犯。
- 不要在总结里重复用户已经说过的自我评价（例如用户自称"我很敏感"，不要照抄），要用行为证据去检验这个自我评价是否成立、在什么范围内成立。
- 当材料前后矛盾时，不要强行调和，把矛盾本身写进 formulation.coreConflict。
- 用户是当事人，guidance 部分应给出 TA 自己可以做的具体调节动作，而不是教 TA 怎么对待别人。`,
    },
  ]);

  const parsed = extractJson(raw);
  if (!parsed) {
    const reason = isAIConfigured()
      ? "AI 分析未成功返回结构化结果，请稍后重试。"
      : "未配置 AI 服务，无法生成分析。";
    return emptyAnalysis(reason);
  }
  return normalizeProfile(parsed);
}

/**
 * 交互式研判：针对用户在具体情境下的困惑，给出竞争假设 + 可操作的判断依据。
 * 这是"读心"请求的正确实现方式——不是宣称知道对方在想什么，而是给出可检验的推断。
 */
export interface ReadIntentResult {
  observedCues: string[];
  hypotheses: Hypothesis[];
  mostLikely: string;
  whatWouldTell: string;
  doNext: { action: string; why: string }[];
  avoid: { action: string; why: string }[];
  emotionalNote: string;
}

export async function readIntent(
  profile: AnalysisProfile,
  situation: string
): Promise<ReadIntentResult | null> {
  const profileBrief = JSON.stringify({
    traits: profile.traits,
    formulation: profile.formulation,
    relational: profile.relational,
    motivation: profile.motivation,
    guidance: profile.guidance,
  });

  const raw = await callAI(
    [
      {
        role: "system",
        content: `你是临床心理学取向的解读顾问。用户想知道某个人在某个情境下到底在想什么。你必须：
1. 绝不宣称能读心。给出 2-4 个竞争假设，标注各自概率。
2. 明确区分"情境中可观察的线索"与"你的推断"。
3. 每个假设附带证伪条件。
4. 给出用户接下来可以做什么、以及最容易踩的雷，并解释原因。
5. 如果现有信息根本不足以判断，就直说，并告诉用户需要观察什么。
只输出 JSON。`,
      },
      {
        role: "user",
        content: `【已知人格档案】${profileBrief}

【用户的困惑】${situation}

请输出 JSON：
{
  "observedCues": ["情境中可观察的线索"],
  "hypotheses": [{"statement":"解释","probability":0-100,"supporting":["支持"],"against":["反对"],"falsifier":"证伪条件"}],
  "mostLikely": "综合来看最可能的解释，以及这解释了什么的概率",
  "whatWouldTell": "还需要观察什么才能进一步确认",
  "doNext": [{"action":"","why":""}],
  "avoid": [{"action":"","why":""}],
  "emotionalNote": "给用户的一句现实提醒——基于已有个格档案，这件事对用户意味着什么"
}`,
      },
    ],
    { temperature: 0.5 }
  );

  const parsed = extractJson(raw);
  if (!parsed) return null;

  return {
    observedCues: toStringArray(parsed.observedCues),
    hypotheses: Array.isArray(parsed.hypotheses)
      ? parsed.hypotheses.map((h: any) => ({
          statement: String(h?.statement || ""),
          probability: typeof h?.probability === "number" ? clamp(h.probability, 0, 100) : 0,
          supporting: toStringArray(h?.supporting),
          against: toStringArray(h?.against),
          falsifier: String(h?.falsifier || ""),
        }))
      : [],
    mostLikely: parsed.mostLikely || "",
    whatWouldTell: parsed.whatWouldTell || "",
    doNext: Array.isArray(parsed.doNext)
      ? parsed.doNext.map((d: any) => ({ action: String(d?.action || ""), why: String(d?.why || "") }))
      : [],
    avoid: Array.isArray(parsed.avoid)
      ? parsed.avoid.map((d: any) => ({ action: String(d?.action || ""), why: String(d?.why || "") }))
      : [],
    emotionalNote: parsed.emotionalNote || "",
  };
}

/** 对话模拟：以该人物的思维方式回应，同时给出旁观层分析 */
export interface DialogueResult {
  response: string;
  reactions: { probability: number; description: string }[];
  mechanism: string;
  intention: string;
  advice: string[];
  /** 这句话触发了对方的什么 */
  trigger: string;
}

export async function simulateDialogue(
  profile: AnalysisProfile,
  userName: string,
  history: { role: "user" | "assistant"; content: string }[],
  mode: "dialogue" | "analysis" = "dialogue"
): Promise<DialogueResult | null> {
  const brief = JSON.stringify({
    coreThesis: profile.formulation?.coreThesis,
    coreConflict: profile.formulation?.coreConflict,
    triggers: profile.formulation?.triggers,
    relational: profile.relational,
    regulation: profile.regulation,
    guidance: profile.guidance,
    traits: profile.traits.map((t) => ({
      name: t.name,
      score: t.score,
      anchor: t.anchor,
    })),
  });

  const historyText = history
    .slice(-8)
    .map((m) => `${m.role === "user" ? "对方" : "我"}：${m.content}`)
    .join("\n");

  const raw = await callAI(
    [
      {
        role: "system",
        content: `你在扮演一个具体的人，同时是一个冷静的人格分析师。要求：
1. "response" 必须是这个人会说的话——用 TA 的句式、用词习惯、防御方式。不要写成心理咨询师的口吻，不要过度礼貌，不要解释自己的心理。
2. 如果这个人会回避、敷衍、反击、沉默，就如实演出来，不要为了讨好用户而写温柔回复。
3. "mechanism" 用心理机制解释 TA 为什么这样说，而非复述说了什么。
4. "intention" 是 TA 这句话背后可能想要的东西，标明这是推断。
5. 不要宣称能读心。只输出 JSON。`,
      },
      {
        role: "user",
        content: `【人物档案】${brief}

【对话历史】
${historyText}

【对方刚说】${userName}

请输出 JSON：
{
  "response": "TA会说出口的话",
  "reactions": [{"probability":0-100,"description":"在这个情境下TA可能有的反应"}],
  "mechanism": "心理机制分析",
  "intention": "真实意图推断（标明不确定性）",
  "advice": ["给用户的下一步建议"],
  "trigger": "对方这句话触发了TA的什么"
}`,
      },
    ],
    { temperature: mode === "dialogue" ? 0.8 : 0.4, maxTokens: 2500 }
  );

  const parsed = extractJson(raw);
  if (!parsed) return null;

  return {
    response: parsed.response || parsed.simulatedResponse || "",
    reactions: Array.isArray(parsed.reactions)
      ? parsed.reactions.map((r: any) => ({
          probability:
            typeof r?.probability === "number" ? clamp(r.probability, 0, 100) : 0,
          description: String(r?.description || ""),
        }))
      : [],
    mechanism: parsed.mechanism || parsed.psychologicalAnalysis || "",
    intention: parsed.intention || parsed.intentionInference || "",
    advice: toStringArray(parsed.advice || parsed.adviceGiven),
    trigger: parsed.trigger || "",
  };
}

/** 反事实推演：如果换一种做法，结果会怎样 */
export interface CounterfactualResult {
  analysis: string;
  mechanism: string;
  probability: number;
  whatActuallyMatters: string;
}

export async function runCounterfactual(
  profile: AnalysisProfile,
  originalAction: string,
  alternativeAction: string
): Promise<CounterfactualResult | null> {
  const brief = JSON.stringify({
    formulation: profile.formulation,
    relational: profile.relational,
    regulation: profile.regulation,
    motivation: profile.motivation,
  });

  const raw = await callAI(
    [
      {
        role: "system",
        content: `你做反事实推演。基于对方的人格机制推断"如果换个做法会怎样"。要具体到机制层面，不要给鸡汤式结论。承认不确定性：概率是你基于有限信息的估计，不是精确数字。只输出 JSON。`,
      },
      {
        role: "user",
        content: `【人格档案】${brief}

【实际发生】${originalAction}
【替代做法】${alternativeAction}

输出 JSON：
{
  "analysis": "对比：两种做法分别触碰了对方的什么机制，结果会怎样不同",
  "mechanism": "关键机制——为什么这个差异会起作用",
  "probability": 0-100,
  "whatActuallyMatters": "与其纠结做哪个动作，真正决定结果的是什么"
}`,
      },
    ],
    { temperature: 0.6, maxTokens: 2000 }
  );

  const parsed = extractJson(raw);
  if (!parsed) return null;

  return {
    analysis: parsed.analysis || "",
    mechanism: parsed.mechanism || "",
    probability: typeof parsed.probability === "number" ? clamp(parsed.probability, 0, 100) : 0,
    whatActuallyMatters: parsed.whatActuallyMatters || "",
  };
}
