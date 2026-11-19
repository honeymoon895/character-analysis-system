import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api";
import { analyzePerson } from "@/lib/analysis/engine";
import { loadUserAIConfig } from "@/lib/ai/config-server";
import {
  toLegacyTraits,
  toSummary,
  toLegacyValues,
  toLegacyBehaviorPatterns,
} from "@/lib/analysis/legacy";
import type { AnalysisProfile } from "@/lib/analysis/types";

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const { characterId, name, relationship, scene, description, importedData } =
      await request.json();

    if (characterId) {
      return await appendRound({
        userId: user.userId,
        characterId: parseInt(characterId),
        name,
        description,
      });
    }

    return await createCharacter({
      userId: user.userId,
      name,
      relationship,
      scene,
      description,
      importedData,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    console.error("Build character error:", error);
    return NextResponse.json({ error: "构建人物失败" }, { status: 500 });
  }
}

/** 已有档案：追加一轮观察并重新研判 */
async function appendRound(params: {
  userId: number;
  characterId: number;
  name?: string;
  description?: string;
}) {
  const { userId, characterId, name, description } = params;

  const character = await prisma.character.findUnique({
    where: { id: characterId },
    include: { buildSession: { include: { records: true } } },
  });

  if (!character || character.userId !== userId) {
    return NextResponse.json({ error: "人物不存在" }, { status: 404 });
  }

  let sessionId = character.buildSession?.id;
  if (!sessionId) {
    const session = await prisma.buildSession.create({
      data: { characterId: character.id },
    });
    sessionId = session.id;
  }

  const existingCount = await prisma.buildRecord.count({
    where: { buildSessionId: sessionId },
  });

  await prisma.buildRecord.create({
    data: {
      buildSessionId: sessionId,
      characterId: character.id,
      roundNumber: existingCount + 1,
      userInput: description || "",
    },
  });

  const allRecords = await prisma.buildRecord.findMany({
    where: { buildSessionId: sessionId },
    orderBy: { roundNumber: "asc" },
  });

  const basicInfo = safeJson(character.basicInfo) || {};
  const aiConfig = await loadUserAIConfig(userId);
  const profile = await analyzePerson(
    name || character.name,
    allRecords.map((r) => r.userInput),
    basicInfo.relationship,
    basicInfo.scene,
    aiConfig
  );

  return await persistAndRespond(
    character.id,
    sessionId,
    profile,
    allRecords.length,
    Boolean(aiConfig)
  );
}

/** 新档案：创建人物并完成首轮研判 */
async function createCharacter(params: {
  userId: number;
  name?: string;
  relationship?: string;
  scene?: string;
  description?: string;
  importedData?: any;
}) {
  const { userId, name, relationship, scene, description, importedData } = params;
  const characterName = (name || "未命名人物").trim();

  const character = await prisma.character.create({
    data: {
      userId,
      name: characterName,
      source: "USER_BUILT",
      basicInfo: JSON.stringify({ name: characterName, relationship, scene }),
    },
  });

  const session = await prisma.buildSession.create({
    data: { characterId: character.id },
  });

  // 导入的自我认知数据作为额外证据来源并入材料
  let material = description || "";
  if (importedData) {
    material = buildImportContext(importedData) + "\n\n" + material;
  }

  await prisma.buildRecord.create({
    data: {
      buildSessionId: session.id,
      characterId: character.id,
      roundNumber: 1,
      userInput: material,
    },
  });

  const aiConfig = await loadUserAIConfig(userId);
  const profile = await analyzePerson(
    characterName,
    [material],
    relationship,
    scene,
    aiConfig
  );

  return await persistAndRespond(
    character.id,
    session.id,
    profile,
    1,
    Boolean(aiConfig)
  );
}

/** 写入新档案并返回前端需要的全部字段 */
async function persistAndRespond(
  characterId: number,
  sessionId: number,
  profile: AnalysisProfile,
  roundCount: number,
  aiConfigured: boolean
) {
  const measured = profile.traits.filter(
    (t) => t.score !== null && t.confidence >= 50
  ).length;

  // 判定"档案是否已足够可靠"：依据测出的维度数与整体充分度，而非旧版的固定阈值
  const isComplete = measured >= 5 && profile.meta.sufficiency >= 55;

  await prisma.character.update({
    where: { id: characterId },
    data: {
      analysisProfile: JSON.stringify(profile),
      traits: JSON.stringify(toLegacyTraits(profile)),
      personalitySummary: toSummary(profile),
      behaviorPatterns: JSON.stringify(toLegacyBehaviorPatterns(profile)),
      values: JSON.stringify(toLegacyValues(profile)),
    },
  });

  await prisma.buildSession.update({
    where: { id: sessionId },
    data: isComplete
      ? { isCompleted: true, completedAt: new Date(), currentRound: roundCount }
      : { currentRound: roundCount },
  });

  const updatedSession = await prisma.buildSession.findUnique({
    where: { id: sessionId },
    include: { records: { orderBy: { roundNumber: "asc" } } },
  });

  return NextResponse.json({
    characterId,
    roundNumber: roundCount,
    isComplete,
    aiConfigured,
    // 档案质量指标——前端据此提示"还需要补充哪些信息"
    sufficiency: profile.meta.sufficiency,
    measuredDimensions: measured,
    totalDimensions: 9,
    unknowns: profile.meta.unknowns,
    // 兼容旧字段
    traits: toLegacyTraits(profile),
    summary: toSummary(profile),
    behaviorPatterns: toLegacyBehaviorPatterns(profile),
    values: toLegacyValues(profile),
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
}

function safeJson(str: string | null | undefined): any {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

/**
 * 把导入的自我认知数据转换成分析材料。
 * 注意：这是"本人自述"证据，可信度应低于他人长期观察，提示词里已做区分。
 */
function buildImportContext(data: any): string {
  const parts: string[] = ["【材料来源：对方本人填写的自我认知档案（属于自陈证据，可能存在自我美化或盲区）】"];

  if (data.selfPersonalitySummary) {
    parts.push(`自我性格总结：${data.selfPersonalitySummary}`);
  }
  if (Array.isArray(data.selfTraits) && data.selfTraits.length > 0) {
    parts.push(
      "九维自评：" +
        data.selfTraits
          .map((t: any) => `${t.name}(${t.score}分，置信${t.confidence ?? 50}%)`)
          .join("，")
    );
  }
  if (Array.isArray(data.selfBehaviorPatterns) && data.selfBehaviorPatterns.length > 0) {
    parts.push(
      "行为模式自述：" +
        data.selfBehaviorPatterns
          .map((p: any) => `${p.scenario}场景下${p.description}`)
          .join("；")
    );
  }
  if (Array.isArray(data.selfValues) && data.selfValues.length > 0) {
    parts.push(`价值观自述：${data.selfValues.join("、")}`);
  }

  return parts.join("\n");
}
