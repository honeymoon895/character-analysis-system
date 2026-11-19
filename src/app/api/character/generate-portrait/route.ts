import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api";
import { generatePortrait } from "@/lib/ai";
import { loadUserAIConfig } from "@/lib/ai/config-server";

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);

    const { characterId, force } = await request.json();

    if (!characterId) {
      return NextResponse.json({ error: "缺少 characterId" }, { status: 400 });
    }

    // 查找角色并验证所有权
    const character = await prisma.character.findUnique({
      where: { id: characterId },
    });

    if (!character) {
      return NextResponse.json({ error: "人物不存在" }, { status: 404 });
    }

    if (character.userId !== user.userId) {
      return NextResponse.json({ error: "无权操作" }, { status: 403 });
    }

    // 如果已生成过 AI 头像（非上传）且不是 DiceBear 兜底，直接返回避免重复调用。
    // force=true 时跳过缓存——否则用户永远无法重新生成（例如改了画风之后）。
    if (
      !force &&
      character.portraitUrl &&
      !character.portraitUrl.includes("dicebear.com") &&
      !character.portraitUrl.startsWith("/uploads/")
    ) {
      return NextResponse.json({
        portraitUrl: character.portraitUrl,
        cached: true,
      });
    }

    // 解析 traits
    const traits = safeJsonArray(character.traits);
    const behaviorPatterns = safeJsonArray(character.behaviorPatterns);
    const values = safeJsonArray(character.values);

    // 读取研判档案里的领域，用于决定画风
    // （动漫角色要画成二次元，不能按真人处理）
    const profile = safeJsonObject(character.analysisProfile);
    const basicInfo = safeJsonObject(character.basicInfo);
    const domain: string | null = profile?.meta?.domain || null;
    const hint: string | null =
      typeof basicInfo?.hint === "string" ? basicInfo.hint : null;

    // 关键修复：用**当前用户**的配置（之前这里读的是服务端环境变量，
    // 用户在设置里填的 key 根本没传进来，所以配置了也报错）
    const aiConfig = await loadUserAIConfig(user.userId);

    const result = await generatePortrait(
      character.name,
      character.personalitySummary || "",
      traits,
      behaviorPatterns,
      values,
      aiConfig,
      { domain, source: character.source, hint }
    );

    // 失败时不要把兜底头像当成成功结果写进库，否则用户会以为生成好了
    if (result.error) {
      return NextResponse.json(
        { error: result.error, portraitUrl: null },
        { status: 502 }
      );
    }

    await prisma.character.update({
      where: { id: characterId },
      data: { portraitUrl: result.url },
    });

    return NextResponse.json({ portraitUrl: result.url, cached: false });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    console.error("Generate portrait error:", error);
    return NextResponse.json({ error: "生成画像失败" }, { status: 500 });
  }
}

function safeJsonObject(str: string | null | undefined): any | null {
  if (!str) return null;
  try {
    const parsed = JSON.parse(str);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function safeJsonArray(str: string | null | undefined): any[] {
  if (!str) return [];
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
