import { NextRequest, NextResponse } from "next/server";
import { verifyToken, JwtPayload } from "./auth";

export function getAuthUser(request: NextRequest): JwtPayload | null {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
    const token = authHeader.split(" ")[1];
    return verifyToken(token);
  } catch {
    return null;
  }
}

export function requireAuth(request: NextRequest): JwtPayload {
  const user = getAuthUser(request);
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

export function withAuth(
  handler: (req: NextRequest, user: JwtPayload) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    try {
      const user = requireAuth(request);
      return await handler(request, user);
    } catch (error) {
      if (error instanceof Error && error.message === "UNAUTHORIZED") {
        return NextResponse.json({ error: "请先登录" }, { status: 401 });
      }
      return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
    }
  };
}

export function apiResponse(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
