"use client";

import { useState, useEffect } from "react";

const loadingTexts = [
  "正在从字里行间读懂TA……",
  "AI正在分析TA的性格密码……",
  "快了快了，TA的画像就要揭晓了……",
  "把你的描述和AI的能力结合在一起……",
  "这可能是你第一次真正'看见'TA……",
];

interface LoadingOverlayProps {
  visible: boolean;
  name?: string;
}

export function LoadingOverlay({ visible, name }: LoadingOverlayProps) {
  const [textIndex, setTextIndex] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      setTextIndex((prev) => (prev + 1) % loadingTexts.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) return null;

  const displayText = name
    ? loadingTexts[textIndex].replace("TA", name)
    : loadingTexts[textIndex];

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-[#f8f9fc] to-[#e8e6ff]">
      {/* Breathing circle */}
      <div className="relative mb-12">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#6c63ff]/20 to-[#8b85ff]/20 animate-breathing" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#6c63ff] to-[#8b85ff] flex items-center justify-center shadow-lg">
            <span className="text-2xl text-white">♟</span>
          </div>
        </div>
      </div>

      {/* Loading text */}
      <p className="text-lg text-gray-600 font-medium transition-opacity duration-500 text-center px-4" key={textIndex}>
        {displayText}
      </p>

      {/* Loading bar */}
      <div className="mt-8 w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-[#6c63ff] to-[#8b85ff] rounded-full animate-gradient"
          style={{ width: "30%" }}
        />
      </div>
    </div>
  );
}
