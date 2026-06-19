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
  basicInfo?: any;
  onDelete?: (id: number) => void;
}

export function CharacterCard({ id, name, source, personalitySummary, traits, portraitUrl, createdAt, basicInfo, onDelete }: CharacterCardProps) {
  let dimensions: Array<{ code: string; name: string; score: number }> = [];
  if (traits) {
    try {
      dimensions = typeof traits === "string" ? JSON.parse(traits) : traits;
    } catch {}
  }

  let relationship = "";
  if (source === "USER_BUILT" && basicInfo) {
    try {
      const info = typeof basicInfo === "string" ? JSON.parse(basicInfo) : basicInfo;
      relationship = info.relationship || "";
    } catch {}
  }

  const avgScore = dimensions.length
    ? Math.round(dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length)
    : 0;

  const dateStr = new Date(createdAt).toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  });

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(`确定要删除"${name}"吗？该操作不可撤销。`)) {
      onDelete?.(id);
    }
  };

  return (
    <div className="group relative block bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md hover:border-[#6c63ff]/20 transition-all duration-200 animate-fade-in-up">
      <Link
        href={`/character/${id}`}
        className="block"
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
              {relationship && (
                <span className="text-xs px-1.5 py-0.5 rounded-md bg-[#6c63ff]/5 text-[#6c63ff] border border-[#6c63ff]/10">
                  {relationship}
                </span>
              )}
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

      {/* 删除按钮 */}
      <button
        onClick={handleDelete}
        className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-white/80 text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all duration-200"
        title="删除人物"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c-.84 0-1.673.025-2.5.075V3.75c0-.69.56-1.25 1.25-1.25h2.5c.69 0 1.25.56 1.25 1.25v.325C11.673 4.025 10.84 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
}
