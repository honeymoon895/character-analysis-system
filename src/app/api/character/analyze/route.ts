import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api";
import { analyzePublicFigure, isAIConfigured } from "@/lib/analysis/engine";
import {
  toLegacyTraits,
  toSummary,
  toLegacyValues,
  toLegacyBehaviorPatterns,
} from "@/lib/analysis/legacy";

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const { name } = await request.json();

    if (!name?.trim()) {
      return json({ error: "请输入人物姓名" }, 400);
    }

    const characterName = String(name).trim();

    // 先落库，这样即使分析失败用户也能在人物库里看到记录并重试
    const character = await prisma.character.create({
      data: {
        userId: user.userId,
        name: characterName,
        source: "WEB",
        basicInfo: JSON.stringify({ name: characterName }),
      },
    });

    await prisma.crawlRecord.create({
      data: { characterId: character.id, sourceSite: "web", status: "processing" },
    });

    const profile = await analyzePublicFigure(characterName);

    // 新旧字段同时写：新字段承载完整研判，旧字段供既有组件读取
    await prisma.character.update({
      where: { id: character.id },
      data: {
        analysisProfile: JSON.stringify(profile),
        traits: JSON.stringify(toLegacyTraits(profile)),
        personalitySummary: toSummary(profile),
        behaviorPatterns: JSON.stringify(toLegacyBehaviorPatterns(profile)),
        values: JSON.stringify(toLegacyValues(profile)),
        keyEvents: JSON.stringify(profile.keyEvents || []),
        achievements: JSON.stringify(profile.achievements || []),
      },
    });

    await prisma.crawlRecord.updateMany({
      where: { characterId: character.id },
      data: { status: profile.meta.isAnalyzed ? "completed" : "failed" },
    });

    const payload = {
      characterId: character.id,
      isAnalyzed: profile.meta.isAnalyzed,
      aiConfigured: isAIConfigured(),
      sufficiency: profile.meta.sufficiency,
      unknowns: profile.meta.unknowns,
    };

    return sse(payload);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return json({ error: "请先登录" }, 401);
    }
    console.error("Analyze error:", error);
    return json({ error: "分析失败" }, 500);
  }
}

function json(data: any, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sse(data: any) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
