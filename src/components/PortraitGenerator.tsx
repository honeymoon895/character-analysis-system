"use client";

import { useState } from "react";
import { httpPost } from "@/lib/http";

interface PortraitGeneratorProps {
  characterId: number;
  characterName: string;
  existingPortraitUrl?: string | null;
}

export default function PortraitGenerator({
  characterId,
  characterName,
  existingPortraitUrl,
}: PortraitGeneratorProps) {
  const [portraitUrl, setPortraitUrl] = useState<string | null>(
    existingPortraitUrl || null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPortrait, setShowPortrait] = useState(false);

  // 如果已经有合法画像 URL 则自动展开
  const hasValidPortrait =
    portraitUrl && !portraitUrl.includes("dicebear.com");

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await httpPost("/api/character/generate-portrait", {
        characterId,
      });
      setPortraitUrl(res.portraitUrl);
      setShowPortrait(true);
    } catch (err: any) {
      setError(err.message || "生成失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="portrait-generator">
      {/* 主按钮 */}
      {!loading && !showPortrait && !hasValidPortrait && (
        <button
          onClick={handleGenerate}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#a855f7] to-[#8b5cf6] text-white text-sm font-medium hover:shadow-md transition-all flex items-center gap-2"
        >
          <span>🎨</span>
          生成人物图像
        </button>
      )}

      {/* 重新生成按钮 */}
      {hasValidPortrait && !loading && (
        <button
          onClick={handleGenerate}
          className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-500 text-xs hover:bg-gray-200 transition-colors"
          title="重新生成"
        >
          🔄 重新生成
        </button>
      )}

      {/* 加载状态 */}
      {loading && (
        <div className="flex flex-col items-center gap-3 py-6">
          <div className="relative w-48 h-48 rounded-xl bg-gray-100 overflow-hidden">
            {/* 进度条动画 */}
            <div className="absolute inset-0">
              <div className="h-full w-full bg-gradient-to-br from-[#a855f7]/5 to-[#8b5cf6]/5" />
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
                <div className="h-full bg-gradient-to-r from-[#a855f7] to-[#8b5cf6] rounded-full animate-pulse" style={{ width: "60%" }} />
              </div>
            </div>
            {/* 生成中文字 */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-10 h-10 mx-auto mb-2 rounded-full border-2 border-[#a855f7] border-t-transparent animate-spin" />
                <p className="text-sm text-gray-400">AI 正在生成人物画像...</p>
                <p className="text-xs text-gray-300 mt-1">根据人物性格特征绘制</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 错误状态 */}
      {error && !loading && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-red-400">{error}</span>
          <button
            onClick={handleGenerate}
            className="text-xs text-[#a855f7] hover:underline"
          >
            重试
          </button>
        </div>
      )}

      {/* 生成结果展示 */}
      {(showPortrait || hasValidPortrait) && portraitUrl && !loading && (
        <div className="animate-fade-in-up">
          <div className="relative group">
            <img
              src={portraitUrl}
              alt={`${characterName} 的人物画像`}
              className="w-48 h-48 rounded-xl object-cover shadow-md border border-gray-100"
              onError={() => {
                // 图片加载失败时回退到首字母
                setPortraitUrl(
                  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                    characterName
                  )}&backgroundColor=6c63ff&textColor=ffffff`
                );
              }}
            />
            {/* 悬停遮罩 */}
            <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 text-white text-sm font-medium transition-opacity bg-black/40 px-3 py-1 rounded-lg">
                {characterName}
              </span>
            </div>
          </div>
          {/* 标签提示 */}
          <span className="inline-block mt-1.5 text-[10px] text-gray-300">
            🎨 AI 生成画像
          </span>
        </div>
      )}
    </div>
  );
}
