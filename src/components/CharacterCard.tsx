"use client";

import Link from "next/link";

interface CharacterCardProps {
  id: number;
  name: string;
  source: string;
  personalitySummary?: string | null;
  traits?: any;
  portraitUrl?: string | null;
  createdAt: string;
}

export function CharacterCard({ id, name, source, personalitySummary, traits, portraitUrl, createdAt }: CharacterCardProps) {
  let dimensions: Array<{ code: string; name: string; score: number }> = [];
  if (traits) {
    try {
      dimensions = typeof traits === "string" ? JSON.parse(traits) : traits;
    } catch {}
  }

  const avgScore = dimensions.length
    ? Math.round(dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length)
    : 0;

  const dateStr = new Date(createdAt).toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  });

  return (
    <Link
      href={`/character/${id}`}
      className="group block bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md hover:border-[#6c63ff]/20 transition-all duration-200 animate-fade-in-up"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {portraitUrl && !portraitUrl.includes("dicebear.com") ? (
            <img
              src={portraitUrl}
              alt={name}
              className="w-10 h-10 rounded-full object-cover border border-gray-100"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6c63ff] to-[#8b85ff] flex items-center justify-center text-white font-bold">
              {name.charAt(0)}
            </div>
          )}
          <div>
            <h3 className="font-semibold text-gray-900 group-hover:text-[#6c63ff] transition-colors">
              {name}
            </h3>
            <span className="text-xs text-gray-400">
              {source === "WEB" ? "🌐 公众人物" : "✍️ 用户构建"}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-[#6c63ff]">{avgScore}</div>
          <div className="text-xs text-gray-400">综合评分</div>
        </div>
      </div>

      {personalitySummary && (
        <p className="text-sm text-gray-600 line-clamp-2 mb-3 leading-relaxed">
          {personalitySummary}
        </p>
      )}

      {dimensions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {dimensions.slice(0, 5).map((d) => (
            <span
              key={d.code}
              className="text-xs px-2 py-0.5 rounded-full bg-gray-50 text-gray-500"
            >
              {d.name}
            </span>
          ))}
          {dimensions.length > 5 && (
            <span className="text-xs px-2 py-0.5 text-gray-400">
              +{dimensions.length - 5}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
        <span className="text-xs text-gray-400">{dateStr}</span>
        <span className="text-xs text-[#6c63ff] opacity-0 group-hover:opacity-100 transition-opacity">
          查看详情 →
        </span>
      </div>
    </Link>
  );
}
