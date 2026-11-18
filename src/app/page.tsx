"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";
import { httpGet, httpDelete } from "@/lib/http";

/**
 * 人物库（首页）
 *
 * 布局顺序按"用户最想做的事"排：
 * 1. 一个新人物入口（分析公众人物 / 记录身边人）—— 首屏即可见，无需滚动
 * 2. 最近研判的人物（大卡片，直接看到核心结论）
 * 3. 完整文库（可搜索、按关系筛选）
 */

interface CharacterItem {
  id: number;
  name: string;
  source: string;
  traits: any;
  personalitySummary: string | null;
  portraitUrl: string | null;
  basicInfo: any;
  createdAt: string;
  updatedAt: string;
}

export default function LibraryPage() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();

  const [items, setItems] = useState<CharacterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "WEB" | "USER_BUILT">("all");

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    load();
  }, []);

  async function load() {
    try {
      const res = await httpGet("/api/character/list");
      setItems(res.characters || []);
    } catch {
      // 静默失败，下一步由空态引导
    } finally {
      setLoading(false);
    }
  }

  const relationships = useMemo(() => {
    const set = new Set<string>();
    for (const c of items) {
      const info = parse(c.basicInfo);
      if (info?.relationship) set.add(info.relationship);
    }
    return [...set];
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((c) => {
      if (filter !== "all" && c.source !== filter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.personalitySummary || "").toLowerCase().includes(q)
      );
    });
  }, [items, query, filter]);

  const recent = filtered.slice(0, 3);
  const rest = filtered.slice(3);

  async function remove(id: number, name: string) {
    if (!confirm(`删除「${name}」的档案？此操作不可撤销。`)) return;
    try {
      await httpDelete(`/api/character/${id}`);
      setItems((prev) => prev.filter((c) => c.id !== id));
    } catch (e: any) {
      alert(e.message || "删除失败");
    }
  }

  // 传给卡片的是同步回调，避免 Promise 返回值污染 onClick 的类型
  const handleRemove = (id: number, name: string) => {
    void remove(id, name);
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="shell pt-6 md:pt-10 pb-10">
      {/* ── 页头 ── */}
      <header className="mb-7 rise">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-[11px] tracking-[0.22em] uppercase text-bone-500 mb-2">
              档案库
            </div>
            <h1 className="font-display text-[26px] md:text-[34px] leading-tight text-bone-50">
              {items.length > 0 ? `${items.length} 份人格档案` : "还没有档案"}
            </h1>
            <p className="text-[13px] text-bone-400 mt-2 leading-relaxed max-w-md">
              每一个被认真理解的人，都不该被简化成一句性格描述。
            </p>
          </div>
        </div>
      </header>

      {/* ── 主要入口（始终首屏可见） ── */}
      <div className="grid gap-3 md:grid-cols-2 mb-8 rise" style={{ animationDelay: "60ms" }}>
        <Link
          href="/explore?tab=public"
          className="surface-raised p-5 press group relative overflow-hidden block"
        >
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-amber/12 border border-amber/25 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-amber-bright">
                <path d="M4 19V7a2 2 0 0 1 2-2h5v14H6a2 2 0 0 1-2-2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M13 5h5a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" opacity="0.6" />
                <path d="M16 9h1.5M16 12.5h1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] text-bone-50 font-medium mb-1">
                分析一个公众人物
              </div>
              <p className="text-[12.5px] text-bone-400 leading-relaxed">
                输入姓名，基于公开史料与言行记载做人格研判
              </p>
            </div>
            <Arrow />
          </div>
        </Link>

        <Link
          href="/explore?tab=personal"
          className="surface-raised p-5 press group relative overflow-hidden block"
        >
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-jade/12 border border-jade/25 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-jade">
                <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
                <path d="M3.5 19c.5-3 2.9-4.7 5.5-4.7s5 1.7 5.5 4.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M17 8.5v5M14.5 11h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] text-bone-50 font-medium mb-1">
                记录一个身边的人
              </div>
              <p className="text-[12.5px] text-bone-400 leading-relaxed">
                从具体行为出发，逐步拼出 TA 的真实动机
              </p>
            </div>
            <Arrow />
          </div>
        </Link>
      </div>

      {/* ── 空态 ── */}
      {items.length === 0 && (
        <div className="surface p-8 md:p-12 text-center rise" style={{ animationDelay: "120ms" }}>
          <div className="w-14 h-14 mx-auto mb-5 rounded-full border border-white/10 flex items-center justify-center breathe">
            <span className="w-2 h-2 rounded-full bg-amber/70" />
          </div>
          <h2 className="font-display text-[19px] text-bone-100 mb-2">
            从第一个开始
          </h2>
          <p className="text-[13px] text-bone-500 leading-relaxed max-w-sm mx-auto">
            挑一个你真正想弄懂的人——无论是历史里的，还是此刻让你困惑的那位。
            给出的细节越具体，研判就越接近真实。
          </p>
        </div>
      )}

      {/* ── 最近研判 ── */}
      {recent.length > 0 && (
        <section className="mb-8">
          <SectionLabel label="最近研判" />
          <div className="space-y-2.5">
            {recent.map((c, i) => (
              <RecentCard
                key={c.id}
                item={c}
                onDelete={() => handleRemove(c.id, c.name)}
                delay={i * 50}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── 完整文库 ── */}
      {rest.length > 0 && (
        <section>
          <div className="flex items-center justify-between gap-3 mb-3">
            <SectionLabel label="全部档案" inline />
            <div className="flex gap-1.5">
              {(
                [
                  ["all", "全部"],
                  ["USER_BUILT", "身边人"],
                  ["WEB", "公众"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`px-3 py-1.5 rounded-lg text-[12px] transition-colors ${
                    filter === key
                      ? "bg-white/[0.09] text-bone-50"
                      : "text-bone-500 hover:text-bone-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {items.length > 4 && (
            <div className="relative mb-3">
              <SearchIcon />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索姓名或结论关键词"
                className="field pl-11"
              />
            </div>
          )}

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((c) => (
              <SmallCard key={c.id} item={c} onDelete={() => handleRemove(c.id, c.name)} />
            ))}
          </div>

          {relationships.length > 0 && (
            <p className="text-[11px] text-bone-600 mt-4">
              共 {relationships.length} 种关系类型：{relationships.join(" · ")}
            </p>
          )}
        </section>
      )}

      {filtered.length === 0 && items.length > 0 && (
        <div className="surface p-10 text-center">
          <p className="text-[13px] text-bone-400">没有匹配的档案</p>
          <button
            onClick={() => {
              setQuery("");
              setFilter("all");
            }}
            className="text-[12px] text-amber/80 mt-2"
          >
            清除筛选
          </button>
        </div>
      )}
    </div>
  );
}

/* ══════════════ 卡片 ══════════════ */

function RecentCard({
  item,
  onDelete,
  delay,
}: {
  item: CharacterItem;
  onDelete: () => void;
  delay: number;
}) {
  const info = parse(item.basicInfo);
  const measured = measuredCount(item.traits);

  return (
    <div className="relative rise group" style={{ animationDelay: `${delay}ms` }}>
      <Link
        href={`/character/${item.id}`}
        className="surface p-4 md:p-5 press block hover:border-white/[0.12] transition-colors"
      >
        <div className="flex items-start gap-3.5">
          <Avatar item={item} size={44} />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[15px] text-bone-50 font-medium truncate">
                {item.name}
              </h3>
              {info?.relationship && (
                <span className="chip chip-jade text-[10px] py-0.5">
                  {info.relationship}
                </span>
              )}
              <span className="text-[10px] text-bone-600">
                {item.source === "WEB" ? "公众人物" : "身边人"}
              </span>
            </div>

            {item.personalitySummary ? (
              <p className="text-[13px] text-bone-300 leading-[1.7] mt-1.5 line-clamp-2">
                {item.personalitySummary}
              </p>
            ) : (
              <p className="text-[12px] text-bone-600 mt-1.5">
                尚无结论
              </p>
            )}

            <div className="flex items-center gap-3 mt-2.5">
              <MiniTraits traits={item.traits} />
              <span className="text-[10px] text-bone-600 ml-auto shrink-0">
                {formatDate(item.updatedAt || item.createdAt)}
              </span>
            </div>

            {measured === 0 && (
              <div className="mt-2 text-[11px] text-amber/70">
                尚未完成有效研判
              </div>
            )}
          </div>
        </div>
      </Link>

      <button
        onClick={(e) => {
          e.preventDefault();
          onDelete();
        }}
        className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full text-bone-600 hover:text-rose hover:bg-rose/10 transition-colors md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
        aria-label={`删除 ${item.name}`}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path d="M5 7h14M9 7V5h6v2M7 7l1 12h8l1-12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

function SmallCard({
  item,
  onDelete,
}: {
  item: CharacterItem;
  onDelete: () => void;
}) {
  const info = parse(item.basicInfo);

  return (
    <div className="relative group">
      <Link
        href={`/character/${item.id}`}
        className="surface p-4 press block h-full hover:border-white/[0.12] transition-colors"
      >
        <div className="flex items-start gap-3">
          <Avatar item={item} size={34} />
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] text-bone-100 font-medium truncate">
              {item.name}
            </div>
            <div className="text-[11px] text-bone-600 truncate mt-0.5">
              {info?.relationship || (item.source === "WEB" ? "公众人物" : "身边人")}
            </div>
          </div>
        </div>

        {item.personalitySummary && (
          <p className="text-[12px] text-bone-400 leading-[1.65] mt-2.5 line-clamp-2">
            {item.personalitySummary}
          </p>
        )}

        <div className="mt-3">
          <MiniTraits traits={item.traits} />
        </div>
      </Link>

      <button
        onClick={(e) => {
          e.preventDefault();
          onDelete();
        }}
        className="absolute top-2.5 right-2.5 w-8 h-8 flex items-center justify-center rounded-full text-bone-600 hover:text-rose hover:bg-rose/10 transition-all md:opacity-0 md:group-hover:opacity-100"
        aria-label={`删除 ${item.name}`}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <path d="M5 7h14M9 7V5h6v2M7 7l1 12h8l1-12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

/** 用极简的九段条表现人格轮廓，比"标签"更能传达形状 */
function MiniTraits({ traits }: { traits: any }) {
  const arr = parseTraits(traits);
  if (arr.length === 0) return null;

  const ordered = [
    "OPENNESS",
    "CONSCIENTIOUSNESS",
    "EXTRAVERSION",
    "AGREEABLENESS",
    "NEUROTICISM",
    "DECISIVENESS",
    "RISK_TENDENCY",
    "EMPATHY",
    "LEADERSHIP",
  ];

  return (
    <div className="flex items-end gap-[3px] h-5" aria-hidden>
      {ordered.map((code) => {
        const t = arr.find((x: any) => x.code === code);
        const measured = t && t.measured !== false && (t.confidence ?? 0) >= 30;
        const h = measured ? Math.max(3, ((t.score ?? 0) / 100) * 20) : 2;
        return (
          <span
            key={code}
            className="w-[3px] rounded-full"
            style={{
              height: h,
              background: measured
                ? "rgba(217,167,92,0.75)"
                : "rgba(255,255,255,0.1)",
            }}
          />
        );
      })}
    </div>
  );
}

function Avatar({ item, size }: { item: CharacterItem; size: number }) {
  const valid =
    item.portraitUrl && !item.portraitUrl.includes("dicebear.com");

  if (valid) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.portraitUrl!}
        alt=""
        className="rounded-xl object-cover shrink-0 border border-white/10"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="rounded-xl shrink-0 flex items-center justify-center border border-white/10 bg-ink-750 text-bone-200"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      <span className="font-display">{item.name.charAt(0)}</span>
    </div>
  );
}

function SectionLabel({ label, inline }: { label: string; inline?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 ${inline ? "" : "mb-3"}`}>
      <span className="text-[11px] tracking-[0.2em] uppercase text-bone-500">
        {label}
      </span>
      {!inline && <div className="flex-1 h-px bg-white/[0.06]" />}
    </div>
  );
}

function Arrow() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      className="text-bone-600 group-hover:text-amber transition-colors shrink-0 mt-1"
      aria-hidden
    >
      <path d="M7 17 17 7M9 7h8v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      className="absolute left-4 top-1/2 -translate-y-1/2 text-bone-600 pointer-events-none"
    >
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function LoadingSkeleton() {
  return (
    <div className="shell pt-10 space-y-4">
      <div className="h-8 w-48 rounded-lg bg-white/[0.04] animate-pulse" />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="h-24 rounded-2xl bg-white/[0.03] animate-pulse" />
        <div className="h-24 rounded-2xl bg-white/[0.03] animate-pulse" />
      </div>
      <div className="space-y-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-white/[0.025] animate-pulse" />
        ))}
      </div>
    </div>
  );
}

/* ── 工具 ── */

function parse(v: any) {
  if (!v) return null;
  if (typeof v === "object") return v;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function parseTraits(v: any): any[] {
  const parsed = parse(v);
  return Array.isArray(parsed) ? parsed : [];
}

function measuredCount(v: any): number {
  return parseTraits(v).filter(
    (t: any) => t.measured !== false && (t.confidence ?? 0) >= 30
  ).length;
}

function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 86400000;
  if (diff < 1) return "今天";
  if (diff < 2) return "昨天";
  if (diff < 30) return `${Math.floor(diff)} 天前`;
  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}
