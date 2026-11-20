import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api";
import { computeCoverage, normalizeEntries } from "@/lib/knowledge/store";

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

// PATCH — 修改单条记录
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireAuth(request);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const entries = await readEntries(user.userId);
    const idx = entries.findIndex((e) => e.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: "记录不存在" }, { status: 404 });
    }

    const target = entries[idx];
    const updated = [...entries];
    updated[idx] = {
      ...target,
      kind: typeof body.kind === "string" && body.kind ? body.kind : target.kind,
      title:
        typeof body.title === "string" ? body.title.trim() || undefined : target.title,
      content:
        typeof body.content === "string" && body.content.trim()
          ? body.content.trim()
          : target.content,
      tags: Array.isArray(body.tags)
        ? body.tags.map((t: unknown) => String(t).trim()).filter(Boolean).slice(0, 8)
        : typeof body.tags === "string"
        ? body.tags.split(/[\s,，]+/).filter(Boolean).slice(0, 8)
        : target.tags,
      importance:
        typeof body.importance === "number"
          ? Math.max(0, Math.min(100, Math.round(body.importance)))
          : target.importance,
      occurredAt:
        typeof body.occurredAt === "string" ? body.occurredAt || undefined : target.occurredAt,
      updatedAt: new Date().toISOString(),
    };

    await prisma.user.update({
      where: { id: user.userId },
      data: { selfDiary: JSON.stringify(updated) },
    });

    return NextResponse.json({
      success: true,
      entry: updated[idx],
      entries: updated,
      coverage: computeCoverage(updated),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    console.error("Update memory error:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

// DELETE — 删除单条记录
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireAuth(request);
    const { id } = await params;

    const entries = await readEntries(user.userId);
    const remaining = entries.filter((e) => e.id !== id);
    if (remaining.length === entries.length) {
      return NextResponse.json({ error: "记录不存在" }, { status: 404 });
    }

    await prisma.user.update({
      where: { id: user.userId },
      data: { selfDiary: JSON.stringify(remaining) },
    });

    return NextResponse.json({
      success: true,
      entries: remaining,
      coverage: computeCoverage(remaining),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    console.error("Delete memory error:", error);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
