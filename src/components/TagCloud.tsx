"use client";

import { generateTags } from "@/lib/dimensions";

interface TagCloudProps {
  traits: Array<{ code: string; name: string; score: number; confidence: number; evidence?: string[] }>;
}

export function TagCloud({ traits }: TagCloudProps) {
  if (!traits || traits.length === 0) {
    return (
      <div className="text-sm text-gray-400 py-4 text-center">
        暂无标签数据
      </div>
    );
  }

  const tags = generateTags(traits);

  const sizeClasses: Record<string, string> = {
    lg: "text-base px-4 py-2",
    md: "text-sm px-3 py-1.5",
    sm: "text-xs px-2 py-1",
  };

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag, i) => (
        <span
          key={i}
          className={`inline-flex items-center gap-1 rounded-full border border-gray-100 bg-white shadow-sm hover:shadow-md transition-all cursor-default ${sizeClasses[tag.size]}`}
        >
          <span>{tag.emoji}</span>
          <span>{tag.tag}</span>
        </span>
      ))}
    </div>
  );
}
