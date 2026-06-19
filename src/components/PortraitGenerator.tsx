"use client";

import { useState, useRef } from "react";
import { httpPost } from "@/lib/http";

interface PortraitGeneratorProps {
  characterId: number;
  characterName: string;
  existingPortraitUrl?: string | null;
  onPortraitChange?: (url: string) => void;
}

export default function PortraitGenerator({
  characterId,
  characterName,
  existingPortraitUrl,
  onPortraitChange,
}: PortraitGeneratorProps) {
  const [portraitUrl, setPortraitUrl] = useState<string | null>(
    existingPortraitUrl || null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPortrait, setShowPortrait] = useState(false);
  const [source, setSource] = useState<"ai" | "upload">(
    existingPortraitUrl && !existingPortraitUrl.includes("dicebear.com")
      ? existingPortraitUrl.startsWith("/uploads/") ? "upload" : "ai"
      : "ai"
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setSource("ai");
      setShowPortrait(true);
      onPortraitChange?.(res.portraitUrl);
    } catch (err: any) {
      setError(err.message || "生成失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("只支持图片文件");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("文件大小不能超过 5MB");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("characterId", String(characterId));

      const res = await fetch("/api/character/upload-portrait", {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "上传失败");
      }
      const data = await res.json();
      setPortraitUrl(data.portraitUrl);
      setSource("upload");
      setShowPortrait(true);
      onPortraitChange?.(data.portraitUrl);
    } catch (err: any) {
      setError(err.message || "上传失败，请稍后重试");
    } finally {
      setLoading(false);
      // 重置 input，允许重复选择同一文件
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="portrait-generator">
      {/* 隐藏的文件选择器 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* 主按钮：无头像时显示 */}
      {!loading && !showPortrait && !hasValidPortrait && (
        <div className="flex gap-2">
          <button
            onClick={handleGenerate}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#a855f7] to-[#8b5cf6] text-white text-sm font-medium hover:shadow-md transition-all flex items-center gap-2"
          >
            <span>🎨</span>
            生成人物图像
          </button>
          <button
            onClick={handleUploadClick}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-gray-500 to-gray-400 text-white text-sm font-medium hover:shadow-md transition-all flex items-center gap-2"
          >
            <span>📁</span>
            上传头像
          </button>
        </div>
      )}

      {/* 已有头像时的操作栏 */}
      {hasValidPortrait && !loading && (
        <div className="flex gap-2">
          <button
            onClick={handleGenerate}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              source === "ai"
                ? "bg-[#a855f7] text-white"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
            title="AI 生成"
          >
            🎨 AI 生成
          </button>
          <button
            onClick={handleUploadClick}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              source === "upload"
                ? "bg-[#a855f7] text-white"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
            title="上传头像"
          >
            📁 上传
          </button>
        </div>
      )}

      {/* 加载状态 */}
      {loading && (
        <div className="flex flex-col items-center gap-3 py-6">
          <div className="relative w-48 h-48 rounded-xl bg-gray-100 overflow-hidden">
            <div className="absolute inset-0">
              <div className="h-full w-full bg-gradient-to-br from-[#a855f7]/5 to-[#8b5cf6]/5" />
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
                <div className="h-full bg-gradient-to-r from-[#a855f7] to-[#8b5cf6] rounded-full animate-pulse" style={{ width: "60%" }} />
              </div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-10 h-10 mx-auto mb-2 rounded-full border-2 border-[#a855f7] border-t-transparent animate-spin" />
                <p className="text-sm text-gray-400">
                  {source === "ai" || !source ? "AI 正在生成人物画像..." : "正在上传头像..."}
                </p>
                <p className="text-xs text-gray-300 mt-1">
                  {source === "ai" || !source ? "根据人物性格特征绘制" : ""}
                </p>
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
            onClick={() => setError(null)}
            className="text-xs text-gray-400 hover:underline"
          >
            关闭
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
                setPortraitUrl(
                  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                    characterName
                  )}&backgroundColor=6c63ff&textColor=ffffff`
                );
              }}
            />
            <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 text-white text-sm font-medium transition-opacity bg-black/40 px-3 py-1 rounded-lg">
                {characterName}
              </span>
            </div>
          </div>
          <span className="inline-block mt-1.5 text-[10px] text-gray-300">
            {source === "ai" ? "🎨 AI 生成画像" : "📁 上传头像"}
          </span>
        </div>
      )}
    </div>
  );
}
