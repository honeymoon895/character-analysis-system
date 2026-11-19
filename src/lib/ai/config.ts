/**
 * AI 服务配置
 *
 * 设计要点：
 * 1. 每个用户可以使用自己的 API Key（存在数据库里），未配置时回落到环境变量。
 * 2. 配置在每次请求时解析并显式传入引擎，不使用模块级变量——
 *    否则并发请求会互相串用不同用户的密钥。
 * 3. 密钥永不下发到前端，只返回"是否已配置"和掩码。
 */

export interface AIConfig {
  apiKey: string;
  /** 对话补全端点 */
  baseUrl: string;
  /** 对话模型 */
  model: string;
  /** 该配置来自哪里：用户自己的设置，还是服务端环境变量 */
  source: "user" | "env";
  /** 供应商 id（deepseek / openai / agnes …），用于判断是否支持图像、视频 */
  provider?: string;

  /* ── 图像与视频：通常与对话模型不同，允许单独指定 ── */
  /** 图像模型；未配置时用供应商默认值 */
  imageModel?: string;
  /** 视频模型；未配置时用供应商默认值 */
  videoModel?: string;
  /** 图像接口端点；未配置时由对话端点推导 */
  imageUrl?: string;
  /** 视频接口端点；未配置时由对话端点推导 */
  videoUrl?: string;
}

export interface AIProvider {
  id: string;
  name: string;
  /** 对话补全端点 */
  endpoint: string;
  /** 常用模型，第一个为默认 */
  models: string[];
  /** 申请地址，帮助用户找到 key */
  consoleUrl: string;
  note?: string;
}

/**
 * 内置服务商。全部走 OpenAI 兼容协议，因此可以自由切换。
 * 用户也可以选「自定义」，直接填任意 OpenAI 兼容端点。
 */
export const AI_PROVIDERS: AIProvider[] = [
  {
    id: "deepseek",
    name: "DeepSeek",
    endpoint: "https://api.deepseek.com/v1/chat/completions",
    models: ["deepseek-chat", "deepseek-reasoner"],
    consoleUrl: "https://platform.deepseek.com/api_keys",
    note: "国内访问稳定，价格低",
  },
  {
    id: "openai",
    name: "OpenAI",
    endpoint: "https://api.openai.com/v1/chat/completions",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
    consoleUrl: "https://platform.openai.com/api-keys",
    note: "需要海外网络环境",
  },
  {
    id: "moonshot",
    name: "Moonshot 月之暗面",
    endpoint: "https://api.moonshot.cn/v1/chat/completions",
    models: ["moonshot-v1-8k", "moonshot-v1-32k", "kimi-k2-0905-preview"],
    consoleUrl: "https://platform.moonshot.cn/console/api-keys",
    note: "中文长文本表现好",
  },
  {
    id: "zhipu",
    name: "智谱 GLM",
    endpoint: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    models: ["glm-4-plus", "glm-4-flash"],
    consoleUrl: "https://open.bigmodel.cn/usercenter/apikeys",
    note: "glm-4-flash 有免费额度",
  },
  {
    id: "qwen",
    name: "通义千问",
    endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    models: ["qwen-plus", "qwen-max", "qwen-turbo"],
    consoleUrl: "https://bailian.console.aliyun.com/",
  },
  {
    id: "custom",
    name: "自定义",
    endpoint: "",
    models: [],
    consoleUrl: "",
    note: "任意兼容 OpenAI 格式的接口",
  },
];

export function findProvider(id: string | null | undefined): AIProvider | null {
  if (!id) return null;
  return AI_PROVIDERS.find((p) => p.id === id) || null;
}

/** 服务端环境变量提供的配置（部署者统一提供，作为兜底） */
export function envAIConfig(): AIConfig | null {
  const apiKey =
    process.env.AI_API_KEY ||
    process.env.AGNES_API_KEY ||
    process.env.DEEPSEEK_API_KEY ||
    "";
  if (!apiKey) return null;

  return {
    apiKey,
    baseUrl:
      process.env.AI_API_URL ||
      "https://apihub.agnes-ai.com/v1/chat/completions",
    model: process.env.AI_MODEL || "agnes-2.0-flash",
    source: "env",
    imageModel: process.env.AI_IMAGE_MODEL || undefined,
    videoModel: process.env.AI_VIDEO_MODEL || undefined,
    imageUrl: process.env.AI_IMAGE_URL || undefined,
    videoUrl: process.env.AI_VIDEO_URL || undefined,
  };
}

/** 把用户填的 base 地址规整成完整的 chat/completions 端点 */
export function normalizeEndpoint(raw: string): string {
  const url = raw.trim();
  if (!url) return "";
  if (url.includes("/chat/completions")) return url;
  // 允许只填 https://api.xxx.com/v1
  return url.replace(/\/+$/, "") + "/chat/completions";
}

/** 用存储的字段解析出一个可用配置；用户没配就回落到环境变量 */
export function resolveAIConfig(stored: {
  aiApiKey?: string | null;
  aiBaseUrl?: string | null;
  aiModel?: string | null;
  aiProvider?: string | null;
  aiImageModel?: string | null;
  aiVideoModel?: string | null;
  aiImageUrl?: string | null;
  aiVideoUrl?: string | null;
} | null | undefined): AIConfig | null {
  if (stored?.aiApiKey?.trim()) {
    return {
      apiKey: stored.aiApiKey.trim(),
      baseUrl: normalizeEndpoint(stored.aiBaseUrl || ""),
      model: stored.aiModel?.trim() || "gpt-4o-mini",
      source: "user",
      provider: stored.aiProvider || undefined,
      imageModel: stored.aiImageModel?.trim() || undefined,
      videoModel: stored.aiVideoModel?.trim() || undefined,
      imageUrl: stored.aiImageUrl?.trim() || undefined,
      videoUrl: stored.aiVideoUrl?.trim() || undefined,
    };
  }
  return envAIConfig();
}

/**
 * 解析图像生成端点。
 * 优先用用户显式填的地址；否则由对话端点推导（同一供应商下通常是 /images/generations）。
 */
export function imageEndpointFor(cfg: AIConfig | null): string {
  if (!cfg) return "";
  if (cfg.imageUrl) return cfg.imageUrl;
  return cfg.baseUrl.replace(/\/chat\/completions$/, "/images/generations");
}

/** 解析视频生成端点；未显式配置时回落到 Agnes 的固定路径 */
export function videoEndpointFor(cfg: AIConfig | null): string {
  if (!cfg) return "";
  if (cfg.videoUrl) return cfg.videoUrl;
  const base = cfg.baseUrl.toLowerCase();
  if (base.includes("agnes-ai.com")) return "https://apihub.agnes-ai.com/v1";
  // 其它供应商：从 base 里剥掉 /chat/completions
  return cfg.baseUrl.replace(/\/chat\/completions$/, "");
}

/** 兼容旧调用：图像模型名 */
export function imageModelFor(cfg: AIConfig | null): string {
  return cfg?.imageModel || process.env.AI_IMAGE_MODEL || "agnes-image-2.1-flash";
}

/** 兼容旧调用：视频模型名 */
export function videoModelFor(cfg: AIConfig | null): string {
  return cfg?.videoModel || process.env.AI_VIDEO_MODEL || "agnes-video-v2.0";
}

/**
 * 供应商是否支持图像 / 视频生成。
 *
 * 这是用户最容易被误导的地方：chat 模型（如 agnes-2.5-flash、deepseek-chat）
 * 只负责文本，不能直接出图出视频。必须显式告知用户，而不是让接口报错后悄悄降级。
 */
export interface MediaSupport {
  image: boolean;
  video: boolean;
  /** 给用户看的说明 */
  note: string;
}

export function mediaSupport(cfg: AIConfig | null): MediaSupport {
  if (!cfg) {
    return { image: false, video: false, note: "未配置 AI 服务" };
  }

  const base = cfg.baseUrl.toLowerCase();
  const isAgnes = base.includes("agnes-ai.com");
  const isOpenAI = base.includes("api.openai.com");

  if (isAgnes) {
    return {
      image: true,
      video: true,
      note: "Agnes 支持图像与视频，但需使用对应模型而非对话模型",
    };
  }
  if (isOpenAI) {
    return {
      image: true,
      video: false,
      note: "OpenAI 支持图像生成（需 dall-e / gpt-image 模型），不支持视频",
    };
  }
  return {
    image: false,
    video: false,
    note: "当前服务商未提供图像 / 视频生成接口，仅支持文本分析",
  };
}
