import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api";
import { analyzeSelfDiary } from "@/lib/ai";

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
        selfAnalysisComplete: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    // 解析 JSON 字段
    const safeJson = (str: string | null | undefined) => {
      if (!str) return null;
      try { return JSON.parse(str); } catch { return str; }
    };

    return NextResponse.json({
      profile: {
        ...dbUser,
        selfDiary: safeJson(dbUser.selfDiary),
        selfTraits: safeJson(dbUser.selfTraits),
        selfBehaviorPatterns: safeJson(dbUser.selfBehaviorPatterns),
        selfValues: safeJson(dbUser.selfValues),
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

// POST — 提交日记 / 自我描述，AI 分析并更新档案
export async function POST(request: NextRequest) {
  try {
    const authUser = requireAuth(request);
    const { content, action } = await request.json();

    if (!content?.trim()) {
      return NextResponse.json({ error: "请输入内容" }, { status: 400 });
    }

    const dbUser = await prisma.user.findUnique({ where: { id: authUser.userId } });
    if (!dbUser) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    // 如果是重置操作
    if (action === "reset") {
      await prisma.user.update({
        where: { id: authUser.userId },
        data: {
          selfDiary: JSON.stringify([]),
          selfTraits: null,
          selfPersonalitySummary: null,
          selfBehaviorPatterns: null,
          selfValues: null,
          selfAnalysisComplete: false,
        },
      });
      return NextResponse.json({ success: true, message: "已重置" });
    }

    // 解析已有数据
    const existingDiary: Array<{ content: string; timestamp: string }> = (() => {
      try { return JSON.parse(dbUser.selfDiary || "[]"); } catch { return []; }
    })();

    const existingTraits = (() => {
      try { return JSON.parse(dbUser.selfTraits || "null"); } catch { return null; }
    })();

    // 调用 AI 分析
    const aiResult = await analyzeSelfDiary(content, existingDiary, existingTraits);

    let parsed: any;
    try {
      parsed = JSON.parse(aiResult);
    } catch {
      parsed = {
        dimensions: existingTraits || [],
        summary: "分析中...",
        behaviorPatterns: [],
        values: [],
      };
    }

    // 合并日记
    const newEntry = { content, timestamp: new Date().toISOString() };
    const updatedDiary = [...existingDiary, newEntry];

    // 合并/更新特征
    let mergedTraits = parsed.dimensions || existingTraits || [];
    if (existingTraits && parsed.dimensions) {
      // 加权平均：旧数据权重 0.6，新数据权重 0.4
      mergedTraits = parsed.dimensions.map((newT: any) => {
        const oldT = existingTraits.find((t: any) => t.code === newT.code);
        if (oldT) {
          return {
            ...newT,
            score: Math.round(oldT.score * 0.6 + newT.score * 0.4),
            confidence: Math.min(100, Math.round((oldT.confidence || 50) * 0.5 + (newT.confidence || 50) * 0.5 + 5)),
          };
        }
        return newT;
      });
      // 补充旧数据中有但新数据没有的维度
      for (const oldT of existingTraits) {
        if (!mergedTraits.find((t: any) => t.code === oldT.code)) {
          mergedTraits.push(oldT);
        }
      }
    }

    // 保存到数据库
    await prisma.user.update({
      where: { id: authUser.userId },
      data: {
        selfDiary: JSON.stringify(updatedDiary),
        selfTraits: JSON.stringify(mergedTraits),
        selfPersonalitySummary: parsed.summary || dbUser.selfPersonalitySummary,
        selfBehaviorPatterns: JSON.stringify(parsed.behaviorPatterns || []),
        selfValues: JSON.stringify(parsed.values || []),
        selfAnalysisComplete: updatedDiary.length >= 3, // 写满 3 条标记为完成
      },
    });

    return NextResponse.json({
      success: true,
      entry: newEntry,
      traits: mergedTraits,
      summary: parsed.summary || dbUser.selfPersonalitySummary,
      behaviorPatterns: parsed.behaviorPatterns || [],
      values: parsed.values || [],
      diaryCount: updatedDiary.length,
      analysisComplete: updatedDiary.length >= 3,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    console.error("Self analyze error:", error);
    return NextResponse.json({ error: "分析失败" }, { status: 500 });
  }
}
