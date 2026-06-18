import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const dimensions = await prisma.dimensionDefinition.findMany({
      where: { isActive: true },
    });

    return NextResponse.json({ dimensions });
  } catch (error) {
    console.error("Get dimensions error:", error);
    return NextResponse.json(
      { error: "获取维度定义失败" },
      { status: 500 }
    );
  }
}
