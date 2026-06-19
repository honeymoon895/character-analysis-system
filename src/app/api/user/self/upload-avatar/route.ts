import { NextRequest, NextResponse } from "next/server";

/**
 * 头像上传功能在 Vercel 部署中暂时不可用。
 * 本地文件系统在 serverless 环境中不持久。
 *
 * TODO: 替换为 Vercel Blob 存储后可重新启用：
 *   1. npm install @vercel/blob
 *   2. 在 Vercel Dashboard 添加 BLOB_READ_WRITE_TOKEN 环境变量
 *   3. 使用 put() 替代 fs.writeFile()
 *
 * 参见: https://vercel.com/docs/storage/vercel-blob
 */
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      error: "头像上传功能在当前平台暂时不可用",
      fallback: true,
      message: "您可以通过其他方式更新头像，或等待后续版本。",
    },
    { status: 503 }
  );
}
