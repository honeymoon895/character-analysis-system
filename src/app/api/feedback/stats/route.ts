import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api";

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const { searchParams } = new URL(request.url);
    const characterId = searchParams.get("character_id");

    if (!characterId) {
      return NextResponse.json({ error: "缺少人物ID" }, { status: 400 });
    }

    const feedbacks = await prisma.userFeedback.findMany({
      where: {
        characterId: parseInt(characterId),
        userId: user.userId,
      },
    });

    const total = feedbacks.length;
    const avgAccuracy = total > 0
      ? Math.round(feedbacks.reduce((s, f) => s + (f.accuracyRating || 0), 0) / total)
      : 0;
    const avgHelpfulness = total > 0
      ? Math.round(feedbacks.reduce((s, f) => s + (f.helpfulnessRating || 0), 0) / total)
      : 0;
    const avgSatisfaction = total > 0
      ? Math.round(feedbacks.reduce((s, f) => s + (f.satisfactionRating || 0), 0) / total)
      : 0;

    return NextResponse.json({
      total,
      avgAccuracy,
      avgHelpfulness,
      avgSatisfaction,
      recentComments: feedbacks.filter((f) => f.comment).slice(-5),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    console.error("Get feedback stats error:", error);
    return NextResponse.json({ error: "获取反馈统计失败" }, { status: 500 });
  }
}
