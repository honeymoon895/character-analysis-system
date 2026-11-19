import { prisma } from "@/lib/db";
import { resolveAIConfig, type AIConfig } from "./config";

/**
 * 取出当前用户可用的 AI 配置。
 * 用户自己配了 key 就用用户的，否则回落到服务端环境变量。
 */
export async function loadUserAIConfig(userId: number): Promise<AIConfig | null> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      aiApiKey: true,
      aiBaseUrl: true,
      aiModel: true,
      aiProvider: true,
      aiImageModel: true,
      aiVideoModel: true,
      aiImageUrl: true,
      aiVideoUrl: true,
    },
  });
  return resolveAIConfig(dbUser);
}
