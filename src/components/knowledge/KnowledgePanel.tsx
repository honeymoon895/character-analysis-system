"use client";

import { useEffect, useMemo, useState } from "react";
import { httpGet, httpPost, httpDelete, httpPatch } from "@/lib/http";
import {
  MEMORY_KINDS,
  MEMORY_KIND_MAP,
  type KnowledgeCoverage,
  type MemoryEntry,
} from "@/lib/knowledge/types";

/**
 * 知识库
 *
 * 定位在「我的」里面，因为它是关于"我"的原料仓库。
 * 交互原则：录入必须够快（随手写、可选类型），但也要够结构（类型 / 标签 / 重要度），
 * 因为后面「模拟人生」的推演质量直接取决于这里的颗粒度。
 */

export function KnowledgePanel() {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [coverage, setCoverage] = useState<KnowledgeCoverage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // 录入
  const [composerOpen, setComposerOpen] = useState(false);
  const [kind, setKind] = useState("diary");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");

  // 编辑
  const [editing, setEditing] = useState<MemoryEntry | null>(null);
  const [editContent, setEditContent] = useState("");

  // 浏览
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const data = await httpGet<any>("/api/memory");
      setEntries(data.entries || []);
      setCoverage(data.coverage || null);
    } catch (e: any) {
      setError(e.message || "加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    const text = content.trim();
    if (!text || saving) return;
    setError("");
    setSaving(true);
    try {
      const data = await httpPost<any>("/api/memory", {
        kind,
        title,
        content: text,
        tags,
      });
      setEntries(data.entries || []);
      setCoverage(data.coverage || null);
      setContent("");
      setTitle("");
      setTags("");
      setComposerOpen(false);
    } catch (e: any) {
      setError(e.message || "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    try {
      const data = await httpPatch<any>(`/api/memory/${editing.id}`, {
        content: editContent,
      });
      setEntries(data.entries || []);
      setCoverage(data.coverage || null);
      setEditing(null);
    } catch (e: any) {
      setError(e.message || "更新失败");
    }
  }

  async function remove(id: string) {
    if (!confirm("删除这条记录？")) return;
    try {
      const data = await httpDelete<any>(`/api/memory/${id}`);
      setEntries(data.entries || []);
      setCoverage(data.coverage || null);
    } catch (e: any) {
      setError(e.message || "删除失败");
    }
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...entries]
      .reverse()
      .filter((e) => (filter === "all" ? true : e.kind === filter))
      .filter((e) => {
        if (!q) return true;
        const hay = `${e.title || ""} ${e.content} ${e.tags.join(" ")}`.toLowerCase();
        return hay.includes(q);
      });
  }, [entries, query, filter]);

  const usedKinds = useMemo(() => {
    const set = new Set(entries.map((e) => e.kind));
    return MEMORY_KINDS.filter((k) => set.has(k.id));
  }, [entries]);

  if (loading) {
    return <div className="h-24 rounded-3xl bg-[var(--glass-2)] animate-pulse" />;
  }

  return (
    <div className="space-y-5">
      {/* ── 依据充分度 ── */}
      <div className="surface-raised p-5">
        <div className="flex items-end justify-between mb-3">
          <div>
            <h2 className="font-display text-[17px] text-bone-50">依据充分度</h2>
            <p className="text-[11.5px] text-bone-500 mt-1">
              不是"AI 有多准"，而是"我对你了解多少"
            </p>
          </div>
          <div className="text-right">
            <span className="numeral text-[26px] text-bone-50">
              {coverage?.score ?? 0}
            </span>
            <span className="text-[11px] text-bone-600 ml-1">/100</span>
          </div>
        </div>

        <div className="h-1.5 rounded-full bg-[var(--chip-bg)] overflow-hidden mb-4">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${coverage?.score ?? 0}%`,
              background: "linear-gradient(90deg, #5ef0e0, #8b5cf6)",
            }}
          />
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {(coverage?.domains || []).map((d) => (
            <span
              key={d.key}
              className="chip"
              style={
                d.covered
                  ? { borderColor: "rgba(94,240,224,0.28)" }
                  : { opacity: 0.42 }
              }
              title={d.covered ? `${d.count} 条记录` : "还没有记录"}
            >
              {d.covered ? "· " : "○ "}
              {d.label}
            </span>
          ))}
        </div>

        {coverage && coverage.suggestions.length > 0 && (
          <ul className="space-y-1.5">
            {coverage.suggestions.map((s, i) => (
              <li key={i} className="text-[12px] text-bone-400 leading-relaxed flex gap-2">
                <span className="text-bone-600 shrink-0">—</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── 录入 ── */}
      {!composerOpen ? (
        <button
          onClick={() => setComposerOpen(true)}
          className="btn-primary w-full"
        >
          ＋ 记录一条
        </button>
      ) : (
        <div className="surface-raised p-5 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {MEMORY_KINDS.map((k) => (
              <button
                key={k.id}
                onClick={() => setKind(k.id)}
                className={`chip press ${kind === k.id ? "text-bone-50" : ""}`}
                style={
                  kind === k.id
                    ? {
                        background:
                          "linear-gradient(135deg, rgba(94,240,224,0.18), rgba(139,92,246,0.14))",
                        borderColor: "rgba(94,240,224,0.3)",
                      }
                    : undefined
                }
                title={k.hint}
              >
                {k.label}
              </button>
            ))}
          </div>
          <p className="text-[11.5px] text-bone-600 -mt-1">
            {MEMORY_KINDS.find((k) => k.id === kind)?.hint}
          </p>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="标题（可空）"
            className="field"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            placeholder="写具体：什么情境、你怎么反应、事后怎么想、结果如何。"
            className="field"
          />
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="标签，空格分隔：工作 焦虑 妈妈"
            className="field"
          />
          {error && <p className="text-[12px] text-rose">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={!content.trim() || saving}
              className="btn-primary flex-1"
            >
              {saving ? "保存中……" : "存入知识库"}
            </button>
            <button
              onClick={() => {
                setComposerOpen(false);
                setError("");
              }}
              className="btn-ghost px-5"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* ── 检索 ── */}
      {entries.length > 0 && (
        <div className="space-y-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索记录、标签……"
            className="field"
          />
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setFilter("all")}
              className={`chip shrink-0 press ${filter === "all" ? "text-bone-50" : ""}`}
            >
              全部 {entries.length}
            </button>
            {usedKinds.map((k) => (
              <button
                key={k.id}
                onClick={() => setFilter(k.id)}
                className={`chip shrink-0 press ${filter === k.id ? "text-bone-50" : ""}`}
              >
                {k.label}{" "}
                {entries.filter((e) => e.kind === k.id).length}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 列表 ── */}
      <div className="space-y-2">
        {visible.map((e) => (
          <div key={e.id} className="surface p-4 group">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] uppercase tracking-[0.16em] text-bone-600">
                {MEMORY_KIND_MAP[e.kind]?.label || "记录"}
              </span>
              <span className="text-[10px] text-bone-700">
                {(e.occurredAt || e.createdAt).slice(0, 10)}
              </span>
              <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => {
                    setEditing(e);
                    setEditContent(e.content);
                  }}
                  className="text-[11px] text-bone-500 hover:text-bone-100 px-2 py-1"
                >
                  编辑
                </button>
                <button
                  onClick={() => remove(e.id)}
                  className="text-[11px] text-bone-600 hover:text-rose px-2 py-1"
                >
                  删除
                </button>
              </div>
            </div>

            {e.title && (
              <div className="text-[13.5px] text-bone-50 mb-1">{e.title}</div>
            )}
            <p className="text-[13px] text-bone-200 leading-[1.75] whitespace-pre-wrap">
              {e.content}
            </p>
            {e.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {e.tags.map((t) => (
                  <span key={t} className="text-[10.5px] text-bone-600">
                    #{t}
                  </span>
                ))}
              </div>
            )}

            {editing?.id === e.id && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={editContent}
                  onChange={(ev) => setEditContent(ev.target.value)}
                  rows={4}
                  className="field"
                />
                <div className="flex gap-2">
                  <button onClick={saveEdit} className="btn-primary flex-1">
                    保存
                  </button>
                  <button
                    onClick={() => setEditing(null)}
                    className="btn-ghost px-5"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {entries.length === 0 && (
          <p className="text-[12.5px] text-bone-500 text-center py-6 leading-relaxed">
            还没有记录。
            <br />
            知识库越具体，「模拟人生」推出来的概率才越有依据。
          </p>
        )}

        {entries.length > 0 && visible.length === 0 && (
          <p className="text-[12.5px] text-bone-500 text-center py-6">
            没有匹配的记录
          </p>
        )}
      </div>

      {error && !composerOpen && (
        <p className="text-[12px] text-rose">{error}</p>
      )}
    </div>
  );
}
