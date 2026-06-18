import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api";
import { analyzeCharacter } from "@/lib/ai";

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const { characterId, name, relationship, scene, description } = await request.json();

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

      // Store build record
      if (character.buildSession) {
        await prisma.buildRecord.create({
          data: {
            buildSessionId: character.buildSession.id,
            characterId: character.id,
            roundNumber: character.buildSession.currentRound,
            userInput: description || "",
          },
        });

        await prisma.buildSession.update({
          where: { id: character.buildSession.id },
          data: { currentRound: { increment: 1 } },
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

      return NextResponse.json({
        characterId: character.id,
        roundNumber: character.buildSession?.currentRound || 1,
        traits: parsed.dimensions || [],
        summary: parsed.summary || "",
        behaviorPatterns: parsed.behaviorPatterns || [],
        values: parsed.values || [],
        isComplete,
        sufficientDimensions: sufficientDims,
        totalDimensions: 9,
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

      // Store first build record
      await prisma.buildRecord.create({
        data: {
          buildSessionId: session.id,
          characterId: character.id,
          roundNumber: 1,
          userInput: description || "",
        },
      });

      // Analyze
      const aiResult = await analyzeCharacter(name || "未命名", "user", [description || ""]);
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
