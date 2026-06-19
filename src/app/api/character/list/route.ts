import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api";

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);

    const characters = await prisma.character.findMany({
      where: { userId: user.userId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        source: true,
        traits: true,
        personalitySummary: true,
        portraitUrl: true,
        basicInfo: true,
        createdAt: true,
        updatedAt: true,
        viewCount: true,
      },
    });

    return NextResponse.json({ characters });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    console.error("List characters error:", error);
    return NextResponse.json({ error: "获取人物列表失败" }, { status: 500 });
  }
}
