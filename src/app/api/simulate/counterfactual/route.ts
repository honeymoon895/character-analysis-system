import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api";
import { runCounterfactual } from "@/lib/analysis/engine";
import { emptyAnalysis, type AnalysisProfile } from "@/lib/analysis/types";

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const { characterId, originalAction, alternativeAction } = await request.json();

    if (!characterId || !originalAction || !alternativeAction) {
      return NextResponse.json({ error: "参数不完整" }, { status: 400 });
    }

    const character = await prisma.character.findUnique({
      where: { id: parseInt(characterId) },
    });

    if (!character || character.userId !== user.userId) {
      return NextResponse.json({ error: "人物不存在" }, { status: 404 });
    }

    const profile: AnalysisProfile =
      safeJson(character.analysisProfile) || emptyAnalysis("该人物尚未完成人格研判");

    const result = await runCounterfactual(
      profile,
      String(originalAction),
      String(alternativeAction)
    );

    if (!result) {
      return NextResponse.json(
        { error: "推演失败，可能是 AI 服务未配置或响应异常" },
        { status: 503 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    console.error("Counterfactual error:", error);
    return NextResponse.json({ error: "反事实推演失败" }, { status: 500 });
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
