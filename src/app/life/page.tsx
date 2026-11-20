"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";
import { httpGet, httpPost } from "@/lib/http";
import type { KnowledgeCoverage } from "@/lib/knowledge/types";
import { SubPageHeader } from "@/components/me/SubPageHeader";
import type { Calibration, LifeSim } from "@/lib/life/types";

/**
 * 模拟人生 —— 列表与新建
 *
 * 这里的核心不是"好玩"，而是：把「知识库 → 推演 → 回填 → 校准」跑成一个闭环。
 * 所以每个卡片都要显示：走到第几步、依据充分度、已结算的预测准不准。
 */

const FOCUSES = ["工作", "感情", "家庭", "金钱", "健康", "自我", "综合"];
const HORIZONS = ["3个月", "1年", "3年"];

export default function LifePage() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();

  const [sims, setSims] = useState<LifeSim[]>([]);
  const [coverage, setCoverage] = useState<KnowledgeCoverage | null>(null);
  const [calibration, setCalibration] = useState<Calibration | null>(null);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [premise, setPremise] = useState("");
  const [focus, setFocus] = useState("综合");
  const [horizon, setHorizon] = useState("1年");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    load();
  }, []);

  async function load() {
    try {
      const data = await httpGet<any>("/api/life");
      setSims(data.sims || []);
      setCoverage(data.coverage || null);
      setCalibration(data.calibration || null);
    } catch {
      // 未登录或表未初始化时不阻塞页面
    } finally {
      setLoading(false);
    }
  }

  async function create() {
    if (!premise.trim() || creating) return;
    setError("");
    setCreating(true);
    try {
      const data = await httpPost<any>("/api/life", {
        title,
        premise,
        focus,
        horizon,
      });
      if (data?.sim?.id) {
        router.push(`/life/sim?id=${data.sim.id}`);
      } else {
        setOpen(false);
        setTitle("");
        setPremise("");
        await load();
      }
    } catch (e: any) {
      setError(e.message || "创建失败");
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="shell pt-12">
        <div className="h-24 rounded-3xl bg-[var(--glass-2)] animate-pulse" />
      </div>
    );
  }

  const score = coverage?.score ?? 0;

  return (
    <div className="shell pt-6 md:pt-10 pb-10 max-w-2xl">
      <SubPageHeader
        title="模拟人生"
        en="Branch"
        desc="把一个处境拆成几条可能的路，给每条一个概率和可观察的信号。依据来自你的知识库——写得越多，概率越像你的，而不是像统计学。"
      />

      {/* ── 依据状态 ── */}
      <div className="surface p-4 mb-4 rise">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[12.5px] text-bone-200">依据充分度</div>
            <div className="text-[11px] text-bone-500 mt-0.5 truncate">
              {coverage?.entries || 0} 条记录
              {coverage?.missing?.length
                ? ` · 缺：${coverage.missing.slice(0, 2).join("、")}`
                : " · 生活面覆盖完整"}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="numeral text-[20px] text-bone-50">{score}</span>
            <Link
              href="/me/knowledge"
              className="text-[11.5px] text-bone-400 hover:text-bone-100 px-2 py-1"
            >
              补充 →
            </Link>
          </div>
        </div>
        <div className="h-1 rounded-full bg-[var(--chip-bg)] overflow-hidden mt-3">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${score}%`,
              background: "linear-gradient(90deg, #5ef0e0, #8b5cf6)",
            }}
          />
        </div>
        {calibration && calibration.resolved > 0 && (
          <p className="text-[11px] text-bone-500 mt-3">
            已回填 {calibration.resolved} 次预测，命中 {calibration.hits} 次
            {calibration.score !== null && ` · 校准分 ${calibration.score}`}
          </p>
        )}
      </div>

      {/* ── 新建 ── */}
      {!open ? (
        <button onClick={() => setOpen(true)} className="btn-primary w-full mb-8">
          ＋ 开始一次推演
        </button>
      ) : (
        <div className="surface-raised p-5 space-y-3 mb-8 rise">
          <div>
            <label className="text-[11px] tracking-[0.16em] uppercase text-bone-500 block mb-2">
              现在卡在哪
            </label>
            <textarea
              value={premise}
              onChange={(e) => setPremise(e.target.value)}
              rows={5}
              placeholder="比如：在一家公司做了四年运营，最近每天上班都很抵触，但辞职又怕断了收入。手上有二十万存款，没有房贷。"
              className="field"
            />
          </div>

          <div>
            <label className="text-[11px] tracking-[0.16em] uppercase text-bone-500 block mb-2">
              关注方向
            </label>
            <div className="flex flex-wrap gap-1.5">
              {FOCUSES.map((f) => (
                <button
                  key={f}
                  onClick={() => setFocus(f)}
                  className={`chip press ${focus === f ? "text-bone-50" : ""}`}
                  style={
                    focus === f
                      ? {
                          background:
                            "linear-gradient(135deg, rgba(94,240,224,0.18), rgba(139,92,246,0.14))",
                          borderColor: "rgba(94,240,224,0.3)",
                        }
                      : undefined
                  }
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] tracking-[0.16em] uppercase text-bone-500 block mb-2">
              推演到多久之后
            </label>
            <div className="flex gap-1.5">
              {HORIZONS.map((h) => (
                <button
                  key={h}
                  onClick={() => setHorizon(h)}
                  className={`chip press ${horizon === h ? "text-bone-50" : ""}`}
                  style={
                    horizon === h
                      ? {
                          background:
                            "linear-gradient(135deg, rgba(94,240,224,0.18), rgba(139,92,246,0.14))",
                          borderColor: "rgba(94,240,224,0.3)",
                        }
                      : undefined
                  }
                >
                  {h}
                </button>
              ))}
            </div>
          </div>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="给这次推演起个名字（可空）"
            className="field"
          />

          {error && <p className="text-[12px] text-rose">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={create}
              disabled={premise.trim().length < 8 || creating}
              className="btn-primary flex-1"
            >
              {creating ? "正在推演……" : "开始推演"}
            </button>
            <button
              onClick={() => {
                setOpen(false);
                setError("");
              }}
              className="btn-ghost px-5"
            >
              取消
            </button>
          </div>
          {creating && (
            <p className="text-[11.5px] text-bone-500 text-center">
              正在读取知识库、拆解可能的分岔口，通常需要 10–30 秒
            </p>
          )}
        </div>
      )}

      {/* ── 列表 ── */}
      {sims.length > 0 ? (
        <div className="space-y-2">
          {sims.map((s) => {
            const node = s.nodes[s.nodes.length - 1];
            return (
              <Link
                key={s.id}
                href={`/life/sim?id=${s.id}`}
                className="surface p-4 block press"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] text-bone-50 truncate">
                      {s.title}
                    </div>
                    <div className="text-[11px] text-bone-600 mt-1 truncate">
                      {s.focus} · {s.horizon} · 第 {s.nodes.length} 步
                      {node ? ` · ${node.branches.length} 条分支` : ""}
                    </div>
                    {node && (
                      <p className="text-[12px] text-bone-400 mt-2 line-clamp-2 leading-relaxed">
                        {node.situation}
                      </p>
                    )}
                  </div>
                  <span className="chip shrink-0">
                    {s.status === "done" ? "已结束" : `依据 ${s.coverage}`}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        !open && (
          <div className="text-center py-10">
            <p className="text-[12.5px] text-bone-500 leading-relaxed">
              还没有推演。
              <br />
              从一个正在纠结的处境开始最合适。
            </p>
          </div>
        )
      )}
    </div>
  );
}
