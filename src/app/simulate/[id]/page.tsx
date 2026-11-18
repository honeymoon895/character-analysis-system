"use client";

import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { httpGet, httpPost, httpPatch } from "@/lib/http";

/**
 * 对话模拟
 *
 * 关键设计：每一条对话都可以翻开"为什么"。
 * 旧版把分析藏在气泡下方的极小文字链接里，这里改成常驻的机制标签，
 * 并在展开后给出触发点、机制、意图三层——这正是人格档案的实际价值所在。
 */

interface AiContent {
  simulatedResponse: string;
  reactions: { probability: number; description: string }[];
  psychologicalAnalysis: string;
  intentionInference: string;
  adviceGiven: string[];
  trigger?: string;
  timestamp?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string | AiContent;
  timestamp?: string;
}

export default function SimulationPage() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const params = useParams();

  const [character, setCharacter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    init();
  }, []);

  async function init() {
    try {
      const res = await httpGet(`/api/character/${params.id}`);
      setCharacter(res.character);

      try {
        const hist = await httpGet(`/api/simulate/history?character_id=${params.id}`);
        const latest = (hist.sessions || [])[0];
        if (latest) {
          setSessionId(latest.id);
          setMessages(normalize(latest.messages || []));
        }
      } catch {}
    } catch {
      router.push("/");
    } finally {
      setLoading(false);
    }
  }

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: text, timestamp: new Date().toISOString() },
    ]);
    setSending(true);

    try {
      const res = await httpPost("/api/simulate", {
        characterId: character.id,
        sessionId,
        userAction: text,
        mode: "dialogue",
      });

      if (!(res instanceof Response)) {
        throw new Error("响应格式异常");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let payload: any = null;

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === "[DONE]") continue;
          try {
            payload = JSON.parse(raw);
          } catch {}
        }
      }

      if (payload?.error) throw new Error(payload.error);

      if (payload) {
        if (payload.sessionId) setSessionId(payload.sessionId);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: {
              simulatedResponse: payload.simulatedResponse || "",
              reactions: payload.reactions || [],
              psychologicalAnalysis: payload.psychologicalAnalysis || "",
              intentionInference: payload.intentionInference || "",
              adviceGiven: payload.adviceGiven || [],
              trigger: payload.trigger || "",
              timestamp: new Date().toISOString(),
            },
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: {
            simulatedResponse: "",
            reactions: [],
            psychologicalAnalysis: "",
            intentionInference: "",
            adviceGiven: [],
            trigger: "",
          },
          timestamp: new Date().toISOString(),
        },
      ]);
      alert(e.message || "发送失败");
    } finally {
      setSending(false);
    }
  }, [input, sending, character, sessionId]);

  async function newChat() {
    if (sessionId) {
      try {
        await httpPatch(`/api/simulate/${sessionId}`);
      } catch {}
    }
    setSessionId(null);
    setMessages([]);
    setExpanded(null);
  }

  if (loading) {
    return (
      <div className="shell pt-10">
        <div className="h-14 rounded-2xl bg-white/[0.03] animate-pulse" />
      </div>
    );
  }
  if (!character) return null;

  return (
    <div className="flex flex-col h-dvh md:h-dvh">
      {/* ═══ 顶栏 ═══ */}
      <div
        className="shrink-0 border-b border-white/[0.06]"
        style={{
          background: "rgba(7,8,11,0.86)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          paddingTop: "var(--safe-top)",
        }}
      >
        <div className="shell h-14 flex items-center gap-3">
          <button
            onClick={() => router.push(`/character/${character.id}`)}
            className="w-9 h-9 -ml-2 rounded-full flex items-center justify-center text-bone-400 hover:text-bone-100 transition-colors"
            aria-label="返回"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="m15 6-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 border border-white/10 bg-ink-750 flex items-center justify-center">
            {character.portraitUrl &&
            !character.portraitUrl.includes("dicebear.com") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={character.portraitUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="font-display text-[13px] text-bone-200">
                {character.name.charAt(0)}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-[14px] text-bone-50 truncate">
              {character.name}
            </div>
            <div className="text-[10.5px] text-bone-500">
              {sending ? "正在回应…" : "模拟对话"}
            </div>
          </div>

          <button
            onClick={newChat}
            className="text-[11.5px] text-bone-500 hover:text-bone-200 transition-colors px-3 py-2"
          >
            新对话
          </button>
        </div>
      </div>

      {/* ═══ 消息区 ═══ */}
      <div className="flex-1 overflow-y-auto">
        <div className="shell py-5 max-w-2xl">
          {messages.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-5 rounded-full border border-white/10 flex items-center justify-center breathe">
                <span className="w-1.5 h-1.5 rounded-full bg-amber/70" />
              </div>
              <h2 className="font-display text-[17px] text-bone-100 mb-2">
                说点什么
              </h2>
              <p className="text-[12.5px] text-bone-500 leading-relaxed max-w-xs mx-auto">
                TA 会按照性格档案里的方式回应你。
                <br />
                说错话也没关系——那恰好能看出 TA 的雷区。
              </p>
            </div>
          )}

          <div className="space-y-4">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <UserBubble key={i} content={m.content as string} />
              ) : (
                <AssistantBubble
                  key={i}
                  character={character}
                  content={m.content as AiContent}
                  expanded={expanded === i}
                  onToggle={() => setExpanded(expanded === i ? null : i)}
                />
              )
            )}

            {sending && <TypingIndicator character={character} />}
            <div ref={endRef} className="h-1" />
          </div>
        </div>
      </div>

      {/* ═══ 输入区 ═══ */}
      <div
        className="shrink-0 border-t border-white/[0.06]"
        style={{
          background: "rgba(11,13,17,0.95)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          paddingBottom: "var(--safe-bottom)",
        }}
      >
        <div className="shell py-3 max-w-2xl">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={`对 ${character.name} 说……`}
              rows={1}
              disabled={sending}
              className="field flex-1 py-3 resize-none max-h-[120px] leading-relaxed"
            />
            <button
              onClick={send}
              disabled={sending || !input.trim()}
              className="w-12 h-12 rounded-full shrink-0 flex items-center justify-center text-[#16110a] transition-transform active:scale-95 disabled:opacity-35"
              style={{
                background: "linear-gradient(180deg,#edc07a,#d9a75c)",
              }}
              aria-label="发送"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 19V5m0 0-6 6m6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════ 气泡 ══════════════ */

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div
        className="max-w-[82%] px-4 py-3 rounded-2xl rounded-br-md text-[14px] leading-[1.65] text-bone-50"
        style={{ background: "rgba(255,255,255,0.07)" }}
      >
        <p className="whitespace-pre-wrap break-words">{content}</p>
      </div>
    </div>
  );
}

function AssistantBubble({
  character,
  content,
  expanded,
  onToggle,
}: {
  character: any;
  content: AiContent;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasAnalysis =
    content.psychologicalAnalysis ||
    content.intentionInference ||
    content.trigger ||
    (content.reactions?.length ?? 0) > 0 ||
    (content.adviceGiven?.length ?? 0) > 0;

  return (
    <div className="flex gap-2.5">
      <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-white/10 bg-ink-750 flex items-center justify-center mt-0.5">
        {character.portraitUrl &&
        !character.portraitUrl.includes("dicebear.com") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={character.portraitUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="font-display text-[11px] text-bone-200">
            {character.name.charAt(0)}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1 max-w-[85%]">
        <div
          className="px-4 py-3 rounded-2xl rounded-tl-md text-[14px] leading-[1.68] text-bone-50"
          style={{
            background: "rgba(255,255,255,0.045)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <p className="whitespace-pre-wrap break-words">
            {content.simulatedResponse || "……"}
          </p>
        </div>

        {hasAnalysis && (
          <button
            onClick={onToggle}
            className="mt-1.5 flex items-center gap-1.5 text-[11px] text-bone-500 hover:text-amber/90 transition-colors py-1"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className={`transition-transform ${expanded ? "rotate-90" : ""}`}>
              <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {expanded ? "收起" : "为什么这么说"}
          </button>
        )}

        {expanded && hasAnalysis && (
          <div className="mt-2 space-y-2 rise">
            {content.trigger && (
              <AnalysisCard label="触发了什么" tone="rose">
                {content.trigger}
              </AnalysisCard>
            )}

            {content.psychologicalAnalysis && (
              <AnalysisCard label="心理机制" tone="neutral">
                {content.psychologicalAnalysis}
              </AnalysisCard>
            )}

            {content.intentionInference && (
              <AnalysisCard label="意图推断" tone="amber">
                {content.intentionInference}
              </AnalysisCard>
            )}

            {content.reactions && content.reactions.length > 0 && (
              <div className="surface p-3">
                <div className="text-[10px] tracking-[0.16em] uppercase text-bone-500 mb-2.5">
                  可能的反应
                </div>
                <div className="space-y-2">
                  {content.reactions.map((r, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div className="flex-1 h-1 rounded-full bg-white/[0.07] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-bone-400/50"
                          style={{ width: `${r.probability}%` }}
                        />
                      </div>
                      <span className="numeral text-[10px] text-bone-500 w-7 text-right">
                        {r.probability}%
                      </span>
                      <span className="text-[11.5px] text-bone-300 flex-1 truncate">
                        {r.description}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {content.adviceGiven && content.adviceGiven.length > 0 && (
              <div className="surface p-3">
                <div className="text-[10px] tracking-[0.16em] uppercase text-jade/70 mb-2">
                  可以试试
                </div>
                <ul className="space-y-1">
                  {content.adviceGiven.map((a, i) => (
                    <li key={i} className="text-[12px] text-bone-300 leading-relaxed flex gap-2">
                      <span className="text-jade/50 shrink-0">·</span>
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AnalysisCard({
  label,
  tone,
  children,
}: {
  label: string;
  tone: "amber" | "rose" | "neutral";
  children: ReactNode;
}) {
  const color =
    tone === "amber"
      ? "text-amber/75"
      : tone === "rose"
        ? "text-rose/75"
        : "text-bone-500";

  return (
    <div className="surface p-3">
      <div className={`text-[10px] tracking-[0.16em] uppercase ${color} mb-1.5`}>
        {label}
      </div>
      <p className="text-[12.5px] text-bone-200 leading-[1.75]">{children}</p>
    </div>
  );
}

function TypingIndicator({ character }: { character: any }) {
  return (
    <div className="flex gap-2.5">
      <div className="w-8 h-8 rounded-full shrink-0 border border-white/10 bg-ink-750 flex items-center justify-center">
        <span className="font-display text-[11px] text-bone-200">
          {character.name.charAt(0)}
        </span>
      </div>
      <div
        className="px-4 py-3.5 rounded-2xl rounded-tl-md"
        style={{
          background: "rgba(255,255,255,0.045)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex gap-1.5">
          {[0, 160, 320].map((delay) => (
            <span
              key={delay}
              className="w-1.5 h-1.5 rounded-full bg-bone-400 blink"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── 工具 ── */

function normalize(raw: any[]): ChatMessage[] {
  return raw.map((m: any) => {
    if (m.role === "assistant" && typeof m.content === "object" && m.content) {
      return {
        role: "assistant",
        content: {
          simulatedResponse:
            m.content.simulatedResponse || m.content.generatedResponse || "",
          reactions: m.content.reactions || [],
          psychologicalAnalysis:
            m.content.psychologicalAnalysis || m.content.mechanism || "",
          intentionInference:
            m.content.intentionInference || m.content.intention || "",
          adviceGiven: m.content.adviceGiven || m.content.advice || [],
          trigger: m.content.trigger || "",
          timestamp: m.content.timestamp || m.timestamp,
        },
        timestamp: m.timestamp,
      };
    }
    return {
      role: m.role,
      content: m.content || "",
      timestamp: m.timestamp,
    };
  });
}
