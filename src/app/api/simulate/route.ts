import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api";
import { simulateDialogue } from "@/lib/analysis/engine";
import { loadUserAIConfig } from "@/lib/ai/config-server";
import { emptyAnalysis, type AnalysisProfile } from "@/lib/analysis/types";

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const {
      characterId,
      sessionId: clientSessionId,
      userAction,
      scenario,
      mode = "dialogue",
    } = await request.json();

    if (!characterId || !userAction) {
      return json({ error: "参数不完整" }, 400);
    }

    const character = await prisma.character.findUnique({
      where: { id: parseInt(characterId) },
    });

    if (!character || character.userId !== user.userId) {
      return json({ error: "人物不存在" }, 404);
    }

    // ── 会话：续接 / 复用最近 / 新建 ────────────────────────
    let session = clientSessionId
      ? await prisma.simulationSession.findUnique({
          where: { id: parseInt(clientSessionId) },
        })
      : null;

    if (!session) {
      const recent = await prisma.simulationSession.findMany({
        where: {
          characterId: character.id,
          userId: user.userId,
          isArchived: false,
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      });
      session = recent[0] || null;
    }

    if (!session) {
      session = await prisma.simulationSession.create({
        data: {
          characterId: character.id,
          userId: user.userId,
          sessionTitle: `与${character.name}的模拟对话`,
          sessionType: mode.toUpperCase(),
          messages: JSON.stringify([]),
          settings: JSON.stringify({ mode }),
        },
      });
    }

    // ── 取人格档案作为模拟依据 ──────────────────────────────
    const profile: AnalysisProfile =
      safeJson(character.analysisProfile) || emptyAnalysis("该人物尚未完成人格研判");

    const historyMessages = safeJson(session.messages) || [];
    const history = historyMessages
      .map((m: any) => ({
        role: m.role as "user" | "assistant",
        content:
          typeof m.content === "string"
            ? m.content
            : m.content?.simulatedResponse || m.content?.response || "",
      }))
      .filter((m: any) => m.content);

    const aiConfig = await loadUserAIConfig(user.userId);
    const result = await simulateDialogue(
      profile,
      String(userAction),
      history,
      mode === "analysis" ? "analysis" : "dialogue",
      aiConfig
    );

    if (!result) {
      // 未配置 AI 时明确告知，而不是返回编造的角色台词
      const reason = aiConfig
        ? "模拟失败，请稍后重试"
        : "未配置 AI 服务，模拟对话不可用";
      return json({ error: reason }, 503);
    }

    const assistantMsg = {
      role: "assistant" as const,
      content: {
        simulatedResponse: result.response,
        reactions: result.reactions,
        psychologicalAnalysis: result.mechanism,
        intentionInference: result.intention,
        adviceGiven: result.advice,
        trigger: result.trigger,
        timestamp: new Date().toISOString(),
      },
    };

    // ── 持久化 ──────────────────────────────────────────────
    const persisted = [...historyMessages];
    persisted.push(
      { role: "user", content: userAction, timestamp: new Date().toISOString() },
      assistantMsg
    );

    await prisma.simulationSession.update({
      where: { id: session.id },
      data: { messages: JSON.stringify(persisted) },
    });

    await prisma.simulationFeedback.create({
      data: {
        simulationId: session.id,
        characterId: character.id,
        userAction,
        scenario: scenario || "",
        predictedReactions: JSON.stringify(result.reactions),
        psychologicalAnalysis: result.mechanism,
        intentionInference: result.intention,
        adviceGiven: JSON.stringify(result.advice),
        generatedResponse: result.response,
      },
    });

    return sse({
      sessionId: session.id,
      sessionTitle: session.sessionTitle,
      ...assistantMsg.content,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return json({ error: "请先登录" }, 401);
    }
    console.error("Simulate error:", error);
    return json({ error: "模拟失败" }, 500);
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

function json(data: any, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sse(data: any) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
