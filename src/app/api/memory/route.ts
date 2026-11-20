import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api";
import {
  buildEntry,
  computeCoverage,
  normalizeEntries,
} from "@/lib/knowledge/store";

/**
 * 个人知识库
 *
 * 数据仍存在 User.selfDiary（JSON 数组）里：
 * 旧版日记 {content, timestamp} 会被 normalizeEntries 自动升级为带 id / kind / tags 的结构，
 * 因此不需要迁移，老用户的历史记录也不会丢。
 */

function safeParse(str: string | null | undefined): unknown {
  if (!str) return [];
  try {
    return JSON.parse(str);
  } catch {
    return [];
  }
}

async function readEntries(userId: number) {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { selfDiary: true },
  });
  return normalizeEntries(safeParse(dbUser?.selfDiary));
}

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const entries = await readEntries(user.userId);
    return NextResponse.json({
      entries,
      coverage: computeCoverage(entries),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    console.error("List memory error:", error);
    return NextResponse.json({ error: "获取失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const body = await request.json().catch(() => ({}));

    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!content) {
      return NextResponse.json({ error: "内容不能为空" }, { status: 400 });
    }
    if (content.length > 4000) {
      return NextResponse.json({ error: "单条最多 4000 字" }, { status: 400 });
    }

    const entries = await readEntries(user.userId);
    const entry = buildEntry({
      kind: body.kind,
      title: body.title,
      content,
      tags: Array.isArray(body.tags)
        ? body.tags.filter((t: unknown) => typeof t === "string")
        : typeof body.tags === "string"
        ? body.tags.split(/[\s,，]+/)
        : [],
      importance: body.importance,
      occurredAt: body.occurredAt,
    });

    const updated = [...entries, entry];

    await prisma.user.update({
      where: { id: user.userId },
      data: { selfDiary: JSON.stringify(updated) },
    });

    return NextResponse.json({
      success: true,
      entry,
      entries: updated,
      coverage: computeCoverage(updated),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    console.error("Create memory error:", error);
    return NextResponse.json({ error: "保存失败" }, { status: 500 });
  }
}
