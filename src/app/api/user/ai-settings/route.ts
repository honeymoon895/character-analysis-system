import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api";
import {
  AI_PROVIDERS,
  findProvider,
  normalizeEndpoint,
  envAIConfig,
  resolveAIConfig,
  mediaSupport,
} from "@/lib/ai/config";

/**
 * AI 设置
 *
 * 安全约定：密钥只写不读。GET 只返回掩码与来源，避免密钥随页面源码泄露。
 */

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);

    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        aiProvider: true,
        aiApiKey: true,
        aiBaseUrl: true,
        aiModel: true,
        aiImageModel: true,
        aiVideoModel: true,
        aiImageUrl: true,
        aiVideoUrl: true,
      },
    });

    const env = envAIConfig();
    const hasUserKey = Boolean(dbUser?.aiApiKey);

    // 告诉前端：当前配置能不能出图、出视频
    const cfg = resolveAIConfig(dbUser);
    const support = mediaSupport(cfg);

    return NextResponse.json({
      providers: AI_PROVIDERS,
      mediaSupport: support,
      current: {
        provider: dbUser?.aiProvider || (env ? "env" : null),
        model: dbUser?.aiModel || env?.model || "",
        baseUrl: dbUser?.aiBaseUrl || "",
        // 图像 / 视频模型可以单独配置，未配置时为空（前端显示为"跟随默认"）
        imageModel: dbUser?.aiImageModel || env?.imageModel || "",
        videoModel: dbUser?.aiVideoModel || env?.videoModel || "",
        imageUrl: dbUser?.aiImageUrl || env?.imageUrl || "",
        videoUrl: dbUser?.aiVideoUrl || env?.videoUrl || "",
        hasKey: hasUserKey,
        // 只回传后四位，用于让用户确认填的是哪把 key
        keyHint: hasUserKey
          ? `••••${dbUser!.aiApiKey!.slice(-4)}`
          : "",
      },
      // 服务端兜底配置是否可用（部署者统一提供的 key）
      envAvailable: Boolean(env),
      usingEnv: !hasUserKey && Boolean(env),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    console.error("Get AI settings error:", error);
    return NextResponse.json({ error: "获取设置失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const body = await request.json();
    const action: string | undefined = body.action;

    // ── 清除用户自己的配置，回落到服务端 ──
    if (action === "reset") {
      await prisma.user.update({
        where: { id: user.userId },
        data: {
          aiProvider: null,
          aiApiKey: null,
          aiBaseUrl: null,
          aiModel: null,
          aiImageModel: null,
          aiVideoModel: null,
          aiImageUrl: null,
          aiVideoUrl: null,
        },
      });
      return NextResponse.json({ success: true });
    }

    const providerId = String(body.provider || "");
    const provider = findProvider(providerId);
    if (!provider) {
      return NextResponse.json({ error: "未知的服务商" }, { status: 400 });
    }

    const apiKey = String(body.apiKey || "").trim();
    const model = String(body.model || "").trim();

    if (!apiKey) {
      return NextResponse.json({ error: "请填写 API Key" }, { status: 400 });
    }
    if (!model) {
      return NextResponse.json({ error: "请填写模型名称" }, { status: 400 });
    }

    const baseUrl =
      providerId === "custom"
        ? normalizeEndpoint(String(body.baseUrl || ""))
        : provider.endpoint;

    // 图像 / 视频模型：留空则回落到服务商默认值
    const imageModel = String(body.imageModel || "").trim();
    const videoModel = String(body.videoModel || "").trim();
    const imageUrlRaw = String(body.imageUrl || "").trim();
    const videoUrlRaw = String(body.videoUrl || "").trim();

    // 独立端点若填写，必须是合法 URL
    if (imageUrlRaw && !/^https?:\/\//.test(imageUrlRaw)) {
      return NextResponse.json(
        { error: "图像接口地址无效，需以 http:// 或 https:// 开头" },
        { status: 400 }
      );
    }
    if (videoUrlRaw && !/^https?:\/\//.test(videoUrlRaw)) {
      return NextResponse.json(
        { error: "视频接口地址无效，需以 http:// 或 https:// 开头" },
        { status: 400 }
      );
    }

    if (!baseUrl || !/^https?:\/\//.test(baseUrl)) {
      return NextResponse.json(
        { error: "接口地址无效，需以 http:// 或 https:// 开头" },
        { status: 400 }
      );
    }

    // ── 测试连通性：只有真的能用才保存 ──
    if (body.test !== false) {
      const check = await testConnection({ apiKey, baseUrl, model });
      if (!check.ok) {
        return NextResponse.json(
          { error: `连接失败：${check.message}` },
          { status: 400 }
        );
      }
    }

    await prisma.user.update({
      where: { id: user.userId },
      data: {
        aiProvider: providerId,
        aiApiKey: apiKey,
        aiBaseUrl: baseUrl,
        aiModel: model,
        aiImageModel: imageModel || null,
        aiVideoModel: videoModel || null,
        aiImageUrl: imageUrlRaw || null,
        aiVideoUrl: videoUrlRaw || null,
      },
    });

    return NextResponse.json({
      success: true,
      current: {
        provider: providerId,
        model,
        baseUrl,
        imageModel,
        videoModel,
        imageUrl: imageUrlRaw,
        videoUrl: videoUrlRaw,
        hasKey: true,
        keyHint: `••••${apiKey.slice(-4)}`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    console.error("Save AI settings error:", error);
    return NextResponse.json({ error: "保存失败" }, { status: 500 });
  }
}

/** 用一次最小请求验证密钥与模型是否可用 */
async function testConnection(cfg: {
  apiKey: string;
  baseUrl: string;
  model: string;
}): Promise<{ ok: boolean; message: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);

    const res = await fetch(cfg.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: "user", content: "回复「ok」两个字" }],
        max_tokens: 8,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (res.ok) return { ok: true, message: "ok" };

    const text = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: "密钥无效或无权限（401/403）" };
    }
    if (res.status === 404) {
      return { ok: false, message: "模型不存在或接口地址错误（404）" };
    }
    if (res.status === 429) {
      return { ok: false, message: "请求频率或额度超限（429）" };
    }
    return {
      ok: false,
      message: `HTTP ${res.status} ${text.slice(0, 120)}`,
    };
  } catch (e: any) {
    if (e?.name === "AbortError") {
      return { ok: false, message: "连接超时" };
    }
    return { ok: false, message: e?.message || "网络错误" };
  }
}
