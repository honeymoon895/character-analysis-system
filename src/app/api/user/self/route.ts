import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api";
import { analyzeSelf } from "@/lib/analysis/engine";
import { loadUserAIConfig } from "@/lib/ai/config-server";
import type { AnalysisProfile } from "@/lib/analysis/types";
import {
  toLegacyTraits,
  toSummary,
  toLegacyValues,
  toLegacyBehaviorPatterns,
} from "@/lib/analysis/legacy";
import { buildEntry, normalizeEntries } from "@/lib/knowledge/store";

// GET — 获取自己的性格档案
export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);

    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        selfAvatarUrl: true,
        selfDiary: true,
        selfTraits: true,
        selfPersonalitySummary: true,
        selfBehaviorPatterns: true,
        selfValues: true,
        selfAnalysisProfile: true,
        selfAnalysisComplete: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    return NextResponse.json({
      profile: {
        ...dbUser,
        selfDiary: safeJson(dbUser.selfDiary),
        selfTraits: safeJson(dbUser.selfTraits),
        selfBehaviorPatterns: safeJson(dbUser.selfBehaviorPatterns),
        selfValues: safeJson(dbUser.selfValues),
        selfAnalysisProfile: safeJson(dbUser.selfAnalysisProfile),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    console.error("Get self profile error:", error);
    return NextResponse.json({ error: "获取失败" }, { status: 500 });
  }
}

// POST — 提交日记 / 自我描述，重新研判
export async function POST(request: NextRequest) {
  try {
    const authUser = requireAuth(request);
    const body = await request.json().catch(() => ({}));
    const { content, action } = body;

    const dbUser = await prisma.user.findUnique({ where: { id: authUser.userId } });
    if (!dbUser) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    if (action === "reset") {
      await prisma.user.update({
        where: { id: authUser.userId },
        data: {
          selfDiary: JSON.stringify([]),
          selfTraits: null,
          selfPersonalitySummary: null,
          selfBehaviorPatterns: null,
          selfValues: null,
          selfAnalysisProfile: null,
          selfAnalysisComplete: false,
        },
      });
      return NextResponse.json({ success: true, message: "已重置" });
    }

    const existingProfile: AnalysisProfile | null = safeJson(dbUser.selfAnalysisProfile);

    // 原料统一走知识库结构：旧的 {content, timestamp} 会被自动升级，
    // 不再另存一套平行数据，避免"日记"和"知识库"两边各写一份。
    const entries = normalizeEntries(safeJson(dbUser.selfDiary));

    let updatedEntries = entries;
    let newEntry = null;
    if (action !== "reanalyze") {
      const text = typeof content === "string" ? content.trim() : "";
      if (!text) {
        return NextResponse.json({ error: "请输入内容" }, { status: 400 });
      }
      newEntry = buildEntry({
        kind: body.kind,
        title: body.title,
        content: text,
        tags: body.tags,
      });
      updatedEntries = [...entries, newEntry];
    }

    if (updatedEntries.length === 0) {
      return NextResponse.json(
        { error: "知识库还是空的，先记几条再研判" },
        { status: 400 }
      );
    }

    const analysisInput = updatedEntries.map((e) => ({
      content: e.title ? `【${e.title}】${e.content}` : e.content,
      timestamp: e.createdAt,
    }));

    // 用全部材料重新研判，而不是在旧分数上做加权平均——
    // 旧做法会把早期样本的偏差永久固化进档案，且掩盖材料之间的冲突。
    const aiConfig = await loadUserAIConfig(authUser.userId);
    const profile = await analyzeSelf(analysisInput, existingProfile, aiConfig);

    const measured = profile.traits.filter(
      (t) => t.score !== null && t.confidence >= 50
    ).length;
    const analysisComplete = profile.meta.isAnalyzed && measured >= 4;

    const legacyTraits = toLegacyTraits(profile);

    await prisma.user.update({
      where: { id: authUser.userId },
      data: {
        selfDiary: JSON.stringify(updatedEntries),
        selfAnalysisProfile: JSON.stringify(profile),
        selfTraits: JSON.stringify(legacyTraits),
        selfPersonalitySummary: toSummary(profile) || dbUser.selfPersonalitySummary,
        selfBehaviorPatterns: JSON.stringify(toLegacyBehaviorPatterns(profile)),
        selfValues: JSON.stringify(toLegacyValues(profile)),
        selfAnalysisComplete: analysisComplete,
      },
    });

    return NextResponse.json({
      success: true,
      entry: newEntry,
      diaryCount: updatedEntries.length,
      analysisComplete,
      aiConfigured: Boolean(aiConfig),
      isAnalyzed: profile.meta.isAnalyzed,
      sufficiency: profile.meta.sufficiency,
      unknowns: profile.meta.unknowns,
      // 兼容旧字段
      traits: legacyTraits,
      summary: toSummary(profile),
      behaviorPatterns: toLegacyBehaviorPatterns(profile),
      values: toLegacyValues(profile),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    console.error("Self analyze error:", error);
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
