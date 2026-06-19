import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api";
import { simulateReaction } from "@/lib/ai";

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const { characterId, sessionId: clientSessionId, userAction, scenario, mode = "dialogue" } = await request.json();

    if (!characterId || !userAction) {
      return new Response(JSON.stringify({ error: "参数不完整" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const character = await prisma.character.findUnique({
      where: { id: parseInt(characterId) },
    });

    if (!character || character.userId !== user.userId) {
      return new Response(JSON.stringify({ error: "人物不存在" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── Session 处理 ──────────────────────────────────────────
    let session = null;
    if (clientSessionId) {
      // 前端传了 sessionId → 续接该会话
      session = await prisma.simulationSession.findUnique({
        where: { id: parseInt(clientSessionId) },
      });
    }
    if (!session) {
      // 查找该人物最近的非归档会话
      const sessions = await prisma.simulationSession.findMany({
        where: { characterId: character.id, userId: user.userId, isArchived: false },
        orderBy: { createdAt: "desc" },
        take: 1,
      });
      session = sessions[0];
    }
    if (!session) {
      // 没有现成的 → 新建一个
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

    // ── 调用 AI ─────────────────────────────────────────────
    const traits = safeJson(character.traits);

    const aiResult = await simulateReaction(traits, userAction, mode as any);

    let parsed = tryExtractJson(aiResult);
    if (!parsed) {
      parsed = {
        reactions: [{ probability: 50, description: "无法确定" }],
        psychologicalAnalysis: "分析中...",
        intentionInference: "推测中...",
        adviceGiven: ["建议保持开放沟通"],
        simulatedResponse: "我理解你的想法。",
      };
    }

    // 确保字符串字段
    const safeStr = (v: any, fallback = ""): string => {
      if (!v) return fallback;
      if (typeof v === "string") return v;
      try {
        const s = JSON.stringify(v);
        return s && s !== "null" && s !== "undefined" ? s : fallback;
      } catch {
        return fallback;
      }
    };

    // ── 组装完整的 assistant 消息对象 ────────────────────────
    const assistantMsg = {
      role: "assistant" as const,
      content: {
        simulatedResponse: safeStr(parsed.simulatedResponse),
        reactions: parsed.reactions || [],
        psychologicalAnalysis: safeStr(parsed.psychologicalAnalysis),
        intentionInference: safeStr(parsed.intentionInference),
        adviceGiven: parsed.adviceGiven || [],
        timestamp: new Date().toISOString(),
      },
    };

    // ── 持久化到 DB ──────────────────────────────────────────
    const existingMessages = safeJson(session.messages) || [];
    existingMessages.push(
      { role: "user", content: userAction, timestamp: new Date().toISOString() },
      assistantMsg
    );
    await prisma.simulationSession.update({
      where: { id: session.id },
      data: {
        messages: JSON.stringify(existingMessages),
        sessionTitle: existingMessages.length <= 2
          ? `与${character.name}的模拟对话`
          : undefined, // 保留已有标题
      },
    });

    // 同时存 feedback（保持兼容）
    await prisma.simulationFeedback.create({
      data: {
        simulationId: session.id,
        characterId: character.id,
        userAction,
        scenario: scenario || "",
        predictedReactions: JSON.stringify(parsed.reactions || []),
        psychologicalAnalysis: safeStr(parsed.psychologicalAnalysis),
        intentionInference: safeStr(parsed.intentionInference),
        adviceGiven: JSON.stringify(parsed.adviceGiven || []),
        generatedResponse: safeStr(parsed.simulatedResponse),
      },
    });

    // ── SSE 回传 ─────────────────────────────────────────────
    const responseData = JSON.stringify({
      sessionId: session.id,
      sessionTitle: session.sessionTitle,
      ...assistantMsg.content,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${responseData}\n\n`));
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
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return new Response(JSON.stringify({ error: "请先登录" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    console.error("Simulate error:", error);
    return new Response(JSON.stringify({ error: "模拟失败" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
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
 * 从 AI 回复中提取 JSON，兼容 markdown 代码块包裹 / 前置说明文字等情况
 */
function tryExtractJson(text: string): any | null {
  if (!text) return null;

  // 1) 直接解析
  try {
    const direct = JSON.parse(text);
    if (direct && typeof direct === "object") return direct;
  } catch { /* 继续尝试 */ }

  // 2) 去掉 markdown 代码块标记（```json ... ``` 或 ``` ... ```）
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) {
    try {
      const parsed = JSON.parse(codeBlock[1].trim());
      if (parsed && typeof parsed === "object") return parsed;
    } catch { /* 继续尝试 */ }
  }

  // 3) 尝试提取最外层的 {…} 对象
  const braceStart = text.indexOf("{");
  const braceEnd = text.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    try {
      const candidate = text.slice(braceStart, braceEnd + 1);
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") return parsed;
    } catch { /* 继续尝试 */ }
  }

  return null;
}
