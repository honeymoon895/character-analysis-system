import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api";

export async function PUT(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const { email, currentPassword, newPassword } = await request.json();

    const updateData: any = {};
    if (email !== undefined) updateData.email = email;

    // Password change
    if (currentPassword && newPassword) {
      const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
      if (!dbUser) return NextResponse.json({ error: "用户不存在" }, { status: 404 });

      const valid = await bcrypt.compare(currentPassword, dbUser.passwordHash);
      if (!valid) return NextResponse.json({ error: "当前密码错误" }, { status: 400 });

      if (newPassword.length < 6) return NextResponse.json({ error: "新密码长度至少6位" }, { status: 400 });
      updateData.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    const updated = await prisma.user.update({
      where: { id: user.userId },
      data: updateData,
      select: { id: true, username: true, email: true, avatar: true },
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}
