"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";
import { useQueryParam } from "@/lib/useQueryParam";
import { httpGet, httpPost, httpDelete } from "@/lib/http";
import {
  BASIS_LABEL,
  type Calibration,
  type LifeNode,
  type LifeSim,
} from "@/lib/life/types";

/**
 * 模拟人生 —— 单次推演
 *
 * 页面结构刻意做成"时间线"：
 * 走过的每一步留在上面，当前这一步在下面等你决定。
 * 每一步都能回填"实际发生了什么"，这是校准分数的唯一来源。
 */

export default function LifeSimPage() {
  // 静态导出后路径里不能带动态段，改为 ?id= 读取
  const simId = useQueryParam("id");
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  const [sim, setSim] = useState<LifeSim | null>(null);
  const [calibration, setCalibration] = useState<Calibration | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [selected, setSelected] = useState<string | null>(null);
  const [actual, setActual] = useState("");

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    if (simId) load();
  }, [simId]);

  async function load() {
    if (!simId) return;
    try {
      const data = await httpGet<any>(`/api/life/${simId}`);
      setSim(data.sim);
      setCalibration(data.calibration || null);
    } catch (e: any) {
      setError(e.message || "加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function choose(branchId: string) {
    if (!sim || busy) return;
    setError("");
    setBusy(true);
    try {
      const data = await httpPost<any>(`/api/life/${sim.id}`, {
        action: "choose",
        branchId,
        actual: actual.trim() || undefined,
      });
      setSim(data.sim);
      setCalibration(data.calibration || null);
      setSelected(null);
      setActual("");
      // 新节点在时间线底部，回到顶部会让人以为没反应
      requestAnimationFrame(() => {
        document
          .getElementById("life-now")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (e: any) {
      setError(e.message || "推演失败");
    } finally {
      setBusy(false);
    }
  }

  async function resolve(nodeId: string, branchId: string, hit: boolean) {
    if (!sim || busy) return;
    setBusy(true);
    try {
      const data = await httpPost<any>(`/api/life/${sim.id}`, {
        action: "resolve",
        nodeId,
        branchId,
        hit,
      });
      setSim(data.sim);
      setCalibration(data.calibration || null);
    } catch (e: any) {
      setError(e.message || "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!sim) return;
    if (!confirm("删除这次推演？不可恢复。")) return;
    try {
      await httpDelete(`/api/life/${sim.id}`);
      router.push("/life");
    } catch (e: any) {
      setError(e.message || "删除失败");
    }
  }

  const nodes = sim?.nodes || [];
  const current = nodes[nodes.length - 1] || null;
  const history = useMemo(() => nodes.slice(0, -1), [nodes]);
  const currentIsOpen = Boolean(current && !current.choice);

  if (loading) {
    return (
      <div className="shell pt-12">
        <div className="h-28 rounded-3xl bg-[var(--glass-2)] animate-pulse" />
      </div>
    );
  }

  if (!sim || !current) {
    return (
      <div className="shell pt-12 text-center">
        <p className="text-[13px] text-bone-400 mb-4">{error || "推演不存在"}</p>
        <Link href="/life" className="btn-ghost inline-flex">
          返回
        </Link>
      </div>
    );
  }

  return (
    <div className="shell pt-6 md:pt-10 pb-24 max-w-2xl">
      {/* ── 顶部 ── */}
      <header className="mb-5 rise">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <Link
                href="/life"
                className="text-[11.5px] text-bone-500 hover:text-bone-100"
              >
                ← 模拟人生
              </Link>
              <span className="text-[10px] text-bone-700">
                第 {nodes.length} 步
              </span>
            </div>
            <h1 className="font-display text-[21px] text-bone-50 leading-tight">
              {sim.title}
            </h1>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="chip">{sim.focus}</span>
              <span className="chip">{sim.horizon}</span>
              <span className="chip">依据 {sim.coverage}</span>
              {calibration && calibration.resolved > 0 && (
                <span className="chip">
                  校准 {calibration.score}
                  <span className="opacity-50 ml-1">
                    {calibration.hits}/{calibration.resolved}
                  </span>
                </span>
              )}
            </div>
          </div>
          <button
            onClick={remove}
            className="text-[11.5px] text-bone-600 hover:text-rose px-2 py-1 shrink-0"
          >
            删除
          </button>
        </div>
      </header>

      {/* ── 原始处境 ── */}
      <details className="surface p-4 mb-5 rise">
        <summary className="text-[12px] text-bone-400 cursor-pointer select-none">
          最初的处境
        </summary>
        <p className="text-[12.5px] text-bone-300 leading-[1.8] mt-3 whitespace-pre-wrap">
          {sim.premise}
        </p>
      </details>

      {/* ── 历史节点 ── */}
      {history.length > 0 && (
        <div className="space-y-2 mb-6">
          {history.map((n, i) => (
            <HistoryNode
              key={n.id}
              node={n}
              index={i + 1}
              busy={busy}
              onResolve={resolve}
            />
          ))}
        </div>
      )}

      {/* ── 当前节点 ── */}
      <div id="life-now" className="surface-raised p-5 mb-4 rise">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-[#5ef0e0] shadow-[0_0_8px_#5ef0e0]" />
          <span className="text-[10px] uppercase tracking-[0.22em] text-bone-500">
            此刻
          </span>
        </div>

        <p className="text-[14px] text-bone-50 leading-[1.85] whitespace-pre-wrap">
          {current.situation}
        </p>

        <div className="mt-4 pt-4 border-t border-[var(--hairline)]">
          <div className="text-[10px] uppercase tracking-[0.2em] text-bone-600 mb-1.5">
            要决定的
          </div>
          <p className="text-[13.5px] text-bone-100 leading-relaxed">
            {current.question}
          </p>
        </div>

        {current.readOfYou && (
          <div className="mt-4 rounded-2xl p-3.5 bg-[var(--chip-bg)]">
            <div className="text-[10px] uppercase tracking-[0.2em] text-bone-600 mb-1.5">
              基于你的知识库
            </div>
            <p className="text-[12.5px] text-bone-300 leading-[1.8]">
              {current.readOfYou}
            </p>
          </div>
        )}

        {current.unknowns.length > 0 && (
          <div className="mt-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-bone-600 mb-1.5">
              还不知道的
            </div>
            <ul className="space-y-1">
              {current.unknowns.map((u, i) => (
                <li key={i} className="text-[12px] text-bone-500 leading-relaxed flex gap-2">
                  <span className="text-bone-700 shrink-0">?</span>
                  <span>{u}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── 分支 ── */}
      <div className="space-y-2.5">
        {current.branches.map((b) => {
          const isSelected = selected === b.id;
          return (
            <button
              key={b.id}
              onClick={() => currentIsOpen && !busy && setSelected(isSelected ? null : b.id)}
              disabled={!currentIsOpen}
              className="w-full text-left surface p-4 press disabled:opacity-70"
              style={
                isSelected
                  ? {
                      borderColor: "rgba(94,240,224,0.45)",
                      boxShadow: "0 0 0 1px rgba(94,240,224,0.18)",
                    }
                  : undefined
              }
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] text-bone-50 leading-snug">
                    {b.label}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="numeral text-[17px] text-bone-50">
                    {b.probability}
                  </span>
                  <span className="text-[10px] text-bone-600 ml-0.5">%</span>
                </div>
              </div>

              <div className="h-1 rounded-full bg-[var(--chip-bg)] overflow-hidden mt-2.5">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${b.probability}%`,
                    background:
                      b.basis === "knowledge"
                        ? "linear-gradient(90deg, #5ef0e0, #8b5cf6)"
                        : b.basis === "general"
                        ? "linear-gradient(90deg, rgba(148,163,184,0.9), rgba(100,116,139,0.9))"
                        : "rgba(120,120,140,0.5)",
                  }}
                />
              </div>

              <p className="text-[12.5px] text-bone-300 leading-[1.75] mt-3 whitespace-pre-wrap">
                {b.outcome}
              </p>

              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                <span
                  className="chip"
                  style={
                    b.basis === "knowledge"
                      ? { borderColor: "rgba(94,240,224,0.28)" }
                      : undefined
                  }
                >
                  {BASIS_LABEL[b.basis]}
                </span>
                {b.refs.map((r) => (
                  <span key={r} className="text-[10px] text-bone-600">
                    [{r}]
                  </span>
                ))}
              </div>

              {b.signals.length > 0 && (
                <div className="mt-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-bone-600 mb-1">
                    怎么看出它在成真
                  </div>
                  <ul className="space-y-1">
                    {b.signals.map((s, i) => (
                      <li
                        key={i}
                        className="text-[11.5px] text-bone-400 leading-relaxed flex gap-2"
                      >
                        <span className="text-bone-700 shrink-0">·</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {b.ifWrong && (
                <p className="text-[11.5px] text-bone-600 leading-relaxed mt-2.5">
                  如果没这样：{b.ifWrong}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {error && <p className="text-[12px] text-rose mt-3">{error}</p>}

      {/* ── 确认 ── */}
      {currentIsOpen && (
        <div className="mt-5 space-y-3">
          <textarea
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            rows={3}
            placeholder="可选：实际发生的事和你预想的不一样？写下来，推演会更准。"
            className="field"
          />
          <button
            onClick={() => selected && choose(selected)}
            disabled={!selected || busy}
            className="btn-primary w-full"
          >
            {busy ? "正在推演下一步……" : "就走这条，看后面"}
          </button>
          {busy && (
            <p className="text-[11.5px] text-bone-500 text-center">
              正在重新读取知识库并推演
            </p>
          )}
        </div>
      )}

      {!currentIsOpen && current.choice && (
        <div className="surface p-4 mt-5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-bone-600 mb-2">
            这一步你选的是
          </div>
          <p className="text-[13px] text-bone-100">
            {current.branches.find((b) => b.id === current.choice!.branchId)?.label ||
              "（选项已不可用）"}
          </p>
          {current.choice.actual && (
            <p className="text-[12px] text-bone-400 mt-2 leading-relaxed">
              实际：{current.choice.actual}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── 已完成的历史节点 ── */
function HistoryNode({
  node,
  index,
  busy,
  onResolve,
}: {
  node: LifeNode;
  index: number;
  busy: boolean;
  onResolve: (nodeId: string, branchId: string, hit: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const branch = node.branches.find((b) => b.id === node.choice?.branchId);

  return (
    <div className="surface p-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-bone-700 numeral">{index}</span>
          <span className="text-[12px] text-bone-300 flex-1 truncate">
            {branch?.label || "（未记录选择）"}
          </span>
          {node.choice?.hit === true && (
            <span className="text-[10px] text-[#5ef0e0]">应验</span>
          )}
          {node.choice?.hit === false && (
            <span className="text-[10px] text-bone-600">未应验</span>
          )}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            className={`text-bone-700 transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path
              d="m6 9 6 6 6-6"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p className="text-[11.5px] text-bone-500 mt-1.5 line-clamp-2 leading-relaxed">
          {node.situation}
        </p>
      </button>

      {open && (
        <div className="mt-3 pt-3 border-t border-[var(--hairline)] space-y-3">
          <p className="text-[12.5px] text-bone-300 leading-[1.8] whitespace-pre-wrap">
            {node.situation}
          </p>
          {branch && (
            <div className="rounded-2xl p-3 bg-[var(--chip-bg)]">
              <div className="text-[10px] uppercase tracking-[0.16em] text-bone-600 mb-1">
                当时对这条路的推断（{branch.probability}%）
              </div>
              <p className="text-[12px] text-bone-300 leading-[1.75]">
                {branch.outcome}
              </p>
            </div>
          )}

          {node.choice && (
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-bone-600 mb-1.5">
                实际结果如何
              </div>
              {typeof node.choice.hit === "boolean" ? (
                <p className="text-[12px] text-bone-400">
                  {node.choice.hit ? "应验了" : "没有应验"}
                  {node.choice.actual ? ` · ${node.choice.actual}` : ""}
                </p>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => onResolve(node.id, node.choice!.branchId, true)}
                    disabled={busy}
                    className="btn-ghost flex-1 text-[12px]"
                  >
                    应验了
                  </button>
                  <button
                    onClick={() => onResolve(node.id, node.choice!.branchId, false)}
                    disabled={busy}
                    className="btn-ghost flex-1 text-[12px]"
                  >
                    没有
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
