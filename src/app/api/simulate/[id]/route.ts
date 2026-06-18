import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api";

// GET — 获取单个会话的完整消息记录
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireAuth(request);
    const { id } = await params;
    const sessionId = parseInt(id);

    const session = await prisma.simulationSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json({ error: "会话不存在" }, { status: 404 });
    }
    if (session.userId !== user.userId) {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    // 解析 messages 字段（JSON 字符串 → 数组）
    let messages: any[] = [];
    try {
      messages = JSON.parse(session.messages || "[]");
    } catch {
      messages = [];
    }

    return NextResponse.json({
      session: {
        id: session.id,
        characterId: session.characterId,
        sessionTitle: session.sessionTitle,
        sessionType: session.sessionType,
        messages,
        isArchived: session.isArchived,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    console.error("Get session error:", error);
    return NextResponse.json({ error: "获取失败" }, { status: 500 });
  }
}

// PATCH — 归档会话（用于「新对话」）
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireAuth(request);
    const { id } = await params;
    const sessionId = parseInt(id);

    const session = await prisma.simulationSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== user.userId) {
      return NextResponse.json({ error: "无权操作" }, { status: 403 });
    }

    await prisma.simulationSession.update({
      where: { id: sessionId },
      data: { isArchived: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    console.error("Archive session error:", error);
    return NextResponse.json({ error: "归档失败" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireAuth(request);
    const { id } = await params;
    const sessionId = parseInt(id);

    const session = await prisma.simulationSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== user.userId) {
      return NextResponse.json({ error: "无权删除" }, { status: 403 });
    }

    await prisma.simulationSession.delete({ where: { id: sessionId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    console.error("Delete session error:", error);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
