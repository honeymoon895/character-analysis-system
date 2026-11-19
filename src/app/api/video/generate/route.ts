import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api";
import {
  createVideoTask,
  waitForVideo,
  durationToFrames,
  rewriteVideoPrompt,
  maxSegmentSecondsFor,
} from "@/lib/ai";
import { stitchVideos, generateVideoFileName } from "@/lib/video/stitch";
import { mediaSupport } from "@/lib/ai/config";
import { loadUserAIConfig } from "@/lib/ai/config-server";



export async function POST(request: NextRequest) {
  try {
    const authUser = requireAuth(request);
    const {
      characterId,
      prompt,
      duration = 5,
      imageUrl,
      characterImageUrl,
    } = await request.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "请输入场景描述" }, { status: 400 });
    }

    // 关键修复：使用当前用户的配置。之前读的是服务端环境变量，
    // 用户在「我的 → AI 引擎」填的 key 完全没被用上。
    const aiConfig = await loadUserAIConfig(authUser.userId);

    if (!aiConfig) {
      return NextResponse.json(
        { error: "未配置 AI 服务。请到「我的 → AI 引擎」填写密钥。" },
        { status: 400 }
      );
    }

    // 明确告知：对话模型不能出视频，别让用户白等
    const support = mediaSupport(aiConfig);
    if (!support.video) {
      return NextResponse.json(
        {
          error: `当前服务商不支持视频生成。${support.note}`,
          unsupported: true,
        },
        { status: 400 }
      );
    }

    if (duration < 1 || duration > 120) {
      return NextResponse.json({ error: "时长应在 1-120 秒之间" }, { status: 400 });
    }

    // 验证角色是否存在（如果传了 characterId）
    let characterImage = characterImageUrl;
    if (characterId) {
      const character = await prisma.character.findUnique({
        where: { id: parseInt(characterId) },
      });
      if (!character || character.userId !== authUser.userId) {
        return NextResponse.json({ error: "人物不存在" }, { status: 404 });
      }
      // 如果没传角色图片，用角色头像
      if (!characterImage && character.portraitUrl) {
        characterImage = character.portraitUrl;
      }
    }

    // 决定参考图片（优先用户自己的头像 + 角色头像）
    const referenceImages: string[] = [];
    if (imageUrl) referenceImages.push(imageUrl);
    if (characterImage && characterImage !== imageUrl) {
      referenceImages.push(characterImage);
    }

    // 单段上限随模型而定：agnes-video-2.5 最长 12 秒，旧版约 18 秒
    const maxSeg = maxSegmentSecondsFor(aiConfig);

    // ─── 短视频：直接生成 ─────────────────────────
    if (duration <= maxSeg) {
      const numFrames = durationToFrames(duration);
      const safePrompt = await rewriteVideoPrompt(prompt, aiConfig);
      const promptWithStyle = buildVideoPrompt(safePrompt, referenceImages);

      const task = await createVideoTask(promptWithStyle, {
        imageUrl: referenceImages[0], // 旧版模型只用第一张
        images: referenceImages, // 新版模型 reference 模式可用多张
        numFrames,
        frameRate: 24,
        seconds: duration,
        config: aiConfig,
      });

      const videoUrl = await waitForVideo(task.taskId, 300000, aiConfig);

      return NextResponse.json({
        success: true,
        videoUrl,
        duration,
        stitched: false,
        segments: 1,
      });
    }

    // ─── 长视频：分段生成 + 拼接 ─────────────────
    const segmentCount = Math.ceil(duration / maxSeg);
    const secondsPerSegment = Math.ceil(duration / segmentCount);
    // 总帧数 = 原始时长×帧率（不用 durationToFrames，因为它有 441 帧上限，只适合单段）
    const FRAME_RATE = 24;
    const totalFrames = duration * FRAME_RATE;
    // 均匀分配帧数到各段
    const framesPerSegment = Math.floor(totalFrames / segmentCount);
    // 每段调整为 8n+1
    const adjustedFrames = segmentFrames(framesPerSegment, segmentCount, totalFrames);

    // 先用 AI 改写整个 prompt（避免每段独立改写增加开销）
    const safePrompt = await rewriteVideoPrompt(prompt, aiConfig);
    // 生成每段的 prompt（带时间线描述）
    const segmentPrompts = splitPromptByTimeline(safePrompt, segmentCount);

    // 并行生成所有段（每段都应用 buildVideoPrompt，与短视频路径一致）
    const tasks = await Promise.all(
      segmentPrompts.map((segPrompt, i) => {
        const finalPrompt = buildVideoPrompt(segPrompt, referenceImages);
        console.log(`[Video] Seg ${i + 1}/${segmentCount}: ${finalPrompt.substring(0, 80)}...`);
        return createVideoTask(finalPrompt, {
          imageUrl: referenceImages[0],
          images: referenceImages,
          numFrames: adjustedFrames[i],
          frameRate: 24,
          seconds: secondsPerSegment,
          config: aiConfig,
        });
      })
    );

    // 并行等待所有段完成（总耗时 ≈ 最慢的一段，而非各段之和）
    console.log(`Waiting for ${tasks.length} video tasks...`);
    const videoUrls = await Promise.all(
      tasks.map((t) => waitForVideo(t.taskId, 600000, aiConfig))
    );
    console.log(`All ${videoUrls.length} segments completed.`);

    // 拼接
    const outputName = generateVideoFileName("story");
    const finalUrl = await stitchVideos(videoUrls, outputName);

    return NextResponse.json({
      success: true,
      videoUrl: finalUrl,
      duration,
      stitched: true,
      segments: segmentCount,
    });
  } catch (error: any) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    console.error("Video generation error:", error);
    return NextResponse.json(
      { error: error.message || "视频生成失败" },
      { status: 500 }
    );
  }
}

// ─── 工具函数 ──────────────────────────────────────────

/**
 * 构建 prompt
 */
function buildVideoPrompt(
  prompt: string,
  referenceImages: string[]
): string {
  // 清理特殊字符
  const clean = prompt.replace(/[「」【】""''〝〞]/g, "").trim();
  // 全中文描述，避免中英文混合导致审核异常
  const prefix = referenceImages.length > 0
    ? "根据参考图片风格，"
    : "电影感画面，";
  return `${prefix}${clean}，自然光线，画面流畅。`;
}

/**
 * 将长视频按时间线拆分为多段 prompt
 */
function splitPromptByTimeline(
  prompt: string,
  segmentCount: number
): string[] {
  if (segmentCount <= 1) return [prompt];

  const timeMarkers = [
    "开场",
    "发展",
    "推进",
    "转折",
    "收尾",
  ];

  return Array.from({ length: segmentCount }, (_, i) => {
    const marker = timeMarkers[i] || `第 ${i + 1} 段`;
    const totalDesc = segmentCount > 1
      ? `（${marker}，第 ${i + 1}/${segmentCount} 段，需要与前后段自然衔接）`
      : "";
    return `${prompt}${totalDesc}`;
  });
}

/**
 * 计算每段的帧数（确保总和 = totalFrames，每个满足 8n+1）
 */
function segmentFrames(
  baseFrames: number,
  count: number,
  totalFrames: number
): number[] {
  const frames: number[] = [];
  let sum = 0;
  for (let i = 0; i < count; i++) {
    const isLast = i === count - 1;
    let f = isLast ? totalFrames - sum : baseFrames;
    // 调整为 8n+1，最后一段用 floor 确保不超总帧数
    let n = isLast
      ? Math.max(1, Math.floor((f - 1) / 8))
      : Math.round((f - 1) / 8);
    n = Math.max(1, Math.min(n, 55));
    f = 8 * n + 1;
    frames.push(f);
    sum += f;
  }
  return frames;
}
