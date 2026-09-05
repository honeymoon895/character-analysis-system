import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const characterId = parseInt(formData.get("characterId") as string);

    if (!file || !characterId) {
      return NextResponse.json({ error: "参数不完整" }, { status: 400 });
    }

    // 验证文件类型
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "仅支持 JPG/PNG/GIF/WebP 格式" }, { status: 400 });
    }

    // 验证文件大小（最大 5MB）
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "文件大小不能超过 5MB" }, { status: 400 });
    }

    // 验证角色所有权
    const character = await prisma.character.findUnique({
      where: { id: characterId },
    });
    if (!character || character.userId !== user.userId) {
      return NextResponse.json({ error: "无权操作" }, { status: 403 });
    }

    // 保存文件
    const ext = file.name.split(".").pop() || "png";
    const filename = `avatar_${characterId}_${Date.now()}.${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    const filepath = path.join(uploadDir, filename);

    await mkdir(uploadDir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    const url = `/uploads/${filename}`;

    // 更新角色
    await prisma.character.update({
      where: { id: characterId },
      data: { portraitUrl: url },
    });

    return NextResponse.json({ portraitUrl: url });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    console.error("Upload portrait error:", error);
    return NextResponse.json({ error: "上传失败" }, { status: 500 });
  }
}
