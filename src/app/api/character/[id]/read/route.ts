import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api";
import { readIntent } from "@/lib/analysis/engine";
import { emptyAnalysis, type AnalysisProfile } from "@/lib/analysis/types";

/**
 * 读意图：针对具体情境给出竞争解释。
 * 与"猜 TA 在想什么"的区别在于：输出必须包含线索、反证与证伪条件。
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireAuth(request);
    const { id } = await params;
    const { situation } = await request.json();

    if (!situation?.trim()) {
      return NextResponse.json({ error: "请描述具体情境" }, { status: 400 });
    }

    const character = await prisma.character.findUnique({
      where: { id: parseInt(id) },
    });

    if (!character || character.userId !== user.userId) {
      return NextResponse.json({ error: "人物不存在" }, { status: 404 });
    }

    const profile: AnalysisProfile =
      safeJson(character.analysisProfile) ||
      emptyAnalysis("该人物尚未完成人格研判");

    const result = await readIntent(profile, String(situation));

    if (!result) {
      return NextResponse.json(
        { error: "分析失败，可能是 AI 服务未配置或响应异常" },
        { status: 503 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    console.error("Read intent error:", error);
    return NextResponse.json({ error: "分析失败" }, { status: 500 });
  }
}

function safeJson(str: string | null | undefined): any {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}
