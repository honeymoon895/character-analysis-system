import { execSync } from "child_process";
import { mkdir, writeFile, readFile, unlink } from "fs/promises";
import path from "path";
import fs from "fs";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "videos");

/**
 * 确保上传目录存在
 */
async function ensureDir() {
  await mkdir(UPLOAD_DIR, { recursive: true });
}

/**
 * 下载视频到临时文件
 */
async function downloadVideo(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`下载视频失败: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buffer);
}

/**
 * 拼接多个视频片段
 * @param segments 视频 URL 数组
 * @param outputName 输出文件名（不含路径）
 * @returns 最终视频的公开 URL
 */
export async function stitchVideos(
  segments: string[],
  outputName: string
): Promise<string> {
  await ensureDir();

  const workDir = path.join(UPLOAD_DIR, `tmp-${Date.now()}`);
  await mkdir(workDir, { recursive: true });

  const segmentFiles: string[] = [];

  try {
    // 1. 下载所有片段
    for (let i = 0; i < segments.length; i++) {
      const ext = segments[i].includes(".mp4") ? "mp4" : "mp4";
      const segPath = path.join(workDir, `seg-${i}.${ext}`);
      console.log(`Downloading segment ${i + 1}/${segments.length}...`);
      await downloadVideo(segments[i], segPath);
      segmentFiles.push(segPath);
    }

    // 2. 创建 concat 文件
    const concatFile = path.join(workDir, "concat.txt");
    const concatContent = segmentFiles
      .map((f) => `file '${f.replace(/\\/g, "/")}'`)
      .join("\n");
    await writeFile(concatFile, concatContent);

    // 3. 用 FFmpeg 拼接
    const outputPath = path.join(UPLOAD_DIR, outputName);
    const cmd = `ffmpeg -y -f concat -safe 0 -i "${concatFile}" -c copy -movflags +faststart "${outputPath}"`;
    console.log("Stitching videos...");
    execSync(cmd, { stdio: "pipe", timeout: 300000 });

    // 4. 清理临时文件
    for (const f of segmentFiles) {
      try { await unlink(f); } catch {}
    }
    try { await unlink(concatFile); } catch {}
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch {}

    return `/uploads/videos/${outputName}`;
  } catch (error) {
    // 清理
    for (const f of segmentFiles) {
      try { await unlink(f); } catch {}
    }
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {}
    throw error;
  }
}

/**
 * 生成唯一文件名
 */
export function generateVideoFileName(prefix = "video"): string {
  return `${prefix}-${Date.now()}.mp4`;
}
