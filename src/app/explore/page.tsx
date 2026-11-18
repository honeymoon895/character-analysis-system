"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { httpPost } from "@/lib/http";

/**
 * 研判入口
 *
 * 两个模式并列呈现，不藏在二级菜单里：
 * - 公众人物：输入姓名即可
 * - 身边的人：结构化访谈，从具体行为而不是印象出发
 *
 * 设计取舍：不用弹窗。弹窗在移动端会遮挡键盘、压缩可视区域，
 * 且关闭后丢失进度。改为独立页面 + 分步进度，返回可续。
 */

const PUBLIC_SUGGESTIONS = [
  { name: "曹操", hint: "权谋与多疑并存" },
  { name: "诸葛亮", hint: "极度尽责下的自我消耗" },
  { name: "李白", hint: "高开放性、低约束" },
  { name: "苏轼", hint: "逆境中的心理弹性" },
  { name: "曾国藩", hint: "自律与自省" },
  { name: "张爱玲", hint: "高敏感与疏离" },
];

const RELATIONSHIPS = [
  "伴侣", "暧昧对象", "父母", "子女", "兄弟姐妹",
  "朋友", "同事", "上司", "下属", "前任", "其他",
];

const SCENES = ["日常相处", "工作中", "冲突时", "压力下", "开心时", "独处时"];

/** 引导用户给出"可观察的行为"，而不是"我感觉" */
const PROMPT_QUESTIONS = [
  {
    key: "concrete",
    label: "具体的一件事",
    placeholder:
      "描述一个具体场景：什么时候、发生了什么、TA 说了什么做了什么、你当时的反应。\n\n比如：上周五我提出周末一起吃饭，TA 说「再说吧」，然后那天晚上一直没回消息。",
  },
  {
    key: "repeated",
    label: "反复出现的模式",
    placeholder:
      "TA 在什么情况下会稳定地做出同一种反应？\n\n比如：每次我表达不满，TA 都不吵也不道歉，而是突然变得很忙。",
  },
  {
    key: "conflict",
    label: "让你困惑或受伤的部分",
    placeholder:
      "哪些时刻你觉得读不懂 TA？TA 做了什么让你难受？\n\n比如：TA 平时很体贴，但我一提未来，TA 就像变了个人。",
  },
  {
    key: "strength",
    label: "TA 身上你欣赏的部分",
    placeholder:
      "这能帮我们看见 TA 的资源和能力，避免只描绘缺陷。\n\n比如：TA 对朋友极其可靠，答应的事从不食言。",
  },
];

export default function ExplorePage() {
  return (
    <Suspense fallback={<div className="shell pt-10" />}>
      <ExploreContent />
    </Suspense>
  );
}

function ExploreContent() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const params = useSearchParams();

  const initialTab = params.get("tab") === "personal" ? "personal" : "public";
  const [tab, setTab] = useState<"public" | "personal">(initialTab);

  useEffect(() => {
    if (!isAuthenticated()) router.push("/login");
  }, []);

  return (
    <div className="shell pt-6 md:pt-10 pb-10 max-w-2xl">
      <header className="mb-6 rise">
        <div className="text-[11px] tracking-[0.22em] uppercase text-bone-500 mb-2">
          新建研判
        </div>
        <h1 className="font-display text-[26px] md:text-[32px] leading-tight text-bone-50">
          你想读懂谁？
        </h1>
        <p className="text-[13px] text-bone-400 mt-2 leading-relaxed">
          分析会给出可被推翻的推断，而不是一句放之四海皆准的性格描述。
        </p>
      </header>

      {/* ── 模式切换 ── */}
      <div className="flex gap-1 p-1 rounded-2xl bg-white/[0.035] border border-white/[0.06] mb-6 rise">
        {(
          [
            ["public", "公众人物"],
            ["personal", "身边的人"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 min-h-[44px] rounded-xl text-[13.5px] font-medium transition-all ${
              tab === key
                ? "bg-ink-750 text-bone-50 shadow-sm"
                : "text-bone-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "public" ? (
        <PublicForm />
      ) : (
        <PersonalForm onDone={(id) => router.push(`/character/${id}`)} />
      )}
    </div>
  );
}

/* ══════════════ 公众人物 ══════════════ */

function PublicForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState(0);

  const PHASES = [
    "检索公开史料……",
    "梳理关键事件与决策……",
    "推断动机与防御方式……",
    "交叉验证，剔除矛盾结论……",
    "生成可验证的预测……",
  ];

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setPhase((p) => (p + 1) % PHASES.length), 2600);
    return () => clearInterval(t);
  }, [loading]);

  async function submit(n?: string) {
    const target = (n ?? name).trim();
    if (!target || loading) return;
    setName(target);
    setError("");
    setLoading(true);

    try {
      const res = await httpPost("/api/character/analyze", { name: target });

      // 接口以 SSE 返回，需要读取流
      if (res instanceof Response) {
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let characterId: number | null = null;

        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (raw === "[DONE]") continue;
            try {
              const data = JSON.parse(raw);
              if (data.characterId) characterId = data.characterId;
            } catch {}
          }
        }

        if (characterId) {
          router.push(`/character/${characterId}`);
          return;
        }
      }
      setError("分析未能完成，请稍后重试");
    } catch (e: any) {
      setError(e.message || "分析失败");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="surface-raised p-7 text-center rise">
        <div className="w-16 h-16 mx-auto mb-6 relative">
          <div className="absolute inset-0 rounded-full border border-amber/20 breathe" />
          <div className="absolute inset-2 rounded-full border border-amber/30 breathe" style={{ animationDelay: "0.4s" }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-amber-bright" />
          </div>
        </div>
        <h3 className="font-display text-[18px] text-bone-50 mb-2">
          正在研判「{name}」
        </h3>
        <p className="text-[13px] text-bone-400 h-5 transition-opacity">
          {PHASES[phase]}
        </p>
        <p className="text-[11px] text-bone-600 mt-6 leading-relaxed">
          这通常需要 20-60 秒。分析越严格，耗时越长。
        </p>
      </div>
    );
  }

  return (
    <div className="rise">
      <div className="surface-raised p-5 md:p-6">
        <label className="block text-[13px] text-bone-300 mb-2.5">
          姓名
        </label>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="如：曹操、苏轼、某位企业家"
            className="field flex-1"
            autoFocus
          />
          <button
            onClick={() => submit()}
            disabled={!name.trim()}
            className="btn-primary shrink-0 px-5"
          >
            研判
          </button>
        </div>

        {error && (
          <div className="mt-3 text-[12px] text-rose bg-rose/[0.08] border border-rose/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <p className="text-[11px] text-bone-600 mt-3 leading-relaxed">
          将基于有据可查的公开记载分析。若史料不足，系统会明确标出「无法判断」，
          而不是编造结论。
        </p>
      </div>

      <div className="mt-6">
        <div className="text-[11px] tracking-[0.2em] uppercase text-bone-500 mb-3">
          试试这些
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {PUBLIC_SUGGESTIONS.map((s) => (
            <button
              key={s.name}
              onClick={() => submit(s.name)}
              className="surface p-3.5 text-left press hover:border-white/[0.12] transition-colors"
            >
              <div className="text-[13.5px] text-bone-100">{s.name}</div>
              <div className="text-[11px] text-bone-500 mt-0.5">{s.hint}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════ 身边的人 ══════════════ */

function PersonalForm({ onDone }: { onDone: (id: number) => void }) {
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [scenes, setScenes] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const filled = PROMPT_QUESTIONS.filter((q) => (answers[q.key] || "").trim()).length;
  const canSubmit = name.trim() && relationship && filled >= 2 && !loading;

  async function submit() {
    if (!canSubmit) return;
    setError("");
    setLoading(true);

    const description = [
      PROMPT_QUESTIONS.map((q) => {
        const a = (answers[q.key] || "").trim();
        return a ? `【${q.label}】\n${a}` : "";
      })
        .filter(Boolean)
        .join("\n\n"),
    ].join("\n");

    try {
      const res = await httpPost("/api/character/build", {
        name: name.trim(),
        relationship,
        scene: scenes.join("、"),
        description,
      });
      if (res?.characterId) onDone(res.characterId);
      else setError("构建失败，请重试");
    } catch (e: any) {
      setError(e.message || "构建失败");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="surface-raised p-8 text-center rise">
        <div className="w-16 h-16 mx-auto mb-6 relative">
          <div className="absolute inset-0 rounded-full border border-jade/25 breathe" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-jade" />
          </div>
        </div>
        <h3 className="font-display text-[18px] text-bone-50 mb-2">
          正在梳理「{name}」
        </h3>
        <p className="text-[13px] text-bone-500">
          从你给出的细节里，分离观察与推断
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rise">
      {/* 基础信息 */}
      <div className="surface p-5">
        <label className="block text-[13px] text-bone-300 mb-2.5">
          怎么称呼 TA
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="代号或真名都可以"
          className="field mb-4"
          autoFocus
        />

        <label className="block text-[13px] text-bone-300 mb-2.5">
          TA 与你的关系
        </label>
        <div className="flex flex-wrap gap-2">
          {RELATIONSHIPS.map((r) => (
            <button
              key={r}
              onClick={() => setRelationship(r)}
              className={`chip min-h-[38px] px-3.5 transition-colors ${
                relationship === r ? "chip-amber" : ""
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <label className="block text-[13px] text-bone-300 mb-2.5 mt-5">
          常在什么场景下相处（可多选）
        </label>
        <div className="flex flex-wrap gap-2">
          {SCENES.map((s) => (
            <button
              key={s}
              onClick={() =>
                setScenes((prev) =>
                  prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                )
              }
              className={`chip min-h-[38px] px-3.5 transition-colors ${
                scenes.includes(s) ? "chip-jade" : ""
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* 关键：引导具体描述 */}
      <div className="surface p-5">
        <div className="flex items-baseline gap-2 mb-1">
          <h3 className="text-[14px] text-bone-50 font-medium">你观察到的事实</h3>
          <span className="text-[11px] text-bone-500">
            至少填 2 项
          </span>
        </div>
        <p className="text-[12px] text-bone-500 leading-relaxed mb-4">
          具体行为比形容词有用得多。「TA 很冷漠」无法分析，「我说话时 TA 一直看手机」可以。
        </p>

        <div className="space-y-4">
          {PROMPT_QUESTIONS.map((q) => {
            const val = answers[q.key] || "";
            const ok = val.trim().length > 0;

            return (
              <div key={q.key}>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-[12.5px] text-bone-200">
                    {q.label}
                  </label>
                  {ok && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="text-jade">
                      <path d="m5 12.5 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <textarea
                  value={val}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [q.key]: e.target.value }))
                  }
                  placeholder={q.placeholder}
                  rows={4}
                  className="field"
                />
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="text-[12px] text-rose bg-rose/[0.08] border border-rose/20 rounded-lg px-3 py-2.5">
          {error}
        </div>
      )}

      <div className="sticky bottom-3 z-10">
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="btn-primary w-full"
        >
          {filled < 2
            ? `再补充 ${2 - filled} 项观察`
            : !relationship
              ? "请选择关系"
              : "开始研判"}
        </button>
      </div>

      <p className="text-[11px] text-bone-600 text-center leading-relaxed pb-2">
        分析结果只有你能看到。判断会有出错的可能，请用现实观察去检验它。
      </p>
    </div>
  );
}
