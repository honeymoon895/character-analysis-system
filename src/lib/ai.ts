// AI 服务 - 支持多种 OpenAI 兼容 API（可切换）
// 默认使用模拟数据，设置以下环境变量后启用真实 API：
//   - AI_API_KEY       (必填，API 密钥)
//   - AI_API_URL       (可选，默认 https://apihub.agnes-ai.com/v1/chat/completions)
//   - AI_MODEL         (可选，默认 agnes-2.0-flash)

// 兼容示例：
//   Agnes:     AI_API_URL=https://apihub.agnes-ai.com/v1/chat/completions  AI_MODEL=agnes-2.0-flash
//   DeepSeek:  AI_API_URL=https://api.deepseek.com/v1/chat/completions     AI_MODEL=deepseek-chat
//   OpenAI:    AI_API_URL=https://api.openai.com/v1/chat/completions       AI_MODEL=gpt-4o-mini

import {
  imageEndpointFor,
  imageModelFor,
  videoEndpointFor,
  videoModelFor,
  type AIConfig,
} from "@/lib/ai/config";

const AI_API_KEY = process.env.AI_API_KEY || process.env.AGNES_API_KEY || process.env.DEEPSEEK_API_KEY || "";
const API_URL = process.env.AI_API_URL || "https://apihub.agnes-ai.com/v1/chat/completions";
const AI_MODEL = process.env.AI_MODEL || "agnes-2.0-flash";

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

async function callAI(
  messages: Message[],
  stream = false,
  config?: AIConfig | null
): Promise<string> {
  // 用户配置优先；都没有才回落到服务端环境变量
  const apiKey = config?.apiKey || AI_API_KEY;
  const url = config?.baseUrl || API_URL;
  const model = config?.model || AI_MODEL;

  if (!apiKey) {
    return getMockResponse(messages);
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 4096,
        stream,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    if (stream) {
      // 流式响应处理
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");
      let result = "";
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));
        for (const line of lines) {
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            result += parsed.choices?.[0]?.delta?.content || "";
          } catch {}
        }
      }
      return result;
    } else {
      const data = await response.json();
      return data.choices?.[0]?.message?.content || "";
    }
  } catch (error) {
    console.error("AI call failed:", error);
    return getMockResponse(messages);
  }
}

// ==================== 已废弃 ====================
// 人格分析逻辑已迁移到 src/lib/analysis/engine.ts，那里不再伪造分数：
// 未配置 AI 时如实返回"无法分析"，而不是用姓名哈希编出看似真实的评分。
// 这里保留空实现，仅为兼容尚未迁移的旧调用，不返回任何伪造内容。
function getMockResponse(_messages: Message[]): string {
  return "";
}

// ==================== 人物画像生成 ====================

export async function generatePortrait(
  characterName: string,
  personalitySummary: string,
  traits: Array<{ code: string; name: string; score: number }>,
  behaviorPatterns?: Array<{ scenario: string; description: string }>,
  values?: string[],
  config?: AIConfig | null,
  styleOptions?: {
    domain?: string | null;
    source?: string | null;
    hint?: string | null;
  }
): Promise<{ url: string; error?: string }> {
  // 构建 prompt —— 用中英文混合提示以获得最佳效果
  const topTraits = [...(traits || [])]
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((t) => `${t.name}(${t.score}分)`)
    .join("、");

  const styleDesc = buildStyleDescription(traits || []);

  // 画风由人物性质决定：动漫角色画成二次元，历史人物用古典绘画，
  // 否则会出现"曹操像现代人""动漫角色是真人照片"这种明显错位。
  const styleKind = resolvePortraitStyle(styleOptions || {});
  const style = STYLE_PROMPTS[styleKind];

  const subject =
    styleKind === "anime"
      ? `character design of "${characterName}"`
      : `portrait of "${characterName}"`;

  /**
   * 拼接最终 prompt。
   *
   * Agnes 的 text2image 队列**不支持 negative_prompt 字段**（直接返回 400），
   * 因此画风纠偏只能靠正向描述：在句尾追加 "avoid ..." 的形式，
   * 多数模型仍会据此避开对应视觉元素。
   */
  const avoidParts = style.negative
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  const prompt = [
    style.positive,
    subject,
    personalitySummary,
    topTraits ? `Personality cues: ${topTraits}.` : "",
    styleDesc,
    avoidParts.length
      ? `Avoid these visual elements: ${avoidParts.join(", ")}.`
      : "",
  ]
    .filter(Boolean)
    .join(". ")
    .replace(/\.\./g, ".");

  const fallback = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(characterName)}&backgroundColor=6c63ff&textColor=ffffff`;

  // 使用调用方传入的配置（用户自己的 key），没有才回落到环境变量
  const cfg = config ?? null;
  if (!cfg?.apiKey) {
    return {
      url: fallback,
      error: "未配置 AI 服务，无法生成画像",
    };
  }

  // 图像模型可以单独配置（与对话模型分开），没配才用默认值
  const endpoint = imageEndpointFor(cfg);
  const imageModel = imageModelFor(cfg);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: imageModel,
        // 注意：Agnes 的 text2image 队列不支持 negative_prompt 字段（会直接 400），
        // 所以负向词已并入正向 prompt，见 buildPortraitPrompt。
        prompt,
        size: "1024x1024",
        n: 1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`Image API error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const imageUrl = data.data?.[0]?.url;
    if (!imageUrl) {
      throw new Error("图像接口未返回结果");
    }
    return { url: imageUrl };
  } catch (error: any) {
    const msg = error?.message || "生成失败";
    console.error("Portrait generation failed:", msg);
    // 关键：把真实原因带回前端，而不是静默换成字母头像让用户以为成功
    return {
      url: fallback,
      error: `图像生成失败：${msg}`,
    };
  }
}

/**
 * 决定画像的视觉风格
 *
 * 旧版提示词写死了 "photorealistic style"，导致动漫、游戏角色也被画成真人。
 * 画风必须由人物性质决定：
 * - 虚构角色 / 虚构作品 → 二次元插画风
 * - 历史人物 → 写实但需符合时代（不能出现现代服装）
 * - 当代真人 → 写真风
 */
export type PortraitStyle = "anime" | "historical" | "realistic";

export function resolvePortraitStyle(opts: {
  domain?: string | null;
  source?: string | null;
  hint?: string | null;
}): PortraitStyle {
  const d = (opts.domain || "").toLowerCase();
  const hint = (opts.hint || "").toLowerCase();

  if (d === "fictional") return "anime";
  // 兜底：领域缺失时看线索里有没有虚构相关的词
  if (/动漫|漫画|游戏|小说|虚构|神话|anime|manga|game/.test(hint)) {
    return "anime";
  }
  return opts.source === "WEB" ? "historical" : "realistic";
}

const STYLE_PROMPTS: Record<PortraitStyle, { positive: string; negative: string }> = {
  anime: {
    positive:
      "2D anime illustration, cel-shaded, clean bold lineart, vivid colors, expressive large eyes, " +
      "official character key visual style, JRPG character portrait, bust shot facing camera, " +
      "detailed hair strands, soft rim lighting, clean simple background",
    negative:
      "photorealistic, photograph, real human, live action, 3d render, realistic skin texture, " +
      "blurry, low quality, extra limbs, bad anatomy, mutated hands, watermark, text",
  },
  historical: {
    positive:
      "classical oil painting portrait, museum quality, period-accurate attire and hairstyle, " +
      "historical Chinese painting aesthetics, warm muted palette, Rembrandt lighting, " +
      "bust shot, dignified expression, subtle textured canvas, dark simple background",
    negative:
      "modern clothing, modern accessories, sunglasses, contemporary haircut, photograph, " +
      "selfie, anime, cartoon, blurry, low quality, deformed face, extra limbs, watermark, text",
  },
  realistic: {
    positive:
      "professional character portrait, soft studio lighting, photorealistic, 85mm lens, " +
      "shallow depth of field, natural expression, detailed skin texture, bust shot facing camera, " +
      "clean neutral background, high resolution",
    negative:
      "cartoon, anime, illustration, painting, overexposed, blurry, low quality, " +
      "deformed face, extra limbs, bad anatomy, watermark, text",
  },
};

function buildStyleDescription(traits: Array<{ code: string; name: string; score: number }>): string {
  const map: Record<string, [number, string][]> = {
    OPENNESS: [[70, "creative, artistic style, expressive eyes"]],
    CONSCIENTIOUSNESS: [[70, "neat appearance, organized look, formal"]],
    EXTRAVERSION: [[70, "confident posture, warm smile, outgoing energy"]],
    AGREEABLENESS: [[70, "gentle expression, approachable, warm eyes"]],
    NEUROTICISM: [[60, "sensitive expression, thoughtful gaze"]],
    DECISIVENESS: [[70, "strong jaw, determined look, confident"]],
    RISK_TENDENCY: [[70, "adventurous look, daring expression"]],
    EMPATHY: [[70, "compassionate eyes, kind expression"]],
    LEADERSHIP: [[70, "commanding presence, authoritative look"]],
  };

  const descriptions: string[] = [];
  for (const t of traits || []) {
    const styleMap = map[t.code];
    if (styleMap) {
      for (const [threshold, desc] of styleMap) {
        if (t.score >= threshold) {
          descriptions.push(desc);
          break;
        }
      }
    }
  }
  return descriptions.length > 0 ? descriptions.slice(0, 3).join(". ") + "." : "Neutral expression.";
}

/**
 * 用 AI 改写视频 prompt，避免触发视频 API 的内容审核策略
 * 将"冲突""负面情绪"等可能违规描述转为中性/正面的视觉描述
 */
export async function rewriteVideoPrompt(
  originalPrompt: string,
  config?: AIConfig | null
): Promise<string> {
  const apiKey = config?.apiKey || AI_API_KEY;
  if (!apiKey) return originalPrompt;

  const messages: Message[] = [
    {
      role: "system",
      content: `你是一个视频提示词优化助手。你的任务是将用户的视频场景描述改写为"安全、可被视频生成API接受"的版本。

规则：
1. 保留场景的核心视觉元素（人物、场景、光线、色调、动作）
2. 必须将以下敏感词替换为安全的中性词（否则 API 会拒绝）：
   - "冲突" → "交流"或"对话"
   - "争吵" → "交谈"
   - "张力" → "氛围"
   - "情绪波动" → "表情变化"
   - "严肃" → "专注"
   - "负面情绪" → "内心思考"
   - "冲突升级" → "对话深入"
   - 任何与"对抗""对立""矛盾"相关的词 → 中性的"不同观点"
3. 改用正面的艺术描述替代负面的情感词汇
4. 输出简洁，只输出改写后的提示词本身，不要任何解释或前缀
5. 使用中文输出，控制在 200 字以内
6. 重点描述画面本身（人物在做什么、环境如何），而非内心感受`,
    },
    { role: "user", content: originalPrompt },
  ];

  const result = await callAI(messages, false, config);
  return result.trim() || originalPrompt;
}

// ==================== 视频生成 ====================

const VIDEO_API_BASE = "https://apihub.agnes-ai.com/v1";
const VIDEO_MODEL = "agnes-video-v2.0";

/**
 * 视频端点与模型都可由用户单独配置。
 * 不同供应商的视频 API 路径差异很大，所以允许显式指定端点。
 */
function resolveVideoEndpoint(cfg: AIConfig | null): string {
  return videoEndpointFor(cfg) || VIDEO_API_BASE;
}

/** agnes-video-2.5 及之后的新版接口：用 mode/seconds 而非 num_frames */
export function isAgnesVideo25(model: string): boolean {
  return /agnes-video-2\.[5-9]|agnes-video-[3-9]/.test(model);
}

/** 单段视频的最大秒数：新版模型上限 12 秒，旧版按帧数上限折算（约 18 秒） */
export function maxSegmentSecondsFor(cfg: AIConfig | null): number {
  return isAgnesVideo25(resolveVideoModel(cfg)) ? 12 : maxSegmentDuration();
}

function resolveVideoModel(cfg: AIConfig | null): string {
  return videoModelFor(cfg) || VIDEO_MODEL;
}

interface VideoTaskResult {
  taskId: string;
  status: "queued" | "in_progress" | "completed" | "failed";
  videoUrl?: string;
  error?: string;
}

/**
 * 最终兜底清洗：用正则替换移除可能触发审核的敏感词
 * 这是 AI 改写之外的最后一层防线
 */
function sanitizeVideoPrompt(prompt: string): string {
  // 按长度降序排列，避免部分替换
  const replacements: [RegExp, string][] = [
    // 情绪/冲突类
    [/\b冲突[升级]?\b/g, "对话"],
    [/\b争吵\b/g, "交谈"],
    [/\b张力\b/g, "氛围"],
    [/\b情绪波动\b/g, "表情变化"],
    [/\b情绪[不稳定激动]\b/g, "心情起伏"],
    [/\b严肃\b/g, "专注"],
    [/\b负面情绪\b/g, "内心活动"],
    [/\b矛盾\b/g, "不同之处"],
    [/\b对抗\b/g, "面对"],
    [/\b对立\b/g, "相对"],
    [/\b愤怒\b/g, "认真"],
    [/\b抱怨\b/g, "表达"],
    [/\b指责\b/g, "指出"],
    // 时间标记中的潜在敏感词
    [/\b高潮\b/g, "推进"],
  ];

  let result = prompt;
  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * 创建视频生成任务
 */
export async function createVideoTask(
  prompt: string,
  options: {
    imageUrl?: string;
    numFrames?: number;
    frameRate?: number;
    width?: number;
    height?: number;
    /** 目标时长（秒）。新版模型（agnes-video-2.5）用它代替 num_frames */
    seconds?: number;
    /** 参考图（公网 URL）。新版模型用 reference 模式让视频保持人物形象 */
    images?: string[];
    /** 用户的 AI 配置；不传则回落到服务端环境变量 */
    config?: AIConfig | null;
  } = {}
): Promise<VideoTaskResult> {
  const { config, ...rest } = options;
  const cfg = config ?? null;
  const apiKey = cfg?.apiKey || AI_API_KEY;

  if (!apiKey) {
    throw new Error("未配置 AI 服务，无法生成视频。请在「我的 → AI 引擎」填写密钥。");
  }

  const {
    imageUrl,
    numFrames = 121,
    frameRate = 24,
    width = 1152,
    height = 768,
    seconds,
    images = [],
  } = rest;

  // 最终 prompt 清洗（AI 改写 + 正则兜底双保险）
  const safePrompt = sanitizeVideoPrompt(prompt);
  const model = resolveVideoModel(cfg);

  let body: Record<string, any>;

  if (isAgnesVideo25(model)) {
    /*
     * agnes-video-2.5 / 2.5-flash（按官方文档）：
     *   mode 必填：text（不可带媒体）/ keyframe（first_frame、last_frame）/ reference（images ≤5）
     *   seconds "4"–"12"；Flash 的 size 只接受 "720P"；aspect_ratio 默认 16:9
     *   媒体必须是公网可访问且任务完成前不过期的 URL
     */
    const sec = Math.round(
      seconds ?? (numFrames && frameRate ? numFrames / frameRate : 5)
    );
    const refs = images
      .filter((u) => /^https?:\/\//.test(u) && !u.includes("dicebear.com"))
      .slice(0, 5);

    body = {
      model,
      prompt: safePrompt,
      mode: "text",
      seconds: String(Math.min(12, Math.max(4, sec || 5))),
      size: "720P",
      aspect_ratio: "16:9",
      n: 1,
    };

    // 有人物画像时用 reference 模式，让视频里的人物长得像档案里的形象
    if (refs.length) {
      body.mode = "reference";
      body.images = refs;
      const tags = refs.map((_, i) => `<Picture ${i + 1}>`).join("、");
      body.prompt = `以${tags}中的人物为角色形象参考。${safePrompt}`;
    }
  } else {
    // 旧版模型（agnes-video-v2.0 等）用帧数与像素尺寸
    body = {
      model,
      prompt: safePrompt,
      num_frames: numFrames,
      frame_rate: frameRate,
      width,
      height,
    };
    if (imageUrl) body.image = imageUrl;
  }

  /*
   * 不同视频模型接受的参数不一样（例如有的模型禁止 num_frames）。
   * 与其为每个模型硬编码一套参数，不如根据接口的 400 报错自适应：
   * 报哪个字段不允许，就去掉哪个字段重试。model / prompt 是必需字段，永不删除。
   */
  const PROTECTED = new Set(["model", "prompt"]);
  const removed: string[] = [];
  let response: Response | null = null;
  let errText = "";

  let busyRetries = 0;
  const BUSY_DELAYS = [4000, 8000, 15000]; // 排队满时的退避等待

  for (let attempt = 0; attempt < 10; attempt++) {
    response = await fetch(`${resolveVideoEndpoint(cfg)}/videos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // 用户配置的密钥优先（原先误用环境变量导致 401）
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (response.ok) break;
    errText = await response.text().catch(() => "");

    // 服务端排队满 / 临时不可用：等一会儿再试，而不是立刻报错
    if (isBusyError(response.status, errText) && busyRetries < BUSY_DELAYS.length) {
      const wait = BUSY_DELAYS[busyRetries++];
      console.warn(`[Video] 服务繁忙（${response.status}），${wait / 1000}s 后第 ${busyRetries} 次重试`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }

    if (response.status !== 400) break;

    // reference 模式被拒（图片不可访问、格式不符等）→ 退回纯文本模式再试一次
    if (body.mode === "reference") {
      console.warn("[Video] reference 模式被拒，改用纯文本模式：", errText.slice(0, 160));
      body.mode = "text";
      delete body.images;
      body.prompt = safePrompt;
      continue;
    }

    const bad = findRejectedField(errText);
    if (!bad || PROTECTED.has(bad) || !(bad in body)) break;

    delete body[bad];
    removed.push(bad);
    console.warn(`[Video] 模型不接受字段 ${bad}，已移除后重试`);
  }

  if (!response || !response.ok) {
    throw new Error(friendlyVideoError(response?.status, errText, busyRetries));
  }

  if (removed.length) {
    console.info(`[Video] 当前模型不支持的字段：${removed.join(", ")}`);
  }

  const data = await response.json();
  return {
    taskId: data.task_id || data.id,
    status: "queued",
  };
}

/** 服务端繁忙类错误：排队满、通道暂不可用、限流 */
function isBusyError(status: number, errText: string): boolean {
  if (status === 429 || status === 503) return true;
  return /video_queue_full|queue is full|get_channel_failed|temporarily unavailable/i.test(errText);
}

/** 把接口原始报错翻译成用户看得懂的话 */
function friendlyVideoError(status: number | undefined, errText: string, busyRetries: number): string {
  const t = errText || "";
  if (/video_queue_full|queue is full/i.test(t)) {
    return `视频生成排队已满（已自动重试 ${busyRetries} 次），请过几分钟再试。`;
  }
  if (/get_channel_failed|temporarily unavailable/i.test(t)) {
    return "视频模型暂时不可用，请稍后再试，或在「我的 → AI 引擎 → 高级设置」更换视频模型。";
  }
  if (status === 401 || /invalid token/i.test(t)) {
    return "视频接口鉴权失败：密钥无效，请检查「我的 → AI 引擎」里的 API Key。";
  }
  if (status === 429) {
    return "请求过于频繁或额度不足，请稍后再试。";
  }
  return `视频接口错误 ${status ?? "?"}：${t.slice(0, 200)}`;
}

/**
 * 从 400 报错中找出被拒绝的字段名。
 * 兼容几种常见写法：
 *   {"data":{"param":"num_frames"}}
 *   {"error":{"param":"num_frames"}}
 *   "num_frames is a forbidden field" / "num_frames is not supported"
 */
function findRejectedField(errText: string): string | null {
  try {
    const j = JSON.parse(errText);
    const p = j?.data?.param || j?.error?.param || j?.param;
    if (typeof p === "string" && p.trim()) return p.trim();
  } catch {}
  const m = errText.match(
    /([a-zA-Z_][\w]*)\s+is\s+(?:a\s+forbidden\s+field|not\s+supported|not\s+allowed|unknown)/
  );
  return m ? m[1] : null;
}

/**
 * 轮询视频生成状态
 */
export async function pollVideoTask(
  taskId: string,
  config?: AIConfig | null
): Promise<VideoTaskResult> {
  const apiKey = config?.apiKey || AI_API_KEY;
  if (!apiKey) {
    throw new Error("未配置 AI 服务");
  }

  // 官方推荐查询方式。新版模型必须带 model_name：
  // 文档说明省略 model_name 只适用于 text 模式，reference/keyframe 会查不到
  const modelName = encodeURIComponent(resolveVideoModel(config ?? null));
  const altResponse = await fetch(
    `https://apihub.agnes-ai.com/agnesapi?video_id=${encodeURIComponent(taskId)}&model_name=${modelName}`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
    }
  );

  if (altResponse.ok) {
    const altData = await altResponse.json();
    // Agnes 返回的字段：status / progress / remixed_from_video_id / error
    const status = mapVideoStatus(altData.status || altData.state);
    return {
      taskId,
      status,
      // 文档：视频地址在顶层 url。remixed_from_video_id 是"派生自哪个视频"的 id，不是地址
      videoUrl: altData.url || altData.video_url || altData.data?.url,
      error: altData.error,
    };
  }

  // 回退到旧接口
  const response = await fetch(`${VIDEO_API_BASE}/videos/${taskId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Poll video error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  return {
    taskId,
    status: mapVideoStatus(data.status),
    videoUrl: data.url || data.video_url || data.data?.url,
    error: data.error,
  };
}

/**
 * 统一视频任务状态映射
 */
function mapVideoStatus(status: string): VideoTaskResult["status"] {
  switch (status) {
    case "queued":
    case "queueing":
      return "queued";
    case "in_progress":
    case "processing":
    case "running":
      return "in_progress";
    case "completed":
    case "done":
    case "succeed":
    case "success":
      return "completed";
    case "failed":
    case "error":
    case "failure":
      return "failed";
    default:
      return "in_progress";
  }
}

/**
 * 等待视频生成完成（带轮询）
 */
export async function waitForVideo(
  taskId: string,
  maxWaitMs = 300000,
  config?: AIConfig | null
): Promise<string> {
  const start = Date.now();
  let lastStatus = "";

  while (Date.now() - start < maxWaitMs) {
    const result = await pollVideoTask(taskId, config);

    if (result.status === "completed" && result.videoUrl) {
      return result.videoUrl;
    }

    if (result.status === "failed") {
      throw new Error(`视频生成失败: ${result.error || "未知错误"}`);
    }

    if (result.status !== lastStatus) {
      console.log(`Video task ${taskId}: ${result.status}`);
      lastStatus = result.status;
    }

    // 轮询间隔：前30秒每2秒，之后每5秒
    const elapsed = Date.now() - start;
    await new Promise((r) => setTimeout(r, elapsed < 30000 ? 2000 : 5000));
  }

  throw new Error("视频生成超时");
}

/**
 * 计算视频时长对应的帧数
 */
export function durationToFrames(seconds: number, frameRate = 24): number {
  // num_frames 必须满足 8n + 1，且 ≤ 441
  const raw = Math.round(seconds * frameRate);
  // 找到最接近的 8n+1 值
  let n = Math.round((raw - 1) / 8);
  n = Math.max(1, Math.min(n, 55)); // max 441 frames = 8*55+1
  return 8 * n + 1;
}

/**
 * 计算单段最大时长
 */
export function maxSegmentDuration(frameRate = 24): number {
  return Math.floor((8 * 55 + 1) / frameRate); // ≈ 18.4s @ 24fps
}
