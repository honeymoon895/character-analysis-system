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

    const sessions = await prisma.simulationSession.findMany({
      where: {
        characterId: parseInt(characterId),
        userId: user.userId,
      },
      include: {
        feedbacks: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // 解析 messages JSON 字段
    const parsed = sessions.map((s) => {
      let messages: any[] = [];
      try {
        messages = JSON.parse(s.messages || "[]");
      } catch {
        messages = [];
      }
      return { ...s, messages };
    });

    return NextResponse.json({ sessions: parsed });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    console.error("Get history error:", error);
    return NextResponse.json({ error: "获取历史记录失败" }, { status: 500 });
  }
}
