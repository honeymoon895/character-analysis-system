import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api";

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const { characterId, accuracy, helpfulness, satisfaction, comment } = await request.json();

    if (!characterId) {
      return NextResponse.json({ error: "人物ID不能为空" }, { status: 400 });
    }

    const character = await prisma.character.findUnique({
      where: { id: parseInt(characterId) },
    });

    if (!character || character.userId !== user.userId) {
      return NextResponse.json({ error: "人物不存在" }, { status: 404 });
    }

    const feedback = await prisma.userFeedback.create({
      data: {
        characterId: character.id,
        userId: user.userId,
        accuracyRating: accuracy ?? null,
        helpfulnessRating: helpfulness ?? null,
        satisfactionRating: satisfaction ?? null,
        comment: comment || null,
      },
    });

    return NextResponse.json({ success: true, feedback });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    console.error("Feedback error:", error);
    return NextResponse.json({ error: "提交反馈失败" }, { status: 500 });
  }
}
