import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.dicebear.com",
        pathname: "/7.x/**",
      },
      {
        protocol: "https",
        hostname: "apihub.agnes-ai.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.cloudfront.net",
      },
      {
        protocol: "https",
        hostname: "**.amazonaws.com",
      },
    ],
  },
  // Prisma 和 bcryptjs 有原生模块，需要保持为 external 避免构建错误
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
};

export default nextConfig;
