import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api";

// GET — 导出自我认知数据为 JSON
export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);

    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        username: true,
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

    const exportData = {
      version: 1,
      exportType: "self-cognition",
      exportedAt: new Date().toISOString(),
      username: dbUser.username,
      data: {
        selfAvatarUrl: dbUser.selfAvatarUrl,
        selfDiary: safeJson(dbUser.selfDiary),
        selfTraits: safeJson(dbUser.selfTraits),
        selfPersonalitySummary: dbUser.selfPersonalitySummary,
        selfBehaviorPatterns: safeJson(dbUser.selfBehaviorPatterns),
        selfValues: safeJson(dbUser.selfValues),
        selfAnalysisComplete: dbUser.selfAnalysisComplete,
      },
    };

    // 返回 JSON 文件下载（filename 只支持 ASCII，中文字符需用 filename*）
    const jsonStr = JSON.stringify(exportData, null, 2);
    const asciiName = `self-cognition-export-${new Date().toISOString().slice(0, 10)}.json`;
    const rawName = `self-cognition-${dbUser.username}-${new Date().toISOString().slice(0, 10)}.json`;
    return new NextResponse(jsonStr, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(rawName)}`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    console.error("Export self cognition error:", error);
    return NextResponse.json({ error: "导出失败" }, { status: 500 });
  }
}
