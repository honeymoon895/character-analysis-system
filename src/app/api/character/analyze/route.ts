import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api";
import { analyzeCharacter } from "@/lib/ai";

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const { name } = await request.json();

    if (!name) {
      return new Response(JSON.stringify({ error: "请输入人物姓名" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Create the character first
    const character = await prisma.character.create({
      data: {
        userId: user.userId,
        name,
        source: "WEB",
        basicInfo: JSON.stringify({ name }),
      },
    });

    // Create crawl record
    await prisma.crawlRecord.create({
      data: {
        characterId: character.id,
        sourceSite: "web",
        status: "processing",
      },
    });

    // Call AI analysis
    const aiResult = await analyzeCharacter(name, "web");

    let parsed;
    try {
      parsed = JSON.parse(aiResult);
    } catch {
      parsed = {
        dimensions: [],
        summary: "分析完成",
        behaviorPatterns: [],
        values: [],
        contradictions: [],
      };
    }

    // Update character with analysis results
    await prisma.character.update({
      where: { id: character.id },
      data: {
        traits: JSON.stringify(parsed.dimensions || []),
        personalitySummary: parsed.summary || "",
        behaviorPatterns: JSON.stringify(parsed.behaviorPatterns || []),
        values: JSON.stringify(parsed.values || []),
        keyEvents: JSON.stringify(parsed.keyEvents || []),
      },
    });

    // Update crawl record
    await prisma.crawlRecord.updateMany({
      where: { characterId: character.id },
      data: { status: "completed" },
    });

    // Return SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const data = JSON.stringify({
          characterId: character.id,
          traits: parsed.dimensions || [],
          summary: parsed.summary || "",
          behaviorPatterns: parsed.behaviorPatterns || [],
          values: parsed.values || [],
          keyEvents: parsed.keyEvents || [],
          contradictions: parsed.contradictions || [],
        });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
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
    console.error("Analyze error:", error);
    return new Response(JSON.stringify({ error: "分析失败" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
