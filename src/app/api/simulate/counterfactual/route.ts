import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api";
import { counterfactualSimulation } from "@/lib/ai";

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

    const traits = safeJson(character.traits);
    const aiResult = await counterfactualSimulation(traits, originalAction, alternativeAction);

    let parsed;
    try {
      parsed = JSON.parse(aiResult);
    } catch {
      parsed = {
        analysis: "基于人物性格特征分析，不同选择可能导致不同的结果。",
        probability: 50,
      };
    }

    return NextResponse.json({
      analysis: parsed.analysis || "",
      probability: parsed.probability || 50,
    });
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
    return str;
  }
}
