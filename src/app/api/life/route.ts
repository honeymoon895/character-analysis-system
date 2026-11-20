import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api";
import { loadUserAIConfig } from "@/lib/ai/config-server";
import { computeCoverage, normalizeEntries } from "@/lib/knowledge/store";
import { startLifeSim } from "@/lib/life/engine";
import { computeCalibration, type LifeNode, type LifeSim } from "@/lib/life/types";

function safeParse<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

function toSim(row: any): LifeSim {
  return {
    id: row.id,
    title: row.title,
    premise: row.premise,
    focus: row.focus,
    horizon: row.horizon,
    status: row.status === "done" ? "done" : "active",
    nodes: safeParse<LifeNode[]>(row.nodes, []),
    coverage: row.coverage,
    createdAt: row.createdAt?.toISOString?.() || String(row.createdAt),
    updatedAt: row.updatedAt?.toISOString?.() || String(row.updatedAt),
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);

    const [rows, dbUser] = await Promise.all([
      prisma.lifeSim.findMany({
        where: { userId: user.userId },
        orderBy: { updatedAt: "desc" },
        take: 50,
      }),
      prisma.user.findUnique({
        where: { id: user.userId },
        select: { selfDiary: true },
      }),
    ]);

    const sims = rows.map(toSim);
    const entries = normalizeEntries(safeParse(dbUser?.selfDiary, [] as unknown[]));

    return NextResponse.json({
      sims,
      coverage: computeCoverage(entries),
      calibration: computeCalibration(sims),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    console.error("List life sims error:", error);
    return NextResponse.json({ error: "获取失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const body = await request.json().catch(() => ({}));

    const premise = typeof body.premise === "string" ? body.premise.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";

    if (premise.length < 8) {
      return NextResponse.json(
        { error: "再多写一点处境：现在在哪、正在纠结什么" },
        { status: 400 }
      );
    }
    if (premise.length > 2000) {
      return NextResponse.json({ error: "处境描述最多 2000 字" }, { status: 400 });
    }

    const aiConfig = await loadUserAIConfig(user.userId);
    if (!aiConfig) {
      return NextResponse.json(
        { error: "未配置 AI 服务，请先到「我的 → AI 引擎」填写密钥" },
        { status: 503 }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { selfDiary: true },
    });
    const entries = normalizeEntries(safeParse(dbUser?.selfDiary, [] as unknown[]));
    const coverage = computeCoverage(entries);

    const focus = typeof body.focus === "string" && body.focus ? body.focus : "综合";
    const horizon = typeof body.horizon === "string" && body.horizon ? body.horizon : "1年";
    const finalTitle = title || `${focus}：${premise.slice(0, 18)}…`;

    const node = await startLifeSim(
      { title: finalTitle, premise, focus, horizon },
      { entries, coverage },
      aiConfig
    );

    if (!node) {
      return NextResponse.json(
        { error: "推演没有成功返回结果，请稍后重试或换一个模型" },
        { status: 502 }
      );
    }

    const created = await prisma.lifeSim.create({
      data: {
        userId: user.userId,
        title: finalTitle,
        premise,
        focus,
        horizon,
        status: "active",
        nodes: JSON.stringify([node]),
        coverage: coverage.score,
      },
    });

    return NextResponse.json({
      success: true,
      sim: toSim(created),
      coverage,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    console.error("Create life sim error:", error);
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}
