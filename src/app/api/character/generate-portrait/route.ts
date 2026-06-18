import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api";
import { generatePortrait } from "@/lib/ai";

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);

    const { characterId } = await request.json();

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

    // 如果已生成过且 portraitUrl 不为 DiceBear 兜底，直接返回
    if (character.portraitUrl && !character.portraitUrl.includes("dicebear.com")) {
      return NextResponse.json({
        portraitUrl: character.portraitUrl,
        cached: true,
      });
    }

    // 解析 traits
    const traits = safeJsonArray(character.traits);
    const behaviorPatterns = safeJsonArray(character.behaviorPatterns);
    const values = safeJsonArray(character.values);

    // 调用 Agnes 生成画像
    const portraitUrl = await generatePortrait(
      character.name,
      character.personalitySummary || "",
      traits,
      behaviorPatterns,
      values
    );

    // 存入数据库
    await prisma.character.update({
      where: { id: characterId },
      data: { portraitUrl },
    });

    return NextResponse.json({ portraitUrl, cached: false });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    console.error("Generate portrait error:", error);
    return NextResponse.json({ error: "生成画像失败" }, { status: 500 });
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
