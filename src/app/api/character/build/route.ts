import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api";
import { analyzeCharacter } from "@/lib/ai";

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const { characterId, name, relationship, scene, description, importedData } = await request.json();

    let character;

    if (characterId) {
      // Existing character - add another round
      character = await prisma.character.findUnique({
        where: { id: parseInt(characterId) },
        include: { buildSession: { include: { records: true } } },
      });

      if (!character || character.userId !== user.userId) {
        return NextResponse.json({ error: "人物不存在" }, { status: 404 });
      }

      // Store build record（基于已有记录数+1 计算轮次，避免 currentRound 起始值偏差）
      if (character.buildSession) {
        const existingCount = await prisma.buildRecord.count({
          where: { buildSessionId: character.buildSession.id },
        });
        await prisma.buildRecord.create({
          data: {
            buildSessionId: character.buildSession.id,
            characterId: character.id,
            roundNumber: existingCount + 1,
            userInput: description || "",
          },
        });
      }

      // Re-analyze with all descriptions
      const allRecords = await prisma.buildRecord.findMany({
        where: { buildSessionId: character.buildSession!.id },
        orderBy: { roundNumber: "asc" },
      });
      const descriptions = allRecords.map((r) => r.userInput);

      const aiResult = await analyzeCharacter(name || character.name, "user", descriptions);
      let parsed;
      try {
        parsed = JSON.parse(aiResult);
      } catch {
        parsed = { dimensions: [], summary: "", behaviorPatterns: [], values: [] };
      }

      await prisma.character.update({
        where: { id: character.id },
        data: {
          traits: JSON.stringify(parsed.dimensions || []),
          personalitySummary: parsed.summary || character.personalitySummary,
          behaviorPatterns: JSON.stringify(parsed.behaviorPatterns || []),
          values: JSON.stringify(parsed.values || []),
        },
      });

      // Check if info is sufficient
      const dimensions = parsed.dimensions || [];
      const sufficientDims = dimensions.filter((d: any) => d.confidence >= 70).length;
      const isComplete = sufficientDims >= 5;

      if (isComplete) {
        await prisma.buildSession.update({
          where: { id: character.buildSession!.id },
          data: { isCompleted: true, completedAt: new Date() },
        });
      }

      // 返回更新后的 records 供前端刷新
      const updatedSession = await prisma.buildSession.findUnique({
        where: { id: character.buildSession!.id },
        include: { records: { orderBy: { roundNumber: "asc" } } },
      });

      return NextResponse.json({
        characterId: character.id,
        roundNumber: allRecords.length + 1,
        traits: parsed.dimensions || [],
        summary: parsed.summary || "",
        behaviorPatterns: parsed.behaviorPatterns || [],
        values: parsed.values || [],
        isComplete,
        sufficientDimensions: sufficientDims,
        totalDimensions: 9,
        buildSession: updatedSession
          ? {
              ...updatedSession,
              records: updatedSession.records.map((r) => ({
                ...r,
                extractedTraits: safeJson(r.extractedTraits),
                aiAnalysis: safeJson(r.aiAnalysis),
              })),
            }
          : null,
      });
    } else {
      // Create new character
      character = await prisma.character.create({
        data: {
          userId: user.userId,
          name: name || "未命名人物",
          source: "USER_BUILT",
          basicInfo: JSON.stringify({ name, relationship, scene }),
        },
      });

      // Create build session
      const session = await prisma.buildSession.create({
        data: { characterId: character.id },
      });

      // Build the description with optional imported data
      let enhancedDescription = description || "";
      if (importedData) {
        const importContext = buildImportContext(importedData);
        enhancedDescription = importContext + "\n\n" + enhancedDescription;
      }

      // Store first build record
      await prisma.buildRecord.create({
        data: {
          buildSessionId: session.id,
          characterId: character.id,
          roundNumber: 1,
          userInput: enhancedDescription,
        },
      });

      // Analyze with enhanced description
      const aiResult = await analyzeCharacter(name || "未命名", "user", [enhancedDescription]);
      let parsed;
      try {
        parsed = JSON.parse(aiResult);
      } catch {
        parsed = { dimensions: [], summary: "", behaviorPatterns: [], values: [] };
      }

      await prisma.character.update({
        where: { id: character.id },
        data: {
          traits: JSON.stringify(parsed.dimensions || []),
          personalitySummary: parsed.summary || "",
          behaviorPatterns: JSON.stringify(parsed.behaviorPatterns || []),
          values: JSON.stringify(parsed.values || []),
        },
      });

      const dimensions = parsed.dimensions || [];
      const sufficientDims = dimensions.filter((d: any) => d.confidence >= 70).length;
      const isComplete = sufficientDims >= 5;

      if (isComplete) {
        await prisma.buildSession.update({
          where: { id: session.id },
          data: { isCompleted: true, completedAt: new Date() },
        });
      }

      return NextResponse.json({
        characterId: character.id,
        roundNumber: 1,
        traits: parsed.dimensions || [],
        summary: parsed.summary || "",
        behaviorPatterns: parsed.behaviorPatterns || [],
        values: parsed.values || [],
        isComplete,
        sufficientDimensions: sufficientDims,
        totalDimensions: 9,
      });
    }
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    console.error("Build character error:", error);
    return NextResponse.json({ error: "构建人物失败" }, { status: 500 });
  }
}

function safeJson(str: string | null | undefined): any {
  if (!str) return null;
  try { return JSON.parse(str); } catch { return str; }
}

/**
 * 将导入的自我认知数据转换为 AI 分析的上下文信息
 */
function buildImportContext(data: any): string {
  const parts: string[] = [];

  parts.push("【参考信息：该人物的自我认知数据】");

  if (data.selfPersonalitySummary) {
    parts.push(`自我性格总结：${data.selfPersonalitySummary}`);
  }

  if (data.selfTraits && Array.isArray(data.selfTraits) && data.selfTraits.length > 0) {
    const traitDesc = data.selfTraits
      .map((t: any) => `${t.name}(${t.code}): ${t.score}分，置信度${t.confidence || 50}%`)
      .join("，");
    parts.push(`九维心理特征自评：${traitDesc}`);
  }

  if (data.selfBehaviorPatterns && Array.isArray(data.selfBehaviorPatterns) && data.selfBehaviorPatterns.length > 0) {
    const patternDesc = data.selfBehaviorPatterns
      .map((p: any) => `在${p.scenario}场景下：${p.description}`)
      .join("；");
    parts.push(`行为模式自述：${patternDesc}`);
  }

  if (data.selfValues && Array.isArray(data.selfValues) && data.selfValues.length > 0) {
    parts.push(`核心价值观自述：${data.selfValues.join("、")}`);
  }

  parts.push("（以上信息由该人物本人或他人通过自我认知工具记录，请作为参考信息用于综合分析，结合用户描述做出更全面、立体的性格判断）");

  return parts.join("\n");
}
