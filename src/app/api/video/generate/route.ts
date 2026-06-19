import { NextRequest, NextResponse } from "next/server";

/**
 * 视频生成功能在 Vercel 部署中暂时不可用。
 *
 * 原因：
 *   1. 视频拼接 (FFmpeg) — Vercel serverless 环境没有 FFmpeg
 *   2. 长轮询等待 — 视频生成通常需要 30s+，超出免费计划的函数超时限制 (10s)
 *
 * TODO: 使用异步方案重新启用：
 *   1. 创建视频任务 → 立即返回 taskId
 *   2. 客户端轮询 GET /api/video/status/[taskId]
 *   3. 需要数据库存储任务状态，或使用第三方服务
 *
 * 参见: src/lib/video/stitch.ts（已暂停）
 */
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      error: "AI 视频生成功能在当前平台暂时不可用",
      fallback: true,
      message:
        "您仍可以使用人物分析、模拟对话和性格画像等核心功能。视频功能将在后续版本中恢复。",
    },
    { status: 503 }
  );
}
