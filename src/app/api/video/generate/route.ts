import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api";
import {
  createVideoTask,
  waitForVideo,
  durationToFrames,
  maxSegmentDuration,
} from "@/lib/ai";
import { stitchVideos, generateVideoFileName } from "@/lib/video/stitch";

const MAX_SEGMENT_SECONDS = maxSegmentDuration(); // ~18s

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

    // ─── 短视频：直接生成 ─────────────────────────
    if (duration <= MAX_SEGMENT_SECONDS) {
      const numFrames = durationToFrames(duration);
      const promptWithStyle = buildVideoPrompt(prompt, referenceImages);

      const task = await createVideoTask(promptWithStyle, {
        imageUrl: referenceImages[0], // 第一张作为参考图
        numFrames,
        frameRate: 24,
      });

      const videoUrl = await waitForVideo(task.taskId);

      return NextResponse.json({
        success: true,
        videoUrl,
        duration,
        stitched: false,
        segments: 1,
      });
    }

    // ─── 长视频：分段生成 + 拼接 ─────────────────
    const segmentCount = Math.ceil(duration / MAX_SEGMENT_SECONDS);
    // 均匀分配帧数到各段
    const totalFrames = durationToFrames(duration);
    const framesPerSegment = Math.floor(totalFrames / segmentCount);
    // 每段调整为 8n+1
    const adjustedFrames = segmentFrames(framesPerSegment, segmentCount, totalFrames);

    // 生成每段的 prompt（带时间线描述）
    const segmentPrompts = splitPromptByTimeline(prompt, segmentCount);

    // 并行生成所有段
    const tasks = await Promise.all(
      segmentPrompts.map((segPrompt, i) =>
        createVideoTask(segPrompt, {
          imageUrl: referenceImages[0],
          numFrames: adjustedFrames[i],
          frameRate: 24,
        })
      )
    );

    // 串行等待完成（避免 API 限流）
    const videoUrls: string[] = [];
    for (let i = 0; i < tasks.length; i++) {
      const url = await waitForVideo(tasks[i].taskId);
      videoUrls.push(url);
    }

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
  // 英文前缀 + 原始描述（视频模型对中英文混合友好）
  const prefix = referenceImages.length > 0
    ? "Generate a video matching the reference image style. "
    : "Cinematic video. ";
  return `${prefix}${clean}. Natural lighting, smooth motion.`;
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
    "开头",
    "发展",
    "高潮",
    "转折",
    "结尾",
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
    // 调整为 8n+1
    let n = Math.round((f - 1) / 8);
    n = Math.max(1, Math.min(n, 55));
    f = 8 * n + 1;
    frames.push(f);
    sum += f;
  }
  // 修正最后一段
  if (sum !== totalFrames && frames.length > 0) {
    const diff = totalFrames - sum;
    let n = Math.round((frames[frames.length - 1] + diff - 1) / 8);
    n = Math.max(1, Math.min(n, 55));
    frames[frames.length - 1] = 8 * n + 1;
  }
  return frames;
}
