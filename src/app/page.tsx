"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { Header } from "@/components/Header";
import { CharacterCard } from "@/components/CharacterCard";
import { BuildCharacterModal } from "@/components/BuildCharacterModal";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { httpGet, httpPost } from "@/lib/http";

const SUGGESTIONS = ["曹操", "马云", "爱因斯坦", "李白", "Elon Musk", "诸葛亮"];

export default function HomePage() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"public" | "custom">("public");
  const [showBuildModal, setShowBuildModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [characters, setCharacters] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState(SUGGESTIONS);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    loadCharacters();
  }, []);

  const loadCharacters = async () => {
    try {
      const res = await httpGet("/api/character/list");
      setCharacters(res.characters || []);
    } catch {}
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (value.trim()) {
      setFilteredSuggestions(
        SUGGESTIONS.filter((s) => s.toLowerCase().includes(value.toLowerCase()))
      );
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleAnalyze = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await httpPost("/api/character/analyze", { name: query });
      if (res instanceof Response) {
        const reader = res.body?.getReader();
        if (reader) {
          const decoder = new TextDecoder();
          let done = false;
          while (!done) {
            const { done: d, value } = await reader.read();
            done = d;
            if (value) {
              const text = decoder.decode(value);
              const lines = text.split("\n").filter((l) => l.startsWith("data: "));
              for (const line of lines) {
                const data = line.slice(6);
                if (data === "[DONE]") {
                  loadCharacters();
                  setQuery("");
                  setLoading(false);
                  return;
                }
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.characterId) {
                    router.push(`/character/${parsed.characterId}`);
                    return;
                  }
                } catch {}
              }
            }
          }
        }
      }
      loadCharacters();
      setQuery("");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBuildComplete = (characterId: number) => {
    setShowBuildModal(false);
    router.push(`/character/${characterId}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAnalyze();
  };

  return (
    <>
      <Header />
      <LoadingOverlay visible={loading} name={query || undefined} />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-16 md:py-24">
          <div className="page-container">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight">
                深度理解他人
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#6c63ff] to-[#8b85ff]">
                  减少人际内耗
                </span>
              </h1>
              <p className="text-lg text-gray-500">
                输入人物姓名或自定义描述，AI将为你生成九维心理特征画像
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 mb-6">
              <button
                onClick={() => setMode("public")}
                className={`px-6 py-2.5 rounded-xl font-medium transition-all ${
                  mode === "public"
                    ? "bg-[#6c63ff] text-white shadow-md"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"
                }`}
              >
                🌐 公众人物
              </button>
              <button
                onClick={() => setMode("custom")}
                className={`px-6 py-2.5 rounded-xl font-medium transition-all ${
                  mode === "custom"
                    ? "bg-[#6c63ff] text-white shadow-md"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"
                }`}
              >
                ✍️ 自定义人物
              </button>
            </div>

            {mode === "public" ? (
              <div className="max-w-xl mx-auto relative">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => handleQueryChange(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                      placeholder="试试输入：曹操、马云、爱因斯坦..."
                      className="w-full px-5 py-3.5 rounded-xl bg-white border border-gray-200 focus:border-[#6c63ff] focus:ring-2 focus:ring-[#6c63ff]/20 outline-none transition-all shadow-sm text-base"
                    />
                    {showSuggestions && filteredSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-10">
                        {filteredSuggestions.map((s) => (
                          <button
                            key={s}
                            onMouseDown={() => { setQuery(s); setShowSuggestions(false); }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 transition-colors"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleAnalyze}
                    disabled={loading || !query.trim()}
                    className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#6c63ff] to-[#8b85ff] text-white font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    分析
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 mt-4 justify-center">
                  {SUGGESTIONS.slice(0, 5).map((s) => (
                    <button
                      key={s}
                      onClick={() => setQuery(s)}
                      className="text-sm px-3 py-1.5 rounded-full bg-white border border-gray-100 text-gray-500 hover:border-[#6c63ff]/30 hover:text-[#6c63ff] transition-all shadow-sm"
                    >
                      试试：{s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="max-w-lg mx-auto text-center">
                <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
                  <div className="text-4xl mb-4">✍️</div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">
                    渐进式人物构建
                  </h3>
                  <p className="text-gray-500 mb-6">
                    通过多轮对话逐步描述身边人，AI将渐进式构建完整的人格画像
                  </p>
                  <button
                    onClick={() => setShowBuildModal(true)}
                    className="px-8 py-3 rounded-xl bg-gradient-to-r from-[#6c63ff] to-[#8b85ff] text-white font-medium hover:shadow-lg transition-all"
                  >
                    开始构建
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {characters.length > 0 && (
          <section className="pb-16">
            <div className="page-container">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  我的人物库
                  <span className="text-sm font-normal text-gray-400 ml-2">({characters.length})</span>
                </h2>
                <button
                  onClick={loadCharacters}
                  className="text-sm text-gray-400 hover:text-[#6c63ff] transition-colors"
                >
                  🔄 刷新
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {characters.map((c) => (
                  <CharacterCard
                    key={c.id}
                    id={c.id}
                    name={c.name}
                    source={c.source}
                    personalitySummary={c.personalitySummary}
                    traits={c.traits}
                    portraitUrl={c.portraitUrl}
                    createdAt={c.createdAt}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {characters.length === 0 && !loading && (
          <section className="pb-16">
            <div className="page-container">
              <div className="text-center py-16">
                <div className="text-6xl mb-4 opacity-30">🔍</div>
                <p className="text-gray-400 text-lg">还没有分析过人物</p>
                <p className="text-gray-300 text-sm mt-1">输入公众人物姓名或点击&ldquo;自定义人物&rdquo;开始</p>
              </div>
            </div>
          </section>
        )}

        <footer className="border-t border-gray-100 py-6">
          <div className="page-container text-center">
            <p className="text-xs text-gray-400">
              AI分析仅供参考，真实的人是多变的
            </p>
            <p className="text-xs text-gray-400 mt-1">
              建议结合现实观察，不要完全依赖分析做决定
            </p>
          </div>
        </footer>
      </main>

      <BuildCharacterModal
        visible={showBuildModal}
        onClose={() => setShowBuildModal(false)}
        onComplete={handleBuildComplete}
      />
    </>
  );
}
