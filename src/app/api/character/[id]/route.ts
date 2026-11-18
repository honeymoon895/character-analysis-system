import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const characterId = parseInt(id);
    const authUser = getAuthUser(request);

    const character = await prisma.character.findUnique({
      where: { id: characterId },
      include: {
        buildSession: {
          include: { records: { orderBy: { roundNumber: "asc" } } },
        },
        crawlRecords: true,
      },
    });

    if (!character) {
      return NextResponse.json({ error: "人物不存在" }, { status: 404 });
    }

    // 如果不是公开且不是自己的，拒绝访问
    if (!character.isPublic && (!authUser || character.userId !== authUser.userId)) {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    // 增加浏览量
    if (!authUser || character.userId !== authUser.userId) {
      await prisma.character.update({
        where: { id: characterId },
        data: { viewCount: { increment: 1 } },
      });
    }

    return NextResponse.json({
      character: {
        ...character,
        basicInfo: safeJson(character.basicInfo),
        traits: safeJson(character.traits),
        behaviorPatterns: safeJson(character.behaviorPatterns),
        values: safeJson(character.values),
        keyEvents: safeJson(character.keyEvents),
        achievements: safeJson(character.achievements),
        confidenceScores: safeJson(character.confidenceScores),
        analysisProfile: safeJson(character.analysisProfile),
        buildSession: character.buildSession
          ? {
              ...character.buildSession,
              records: character.buildSession.records.map((r) => ({
                ...r,
                extractedTraits: safeJson(r.extractedTraits),
                aiAnalysis: safeJson(r.aiAnalysis),
              })),
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Get character error:", error);
    return NextResponse.json({ error: "获取人物详情失败" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const characterId = parseInt(id);
    const authUser = getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const character = await prisma.character.findUnique({
      where: { id: characterId },
    });

    if (!character || character.userId !== authUser.userId) {
      return NextResponse.json({ error: "无权删除" }, { status: 403 });
    }

    await prisma.character.delete({ where: { id: characterId } });

    return NextResponse.json({ success: true, message: "删除成功" });
  } catch (error) {
    console.error("Delete character error:", error);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}

function safeJson(str: string | null | undefined): any {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}
