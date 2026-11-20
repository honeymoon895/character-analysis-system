import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api";
import { loadUserAIConfig } from "@/lib/ai/config-server";
import { computeCoverage, normalizeEntries } from "@/lib/knowledge/store";
import { advanceLifeSim } from "@/lib/life/engine";
import {
  computeCalibration,
  type LifeNode,
  type LifeSim,
} from "@/lib/life/types";

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

async function loadSim(userId: number, id: string) {
  const simId = Number(id);
  if (!Number.isFinite(simId)) return null;
  const row = await prisma.lifeSim.findUnique({ where: { id: simId } });
  if (!row || row.userId !== userId) return null;
  return row;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireAuth(request);
    const { id } = await params;
    const row = await loadSim(user.userId, id);
    if (!row) return NextResponse.json({ error: "推演不存在" }, { status: 404 });

    const sim = toSim(row);
    return NextResponse.json({
      sim,
      calibration: computeCalibration([sim]),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    console.error("Get life sim error:", error);
    return NextResponse.json({ error: "获取失败" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireAuth(request);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const action = body.action || "choose";

    const row = await loadSim(user.userId, id);
    if (!row) return NextResponse.json({ error: "推演不存在" }, { status: 404 });

    const sim = toSim(row);
    const nodes = [...sim.nodes];

    /* ── 选择一条路，推演下一步 ── */
    if (action === "choose") {
      const last = nodes[nodes.length - 1];
      if (!last) {
        return NextResponse.json({ error: "这个推演还没有开始" }, { status: 400 });
      }
      if (last.choice) {
        return NextResponse.json(
          { error: "这一步已经选过了，请继续下一步" },
          { status: 409 }
        );
      }

      const branchId = String(body.branchId || "");
      const branch = last.branches.find((b) => b.id === branchId);
      if (!branch) {
        return NextResponse.json({ error: "选项不存在" }, { status: 400 });
      }

      const actual =
        typeof body.actual === "string" && body.actual.trim()
          ? body.actual.trim().slice(0, 1500)
          : undefined;

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

      const next = await advanceLifeSim(
        {
          sim: {
            title: sim.title,
            premise: sim.premise,
            focus: sim.focus,
            horizon: sim.horizon,
          },
          nodes,
          choice: { branchId, actual },
          ctx: { entries, coverage },
        },
        aiConfig
      );

      if (!next) {
        return NextResponse.json(
          { error: "推演没有成功返回结果，请稍后重试" },
          { status: 502 }
        );
      }

      nodes[nodes.length - 1] = {
        ...last,
        choice: {
          branchId,
          chosenAt: new Date().toISOString(),
          actual,
        },
      };
      nodes.push(next);

      const updated = await prisma.lifeSim.update({
        where: { id: sim.id },
        data: {
          nodes: JSON.stringify(nodes),
          coverage: coverage.score,
        },
      });

      const simAfter = toSim(updated);
      return NextResponse.json({
        success: true,
        sim: simAfter,
        calibration: computeCalibration([simAfter]),
        coverage,
      });
    }

    /* ── 回填实际结果，用于校准 ── */
    if (action === "resolve") {
      const nodeId = String(body.nodeId || "");
      const idx = nodes.findIndex((n) => n.id === nodeId);
      if (idx === -1) {
        return NextResponse.json({ error: "节点不存在" }, { status: 400 });
      }

      const node = nodes[idx];
      const branchId = String(body.branchId || node.choice?.branchId || "");
      if (!branchId) {
        return NextResponse.json({ error: "缺少分支" }, { status: 400 });
      }

      const hit = typeof body.hit === "boolean" ? body.hit : null;
      if (hit === null) {
        return NextResponse.json({ error: "缺少结果判定" }, { status: 400 });
      }

      nodes[idx] = {
        ...node,
        choice: {
          branchId,
          chosenAt: node.choice?.chosenAt || new Date().toISOString(),
          actual:
            typeof body.actual === "string" && body.actual.trim()
              ? body.actual.trim().slice(0, 1500)
              : node.choice?.actual,
          hit,
          resolvedAt: new Date().toISOString(),
        },
      };

      const updated = await prisma.lifeSim.update({
        where: { id: sim.id },
        data: { nodes: JSON.stringify(nodes) },
      });

      const simAfter = toSim(updated);
      return NextResponse.json({
        success: true,
        sim: simAfter,
        calibration: computeCalibration([simAfter]),
      });
    }

    return NextResponse.json({ error: "未知操作" }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    console.error("Advance life sim error:", error);
    return NextResponse.json({ error: "推演失败" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireAuth(request);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const row = await loadSim(user.userId, id);
    if (!row) return NextResponse.json({ error: "推演不存在" }, { status: 404 });

    const data: { title?: string; status?: string } = {};
    if (typeof body.title === "string" && body.title.trim()) {
      data.title = body.title.trim().slice(0, 80);
    }
    if (body.status === "done" || body.status === "active") {
      data.status = body.status;
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "没有要修改的字段" }, { status: 400 });
    }

    const updated = await prisma.lifeSim.update({
      where: { id: row.id },
      data,
    });

    return NextResponse.json({ success: true, sim: toSim(updated) });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    console.error("Update life sim error:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireAuth(request);
    const { id } = await params;

    const row = await loadSim(user.userId, id);
    if (!row) return NextResponse.json({ error: "推演不存在" }, { status: 404 });

    await prisma.lifeSim.delete({ where: { id: row.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    console.error("Delete life sim error:", error);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
